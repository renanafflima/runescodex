# Auditoria — rotação diária de missões e evento Bosstiário

**Última atualização:** 2026-11-16  
**Escopo desta rodada:** somente leitura — nenhum código, seed, migration, banco ou deploy alterado.

Documento histórico da correção inicial: seções 1–2 abaixo (2026-11-15).

---

## Resumo executivo (auditoria 2026-11-16)

| Tema | Veredito |
|------|----------|
| Rotação diária (determinismo, UTC, exclusões) | **APROVADO** (com ressalvas de cobertura de teste) |
| Limite de 3 / contingência &lt; 3 elegíveis | **APROVADO** |
| Exclusão `WATCH_AD` da vitrine diária | **APROVADO** (progresso de anúncio continua fora da lista) |
| Emissão `BOSSTIARY_COMMUNITY_ROTATION_PUBLISHED` | **APROVADO** (fluxo `create` + transação) |
| Missão diária “Compartilhe uma rotação” em **produção** | **NÃO COMPROVADO** (só no seed; prod ainda com 2 elegíveis) |
| Terceira missão diária no lançamento Web | **PARCIAL** — liberar só após seed/migration de catálogo + deploy da API |

**Bloqueio para a 3ª missão diária em produção:** a rotação e o evento estão corretos no código, mas o banco de produção ainda não tem a missão diária Bosstiário cadastrada; com apenas dois `eventType` elegíveis a API devolve **2** cards (comportamento esperado, não bug).

---

## 1. Arquivos e métodos analisados

| Área | Arquivos |
|------|----------|
| Rotação | `apps/api/src/rewards/rewards.daily-rotation.ts`, `rewards.daily-rotation.spec.ts`, `rewards.periods.ts` |
| API missões / eventos | `apps/api/src/rewards/rewards.service.ts` (`listMissions`, `getMe`, `recordEvent` / `recordEventWithin`, `filterDailyRotatedMissions`, `loadDailyRotationIds`, `summarizeMissions`) |
| Constantes de evento | `apps/api/src/rewards/rewards.constants.ts` (`REWARD_EVENTS`, `isSupportedRewardEvent`) |
| Publicação Bosstiário | `community-rotations.controller.ts` (`POST /bosstiary/community/rotations`), `community-rotations.service.ts` (`create`, `persistRotation`, `recordPublishReward`) |
| Constante do evento | `community-rotation.constants.ts` (`COMMUNITY_ROTATION_PUBLISHED_EVENT`) |
| Seed | `apps/api/prisma/seed/rewards.ts` (`seedRewards`) |
| Testes | `rewards.daily-rotation.spec.ts`, `rewards.service.spec.ts`, `community-rotations.service.spec.ts`, `community-rotations.pg.spec.ts` |
| Web/PWA | `apps/web/src/pages/RewardsPage.tsx`, `apps/web/src/domain/rewards.ts` (`isPlayableRewardMission`) |

---

## 2. Fluxo real da rotação diária

### 2.1 Elegibilidade

`isEligibleForDailyRotation` (`rewards.daily-rotation.ts`):

- `active === true` e `period === DAILY`
- `eventType` não vazio, `!== WATCH_AD`
- `isSupportedRewardEvent(eventType)` → apenas valores em `REWARD_EVENTS` exceto anúncio na rotação: `FORUM_TOPIC_CREATED`, `FORUM_COMMENT_CREATED`, `BOSSTIARY_COMMUNITY_ROTATION_PUBLISHED` (+ `WATCH_AD` existe no enum mas é excluído da rotação)

Missões inativas ou eventos não suportados (ex. `HUNT_CREATED`, `FORUM_COMMENT`): **excluídas**.

### 2.2 Seleção determinística (global)

1. Chave UTC: `dailyRotationDayKey(periodStart)` = `periodStart.toISOString().slice(0, 10)`, alinhada a `currentPeriodWindow('DAILY')` (meia-noite UTC).
2. Score por missão: `SHA256(utcDay + NUL + missionId)`; ordenação lexicográfica; desempate por `id`.
3. Top `min(3, elegíveis)` IDs → **mesma lista para todos os usuários** no mesmo dia UTC.
4. Sem `Math.random()`; recomputação com os mesmos inputs produz o mesmo conjunto.

**Classificação:** determinismo, dia UTC, lista global, estabilidade intradia — **APROVADO**.

### 2.3 Virada do dia

`periodStart` muda à meia-noite UTC; nova chave `YYYY-MM-DD` → ranking pode mudar. Teste `rewards.daily-rotation.spec.ts` comprova seleção distinta entre 2026-11-15 e 2026-11-16 — **APROVADO**.

### 2.4 API e progresso

| Operação | Comportamento |
|----------|----------------|
| `GET /rewards/missions?period=DAILY` | Filtra com `filterDailyRotatedMissions` — só missões selecionadas |
| `GET /rewards/me` | Contagem diária usa o mesmo conjunto (`dailyRotationIds`) |
| `recordEvent` (≠ `WATCH_AD`) | Missões `DAILY` fora da rotação do dia são **ignoradas** (`continue`); semanal/mensal não aplicam o filtro |
| `recordEvent` (`WATCH_AD`) | **Sem** filtro de rotação (`dailyRotationIds = null`) |

**Classificação:** limite 3 — **APROVADO**; &lt; 3 elegíveis retorna menos (`slice`) — **APROVADO**; progresso fora da rotação ignorado para diárias — **APROVADO**.

### 2.5 WATCH_AD

- Não entra em `isEligibleForDailyRotation`.
- Não aparece em `listMissions` DAILY rotacionado.
- Web/mobile: `isPlayableRewardMission` rejeita `WATCH_AD`.
- Missões e histórico no banco **não** são apagados; mobile SSV pode continuar atualizando missões de anúncio.

**Classificação:** exclusão da experiência de lançamento Web — **APROVADO**.

### 2.6 Riscos / divergências

| Risco | Gravidade | Classificação |
|-------|-----------|----------------|
| Novas missões elegíveis inseridas mudam o ranking do mesmo dia (catálogo mudou) | Média (operacional) | **PARCIAL** — esperado, documentar em deploys |
| Dupla contagem: uma publicação incrementa missão **diária** (se em rotação) e **semanal** `BOSSTIARY_*` (receipts por `missionId`) | Baixa (produto) | **APROVADO** se intencional |
| Teste explícito “dois usuários, mesma lista” | — | **NÃO COMPROVADO** (só desenho global) |
| Teste `recordEvent` ignora diária fora da rotação | — | **NÃO COMPROVADO** (gap de teste) |
| Frontend remove missões fora de `SERVER_RECORDED_EVENTS` | Baixa | **PARCIAL** — alinhado ao backend hoje; duplicar allowlist exige manutenção |

---

## 3. Fluxo real de publicação Bosstiário

```text
POST /bosstiary/community/rotations  (JwtAuthGuard, PremiumGuard, RateLimit)
  → CommunityRotationsService.create
  → idempotency opcional (CommunityRotationPublishIdempotency)
  → persistRotation → prisma.$transaction:
        1) create CommunityRotation (status PUBLISHED)
        2) recordPublishReward(tx, userId, rotation.id)
        3) gravar idempotency (se houver)
```

`recordPublishReward` chama `RewardsService.recordEvent(userId, COMMUNITY_ROTATION_PUBLISHED_EVENT, { referenceType: 'CommunityRotation', referenceId: rotationId }, new Date(), tx)`.

| Critério | Evidência | Classificação |
|----------|-----------|----------------|
| Declarado em `REWARD_EVENTS` / constante Bosstiário | `rewards.constants.ts`, `community-rotation.constants.ts` | **APROVADO** |
| Emitido no fluxo real | Após `communityRotation.create`, antes do fim da transação | **APROVADO** |
| Só após publicação efetivada | `create` com `status: PUBLISHED` na mesma transação | **APROVADO** |
| Falha / rollback | `recordEvent` no mesmo `tx`; erro não tratado reverte rotação (`community-rotations.pg.spec.ts` “rolls back the rotation when rewards fail”) | **APROVADO** |
| Erro “evento inválido” | `isUnsupportedRewardEvent` → engole `BadRequestException`; publicação **commita** sem progresso (`community-rotations.service.spec.ts`) | **APROVADO** (falha aberta no rewards, não na rotação) |
| Uma vez por publicação nova | `referenceId` = `rotation.id` (UUID novo a cada create) | **APROVADO** |
| Replay Idempotency-Key | Retorno da rotação existente **sem** novo `recordPublishReward` | **APROVADO** |
| Idempotência Rewards | `claimEventReceipt` + `createMany` `skipDuplicates`; unique `(userId, eventType, referenceId, missionId, periodStart)` | **APROVADO** |
| Usuário correto | `userId` do JWT passado a `create` / `recordEvent` | **APROVADO** |
| `update` / rascunho | `update` não chama `recordPublishReward` (só `create`) | **APROVADO** |

**Interação com rotação diária:** progresso na missão diária Bosstiário só ocorre se essa missão estiver nos `dailyRotationIds` do dia; a missão semanal “Publique uma Rotação” continua a receber o evento independentemente da rotação — **APROVADO** tecnicamente; impacto de UX — **PARCIAL** (públicar fora do destaque diário ainda avança meta semanal).

---

## 4. Missão “Compartilhe uma rotação” (seed)

| Item | Valor no seed | Classificação |
|------|----------------|-----------------|
| Título / descrição | “Compartilhe uma rotação” — DAILY | **APROVADO** |
| `eventType` | `BOSSTIARY_COMMUNITY_ROTATION_PUBLISHED` | **APROVADO** |
| Meta / pontos | 1 / 35 (coerente com fórum 20–40) | **APROVADO** |
| Idempotência seed | `findFirst` por `title` + `period` + `category`; `update` ou `create` | **APROVADO** |
| Ativa no seed | `active: true` | **APROVADO** (apenas após executar seed) |
| Presente em produção (auditoria anterior) | Não | **NÃO COMPROVADO** até seed/deploy de catálogo |

A missão **só é elegível à rotação** quando existir no banco, `active`, evento suportado — condição atendida após seed. **Não** aparece “fantasma”: sem linha no DB não entra no pool.

---

## 5. Testes existentes e lacunas

| Cenário | Onde | Resultado / nota |
|---------|------|------------------|
| Excluir WATCH_AD / inativos / não diários | `rewards.daily-rotation.spec.ts` | Coberto |
| 3 missões / &lt; 3 | `rewards.daily-rotation.spec.ts`, `rewards.service.spec.ts` | Coberto |
| Estabilidade / mudança entre dias UTC | `rewards.daily-rotation.spec.ts` | Coberto |
| Listagem API 3 diárias | `rewards.service.spec.ts` | Coberto |
| Publicação emite evento | `community-rotations.service.spec.ts` | Coberto |
| Publicação com rewards inválido ainda ok | `community-rotations.service.spec.ts` | Coberto |
| Rollback se rewards falha | `community-rotations.pg.spec.ts` | Coberto (PG opcional) |
| Idempotency-Key publish | `community-rotations.pg.spec.ts` | Coberto (PG) |
| Mesma rotação, dois usuários (lista idêntica) | — | **Não implementado** (documentar) |
| `recordEvent` + diária fora da rotação | — | **Não implementado** |
| Falha de `create` antes do commit (sem rotação órfã) | Implícito na transação | **PARCIAL** |
| Publicação repetida mesma rotação (mesmo `referenceId`) | Receipt skipDuplicates | **PARCIAL** em unit; não há teste e2e duplicar UUID |
| Bosstiary + rotação do dia (e2e) | — | **Não implementado** |

**Última execução documentada (implementação):** `jest --testPathPatterns=rewards` (59 passed); `vitest run rewards` no Web (5 passed). **Não reexecutado** nesta auditoria somente leitura.

---

## 6. Compatibilidade Web/PWA

- `RewardsPage` chama `listRewardMissions(period)` e aplica `isPlayableRewardMission`.
- Allowlist inclui `BOSSTIARY_COMMUNITY_ROTATION_PUBLISHED` — missão rotacionada Bosstiário **não** é removida.
- `WATCH_AD` e eventos legados não suportados continuam filtrados no cliente (defesa em profundidade).
- Refresh: `useEffect` recarrega ao mudar período; timer de 30s atualiza countdown, **não** re-busca missões (nova lista após virada UTC exige navegação/refresh — **PARCIAL** para UX).

**Classificação:** consumo da API sem esconder Bosstiário válido — **APROVADO**.

---

## 7. Matriz de classificação (itens solicitados)

| # | Item | Status |
|---|------|--------|
| 1 | Seleção de elegíveis | **APROVADO** |
| 2 | Determinismo + UTC | **APROVADO** |
| 3 | Rotação global igual para todos | **APROVADO** |
| 4 | Estável no mesmo dia UTC | **APROVADO** |
| 5 | Muda na virada UTC | **APROVADO** |
| 6 | Inativas excluídas | **APROVADO** |
| 7 | WATCH_AD fora do lançamento Web | **APROVADO** |
| 8 | Limite 3 e contingência &lt; 3 | **APROVADO** |
| 9 | Progresso diário fora da rotação ignorado | **APROVADO** (código); teste dedicado **NÃO COMPROVADO** |
| 10 | Eventos da rotação ⊆ eventos emitidos | **APROVADO** |
| 11 | Evento Bosstiário declarado | **APROVADO** |
| 12 | Evento emitido na publicação | **APROVADO** |
| 13 | Após sucesso / rollback seguro | **APROVADO** |
| 14 | Uma vez por publicação / idempotência | **APROVADO** |
| 15 | Missão seed Bosstiário diária | **APROVADO** (repo); produção **NÃO COMPROVADO** |
| 16 | Terceira missão pronta para lançamento | **PARCIAL** |

---

## 8. Riscos para produção

1. **Catálogo:** sem missão diária Bosstiário no Neon, jogadores continuam com **2** missões — não é regressão da rotação.
2. **Deploy:** API com rotação sem deploy deixa comportamento antigo no ar.
3. **Allowlist Web duplicada:** novo `REWARD_EVENT` exige atualizar API + `apps/web/src/domain/rewards.ts`.
4. **Virada UTC vs expectativa Brasil:** reset à meia-noite UTC (já era o modelo de missões) — comunicar no produto se necessário.
5. **Catálogo crescente:** adicionar missão elegível no meio do dia UTC altera o ranking do restante do dia — raro, só em deploy de seed.

---

## 9. Recomendação — liberar missão Bosstiário diária?

| Passo | Ação |
|-------|------|
| 1 | **APROVADO** tecnicamente: evento e rotação confiáveis para habilitar a missão. |
| 2 | Executar seed (ou insert idempotente) em staging/produção para criar “Compartilhe uma rotação” DAILY. |
| 3 | Deploy da API que já contém rotação + exclusão WATCH_AD da vitrine. |
| 4 | Validar em staging: 3 cards na Rewards; publicar rotação com missão Bosstiário em destaque no dia → progresso 1/1. |
| 5 | Opcional: testes e2e sugeridos na seção 5 antes de marcar lançamento **APROVADO** em prod. |

**Veredito:** **pode liberar a missão** após catálogo no banco + deploy; **não** liberar só o seed sem confirmar que produção tem ≥3 elegíveis ou aceitar 2 cards até lá.

---

## 10. Confirmações desta auditoria

- Nenhum código, migration, seed, banco, env ou deploy foi alterado nesta rodada.
- Nenhum dado de produção foi modificado.

---

## Histórico — causa raiz das “duas missões” (2026-11-15)

| Camada | Comportamento (antes da correção) |
|--------|-----------------------------------|
| API | Devolvia todas as diárias ativas |
| Web | `isPlayableRewardMission` só aceitava 2 eventos de fórum |
| Efeito | 2 cards visíveis |

Correção implementada (fora desta auditoria): rotação no backend + filtro Web alinhado a `REWARD_EVENTS` (sem WATCH_AD na vitrine).