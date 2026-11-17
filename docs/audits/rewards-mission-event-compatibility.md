# Auditoria — compatibilidade missões Rewards × eventos

**Data:** 2026-11-16  
**Escopo:** somente leitura (código + auditoria de produção anterior). Sem alterações de código, banco, seed ou deploy.  
**Fontes:** `apps/api/prisma/seed/rewards.ts`, `rewards.constants.ts`, emissores em `forum`, `bosstiary`, `ads`, `referrals`; inventário produção [`rewards-database-audit.md`](./rewards-database-audit.md) (2026-11-16, **32** missões no Neon prod).

> **Nota de contagem:** o seed versionado define **14** missões. Produção tinha **32** (legado + seed antigo). Após seed da missão diária Bosstiário o total pode chegar a **33**. Esta auditoria cobre **todos os `eventType` listados** e as missões do seed + as ativas/inativas documentadas em produção.

**Banco / E2E staging:** **NÃO EXECUTADO** nesta rodada.

---

## 1. Motor Rewards (revisão)

| Peça | Comportamento | Avaliação |
|------|---------------|-----------|
| `recordEvent` | Recusa `!isSupportedRewardEvent` → `BadRequestException` | Só `REWARD_EVENTS` avançam progresso |
| `FUTURE_REWARD_EVENTS` | Declarados; **não** entram em `SUPPORTED_EVENTS` | Missões com esses eventos **nunca** recebem `recordEvent` bem-sucedido |
| `RewardEventReceipt` | Unique `(userId, eventType, referenceId, missionId, periodStart)` + `createMany skipDuplicates` | Idempotência por referência |
| Progresso | `updateMany` com `completed: false` e `progress < target` | Limita avanço concorrente |
| Conclusão | Um crédito `MISSION_REWARD` + ledger na mesma TX | Carteira ↔ ledger coerentes (auditoria prod) |
| Rotação DAILY | Missões diárias fora da seleção do dia **não** incrementam (exceto `WATCH_AD`) | Ver `rewards.daily-rotation.ts` |
| Concorrência | Testes em `concurrency.spec.ts` | Cobertura parcial; fórum/tópico OK |

**Risco residual:** spam de tópicos/comentários reais ainda gera progresso legítimo (custo de abuso = conteúdo no fórum). `WATCH_AD` exige SSV AdMob (mobile).

---

## 2. Inventário de eventos (emissão real)

| Evento | Declarado em | Emissor real → `recordEvent` | `referenceId` | Web/PWA | Classificação do evento |
|--------|--------------|------------------------------|---------------|---------|-------------------------|
| `FORUM_TOPIC_CREATED` | `REWARD_EVENTS` | `forum.service.ts` `create` | `ForumThread.id` | Sim (fórum) | **Implementado** |
| `FORUM_COMMENT_CREATED` | `REWARD_EVENTS` | `forum.service.ts` `createReply` | `ForumReply.id` | Sim | **Implementado** |
| `BOSSTIARY_COMMUNITY_ROTATION_PUBLISHED` | `REWARD_EVENTS` + constante Bosstiário | `community-rotations.service.ts` `recordPublishReward` após `create` | `CommunityRotation.id` | Sim (premium) | **Implementado** |
| `WATCH_AD` | `REWARD_EVENTS` | `admob-rewarded.service.ts` pós-SSV | `transaction_id` AdMob | **Não** (mobile/SSV; fora da vitrine Web) | **Implementado (mobile)** |
| `FORUM_COMMENT` | Só missões legadas | **Nenhum** | — | — | **Inexistente** |
| `HUNT_CREATED` | Missões legadas | **Nenhum** | — | — | **Inexistente** |
| `HUNT_RATED` / `HUNT_VIEWED` / `HUNT_COMPLETED` | Legado / seed paralelo | **Nenhum** | — | — | **Inexistente** |
| `HUNT_ACTION` | `FUTURE_REWARD_EVENTS` + seed | **Nenhum** | — | — | **Reservado, não emitido** |
| `BESTIARY_VIEWED` / `CREATURE_VIEWED` | Legado | **Nenhum** (`ContentViewEvent` existe para analytics, **não** chama Rewards) | — | — | **Inexistente** |
| `BESTIARY_ACTION` | `FUTURE_REWARD_EVENTS` | **Nenhum** | — | — | **Reservado, não emitido** |
| `EXPLORATION_COMPLETED` | `FUTURE_REWARD_EVENTS` | **Nenhum** | — | — | **Reservado, não emitido** |
| `AREA_EXPLORED` | Legado | **Nenhum** | — | — | **Inexistente** |
| `USEFUL_REPLY` | Missão ativa prod | **Nenhum** | — | — | **Inexistente** |
| `PROMOTION_COMPLETED` | `FUTURE_REWARD_EVENTS` | **Nenhum** | — | — | **Reservado, não emitido** |
| `APP_SHARED` | Legado | **Nenhum** | — | — | **Inexistente** |
| `COMMUNITY_CONTRIBUTION` | Legado | **Nenhum** | — | — | **Inexistente** |
| `CODEX_VIEWED` | Legado | **Nenhum** | — | — | **Inexistente** |
| `KNOWLEDGE_ANSWERED` | `FUTURE_REWARD_EVENTS` | **Nenhum** | — | — | **Reservado, não emitido** |
| `USER_RECRUITED` | Missão ativa prod | **Nenhum** | — | — | **Inexistente** |
| `REFERRAL_CONFIRMED` | `FUTURE_REWARD_EVENTS` | Referral tem domínio próprio (`ReferralReward`); **não** chama `recordEvent` | — | Parcial (referral UI) | **Não ligado ao motor missões** |
| `MUSIC_PLAYED` / `MUSIC_COMPLETED` | Legado / FUTURE | **Nenhum** | — | — | **Inexistente / reservado** |

### Detalhe dos emissores comprovados

1. **Fórum** — JWT; create thread/reply em transação com `recordEvent`. Idempotência: UUID da entidade. Repetir artificialmente = criar novos posts/replies.
2. **Bosstiário** — JWT + Premium; publish em `$transaction`; rollback se rewards falha (exceto evento “unsupported”). Idempotency-Key evita segundo create/`recordEvent`.
3. **WATCH_AD** — callback SSV público com ECDSA + sessão; `referenceId = transaction_id`. Web/PWA **sem** fluxo de anúncio no lançamento; tabelas AdMob **ausentes** em prod na auditoria DB.

---

## 3. Duplicidades de nomenclatura

| Par | Análise |
|-----|---------|
| `FORUM_COMMENT` vs `FORUM_COMMENT_CREATED` | **Sinônimos quebrados.** Só `_CREATED` é emitido. Missão ativa prod “Participe da comunidade” (`FORUM_COMMENT`) **nunca** progride. |
| `HUNT_ACTION` vs `HUNT_COMPLETED` | Ambos **sem emissor**. Nomes distintos; risco futuro se ambos forem ligados ao mesmo `recordEvent` sem cuidado. |
| `BESTIARY_ACTION` vs `BESTIARY_VIEWED` | Sem emissor. Views analytics ≠ Rewards. |
| `MUSIC_COMPLETED` vs `MUSIC_PLAYED` | Sem emissor. |
| `PROMOTION_COMPLETED` vs `APP_SHARED` | Sem emissor; mesma intenção de “compartilhar”. |
| `REFERRAL_CONFIRMED` vs `USER_RECRUITED` | Referral **não** alimenta missões. Dois nomes; um só deveria existir no futuro. |
| `AREA_EXPLORED` vs `EXPLORATION_COMPLETED` | Sem emissor; risco de dupla contagem se ambos forem emitidos no mesmo gesto. |
| Duas missões `BOSSTIARY_COMMUNITY_ROTATION_PUBLISHED` | DAILY (seed novo) + WEEKLY (seed): **mesmo evento** → uma publicação pode avançar **ambas** (receipts por `missionId`). Intencional se metas diferentes; documentar. |
| Duas “Poste no Fórum” (ativa + inativa) / títulos duplicados em prod | Legado `b2000001-…` + UUIDs; seed atualiza por `title+period+category`. |

**Contagem dupla de pontos hoje:** só risco real entre missões **ativas** com o **mesmo** `eventType` suportado (ex.: DAILY + WEEKLY Bosstiário; DAILY + WEEKLY `FORUM_TOPIC_CREATED` se ambas ativas). Em prod: “Poste no Fórum” DAILY + “Criador de Conteúdo” WEEKLY ambos `FORUM_TOPIC_CREATED` → **um tópico conta nos dois**.

---

## 4. Tabela por missão

### 4.1 Seed atual (`REWARD_MISSIONS` — 14)

| Missão | Evento | Emissor real | Ação do usuário | Web/PWA | Idempotência | Resultado |
|--------|--------|--------------|-----------------|---------|--------------|-----------|
| Explore 3 Novas Áreas | `EXPLORATION_COMPLETED` | — | — | — | N/A | **REPROVADA** (evento não emitido; FUTURE) |
| Pesquise 2 Criaturas | `BESTIARY_ACTION` | — | — | — | N/A | **REPROVADA** |
| Publique uma Rotação (WEEKLY) | `BOSSTIARY_COMMUNITY_ROTATION_PUBLISHED` | `community-rotations.service` | Publicar rotação | Sim (premium) | Rotation UUID + receipt | **APROVADA** |
| Compartilhe uma rotação (DAILY) | idem | idem | idem | Sim | idem | **APROVADA** (código); prod **NÃO COMPROVADA** até seed |
| Poste no Fórum | `FORUM_TOPIC_CREATED` | `forum.service` `create` | Criar tópico | Sim | Thread UUID | **APROVADA** |
| Faça 3 comentários | `FORUM_COMMENT_CREATED` | `forum.service` `createReply` | Responder | Sim | Reply UUID | **APROVADA** |
| Complete 3 Hunts | `HUNT_ACTION` | — | — | — | N/A | **REPROVADA** |
| Assista 3 / 5 / 15 anúncios | `WATCH_AD` | `admob-rewarded.service` | Concluir rewarded + SSV | **Não** (lançamento Web) | `transaction_id` | **PARCIAL** (mobile); **fora** da rotação Web |
| Compartilhe o RuneCodex | `PROMOTION_COMPLETED` | — | — | — | N/A | **REPROVADA** |
| Estude o Codex | `KNOWLEDGE_ANSWERED` | — | — | — | N/A | **REPROVADA** |
| Recrute um Aventureiro | `REFERRAL_CONFIRMED` | Referral **sem** `recordEvent` | Convite | Parcial | — | **REPROVADA** (missões) |
| Ouça a Trilha | `MUSIC_COMPLETED` | — | — | — | N/A | **REPROVADA** |

### 4.2 Missões ativas em produção (auditoria DB) — extras vs seed

| Missão | Evento | Emissor real | Ação | Web/PWA | Idempotência | Resultado |
|--------|--------|--------------|------|---------|--------------|-----------|
| Participe da comunidade | `FORUM_COMMENT` | — | — | — | — | **REPROVADA** (evento errado; deveria ser `_CREATED`) |
| Registre uma Hunt | `HUNT_CREATED` | — | — | — | — | **REPROVADA** |
| Ajudante da Comunidade | `USEFUL_REPLY` | — | — | — | — | **REPROVADA** (ativa sem efeito) |
| Criador de Conteúdo | `FORUM_TOPIC_CREATED` | `forum.service` | Criar tópico | Sim | Thread UUID | **APROVADA** (dupla contagem com DAILY fórum) |
| Recrute um jogador | `USER_RECRUITED` | — | — | — | — | **REPROVADA** |
| Assista 3 anúncios | `WATCH_AD` | AdMob SSV | Anúncio | Não | TX id | **PARCIAL** |

### 4.3 Missões inativas em produção (amostra de eventos)

Incluem (auditoria): `HUNT_RATED`, `HUNT_VIEWED`, `BESTIARY_VIEWED`, `EXPLORATION_COMPLETED` / `AREA_EXPLORED`, `BESTIARY_ACTION` / `CREATURE_VIEWED`, `APP_SHARED` / `PROMOTION_COMPLETED`, `HUNT_COMPLETED` / `HUNT_ACTION`, `COMMUNITY_CONTRIBUTION`, `CODEX_VIEWED` / `KNOWLEDGE_ANSWERED`, `MUSIC_*`, `REFERRAL_CONFIRMED`, etc.

| Resultado coletivo | **REPROVADAS** para ativação até existir emissor → `recordEvent`. |

---

## 5. Rotação diária — elegibilidade

Só entram na rotação: `active` + `DAILY` + `isSupportedRewardEvent` + ≠ `WATCH_AD`.

| Evento seguro na rotação hoje | Missões típicas |
|-------------------------------|-----------------|
| `FORUM_TOPIC_CREATED` | Poste no Fórum |
| `FORUM_COMMENT_CREATED` | Faça 3 comentários |
| `BOSSTIARY_COMMUNITY_ROTATION_PUBLISHED` | Compartilhe uma rotação (após seed) |

`WATCH_AD` e missões com eventos mortos (**não** entram). Missões WEEKLY/MONTHLY **não** entram na rotação diária (podem continuar ativas fora dela).

---

## 6. Segurança / exploração

| Vetor | Mitigação | Residual |
|-------|-----------|----------|
| Callback SSV falso | ECDSA + sessão (mobile) | Sem tabelas AdMob em prod → fluxo offline |
| Replay mesmo `referenceId` | Receipt unique | OK |
| Spam fórum | Conteúdo persistido + rate limits fórum | Progresso intencional por post legítimo |
| Tópico conta DAILY+WEEKLY | Dois receipts | Pontos em **duas** missões se ambas ativas |
| Rotação + Bosstiário WEEKLY | Mesmo evento | Uma publish pode fechar DAILY e avançar WEEKLY |
| Eventos FUTURE ativados por seed | `recordEvent` rejeita | Missão “ativa” sem progresso = UX enganosa (`FORUM_COMMENT`, `USEFUL_REPLY`, etc.) |

---

## 7. Conclusões

### 7.1 Missões prontas para ativação / uso

1. **Poste no Fórum** — `FORUM_TOPIC_CREATED`  
2. **Faça 3 comentários** — `FORUM_COMMENT_CREATED`  
3. **Publique uma Rotação** (WEEKLY) — Bosstiário  
4. **Compartilhe uma rotação** (DAILY) — após existir no banco + API com rotação  

### 7.2 Precisam correção (não ativar como estão)

| Missão / caso | Correção sugerida (não executar agora) |
|---------------|----------------------------------------|
| Participe da comunidade (`FORUM_COMMENT`) | Migrar `eventType` → `FORUM_COMMENT_CREATED` **ou** desativar |
| Ajudante da Comunidade (`USEFUL_REPLY`) | Desativar ou implementar “reply marcada útil” + emissor |
| Registre uma Hunt / Recrute um jogador | Desativar ou implementar emissor |
| Criador de Conteúdo + Poste no Fórum | Revisar se dupla recompensa por tópico é desejada |
| WATCH_AD ativas no Web | Manter fora da UI; não ativar Web até PoC ads |

### 7.3 Permanecer inativas

Todas as missões com eventos da §2 marcados inexistentes/reservados (exploração, bestiário view, hunt*, music*, promotion/share, knowledge, referral via motor missões).

### 7.4 Eventos inexistentes (não reutilizar até implementar)

`FORUM_COMMENT`, `HUNT_CREATED`, `HUNT_RATED`, `HUNT_VIEWED`, `HUNT_COMPLETED`, `BESTIARY_VIEWED`, `CREATURE_VIEWED`, `AREA_EXPLORED`, `USEFUL_REPLY`, `APP_SHARED`, `COMMUNITY_CONTRIBUTION`, `CODEX_VIEWED`, `USER_RECRUITED`, `MUSIC_PLAYED`.

### 7.5 Eventos “future” (constante sem emissor)

`BESTIARY_ACTION`, `HUNT_ACTION`, `MUSIC_COMPLETED`, `PROMOTION_COMPLETED`, `REFERRAL_CONFIRMED`, `KNOWLEDGE_ANSWERED`, `EXPLORATION_COMPLETED`.

### 7.6 Eventos seguros para **novas** missões (reutilizar agora)

| Evento | Observação |
|--------|------------|
| `FORUM_TOPIC_CREATED` | Preferir **uma** missão ativa por período para evitar farm multi-missão |
| `FORUM_COMMENT_CREATED` | Idem |
| `BOSSTIARY_COMMUNITY_ROTATION_PUBLISHED` | Exige Premium; bom para DAILY/WEEKLY com metas distintas |
| `WATCH_AD` | Só com SSV + inventário; **não** para lançamento Web |

### 7.7 Recomendações para novas missões

1. Só criar missão se o evento já estiver em `REWARD_EVENTS` **e** houver chamada `recordEvent` no fluxo de produto.  
2. Preferir `referenceId` = PK da entidade de domínio.  
3. Um `eventType` → no máximo uma missão **DAILY** ativa (e opcionalmente uma WEEKLY/MONTHLY se a economia for intencional).  
4. Não reativar legado `FORUM_COMMENT` / `USER_RECRUITED` / `USEFUL_REPLY` sem emissor.  
5. Referral: ou ligar `REFERRAL_CONFIRMED` ao `recordEvent` **ou** manter recompensa só em `ReferralReward` (não misturar).  
6. Views (`ContentViewEvent`): se virarem missões, emitir evento dedicado com anti-fraude (throttle), não reutilizar analytics cru.

---

## 8. Confirmações

- Nenhuma alteração de código, banco, seed, missão ou deploy.  
- Emissão comprovada apenas por inspeção de código + testes unitários existentes; **E2E staging NÃO EXECUTADO**.  
- Inventário produção baseado na auditoria DB de 2026-11-16 (não reconsultado aqui).