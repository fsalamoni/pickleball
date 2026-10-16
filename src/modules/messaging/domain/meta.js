/**
 * AVISOS POR E-MAIL E CELULAR — os textos do painel e das Configurações.
 *
 * Rótulos e explicações (marcados com `tk`, traduzidos no render com `t`) de
 * canais, modos, motivos de decisão, pendências, alertas e estados de envio.
 * Os GUIAS passo a passo de cada provedor estão em `guides.js`.
 */
import { tk } from '@/core/i18n';

export const CHANNEL_META = Object.freeze({
  email: { label: tk('E-mail'), hint: tk('Sai do seu domínio (ex.: avisos@picklerush.com.br), pela Amazon SES ou pelo Resend.') },
  whatsapp: { label: tk('WhatsApp'), hint: tk('Mensagem com modelo aprovado pela Meta, pela API oficial do WhatsApp (Cloud API).') },
  sms: { label: tk('SMS'), hint: tk('Torpedo comum, pela Twilio ou pela Zenvia. É o canal mais caro: use para o que tem prazo.') },
  push: { label: tk('Push'), hint: tk('Notificação no aparelho, mesmo com o app fechado (Firebase Cloud Messaging). Não tem custo por envio.') },
});

/** Como o e-mail chega, por área (a escolha da pessoa e o padrão do admin). */
export const EMAIL_MODE_META = Object.freeze({
  imediato: { label: tk('Na hora'), hint: tk('Um e-mail para cada aviso, assim que ele acontece.') },
  diario: { label: tk('Resumo do dia'), hint: tk('Um e-mail por dia juntando os avisos, no horário do resumo.') },
  semanal: { label: tk('Resumo da semana'), hint: tk('Um e-mail por semana juntando os avisos, no dia e horário do resumo.') },
  nao: { label: tk('Não receber'), hint: tk('Esta área não vai por e-mail.') },
});

/** O que o ADMIN decide para cada área em cada canal. */
export const AREA_MODE_META = Object.freeze({
  off: { label: tk('Desligado'), hint: tk('Nunca sai por este canal. A pessoa não vê a opção.') },
  optional: { label: tk('A pessoa escolhe'), hint: tk('Vale o padrão abaixo até a pessoa mudar nas Configurações dela.') },
  always: { label: tk('Sempre'), hint: tk('Sai mesmo que a pessoa tenha desligado. Use só para o que é indispensável (conta, pagamento). Promoções nunca podem ser "Sempre".') },
});

/**
 * Por que um aviso foi (ou não foi) por um canal. É o texto de "por que não
 * chegou?" no painel e o motivo gravado no registro de envios.
 */
export const DECISION_REASON = Object.freeze({
  flag_off: tk('A funcionalidade está desligada (Painel admin → Funcionalidades → Avisos por e-mail e celular).'),
  channel_off: tk('O canal está desligado no painel (Comunicações).'),
  no_domain: tk('O domínio de e-mail ainda não foi informado.'),
  not_ready: tk('O canal ainda não está pronto: falta alguma etapa da configuração.'),
  no_channel_ready: tk('Nenhum canal estava pronto quando o aviso foi criado.'),
  legacy_notice: tk('Aviso de uma versão antiga do aplicativo, sem remetente conhecido: fica só no sino e no push.'),
  not_in_broadcast: tk('Aviso em massa enviado sem este canal marcado.'),
  no_user: tk('A conta não existe mais.'),
  account_closed: tk('A conta está suspensa ou bloqueada (só avisos essenciais chegam).'),
  no_email: tk('A conta não tem e-mail.'),
  email_unverified: tk('O e-mail da pessoa ainda não foi confirmado. Ela confirma em Configurações → E-mail e celular.'),
  phone_unverified: tk('A pessoa não confirmou um celular.'),
  essential: tk('Aviso essencial da conta: chega mesmo com tudo desligado.'),
  area_off_admin: tk('O admin desligou esta área para este canal (Comunicações → O que vai por onde).'),
  no_marketing_consent: tk('Promoção e novidade só para quem aceitou receber novidades.'),
  channel_off_user: tk('A pessoa desligou os e-mails.'),
  no_opt_in: tk('A pessoa não ligou este canal (WhatsApp e SMS só com o "sim" dela).'),
  area_off_user: tk('A pessoa desligou esta área neste canal.'),
  sender_blocked: tk('A pessoa bloqueou quem mandou este aviso.'),
  digest: tk('Vai no resumo (diário ou semanal), como a pessoa escolheu.'),
  wait_unread: tk('Mensagem de conversa: espera alguns minutos para ver se a pessoa lê no aplicativo.'),
  read_in_app: tk('A pessoa leu no aplicativo antes do envio: o e-mail não foi preciso.'),
  quiet_hours: tk('Horário silencioso: sai quando ele acabar.'),
  chosen: tk('Enviado conforme a escolha da pessoa (ou o padrão).'),
  admin_always: tk('Enviado porque o admin marcou esta área como "Sempre".'),
  cap_user: tk('A pessoa já recebeu o máximo de mensagens do dia por este canal.'),
  cap_sender: tk('Quem mandou já passou do limite de e-mails do dia.'),
  cap_pair: tk('Limite do dia entre o mesmo remetente e a mesma pessoa.'),
  budget: tk('O orçamento do mês para WhatsApp e SMS acabou.'),
  budget_unknown: tk('Não foi possível conferir o orçamento do mês; por segurança, não enviou.'),
  suppressed: tk('O endereço está na lista de bloqueio (devolução, reclamação ou PARAR).'),
  complaint: tk('O endereço está na lista de bloqueio (reclamação de spam).'),
  bounce: tk('O endereço está na lista de bloqueio (e-mail não existe ou recusou).'),
  stop: tk('A pessoa respondeu PARAR.'),
  retry: tk('Falha temporária no provedor: vai tentar de novo.'),
  notice_deleted: tk('O aviso foi apagado antes do envio.'),
  error: tk('O provedor recusou o envio.'),
  test: tk('Envio de teste.'),
  verification: tk('Código de confirmação do celular.'),
  login: tk('E-mail de "esqueci a senha".'),
  verify: tk('E-mail para confirmar o endereço.'),
  user_test: tk('E-mail de teste pedido pela pessoa.'),
});

/** O que falta em cada canal (de `missing`, no servidor) e onde se resolve. */
export const MISSING_META = Object.freeze({
  email: {
    disabled: { label: tk('Ligar o canal de e-mail'), tab: 'com-email' },
    domain: { label: tk('Informar o domínio'), tab: 'com-email' },
    credentials: { label: tk('Colar as chaves do provedor'), tab: 'com-email' },
    dns: { label: tk('Publicar os registros DNS e verificar o domínio'), tab: 'com-email' },
  },
  whatsapp: {
    disabled: { label: tk('Ligar o canal de WhatsApp'), tab: 'com-whatsapp' },
    ids: { label: tk('Informar o Phone number ID e o WhatsApp Business Account ID'), tab: 'com-whatsapp' },
    credentials: { label: tk('Colar o token de acesso'), tab: 'com-whatsapp' },
    templates: { label: tk('Ter o modelo de aviso aprovado pela Meta'), tab: 'com-whatsapp' },
  },
  sms: {
    disabled: { label: tk('Ligar o canal de SMS'), tab: 'com-sms' },
    sender: { label: tk('Informar o remetente'), tab: 'com-sms' },
    credentials: { label: tk('Colar as chaves do provedor'), tab: 'com-sms' },
  },
});

export const ALERT_META = Object.freeze({
  complaint_rate: { label: tk('Reclamações de spam acima do limite neste mês. Reveja o que está saindo por e-mail (Regras) antes que o provedor suspenda a conta.') },
  bounce_rate: { label: tk('Muitos e-mails devolvidos neste mês (4% ou mais). Endereços que não existem entram na lista de bloqueio sozinhos; se continuar, confira os cadastros.') },
  budget: { label: tk('O gasto com WhatsApp e SMS chegou a 80% do orçamento do mês. Ao passar de 100%, esses canais param até o mês virar ou você aumentar o orçamento.') },
  ses_sandbox: { label: tk('A conta da Amazon SES ainda está no modo de teste (sandbox): só entrega para endereços verificados, no máximo 200 por dia. Peça o acesso de produção (aba E-mail, passo 6).') },
  open_reports: { label: tk('Há denúncias de e-mail esperando a sua análise (aba Entregas).') },
});

/** Estado de cada envio no registro. */
export const OUTBOX_STATUS_META = Object.freeze({
  sending: { label: tk('Enviando'), tone: 'neutral' },
  queued: { label: tk('Na fila'), tone: 'neutral' },
  sent: { label: tk('Enviado'), tone: 'success' },
  delivered: { label: tk('Entregue'), tone: 'success' },
  delayed: { label: tk('Atrasado'), tone: 'warning' },
  digest_daily: { label: tk('No resumo do dia'), tone: 'neutral' },
  digest_weekly: { label: tk('No resumo da semana'), tone: 'neutral' },
  in_digest: { label: tk('Foi no resumo'), tone: 'success' },
  skipped: { label: tk('Não enviado'), tone: 'neutral' },
  capped: { label: tk('Limite atingido'), tone: 'warning' },
  suppressed: { label: tk('Bloqueado'), tone: 'warning' },
  bounced: { label: tk('Devolvido'), tone: 'danger' },
  complained: { label: tk('Marcado como spam'), tone: 'danger' },
  failed: { label: tk('Falhou'), tone: 'danger' },
});

export const OUTBOX_KIND_META = Object.freeze({
  notice: tk('Aviso'),
  digest: tk('Resumo'),
  digest_daily: tk('Resumo do dia'),
  digest_weekly: tk('Resumo da semana'),
  test: tk('Teste do admin'),
  verification: tk('Código do celular'),
  login: tk('Esqueci a senha'),
  verify: tk('Confirmar e-mail'),
  user_test: tk('Teste da pessoa'),
});

/** Para que serve cada registro DNS (o painel explica antes de pedir para copiar). */
export const DNS_PURPOSE_META = Object.freeze({
  dkim: tk('Assinatura (DKIM): prova que o e-mail saiu mesmo do seu domínio.'),
  mail_from: tk('Retorno (MAIL FROM): por onde voltam as devoluções. Fica num subdomínio, não mexe no seu e-mail de caixa.'),
  spf: tk('Autorização (SPF): diz quem pode mandar e-mail em nome do domínio.'),
  dmarc: tk('Política (DMARC): o que os provedores fazem com e-mail que falha nas verificações. Começa em "p=none" (só observar).'),
  receiving: tk('Recebimento: só é preciso se você for receber e-mail por este provedor.'),
});

export const SUPPRESSION_REASON_META = Object.freeze({
  complaint: tk('Reclamação de spam'),
  bounce: tk('Endereço inexistente'),
  stop: tk('Respondeu PARAR'),
  suppressed: tk('Bloqueado'),
});

/** Estado do DKIM / MAIL FROM (Amazon) e do domínio (Resend). */
export const DNS_CHECK_META = Object.freeze({
  SUCCESS: tk('Verificado'),
  PENDING: tk('Esperando o DNS'),
  FAILED: tk('Falhou'),
  TEMPORARY_FAILURE: tk('Falha temporária'),
  NOT_STARTED: tk('Não começou'),
  verified: tk('Verificado'),
  pending: tk('Esperando o DNS'),
  not_started: tk('Não começou'),
  failed: tk('Falhou'),
  temporary_failure: tk('Falha temporária'),
});

export const WA_TEMPLATE_STATUS_META = Object.freeze({
  APPROVED: tk('Aprovado'),
  PENDING: tk('Em análise pela Meta'),
  REJECTED: tk('Recusado'),
  PAUSED: tk('Pausado pela Meta'),
  DISABLED: tk('Desativado'),
  IN_APPEAL: tk('Em recurso'),
});

/** O que acontece com o aviso num canal ("por que não chegou?"). */
export const DECISION_ACTION_META = Object.freeze({
  send: { label: tk('Vai'), tone: 'green' },
  digest_daily: { label: tk('No resumo do dia'), tone: 'blue' },
  digest_weekly: { label: tk('No resumo da semana'), tone: 'blue' },
  delay: { label: tk('Espera'), tone: 'amber' },
  skip: { label: tk('Não vai'), tone: 'neutral' },
});

/** Dias da semana do resumo semanal (0 = domingo, como o servidor conta). */
export const WEEKDAY_LABELS = Object.freeze([
  tk('Domingo'), tk('Segunda-feira'), tk('Terça-feira'), tk('Quarta-feira'), tk('Quinta-feira'), tk('Sexta-feira'), tk('Sábado'),
]);
