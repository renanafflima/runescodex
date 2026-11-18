# Rewards V2 — rotação global e performance

## Diagnóstico do gargalo

`GET /rewards/missions` chamava `ensureRewardsCatalogV2` dentro de `$transaction` interativa com ~63 upserts sequenciais → **P2028** (timeout 5s).

Além disso, cada request:

1. lia todas as missões ativas do período (até dezenas);
2. recalculava o sorteio em memória;
3. só então lia o progresso do usuário.

## Arquitetura após a otimização

| Etapa | Comportamento |
|-------|----------------|
| Catálogo | Cache de processo + 1 `COUNT` barato; `createMany` só se incompleto (sem tx interativa) |
| Rotação | Tabela `RewardGlobalRotation` — 1 linha por ciclo UTC, mesma para todos |
| listMissions | ensure barato → `findUnique` rotação → `findMany` por ids (≤3/2/2) → progresso |
| Progresso | Continua individual (`UserMissionProgress`) |

## Consultas (caminho quente, catálogo já pronto)

### Antes
- ensure incompleto: dezenas de round-trips em tx interativa (falha P2028)
- `findMany` todas missões do período
- `findMany` progresso
- opcional: contagem de ciclo (WEEKLY/MONTHLY)

### Depois (DAILY típico)
1. *(0 se cache)* `COUNT` integridade — só no primeiro request do processo  
2. `RewardGlobalRotation.findUnique` (ou cache de processo)  
3. `RewardMission.findMany` where `id in (...)` — até 3 linhas  
4. `UserMissionProgress.findMany` — só essas missões  

**~3 queries** no caminho quente (2 se a rotação já está no cache do processo).

## Tempo

- Antes: timeout 5s (P2028) na inicialização do catálogo.  
- Depois: ensure ausente no hot path; bootstrap raro via `createMany` (1–2 queries), sem tx interativa de 5s.  
- listMissions esperado: dezenas de ms em staging com índices existentes (mensurável após migrate + deploy).

## Migration

`20261118180000_rewards_global_rotation` — criar tabela apenas. Não altera wallets/ledger/progress.

## Procedimento manual

1. Deploy do código.  
2. `npx prisma migrate deploy` (com autorização).  
3. Primeiro Premium a abrir Rewards popula catálogo (se faltar) e a rotação do ciclo.  
4. Smoke: `GET /rewards/missions?period=DAILY|WEEKLY|MONTHLY` → 3 / 2 / 2.