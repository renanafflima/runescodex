# Staging — preparação do ambiente RuneCodex

**Última atualização:** 2026-11-16  
**Escopo deste documento:** auditoria de configuração + plano de provisionamento **manual**. Nenhum recurso foi criado nem alterado ao redigir este guia.

**Objetivo:** permitir validar Rewards (rotação diária) e publicação de rotações Bosstiário **sem tocar produção**.

---

## Fase 1 — Estado atual (auditoria)

### Situação observada (pré-trabalho)

| Item | Estado |
|------|--------|
| `render.staging.yaml` no repositório | **Presente** — blueprint separado de `render.yaml` |
| Serviço `runescodex-api-staging` no Render | **Não comprovado** — `GET https://runescodex-api-staging.onrender.com/health` retornou **404** |
| Neon dedicado staging | **Ausente** na workstation (sem host staging documentado) |
| `apps/api/.env.staging` | **Ausente** |
| `apps/api/.env.staging.example` | **Presente** (template sem segredos) |
| Workstation `apps/api/.env` | Apontava **produção** — **não usar** para staging |

### Arquivos de referência

| Arquivo | Função |
|---------|--------|
| [`render.yaml`](../../render.yaml) | Produção: API `runescodex-api` + estático `runescodex-web` |
| [`render.staging.yaml`](../../render.staging.yaml) | Staging: **somente** API `runescodex-api-staging` |
| [`apps/api/.env.staging.example`](../../apps/api/.env.staging.example) | Template local / referência de variáveis |
| [`apps/api/.env.example`](../../apps/api/.env.example) | Desenvolvimento (não staging) |
| [`apps/api/ENVIRONMENTS.md`](../../apps/api/ENVIRONMENTS.md) | Política de ambientes, MP, tickets, seeds |
| [`apps/api/prisma.config.ts`](../../apps/api/prisma.config.ts) | Datasource + `assertDatabaseEnvironment` no CLI Prisma |
| [`apps/api/src/common/database-target.ts`](../../apps/api/src/common/database-target.ts) | Guards host + JWT + seed em produção |
| [`apps/api/src/common/cors.ts`](../../apps/api/src/common/cors.ts) | Origens CORS padrão + `CORS_ORIGINS` |
| [`apps/web/.env.example`](../../apps/web/.env.example) | `VITE_API_BASE_URL` aponta API **produção** por padrão |

### O que é necessário para a API staging **subir**

1. **Neon (ou Postgres)** exclusivo — projeto/branch separado; host distinto do de produção.
2. **Render:** aplicar blueprint `render.staging.yaml` (serviço web Node 22, `rootDir: apps/api`).
3. **Variáveis no painel** (ver §4 e §5) — em especial `APP_ENV=staging`, `DATABASE_URL`, `STAGING_DATABASE_HOST`, `PRODUCTION_DATABASE_HOST`, `JWT_SECRET` (≥32, único).
4. **Migrations** aplicadas **uma vez** no banco staging (`prisma migrate deploy`) com `DATABASE_URL` de staging — **não** faz parte do deploy automático atual.
5. **Opcional pós-migrate:** seed parcial Rewards (`npx tsx prisma/seed-rewards-run.ts`) — permitido em staging; **bloqueado** em produção pelo guard de seed completo.
6. **Health:** `GET /health` → `200` com `{ status: 'ok', database: 'connected' }` se DB acessível.

### Diferenças prod vs staging (blueprint)

| Aspecto | `render.yaml` (prod) | `render.staging.yaml` |
|---------|----------------------|------------------------|
| Nome serviço | `runescodex-api` | `runescodex-api-staging` |
| `APP_ENV` | `production` | `staging` |
| Build | `npm install --include=dev && npm run build && npm prune --omit=dev` | `npm install && npm run build` |
| Start | `npm run start:prod` | `npm run start:prod` |
| Frontend estático | Incluído (`runescodex-web`) | **Não incluído** |
| `ENABLE_MERCADO_PAGO_ADMIN_DIAGNOSTIC` | Declarado em prod | **Ausente** em staging (opcional) |

### Prisma e migrations

- Schema: `apps/api/prisma/schema.prisma`
- Migrate: `npm run prisma:migrate:deploy` → `prisma migrate deploy`
- Ao rodar CLI, `prisma.config.ts` chama `assertDatabaseEnvironment` — recusa host errado para o `APP_ENV` atual.
- **Deploy Render não executa migrations** — ver `ENVIRONMENTS.md` (etapa manual controlada).

### Arranque local staging (após build)

```bash
cd apps/api
cp .env.staging.example .env.staging   # preencher manualmente — não commitar
npm run build
npm run start:staging                  # node --env-file=.env.staging dist/src/main.js
```

### Autenticação

- JWT emitido com `JWT_SECRET` do ambiente staging — **tokens de produção não validam** em staging.
- `GOOGLE_CLIENT_ID` deve coincidir com o cliente OAuth usado pelo frontend de teste (`VITE_GOOGLE_CLIENT_ID`).

### Frontend e URLs

- **Produção PWA:** `https://tritech.app.br/runescodex` → API padrão `https://runescodex-api.onrender.com`.
- **Staging:** não há serviço web no `render.staging.yaml`. Opções futuras:
  - Preview Vite local com `VITE_API_BASE_URL=https://<runescodex-api-staging>.onrender.com`
  - Segundo static site Render (não definido no repo)
  - Adicionar origem em `CORS_ORIGINS` para o host usado nos testes

---

## Fase 2 — Plano de infraestrutura (sem provisionar agora)

### 2.1 Neon (staging)

1. Criar **projeto Neon separado** ou branch dedicada (nunca o mesmo host de produção).
2. Criar role e banco (ex.: `neondb_staging`).
3. Copiar **somente o hostname** (pooler) para `STAGING_DATABASE_HOST` — sem colar URL completa em tickets públicos.
4. Construir `DATABASE_URL` no painel Render (sync: false).
5. Registrar em runbook interno: `PRODUCTION_DATABASE_HOST` = hostname Neon **produção** (apenas para o guard bloquear misconfig).

**Checklist Neon**

- [ ] Host staging ≠ host produção
- [ ] SSL (`sslmode=require`)
- [ ] Backup/PITR ativado conforme política interna

### 2.2 Render — `runescodex-api-staging`

1. Render Dashboard → **New** → **Blueprint** / Manual Web Service.
2. Conectar repositório; apontar para `render.staging.yaml` ou recriar manualmente os campos do arquivo.
3. Região: preferir mesma do Neon (`sa-east-1` se produção já usa).
4. Health check path: `/health`.
5. Preencher variáveis §4 (secrets no dashboard).
6. Primeiro deploy **falhará** sem `DATABASE_URL`/`JWT_SECRET` — esperado.

**URL esperada após sucesso:** `https://runescodex-api-staging.onrender.com` (nome pode variar se o serviço nunca foi criado).

### 2.3 Build e start (conforme blueprint)

```text
buildCommand: npm install && npm run build
startCommand: npm run start:prod
```

`build` executa `prisma generate && nest build`. Runtime usa `dist/src/main.js`.

### 2.4 Migrations (ordem operacional)

```bash
# Na máquina do operador, com apps/api/.env.staging carregado:
cd apps/api
set APP_ENV=staging   # PowerShell: $env:APP_ENV='staging' etc.
# DATABASE_URL e hosts já no .env.staging
npm run prisma:migrate:deploy
```

Confirmar host no guard antes de executar (mensagem de erro se host ≠ `STAGING_DATABASE_HOST`).

### 2.5 Seeds (staging apenas)

| Comando | Uso |
|---------|-----|
| `npm run prisma:seed` | Catálogo completo — **recusa** `APP_ENV=production` |
| `npx tsx prisma/seed-rewards-run.ts` | Somente Rewards — **recusa** `APP_ENV=production` |

Para testar 3 missões diárias: após migrate, rodar **seed Rewards** em staging.

### 2.6 Health check

```http
GET /health
```

| Resposta | Significado |
|----------|-------------|
| `200` + `database: connected` | API e Postgres staging OK |
| `503` + `database: disconnected` | Variáveis ou rede Neon |
| `404` / timeout | Serviço inexistente ou URL errada |

Render usa `healthCheckPath: /health` para marcar o deploy como saudável.

### 2.7 CORS (frontend staging)

Origens já liberadas em `cors.ts` (inclui `localhost:5173`, `runescodex-web.onrender.com`, `tritech.app.br`).

Para um host staging dedicado, adicionar no painel:

```text
CORS_ORIGINS=https://seu-preview.example,http://localhost:5173
```

(separado por vírgula). **Produção não precisa** apontar para API staging.

### 2.8 Isolamento staging ↔ produção

| Mecanismo | Onde |
|-----------|------|
| `APP_ENV=staging` no Render staging | Blueprint |
| `STAGING_DATABASE_HOST` deve igualar host da `DATABASE_URL` | `database-target.ts` |
| Staging **não pode** usar host = `PRODUCTION_DATABASE_HOST` | `database-target.ts` |
| Produção **não pode** usar host staging/local | `database-target.ts` |
| JWT distinto | `assertJwtSecret` |
| Seed completo bloqueado em `production` | `assertRuntimeEnvironment(..., { seed: true })` |
| Prisma CLI valida ambiente | `prisma.config.ts` |
| API valida na subida | `PrismaService` → `assertRuntimeEnvironment` |
| Ticket storage `local` só em `development` | `ticket-storage.ts` |

**Operacional:** nunca copiar `DATABASE_URL` / `JWT_SECRET` de produção para staging ou para `.env.staging`.

---

## Fase 3 — Proteções (existentes vs lacunas)

### Implementadas (código)

| Proteção | Status |
|----------|--------|
| Staging não usa DB de produção | **Existe** — `assertDatabaseEnvironment` |
| Produção não usa DB dev/staging | **Existe** |
| Development não usa remote prod/staging sem `DEV_DATABASE_HOST` | **Existe** |
| Seed em `APP_ENV=production` | **Bloqueado** |
| JWT placeholder / curto em staging | **Recusado** |
| Prisma migrate com URL errada | **Recusado** via `prisma.config.ts` |
| Storage local fora de development | **Recusado** |

### Lacunas / recomendações (documentar — **não alterar código nesta tarefa**)

| Lacuna | Risco | Recomendação |
|--------|-------|----------------|
| Render não força `APP_ENV`; operador pode errar no painel | Médio | Checklist pré-deploy: captura de tela `APP_ENV=staging` |
| `seed-rewards-run.ts` não bloqueia produção explicitamente se `assertRuntimeEnvironment` for chamado **sem** `{ seed: true }` | Baixo | Hoje chama `{ seed: true }` → **bloqueia prod** — manter |
| Migrations não rodam no deploy | Alto operacional | Runbook: migrate staging **antes** de cada release; nunca apontar CLI para prod por engano |
| Sem serviço web staging no blueprint | UX de teste | Preview local + `VITE_API_BASE_URL` staging |
| `render.staging` build sem `npm prune` | Imagem maior | Alinhar ao `render.yaml` em release futura (opcional) |
| Sem verificação automática “este Render service ≠ production APP_ENV” | Baixo | Nome do serviço + revisão humana |

Nenhum guard impede criar `.env` local com produção — **disciplina operacional** + não commitar `.env`.

---

## Fase 4 — `.env.staging.example` vs necessidades reais

### Presentes no example e adequadas

- `APP_ENV`, `NODE_ENV`, `DATABASE_URL`, `STAGING_DATABASE_HOST`, `PRODUCTION_DATABASE_HOST`
- `JWT_SECRET`, `JWT_EXPIRES_IN`, `GOOGLE_CLIENT_ID`, `PORT`, `CORS_ORIGINS`
- Tickets S3 + `TICKET_EVIDENCE_MAX_BYTES`
- Mercado Pago (6 URLs + token + webhook secret)
- RevenueCat server + webhook

### Documentadas em `ENVIRONMENTS.md` mas **ausentes** no `.env.staging.example` (opcionais)

- `ENABLE_MERCADO_PAGO_ADMIN_DIAGNOSTIC`
- Variáveis AdMob (`ADMOB_*`) — só mobile; irrelevante para smoke Rewards/Bosstiário web
- `DEV_DATABASE_HOST` — não usado em staging

### Lista para preencher manualmente em `apps/api/.env.staging` (sem valores)

Copie o example e preencha **apenas em arquivo local não versionado**:

| Variável | Obrigatória para API subir | Notas |
|----------|----------------------------|--------|
| `APP_ENV` | Sim | valor literal `staging` |
| `NODE_ENV` | Sim | `production` em runtime (igual blueprint) |
| `DATABASE_URL` | Sim | URL Neon **staging** |
| `STAGING_DATABASE_HOST` | Sim | hostname exato do pooler staging |
| `PRODUCTION_DATABASE_HOST` | Sim | hostname Neon **produção** (só para guard) |
| `JWT_SECRET` | Sim | ≥32 caracteres; único; não placeholder do example |
| `JWT_EXPIRES_IN` | Recomendado | ex. `7d` |
| `GOOGLE_CLIENT_ID` | Se testar login | mesmo ID do web de teste |
| `PORT` | Local | `3000`; Render injeta porta |
| `CORS_ORIGINS` | Se preview fora da lista padrão | URLs extras separadas por vírgula |
| `TICKET_STORAGE_*` | Para testar tickets | S3/R2 staging; driver `local` **falha** em staging |
| `MERCADO_PAGO_*` | Só para testar checkout | tokens `TEST-` |
| `REVENUECAT_*` | Só para webhook nativo | opcional para escopo Rewards/Bosstiário |

**Não** copiar valores de `apps/api/.env` de produção.

---

## Fase 5 — Checklists

### Segurança (pré-go-live staging)

- [ ] `APP_ENV=staging` no Render e no `.env.staging` local
- [ ] Host `DATABASE_URL` = `STAGING_DATABASE_HOST`
- [ ] Host `DATABASE_URL` ≠ `PRODUCTION_DATABASE_HOST`
- [ ] `JWT_SECRET` único (≥32 chars)
- [ ] Secrets não commitados
- [ ] Operador confirmou host Neon no console (não só string colada de prod)
- [ ] `promote:admin` / scripts destrutivos só com `CONFIRM_*` corretos

### Health check pós-provisionamento

- [ ] `GET https://<staging-api>/health` → 200, `database: connected`
- [ ] `GET https://<staging-api>/` → resposta Hello (sanity)
- [ ] Login JWT staging em conta de teste
- [ ] `GET /rewards/missions?period=DAILY` com Bearer → lista esperada (após seed Rewards)
- [ ] `POST /bosstiary/community/rotations` (premium) → evento Rewards (conta teste)

### Próximos passos (ordem sugerida)

1. **Neon:** criar projeto/branch staging; anotar hostname (interno).
2. **Render:** criar `runescodex-api-staging` via `render.staging.yaml`.
3. **Env:** configurar variáveis obrigatórias no painel.
4. **Local:** criar `apps/api/.env.staging` (gitignore) para CLI.
5. **Migrate:** `npm run prisma:migrate:deploy` contra staging.
6. **Seed Rewards:** `npx tsx prisma/seed-rewards-run.ts` (staging).
7. **Smoke:** health + missions + publicação Bosstiário (ver [`rewards-daily-mission-activation.md`](./rewards-daily-mission-activation.md) §8).
8. **Frontend:** Vite com `VITE_API_BASE_URL` apontando para API staging; validar 3 cards diários.
9. **Commit/deploy** da rotação diária quando ainda não estiver no branch implantado.

---

## Recursos existentes vs ausentes

| Recurso | Existe no repo | Provisionado |
|---------|----------------|--------------|
| Blueprint staging API | Sim | Não comprovado |
| Blueprint web staging | Não | Não |
| Guards ambiente | Sim | N/A |
| `.env.staging.example` | Sim | — |
| `.env.staging` real | Não | — |
| Neon staging | — | Não |
| Documentação prod | `render.yaml`, `ENVIRONMENTS.md` | Sim (prod) |

---

## Documentos relacionados

- [`ENVIRONMENTS.md`](../../apps/api/ENVIRONMENTS.md)
- [`rewards-daily-mission-activation.md`](./rewards-daily-mission-activation.md)
- [`daily-missions-rotation-audit.md`](../audits/daily-missions-rotation-audit.md)

---

## Confirmação de escopo (redação deste guia)

Nenhum código, env, migration, seed, deploy, Neon ou Render foi alterado. Nenhum banco de produção foi acessado.