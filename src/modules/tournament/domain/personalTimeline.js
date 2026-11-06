/**
 * A LINHA DO TEMPO PESSOAL num torneio (docs/55) — lógica pura.
 *
 * Quem joga em mais de uma categoria tinha de abrir uma por uma para achar
 * os próprios horários. Aqui os jogos de UMA ou VÁRIAS pessoas, de TODAS as
 * categorias, saem numa lista só, em ordem de dia e horário, com a fase, a
 * rodada, a quadra, o placar e — no mata-mata — o próximo confronto possível
 * ("Se vencer: Semifinal contra o vencedor do jogo 6").
 *
 * Fontes: as inscrições, as categorias e os jogos do torneio (as três de
 * leitura pública — o mesmo que o quadro já mostra). Nada é gravado.
 *
 * Identidade de uma pessoa no torneio: a CONTA (`user_id`) quando existe —
 * junta todas as categorias dela; sem conta, a vaga da inscrição
 * (`reg:{id}:{lado}`), que vale só para aquela categoria.
 *
 * PURO. Sem React, sem Firebase.
 */
import { MATCH_STATUS, REGISTRATION_STATUS, TOURNAMENT_STAGE_TYPE_LABELS } from './constants.js';
import { normalizePhases } from './phases.js';
import { buildBracketColumns, buildKnockoutDiagram, isKnockoutStage, refLabel } from './bracketLayout.js';
import { modalityPlacement } from './podium.js';
import { isModalityComplete } from './tournamentCompletion.js';
import { instanteEmMs } from '@/core/domain/instant.js';
import { t } from '@/core/i18n';

const INATIVAS = new Set([REGISTRATION_STATUS.CANCELLED, REGISTRATION_STATUS.WITHDRAWN]);

/** A inscrição entra na lista de pessoas do torneio? (fictício e quem saiu, não) */
function contaComoInscrito(reg) {
  return Boolean(reg?.id) && !reg.is_placeholder && !INATIVAS.has(reg.status);
}

/** As vagas (pessoas) de uma inscrição, cada uma com a sua chave de identidade. */
function vagasDa(reg) {
  if (reg.kind === 'team') {
    return (reg.members || []).filter((m) => m?.name || m?.user_id).map((m, i) => ({
      key: m.user_id || `reg:${reg.id}:m${i}`,
      user_id: m.user_id || null,
      name: m.name || t('Atleta'),
      photo_url: m.photo_url || null,
    }));
  }
  const a = reg.player_a_name || reg.player_a_user_id || reg.user_id
    ? {
      key: reg.player_a_user_id || reg.user_id || `reg:${reg.id}:a`,
      user_id: reg.player_a_user_id || reg.user_id || null,
      name: reg.player_a_name || t('Atleta'),
      photo_url: reg.player_a_photo || null,
    }
    : null;
  const b = reg.player_b_name || reg.player_b_user_id
    ? {
      key: reg.player_b_user_id || `reg:${reg.id}:b`,
      user_id: reg.player_b_user_id || null,
      name: reg.player_b_name || t('Atleta'),
      photo_url: reg.player_b_photo || null,
    }
    : null;
  return [a, b].filter(Boolean);
}

/**
 * As PESSOAS inscritas no torneio (uma por conta; sem conta, uma por vaga),
 * em ordem alfabética. É a lista do seletor "Acompanhar": só quem está
 * inscrito neste torneio, nunca o diretório inteiro.
 *
 * @param {object[]} registrations do torneio
 * @param {object[]} [modalities]
 * @returns {Array<{ id: string, user_id: string|null, name: string, photo_url: string|null,
 *   registrationIds: string[], modalityIds: string[], modalityNames: string[] }>}
 */
export function tournamentPeople(registrations = [], modalities = []) {
  const nomeCat = new Map((modalities || []).map((m) => [m.id, m.name]));
  const porChave = new Map();
  (registrations || []).filter(contaComoInscrito).forEach((reg) => {
    vagasDa(reg).forEach((v) => {
      if (!porChave.has(v.key)) {
        porChave.set(v.key, {
          id: v.key, user_id: v.user_id, name: v.name, photo_url: v.photo_url,
          registrationIds: [], modalityIds: [], modalityNames: [],
        });
      }
      const p = porChave.get(v.key);
      if (!p.photo_url && v.photo_url) p.photo_url = v.photo_url;
      if (!p.registrationIds.includes(reg.id)) p.registrationIds.push(reg.id);
      if (reg.modality_id && !p.modalityIds.includes(reg.modality_id)) {
        p.modalityIds.push(reg.modality_id);
        if (nomeCat.get(reg.modality_id)) p.modalityNames.push(nomeCat.get(reg.modality_id));
      }
    });
  });
  return [...porChave.values()].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
}

/** Rótulo curto de uma inscrição: a equipe pelo nome, a dupla pelos dois. */
export function registrationShortLabel(reg) {
  if (!reg) return '';
  if (reg.kind === 'team') return reg.team_name || reg.label || t('Equipe');
  return [reg.player_a_name, reg.player_b_name].filter(Boolean).join(' / ') || reg.label || '';
}

const ladoIds = (m, lado) => (Array.isArray(m?.[lado === 'a' ? 'side_a_ids' : 'side_b_ids']) ? m[lado === 'a' ? 'side_a_ids' : 'side_b_ids'] : []).map(String);

function placarDe(m) {
  if (m.team_confrontation) {
    if (!(Array.isArray(m.etapas) && m.etapas.length)) return [];
    return [{ a: Number(m.etapa_wins_a) || 0, b: Number(m.etapa_wins_b) || 0 }];
  }
  return (Array.isArray(m.games) ? m.games : []).map((g) => ({ a: Number(g.a) || 0, b: Number(g.b) || 0 }));
}

function rotuloDaRodada(m, colunas) {
  if (m.third_place) return t('Disputa de 3º lugar');
  if (m.bracket === 'gf') return Number(m.round) === 2 ? t('Grande final · desempate') : t('Grande final');
  if (m.bracket === 'lb') return t('Repescagem · rodada {r}', { r: m.round });
  if (m.group) return t('{grupo} · rodada {r}', { grupo: /grupo|etapa/i.test(m.group) ? m.group : t('Grupo {g}', { g: m.group }), r: m.round || 1 });
  if (colunas) {
    const col = colunas.find((c) => Number(c.round) === Number(m.round));
    if (col) return col.label;
  }
  return t('Rodada {round}', { round: m.round || 1 });
}

/**
 * A linha do tempo de uma ou mais pessoas no torneio.
 *
 * @param {{
 *   people: Array<{ id: string, registrationIds: string[] }>,
 *   registrations: object[], matches: object[], modalities: object[],
 *   tournament?: object|null,
 * }} args
 * @returns {{
 *   entries: Array<object>, items: Array<object>, days: Array<{ key: string, at: number|null, items: object[] }>,
 *   projections: Array<object>, next: object|null,
 *   stats: { total: number, played: number, won: number, lost: number, upcoming: number },
 * }}
 */
export function buildPersonalTimeline({
  people = [], registrations = [], matches = [], modalities = [], tournament = null,
} = {}) {
  const regById = new Map((registrations || []).map((r) => [String(r.id), r]));
  const modById = new Map((modalities || []).map((m) => [m.id, m]));
  const donoDaInscricao = new Map(); // id da inscrição → ids das pessoas acompanhadas
  (people || []).forEach((p) => (p.registrationIds || []).forEach((rid) => {
    const k = String(rid);
    if (!donoDaInscricao.has(k)) donoDaInscricao.set(k, []);
    donoDaInscricao.get(k).push(p.id);
  }));
  const minhas = new Set(donoDaInscricao.keys());
  const validos = (matches || []).filter((m) => m && m.status !== MATCH_STATUS.CANCELLED);

  // Jogos por categoria e fase (para o rótulo da rodada e a chave).
  const porFase = new Map();
  validos.forEach((m) => {
    const k = `${m.modality_id}|${m.stage_index ?? 0}`;
    if (!porFase.has(k)) porFase.set(k, []);
    porFase.get(k).push(m);
  });
  const colunasDa = new Map();
  const faseDe = (modalityId, stageIndex) => normalizePhases(modById.get(modalityId)?.stages)[stageIndex] || null;
  const colunas = (modalityId, stageIndex) => {
    const k = `${modalityId}|${stageIndex}`;
    if (!colunasDa.has(k)) {
      const lista = porFase.get(k) || [];
      colunasDa.set(k, isKnockoutStage(faseDe(modalityId, stageIndex), lista) ? buildBracketColumns(lista).columns : null);
    }
    return colunasDa.get(k);
  };

  const nomeDoLado = (ids) => ids.map((id) => registrationShortLabel(regById.get(id)) || '').filter(Boolean).join(' / ');

  // ---- os jogos ----
  const items = [];
  validos.forEach((m) => {
    const a = ladoIds(m, 'a');
    const b = ladoIds(m, 'b');
    const naA = a.filter((id) => minhas.has(id));
    const naB = b.filter((id) => minhas.has(id));
    if (!naA.length && !naB.length) return;
    const stageIndex = m.stage_index ?? 0;
    const modality = modById.get(m.modality_id) || null;
    const fases = normalizePhases(modality?.stages);
    const at = instanteEmMs(m.scheduled_at);
    const bye = (a.length === 0) !== (b.length === 0);
    const perspectiva = naA.length && !naB.length ? 'a' : (naB.length && !naA.length ? 'b' : null);
    const decidido = m.winner_side === 'a' || m.winner_side === 'b';
    let outcome = null;
    if (bye) outcome = 'bye';
    else if (perspectiva && decidido) outcome = m.winner_side === perspectiva ? 'won' : 'lost';
    const personIds = [...new Set([...naA, ...naB].flatMap((id) => donoDaInscricao.get(id) || []))];
    items.push({
      id: m.id,
      match: m,
      modalityId: m.modality_id,
      modalityName: modality?.name || t('Categoria'),
      stageIndex,
      phaseLabel: fases.length > 1
        ? t('Fase {n} · {tipo}', { n: stageIndex + 1, tipo: TOURNAMENT_STAGE_TYPE_LABELS[fases[stageIndex]?.type] || '' })
        : null,
      roundLabel: rotuloDaRodada(m, colunas(m.modality_id, stageIndex)),
      court: m.court || null,
      at: Number.isFinite(at) ? at : null,
      status: m.status || MATCH_STATUS.SCHEDULED,
      live: m.status === MATCH_STATUS.IN_PROGRESS,
      done: decidido || m.status === MATCH_STATUS.FINISHED || m.status === MATCH_STATUS.WALKOVER,
      walkover: m.status === MATCH_STATUS.WALKOVER && !bye,
      bye,
      sideA: { ids: a, label: nomeDoLado(a), tracked: naA.length > 0 },
      sideB: { ids: b, label: nomeDoLado(b), tracked: naB.length > 0 },
      perspective: perspectiva,
      winnerSide: decidido ? m.winner_side : null,
      score: placarDe(m),
      outcome,
      personIds,
    });
  });

  const ordemSemHora = (x, y) => (x.modalityName.localeCompare(y.modalityName, 'pt-BR'))
    || (x.stageIndex - y.stageIndex)
    || ((Number(x.match.round) || 0) - (Number(y.match.round) || 0))
    || ((Number(x.match.position) || 0) - (Number(y.match.position) || 0));
  items.sort((x, y) => {
    if (x.at != null && y.at != null) return (x.at - y.at) || String(x.court || '').localeCompare(String(y.court || ''), 'pt-BR', { numeric: true }) || ordemSemHora(x, y);
    if (x.at != null) return -1;
    if (y.at != null) return 1;
    return ordemSemHora(x, y);
  });

  // O próximo: o que está em quadra; senão o primeiro por jogar, com horário.
  const porJogar = items.filter((i) => !i.done && !i.bye);
  const next = porJogar.find((i) => i.live) || porJogar.find((i) => i.at != null) || porJogar[0] || null;
  if (next) next.next = true;

  // Por dia (dia LOCAL do horário). Sem horário, no fim.
  const days = [];
  const porDia = new Map();
  items.forEach((i) => {
    let key = 'sem-horario';
    if (i.at != null) {
      const d = new Date(i.at);
      key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }
    if (!porDia.has(key)) {
      const dia = { key, at: i.at, items: [] };
      porDia.set(key, dia);
      days.push(dia);
    }
    porDia.get(key).items.push(i);
  });

  // ---- as inscrições (o resumo de cada categoria) ----
  const entries = [];
  (people || []).forEach((p) => (p.registrationIds || []).forEach((rid) => {
    const reg = regById.get(String(rid));
    if (!reg) return;
    const modality = modById.get(reg.modality_id) || null;
    const dela = validos.filter((m) => m.modality_id === reg.modality_id);
    const complete = Boolean(modality) && dela.length > 0 && isModalityComplete(modality, dela);
    const colocacao = complete
      ? modalityPlacement({ modality, tournament, matches: dela, allRounds: true }).get(String(reg.id))
      : null;
    const meusJogos = items.filter((i) => i.modalityId === reg.modality_id
      && (i.sideA.ids.includes(String(reg.id)) || i.sideB.ids.includes(String(reg.id))));
    const ladoDe = (i) => (i.sideA.ids.includes(String(reg.id)) ? 'a' : 'b');
    const jogados = meusJogos.filter((i) => i.winnerSide && !i.bye);
    entries.push({
      key: `${p.id}|${reg.id}`,
      personId: p.id,
      registration: reg,
      modality,
      modalityName: modality?.name || t('Categoria'),
      label: registrationShortLabel(reg),
      status: reg.status || null,
      complete,
      position: colocacao?.position ?? null,
      total: meusJogos.filter((i) => !i.bye).length,
      won: jogados.filter((i) => i.winnerSide === ladoDe(i)).length,
      lost: jogados.filter((i) => i.winnerSide !== ladoDe(i)).length,
    });
  }));
  entries.sort((x, y) => x.modalityName.localeCompare(y.modalityName, 'pt-BR'));

  // ---- o que vem pela frente (as chaves) ----
  const projections = [];
  entries.forEach((e) => {
    if (e.complete || !e.modality) return;
    const regId = String(e.registration.id);
    const fases = normalizePhases(e.modality.stages);
    const comJogo = fases.map((_, si) => (porFase.get(`${e.modality.id}|${si}`) || []).some((m) => ladoIds(m, 'a').includes(regId) || ladoIds(m, 'b').includes(regId)));
    const ultimaFase = comJogo.lastIndexOf(true);
    if (ultimaFase < 0) return;
    const lista = porFase.get(`${e.modality.id}|${ultimaFase}`) || [];
    const fase = fases[ultimaFase];
    const base = { key: `${e.key}|${ultimaFase}`, personId: e.personId, modalityId: e.modality.id, modalityName: e.modalityName, label: e.label, stageIndex: ultimaFase };
    if (isKnockoutStage(fase, lista) && fase?.type !== 'double_knockout' && !lista.some((m) => m.bracket === 'lb' || m.bracket === 'gf')) {
      const p = projecaoNaChave(lista, regId, Boolean(fase?.third_place), nomeDoLado);
      if (p) projections.push({ ...base, ...p });
      return;
    }
    // Fase que não é chave: o que vem depois é a PRÓXIMA fase, se ainda não nasceu.
    const proxima = fases[ultimaFase + 1];
    const faseTerminou = lista.length > 0 && lista.every((m) => m.winner_side || m.status === MATCH_STATUS.FINISHED || m.status === MATCH_STATUS.WALKOVER);
    if (proxima && !(porFase.get(`${e.modality.id}|${ultimaFase + 1}`) || []).length) {
      projections.push({
        ...base,
        kind: 'next_phase',
        roundLabel: t('Fase {n} · {tipo}', { n: ultimaFase + 2, tipo: TOURNAMENT_STAGE_TYPE_LABELS[proxima.type] || '' }),
        text: faseTerminou
          ? t('A fase {n} terminou. Os classificados saem quando a organização avançar a fase.', { n: ultimaFase + 1 })
          : t('Os classificados saem da fase {n}, quando ela terminar.', { n: ultimaFase + 1 }),
      });
    }
  });

  const naoBye = items.filter((i) => !i.bye);
  const stats = {
    total: naoBye.length,
    played: naoBye.filter((i) => i.winnerSide).length,
    won: naoBye.filter((i) => i.outcome === 'won').length,
    lost: naoBye.filter((i) => i.outcome === 'lost').length,
    upcoming: naoBye.filter((i) => !i.done).length,
  };

  return { entries, items, days, projections, next, stats };
}

/**
 * Na chave (eliminação simples): o próximo confronto POSSÍVEL de uma inscrição.
 * Devolve `null` quando não há o que projetar (o próximo jogo já existe e
 * aparece na lista) ou `{ kind: 'eliminated'|'if_win'|'champion_if_win'|'waiting', … }`.
 */
function projecaoNaChave(lista, regId, temTerceiro, nomeDoLado) {
  const diagrama = buildKnockoutDiagram(lista, { thirdPlace: temTerceiro });
  if (!diagrama) return null;
  const cols = diagrama.sections[0].columns;
  let ci = -1;
  let i = -1;
  cols.forEach((col, c) => col.cells.forEach((cell, k) => {
    if (cell.placeholder) return;
    if (ladoIds(cell, 'a').includes(regId) || ladoIds(cell, 'b').includes(regId)) { ci = c; i = k; }
  }));
  if (ci < 0) return null;
  const cell = cols[ci].cells[i];
  const decidido = cell.winner_side === 'a' || cell.winner_side === 'b' || ((ladoIds(cell, 'a').length === 0) !== (ladoIds(cell, 'b').length === 0));
  const venceu = decidido && (
    cell.winner_side ? ladoIds(cell, cell.winner_side).includes(regId) : true
  );
  if (decidido && !venceu) {
    // Perdeu a semifinal com disputa de 3º prevista: o 3º lugar é o que vem.
    const tp = diagrama.thirdPlace;
    if (tp && ci === cols.length - 2 && tp.placeholder) {
      return { kind: 'third_place', roundLabel: t('Disputa de 3º lugar'), text: t('Contra o outro semifinalista que perder.') };
    }
    if (tp && ci === cols.length - 2) return null; // o jogo de 3º já existe: aparece na lista
    return { kind: 'eliminated', roundLabel: cols[ci].label, text: t('Parou em: {rodada}.', { rodada: cols[ci].label }) };
  }
  if (ci === cols.length - 1) {
    if (decidido && venceu) return { kind: 'champion', roundLabel: t('Campeão'), text: t('Venceu a final.') };
    return { kind: 'champion_if_win', roundLabel: cols[ci].label, text: t('Se vencer, é campeão.') };
  }
  const proxima = cols[ci + 1].cells[Math.floor(i / 2)];
  if (proxima && !proxima.placeholder) return null; // já existe: está na lista
  const irmao = cols[ci].cells[i % 2 === 0 ? i + 1 : i - 1];
  let adversario = null;
  if (irmao && !irmao.placeholder) {
    const a = ladoIds(irmao, 'a');
    const b = ladoIds(irmao, 'b');
    if (irmao.winner_side) adversario = nomeDoLado(ladoIds(irmao, irmao.winner_side));
    else if ((a.length === 0) !== (b.length === 0)) adversario = nomeDoLado(a.length ? a : b);
    else if (a.length && b.length) adversario = t('{a} ou {b}', { a: nomeDoLado(a), b: nomeDoLado(b) });
  }
  const contra = adversario || (irmao ? refLabel({ tipo: 'vencedor', jogo: irmao.number }) : t('A definir'));
  return {
    kind: decidido ? 'waiting' : 'if_win',
    roundLabel: cols[ci + 1].label,
    opponent: contra,
    text: decidido
      ? t('Próximo: {rodada} contra {quem}.', { rodada: cols[ci + 1].label, quem: contra })
      : t('Se vencer: {rodada} contra {quem}.', { rodada: cols[ci + 1].label, quem: contra }),
  };
}
