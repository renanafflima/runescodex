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

## Mercado Pago

O projeto usa o **Checkout Pro** para vender o RuneCodex Premium em pagamento único (atualmente R$ 49,90, licença sem expiração). É a opção mais adequada aqui: o Mercado Pago hospeda a tela de pagamento e processa Pix/cartão sem o RuneCodex receber ou armazenar dados de cartão. Web e mobile usam o mesmo checkout; no mobile ele abre no navegador do dispositivo.

O checkout só abre quando estas variáveis existem no ambiente. Sem elas, `POST /billing/checkout` responde que o provedor não está configurado. Nenhum pagamento é marcado como aprovado.

- `MERCADO_PAGO_ACCESS_TOKEN`
- `MERCADO_PAGO_WEBHOOK_SECRET`
- `MERCADO_PAGO_NOTIFICATION_URL` — URL https pública de `POST /billing/webhooks/mercadopago`. Em development, `http://localhost` é aceito.
- `MERCADO_PAGO_BACK_URL_SUCCESS` — URL https do app web para retorno após sucesso.
- `MERCADO_PAGO_BACK_URL_PENDING` — URL https do app web para retorno enquanto o pagamento está pendente.
- `MERCADO_PAGO_BACK_URL_FAILURE` — URL https do app web para retorno após falha/cancelamento.

### Configuração

1. Aplique as migrations do Prisma no banco de **staging** com `npm run prisma:migrate:deploy`, usando exclusivamente a `DATABASE_URL` de staging. Faça isso como etapa controlada antes de liberar a versão da API; o deploy atual não aplica migrations automaticamente.
2. Configure staging com credenciais de teste do Mercado Pago. Não reutilize credenciais de produção.
3. Cadastre o endereço público da API seguido de `/billing/webhooks/mercadopago` como URL de notificação e habilite notificações de pagamentos. Copie a chave secreta de assinatura do webhook para `MERCADO_PAGO_WEBHOOK_SECRET`.
4. Configure as três URLs de retorno para a página `/checkout` do app web. Elas precisam ser HTTPS em staging/produção; voltar do Mercado Pago não libera Premium por si só.
5. Adicione as seis variáveis no painel do serviço da API. `render.yaml` declara esses nomes como variáveis não sincronizadas para facilitar a configuração sem incluir segredos no repositório.
6. Faça um pagamento de teste e confirme que o webhook chega à API e que o app mostra o acesso Premium após atualizar o status. Antes de liberar em produção, aplique as migrations no banco de produção em uma etapa controlada e configure credenciais e webhook de produção separadamente.

O token de teste do Mercado Pago começa com `TEST-`. A API consulta o pagamento diretamente no provedor, valida a assinatura do webhook e confere valor, moeda e referência do pedido antes de conceder a licença. O conteúdo da notificação e as URLs de retorno nunca concedem acesso. Se o webhook atrasar, o app permite atualizar o status consultando o Mercado Pago novamente.

Para desenvolvimento local, o endpoint de notificação precisa ser alcançável pelo Mercado Pago; use um túnel HTTPS temporário apontando para a API local e defina essa URL em `MERCADO_PAGO_NOTIFICATION_URL`. Não use `localhost` como URL de notificação remota. No checkout mobile, o usuário retorna ao app e pode tocar em “Atualizar status”; o webhook permanece a fonte autoritativa da confirmação.

## Compras nativas iOS e Android (RevenueCat)

O app nativo usa o RevenueCat SDK para comprar o produto não consumível “Premium vitalício”. Configure o catálogo nesta ordem:

1. Crie um produto de compra única/não consumível no App Store Connect e um produto de compra única no Google Play Console. Use os mesmos IDs de produto ao cadastrá-los no RevenueCat.
2. No RevenueCat, conecte os dois apps das lojas, adicione os produtos e crie o entitlement `premium`.
3. Associe os produtos ao entitlement `premium` e crie a offering `current` com um package do tipo **Lifetime**. O checkout nativo mostra o preço localizado retornado pela loja.
4. Configure uma chave pública por plataforma nos ambientes de build do Expo:

- `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY`
- `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY`

   Essas chaves públicas são embutidas no app e não são segredos. Configure-as no ambiente EAS para development, preview e production (e no `.env` local para builds locais). Nunca coloque a Secret API key do RevenueCat no mobile.
5. Configure `REVENUECAT_SECRET_API_KEY` e um segredo aleatório em `REVENUECAT_WEBHOOK_AUTHORIZATION` nos ambientes da API. A API consulta o subscriber no RevenueCat antes de persistir o entitlement.
6. Para receber atualizações de reembolsos/alterações mesmo quando o app não estiver aberto, configure no RevenueCat o webhook HTTPS `POST /billing/webhooks/revenuecat` e informe o mesmo valor de `REVENUECAT_WEBHOOK_AUTHORIZATION` no campo Authorization. Webhooks do RevenueCat requerem o plano compatível da conta.
7. Gere uma development build/EAS build, teste compra e restauração com contas sandbox das duas lojas e confirme o entitlement no backend antes de liberar a versão das lojas.

O pacote de compras nativas exige uma development build/EAS build; Expo Go não inclui esse módulo nativo. Confira se o bundle ID iOS e o application ID Android correspondem aos cadastrados nas lojas e se `com.tritech.runescodex` está disponível na sua conta Apple. O app mobile não abre o Mercado Pago: essa opção permanece no checkout web.

## O que impede o desenvolvimento de usar produção

Com `APP_ENV=development`, a API, o Prisma e os seeds só aceitam host local (`localhost`, `127.0.0.1`, `postgres`, `host.docker.internal`) ou o host escrito em `DEV_DATABASE_HOST`. Host de staging ou de produção é recusado antes de abrir conexão. A mensagem de erro não inclui a URL. O seed também recusa `APP_ENV=production`.

## Recuperação controlada de ADMIN

Papel administrativo é apenas `User.role = ADMIN`. O JWT não embute o papel; `AdminGuard` e `/auth/me` leem o banco a cada requisição. Não existe endpoint público para se auto-promover.

Use somente o script idempotente:

```bash
# Conta precisa já existir no banco de destino (cadastro ou Google).
# Nunca cria usuário nem altera senha.

ALLOW_ADMIN_PROMOTE=YES \
CONFIRM_TARGET=local|staging|production \
CONFIRM_DATABASE_HOST=<host-exato-da-DATABASE_URL> \
CONFIRM_DATABASE_NAME=<nome-exato-do-banco> \
ADMIN_EMAIL=<email-normalizado> \
APP_ENV=development|staging|production \
DATABASE_URL=<url-do-ambiente> \
npm run promote:admin
```

O script falha se o e-mail não existir, se o host/nome confirmados não baterem com `DATABASE_URL`, ou se `ALLOW_ADMIN_PROMOTE` não for `YES`. Em produção, rode no shell/painel do Render com a `DATABASE_URL` de produção — nunca copie essa URL para o Git.
