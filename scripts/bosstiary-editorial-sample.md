# Amostra editorial do Bosstiário

Relatório separado para revisão manual. Não entra em `apps/web/src/domain/bosstiary-reviewed.ts` e não altera a tela nem o banco.

Fontes lidas em 20/10/2026:

- `scripts/bosses-extracted.json` e `scripts/bosses-review.csv`: 538 linhas, os mesmos campos `name`, `sourceUrl`, `slug`, `isboss`.
- `apps/web/src/domain/bosstiary.ts`: a classificação do RuneCodex só aceita `solo`, `party` ou `event`, com faixa `300`, `500`, `700` ou `1000`.
- `apps/web/src/domain/bosstiary-reviewed.ts`: lista vazia. Continua vazia.
- Infobox e categorias de uma amostra na TibiaWiki (`https://www.tibiawiki.com.br/api.php`). `bosstype` e categorias como Archfoe, Nemesis ou Invasões foram registrados como fato da wiki. Não foram convertidos em Solo, PT ou Evento.

Nenhuma faixa foi proposta. A wiki não publica as faixas editoriais do RuneCodex, e não há nível mínimo oficial neste arquivo.

## Catálogo inteiro, sem classificação

| Achado | Quantidade |
|---|---|
| Candidatos | 538 |
| `isboss` original | `sim` nas 538 |
| Slug ou nome exatamente repetido | 0 |
| Campos além de nome, URL, slug e `isboss` | 0 |
| Prontos para Solo, PT, Evento ou faixa | 0 |

Pares com o mesmo nome base e uma página marcada `(Imune)`. São slugs diferentes, não duplicata confirmada:

- `an-observer-eye` e `an-observer-eye-imune`
- `devovorga` e `devovorga-imune`
- `the-sinister-hermit` e `the-sinister-hermit-imune`

`ferumbras`, `ascending-ferumbras` e `ferumbras-mortal-shell` também são slugs diferentes. A relação entre eles precisa de confirmação antes de fundir ou classificar.

Todos os 538 estão insuficientes para a classificação do RuneCodex: o extrato não traz formato da luta nem nível recomendado.

## Amostra de 10

Proposta do RuneCodex fica em branco nos dez. O status diz o que falta decidir.

| Nome | Slug original | Fato verificado na TibiaWiki | Proposta Solo/PT/faixa | Status |
|---|---|---|---|---|
| Ferumbras | `ferumbras` | `isboss=sim`, `bosstype=nemesis`, categorias Bosses Nemesis e Bosses de Invasões | nenhuma | Inconclusivo. Categoria de invasão não vira Evento. |
| Ascending Ferumbras | `ascending-ferumbras` | `isboss=sim`, `bosstype` vazio, nota de que se transforma em outra forma | nenhuma | Confirmar se é fase da luta, não um boss de catálogo. |
| Ferumbras Mortal Shell | `ferumbras-mortal-shell` | `isboss=sim`, `bosstype=nemesis`, cooldown `1195200` | nenhuma | Página distinta. Cooldown não é faixa de nível. |
| Orshabaal | `orshabaal` | `isboss=sim`, `bosstype=nemesis`, categorias Bosses de Invasões | nenhuma | Inconclusivo pelo mesmo motivo de Ferumbras. |
| Abyssador | `abyssador` | `isboss=sim`, `bosstype=archfoe`, categoria Bosses de Gnomegate Crystal Dungeon | nenhuma | Archfoe é classe da wiki, não Solo nem PT. |
| Kusuma | `kusuma` | `isboss=sim`, `bosstype=archfoe`, cooldown `72000` | nenhuma | Não há fonte do formato da luta nem da faixa. |
| Adventurer Group | `adventurer-group` | `isboss=sim`, `bosstype=archfoe`, cooldown `72000`, `creatureclass` vazio | nenhuma | Confirmar se o registro é um grupo, não um boss individual. |
| A Weak Spot | `a-weak-spot` | `isboss=sim`, `bosstype` vazio, nota de que é parte de outro boss | nenhuma | Confirmar exclusão. Não há base para Solo ou PT. |
| An Observer Eye | `an-observer-eye` | `isboss=sim`, `bosstype` vazio; a nota da página fala em versão imune | nenhuma | Confirmar o par com a página `(Imune)`. |
| An Observer Eye (Imune) | `an-observer-eye-imune` | `isboss=sim`, `bosstype` vazio, categoria Bosses de Cosmic Chamber | nenhuma | Mesmo par. Não fundir só pelo nome. |

## Próximos passos

1. Revisar esta amostra e decidir se algum dos dez deve ser excluído, mantido como candidato ou classificado.
2. Escrever a regra editorial que liga uma fonte a Solo, PT ou Evento e a uma das quatro faixas. Sem essa regra, o restante dos 538 continua inconclusivo.
3. Só depois da aprovação, copiar slugs aprovados para `bosstiary-reviewed.ts`.
