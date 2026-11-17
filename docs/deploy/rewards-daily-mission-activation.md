# Ativação — missão diária «Compartilhe uma rotação» (produção)

**Escopo:** procedimento operacional para execução **futura e autorizada**.  
**Evento:** `BOSSTIARY_COMMUNITY_ROTATION_PUBLISHED`  
**Fora de escopo:** esta página não autoriza execução automática; cada etapa exige confirmação humana.

---

## 1. Pré-requisitos

| # | Requisito | Como verificar |
|---|-----------|----------------|
| 1 | Commit no `main` (ou branch de release) contendo: `rewards.daily-rotation.ts`, alterações em `rewards.service.ts`, seed `Compartilhe uma rotação` (DAILY), testes `rewards.daily-rotation.spec.ts` | `git log`, `git show` |
| 2 | Testes obrigatórios verdes: `npm test -- --testPathPatterns=rewards` (API), `npm run test -- rewards` (Web) | CI ou local |
| 3 | Validação em **staging** concluída (catálogo, 3 missões API, smoke Bosstiário) | checklist deste doc §8 |
| 4 | Seed idempotente revisado: `apps/api/prisma/seed/rewards.ts` — chave `title` + `period` + `category` | code review |
| 5 | Inventário **produção** conhecido (auditoria): 2 elegíveis até existir missão Bosstiário DAILY | SQL §6.1 |
| 6 | `APP_ENV=production`, `PRODUCTION_DATABASE_HOST` alinhado ao Neon de produção | Render dashboard (sem expor URL completa nos tickets) |
| 7 | Janela de manutenção e responsável definidos | ticket interno |

**Não executar seed em produção** sem item 1–3 aprovados e janela acordada.

---

## 2. Ordem de ativação (produção)

### 2.1 Backup / recuperação

- Neon: confirmar **PITR** / snapshot recente no projeto de **produção** (painel Neon).
- Anotar horário UTC do backup e ID do projeto (sem credenciais).

### 2.2 Deploy da API

1. Garantir que o build inclui rotação diária e `recordEvent` com filtro DAILY.
2. Deploy no serviço `runescodex-api` (Render) a partir do commit validado.
3. Aguardar `GET /health` = 200.

**Não** deployar frontend neste fluxo, salvo se CORS ou URL mudaram (normalmente não).

### 2.3 Seed idempotente (somente Rewards)

No host de operação (máquina com `apps/api/.env` de **produção** ou job Render one-off **se existir**):

```bash
cd apps/api
# Variáveis: APP_ENV=production, DATABASE_URL, PRODUCTION_DATABASE_HOST, JWT_SECRET (≥32)
npx tsx prisma/seed-rewards-run.ts
```

Comportamento esperado:

- Cria ou atualiza «Compartilhe uma rotação» (DAILY, target 1, 35 pts, evento Bosstiário).
- **Não** remove outras missões; **não** desativa `WATCH_AD` no banco (só fora da rotação na API).

`assertRuntimeEnvironment` **recusa** `APP_ENV=production` com flag `seed: true` no runner principal `prisma/seed.ts` — usar **`seed-rewards-run.ts`** que valida ambiente mas **não** bloqueia production para seed Rewards? 

**Verificar código antes de executar:** `seed-rewards-run.ts` chama `assertRuntimeEnvironment(process.env, { seed: true })` → **bloqueia produção**.

Para produção, opções operacionais (escolher uma, documentar no ticket):

- A) Executar seed Rewards via script temporário com aprovação explícita e override controlado (apenas se o time adicionar flag aprovada — hoje **bloqueado**).
- B) **Insert/update manual** idempotente via SQL supervisionado (§6.2).
- C) Ajustar política de seed em release dedicado (fora deste doc).

> **Estado atual do repositório:** `assertRuntimeEnvironment(..., { seed: true })` lança em `APP_ENV=production`. A ativação em produção provavelmente requer **SQL idempotente §6.2** ou mudança de política de seed em release futuro. Confirmar com engenharia antes da janela.

### 2.4 Confirmação no banco (read-only)

Executar consultas §6.1 no banco de **produção** (somente leitura).

### 2.5 Smoke test API

Com JWT de conta de teste **premium** (não conta de jogador aleatório em prod sem autorização):

```http
GET /rewards/missions?period=DAILY
Authorization: Bearer <token>
```

Esperado: **3** missões; títulos incluem «Compartilhe uma rotação» em dias com catálogo ≥3 elegíveis; **nenhuma** com `eventType` = `WATCH_AD` na lista.

`GET /rewards/me` → `missions.DAILY.total` = 3 (se todas aparecem no subset).

### 2.6 PWA (`https://tritech.app.br/runescodex`)

1. Aba **Diárias** → **3** cards.
2. Card Bosstiário: descrição, **+35 pts**, progresso 0/1.
3. Sem card de anúncios.

### 2.7 Teste controlado de publicação

1. Conta de teste premium; publicar rotação em `/bosstiary`.
2. Verificar `GET /rewards/missions?period=DAILY` → missão Bosstiário **concluída** se estava em rotação no dia.
3. Carteira +35 pontos **uma vez**; repetir publicação **nova** rotação = novo `referenceId` (nova progressão se meta >1 — aqui meta 1 por dia).
4. Repetir `POST` com mesma `Idempotency-Key` → sem segundo crédito.

---

## 3. Staging (prévia obrigatória)

| Item | Ação |
|------|------|
| Infra | Serviço `runescodex-api-staging` (`render.staging.yaml`) + Neon staging |
| Config local | `apps/api/.env.staging` (não commitar): `APP_ENV=staging`, `DATABASE_URL`, `STAGING_DATABASE_HOST`, `PRODUCTION_DATABASE_HOST`, `JWT_SECRET` |
| Guard | Host de `DATABASE_URL` **deve** igualar `STAGING_DATABASE_HOST` e **não** igualar produção |
| Seed staging | `DATABASE_URL` apontando staging: `npx tsx prisma/seed-rewards-run.ts` (permitido em staging) |
| API staging URL | Definir no painel Render; **não** há URL staging fixa no repositório |

Repetir passos §2.4–2.7 contra staging antes da janela de produção.

---

## 4. Mecanismo oficial de seed Rewards

| Comando | Escopo |
|---------|--------|
| `npm run prisma:seed` | Seed completo (`prisma/seed.ts`) — **recusa produção** |
| `npx tsx prisma/seed-rewards-run.ts` | Somente `REWARD_MISSIONS` + catálogo — valida ambiente; **seed flag recusa produção** |
| `seedRewards()` em `prisma/seed/rewards.ts` | Upsert por `title` + `period` + `category` |

---

## 5. Comportamento esperado da rotação (referência)

- Elegíveis: DAILY ativas, `isSupportedRewardEvent`, exceto `WATCH_AD`.
- Até **3** missões por dia UTC; mesma lista para todos os usuários.
- Implementação: `apps/api/src/rewards/rewards.daily-rotation.ts`.

---

## 6. Consultas SQL (somente leitura)

Substitua valores entre `<>` por literais; nunca colar `DATABASE_URL` em tickets.

### 6.1 Existência e catálogo da missão

```sql
SELECT id, title, period::text, target, "pointsReward",
       "eventType", active, category::text, "updatedAt"
FROM "RewardMission"
WHERE title = 'Compartilhe uma rotação'
  AND period = 'DAILY';
```

### 6.2 Insert idempotente manual (usar só se seed prod bloqueado — **com aprovação**)

```sql
-- Preferir UPDATE se linha já existir (mesmo title/period/category)
-- Exemplo: verificar antes com 6.1; se zero linhas, INSERT controlado
-- (não executar sem revisão de IDs e política de duplicatas)
```

### 6.3 Missões diárias ativas e elegibilidade conceitual

```sql
SELECT id, title, "eventType", active,
       CASE WHEN "eventType" = 'WATCH_AD' THEN 'excluded_from_rotation'
            WHEN active AND period = 'DAILY' AND "eventType" IS NOT NULL
            THEN 'candidate' ELSE 'no' END AS rotation_candidate
FROM "RewardMission"
WHERE period = 'DAILY'
ORDER BY title;
```

### 6.4 Elegíveis (contagem)

Contar linhas `candidate` da consulta acima excluindo `WATCH_AD` e eventos não suportados (fora do SQL: comparar com `REWARD_EVENTS` em `rewards.constants.ts`).

### 6.5 Progresso / pontos após teste Bosstiário

```sql
SELECT ump."userId", ump."missionId", ump.progress, ump.completed,
       ump."periodStart", m.title
FROM "UserMissionProgress" ump
JOIN "RewardMission" m ON m.id = ump."missionId"
WHERE m."eventType" = 'BOSSTIARY_COMMUNITY_ROTATION_PUBLISHED'
  AND m.period = 'DAILY'
ORDER BY ump."createdAt" DESC
LIMIT 20;
```

```sql
SELECT id, "userId", "eventType", "referenceId", "missionId", "periodStart", "createdAt"
FROM "RewardEventReceipt"
WHERE "eventType" = 'BOSSTIARY_COMMUNITY_ROTATION_PUBLISHED'
ORDER BY "createdAt" DESC
LIMIT 20;
```

```sql
SELECT id, "userId", "pointsDelta", type::text, "referenceType", "referenceId", "createdAt"
FROM "RewardLedgerEntry"
WHERE type = 'MISSION_REWARD'
  AND "referenceType" = 'RewardMission'
ORDER BY "createdAt" DESC
LIMIT 20;
```

---

## 7. Plano de contingência

| Sintoma | Ação |
|---------|------|
| Só 2 missões na API | Confirmar §6.1: missão Bosstiário DAILY existe e `active`; contar elegíveis (precisa ≥3 ou aceitar 2); verificar deploy com rotação |
| Missão não aparece no PWA mas API lista 3 | Allowlist Web `SERVER_RECORDED_EVENTS`; hard refresh; confirmar `isPlayableRewardMission` |
| Publicação sem progresso | Missão fora da rotação do dia; verificar IDs selecionados na API vs missão Bosstiário; premium/JWT |
| Pontos duplicados | §6.5 receipts e ledger; buscar duplicata mesmo `(referenceId, missionId, periodStart)` |
| Regressão pós-deploy | Rollback Render para release anterior; dados Rewards raramente precisam rollback se só leu seed |
| Seed falhou em prod | Não reexecutar às cegas; restaurar PITR Neon se corrupção; preferir SQL idempotente |

---

## 8. Checklist de validação staging (preencher antes de prod)

- [ ] `.env.staging` / Render staging: `APP_ENV=staging`, host = `STAGING_DATABASE_HOST`
- [ ] Missão §6.1 presente com target 1, 35 pts, ativa
- [ ] `GET /rewards/missions?period=DAILY` → 3 itens; sem `WATCH_AD`
- [ ] Dois usuários → mesmos `id` de missão no mesmo dia UTC
- [ ] Publicação Bosstiário → progresso 1/1 + 35 pts uma vez
- [ ] Idempotency-Key → sem segundo crédito
- [ ] PWA staging (se existir) ou Web apontando API staging

---

## 9. Histórico de revisão

| Data | Nota |
|------|------|
| 2026-11-16 | Procedimento criado na pré-validação; staging indisponível na workstation (sem `.env.staging`). |