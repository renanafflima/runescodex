# Ambientes

Desenvolvimento, staging e produção usam bancos e `JWT_SECRET` diferentes. Os valores reais ficam fora do Git.

## Desenvolvimento

1. Na raiz do repositório: `docker compose up -d`
2. Copie `apps/api/.env.example` para `apps/api/.env`
3. Em `apps/api`: `npx prisma migrate deploy` e, se quiser o catálogo, `npm run prisma:seed`
4. `npm run start:dev`

O banco local é `localhost`, banco `runescodex_dev`. A senha do container local está no `docker-compose.yml` e no exemplo; ela não é credencial de produção.

Para um Neon só de desenvolvimento, crie um projeto separado e defina `DEV_DATABASE_HOST` com o host desse projeto. O host de produção continua recusado.

## Staging

O arquivo `render.staging.yaml` descreve um serviço separado. Ele não é aplicado automaticamente.

No painel do staging, defina:

- `APP_ENV=staging`
- `DATABASE_URL` do banco de staging
- `STAGING_DATABASE_HOST` igual ao host dessa URL
- `PRODUCTION_DATABASE_HOST` igual ao host de produção, para o processo recusar esse host
- `JWT_SECRET` exclusivo de staging, com pelo menos 32 caracteres

Para um ensaio local, copie `apps/api/.env.staging.example` para `apps/api/.env.staging`, preencha o banco de staging e rode `npm run start:staging` depois do build.

## Produção

O `render.yaml` publica a API com `APP_ENV=production`. `DATABASE_URL`, `JWT_SECRET`, `PRODUCTION_DATABASE_HOST`, `STAGING_DATABASE_HOST` e `CORS_ORIGINS` são preenchidos só no painel do Render.

Não copie esses valores para `apps/api/.env`.

O comando de produção é `npm run start:prod`. O seed recusa banco de produção.

## Evidências de chamados

Não há bucket configurado neste repositório. A API só envia a imagem quando as variáveis existem no ambiente.

Em desenvolvimento, `TICKET_STORAGE_DRIVER=local` grava os arquivos em `apps/api/.ticket-storage`. Essa pasta não entra no Git. O campo `url` fica vazio, a menos que `TICKET_STORAGE_PUBLIC_BASE_URL` seja um endereço https.

Em staging e produção o driver local é recusado. Use storage compatível com S3 (Amazon S3 ou Cloudflare R2):

- `TICKET_STORAGE_DRIVER=s3`
- `TICKET_STORAGE_S3_BUCKET`
- `TICKET_STORAGE_S3_REGION`
- `TICKET_STORAGE_S3_ACCESS_KEY_ID`
- `TICKET_STORAGE_S3_SECRET_ACCESS_KEY`
- `TICKET_STORAGE_S3_ENDPOINT` quando o provedor não for a AWS, como o endpoint da R2
- `TICKET_STORAGE_S3_FORCE_PATH_STYLE=true` quando o provedor exigir path-style
- `TICKET_STORAGE_PUBLIC_BASE_URL` opcional, somente https, para preencher `TicketEvidence.url`
- `TICKET_EVIDENCE_MAX_BYTES` opcional, padrão 5000000, máximo 10000000

Sem essas variáveis, a API sobe, mas o upload responde que o storage não está configurado. A imagem não é gravada no PostgreSQL.

## O que impede o desenvolvimento de usar produção

Com `APP_ENV=development`, a API, o Prisma e os seeds só aceitam host local (`localhost`, `127.0.0.1`, `postgres`, `host.docker.internal`) ou o host escrito em `DEV_DATABASE_HOST`. Host de staging ou de produção é recusado antes de abrir conexão. A mensagem de erro não inclui a URL. O seed também recusa `APP_ENV=production`.
