# Auditoria do catálogo oficial do Bosstiary

Data: 2026-11-13T18:35:44.957Z

## Fontes
- TibiaWiki Bosstiário: https://www.tibiawiki.com.br/wiki/Bossti%C3%A1rio
- TibiaWiki Categoria Bosses (somente candidatos): https://www.tibiawiki.com.br/wiki/Categoria:Bosses
- Tibia Monk Bosstiary: https://www.tibiamonk.com/en/info/bosstiary

## Totais TibiaWiki (API categorymembers)
- Bane: 83
- Archfoe: 124
- Nemesis: 109
- **Total oficial listado:** 316

## Candidatos RuneCodex (`bosses-extracted.json`)
- Analisados: **538**
- Confirmados Bane: **83**
- Confirmados Archfoe: **123**
- Confirmados Nemesis: **108**
- Não pertencem ao Bosstiary: **224**
- Pendentes de verificação: **0**

## RuneCodex (20 registros atuais)
- Confirmados já cadastrados: **17** / 20
- Cadastrados sem confirmação no Bosstiary: **3**
  - `banebringer` → NOT_IN_BOSSTIARY
  - `fluffy` → NOT_IN_BOSSTIARY
  - `yube` → NOT_IN_BOSSTIARY
- Novos bosses confirmados (fora dos 20 atuais): **301**
- Slugs só no Neon / não estão em `bosses-extracted.json`: banebringer, count-vlarkor, duke-krenos, sir-nicator, timira-the-many, yube

### Mapa dos 20 slugs
- `abyssador` → CONFIRMED_BOSSTIARY (Archfoe) — wiki: Abyssador
- `banebringer` → NOT_IN_BOSSTIARY
- `black-knight` → CONFIRMED_BOSSTIARY (Bane) — wiki: Black Knight
- `bragrumol` → CONFIRMED_BOSSTIARY (Bane) — wiki: Bragrumol
- `count-vlarkor` → CONFIRMED_BOSSTIARY (Archfoe) — wiki: Count Vlarkorth
- `deathstrike` → CONFIRMED_BOSSTIARY (Archfoe) — wiki: Deathstrike
- `drume` → CONFIRMED_BOSSTIARY (Archfoe) — wiki: Drume
- `duke-krenos` → CONFIRMED_BOSSTIARY (Archfoe) — wiki: Duke Krule
- `fluffy` → NOT_IN_BOSSTIARY — wiki: Fluffy
- `gnomevil` → CONFIRMED_BOSSTIARY (Archfoe) — wiki: Gnomevil
- `grand-master-oberon` → CONFIRMED_BOSSTIARY (Archfoe) — wiki: Grand Master Oberon
- `kroazur` → CONFIRMED_BOSSTIARY (Bane) — wiki: Kroazur
- `lord-azaram` → CONFIRMED_BOSSTIARY (Archfoe) — wiki: Lord Azaram
- `mazoran` → CONFIRMED_BOSSTIARY (Archfoe) — wiki: Mazoran
- `ragiaz` → CONFIRMED_BOSSTIARY (Archfoe) — wiki: Ragiaz
- `scarlett-etzel` → CONFIRMED_BOSSTIARY (Archfoe) — wiki: Scarlett Etzel
- `sir-nicator` → CONFIRMED_BOSSTIARY (Archfoe) — wiki: Sir Nictros
- `timira-the-many` → CONFIRMED_BOSSTIARY (Archfoe) — wiki: Timira the Many-Headed
- `xenia` → CONFIRMED_BOSSTIARY (Nemesis) — wiki: Xenia
- `yube` → NOT_IN_BOSSTIARY

## Mini-bosses investigados
- **Grand Canon Dominus** → CONFIRMED_BANE (Bane)
- **Grand Chaplain Gaunder** → CONFIRMED_BANE (Bane)
- **Grand Commander Soeren** → CONFIRMED_BANE (Bane)
- **Jailer** → CONFIRMED_BANE (Bane)
- **Scarlett Etzel** → CONFIRMED_ARCHFOE (Archfoe)

## Limitação TibiaMonk
- NEXT_DATA não encontrado
- Totais parseados: Bane 0, Archfoe 0, Nemesis 0

## Limitações
- A auditoria usa a **união das categorias** `Bosses Bane/Archfoe/Nemesis` da TibiaWiki BR como prova de entrada no Bosstiary.
- Candidatos da categoria geral **Categoria:Bosses** sem essas tags são **NOT_IN_BOSSTIARY**.
- TibiaMonk foi usado como contraste; divergências viram **NEEDS_VERIFICATION**.
- Não houve alteração no banco Neon nem novos cadastros.
