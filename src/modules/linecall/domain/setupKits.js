/**
 * Montagens do controle de linhas — do "um celular no alambrado" ao estúdio
 * com OBS e câmeras sem fio. Puro: a tela pergunta "como você vai montar?",
 * mostra o passo a passo do kit escolhido e diz o que ESTE aparelho aguenta.
 *
 * Nada aqui é gravado no banco: o kit é uma escolha de quem monta, guardada no
 * navegador (`viewPreference`). Os ids de kit e de fonte de câmera aparecem em
 * links e preferências — nunca renomeie.
 */

import { tk } from '@/core/i18n';

/** Os kits, do mais simples ao mais completo. */
export const SETUP_KITS = Object.freeze({
  basico: {
    id: 'basico',
    label: tk('Um celular'),
    level: tk('Dia a dia'),
    who: tk('Um jogo entre amigos, sem nada além de um celular e um apoio.'),
    devices: tk('1 celular (ou tablet) num tripé ou preso no alambrado, atrás do fundo, de 2 a 4 m de altura.'),
    layouts: ['solo_fundo', 'solo_rede', 'solo_topo'],
    cams: [1, 1],
    connection: 'none',
    computer: false,
    steps: [
      tk('No celular que vai filmar, entre na plataforma e abra o dia de jogo → Controle de linhas → "Usar este aparelho como câmera".'),
      tk('Escolha a posição (atrás do fundo é a melhor para uma câmera só) e prenda o celular na altura e no ângulo do desenho.'),
      tk('Ligue o carregador: a análise gasta bateria. Deixe o celular deitado (paisagem) e não mexa mais nele.'),
      tk('Marque os quatro pontos, toque em "Grudar na linha", confira com o 5º ponto e comece a analisar.'),
      tk('Para ver os lances em outra tela (mesa, TV), abra "Ver a central" em outro aparelho.'),
    ],
    pros: [tk('Monta em 5 minutos'), tk('Não precisa de computador')],
    limits: [tk('Julga bem a metade de quadra perto da câmera; a do fundo tem mais "revisar"'), tk('Pé na cozinha só do lado da câmera')],
  },
  celulares: {
    id: 'celulares',
    label: tk('Vários celulares'),
    level: tk('Clube e arena'),
    who: tk('Dois a cinco celulares, dos jogadores ou separados só para isso, cada um numa posição.'),
    devices: tk('2 a 5 celulares, cada um num tripé ou suporte de alambrado, com carregador. Um tablet, notebook ou TV com a central.'),
    layouts: ['dois_fundos', 'fundo_rede', 'fundos_topo', 'fundos_redes', 'cantos'],
    cams: [2, 5],
    connection: 'wifi',
    computer: false,
    steps: [
      tk('Quem organiza escolhe o arranjo (quantas câmeras e onde) na tela do controle de linhas.'),
      tk('Na central, cada posição vazia tem um QR: aponte a câmera do celular para ele e o aparelho já abre naquela posição.'),
      tk('Cada celular precisa estar logado com uma conta que participa do dia de jogo. Celular separado só para isso: entre com a conta de quem organiza, ou inclua a conta dele como participante.'),
      tk('Em cada aparelho: prenda na posição, ligue o carregador, marque os pontos, grude na linha e confira com o 5º ponto.'),
      tk('A central mostra quem está no ar, a bateria, os quadros por segundo e a precisão de cada câmera. Comece o jogo quando todas estiverem verdes.'),
    ],
    pros: [tk('Cobre a quadra inteira e os dois lados da cozinha'), tk('Cada celular analisa sozinho: nada de vídeo pela rede')],
    limits: [tk('Celular de jogador sai da quadra com o dono: prefira aparelhos separados para o jogo inteiro'), tk('Todos precisam de internet (Wi-Fi da arena ou dados) só para enviar as marcações')],
  },
  computador: {
    id: 'computador',
    label: tk('Computador com câmeras'),
    level: tk('Torneio'),
    who: tk('Um notebook ou PC recebendo uma ou mais câmeras por cabo (USB ou placa de captura HDMI). É o jeito mais estável.'),
    devices: tk('1 notebook/PC (ideal: processador de 6 núcleos ou mais, 16 GB de memória, ligado na tomada) + 1 a 4 câmeras USB ou câmeras/GoPro por placa de captura HDMI + cabos ou extensores USB ativos.'),
    layouts: ['solo_fundo', 'dois_fundos', 'fundos_topo', 'fundos_redes'],
    cams: [1, 4],
    connection: 'wired',
    computer: true,
    steps: [
      tk('Ligue as câmeras no computador. Cabo USB passa de 5 m só com extensor ativo; HDMI longo com cabo de fibra ou extensor por cabo de rede.'),
      tk('Abra o controle de linhas no navegador do computador (Chrome ou Edge atualizados) e escolha "Usar este aparelho como câmera".'),
      tk('Uma aba por câmera: escolha a posição, e na lista de câmeras pegue a câmera daquela posição. Para a próxima, toque em "Abrir outra câmera neste computador".'),
      tk('Deixe o computador na tomada, no modo de alto desempenho, com as abas visíveis (aba escondida analisa mais devagar). Uma tela grande com as abas lado a lado é o ideal.'),
      tk('Calibre cada aba e abra a central no próprio computador ou numa TV.'),
    ],
    pros: [tk('Câmeras com 60 a 120 quadros por segundo e foco fixo'), tk('Nada depende de bateria nem de celular de ninguém')],
    limits: [tk('Cada câmera pesa no processador: com 4, use um computador forte'), tk('Cabos na quadra precisam de passagem segura')],
  },
  estudio: {
    id: 'estudio',
    label: tk('Estúdio com OBS e câmeras sem fio'),
    level: tk('Profissional'),
    who: tk('Entidades e transmissões: câmeras sem fio (celulares, câmeras IP, NDI) ou com fio chegando ao OBS Studio, que entrega cada uma ao navegador como uma câmera.'),
    devices: tk('1 PC forte com OBS Studio (grátis) + câmeras sem fio (celular com app de câmera NDI/SRT, câmera IP com RTSP, câmera NDI) ou com fio + um roteador Wi-Fi só para as câmeras (5 GHz, perto da quadra).'),
    layouts: ['dois_fundos', 'fundos_redes', 'cantos', 'fundos_redes_topo', 'cantos_topo'],
    cams: [1, 5],
    connection: 'wireless',
    computer: true,
    steps: [
      tk('Rede: um roteador só para as câmeras, em 5 GHz, perto da quadra, ligado ao PC por cabo. Nada de Wi-Fi público dividido com o público.'),
      tk('No OBS, crie uma cena por câmera com a fonte dela: celular por NDI ou SRT (apps de câmera como os da NDI ou o Larix), câmera IP por "Fonte de mídia" com o endereço RTSP, câmera NDI pela fonte NDI.'),
      tk('Em Configurações → Vídeo do OBS: resolução 1920×1080 e 60 quadros por segundo (o padrão é 30, pouco para a bola).'),
      tk('O OBS entrega UMA "Câmera virtual" por vez. Para várias câmeras no navegador, use uma saída virtual por câmera (plug-ins de câmera virtual múltipla ou o "Webcam Input" das ferramentas NDI) ou uma cópia do OBS por câmera.'),
      tk('No navegador do PC, uma aba por posição, escolhendo a câmera virtual daquela posição. Calibre cada uma; a central mostra todas.'),
    ],
    pros: [tk('Sem fio: câmeras onde for melhor, sem cabo atravessando a quadra'), tk('A mesma câmera serve à transmissão e ao controle de linhas')],
    limits: [tk('O Wi-Fi atrasa e às vezes engasga: a central junta por tempo, mas um engasgo na hora do lance vira "revisar"'), tk('Bola EXATAMENTE na linha, ao milímetro, exige câmeras sincronizadas e software próprio')],
  },
});

export const KIT_ORDER = Object.freeze(['basico', 'celulares', 'computador', 'estudio']);

/** Como cada kit liga as câmeras, para o selo do cartão. */
export const CONNECTION_LABEL = Object.freeze({
  none: tk('A câmera é o próprio aparelho'),
  wifi: tk('Cada celular analisa e só envia as marcações'),
  wired: tk('Câmeras por cabo no computador'),
  wireless: tk('Câmeras sem fio no OBS'),
});

/**
 * O que ESTE aparelho é e quantas câmeras ele aguenta analisar ao mesmo tempo.
 * Recebe o que o navegador diz (`navigator`), para dar para testar.
 * `cores`/`memory` desconhecidos não viram zero: a conta fica conservadora.
 */
export function deviceProfile({ userAgent = '', maxTouchPoints = 0, cores = null, memoryGb = null, screenW = null } = {}) {
  const ua = String(userAgent);
  const phone = /iPhone|Android.+Mobile|Mobile Safari/i.test(ua);
  const tablet = !phone && (/iPad|Android/i.test(ua) || (/Macintosh/.test(ua) && maxTouchPoints > 1));
  const kind = phone ? 'phone' : tablet ? 'tablet' : 'computer';
  let maxCams = 1;
  if (kind === 'computer') {
    const c = cores ?? 4;
    const m = memoryGb ?? 4;
    maxCams = c >= 12 && m >= 8 ? 4 : c >= 8 && m >= 8 ? 3 : c >= 6 ? 2 : 1;
  }
  return { kind, maxCams, cores, memoryGb, screenW, known: cores != null };
}

/** Avisos de usar ESTE kit NESTE aparelho (vazio = combina). */
export function kitWarnings(kitId, profile) {
  const kit = SETUP_KITS[kitId];
  if (!kit || !profile) return [];
  const out = [];
  if (kit.computer && profile.kind !== 'computer') out.push('needs_computer');
  if (kit.computer && profile.kind === 'computer' && profile.maxCams < kit.cams[1] && kit.cams[1] > 1) out.push('weak_computer');
  if (!kit.computer && profile.kind === 'computer' && kit.id === 'basico') out.push('computer_fixed');
  return out;
}

export const KIT_WARNING_TEXT = Object.freeze({
  needs_computer: tk('Esta montagem é para notebook ou PC. Neste aparelho, use "Um celular" ou "Vários celulares".'),
  weak_computer: tk('Este computador deve aguentar analisar {n} câmera(s) ao mesmo tempo. Para mais, use outro computador para as demais câmeras (a central junta todas).'),
  computer_fixed: tk('Com um notebook, a câmera embutida fica presa na tela: prefira uma webcam USB num tripé alto atrás do fundo.'),
});

/**
 * De onde vem a câmera, pelo nome que o sistema dá a ela. Serve para dar a
 * dica certa (OBS a 30 quadros, app de celular sem fio, placa de captura).
 */
export function cameraSource(label = '') {
  const l = String(label).toLowerCase();
  if (/obs/.test(l)) return 'obs';
  if (/ndi/.test(l)) return 'ndi';
  if (/droidcam|iriun|camo|epoccam|ivcam|continuity|iphone/.test(l)) return 'phone_wireless';
  if (/capture|cam link|hdmi|usb video|elgato|avermedia|magewell/.test(l)) return 'capture';
  if (/front|frontal|user|facetime|integrated|built-in|embutid/.test(l)) return 'front';
  if (/back|traseira|environment|rear/.test(l)) return 'back';
  return 'other';
}

export const CAMERA_SOURCE_TIP = Object.freeze({
  obs: tk('Câmera virtual do OBS: confira em Configurações → Vídeo do OBS se está a 60 quadros por segundo e 1920×1080 (o padrão é 30). Desligue filtros e transições na cena desta câmera.'),
  ndi: tk('Câmera NDI: use a rede só das câmeras (5 GHz ou cabo). Se os quadros por segundo caírem, baixe a resolução na origem.'),
  phone_wireless: tk('Celular como câmera sem fio: deixe o app em 60 quadros por segundo, foco travado e o celular no carregador. Wi-Fi fraco vira "revisar".'),
  capture: tk('Placa de captura: deixe a câmera de origem em 60 quadros ou mais, foco e exposição manuais, sem estabilização.'),
  front: tk('Esta é a câmera da frente: a de trás costuma ter mais quadros por segundo e foco melhor.'),
  back: null,
  other: null,
});
