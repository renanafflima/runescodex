# Relatório de entrega — Missões Rewards v2

Data: 2026-11-17  
Produto: Web/PWA `https://tritech.app.br/runescodex`  
Escopo: implementação de código + testes. **Sem migrate/seed/deploy em produção.**

## 1. Critério 3+2+2

| Período | Slot 1 | Slots variáveis | Total API |
|---------|--------|-----------------|-----------|
| DAILY | Tributo aos Deuses (`FIXED_ADS`, WATCH_AD) | 2 do pool (pilares distintos quando possível) | até 3 |
| WEEKLY | Devoção Inabalável (`FIXED_WEEKLY_STREAK`) | 1 do pool | até 2 |
| MONTHLY | Lenda do Codex (`FIXED_MONTHLY_STREAK`) | 1 do pool | até 2 |

Rotação: SHA-256 determinística por ciclo UTC (`rewards.rotation.ts`), mesma para todos os usuários.

## 2. Catálogo

- 20 famílias × DAILY/WEEKLY/MONTHLY = 60 + 3 fixas = **63** linhas seed.
- Migration: `apps/api/prisma/migrations/20261117090000_rewards_mission_catalog_v2`
- Seed: `apps/api/prisma/seed/rewards-catalog-v2.ts` (idempotente; desativa LEGACY sem apagar histórico).

## 3. Eventos implementados (emissor real)

| Evento | Emissor |
|--------|---------|
| FORUM_TOPIC_CREATED / FORUM_COMMENT_CREATED | `forum.service` |
| COMMUNITY_CONTENT_LIKED | likes em guias Charm / rotações |
| GUIDE_PUBLISHED | publish Charm guide / community rotation |
| CHARM_BUILD_SAVED / CHARM_CREATURE_COMPLETED | charm-guides |
| BOSS_DEFEATED_RECORDED | bosstiary-progress checklist |
| ROTATION_EDITED / BOSSTIARY_COMMUNITY_ROTATION_PUBLISHED | community-rotations |
| CREATURE_VIEWED / HUNT_VIEWED / BOSSTIARY_OPENED | Web `POST /rewards/activity` |
| SHARE_LINK_CLICKED | botão compartilhar Hunt (após share/clipboard OK) |
| BESTIARY_FILTER_USED | filtro dificuldade / categoria boss |
| ARCHFOE_BOSS_VIEWED / LOOT_ITEM_VIEWED | ficha boss Archfoe/Nemesis + loot |
| PROMO_BANNER_OPENED | clique em banner HomePartnerCarousel |
| DAILY_ALL_COMPLETED / WEEKLY_ALL_COMPLETED | agregadores server-side + `UserRewardCycleCompletion` |

## 4. Não funcionais nesta entrega (fora da rotação)

| Missão / evento | Motivo |
|-----------------|--------|
| Tributo / WATCH_AD Web | Sem SSV Web verificável (GAM PoC incompleto). Slot fixo visível com `eventImplemented: false`. |
| Cartógrafo / HUNT_FAVORITED | Sem feature de favorito de Hunt |
| Oráculo / DAILY_INFO_VIEWED | Sem UI de shrine/boosted |
| Mercador / TOOL_CALCULATION_USED | Sem calculadoras no produto |
| Avaliador / CONTENT_RATED | Sem avaliação persistida |

Mobile AdMob SSV permanece no código; **não** há POST browser “eu assisti”.

## 5. Agregadores

- **Devoção**: exige conclusão das diárias *funcionais* do dia (≥2, exclui ads até SSV) por 7 dias UTC; progresso `daysCompleted/7`.
- **Lenda**: exige 4 ciclos `WEEKLY_ALL` cujos Mondays/overlap caem no mês (`weeklyPeriodStartsInMonth` limita a 4; 5ª semana não antecipa recompensa).

## 6. Testes executados

```text
apps/api: jest --testPathPatterns=rewards  → suites rewards.* PASS
apps/web: vitest domain/rewards.test.ts
```

Cobertura: rotação, catálogo 20 tipos, créditos idempotentes, períodos UTC, listagem 3 diárias FIXED_ADS+2 pool, carteira/ledger regressão.

## 7. Ativação (staging/prod sob autorização)

Ver `docs/deploy/rewards-missions-v2-activation.md`:

1. `npx prisma migrate deploy`
2. `npx tsx prisma/seed-rewards-run.ts` (bloqueia produção se APP_ENV=production)
3. Smoke `GET /rewards/missions?period=DAILY|WEEKLY|MONTHLY`

## 8. Preservação

Seed/migration **não** apagam wallets, ledger, receipts, redemptions nem progresso antigo. Missões LEGACY ficam `active=false`.

## 9. Frontend

`RewardsPage` mostra o que a API retorna; FIXED_ADS com aviso se ads Web indisponíveis; barras + dias/semanas das streaks; base `/runescodex/` preservada.
