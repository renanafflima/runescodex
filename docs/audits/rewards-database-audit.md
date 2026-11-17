# Auditoria Rewards — banco de dados (somente leitura)

**Data/hora da consulta (UTC):** 2026-11-16T01:57:48.607Z — **01:57:49.456Z**  
**Equivalente (UTC−3):** 2026-11-15 22:57:48  

---

## 1. Ambiente consultado

| Item | Valor |
|------|--------|
| **Classificação** | **Produção** (`APP_ENV=production` no `apps/api/.env` local usado para conexão) |
| **Host** | `ep-odd-shape-acvcp9ho-pooler.sa-east-1.aws.neon.tech` (Neon, `sa-east-1`) |
| **Nome do banco** | `neondb` |
| **Confirmação de host** | Corresponde a `PRODUCTION_DATABASE_HOST` configurado no mesmo `.env` |
| **Operação** | Somente `SELECT` / agregações — **nenhuma escrita** |

> A conexão utilizou a configuração já presente no ambiente de desenvolvimento da máquina (`DATABASE_URL` + guardas de host de produção). Nenhum arquivo de configuração foi alterado.

---

## 2. Tabelas encontradas e volumes

| Tabela | Existe | Registros |
|--------|--------|----------:|
| `RewardWallet` | Sim | 6 |
| `RewardLedgerEntry` | Sim | 3 |
| `RewardMission` | Sim | 32 |
| `UserMissionProgress` | Sim | 4 |
| `RewardEventReceipt` | Sim | 6 |
| `RewardCatalogItem` | Sim | 5 |
| `RewardRedemption` | Sim | 0 |
| `RewardRedemptionStatusEvent` | Sim | 0 |
| `ReferralReward` | Sim | 0 |
| `AdMobRewardSession` | **Não** | — |
| `AdMobSsvTransaction` | **Não** | — |

**Tabelas consultadas com sucesso:** 9 existentes + 2 ausentes verificadas via `information_schema` (**11 nomes inspecionados**).  
**Total de linhas somadas (tabelas existentes):** 56.

As tabelas AdMob indicam que a migration `20261113140000_add_admob_rewarded_ssv` **não foi aplicada** neste banco.

---

## 3. Carteiras (`RewardWallet`)

| Métrica | Valor |
|---------|------:|
| Total de carteiras | 6 |
| Usuários distintos com carteira | 6 |
| Soma de pontos | 65 |
| Soma de gold | 0 |
| Soma de diamonds (`diamond`) | 0 |
| Carteiras zeradas (0/0/0) | 4 |
| Saldos negativos | 0 |

**Maiores saldos em pontos (somente `userId`):**

| `userId` | points | gold | diamond |
|----------|-------:|-----:|--------:|
| `d20d6eae-da4b-4552-9a07-a94c6759ded5` | 45 | 0 | 0 |
| `0577768e-ebb9-4a74-a7c7-caa2012470bc` | 20 | 0 | 0 |
| Demais 4 carteiras | 0 | 0 | 0 |

---

## 4. Missões (`RewardMission`)

| Métrica | Valor |
|---------|------:|
| Total cadastrado | 32 |
| Ativas | 8 |
| Inativas | 24 |

### Missões ativas (resumo)

| Título | Período | Meta | Pontos | `eventType` |
|--------|---------|-----:|-------:|-------------|
| Assista 3 anúncios | DAILY | 3 | 30 | `WATCH_AD` |
| Faça 3 comentários | DAILY | 3 | 25 | `FORUM_COMMENT_CREATED` |
| Participe da comunidade | DAILY | 3 | 30 | `FORUM_COMMENT` |
| Poste no Fórum | DAILY | 1 | 20 | `FORUM_TOPIC_CREATED` |
| Registre uma Hunt | DAILY | 1 | 40 | `HUNT_CREATED` |
| Ajudante da Comunidade | WEEKLY | 3 | 120 | `USEFUL_REPLY` |
| Criador de Conteúdo | WEEKLY | 3 | 100 | `FORUM_TOPIC_CREATED` |
| Recrute um jogador | MONTHLY | 1 | 200 | `USER_RECRUITED` |

Há **duplicatas históricas** de títulos/eventos (versões antigas inativas com IDs `b2000001-…` e UUIDs posteriores); apenas uma missão por fluxo costuma estar ativa por período.

### Validação — missões `WATCH_AD` (regras do produto)

| Período | Meta | Recompensa | Cadastrada no banco | Ativa |
|---------|-----:|---------:|:-------------------:|:-----:|
| Diário | 3 | 30 | **Sim** (`a1000001-0001-4000-8000-000000000001`) | **Sim** |
| Semanal | 5 | 70 | **Não** | — |
| Mensal | 15 | 250 | **Não** | — |

**Divergência com o seed** (`apps/api/prisma/seed/rewards.ts`): apenas a missão **diária** de anúncios está presente; as missões semanal (5 / 70) e mensal (15 / 250) **não constam** neste banco. Nenhuma correção foi aplicada.

---

## 5. Progresso (`UserMissionProgress`)

| Métrica | Valor |
|---------|------:|
| Registros totais | 4 |
| Concluídas (`completed = true`) | 3 |
| Em andamento | 1 |
| Usuários distintos | 2 |
| Progresso órfão (sem missão) | 0 |
| `progress > target` com `completed = false` | 0 |

**Por tipo de missão (top):**

| `eventType` | Período | Linhas | Concluídas |
|-------------|---------|-------:|-----------:|
| `FORUM_TOPIC_CREATED` | DAILY | 2 | 2 |
| `FORUM_TOPIC_CREATED` | WEEKLY | 1 | 0 |
| `FORUM_COMMENT_CREATED` | DAILY | 1 | 1 |

Nenhum progresso ligado a `WATCH_AD`.

---

## 6. Ledger (`RewardLedgerEntry`)

| Métrica | Valor |
|---------|------:|
| Lançamentos totais | 3 |
| Δ pontos (soma) | +65 |
| Δ gold / diamond | 0 / 0 |
| Pontos creditados (Δ > 0) | 65 |
| Pontos debitados (Δ < 0) | 0 |

**Por tipo:**

| Tipo | Quantidade | Soma pontos |
|------|----------:|------------:|
| `MISSION_REWARD` | 3 | 65 |

**Últimos lançamentos (todos os 3):**

| Data (UTC) | `userId` | Tipo | Δ pts | `referenceId` (missão) |
|------------|----------|------|------:|------------------------|
| 2026-10-28T02:38:58.658Z | `0577768e-ebb9-4a74-a7c7-caa2012470bc` | `MISSION_REWARD` | 20 | `8037529a-3c60-4844-959a-67fc98f0470c` |
| 2026-09-21T04:15:43.794Z | `d20d6eae-da4b-4552-9a07-a94c6759ded5` | `MISSION_REWARD` | 25 | `45434ed2-db95-4929-afa7-44a6bc61e1e9` |
| 2026-09-21T04:13:39.127Z | `d20d6eae-da4b-4552-9a07-a94c6759ded5` | `MISSION_REWARD` | 20 | `8037529a-3c60-4844-959a-67fc98f0470c` |

**Possíveis duplicidades:** agrupamento por `(type, referenceType, referenceId)` sem `userId` mostra **2** lançamentos com a mesma missão `8037529a-…` — são **dois usuários diferentes**; **não** é duplicidade de crédito para o mesmo usuário. **Situação:** investigação concluída — comportamento esperado.

---

## 7. Resgates (`RewardRedemption`)

| Status | Quantidade |
|--------|----------:|
| Total | 0 |
| PENDING / APPROVED / DELIVERED / CANCELLED | 0 |
| Eventos de status | 0 |

Sem itens mais resgatados (catálogo: 5 itens cadastrados, nenhum resgate).

---

## 8. Eventos e anúncios

### `RewardEventReceipt`

| Métrica | Valor |
|---------|------:|
| Total | 6 |
| `WATCH_AD` | **0** |

Grupos duplicados violando a unique key: **0** (nenhum grupo com `COUNT > 1`).

### AdMob

| Métrica | Valor |
|---------|-------|
| Tabelas | Ausentes |
| Sessões / transações SSV | N/A |

---

## 9. Integridade

| Verificação | Resultado |
|-------------|----------:|
| Carteiras sem `User` | 0 |
| Ledger sem `RewardWallet` | 0 |
| `userId` do ledger ≠ carteira | 0 |
| Carteira.`points` ≠ soma ledger (`pointsDelta`) | **0** |
| Receipts sem missão | 0 |
| Resgates sem lançamento `REDEMPTION` | 0 |
| SSV sem sessão | N/A (tabela inexistente) |

**Comprovado:**FKs e saldo agregado de pontos **consistentes** com o ledger (65 = 65).

**Investigar (não é bug de dados):**

- Catálogo de missões WATCH_AD semanal/mensal ausente em relação ao seed.
- Migration AdMob não aplicada em produção.

---

## 10. Divergências e conclusão

### Divergências

1. **Missões WATCH_AD semanal e mensal** não cadastradas no banco de produção.
2. **Tabelas AdMob** inexistentes — fluxo SSV mobile ainda não provisionado neste PostgreSQL.
3. Volume **muito baixo** de atividade Rewards (4 progressos, 3 créditos de missão, 0 resgates, 0 anúncios).

### Conclusão

O motor Rewards em **produção** está **operacional em escopo reduzido**: carteiras e ledger coerentes, missões majoritariamente inativas (legado), atividade real concentrada em missões de **fórum**. Anúncios recompensados (**WATCH_AD**) têm apenas a **meta diária** ativa, **sem** eventos nem progresso registrados. Integração AdMob/SSV **não está presente** no schema aplicado.

**Estado geral:** dados íntegros nas relações verificadas; **lacunas de catálogo** (WATCH_AD semanal/mensal) e **ausência de migration AdMob** são as principais diferenças em relação ao repositório.

---

## 11. Confirmação de segurança da auditoria

| Pergunta | Resposta |
|----------|----------|
| Banco consultado | Neon `neondb` — host acima |
| Ambiente | **Produção** |
| Tabelas inspecionadas | 11 nomes (9 com dados, 2 inexistentes) |
| Registros (soma nas tabelas existentes) | 56 |
| Inconsistências de integridade FK/saldo | **Nenhuma comprovada** |
| Alterações no banco | **Nenhuma** (somente leitura) |

---

*Relatório gerado por consultas SQL via Prisma (`$queryRaw`) em modo somente leitura.*