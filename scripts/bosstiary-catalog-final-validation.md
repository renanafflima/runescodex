# Validação final — catálogo Bosstiary

Data: 2026-11-13T18:45:13.039Z

## Reconciliação de contagens

| Métrica | Valor |
|---------|------:|
| Confirmados na auditoria (candidatos) | **314** |
| Já no Neon com Bosstiary comprovado | **17** / 20 |
| Legacy sem Bosstiary (preservados) | **3** |
| **Novos bosses válidos para expansão** | **297** |
| Métrica antiga newConfirmedBeyondTwenty | **301** |
| Diferença explicada | **4** (aliases de slug) |

314 confirmados − 17 identidades wiki já no Neon = 297 novos; 301 − 4 slugs fantasmas de alias = 297.

### Os 4 slugs que inflam 301 → 297
- **count-vlarkorth** (Count Vlarkorth) → Neon: `count-vlarkor`
- **duke-krule** (Duke Krule) → Neon: `duke-krenos`
- **sir-nictros** (Sir Nictros) → Neon: `sir-nicator`
- **timira-the-many-headed** (Timira the Many-Headed) → Neon: `timira-the-many`

## 316 títulos wiki vs 314 confirmados

- Soma API Bane+Archfoe+Nemesis: **316**
- Títulos únicos (união): **316**
- Confirmados entre candidatos: **314**
- Explicação: 2 título(s) oficiais da Wiki não classificados entre os 538 candidatos (não é sobreposição de categorias).

Títulos oficiais ausentes dos 314:
- **Tentugly's Head** (Archfoe) — Candidato em bosses-extracted.json com nome de template MediaWiki, não casou com a lista oficial.
- **Hatebreeder** (Nemesis) — Ausente de bosses-extracted.json; não passou pela auditoria de candidatos.

## 20 registros atuais

- `abyssador` — CONFIRMED_BOSSTIARY [Archfoe] — wiki: Abyssador — certeza: inequívoca
- `banebringer` — NOT_IN_BOSSTIARY — wiki: — — certeza: legacy — sem entrada Bosstiary
  - Registro legacy; não desativar nesta etapa.
- `black-knight` — CONFIRMED_BOSSTIARY [Bane] — wiki: Black Knight — certeza: inequívoca
- `bragrumol` — CONFIRMED_BOSSTIARY [Bane] — wiki: Bragrumol — certeza: inequívoca
- `count-vlarkor` — CONFIRMED_BOSSTIARY [Archfoe] — wiki: Count Vlarkorth — certeza: inequívoca via alias
  - Alias explícito: Count Vlarkorth | Nome Neon "Count Vlarkor" difere do título wiki "Count Vlarkorth" (slug preservado).
- `deathstrike` — CONFIRMED_BOSSTIARY [Archfoe] — wiki: Deathstrike — certeza: inequívoca
- `drume` — CONFIRMED_BOSSTIARY [Archfoe] — wiki: Drume — certeza: inequívoca
- `duke-krenos` — CONFIRMED_BOSSTIARY [Archfoe] — wiki: Duke Krule — certeza: inequívoca via alias
  - Alias explícito: Duke Krule | Nome Neon "Duke Krenos" difere do título wiki "Duke Krule" (slug preservado).
- `fluffy` — NOT_IN_BOSSTIARY — wiki: Fluffy — certeza: legacy — sem entrada Bosstiary
  - Registro legacy; não desativar nesta etapa.
- `gnomevil` — CONFIRMED_BOSSTIARY [Archfoe] — wiki: Gnomevil — certeza: inequívoca
- `grand-master-oberon` — CONFIRMED_BOSSTIARY [Archfoe] — wiki: Grand Master Oberon — certeza: inequívoca
- `kroazur` — CONFIRMED_BOSSTIARY [Bane] — wiki: Kroazur — certeza: inequívoca
- `lord-azaram` — CONFIRMED_BOSSTIARY [Archfoe] — wiki: Lord Azaram — certeza: inequívoca
- `mazoran` — CONFIRMED_BOSSTIARY [Archfoe] — wiki: Mazoran — certeza: inequívoca
- `ragiaz` — CONFIRMED_BOSSTIARY [Archfoe] — wiki: Ragiaz — certeza: inequívoca
- `scarlett-etzel` — CONFIRMED_BOSSTIARY [Archfoe] — wiki: Scarlett Etzel — certeza: inequívoca
- `sir-nicator` — CONFIRMED_BOSSTIARY [Archfoe] — wiki: Sir Nictros — certeza: inequívoca via alias
  - Alias explícito: Sir Nictros | Nome Neon "Sir Nicator" difere do título wiki "Sir Nictros" (slug preservado).
- `timira-the-many` — CONFIRMED_BOSSTIARY [Archfoe] — wiki: Timira the Many-Headed — certeza: inequívoca via alias
  - Alias explícito: Timira the Many-Headed | Nome Neon "Timira the Many" difere do título wiki "Timira the Many-Headed" (slug preservado).
- `xenia` — CONFIRMED_BOSSTIARY [Nemesis] — wiki: Xenia — certeza: inequívoca
- `yube` — NOT_IN_BOSSTIARY — wiki: — — certeza: legacy — sem entrada Bosstiary
  - Registro legacy; não desativar nesta etapa.

## Legacy preservado (3)
- `banebringer`: Legacy não confirmado no Bosstiary; registro preservado.
- `fluffy`: Legacy não confirmado no Bosstiary; registro preservado.
- `yube`: Legacy não confirmado no Bosstiary; registro preservado.

## Novos bosses válidos

Total: **297** (lista completa em `bosstiary-catalog-final-validation.json`).

## Ambiguidades e ressalvas
- Wiki oficial sem entrada nos 314: **Tentugly's Head**
- Wiki oficial sem entrada nos 314: **Hatebreeder**
- Métrica do audit: compare.newConfirmedBeyondTwenty compara slugs dos 20 targets com slugs wiki dos confirmados, ignorando aliases — gera 301 em vez de 297.
- Candidato Tentugly corrompido: slug `ifeq-home-tentugly-tentuglys-head`

Slugs (Criatura) divergentes do slugify do nome:
- Owin (Criatura): `owin-criatura` vs `owin`
- The First Dragon (Criatura): `the-first-dragon-criatura` vs `the-first-dragon`

## Erros de validação
- Nenhum.

## Restrições respeitadas
- Sem Neon, migrations, sync, commit ou alteração dos 20 registros/candidatos originais.
