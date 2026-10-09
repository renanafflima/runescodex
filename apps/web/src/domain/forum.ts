export const FORUM_TITLE_MAX = 200;
export const FORUM_BODY_MAX = 5000;
export const FORUM_SEARCH_MAX = 80;

export const FORUM_CATEGORIES = [
  {
    id: "BESTIARY",
    label: "Bestiário",
    hint: "Criaturas, charms e informações",
    image: "images/forum/bestiario.png",
  },
  {
    id: "HUNTS",
    label: "Hunts",
    hint: "Spots, vocações e level",
    image: "images/forum/hunt.png",
  },
  {
    id: "PROFIT",
    label: "Profit",
    hint: "Loot, lucro e mercado",
    image: "images/forum/profit.png",
  },
  {
    id: "XP",
    label: "XP / Hora",
    hint: "Rotas e eficiência",
    image: "images/forum/xphora.png",
  },
  {
    id: "TIPS",
    label: "Dicas",
    hint: "Guias e conhecimento",
    image: "images/forum/dicas.png",
  },
] as const;

export type ForumCategoryId = (typeof FORUM_CATEGORIES)[number]["id"];

const CATEGORY_IDS = new Set<string>(FORUM_CATEGORIES.map((item) => item.id));

export function isForumCategory(value: unknown): value is ForumCategoryId {
  return typeof value === "string" && CATEGORY_IDS.has(value);
}

export function normalizeForumCategory(value: unknown): ForumCategoryId | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toUpperCase();
  return isForumCategory(normalized) ? normalized : null;
}

export function forumCategoryLabel(value: unknown) {
  const id = normalizeForumCategory(value);
  if (!id) return "Geral";
  return FORUM_CATEGORIES.find((item) => item.id === id)?.label ?? "Geral";
}

export function forumAuthorLabel(authorId: unknown, currentUserId?: string | null) {
  const id = typeof authorId === "string" ? authorId.trim() : "";
  if (!id) return "Aventureiro";
  if (currentUserId && currentUserId === id) return "Você";
  return `Aventureiro · ${id.slice(0, 8)}`;
}

export function forumReplyCount(item: { replyCount?: unknown; comments?: unknown }) {
  if (item.replyCount != null && Number.isFinite(Number(item.replyCount))) {
    return Math.max(0, Math.round(Number(item.replyCount)));
  }
  return Array.isArray(item.comments) ? item.comments.length : 0;
}

export function forumExcerpt(value: unknown, max = 140) {
  const text = typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
  if (!text) return "";
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

export function formatForumRelativeTime(value: unknown, now = Date.now()) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) return "";
  const minutes = Math.max(0, Math.floor((now - date.getTime()) / 60_000));
  if (minutes < 1) return "agora";
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `há ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "ontem";
  if (days < 7) return `há ${days} d`;
  return date.toLocaleDateString("pt-BR");
}

export function featuredForumThreads<T extends { replyCount?: unknown; comments?: unknown; createdAt?: unknown }>(
  threads: T[],
  take = 2,
) {
  return [...threads]
    .sort((left, right) => {
      const replyDiff = forumReplyCount(right) - forumReplyCount(left);
      if (replyDiff !== 0) return replyDiff;
      return new Date(String(right.createdAt ?? 0)).getTime() - new Date(String(left.createdAt ?? 0)).getTime();
    })
    .slice(0, take);
}

export type ForumComposeValues = {
  title: string;
  category: string;
  body: string;
  level?: string;
  vocation?: string;
  goal?: string;
  xpPerHour?: string;
  profitPerHour?: string;
};

export type ForumComposeErrors = {
  title?: string;
  category?: string;
  body?: string;
};

export function composeForumBody(values: ForumComposeValues) {
  const details = [
    values.level?.trim() ? `Level: ${values.level.trim()}` : "",
    values.vocation?.trim() ? `Vocação: ${values.vocation.trim()}` : "",
    values.goal?.trim() ? `Objetivo: ${values.goal.trim()}` : "",
    values.xpPerHour?.trim() ? `XP/h: ${values.xpPerHour.trim()}` : "",
    values.profitPerHour?.trim() ? `Profit/h: ${values.profitPerHour.trim()}` : "",
  ].filter(Boolean);

  const body = values.body.trim();
  if (details.length === 0) return body;
  return `${body}\n\n---\nContexto da hunt\n${details.join("\n")}`;
}

export function validateForumCompose(values: ForumComposeValues): ForumComposeErrors {
  const errors: ForumComposeErrors = {};
  const title = values.title.trim();
  const body = composeForumBody(values);

  if (!title) {
    errors.title = "Informe um título objetivo para a discussão.";
  } else if (title.length > FORUM_TITLE_MAX) {
    errors.title = `O título pode ter no máximo ${FORUM_TITLE_MAX} caracteres.`;
  }

  if (!normalizeForumCategory(values.category)) {
    errors.category = "Escolha uma categoria.";
  }

  if (!values.body.trim()) {
    errors.body = "Descreva o assunto com contexto suficiente.";
  } else if (body.length > FORUM_BODY_MAX) {
    errors.body = `O conteúdo pode ter no máximo ${FORUM_BODY_MAX} caracteres, incluindo o contexto opcional.`;
  }

  return errors;
}

export function forumComposeIsDirty(values: ForumComposeValues) {
  return Boolean(
    values.title.trim() ||
      values.body.trim() ||
      values.level?.trim() ||
      values.vocation?.trim() ||
      values.goal?.trim() ||
      values.xpPerHour?.trim() ||
      values.profitPerHour?.trim() ||
      values.category,
  );
}
