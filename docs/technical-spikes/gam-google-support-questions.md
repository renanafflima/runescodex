# Perguntas técnicas — Google Ad Manager (Rewarded Web + SSV)

**Projeto:** RuneCodex Web/PWA (`https://tritech.app.br/runescodex`)  
**Data de preparação:** 2026-11-13  
**Status:** documento para envio futuro — **nenhuma mensagem foi enviada ao Google.**

---

## 1. Contexto resumido (para o suporte)

RuneCodex is a web/PWA rewards platform. We want to grant **in-app points** only after a **verified server-to-server** callback when a user completes a **Google Ad Manager Rewarded Web** ad (Google Publisher Tag, `OutOfPageFormat.REWARDED`).

Our backend must:

1. Create an authenticated **reward session** (UUID) bound to a logged-in user.
2. Show the rewarded ad in the browser (UX only; no trust in JavaScript events for crediting).
3. Receive and **cryptographically verify** Google’s SSV GET callback.
4. Map the callback to the session and user, then credit **at most once** per `transaction_id`.

We already use a similar flow for **mobile** AdMob SSV (`custom_data` + ECDSA). We need **official confirmation** for **GAM Rewarded Web + GPT**, not assumptions from mobile docs.

**References we have read:**

| URL | Title | Web/Mobile | Confirms | Does not confirm |
|-----|--------|------------|----------|------------------|
| https://support.google.com/admanager/answer/9116812 | Traffic rewarded ads for web | **Web** | GPT rewarded; events; **GET SSV** when URL configured on ad unit | Callback query params; signature; `custom_data` from GPT |
| https://developers.google.com/publisher-tag/samples/display-rewarded-ad | Display a rewarded ad | **Web** | GPT events; `defineOutOfPageSlot` may return null; mobile-optimized pages | SSV; session binding |
| https://support.google.com/admanager/answer/179039 | What's new in GAM | **Web** | SSV for rewarded **web** inventory announced | Contract details |
| https://developers.google.com/admob/android/ssv | Validate SSV callbacks | **Mobile** | Params, ECDSA, `verifier-keys.json`, `custom_data` via SDK | **Not proof for GPT Web** |

---

## 2. Perguntas em português (para account manager / suporte GAM)

### 2.1 Existência e escopo do SSV Web

1. O **Google Ad Manager Rewarded Web** (GPT `OutOfPageFormat.REWARDED`) suporta **Server-Side Verification** com callback **server-to-server** iniciado pelos servidores do Google (não pelo navegador)?
2. Esse SSV Web utiliza o **mesmo formato de callback** (parâmetros, assinatura ECDSA, `verifier-keys.json`) documentado para AdMob / Mobile Ads SDK, ou existe documentação específica para **Web**?
3. Onde está a documentação oficial que lista **todos os parâmetros** do callback SSV para **rewarded web**?

### 2.2 Contrato do callback

4. Qual **método HTTP** é usado? (Entendemos que é **GET** — confirmar.)
5. Quais parâmetros são enviados em um callback válido? (Ex.: `ad_network`, `ad_unit`, `transaction_id`, `timestamp`, `reward_amount`, `reward_item`, `custom_data`, `user_id`, `signature`, `key_id`.)
6. A ordem dos parâmetros na query string é relevante para a verificação da assinatura?
7. Qual algoritmo de assinatura é utilizado? Onde está documentada a obtenção de **chaves públicas** e a rotação (`key_id`)?
8. Qual é a política de **retentativas** do Google se nosso endpoint retornar 5xx ou timeout?
9. Callbacks **duplicados** ou **atrasados** devem ser tratados como idempotentes pelo publisher?

### 2.3 Vínculo sessão ↔ usuário (questão crítica)

10. Existe equivalente oficial ao **`customData` / `ServerSideVerificationOptions`** do SDK mobile para **GPT Rewarded Web**?
11. Como o publisher deve passar um **identificador de sessão gerado no servidor** para que ele apareça no callback SSV (ex.: parâmetro `custom_data`)?
12. O valor de `custom_data` (se presente) faz parte do **conteúdo assinado** protegido por ECDSA?
13. O parâmetro `user_id` no SSV pode ser definido de forma segura no fluxo **Web/GPT**, ou é apenas recurso de **app SDK**?
14. O **key-value targeting** do GPT pode ser usado para correlação de sessão no SSV? Se sim, onde está documentado?
15. Qual é a **recomendação oficial do Google** para associar uma recompensa de publisher a um usuário específico em **rewarded web**, sem confiar em eventos JavaScript (`rewardedSlotGranted`)?

### 2.4 Ambiente de teste

16. Existe **unidade de anúncio / inventário de teste** oficial para **Rewarded Web** + SSV (similar às test ad units do AdMob)?
17. O fluxo **“Verify URL”** do painel SSV (como no AdMob) também se aplica às unidades **GAM Web**?
18. Há restrições conhecidas para **PWA instalada**, **Safari iOS** ou **desktop** com `defineOutOfPageSlot` retornando `null`?

### 2.5 Política e conformidade

19. Recompensas do tipo **pontos internos da plataforma** (não conversíveis diretamente em dinheiro) em rewarded web estão alinhadas às [policies for ad units that offer rewards](https://support.google.com/adsense/answer/9121589)? Há requisitos adicionais de disclosure no opt-in?

---

## 3. English version (ready to send)

**Subject:** Technical questions — GAM Rewarded Web SSV, session binding, and callback contract

Hello,

We are integrating **Google Ad Manager Rewarded Web** (Google Publisher Tag, `googletag.enums.OutOfPageFormat.REWARDED`) into a **web/PWA** application. We need **server-side verification (SSV)** so that in-app rewards are granted only after a trusted Google server-to-server callback—not based on browser events such as `rewardedSlotGranted`.

We have reviewed:

- [Traffic rewarded ads for web](https://support.google.com/admanager/answer/9116812) (mentions GET SSV for rewarded web)
- [Display a rewarded ad (GPT sample)](https://developers.google.com/publisher-tag/samples/display-rewarded-ad)
- [What's new — SSV for rewarded web inventory](https://support.google.com/admanager/answer/179039)
- [Validate SSV callbacks (Android)](https://developers.google.com/admob/android/ssv) — **for comparison only**; we do not assume this applies to GPT Web without confirmation.

**Questions:**

**A. SSV for Rewarded Web**

1. Does GAM Rewarded Web (GPT) support server-side verification with callbacks initiated by **Google’s servers** (not the browser)?
2. Is the web SSV callback format identical to the mobile SSV format (query parameters, ECDSA signature, `https://www.gstatic.com/admob/reward/verifier-keys.json`), or is there separate documentation for web?
3. Where is the official parameter reference for **rewarded web** SSV callbacks?

**B. Callback contract**

4. HTTP method (we believe GET — please confirm).
5. Full list of query parameters on a valid callback.
6. Are query parameter order and URL encoding rules the same as documented for mobile SSV (content to verify is the raw query substring before `&signature=`)?
7. Signature algorithm, public key source, and `key_id` rotation policy.
8. Retry behavior if our endpoint returns 5xx or times out.
9. Expected publisher handling of duplicate or delayed callbacks (idempotency).

**C. Session / user binding (critical)**

10. Is there an official GPT/Web API equivalent to mobile `ServerSideVerificationOptions.customData`?
11. How should we pass a **server-generated session UUID** so it appears in the SSV callback (e.g. `custom_data`) for rewarded **web**?
12. If `custom_data` is present, is it included in the **signed** payload?
13. Can `user_id` in the SSV callback be set securely in the **GPT web** flow, or is it SDK-only?
14. Can GPT key-value targeting be used for session correlation in SSV? If yes, please point to documentation.
15. What is Google’s recommended pattern to reward a specific user on **rewarded web** without trusting client-side JavaScript?

**D. Testing**

16. Is there an official **test** rewarded web inventory / ad unit for SSV validation?
17. Does the AdMob-style “Verify callback URL” flow apply to GAM web rewarded units?
18. Known limitations for installed PWAs, Safari iOS, or desktop when `defineOutOfPageSlot` returns null?

**E. Policy**

19. Any additional requirements for non-monetary in-platform points as rewards under the [rewarded ad unit policies](https://support.google.com/adsense/answer/9121589)?

Our intended architecture: authenticated user → server creates session → browser shows GPT rewarded ad → Google SSV GET → server verifies signature → server maps session to user → single grant per `transaction_id`.

Thank you.

---

## 4. Pontos sem confirmação oficial (checklist interno)

Use este checklist ao receber respostas:

| # | Tópico | Status atual |
|---|--------|--------------|
| 1 | GET SSV para rewarded web | **Confirmado** (9116812) |
| 2 | Parâmetros completos do callback Web | **NÃO CONFIRMADO** |
| 3 | ECDSA + `verifier-keys.json` no Web | **NÃO CONFIRMADO** (inferido do mobile) |
| 4 | `custom_data` via GPT Web | **NÃO CONFIRMADO** |
| 5 | `custom_data` dentro do payload assinado | **Confirmado** no mobile; **NÃO CONFIRMADO** no Web |
| 6 | Configuração SSV URL na unidade GAM Web (UI) | **NÃO CONFIRMADO** |
| 7 | Inventário de teste Web + SSV | **NÃO CONFIRMADO** |

---

## 5. Anexos sugeridos ao enviar (quando houver PoC)

- Redacted sample callback query string (no secrets).
- HTTP status codes returned by our staging endpoint.
- Result of signature verification (pass/fail) without exposing private keys.

**Não enviar:** `JWT_SECRET`, `DATABASE_URL`, tokens de usuário, chaves privadas.
