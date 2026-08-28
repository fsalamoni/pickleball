# Notificações push (PWA/FCM) — como ativar

O push já está **implementado e no ar**, porém **inerte** por segurança: nada
acontece até você concluir os passos abaixo. Enquanto não ativar, a plataforma
segue exatamente como está (nenhum token é registrado, nenhum push é enviado).

## O que já foi entregue

- **Cliente** (`src/core/services/pushService.js`): opt-in do atleta (pede
  permissão, registra o token FCM em `push_tokens`). Gracioso — no-op sem VAPID,
  sem suporte do navegador ou sem permissão.
- **Service worker do FCM** (`public/firebase-messaging-sw.js`): recebe o push em
  segundo plano e trata o clique. É **separado** do `sw.js` do PWA e só é
  registrado quando o atleta opta.
- **Coleção `push_tokens`** + regra no `firestore.rules` (cada usuário gerencia
  só os próprios tokens).
- **Cloud Function `pushOnNotificationCreate`**: espelha cada notificação in-app
  (coleção `notifications`) para os tokens do usuário. Retorna cedo se não houver
  tokens (o normal até alguém optar). Nunca lança.
- **UI de opt-in**: Configurações → "Notificações push" (aparece com a flag
  `push_notifications` ligada).

## Passos para ativar (uma vez)

1. **Gerar a chave VAPID** — Firebase Console → Configurações do projeto →
   **Cloud Messaging** → *Web configuration* → **Web Push certificates** →
   *Generate key pair*. Copie a chave pública.
2. **Definir a env de build** `VITE_FIREBASE_VAPID_KEY` com essa chave:
   - no GitHub Actions (secret + passar como env no passo de build), e
   - localmente, se for testar (`.env`).
   Sem essa env, o card de push aparece como "em configuração" e nada é
   registrado.
3. **Deploy** — o push das regras (`push_tokens`) e da função
   (`pushOnNotificationCreate`) sai no deploy automático (push em `main`). O
   novo `firebase-messaging-sw.js` também vai junto (Firebase Hosting).
4. **Ligar a flag** `push_notifications` em `/admin` → Funcionalidades.
5. **Cada atleta** ativa em **Configurações → Notificações push** e concede a
   permissão do navegador.

A partir daí, toda notificação in-app (avisos de torneio, convites de dupla,
mensagens, eventos de clube etc.) também chega como **push** para quem optou.

## Eventos específicos (follow-up opcional)

O push espelha as notificações que **já existem**. Para os avisos citados que
ainda **não** geram notificação in-app hoje — "o sorteio saiu", "resultado
lançado", "reserva confirmada", "seu jogo é amanhã" — basta criar a notificação
correspondente no fluxo (via `createNotification`/`notifyUsers`) ou uma função
agendada (para "jogo amanhã"). Foram deixados fora desta entrega por tocarem
fluxos críticos (sorteio/resultado/reserva) — adicioná-los é incremental e
seguro, um de cada vez, quando você quiser.
