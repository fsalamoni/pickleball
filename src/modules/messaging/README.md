# `messaging/` — Avisos por e-mail, WhatsApp, SMS e push

Leva o aviso do sino para fora da plataforma, conforme o que o admin ligou e o
que cada pessoa escolheu. Flag `external_messaging` (padrão DESLIGADA). Doc
completo: [`docs/49-AVISOS-POR-EMAIL-E-CELULAR.md`](../../../docs/49-AVISOS-POR-EMAIL-E-CELULAR.md).

## Onde está
- **Servidor (quem envia)**: `functions/messaging.js` (motor),
  `messagingPolicy.js` (regra pura), `messagingProviders.js` (SES, Resend,
  WhatsApp, Twilio, Zenvia), `messagingTemplates.js`, `messagingAdmin.js`.
- **Domain**: `policy.js` (cópia da regra do servidor — paridade em
  `functions/messagingPolicy.parity.test.js`; mexer num lado só quebra o teste),
  `meta.js` (rótulos, motivos, estados), `guides.js` (os passo a passo do
  painel: domínio, SES, Resend, WhatsApp, Twilio, Zenvia, push).
- **Services**: `messagingService.js` — configuração (`platform_settings/messaging`),
  ações do painel (`messagingAdmin`) e da pessoa (`messagingUser`), escolhas
  (`users.notification_channels`, por caminho com ponto), e-mail de senha e de
  confirmação pelo nosso provedor com volta ao Firebase.
- **Hooks**: `useMessaging.js` (`messagingKeys`, estado do painel, salvar,
  nomes públicos dos remetentes bloqueados).
- **Telas**: Painel admin → Comunicações (`v2/components/admin/messaging/`, 9
  abas) e Configurações → "E-mail e celular"
  (`v2/components/settings/MessagingSettingsCard.jsx`, `#email-e-celular`).
  O aviso em massa (`AdminBroadcastTab`) escolhe os canais.

## O que não pode regredir
- O servidor decide pela ORIGEM do aviso (`origin`, `sent_by`, `broadcast`),
  e a regra trava esses campos. Nunca grave `origin`/`essential` do cliente.
- Segredos só em `platform_secrets` (ninguém lê pelo cliente); o painel vê só
  "configurada".
- O celular confirmado (`users.phone_verified_number`) só o servidor grava.
- Coleção `message_*` nova entra na exclusão e na exportação
  (`exclusaoCobreColecoes.test.js`).
