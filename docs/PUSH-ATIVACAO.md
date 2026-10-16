# Notificações push (PWA/FCM) — como ativar

O push já está **implementado e no ar**, porém **inerte** por segurança: nada
acontece até você concluir os passos abaixo. Enquanto não ativar, a plataforma
segue exatamente como está (nenhum token é registrado, nenhum push é enviado).

## O que já foi entregue

- **Cliente** (`src/core/services/pushService.js`): opt-in do atleta (pede
  permissão, registra o token FCM em `push_tokens`). Gracioso — no-op sem VAPID,
  sem suporte do navegador ou sem permissão.
- **Service worker do push** (`public/firebase-messaging-sw.js`): recebe o push
  e trata o toque. É **separado** do `sw.js` do PWA e só é registrado quando o
  atleta opta. **Não usa o SDK do Firebase**: a URL reservada
  `/__/firebase/init.js` desta hospedagem não traz `appId`, o SDK exige e
  quebrava ao iniciar — o aviso não aparecia (o navegador mostrava só "o site
  foi atualizado em segundo plano"). Ele lê o corpo JSON do FCM sozinho
  (`notification`, `data`, `fcmOptions.link`); com o app aberto e à vista, o
  aviso fica no sino. Teste em `src/core/services/pushWorker.test.js`.
- **Renovação** (`src/core/lib/usePushNoAparelho.js`, montado no `V2Layout`):
  para quem ativou o push NESTE aparelho (marca `picklerush:push:<uid>` ou o
  token deste aparelho já gravado em nome da conta), atualiza o service worker
  e regrava o token ao abrir o app. Também recebe o toque na notificação com o
  app aberto e navega pelo crivo `destinoDeAviso` (o SW do push não controla
  as páginas e não consegue navegar por elas). O código do push só é baixado
  por quem ativou.
- **Coleção `push_tokens`** + regra no `firestore.rules` (cada usuário gerencia
  só os próprios tokens).
- **Cloud Function `pushOnNotificationCreate`**: espelha cada notificação in-app
  (coleção `notifications`) para os tokens do usuário. Retorna cedo se não houver
  tokens (o normal até alguém optar). Nunca lança.
- **UI de opt-in**: Configurações → "Notificações push". "Ativo" = permissão do
  navegador **e** o registro desta conta neste aparelho; "Desativar" apaga só o
  token deste aparelho (os outros seguem recebendo).

## Passos para ativar (uma vez)

1. **Pegar a chave VAPID** — Firebase Console → Configurações do projeto →
   **Cloud Messaging** → *Web configuration* → **Web Push certificates**.
   Copie a chave **pública** (coluna *Key pair*: 87 caracteres, começa com B).
   O painel recusa a privada (43 caracteres) e qualquer outro formato
   (`vapidKeyProblem`).
2. **Colar a chave pública** em **Painel admin → Comunicações → Push** (grava
   `platform_settings/messaging.push.vapid_public_key`, leitura pública; o
   navegador lê na hora, sem novo build). A env de build
   `VITE_FIREBASE_VAPID_KEY`, se existir, vence a do painel. Sem nenhuma das
   duas, o card de push aparece como "em configuração" e nada é registrado.
   ⚠️ O projeto Firebase é compartilhado com outro app: se já existir um par
   de chaves em *Web Push certificates*, **use o existente** — gerar outro
   invalida as inscrições do outro app.
3. **Testar** — na mesma aba: **Ativar o push neste aparelho** e **Mandar um
   push de teste para mim** (`messagingAdmin` → `push_test`, manda só para os
   aparelhos do próprio admin, aparece mesmo com a tela aberta). Se o
   navegador ou o Firebase recusar, a aba diz o motivo (`PUSH_FAILURE_META`,
   `PUSH_TEST_ERROR_META`) — quase sempre a chave de outro projeto do Firebase
   ou a chave de API do app bloqueando a "Firebase Installations API" / "FCM
   Registration API". O Resumo mostra o push como **Configurado** assim que a
   chave está salva, e quantos aparelhos têm o push ativo.
4. ~~Ligar a flag `push_notifications`~~ — não é mais preciso: incorporada em
   2026-10-10 (`PERMANENT_FEATURE`, sempre ligada).
5. **Cada atleta** ativa em **Configurações → Notificações push** e concede a
   permissão do navegador.

Com a flag `external_messaging` ligada, o push também obedece às escolhas
por área e ao horário de silêncio (Configurações → "E-mail e celular"); ver
`docs/49-AVISOS-POR-EMAIL-E-CELULAR.md`.

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
