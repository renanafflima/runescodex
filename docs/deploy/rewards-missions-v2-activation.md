# Ativação — Missões Rewards v2 (3+2+2)

**Não executar em produção sem autorização.**

## O que foi entregue no código

- Catálogo de 20 famílias × 3 períodos + 3 missões fixas (`rewards.mission-catalog.ts`).
- Rotação determinística UTC: diária = Tributo + 2 pool; semanal = Devoção + 1 pool; mensal = Lenda + 1 pool.
- `POST /rewards/activity` para eventos de visualização/compartilhamento/banner.
- Emissores server-side: fórum, likes, guias Charm, rotações Bosstiário, checklist de Boss, etc.
- Migration `20261117090000_rewards_mission_catalog_v2`.
- Seed idempotente `seedRewardsCatalogV2` (desativa LEGACY sem apagar histórico).

## Tributo aos Deuses (WATCH_AD Web)

**Bloqueado** até PoC GAM/AppLixir com callback verificável (ver `docs/technical-spikes/gam-rewarded-web-*.md`).  
A missão aparece no slot fixo com `eventImplemented: false`. Não há endpoint que aceite “assistiu” pelo browser.

## Missões pool ainda sem feature de produto

`eventImplemented: false` (não entram na rotação):

- Oráculo Diário (`DAILY_INFO_VIEWED`)
- Mercador de Suprimentos (`TOOL_CALCULATION_USED`)
- Avaliador de Campo (`CONTENT_RATED`)
- Cartógrafo (`HUNT_FAVORITED`) — até existir favorito de Hunt

## Ativar em staging

```bash
cd apps/api
# APP_ENV=staging + DATABASE_URL staging + hosts
npx prisma migrate deploy
npx tsx prisma/seed-rewards-run.ts
```

Smoke:

```http
GET /rewards/missions?period=DAILY
GET /rewards/missions?period=WEEKLY
GET /rewards/missions?period=MONTHLY
```

Esperado: ~3 / ~2 / ~2 itens (diária pode ter Tributo + 2 pool; se pool insuficiente, menos variáveis).

## Preservação

- Nenhuma carteira/ledger/receipt apagada.
- Missões antigas: `active=false`, `role=LEGACY`.
- Progresso antigo permanece nas linhas históricas.