# Auditoria técnica — Segurança, Performance e Resiliência (RuneCodex)

**Data:** 2025-11-14  
**Escopo:** Análise estática do repositório `runescodexgit` (somente leitura). Nenhuma alteração de código, infraestrutura ou dependências foi realizada nesta etapa.  
**Metodologia:** Inspeção de código-fonte, configuração declarada (`render.yaml`, Prisma, PWA), `npm audit` local (API), revisão de testes de concorrência/idempotência existentes.

> **Nota de stack:** O briefing cita Next.js; o frontend em produção é **Vite + React 19 + React Router 7** (`apps/web`), com PWA via `vite-plugin-pwa`. O app mobile usa Expo/React Native (`apps/mobile`).

---

## A. Resumo executivo

O RuneCodex possui **bases sólidas de segurança de negócio** no backend: autenticação JWT com sessão persistida e validação por `sid`, separação admin via `AdminGuard` consultando `User.role`, CORS com lista explícita de origens (sem `*`), `ValidationPipe` com whitelist, filtro global que oculta detalhes de erros 500, webhooks Mercado Pago com verificação HMAC, RevenueCat com re-sync autoritativo, concessão de pontos **somente pelo backend** (`recordEvent` não exposto em controller), idempotência de eventos de reward via `RewardEventReceipt`, e AdMob SSV com assinatura ECDSA + sessão + limites diários.

Porém, a postura **anti-DDoS/anti-abuso na borda está fraca para lançamento comercial**: a API é publicada e referenciada diretamente em `https://runescodex-api.onrender.com` (Render), **sem evidência no repositório** de que o tráfego da API passe por Cloudflare. O rate limiting é **opt-in por rota**, **em memória** e **não cobre** a maior parte dos GETs autenticados (catálogo, rewards, fórum, bosstiary). Há CVEs **HIGH** em dependências de runtime (`body-parser`/`express` via Nest). Faltam **helmet**, **compressão** e **limite explícito de payload** no bootstrap.

**Performance:** Paginação padrão bem limitada (`LIMIT_MAX = 50`), mas existem exceções (bosstiary até 500) e consultas auxiliares pesadas (filtro de vocação no bestiary sem `take`). O bundle web principal tem ~**767 KiB** em um único chunk JS, sem lazy loading de rotas.

**Veredicto pré-lançamento:** Funcionalidades críticas de fraude (pagamento, pontos server-side) estão bem desenhadas; **disponibilidade sob ataque volumétrico ou abuso de API autenticada** é o maior gap. Correções P0 devem focar borda (Cloudflare/origin lock), rate limit global/distribuído e mitigação DoS HTTP.

---

## B. Inventário das proteções atuais

| Proteção | Onde | Funcionamento (evidência) | Lacunas |
|----------|------|---------------------------|---------|
| JWT + sessão DB | `auth.service.ts`, `jwt.strategy.ts` | Token com `sub`, `email`, `sid`; `assertActiveSession` valida expiração e dispositivo | TTL padrão 7d (`JWT_EXPIRES_IN`); sem refresh token |
| Política `JWT_SECRET` | `database-target.ts` | ≥32 chars em staging/prod; placeholders rejeitados | Depende de configuração no Render |
| CORS allowlist | `common/cors.ts` | Origens fixas + `CORS_ORIGINS`; `credentials: true` | Não protege chamadas diretas à API (sem browser) |
| Validação de entrada | `main.ts` ValidationPipe | whitelist, forbidNonWhitelisted, transform | Não substitui limites de tamanho HTTP |
| Erros seguros | `safe-exception.filter.ts` | 500 genérico; stack só em log | — |
| Rate limit | `rate-limit.guard.ts`, `rate-limit.config.ts` | Por handler; login/register/webhooks/escritas | Sem default global; in-memory; leituras abertas |
| Premium | `premium.guard.ts` | Bloqueia catálogo sem licença; `@SkipPremium` em charm-guides reads | Conta + JWT ainda necessários para scrape |
| Admin API | `admin.guard.ts` | `role === 'ADMIN'` no banco | Sem rate limit nas rotas admin |
| Admin HTML | `admin-page.access.ts` | Cookie `httpOnly` `rc_admin`; `secure` em produção | JWT no cookie admin — superfície CSRF se mal configurado |
| Mercado Pago | `mercado-pago.signature.ts`, `billing-checkout.service.ts` | HMAC-SHA256 + `timingSafeEqual`; rejeita notificação inválida | Webhook 120 req/min por IP |
| RevenueCat | `revenuecat-billing.service.ts` | Header auth + reconsulta API | — |
| Rewards | `rewards.service.ts` | `recordEvent` interno; `RewardEventReceipt` unique | `convert`/`redeem` sem rate limit dedicado |
| AdMob SSV | `admob-ssv.verifier.ts`, `admob-rewarded.service.ts` | ECDSA, allowlist de ad unit, sessão, duplicata por `transactionId` | Endpoint público GET; 240/min IP |
| Paginação | `common/pagination.ts` | `LIMIT_MAX=50`, `PAGE_MAX=1000` | Bosstiary usa constante própria 500 |
| Ambiente DB | `database-target.ts` | Impede dev apontar para prod Neon | — |
| Health check | `app.service.ts` | `SELECT 1` no Postgres | Público, sem rate limit |
| PWA | `vite.config.ts` | Workbox precache; denylist API no SW | Imagens de criaturas fora do precache |
| Ticket IDOR | `tickets.service.ts` | `authorId` checado em read/reply/evidence | — |
| Prisma índices | `schema.prisma` | Índices extensos (ex. GIN em hunts) | Pool Neon não parametrizado no repo |

**Infraestrutura (somente declarativo no repo):** `render.yaml` — API Node 22, `healthCheckPath: /health`; web estático com `VITE_API_BASE_URL=https://runescodex-api.onrender.com`. **Cloudflare WAF, DNS proxy, Neon backups e alertas: NÃO VERIFICADOS** (sem acesso aos painéis).

---

## C. Matriz de vulnerabilidades (confirmadas)

Cada item segue o formato solicitado. IDs estáveis para o plano de correção.

### DDOS-001 — API acessível diretamente no Render (contorno de CDN)

| Campo | Valor |
|-------|--------|
| **Classificação** | CRÍTICO |
| **Descrição** | Cliente web embute fallback para origem Render; tráfego de API não depende de domínio proxied. |
| **Evidência** | `render.yaml` L65-66 `VITE_API_BASE_URL: https://runescodex-api.onrender.com`; `apps/web/src/services/api/client.ts` L4-12 mesmo default. |
| **Arquivos** | `render.yaml`, `apps/web/src/services/api/client.ts` |
| **Impacto** | Atacante atinge CPU/RAM/Postgres do serviço único sem filtro de borda. |
| **Exploração** | HTTP flood ou abuso autenticado direto ao host `*.onrender.com`. |
| **Correção** | Cloudflare proxy só na API **ou** mTLS/origin pull + firewall Render; ocultar URL Render do bundle; rotacionar host se vazado. |
| **Complexidade** | Média |
| **Prioridade** | P0 |

### DDOS-002 — Rate limiting em memória, sem cobertura global

| Campo | Valor |
|-------|--------|
| **Classificação** | CRÍTICO |
| **Descrição** | Limites só onde há `@RateLimit`; guard retorna `true` se ausente; buckets não compartilhados entre instâncias. |
| **Evidência** | `rate-limit.guard.ts` L28-34; `rate-limit.service.ts` L8-12 comentário Render instância única. |
| **Impacto** | Escalar horizontalmente zera limites; leituras premium podem ser marteladas. |
| **Exploração** | Contas válidas + script em loop em `GET /hunts`, `GET /bestiary`, etc. |
| **Correção** | Rate limit global (IP + user) via Redis/Upstash; default conservador em todos os controllers. |
| **Complexidade** | Média-alta |
| **Prioridade** | P0 |

### SEC-001 — CVE DoS em body-parser / express (runtime)

| Campo | Valor |
|-------|--------|
| **Classificação** | CRÍTICO |
| **Descrição** | `npm audit --omit=dev` reporta HIGH em `body-parser` (DoS via trailing bytes comprimidos) encadeado a `@nestjs/platform-express`. |
| **Evidência** | Execução local 2025-11-14; advisory GHSA-27r3-jxmh-p828. |
| **Impacto** | Esgotamento de CPU/event loop em requisições malformadas. |
| **Exploração** | POST com corpo comprimido craftado (sem stress test executado). |
| **Correção** | Atualizar Nest/express/body-parser; limitar `json`/`raw` size; desabilitar compressão upstream maliciosa. |
| **Complexidade** | Baixa-média |
| **Prioridade** | P0 |

### DDOS-003 — `/health` público dispara query ao Postgres

| Campo | Valor |
|-------|--------|
| **Classificação** | CRÍTICO |
| **Descrição** | Health check Render e rota pública executam `$queryRaw\`SELECT 1\``. |
| **Evidência** | `app.controller.ts` L13-16; `app.service.ts` L12-24; `render.yaml` L12. |
| **Impacto** | Pool Neon esgotado por health checks + abuso externo. |
| **Exploração** | Alto QPS em `/health`. |
| **Correção** | Liveness leve sem DB; readiness separado rate-limited; proteger edge. |
| **Complexidade** | Baixa |
| **Prioridade** | P0 |

### DDOS-004 — Superfície pública AdMob SSV (alto volume permitido)

| Campo | Valor |
|-------|--------|
| **Classificação** | CRÍTICO |
| **Descrição** | `GET /ads/admob/ssv` sem JWT; 240 req/min por IP; verificação criptográfica custa CPU. |
| **Evidência** | `admob-rewarded.controller.ts`; `RATE_LIMITS.admobSsv`; `admob-rewarded.service.ts` L97-186. |
| **Impacto** | CPU em validação de assinaturas falsas (até o limite IP). |
| **Exploração** | Query strings inválidas em massa. |
| **Correção** | WAF + rate limit mais agressivo; fail-fast antes de crypto; allowlist IP Google se aplicável. |
| **Complexidade** | Média |
| **Prioridade** | P0 |

### INFRA-001 — Single point: blueprint Render sem autoscaling observável

| Campo | Valor |
|-------|--------|
| **Classificação** | CRÍTICO (disponibilidade) |
| **Descrição** | `render.yaml` define um web service API sem política de réplicas/scale no repo. |
| **Evidência** | `render.yaml` L5-12. |
| **Impacto** | Saturação de uma instância = indisponibilidade total. |
| **Exploração** | Concorrência legítima + ataque. |
| **Correção** | Validar plano Render; mínimo 2 instâncias ou vertical upgrade; fila para trabalho pesado. |
| **Complexidade** | Baixa (operações) |
| **Prioridade** | P0 |

### SEC-002 — Ausência de Helmet / security headers HTTP na API

| Campo | Valor |
|-------|--------|
| **Classificação** | ALTO |
| **Descrição** | `main.ts` não configura helmet, HSTS, XContent-Type-Options, etc. |
| **Evidência** | `apps/api/src/main.ts` L21-35 (apenas CORS + ValidationPipe). |
| **Impacto** | APIs JSON menos expostas, mas admin HTML e downloads sofrem. |
| **Correção** | `@nestjs/helmet` + política explícita. |
| **Complexidade** | Baixa |
| **Prioridade** | P1 |

### SEC-003 — Sem limite explícito de tamanho de payload

| Campo | Valor |
|-------|--------|
| **Classificação** | ALTO |
| **Descrição** | Nest usa defaults do Express; uploads de ticket têm limite de negócio, JSON geral não. |
| **Evidência** | `main.ts`; tickets limitam evidência em `tickets.service.ts` / `ENVIRONMENTS.md`. |
| **Impacto** | Memória/DoS em JSON grande. |
| **Correção** | `app.use(json({ limit: '256kb' }))` ou equivalente Nest 11. |
| **Complexidade** | Baixa |
| **Prioridade** | P1 |

### SEC-004 — JWT de longa duração (7d), sem rotação dedicada

| Campo | Valor |
|-------|--------|
| **Classificação** | ALTO |
| **Descrição** | `JWT_EXPIRES_IN` default 7d; refresh token inexistente; logout invalida sessão. |
| **Evidência** | `render.yaml` L20-21; `auth.service.ts` `openSession`. |
| **Impacto** | Token roubado válido por dias. |
| **Correção** | Access curto + refresh rotativo; ou reduzir TTL + binding device mais rígido. |
| **Complexidade** | Média |
| **Prioridade** | P1 |

### DDOS-005 — Catálogo premium: GETs sem rate limit

| Campo | Valor |
|-------|--------|
| **Classificação** | ALTO |
| **Descrição** | `HuntsController`, `BestiaryController`, `RewardsController`, etc. — só `JwtAuthGuard` + `PremiumGuard`. |
| **Evidência** | `hunts.controller.ts` L8-16; `rewards.controller.ts` L20-27. |
| **Impacto** | Custo DB proporcional a requisições autenticadas. |
| **Exploração** | Conta premium comprometida ou trial + bot. |
| **Correção** | Rate limit `scope: user` em GETs; cache HTTP/CDN para dados estáticos do catálogo. |
| **Complexidade** | Média |
| **Prioridade** | P1 |

### PERF-001 — Bestiary: `relevantCreatureIds` sem paginação

| Campo | Valor |
|-------|--------|
| **Classificação** | ALTO (performance → DoS lógico) |
| **Descrição** | Filtro vocação/level faz `findMany` + `distinct creatureId` sem `take`. |
| **Evidência** | `bestiary.service.ts` L227-241. |
| **Impacto** | Latência alta e memória em filtros amplos. |
| **Correção** | Subquery limitada, materialized view, ou cache de IDs por vocação. |
| **Complexidade** | Média |
| **Prioridade** | P1 |

### PERF-002 — Bosstiary: até 500 itens por página

| Campo | Valor |
|-------|--------|
| **Classificação** | ALTO |
| **Descrição** | `BOSSTIARY_BOSS_LIST_LIMIT_MAX = 500` vs `LIMIT_MAX = 50` global. |
| **Evidência** | `bosstiary.constants.ts`; `bosstiary.service.ts`. |
| **Impacto** | Respostas grandes, serialização CPU. |
| **Correção** | Alinhar ao limite global 50 ou 100. |
| **Complexidade** | Baixa |
| **Prioridade** | P1 |

### DDOS-006 — Paginação profunda (`PAGE_MAX = 1000`)

| Campo | Valor |
|-------|--------|
| **Classificação** | ALTO |
| **Descrição** | `skip = (page-1)*limit` até página 1000 com limit 50 → scans profundos. |
| **Evidência** | `pagination.ts` L2-14. |
| **Impacto** | Postgres trabalha com OFFSET grande. |
| **Correção** | Cursor-based pagination; reduzir `PAGE_MAX`. |
| **Complexidade** | Média |
| **Prioridade** | P1 |

### SEC-005 — Rotas `/admin/*` sem rate limiting

| Campo | Valor |
|-------|--------|
| **Classificação** | ALTO |
| **Descrição** | `RewardsAdminController` e demais admin JSON — apenas JWT + AdminGuard. |
| **Evidência** | `admin/rewards-admin.controller.ts` L21-23. |
| **Impacto** | Brute force / enumeração se credencial admin vazar. |
| **Correção** | Rate limit por IP/user; MFA futuro. |
| **Complexidade** | Baixa |
| **Prioridade** | P1 |

### SEC-006 — Enumeração de e-mail no registro

| Campo | Valor |
|-------|--------|
| **Classificação** | ALTO (privacidade/abuse) |
| **Descrição** | `ConflictException('Email already in use')` distingue conta existente. |
| **Evidência** | `auth.service.ts` L74-80. |
| **Impacto** | Harvesting de e-mails; facilita credential stuffing. |
| **Correção** | Resposta genérica + timing constante. |
| **Complexidade** | Baixa |
| **Prioridade** | P1 |

### REW-001 — Rewarded Web / GAM em spike, não paridade prod

| Campo | Valor |
|-------|--------|
| **Classificação** | ALTO (produto/fraude futura) |
| **Descrição** | Docs em `docs/technical-spikes/` indicam PoC; fluxo maduro é AdMob mobile SSV. |
| **Evidência** | `gam-rewarded-web-ssv-spike.md`, `gam-rewarded-web-poc-plan.md`. |
| **Impacto** | Lançar web ads sem SSV = pontos forjáveis. |
| **Correção** | Não liberar pontos web até validação equivalente ao mobile. |
| **Complexidade** | Alta |
| **Prioridade** | P1 |

### PERF-003 — Bundle web monolítico (~767 KiB)

| Campo | Valor |
|-------|--------|
| **Classificação** | MÉDIO |
| **Descrição** | Um chunk principal; rotas importadas estaticamente em `AppRoutes.tsx`. |
| **Evidência** | `dist/assets/index-*.js` Length 767122 bytes; `vite.config.ts` sem `manualChunks`. |
| **Impacto** | LCP/TTI piores em 3G; mais JS parse no main thread. |
| **Correção** | `React.lazy` por rota; split vendor. |
| **Complexidade** | Média |
| **Prioridade** | P2 |

### PERF-004 — Hunts list: includes ricos por página

| Campo | Valor |
|-------|--------|
| **Classificação** | MÉDIO |
| **Descrição** | Cada página carrega vocações, criaturas, segunda query `creature.findMany`. |
| **Evidência** | `hunts.service.ts` L127-160. |
| **Impacto** | ~50 hunts × includes = custo fixo alto por request. |
| **Correção** | DTO de lista enxuto; detalhe sob demanda. |
| **Complexidade** | Média |
| **Prioridade** | P2 |

### PERF-005 — Sem compressão HTTP na API

| Campo | Valor |
|-------|--------|
| **Classificação** | MÉDIO |
| **Descrição** | Não há middleware `compression`. |
| **Evidência** | `main.ts`. |
| **Impacto** | Mais bandwidth Render↔cliente; CPU em JSON grandes. |
| **Correção** | compression + gzip/brotli na borda Cloudflare. |
| **Complexidade** | Baixa |
| **Prioridade** | P2 |

### SEC-007 — Token em `sessionStorage`

| Campo | Valor |
|-------|--------|
| **Classificação** | MÉDIO |
| **Descrição** | Bearer em `sessionStorage` — melhor que localStorage, mas vulnerável a XSS. |
| **Evidência** | `apps/web/src/services/session.ts`. |
| **Impacto** | Roubo de sessão se XSS surgir. |
| **Correção** | CSP rigorosa; httpOnly cookie BFF se possível. |
| **Complexidade** | Alta (arquitetura) |
| **Prioridade** | P2 |

### SEC-008 — Admin UI: cookie carrega JWT

| Campo | Valor |
|-------|--------|
| **Classificação** | MÉDIO |
| **Descrição** | `rc_admin` httpOnly strict; path `/admin`. |
| **Evidência** | `admin-page.access.ts` L47-54. |
| **Impacto** | CSRF em `POST admin/session` se política de origem falhar. |
| **Correção** | SameSite já strict; validar Origin; double-submit token. |
| **Complexidade** | Baixa-média |
| **Prioridade** | P2 |

### INFRA-002 — Pool de conexões Neon não documentado no código

| Campo | Valor |
|-------|--------|
| **Classificação** | MÉDIO |
| **Descrição** | `PrismaPg` adapter; sem `connection_limit` na URL no repo. |
| **Evidência** | `prisma.service.ts`; `schema.prisma` datasource. |
| **Impacto** | Esgotamento de conexões sob pico. |
| **Correção** | Parametrizar pool (Neon pooler + `?pgbouncer=true`); monitorar `max_connections`. |
| **Complexidade** | Baixa (ops) |
| **Prioridade** | P2 |

### INFRA-003 — Cloudflare (WAF, rate rules, bot fight)

| Campo | Valor |
|-------|--------|
| **Classificação** | MÉDIO (suspeita operacional) |
| **Descrição** | Nenhum arquivo de configuração Cloudflare; menção apenas a R2 em `ENVIRONMENTS.md`. |
| **Evidência** | Grep repositório. |
| **Impacto** | Proteção de borda desconhecida. |
| **Correção** | Auditar painel CF; TLS; WAF managed rules. |
| **Complexidade** | N/A (painel) |
| **Prioridade** | P1 validação |

### INFRA-004 — Backups, PITR, alertas

| Campo | Valor |
|-------|--------|
| **Classificação** | MÉDIO |
| **Descrição** | Não há evidência no repo de backup Neon ou alertas Render/Datadog. |
| **Evidência** | Ausência de runbooks além de `ENVIRONMENTS.md`. |
| **Impacto** | RPO/RTO indefinidos. |
| **Correção** | Habilitar PITR Neon; uptime checks externos. |
| **Complexidade** | Baixa (ops) |
| **Prioridade** | P2 |

### DDOS-007 — Webhook MP 120/min por IP

| Campo | Valor |
|-------|--------|
| **Classificação** | MÉDIO |
| **Descrição** | Rate limit existe mas é permissivo; cada hit pode disparar API MP. |
| **Evidência** | `billing.controller.ts`; `RATE_LIMITS.billingWebhook`. |
| **Correção** | Fail-fast na assinatura; reduzir limite; idempotência já no schema. |
| **Complexidade** | Baixa |
| **Prioridade** | P2 |

### SEC-009 — Cadeia multer / fast-uri (transitivas)

| Campo | Valor |
|-------|--------|
| **Classificação** | MÉDIO |
| **Descrição** | `npm audit` aponta `multer`, `fast-uri`, `deepmerge-ts` (Prisma tooling). |
| **Evidência** | `npm audit` 2025-11-14. |
| **Correção** | Atualizar lockfile; avaliar superfície multer (tickets). |
| **Complexidade** | Baixa |
| **Prioridade** | P2 |

### PERF-006 — Bestiary `listPrioritized` múltiplas queries

| Campo | Valor |
|-------|--------|
| **Classificação** | MÉDIO |
| **Descrição** | Até 4 queries count/list por página com vocação. |
| **Evidência** | `bestiary.service.ts` L257-276. |
| **Correção** | Unificar em SQL/CTE única. |
| **Complexidade** | Média |
| **Prioridade** | P3 |

### SEC-010 — Endpoints admin de recovery de migration

| Campo | Valor |
|-------|--------|
| **Classificação** | MÉDIO |
| **Descrição** | `admin/system/migration-recovery` — poderoso, protegido por AdminGuard. |
| **Evidência** | `admin-migration-recovery.controller.ts` (grep). |
| **Impacto** | Admin comprometido → DDL operacional. |
| **Correção** | Feature flag off em prod; audit log obrigatório. |
| **Complexidade** | Baixa |
| **Prioridade** | P2 |

### PERF-007 — React StrictMode em dev

| Campo | Valor |
|-------|--------|
| **Classificação** | BAIXO |
| **Descrição** | Double mount de effects em desenvolvimento. |
| **Evidência** | `apps/web/src/main.tsx`. |
| **Impacto** | Ruído em testes locais apenas. |
| **Prioridade** | P3 |

### PERF-008 — PWA não precache de imagens de criaturas

| Campo | Valor |
|-------|--------|
| **Classificação** | BAIXO |
| **Descrição** | `globPatterns` exclui PNG/GIF de criaturas. |
| **Evidência** | `vite.config.ts` workbox. |
| **Correção** | Runtime caching para `/images/creatures/*`. |
| **Prioridade** | P3 |

### SEC-011 — `GET /` público retorna "Hello World"

| Campo | Valor |
|-------|--------|
| **Classificação** | BAIXO |
| **Evidência** | `app.controller.ts` L8-10. |
| **Prioridade** | P3 |

### REW-002 — Fallback ad units de teste AdMob

| Campo | Valor |
|-------|--------|
| **Classificação** | BAIXO (ALTO se env prod omitir IDs) |
| **Descrição** | `prepareSession` usa test units se env vazio. |
| **Evidência** | `admob-rewarded.service.ts` L47-52. |
| **Correção** | Falhar startup em prod sem unit IDs reais. |
| **Prioridade** | P1 se confirmado em prod |

### DOC-001 — Documentação de stack desalinhada

| Campo | Valor |
|-------|--------|
| **Classificação** | BAIXO |
| **Descrição** | Briefing Next.js vs Vite no repo. |
| **Prioridade** | P3 |

### PERF-009 — Hunts: filtros client-side na página corrente

| Campo | Valor |
|-------|--------|
| **Classificação** | BAIXO |
| **Descrição** | UX confusa; pode mascarar necessidade de refetch servidor. |
| **Evidência** | `HuntsPage.tsx` (explore agent). |
| **Prioridade** | P3 |

### SEC-012 — Bcrypt 10 rounds no registro/login burst

| Campo | Valor |
|-------|--------|
| **Classificação** | BAIXO |
| **Descrição** | `BCRYPT_ROUNDS = 10` — intencional; sob ataque de registro consome CPU. |
| **Evidência** | `auth.service.ts` L22. |
| **Mitigação** | Rate limit register 5/min já existe. |
| **Prioridade** | P3 |

---

## D. Auditoria DDoS / DoS

### Proteções atuais (confirmadas)

| Camada | Status |
|--------|--------|
| **Cloudflare na API** | **NÃO VERIFICADO** — URL pública é Render |
| **Cloudflare no site** | **NÃO VERIFICADO** — static pode estar atrás de Vercel/tritech (comentário `render.yaml` L54-55) |
| **Rate limit edge** | **Ausente no código** |
| **Rate limit app** | Parcial, in-memory, opt-in |
| **Auth obrigatória catálogo** | Sim (JWT + Premium, exceto charm-guides reads com `@SkipPremium`) |
| **CORS** | Não impede curl direto |
| **WAF** | **NÃO VERIFICADO** |
| **Compressão** | Não na API |
| **Body limits** | Default Express |

### Cenário de ataque conceitual (não executado)

1. **Reconhecimento:** Atacante extrai `https://runescodex-api.onrender.com` do bundle web ou `render.yaml`.
2. **Bypass Cloudflare:** Como a API não depende de domínio proxied no cliente, **Cloudflare no site não protege a API** se o host Render for conhecido.
3. **Primeiro recurso a saturar:** Provavelmente **CPU/RAM da instância Render Starter** e em seguida **pool de conexões Neon** (`/health` com `SELECT 1`, ou rajadas em endpoints autenticados).
4. **Impacto ao usuário:** Timeouts 5xx, health check Render falhando, cold starts, fila de event loop (bcrypt em login/registro, JSON grande, validação SSV).
5. **O que impediria hoje:** Rate limits pontuais (login 10/min IP, register 5/min); necessidade de JWT+premium para catálogo; validação criptográfica em webhooks.
6. **O que não impede:** Volume direto na origem; scrape premium; paginação profunda; health abuse; SSV/crypto spam até 240/min/IP.
7. **Detecção:** Logs Render (5xx, latência); Neon métricas conexões; ausência de alertas no repo.
8. **Resposta:** Escalar plano Render (manual); sem auto-scale no blueprint; sem circuit breaker no código.

### Lacunas prioritárias de defesa

| P0 | Proxy/WAF na origem ou "Authenticated Origin Pulls"; ocultar host Render |
| P0 | Rate limit global Redis + proteção `/health` |
| P1 | Cache CDN para GETs idempotentes do catálogo |
| P1 | Connection pool tuning Neon + limites por serviço |
| P2 | Slowloris/timeouts no reverse proxy (Render/CF) |

### Contorno Cloudflare

**Sim — tecnicamente vulnerável a DDoS na origem por falta de proteção comprovada na API.** O cliente **não** usa domínio Cloudflare para API; usa **Render direto**. Mesmo que `tritech.app.br` esteja na Cloudflare, **isso não aplica ao tráfego API** configurado assim.

---

## E. Auditoria de performance

### Backend

| Gargalo | Severidade | Detalhe |
|---------|------------|---------|
| Hunts list payload | Médio-alto | Includes + segunda query creatures |
| Bestiary vocação | Alto | `distinct` sem limite |
| Bosstiary 500/page | Alto | Exceção ao padrão 50 |
| OFFSET profundo | Médio | `PAGE_MAX=1000` |
| PremiumGuard por request | Médio | Consulta billing; considerar cache curto |
| Sem compressão | Médio | JSON repetitivo |
| Síncrono | Baixo | Nest async; bcrypt é o principal CPU sync |

### Prisma / PostgreSQL

- **N+1:** Hunts mitigado com batch `creature.findMany` por página.
- **Índices:** Schema maduro (GIN em location, únicos em receipts).
- **Pool:** Não configurado no repositório — validar `DATABASE_URL` com pooler Neon.
- **Latência:** Render ↔ Neon `sa-east-1` — aceitável se co-localizados; **NÃO MEDIDO**.
- **Transações:** Rewards usa `$transaction` e `createMany skipDuplicates` — bom para concorrência (ver `concurrency.spec.ts`).

### Frontend / PWA

| Item | Situação |
|------|----------|
| Bundle JS | ~767 KiB single chunk |
| Code splitting | Ausente |
| Imagens | Muitas em `public/images`; não precached |
| API | Sem cache SW; always network |
| INP/LCP/CLS | **NÃO MEDIDO** (requer RUM/Lighthouse em staging) |
| Duplicatas | Charm guide actions refetch full detail |

---

## F. Auditoria Rewards e monetização

### Pontos concedidos apenas no backend — CONFIRMADO

- `RewardsService.recordEvent` **não** aparece em controllers; chamado por forum, community rotations, AdMob SSV, etc.
- Progresso de missão incrementado em transação; wallet via `applyWalletDelta`.
- Idempotência: `RewardEventReceipt` com `@@unique([userId, eventType, referenceId, missionId, periodStart])`.

### Manipulação pelo cliente — riscos

| Vetor | Status |
|-------|--------|
| POST falso `recordEvent` | **Bloqueado** (sem rota) |
| Inflar pontos via body em API pública | **Não aplicável** |
| Replay AdMob | Mitigado por `transactionId` PK + sessão consumida |
| Fake SSV sem chave Google | Rejeitado em `verifyAdMobSsvSignature` |
| SSV sem sessão prepare | `Unknown reward session` |
| Duplicata MP | Schema `BillingProviderEvent` idempotency (grep schema) |
| `convert` / `redeem` abuse | Sem rate limit; debita wallet server-side (validar saldo no service) |
| GAM Web rewarded | **Não pronto** — spike apenas |

### Mercado Pago — CONFIRMADO

- Assinatura HMAC com `MERCADO_PAGO_WEBHOOK_SECRET`.
- Rejeição `UnauthorizedException` se inválido.
- Checkout consulta pagamento no provedor (não confia só no body).

### Caminhos para pontos sem cumprir requisito (teóricos)

1. **Comprometer JWT** de usuário premium e disparar ações que chamam `recordEvent` (fórum, etc.) — ainda exige ação legítima do domínio.
2. **Bypass AdMob** — requer assinatura válida Google + sessão + limites; difícil, mas endpoint público é superfície.
3. **Web GAM sem SSV** — se lançado antes do spike concluir → **fraude alta**.
4. **Admin rewards** — aprovar resgate indevido se conta admin comprometida.

---

## G. Plano de correção

### P0 — Críticas (pré-lançamento bloqueante)

| ID | Ação |
|----|------|
| DDOS-001 | Proteger origem Render; API só via domínio proxied; remover URL Render do bundle |
| DDOS-002 | Rate limiting distribuído + default global |
| SEC-001 | Corrigir CVE body-parser / atualizar deps |
| DDOS-003 | Separar liveness/readiness; rate limit health |
| DDOS-004 | Endurecer SSV (WAF + limites + fail-fast) |
| INFRA-001 | Validar capacidade Render + Neon sob pico esperado |

### P1 — Necessárias antes do go-live comercial

SEC-002, SEC-003, SEC-004, DDOS-005, PERF-001, PERF-002, DDOS-006, SEC-005, SEC-006, REW-001, REW-002 (validar prod), INFRA-003 (auditar Cloudflare)

### P2 — Importantes

PERF-003 a PERF-005, SEC-007, SEC-008, INFRA-002, INFRA-004, DDOS-007, SEC-009, SEC-010

### P3 — Futuro / otimização

PERF-006 a PERF-009, SEC-011, SEC-012, DOC-001

---

## H. Recomendações de infraestrutura

| Componente | Config no repo | Avaliação lançamento inicial |
|------------|----------------|------------------------------|
| **Render API** | Web service único, Node 22 | **Starter pode ser insuficiente** sob marketing + scrape; considerar Standard ou 2 instâncias |
| **Render Web** | Static site | Adequado para Vite; CDN do Render + eventual Cloudflare no domínio |
| **Neon Launch** | Pooler referenciado em spike docs | **Validar** limites de conexão vs uma instância API; habilitar PITR |
| **Cloudflare** | Não verificado | **Recomendado** no mínimo: proxy API, WAF managed, rate rules em `/auth/*`, `/health`, `/ads/*` |
| **Secrets** | `render.yaml` sync:false | Boa prática; rotacionar após auditoria |

**Conclusão:** Render Starter + Neon Launch **podem** suportar um soft launch com poucos usuários, **desde que** P0 de borda e rate limit sejam implementados. Para campanha comercial ou parceria (TriTech), **upgrade de plano e observabilidade são prudentes**.

---

## I. Plano de testes (pós-correção)

1. **Staging espelhado** com `render.staging.yaml` e credenciais MP teste (`ENVIRONMENTS.md`).
2. **Carga controlada** (k6/Vegeta) em staging: `GET /hunts`, `GET /health`, login, SSV inválido — metas: p95 < 500ms até N RPS.
3. **Concorrência rewards** — reexecutar `concurrency.spec.ts` e testes PG integration.
4. **DAST** — OWASP ZAP contra staging (auth flows, IDOR tickets, admin).
5. **Dependências** — `npm audit` CI gate HIGH+.
6. **Pen test webhooks** — assinatura MP/RevenueCat adulterada deve 401.
7. **Chaos** — Neon failover drill; Render restart durante transação checkout.

**Não executar** stress/DDoS contra produção (conforme escopo).

---

## J. Indicadores de sucesso (SLO propostos)

| Indicador | Meta inicial |
|-----------|--------------|
| Disponibilidade API | ≥ 99.5% mensal (excl. janela manutenção) |
| p95 latência `GET /hunts` (autenticado) | < 400 ms em staging; < 600 ms prod |
| Taxa 5xx | < 0.5% requisições |
| Conexões Neon ativas | < 70% do limite do plano sustentado 5 min |
| Rate limit 429 (abuso) | Detectável; alerta se > 1% tráfego por 5 min |
| Tempo recuperação pós-pico | < 5 min sem intervenção manual |
| Bundle web (gzip) | Reduzir 30% após code splitting |
| Fraude rewards | Zero concessões sem receipt/SSV/transação MP em audit sample |

---

## Suspeitas (validação externa obrigatória)

| ID | Item | Onde validar |
|----|------|--------------|
| SUS-001 | DNS Cloudflare proxy em `tritech.app.br` | Painel Cloudflare |
| SUS-002 | WAF / Bot Fight / Rate Rules | Cloudflare |
| SUS-003 | Restrição de IP origem no Render | Render Dashboard |
| SUS-004 | Neon PITR e backups | Neon Console |
| SUS-005 | Alertas uptime (Better Stack, etc.) | Ops |
| SUS-006 | Plano efetivo Render (CPU/RAM) | Render Billing |
| SUS-007 | `ADMOB_*` unit IDs em produção | Render env vars |
| SUS-008 | CORS_ORIGINS produção completa | Render env vars |

---

## Contagem de problemas (confirmados)

| Classificação | Quantidade |
|---------------|------------|
| **CRÍTICO** | 6 |
| **ALTO** | 10 |
| **MÉDIO** | 12 |
| **BAIXO** | 8 |
| **Total confirmado** | **36** |
| **Suspeitas** | 8 (validação em painel) |

---

## Cinco riscos mais importantes

1. **API exposta diretamente no Render** — bypass de qualquer proteção Cloudflare do site.
2. **Rate limiting fragmentado e em memória** — não protege leituras premium de abuso.
3. **CVE DoS em body-parser/express** — risco de indisponibilidade por payload malicioso.
4. **Consultas pesadas (bestiary vocação, hunts includes, bosstiary 500)** — amplificam custo por requisição em ataque lógico.
5. **Rewarded Web / GAM sem SSV maduro** — risco de fraude se monetização web for ativada antes do backend equivalente ao AdMob.

---

## Referências de código (amostra)

```21:35:apps/api/src/main.ts
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();
  app.enableCors(corsOptions());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  // ...
  await app.listen(port, '0.0.0.0');
}
```

```8:21:apps/api/src/common/rate-limit.service.ts
/**
 * In-memory counters. Render currently runs a single web service, so one
 * process sees every request. A future second instance would not share these
 * counters.
 */
```

```227:241:apps/api/src/bestiary/bestiary.service.ts
  private async relevantCreatureIds(query: ListBestiaryQueryDto) {
    const vocationWhere = this.huntVocationWhere(query);
    if (!vocationWhere) return [];
    const rows = await this.prisma.huntCreature.findMany({
      where: {
        hunt: {
          isActive: true,
          vocations: { some: vocationWhere },
        },
        creature: { isActive: true },
      },
      select: { creatureId: true },
      distinct: ['creatureId'],
    });
    return rows.map((row) => row.creatureId);
  }
```

---

*Fim do relatório — etapa 1 (somente diagnóstico). Implementações de correção devem seguir o plano P0→P3 em PRs dedicados.*