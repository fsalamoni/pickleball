/**
 * AVISOS POR E-MAIL E CELULAR — os guias passo a passo do painel admin.
 *
 * Cada guia é uma lista de passos `{ title, body, link? }` com o que fazer
 * FORA da plataforma (comprar o domínio, criar a conta no provedor, gerar a
 * chave) e o que fazer aqui. Os nomes de menu dos provedores são os da
 * interface em inglês, que é como eles aparecem para todo mundo.
 */
import { tk } from '@/core/i18n';

export const GUIDE_DOMAIN = Object.freeze([
  {
    title: tk('Compre o domínio'),
    body: tk('Para .com.br, compre no Registro.br; para .com, em qualquer registrador (Cloudflare, GoDaddy, Namecheap, Hostinger). O domínio do site e o dos e-mails podem ser o mesmo: os avisos saem de um endereço como avisos@seudominio.com.br, e nada disso muda o endereço do site.'),
    link: { href: 'https://registro.br', label: tk('Abrir o Registro.br') },
  },
  {
    title: tk('Saiba onde fica o DNS do domínio'),
    body: tk('É lá que você vai colar os registros que a plataforma mostrar. No Registro.br, é o painel do próprio domínio (Editar zona) enquanto você usar o DNS deles; se você apontou o domínio para a Cloudflare, é na Cloudflare.'),
  },
  {
    title: tk('Escreva o domínio aqui e salve'),
    body: tk('Só o domínio, sem "www" e sem "https://" (ex.: picklerush.com.br). Depois escolha o provedor e cole as chaves dele.'),
  },
  {
    title: tk('Clique em "Preparar o domínio"'),
    body: tk('A plataforma cadastra o domínio no provedor e mostra os registros DNS que ele exige. Pode clicar de novo sem medo: o que já existe é reaproveitado.'),
  },
  {
    title: tk('Copie cada registro para o DNS'),
    body: tk('Tipo, nome e valor exatamente como aparecem. Atenção: alguns painéis já completam o domínio sozinhos — se o nome mostrado for "abc._domainkey.seudominio.com.br", nesses painéis você escreve só "abc._domainkey". Na Cloudflare, deixe o registro como "DNS only" (nuvem cinza).'),
  },
  {
    title: tk('Clique em "Verificar agora"'),
    body: tk('O DNS costuma valer em minutos, mas pode levar até 72 horas. Enquanto não verificar, nenhum e-mail sai — e o painel diz qual registro ainda falta.'),
  },
]);

export const GUIDE_SES = Object.freeze([
  {
    title: tk('Crie a conta na AWS'),
    body: tk('Em aws.amazon.com, crie a conta e ligue a verificação em duas etapas (MFA) no usuário principal. A cobrança é por uso: cerca de US$ 0,10 a cada mil e-mails.'),
    link: { href: 'https://aws.amazon.com/ses/', label: tk('Abrir a Amazon SES') },
  },
  {
    title: tk('Escolha a região'),
    body: tk('No canto de cima do console, escolha "South America (São Paulo) sa-east-1" e use a mesma região aqui no campo Região. Tudo o que for criado fica nessa região.'),
  },
  {
    title: tk('Crie um usuário só para a plataforma'),
    body: tk('No console, abra IAM → Users → Create user. Nome: picklerush-email, sem acesso ao console. Em "Set permissions", escolha "Attach policies directly" e marque AmazonSESFullAccess e AmazonSNSFullAccess (a segunda é a que deixa a plataforma criar sozinha o canal de devoluções e reclamações).'),
    link: { href: 'https://console.aws.amazon.com/iam/home#/users', label: tk('Abrir o IAM') },
  },
  {
    title: tk('Gere a chave de acesso'),
    body: tk('No usuário criado: Security credentials → Create access key → "Application running outside AWS". Copie o Access key ID (começa com AKIA) e o Secret access key — o segredo só aparece uma vez.'),
  },
  {
    title: tk('Cole as duas chaves aqui e salve'),
    body: tk('Elas ficam num documento que só o servidor lê; o painel mostra apenas "configurada" e o fim do Access key ID. Depois: domínio, "Preparar o domínio", registros DNS e "Verificar agora" (guia do domínio).'),
  },
  {
    title: tk('Peça o acesso de produção'),
    body: tk('Toda conta nova da SES nasce em modo de teste (sandbox): só entrega para endereços verificados, no máximo 200 por dia. No console da SES: Account dashboard → Request production access. Tipo de e-mail: Transactional; site: o endereço do PickleRush; e explique o uso com o texto sugerido abaixo. A resposta costuma vir em até 24 horas.'),
    link: { href: 'https://console.aws.amazon.com/ses/home#/account', label: tk('Abrir o painel da conta SES') },
  },
  {
    title: tk('Teste e ligue'),
    body: tk('Mande o e-mail de teste para você, confira a caixa de entrada (e o spam) e só então ligue o canal.'),
  },
]);

/** Texto sugerido para o pedido de produção da SES (o admin copia). Em inglês de propósito: é lido pela AWS. */
export const SES_PRODUCTION_REQUEST = 'PickleRush is a platform for amateur pickleball players, clubs, arenas and coaches in Brazil. We send only transactional notifications that users opt into in their account settings: booking confirmations, tournament and game day updates, lesson reminders, messages from other players, and account notices. Every email has a one-click unsubscribe link (RFC 8058) and a link to the user preferences. Bounces and complaints are received through Amazon SNS and the address is suppressed automatically. Marketing emails are sent only to users who explicitly opted in. Expected volume: up to 5,000 emails per day.';

export const GUIDE_RESEND = Object.freeze([
  {
    title: tk('Crie a conta no Resend'),
    body: tk('Em resend.com. O plano gratuito manda até 3 mil e-mails por mês (100 por dia); acima disso, o plano pago começa em US$ 20 por mês.'),
    link: { href: 'https://resend.com', label: tk('Abrir o Resend') },
  },
  {
    title: tk('Gere a chave da API'),
    body: tk('API Keys → Create API Key. Permissão: Full access (a plataforma precisa cadastrar e verificar o domínio). Copie a chave, que começa com re_ e só aparece uma vez.'),
  },
  {
    title: tk('Cole a chave aqui, escolha a região e salve'),
    body: tk('A região é onde o Resend guarda o domínio; São Paulo (sa-east-1) deixa o envio mais perto das pessoas. Depois: domínio, "Preparar o domínio", registros DNS e "Verificar agora" (guia do domínio).'),
  },
  {
    title: tk('Crie o webhook de retorno'),
    body: tk('Webhooks → Add Endpoint. Endpoint URL: o endereço mostrado logo abaixo. Eventos: email.delivered, email.bounced, email.complained e email.delivery_delayed. Salve e copie o Signing secret (começa com whsec_) para o campo "Segredo do webhook". Sem ele, a plataforma não sabe de devolução nem de reclamação — e continuaria mandando para quem reclamou.'),
  },
  {
    title: tk('Teste e ligue'),
    body: tk('Mande o e-mail de teste para você, confira a caixa de entrada (e o spam) e só então ligue o canal.'),
  },
]);

export const GUIDE_WHATSAPP = Object.freeze([
  {
    title: tk('Tenha uma conta empresarial na Meta'),
    body: tk('Em business.facebook.com, crie (ou use) o portfólio empresarial do PickleRush e faça a verificação da empresa (Security center → Start verification), com CNPJ e um documento. Sem ela, o número fica com limite baixo de conversas e o nome não aparece.'),
    link: { href: 'https://business.facebook.com', label: tk('Abrir o Meta Business') },
  },
  {
    title: tk('Crie o app e adicione o WhatsApp'),
    body: tk('Em developers.facebook.com: My Apps → Create app → tipo Business (caso de uso: falar com clientes pelo WhatsApp) → ligue ao portfólio → adicione o produto WhatsApp.'),
    link: { href: 'https://developers.facebook.com/apps', label: tk('Abrir os apps da Meta') },
  },
  {
    title: tk('Registre o número que vai mandar'),
    body: tk('WhatsApp → API Setup → Add phone number. Use um número que NÃO esteja no aplicativo do WhatsApp (nem no WhatsApp Business do celular): ele passa a ser só da API. Confirme por SMS ou ligação e cadastre o nome de exibição (PickleRush), que a Meta aprova.'),
  },
  {
    title: tk('Copie os dois identificadores'),
    body: tk('Na mesma tela (API Setup): Phone number ID e WhatsApp Business Account ID. Cole nos campos abaixo e salve.'),
  },
  {
    title: tk('Gere o token permanente'),
    body: tk('O token da tela API Setup vence em 24 horas — não use. Em Business settings → Users → System users → Add (função Admin) → Assign assets: o app e a conta do WhatsApp, com controle total → Generate new token → escolha o app, validade "Never" e as permissões whatsapp_business_messaging e whatsapp_business_management. Copie e cole em "Token de acesso".'),
    link: { href: 'https://business.facebook.com/settings/system-users', label: tk('Abrir os usuários do sistema') },
  },
  {
    title: tk('Copie o segredo do app'),
    body: tk('No app: App settings → Basic → App secret → Show. É com ele que a plataforma confere que os retornos vieram mesmo da Meta. Cole em "Segredo do app".'),
  },
  {
    title: tk('Ligue o webhook'),
    body: tk('Clique em "Gerar token de verificação" aqui. No app: WhatsApp → Configuration → Webhook → Edit. Callback URL: o endereço mostrado abaixo; Verify token: o que a plataforma gerou. Clique em Verify and save e, em Webhook fields, assine "messages". É por ele que chegam a entrega, a falha e o PARAR.'),
  },
  {
    title: tk('Crie os modelos de mensagem'),
    body: tk('Clique em "Criar os modelos na Meta". A plataforma cria o modelo de aviso (categoria Utilidade) e o de código (Autenticação) em português, inglês e espanhol. A Meta analisa em minutos ou em até 24 horas; use "Conferir na Meta" para ver o resultado.'),
  },
  {
    title: tk('Cadastre a forma de pagamento'),
    body: tk('No WhatsApp Manager → Payment settings, adicione o cartão. A Meta cobra por mensagem de modelo entregue; confira a tabela do Brasil e coloque o valor de cada mensagem em "Custo por mensagem", para o orçamento do mês ficar certo.'),
    link: { href: 'https://developers.facebook.com/docs/whatsapp/pricing', label: tk('Ver os preços da Meta') },
  },
  {
    title: tk('Teste e ligue'),
    body: tk('Mande o teste para o seu celular e só então ligue o canal. As pessoas só recebem por WhatsApp depois de confirmar o número e dizer "sim" nas Configurações.'),
  },
]);

export const GUIDE_TWILIO = Object.freeze([
  {
    title: tk('Crie a conta e saia do modo de teste'),
    body: tk('Em twilio.com, crie a conta e adicione saldo (Upgrade). No modo de teste a Twilio só entrega para números que você verificou.'),
    link: { href: 'https://console.twilio.com', label: tk('Abrir o console da Twilio') },
  },
  {
    title: tk('Copie o Account SID e o Auth Token'),
    body: tk('Na página inicial do console, em Account Info. O Account SID começa com AC. Cole os dois aqui e salve.'),
  },
  {
    title: tk('Tenha um remetente'),
    body: tk('Phone Numbers → Buy a number, com SMS. Recomendado: crie um Messaging Service (Messaging → Services) e coloque o número nele — aí o remetente é o SID do serviço (começa com MG). Sem serviço, o remetente é o número no formato +15550001111.'),
  },
  {
    title: tk('Ligue as respostas (PARAR)'),
    body: tk('No número (ou no Messaging Service), em "A message comes in", escolha Webhook, cole o endereço mostrado abaixo e método HTTP POST. É assim que quem responde PARAR deixa de receber. O retorno de entrega já vai junto com cada SMS, sem configurar nada.'),
  },
  {
    title: tk('Teste e ligue'),
    body: tk('Mande o teste para o seu celular, coloque o custo por SMS (a Twilio mostra o preço por país) e só então ligue o canal.'),
  },
]);

export const GUIDE_ZENVIA = Object.freeze([
  {
    title: tk('Crie a conta e contrate o SMS'),
    body: tk('Em zenvia.com, crie a conta e ative o canal de SMS. A Zenvia é brasileira: entrega bem para números do Brasil e cobra em reais.'),
    link: { href: 'https://app.zenvia.com', label: tk('Abrir a Zenvia') },
  },
  {
    title: tk('Gere o token da API'),
    body: tk('No console: Developers (ou Integrações) → Tokens e Webhooks → criar token. Copie e cole em "Token da API".'),
  },
  {
    title: tk('Informe o remetente'),
    body: tk('É o identificador do canal de SMS da sua conta (Channels → SMS), como aparece no console. Cole em "Remetente".'),
  },
  {
    title: tk('Saiba como fica o PARAR'),
    body: tk('Com a Zenvia, as respostas não voltam para a plataforma. Quem não quiser mais receber desliga o SMS em Configurações; se alguém pedir por outro caminho, desligue pelo "Por que não chegou?" ou peça para a pessoa desligar.'),
  },
  {
    title: tk('Teste e ligue'),
    body: tk('Mande o teste para o seu celular, coloque o custo por SMS do seu contrato e só então ligue o canal.'),
  },
]);

export const GUIDE_PUSH = Object.freeze([
  {
    title: tk('Abra o Cloud Messaging do Firebase'),
    body: tk('Console do Firebase → engrenagem → Project settings → aba Cloud Messaging → Web configuration → Web Push certificates.'),
    link: { href: 'https://console.firebase.google.com/project/_/settings/cloudmessaging', label: tk('Abrir o Firebase') },
  },
  {
    title: tk('Use o par de chaves que já existe, ou gere um'),
    body: tk('Atenção: o projeto do Firebase é dividido com outro aplicativo. Se já houver um par de chaves na lista, use esse mesmo — gerar outro pode parar o push do outro aplicativo. Só clique em "Generate key pair" se a lista estiver vazia.'),
  },
  {
    title: tk('Copie a chave pública e cole aqui'),
    body: tk('É o texto longo da coluna "Key pair" (87 caracteres, começa com B). Não use a chave privada (o "Show private key"). Salve. A partir daí, as pessoas veem "Ativar notificações push" nas Configurações e escolhem por área o que chega no aparelho.'),
  },
  {
    title: tk('Teste neste aparelho'),
    body: tk('Logo abaixo: "Ativar o push neste aparelho" e depois "Mandar um push de teste para mim". Se a notificação aparecer, está tudo certo. Se o Firebase recusar, a mensagem diz o motivo (quase sempre a chave de outro projeto).'),
  },
]);
