/**
 * Os MODELOS do que sai da plataforma: o e-mail (aviso, resumo, teste,
 * confirmação de e-mail, troca de senha), o texto do WhatsApp e o do SMS.
 *
 * Puro (sem I/O). A moldura é FIXA: o texto do aviso entra escapado, e o
 * texto escrito por uma pessoa perde os links (`defangText`) — o único botão
 * é o do próprio aviso, para dentro do site. Três idiomas (pt, en, es), com o
 * português valendo para o resto.
 */
const { defangText, fromAddress } = require('./messagingPolicy');
const { campoNoIdioma, idiomaDoPush } = require('./avisoI18n');

const COR = { ink: '#0B0F19', acid: '#D4F82E', paper: '#F7F9FC', texto: '#1F2937', suave: '#6B7280', linha: '#E5E7EB' };

const T = {
  pt: {
    abrir: 'Abrir no PickleRush',
    enviadoPor: 'Enviado por {nome}, pelo PickleRush.',
    porque: 'Você recebe este e-mail porque tem conta no PickleRush e deixou ligados os avisos de {area} por e-mail.',
    porqueEssencial: 'Este é um aviso sobre a sua conta e não pode ser desligado.',
    escolher: 'Escolher o que recebo por e-mail',
    sair: 'Não quero mais avisos de {area} por e-mail',
    sairTudo: 'Não quero mais e-mails do PickleRush',
    denunciar: 'Denunciar este e-mail',
    resumoDia: 'Seu resumo do dia no PickleRush',
    resumoSemana: 'Seu resumo da semana no PickleRush',
    resumoIntro: { 1: 'Você tem 1 aviso que ainda não viu.', n: 'Você tem {n} avisos que ainda não viu.' },
    resumoPorque: 'Você recebe este resumo porque escolheu juntar alguns avisos num e-mail só.',
    verTodos: 'Ver todos os avisos',
    testeAssunto: 'Teste de envio do PickleRush',
    testeTitulo: 'Tudo certo com o envio de e-mails',
    testeTexto: 'Se você está lendo isto, o domínio {dominio} e o provedor {provedor} estão funcionando. Este e-mail foi pedido no Painel admin → Comunicações.',
    verificarAssunto: 'Confirme o seu e-mail no PickleRush',
    verificarTitulo: 'Confirme o seu e-mail',
    verificarTexto: 'Toque no botão para confirmar que este endereço é seu. Depois disso os avisos que você escolheu passam a chegar aqui.',
    verificarBotao: 'Confirmar e-mail',
    senhaAssunto: 'Redefinir a sua senha do PickleRush',
    senhaTitulo: 'Redefinir a senha',
    senhaTexto: 'Recebemos um pedido para trocar a senha desta conta. Toque no botão para escolher uma nova. Se não foi você, ignore este e-mail: a senha atual continua valendo.',
    senhaBotao: 'Escolher nova senha',
    naoFoiVoce: 'O link vale por pouco tempo e só pode ser usado uma vez.',
    codigoSms: 'PickleRush: seu codigo e {codigo}. Vale por 10 minutos. Nao compartilhe com ninguem.',
    pushTesteTitulo: 'Teste de push do PickleRush',
    pushTesteTexto: 'Se esta notificação apareceu, o push está funcionando neste aparelho.',
    areas: {
      jogos: 'jogos e dias de jogo', torneios: 'torneios', arenas: 'reservas e arenas', clubes: 'clubes', aulas: 'aulas',
      treino: 'treino', mercado: 'Mercado', social: 'mensagens e comunidade', promocoes: 'novidades e promoções',
      gamificacao: 'conquistas e desafios', conta: 'sua conta', outros: 'outros assuntos',
    },
  },
  en: {
    abrir: 'Open in PickleRush',
    enviadoPor: 'Sent by {nome}, through PickleRush.',
    porque: 'You get this e-mail because you have a PickleRush account and kept {area} notices on for e-mail.',
    porqueEssencial: 'This notice is about your account and cannot be turned off.',
    escolher: 'Choose what I get by e-mail',
    sair: 'Stop {area} notices by e-mail',
    sairTudo: 'Stop all PickleRush e-mails',
    denunciar: 'Report this e-mail',
    resumoDia: 'Your daily PickleRush summary',
    resumoSemana: 'Your weekly PickleRush summary',
    resumoIntro: { 1: 'You have 1 notice you have not seen yet.', n: 'You have {n} notices you have not seen yet.' },
    resumoPorque: 'You get this summary because you chose to group some notices into a single e-mail.',
    verTodos: 'See all notices',
    testeAssunto: 'PickleRush sending test',
    testeTitulo: 'E-mail sending works',
    testeTexto: 'If you are reading this, the domain {dominio} and the provider {provedor} are working. This e-mail was requested in Admin panel → Communications.',
    verificarAssunto: 'Confirm your e-mail on PickleRush',
    verificarTitulo: 'Confirm your e-mail',
    verificarTexto: 'Tap the button to confirm this address is yours. After that, the notices you chose will start arriving here.',
    verificarBotao: 'Confirm e-mail',
    senhaAssunto: 'Reset your PickleRush password',
    senhaTitulo: 'Reset your password',
    senhaTexto: 'We got a request to change the password of this account. Tap the button to choose a new one. If it was not you, ignore this e-mail: your current password still works.',
    senhaBotao: 'Choose a new password',
    naoFoiVoce: 'The link is valid for a short time and can be used only once.',
    codigoSms: 'PickleRush: your code is {codigo}. It is valid for 10 minutes. Do not share it.',
    pushTesteTitulo: 'PickleRush push test',
    pushTesteTexto: 'If you can see this notification, push is working on this device.',
    areas: {
      jogos: 'games and game days', torneios: 'tournaments', arenas: 'bookings and venues', clubes: 'clubs', aulas: 'lessons',
      treino: 'training', mercado: 'Marketplace', social: 'messages and community', promocoes: 'news and promotions',
      gamificacao: 'achievements and challenges', conta: 'your account', outros: 'other topics',
    },
  },
  es: {
    abrir: 'Abrir en PickleRush',
    enviadoPor: 'Enviado por {nome}, a través de PickleRush.',
    porque: 'Recibes este correo porque tienes cuenta en PickleRush y dejaste activados los avisos de {area} por correo.',
    porqueEssencial: 'Este aviso es sobre tu cuenta y no se puede desactivar.',
    escolher: 'Elegir lo que recibo por correo',
    sair: 'No quiero más avisos de {area} por correo',
    sairTudo: 'No quiero más correos de PickleRush',
    denunciar: 'Denunciar este correo',
    resumoDia: 'Tu resumen del día en PickleRush',
    resumoSemana: 'Tu resumen de la semana en PickleRush',
    resumoIntro: { 1: 'Tienes 1 aviso que aún no viste.', n: 'Tienes {n} avisos que aún no viste.' },
    resumoPorque: 'Recibes este resumen porque elegiste juntar algunos avisos en un solo correo.',
    verTodos: 'Ver todos los avisos',
    testeAssunto: 'Prueba de envío de PickleRush',
    testeTitulo: 'El envío de correos funciona',
    testeTexto: 'Si estás leyendo esto, el dominio {dominio} y el proveedor {provedor} funcionan. Este correo se pidió en Panel admin → Comunicaciones.',
    verificarAssunto: 'Confirma tu correo en PickleRush',
    verificarTitulo: 'Confirma tu correo',
    verificarTexto: 'Toca el botón para confirmar que esta dirección es tuya. Después, los avisos que elegiste empezarán a llegar aquí.',
    verificarBotao: 'Confirmar correo',
    senhaAssunto: 'Restablece tu contraseña de PickleRush',
    senhaTitulo: 'Restablecer la contraseña',
    senhaTexto: 'Recibimos un pedido para cambiar la contraseña de esta cuenta. Toca el botón para elegir una nueva. Si no fuiste tú, ignora este correo: tu contraseña actual sigue valiendo.',
    senhaBotao: 'Elegir nueva contraseña',
    naoFoiVoce: 'El enlace vale por poco tiempo y solo se puede usar una vez.',
    codigoSms: 'PickleRush: tu codigo es {codigo}. Vale por 10 minutos. No lo compartas.',
    pushTesteTitulo: 'Prueba de push de PickleRush',
    pushTesteTexto: 'Si ves esta notificación, el push funciona en este dispositivo.',
    areas: {
      jogos: 'partidos y días de juego', torneios: 'torneos', arenas: 'reservas y canchas', clubes: 'clubes', aulas: 'clases',
      treino: 'entrenamiento', mercado: 'Mercado', social: 'mensajes y comunidad', promocoes: 'novedades y promociones',
      gamificacao: 'logros y desafíos', conta: 'tu cuenta', outros: 'otros temas',
    },
  },
};

const PROVEDOR = { ses: 'Amazon SES', resend: 'Resend' };

/** O idioma de quem recebe (pt quando não há tradução). */
const langOf = (language) => idiomaDoPush(language) || 'pt';
const textos = (lang) => T[lang] || T.pt;
const fill = (s, p) => String(s).replace(/\{(\w+)\}/g, (m, k) => (p[k] === undefined ? m : String(p[k])));

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/** Link do aviso → endereço completo DENTRO do site; o resto vira a central. */
function internalUrl(origin, link) {
  const l = typeof link === 'string' ? link.trim() : '';
  const interno = l.startsWith('/') && !l.startsWith('//') && !l.includes('\\') && !/[\s<>"']/.test(l);
  return `${origin}${interno ? l : '/notificacoes'}`;
}

/** O texto do aviso, no idioma, sem link quando quem escreveu foi uma pessoa. */
function noticeText(notice, lang, { trust }) {
  const title = String(campoNoIdioma(notice, 'title', lang) || 'PickleRush').slice(0, 200);
  const message = String(campoNoIdioma(notice, 'message', lang) || '').slice(0, 2000);
  return trust === 'server'
    ? { title, message }
    : { title: defangText(title), message: defangText(message) };
}

const paragrafos = (texto) => esc(texto).split(/\n{2,}/).map((p) => p.replace(/\n/g, '<br>'))
  .map((p) => `<p style="margin:0 0 14px;font-size:16px;line-height:24px;color:${COR.texto}">${p}</p>`).join('');

function botao(url, rotulo) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 20px"><tr><td style="border-radius:10px;background:${COR.ink}">`
    + `<a href="${esc(url)}" style="display:inline-block;padding:13px 22px;font-size:16px;font-weight:600;color:#FFFFFF;text-decoration:none;border-radius:10px">${esc(rotulo)}</a>`
    + '</td></tr></table>';
}

/** A moldura de todo e-mail: marca, conteúdo, rodapé com os links da pessoa. */
function frame({ lang, preheader, bodyHtml, footerLines = [], settings }) {
  const e = settings.email;
  const rodape = [...footerLines];
  if (e.footer_note) rodape.push(esc(e.footer_note));
  if (e.postal_address) rodape.push(esc(e.postal_address));
  return `<!doctype html><html lang="${lang === 'pt' ? 'pt-BR' : lang}"><head><meta charset="utf-8">`
    + '<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light">'
    + `<title>${esc(preheader).slice(0, 120)}</title></head>`
    + `<body style="margin:0;padding:0;background:${COR.paper};font-family:Inter,Segoe UI,Helvetica,Arial,sans-serif">`
    + `<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(preheader).slice(0, 140)}</div>`
    + `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${COR.paper}"><tr><td align="center" style="padding:24px 12px">`
    + '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px">'
    + `<tr><td style="padding:0 4px 14px"><span style="display:inline-block;background:${COR.ink};color:${COR.acid};font-weight:800;font-size:18px;letter-spacing:.3px;padding:8px 14px;border-radius:10px">PickleRush</span></td></tr>`
    + `<tr><td style="background:#FFFFFF;border:1px solid ${COR.linha};border-radius:14px;padding:28px 24px">${bodyHtml}</td></tr>`
    + `<tr><td style="padding:16px 8px 0;font-size:12px;line-height:18px;color:${COR.suave}">${rodape.map((l) => `<p style="margin:0 0 8px">${l}</p>`).join('')}</td></tr>`
    + '</table></td></tr></table></body></html>';
}

const linkRodape = (url, rotulo) => `<a href="${esc(url)}" style="color:${COR.suave};text-decoration:underline">${esc(rotulo)}</a>`;

/** Cabeçalhos de descadastro (Gmail e Yahoo exigem desde 2024 para envio em volume). */
function unsubscribeHeaders(unsubscribeUrl) {
  return unsubscribeUrl
    ? { 'List-Unsubscribe': `<${unsubscribeUrl}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' }
    : {};
}

/**
 * O e-mail de UM aviso.
 * @param {object} p { notice, classified, language, settings, senderName, urls: { unsubscribe, report, settings } }
 */
function noticeEmail({ notice, classified, language, settings, senderName = '', urls = {} }) {
  const lang = langOf(language);
  const t = textos(lang);
  const { title, message } = noticeText(notice, lang, classified);
  const area = t.areas[classified.area] || t.areas.outros;
  let corpo = `<h1 style="margin:0 0 14px;font-size:22px;line-height:28px;color:${COR.ink}">${esc(title)}</h1>`;
  if (message) corpo += paragrafos(message);
  if (classified.trust === 'user' && senderName) {
    corpo += `<p style="margin:0 0 14px;font-size:13px;color:${COR.suave}">${esc(fill(t.enviadoPor, { nome: defangText(senderName).slice(0, 80) }))}</p>`;
  }
  corpo += botao(internalUrl(settings.public_origin, notice.link), t.abrir);
  const rodape = [];
  if (classified.essential) rodape.push(esc(t.porqueEssencial));
  else rodape.push(esc(fill(t.porque, { area })));
  const links = [];
  if (urls.settings) links.push(linkRodape(urls.settings, t.escolher));
  if (urls.unsubscribe && !classified.essential) links.push(linkRodape(urls.unsubscribe, fill(t.sair, { area })));
  if (urls.report && classified.trust === 'user') links.push(linkRodape(urls.report, t.denunciar));
  if (links.length) rodape.push(links.join(' · '));
  const texto = [
    title, '', message,
    classified.trust === 'user' && senderName ? `\n${fill(t.enviadoPor, { nome: defangText(senderName).slice(0, 80) })}` : '',
    '', `${t.abrir}: ${internalUrl(settings.public_origin, notice.link)}`, '', '—',
    classified.essential ? t.porqueEssencial : fill(t.porque, { area }),
    urls.settings ? `${t.escolher}: ${urls.settings}` : '',
    urls.unsubscribe && !classified.essential ? `${fill(t.sair, { area })}: ${urls.unsubscribe}` : '',
    urls.report && classified.trust === 'user' ? `${t.denunciar}: ${urls.report}` : '',
    settings.email.postal_address || '',
  ].filter((l, i, a) => l !== '' || a[i - 1] !== '').join('\n').trim();
  return {
    subject: title.slice(0, 150),
    html: frame({ lang, preheader: message || title, bodyHtml: corpo, footerLines: rodape, settings }),
    text: texto,
    headers: classified.essential ? {} : unsubscribeHeaders(urls.unsubscribeOneClick || urls.unsubscribe),
  };
}

/**
 * O resumo (diário ou semanal): vários avisos num e-mail só, por área.
 * `items`: [{ notice, classified }] já filtrados (não lidos, não enviados).
 */
function digestEmail({ items, language, settings, weekly = false, urls = {} }) {
  const lang = langOf(language);
  const t = textos(lang);
  const n = items.length;
  const intro = n === 1 ? t.resumoIntro[1] : fill(t.resumoIntro.n, { n });
  const porArea = new Map();
  items.forEach((it) => {
    const a = it.classified.area;
    if (!porArea.has(a)) porArea.set(a, []);
    porArea.get(a).push(it);
  });
  let corpo = `<h1 style="margin:0 0 8px;font-size:22px;line-height:28px;color:${COR.ink}">${esc(weekly ? t.resumoSemana : t.resumoDia)}</h1>`
    + `<p style="margin:0 0 18px;font-size:15px;color:${COR.suave}">${esc(intro)}</p>`;
  const linhas = [];
  porArea.forEach((lista, area) => {
    const rotulo = t.areas[area] || t.areas.outros;
    corpo += `<p style="margin:18px 0 8px;font-size:12px;font-weight:700;letter-spacing:.6px;text-transform:uppercase;color:${COR.suave}">${esc(rotulo)}</p>`;
    linhas.push('', rotulo.toUpperCase());
    lista.slice(0, 15).forEach(({ notice, classified }) => {
      const { title, message } = noticeText(notice, lang, classified);
      const url = internalUrl(settings.public_origin, notice.link);
      const curta = message.length > 180 ? `${message.slice(0, 177)}…` : message;
      corpo += `<a href="${esc(url)}" style="display:block;text-decoration:none;border:1px solid ${COR.linha};border-radius:10px;padding:12px 14px;margin:0 0 8px">`
        + `<span style="display:block;font-size:15px;font-weight:600;color:${COR.ink}">${esc(title)}</span>`
        + (curta ? `<span style="display:block;margin-top:4px;font-size:14px;line-height:20px;color:${COR.texto}">${esc(curta)}</span>` : '')
        + '</a>';
      linhas.push(`• ${title}${curta ? ` — ${curta}` : ''}`, `  ${url}`);
    });
  });
  corpo += botao(`${settings.public_origin}/notificacoes`, t.verTodos);
  const rodape = [esc(t.resumoPorque)];
  const links = [];
  if (urls.settings) links.push(linkRodape(urls.settings, t.escolher));
  if (urls.unsubscribe) links.push(linkRodape(urls.unsubscribe, t.sairTudo));
  if (links.length) rodape.push(links.join(' · '));
  const subject = `${weekly ? t.resumoSemana : t.resumoDia} (${n})`;
  return {
    subject,
    html: frame({ lang, preheader: intro, bodyHtml: corpo, footerLines: rodape, settings }),
    text: [weekly ? t.resumoSemana : t.resumoDia, intro, ...linhas, '', `${t.verTodos}: ${settings.public_origin}/notificacoes`, '—', t.resumoPorque,
      urls.settings ? `${t.escolher}: ${urls.settings}` : '', urls.unsubscribe ? `${t.sairTudo}: ${urls.unsubscribe}` : '']
      .filter(Boolean).join('\n'),
    headers: unsubscribeHeaders(urls.unsubscribeOneClick || urls.unsubscribe),
  };
}

/** Os e-mails de sistema: teste, confirmação de e-mail e troca de senha. */
function systemEmail(kind, { language, settings, actionUrl = '' }) {
  const lang = langOf(language);
  const t = textos(lang);
  if (kind === 'test') {
    const texto = fill(t.testeTexto, { dominio: settings.email.domain, provedor: PROVEDOR[settings.email.provider] || settings.email.provider });
    return {
      subject: t.testeAssunto,
      html: frame({ lang, preheader: t.testeTitulo, settings, bodyHtml: `<h1 style="margin:0 0 14px;font-size:22px;color:${COR.ink}">${esc(t.testeTitulo)}</h1>${paragrafos(texto)}<p style="margin:0;font-size:13px;color:${COR.suave}">${esc(fromAddress(settings))}</p>` }),
      text: `${t.testeTitulo}\n\n${texto}\n\n${fromAddress(settings)}`,
      headers: {},
    };
  }
  const k = kind === 'password_reset'
    ? { assunto: t.senhaAssunto, titulo: t.senhaTitulo, texto: t.senhaTexto, botao: t.senhaBotao }
    : { assunto: t.verificarAssunto, titulo: t.verificarTitulo, texto: t.verificarTexto, botao: t.verificarBotao };
  return {
    subject: k.assunto,
    html: frame({
      lang, preheader: k.titulo, settings, footerLines: [esc(t.naoFoiVoce)],
      bodyHtml: `<h1 style="margin:0 0 14px;font-size:22px;color:${COR.ink}">${esc(k.titulo)}</h1>${paragrafos(k.texto)}${botao(actionUrl, k.botao)}`,
    }),
    text: `${k.titulo}\n\n${k.texto}\n\n${k.botao}: ${actionUrl}\n\n${t.naoFoiVoce}`,
    headers: {},
  };
}

/** Parâmetro de modelo do WhatsApp: sem quebra de linha nem tab, e com teto. */
const waParam = (s, max) => String(s || '').replace(/[\r\n\t]+/g, ' ').replace(/ {4,}/g, '   ').trim().slice(0, max) || '-';

/** Os dados do modelo `picklerush_aviso`: título, texto e o fim do link do botão. */
function whatsappNotice({ notice, classified, language }) {
  const lang = langOf(language);
  const { title, message } = noticeText(notice, lang, classified);
  const link = typeof notice.link === 'string' && notice.link.startsWith('/') && !notice.link.startsWith('//') ? notice.link.slice(1) : 'notificacoes';
  return { lang, params: [waParam(title, 60), waParam(message, 900)], button: link.slice(0, 200) || 'notificacoes' };
}

/** O SMS de um aviso: curto, sem acento quando dá (cabe em menos partes). */
function smsNotice({ notice, classified, language, settings }) {
  const lang = langOf(language);
  const { title, message } = noticeText(notice, lang, classified);
  const url = internalUrl(settings.public_origin, notice.link);
  const max = settings.sms.max_chars;
  const base = `PickleRush: ${title}`;
  const fim = ` ${url}`;
  const espaco = max - base.length - fim.length - 3;
  const meio = message && espaco > 10 ? ` - ${message.length > espaco ? `${message.slice(0, espaco - 1)}…` : message}` : '';
  return `${base}${meio}${fim}`.replace(/\s+/g, ' ').slice(0, max);
}

const smsCode = (codigo, language) => fill(textos(langOf(language)).codigoSms, { codigo });

/** O push de teste do painel (aba Push). */
function pushTest(language) {
  const x = textos(langOf(language));
  return { title: x.pushTesteTitulo, body: x.pushTesteTexto };
}

module.exports = {
  T,
  langOf,
  esc,
  internalUrl,
  noticeText,
  noticeEmail,
  digestEmail,
  systemEmail,
  whatsappNotice,
  smsNotice,
  smsCode,
  pushTest,
  unsubscribeHeaders,
};
