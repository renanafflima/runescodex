# Auditoria de emissores — Rewards V2 (lançamento)

## Problemas corrigidos nesta entrega

| Problema | Causa | Correção |
|----------|-------|----------|
| Abas lentas | Cada clique em Diárias/Semanais/Mensais refazia `GET /rewards/missions?period=` + me/catalog/history | `GET /rewards/missions-board` + cache local; troca de aba só no frontend |
| Aberturas/filtros/shares só contavam 1× | `referenceId` estável → receipt único por período | Eventos repetíveis usam `referenceId:uuid` + rate limit 60/min |
| Comentários em Charm Guides sem progresso | `CharmGuideCommentsService` não emitia evento | Emite `FORUM_COMMENT_CREATED` |
| Curtida em comentário de guia sem progresso | Like sem rewards | Emite `COMMUNITY_CONTENT_LIKED` só no primeiro like |
| Share de guia/rotação sem progresso | Share sem `reportRewardActivity` | Hunt + Charm Guide + Community Rotation |

## Eventos implementados (com emissor)

| Evento | Emissor |
|--------|---------|
| FORUM_TOPIC_CREATED | fórum |
| FORUM_COMMENT_CREATED | fórum + comentários Charm Guide |
| COMMUNITY_CONTENT_LIKED | like guia Charm / like comentário guia / like rotação |
| GUIDE_PUBLISHED | publish Charm Guide / community rotation |
| CHARM_BUILD_SAVED / CHARM_CREATURE_COMPLETED | charm-guides |
| BOSS_DEFEATED_RECORDED | bosstiary progress |
| ROTATION_EDITED / BOSSTIARY_COMMUNITY_ROTATION_PUBLISHED | community-rotations |
| CREATURE_VIEWED / HUNT_VIEWED / BESTIARY_FILTER_USED / BOSSTIARY_OPENED / ARCHFOE / LOOT / SHARE / PROMO_BANNER | `POST /rewards/activity` |
| DAILY_ALL / WEEKLY_ALL | agregadores server-side |

## Dependências externas / não funcionais no Web

| Missão / evento | Status |
|-----------------|--------|
| Tributo / WATCH_AD | Bloqueado até SSV Web |
| HUNT_FAVORITED / DAILY_INFO / TOOL_CALC / CONTENT_RATED | Fora da rotação (`eventImplemented: false`) |

## CTA “Começar missão”

Apenas `Link` para a área correta. Não concede pontos nem conclui missão.