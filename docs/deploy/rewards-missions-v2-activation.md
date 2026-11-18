# Ativação — Missões Rewards v2 (3+2+2)

**Não executar em produção sem autorização explícita.**

## Causa do “Nenhuma missão disponível”

Após a migration `20261117090000_rewards_mission_catalog_v2`, missões antigas ficam com:

- `role = LEGACY`
- `eventImplemented = false`

Sem as linhas do catálogo V2 (`POOL` / `FIXED_*`), a rotação retorna **arrays vazios** para DAILY, WEEKLY e MONTHLY.

O seed completo **recusa produção** por padrão (`assertRuntimeEnvironment({ seed: true })`).

## Recuperação automática (código)

A API chama `ensureRewardsCatalogV2` na primeira leitura de `/rewards/me` ou `/rewards/missions` quando **não existe nenhuma missão ativa** com role de rotação. Isso:

- faz upsert idempotente das 63 missões do catálogo;
- desativa LEGACY (`active=false`);
- **não** altera wallets, ledger, receipts nem resgates.

Após o deploy deste fix, o primeiro acesso autenticado Premium deve popular o catálogo.

## Ativação manual (staging)

```bash
cd apps/api
# APP_ENV=staging + DATABASE_URL staging
npx prisma migrate deploy
npx tsx prisma/seed-rewards-run.ts
```

## Ativação manual (produção — só com autorização)

```bash
cd apps/api
# Confirme APP_ENV=production e DATABASE_URL de produção
ALLOW_PRODUCTION_REWARDS_CATALOG_SEED=1 npx tsx prisma/seed-rewards-run.ts
```

## Smoke

```http
GET /rewards/missions?period=DAILY
GET /rewards/missions?period=WEEKLY
GET /rewards/missions?period=MONTHLY
```

Esperado: ~3 / ~2 / ~2 itens.

## Tributo aos Deuses

Slot fixo visível com `eventImplemented: false` até SSV Web. Sem POST browser “assistiu”.

## Preservação

Nenhuma carteira/ledger/receipt apagada. Progresso antigo permanece nas linhas históricas.