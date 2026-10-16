# 49 — Avisos por e-mail, WhatsApp, SMS e push

> **Estado**: implementado atrás da flag `external_messaging` (padrão
> DESLIGADA). Com a flag desligada nada sai da plataforma e o push segue como
> sempre. Cada canal tem, além da flag, o próprio interruptor no painel.

O aviso continua nascendo do mesmo jeito: um documento em `notifications`
(sino). O que muda é que o servidor, ao ver o aviso novo, decide se ele também
sai por **e-mail** (Amazon SES ou Resend), **WhatsApp** (Cloud API da Meta) ou
**SMS** (Twilio ou Zenvia), e o **push** passa a obedecer às mesmas escolhas
por área.

## 1. Como ligar (o caminho do admin)

Tudo em **Painel admin → Comunicações**. A aba **Resumo** mostra a ordem e o
que falta em cada canal.

1. **E-mail** — escolha o provedor (SES ou Resend), cole as chaves (guia passo
   a passo na própria aba), digite o **domínio** comprado, toque em **Preparar
   o domínio**, copie os registros DNS para o registrador, toque em **Verificar
   agora** até tudo ficar verde, preencha o remetente e mande um teste. Só
   então o interruptor do canal liga. O domínio pode ficar para depois: sem
   ele o canal simplesmente não sai.
2. **WhatsApp** — IDs do número e da conta (WABA), token de acesso e "app
   secret", URL de retorno + token de verificação (gerado no painel, mostrado
   uma vez), **Criar os modelos** e esperar a Meta aprovar.
3. **SMS** — Twilio ou Zenvia, chaves, remetente, custo por mensagem.
4. **Push** — a chave pública VAPID (antes era só variável de build). O
   projeto Firebase é compartilhado com outro app: **reaproveite o par de
   chaves existente**, nunca gere outro (o guia diz isso).
5. **Regras** — por área × canal: desligado / a pessoa escolhe / sempre, e o
   padrão de quem nunca mexeu. Horário de silêncio, hora do resumo, espera do
   chat, canal do código do celular.
6. **Limites e custos** — tetos por pessoa/dia, por remetente, por par,
   orçamento mensal (WhatsApp + SMS) e alerta de reclamação.
7. Ligar a chave geral (`external_messaging`) no Resumo ou em Funcionalidades.

**Modelos** mostra a prévia de cada mensagem (HTML, texto, WhatsApp, SMS) em
cada idioma. **Entregas** tem "por que não chegou?" (a decisão de cada canal
para uma pessoa), o registro de envios, a lista de bloqueio e as denúncias.

## 2. A pessoa (Configurações → "E-mail e celular")

`MessagingSettingsCard` (`#email-e-celular`, só com a flag): confirmar o
e-mail, cadastrar o celular por código de 6 números (WhatsApp ou SMS, 10 min,
5 tentativas), ligar cada canal pronto, escolher por área (e-mail: na hora /
resumo do dia / da semana / não; celular e push: sim/não), novidades e
promoções (consentimento próprio), horário de silêncio (opcionalmente também
no push) e desbloquear remetentes. Cadeado = escolha travada pelo admin.

## 3. Peças

| Onde | O quê |
|---|---|
| `functions/messagingPolicy.js` | Regra PURA: configuração normalizada, escolhas da pessoa, `classifyNotice`, `decideChannel`, `pushAllowed`, `capReason`, telefone, máscaras. Cópia no cliente em `src/modules/messaging/domain/policy.js` (paridade em `functions/messagingPolicy.parity.test.js`) |
| `functions/messagingProviders.js` | Só HTTP com os provedores, por `fetch` (zero dependência nova). AWS Signature V4 própria, conferida contra o exemplo da AWS |
| `functions/messagingTemplates.js` | E-mail (HTML + texto), WhatsApp e SMS em pt/en/es, rodapé com descadastro e denúncia |
| `functions/messaging.js` | O motor: `handleNotice`, `processQueue`, `handleHttp` (retornos e páginas) |
| `functions/messagingAdmin.js` | Ações do painel (`adminAction`), da pessoa (`userAction`) e o e-mail de senha (`authEmailAction`) |
| `src/modules/messaging/` | `domain/` (policy, meta, guides), `services/messagingService.js`, `hooks/useMessaging.js` |
| `src/v2/components/admin/messaging/` | O painel Comunicações (9 abas) |
| `src/v2/components/settings/MessagingSettingsCard.jsx` | O cartão da pessoa |

Funções (`functions/index.js`, codebase `picklerush`): `messagingOnNotificationCreate`
(gatilho em `notifications`), `messagingQueue` (a cada 10 min),
`messagingAdmin` e `messagingUser` (callable), `messagingAuthEmail` (callable
sem login) e `messagingHook` (HTTP público em `/api/mensagens/**`, pelo
`firebase.json`). Detalhes em `docs/47-BACKEND-CLOUD-FUNCTIONS.md`.

## 4. Dados

| Onde | Quem lê / escreve |
|---|---|
| `platform_settings/messaging` | Configuração do admin (sem segredo). Leitura pública, escrita do admin |
| `platform_settings/messaging_status` | Estado do domínio, dos modelos e alertas — o servidor grava |
| `platform_secrets/messaging` e `/messaging_runtime` | Chaves dos provedores e identificadores internos. **Ninguém** pelo cliente (`allow read, write: if false`); o painel vê só "configurada" e o fim do que não é segredo |
| `message_outbox/{aviso}_{canal}` | Registro de envio = fila + base dos tetos e do custo. A pessoa lê o dela (entra na exportação), o admin tudo; só o servidor escreve. Apagado depois de 90 dias |
| `message_suppressions/{sha}` | Endereço/número bloqueado (devolução, reclamação, PARAR, descadastro geral). Ninguém lê pelo cliente |
| `message_reports` | Denúncias do link do rodapé. Só o admin lê |
| `phone_verifications/{uid}` | Código do celular em andamento (só o hash). Ninguém pelo cliente |
| `users/{uid}.notification_channels` | Escolhas da pessoa (dono escreve por caminho com ponto) |
| `users/{uid}.phone_verified_number/_at` | Celular CONFIRMADO. **Só o servidor**: a regra recusa o dono — gravado pelo cliente, mandaria mensagem paga para o número de outra pessoa |
| `notifications.origin/essential/sent_by/broadcast` | Ver §5 |

## 5. Em quem o servidor confia (o que não pode regredir)

O cliente fala direto com o banco, então quem decide é a ORIGEM do aviso:

- `origin: 'server'` — gravado pelo servidor (Admin SDK). A regra **recusa**
  `origin` e `essential` vindos do cliente. Só aviso de servidor pode ser
  `essential` (sai por e-mail mesmo com tudo desligado: conta suspensa,
  bloqueada, reativada).
- `sent_by` — a regra exige que seja a conta logada. Aviso de usuário sai
  com "Enviado por" e botão de denunciar, e os tetos por remetente e por par
  valem por ele.
- Sem nenhum dos dois (app antigo) ⇒ fica só no sino/push.
- `broadcast: { kind, channels }` — só vale do **admin da plataforma** (regra
  + servidor). O aviso em massa sai só pelos canais marcados no
  `AdminBroadcastTab` e não conta nos tetos de remetente/par; "Novidade ou
  promoção" vira a área `promocoes` (consentimento).
- Depois de criado, o titular só marca lido/não lido: `user_id`, `origin`,
  `essential`, `sent_by` e `broadcast` não mudam.

Ordem da decisão (`decideChannel`): flag → canal ligado → domínio → pronto
(chaves, domínio verificado, modelos aprovados) → origem → broadcast → contato
confirmado → essencial → área (admin) → consentimento de promoção → escolha da
pessoa → remetente bloqueado → resumo/espera do chat/silêncio. Depois vêm
supressão, tetos e orçamento. Cada "não" tem motivo, que o "por que não
chegou?" mostra.

## 6. Retornos e páginas (`/api/mensagens/**`)

- `webhook/ses` (SNS, assinatura conferida e URL só da Amazon), `webhook/resend`
  (Svix), `webhook/whatsapp` (assinatura da Meta; GET = verificação),
  `webhook/twilio` (assinatura da Twilio). Entregue/devolvido/reclamação
  atualizam o registro; devolução definitiva e reclamação viram supressão;
  `PARAR`/`SAIR`/`STOP` desligam o canal de todas as contas com o número.
  A Zenvia não devolve as respostas: o guia avisa.
- `sair?t=…` e `denunciar?t=…` — links assinados (HMAC, chave gerada no
  servidor). GET mostra a página, POST confirma (nada muda só por abrir —
  leitores de e-mail abrem links sozinhos). Denunciar bloqueia o remetente.

## 7. Fila, resumos, tetos

`messagingQueue` manda o que esperava (silêncio, chat não lido — se a pessoa
leu no app, não sai), monta o resumo diário na hora configurada e o semanal no
dia escolhido, tenta de novo até 3 vezes e apaga registro com mais de 90
dias. Tetos por dia (Brasília): e-mail por pessoa e por remetente, por par
remetente→pessoa, WhatsApp e SMS por pessoa; orçamento mensal somado de
WhatsApp + SMS (o código do celular também conta).

## 8. E-mails de conta

Com o e-mail pronto e `email.login_emails` ligado, "esqueci a senha" e a
confirmação de e-mail saem pelo nosso provedor e domínio (link gerado pelo
Firebase Auth, até 3 por dia por tipo). Desligado, ou se o envio falhar, vale
o e-mail do Firebase de sempre. **Nunca** mude os modelos de e-mail do
Firebase Auth no console: o projeto é compartilhado com outro app.

## 9. Privacidade

- Exclusão de conta: os registros recebidos saem com a conta (os que ela mandou ficam com quem recebeu, sem o nome); a supressão fica (é o
  "não me mande mais"), mas sem o endereço (`accountDeletion.js`).
- Exportação: o registro do que foi enviado entra (`listMyMessageLog`).
- O guarda `exclusaoCobreColecoes.test.js` cobre as coleções `message_*` e
  `phone_verifications`, com os motivos das isenções escritos.

## 10. Testes

`functions/messaging*.test.js` (motor, provedores, modelos, ações, paridade),
`functions/accountDeletion.mensagens.test.js`,
`tests/rules/messaging.rules.test.js` (emulador) e
`src/modules/athletes/domain/dataExport.test.js`.
