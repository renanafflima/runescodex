import {
  BosstiaryAccessStatus,
} from '../../generated/prisma/client.js';
import {
  BOSSTIARY_LOOT_STRATEGY_PREFIX,
  combineWikiStrategyField,
  type BosstiaryWikiParsed,
} from './bosstiary-wiki-sync.js';

export const WIKI_API_ENDPOINTS = [
  'https://tibia.fandom.com/api.php',
  'https://www.tibiawiki.com.br/api.php',
] as const;

const JUNK_LOOT = new Set([
  'Gold Coin',
  'Platinum Coin',
  'Crystal Coin',
  'Health Potion',
  'Mana Potion',
  'Spirit Potion',
  'Great Health Potion',
  'Great Mana Potion',
  'Ultimate Health Potion',
  'Supreme Health Potion',
  'Ultimate Mana Potion',
  'Ultimate Spirit Potion',
]);

export type ParsedWikiBoss = BosstiaryWikiParsed & {
  hp: number | null;
  wikiTitle: string;
  wikiSource: string;
};

export type WikiFetchResult = {
  wikitext: string;
  title: string;
  source: string;
};

export function normalizeTitleToken(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function validateWikiPageTitle(expectedName: string, resolvedTitle: string) {
  const expected = normalizeTitleToken(expectedName);
  const resolved = normalizeTitleToken(resolvedTitle);
  if (!expected || !resolved) return false;
  if (expected === resolved) return true;
  if (resolved.includes(expected) || expected.includes(resolved)) return true;
  const expectedTokens = new Set(expected.split(' ').filter(Boolean));
  const resolvedTokens = new Set(resolved.split(' ').filter(Boolean));
  let overlap = 0;
  for (const token of expectedTokens) {
    if (resolvedTokens.has(token)) overlap += 1;
  }
  return overlap >= Math.min(expectedTokens.size, resolvedTokens.size, 2);
}

function cleanWikiText(value: string) {
  return value
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/\{\{Loot Item\|([^}|]+)(?:\|[^}]*)?\}\}/gi, '$1')
    .replace(/\{\{[^}]+\}\}/g, ' ')
    .replace(/\[\[([^|\]]+)\|([^\]]+)]]/g, '$2')
    .replace(/\[\[([^\]]+)]]/g, '$1')
    .replace(/'''+/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractTemplateBlock(wikitext: string, label: string) {
  const pattern = new RegExp(`\\{\\{${label}`, 'i');
  const start = wikitext.search(pattern);
  if (start < 0) return null;
  let depth = 0;
  let index = start;
  while (index < wikitext.length) {
    if (wikitext.startsWith('{{', index)) {
      depth += 1;
      index += 2;
      continue;
    }
    if (wikitext.startsWith('}}', index)) {
      depth -= 1;
      index += 2;
      if (depth === 0) return wikitext.slice(start, index);
      continue;
    }
    index += 1;
  }
  return wikitext.slice(start);
}

export function parseInfoboxParams(wikitext: string): Map<string, string> {
  const params = new Map<string, string>();
  const body =
    extractTemplateBlock(wikitext, 'Infobox Creature') ??
    extractTemplateBlock(wikitext, 'Infobox') ??
    wikitext;
  const pattern = /\n\|\s*([a-zA-Z0-9_]+)\s*=\s*([\s\S]*?)(?=\n\||\n\}\})/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(body)) !== null) {
    params.set(match[1].toLowerCase(), match[2].trim());
  }
  return params;
}

function parseHp(raw: string | undefined): number | null {
  if (!raw) return null;
  const digits = raw.replace(/[^\d]/g, '');
  if (!digits) return null;
  const hp = Number(digits);
  return Number.isFinite(hp) ? hp : null;
}

function normalizeOfficialCategory(raw: string | undefined): string | null {
  const value = cleanWikiText(raw ?? '').toLowerCase();
  if (!value || value === '--') return null;
  if (value.includes('bane')) return 'Bane';
  if (value.includes('nemesis')) return 'Nemesis';
  if (value.includes('archfoe') || value.includes('arch foe')) return 'Archfoe';
  return null;
}

function bossPointsForCategory(category: string | null) {
  if (category === 'Bane') return 5;
  if (category === 'Nemesis') return 30;
  if (category === 'Archfoe') return 10;
  return null;
}

function parseCooldownSeconds(raw: string | undefined) {
  const cleaned = cleanWikiText(raw ?? '');
  if (!cleaned || cleaned === '--' || /^no$/i.test(cleaned)) return null;
  const hours = Number(cleaned.replace(/[^\d.]/g, ''));
  if (!Number.isFinite(hours) || hours <= 0) return null;
  return Math.round(hours * 3600);
}

const isPlausibleLootName = (name: string) => /[A-Za-z]/.test(name) && !/^[\d\s,.-]+$/.test(name);

function isLowQualityWikiText(value: string | null | undefined) {
  const text = value?.trim();
  if (!text) return true;
  if (/\|\s*\}\}/.test(text)) return true;
  if (/\|\s*[a-z_]+\s*=/i.test(text)) return true;
  if (/^[\s|{}]+$/i.test(text)) return true;
  return false;
}

function parseLoot(params: Map<string, string>) {
  const lootBlock = params.get('loot') ?? '';
  const items = new Set<string>();
  const lootItemPattern = /\{\{Loot Item\|([^}|]+)(?:\|[^}]*)?\}\}/gi;
  let match: RegExpExecArray | null;
  while ((match = lootItemPattern.exec(lootBlock)) !== null) {
    const name = cleanWikiText(match[1]);
    if (!name || JUNK_LOOT.has(name) || !isPlausibleLootName(name)) continue;
    items.add(name);
  }
  const list = [...items];
  if (list.length === 0) return null;
  return `${BOSSTIARY_LOOT_STRATEGY_PREFIX} ${list.join(', ')}`;
}

function parseStrategyField(params: Map<string, string>) {
  const loot = parseLoot(params);
  const combatRaw = cleanWikiText(params.get('strategy') ?? '') || null;
  const combat = combatRaw && !isLowQualityWikiText(combatRaw) ? combatRaw : null;
  return combineWikiStrategyField(loot, combat);
}

export function sanitizeWikiParsed<T extends BosstiaryWikiParsed>(parsed: T): T {
  return {
    ...parsed,
    locationName: isLowQualityWikiText(parsed.locationName) ? null : parsed.locationName,
    locationRegion: isLowQualityWikiText(parsed.locationRegion) ? null : parsed.locationRegion,
    originCity: isLowQualityWikiText(parsed.originCity) ? null : parsed.originCity,
    accessRequirements: isLowQualityWikiText(parsed.accessRequirements)
      ? null
      : parsed.accessRequirements,
    strategy: isLowQualityWikiText(parsed.strategy) ? null : parsed.strategy,
    mechanics: isLowQualityWikiText(parsed.mechanics) ? null : parsed.mechanics,
  };
}

function parseMechanics(params: Map<string, string>) {
  const chunks: string[] = [];
  const abilities = cleanWikiText(params.get('abilities') ?? '');
  if (abilities && !isLowQualityWikiText(abilities)) {
    chunks.push(`Habilidades: ${abilities.slice(0, 420)}${abilities.length > 420 ? '…' : ''}`);
  }
  const immune: string[] = [];
  if (/yes/i.test(params.get('paraimmune') ?? '')) immune.push('paralisia');
  if (/yes/i.test(params.get('senseinvis') ?? '')) immune.push('invisível');
  if (immune.length) chunks.push(`Imunidades: ${immune.join(', ')}`);
  const weak: string[] = [];
  for (const [key, label] of [
    ['firedmgmod', 'fogo'],
    ['icedmgmod', 'gelo'],
    ['holydmgmod', 'sagrado'],
    ['deathdmgmod', 'morte'],
    ['energydmgmod', 'energia'],
    ['earthdmgmod', 'terra'],
  ] as const) {
    const mod = params.get(key);
    const numeric = mod ? Number(mod.replace(/[^\d.]/g, '')) : NaN;
    if (Number.isFinite(numeric) && numeric > 100) weak.push(label);
  }
  if (weak.length) chunks.push(`Fraquezas: ${weak.join(', ')}`);
  if (!chunks.length) return null;
  return chunks.join(' · ');
}

function parseQuest(params: Map<string, string>) {
  if (!params.has('quest')) {
    return { accessStatus: null as BosstiaryAccessStatus | null, accessRequirements: null as string | null };
  }
  const quest = cleanWikiText(params.get('quest') ?? '');
  if (!quest || quest === '--' || /^no$/i.test(quest)) {
    return { accessStatus: BosstiaryAccessStatus.NONE, accessRequirements: null as string | null };
  }
  return { accessStatus: BosstiaryAccessStatus.REQUIRED, accessRequirements: quest };
}

function parseLocationRegion(params: Map<string, string>) {
  const region = cleanWikiText(params.get('region') ?? params.get('locationdetails') ?? '');
  return region || null;
}

export function parseWikiBoss(wikitext: string, wikiTitle: string, wikiSource: string): ParsedWikiBoss {
  const params = parseInfoboxParams(wikitext);
  const officialCategory = normalizeOfficialCategory(params.get('bosstiaryclass'));
  const quest = parseQuest(params);
  const locationName = cleanWikiText(params.get('location') ?? '') || null;
  const originCity = cleanWikiText(params.get('city') ?? '') || null;
  return {
    officialCategory,
    bossPoints: bossPointsForCategory(officialCategory),
    locationName,
    originCity,
    locationRegion: parseLocationRegion(params),
    accessRequirements: quest.accessRequirements,
    accessStatus: quest.accessStatus,
    cooldownSeconds: parseCooldownSeconds(params.get('cooldown')),
    strategy: parseStrategyField(params),
    mechanics: parseMechanics(params),
    recommendedLevelSolo: null,
    recommendedLevelParty: null,
    difficulty: null,
    huntMode: null,
    hp: parseHp(params.get('hp')),
    wikiTitle,
    wikiSource,
  };
}

export async function fetchWikiPage(pageTitle: string): Promise<WikiFetchResult> {
  let lastError: Error | null = null;
  for (const endpoint of WIKI_API_ENDPOINTS) {
    try {
      const url = new URL(endpoint);
      url.searchParams.set('action', 'parse');
      url.searchParams.set('page', pageTitle);
      url.searchParams.set('prop', 'wikitext|displaytitle');
      url.searchParams.set('format', 'json');
      const response = await fetch(url, {
        headers: { 'User-Agent': 'RuneCodexBosstiarySync/2.0 (contact: renan)' },
      });
      if (!response.ok) throw new Error(`Wiki HTTP ${response.status}`);
      const payload = (await response.json()) as {
        error?: { info?: string };
        parse?: { title?: string; wikitext?: { '*': string } };
      };
      if (payload.error) throw new Error(payload.error.info ?? 'Wiki error');
      const wikitext = payload.parse?.wikitext?.['*'];
      const title = payload.parse?.title ?? pageTitle;
      if (!wikitext?.trim()) throw new Error('Wikitext vazio');
      return { wikitext, title, source: endpoint };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
    }
  }
  throw lastError ?? new Error(`Wiki indisponível para ${pageTitle}`);
}

export async function fetchWikiPageWithAliases(pageTitles: string[]): Promise<WikiFetchResult> {
  let lastError: Error | null = null;
  const unique = [...new Set(pageTitles.map((title) => title.trim()).filter(Boolean))];
  for (const title of unique) {
    try {
      return await fetchWikiPage(title);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
    }
  }
  throw lastError ?? new Error(`Wiki indisponível para ${unique.join(', ')}`);
}
