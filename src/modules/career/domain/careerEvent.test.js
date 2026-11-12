import { describe, it, expect } from 'vitest';
import {
  CAREER_FORMAT, CAREER_LIMITS, CAREER_STATUS, awaitsResult, isOutsidePlayed, LEGACY_LEVEL_BRACKETS, LEVEL_BRACKETS, formatHasPartner, levelBracketText, bestPosition, careerCompleteness, careerSeal, deriveCareerStatus, entryLabel,
  listRowsToEvents, matchPlatformTournament, newCareerEventId, normalizeCareerEvent, normalizeCareerLink,
  normalizeEntry, normalizePhoto, normalizeTournamentName, registeredProgress, repeatEvent, repeatableEvents,
  withDerivedStatus,
} from './careerEvent.js';

const HOJE = '2026-11-04';
const UID = 'uid_dono_1';
const base = (extra = {}) => ({ name: 'Open de Floripa', start_date: '2026-05-10', entries: [{ format: 'doubles', gender: 'mixed' }], ...extra });

describe('status derivado da data local', () => {
  it('⭐ passada = jogado; futura = planejado; hoje = jogado', () => {
    expect(deriveCareerStatus('2026-11-03', { today: HOJE })).toBe(CAREER_STATUS.PLAYED);
    expect(deriveCareerStatus('2026-11-04', { today: HOJE })).toBe(CAREER_STATUS.PLAYED);
    expect(deriveCareerStatus('2026-11-05', { today: HOJE })).toBe(CAREER_STATUS.PLANNED);
  });
  it('cancelado fica cancelado', () => {
    expect(deriveCareerStatus('2027-01-01', { current: 'cancelled', today: HOJE })).toBe('cancelled');
  });
  it('⭐ na leitura: o gravado "planejado" cuja data passou é jogado (completa, entra na estante)', () => {
    const ev = { id: 'x', status: 'planned', start_date: '2026-11-01', entries: [{ format: 'singles', placement: 'champion' }] };
    const lido = withDerivedStatus(ev, HOJE);
    expect(lido.status).toBe(CAREER_STATUS.PLAYED);
    expect(careerCompleteness(lido)).not.toBeNull();
    expect(withDerivedStatus({ ...ev, status: 'cancelled' }, HOJE).status).toBe('cancelled');
    expect(withDerivedStatus({ ...ev, start_date: '2027-01-01' }, HOJE).status).toBe('planned');
  });
  it('⭐ o PLANO segue planejado até o último dia: no dia é "É hoje", só no dia seguinte "Como foi?"', () => {
    const plano = { id: 'x', status: 'planned', start_date: HOJE, entries: [{ format: 'doubles' }] };
    // No dia do torneio: ainda planejado, sem pendência.
    expect(withDerivedStatus(plano, HOJE)).toBe(plano);
    // Sexta a domingo, no sábado: em andamento.
    const longo = { ...plano, start_date: '2026-11-06', end_date: '2026-11-08' };
    expect(withDerivedStatus(longo, '2026-11-07').status).toBe('planned');
    expect(withDerivedStatus(longo, '2026-11-08').status).toBe('planned');
    // Segunda: passou.
    expect(withDerivedStatus(longo, '2026-11-09')).toMatchObject({ status: 'played', planned_passed: true });
    expect(withDerivedStatus(plano, '2026-11-05')).toMatchObject({ status: 'played', planned_passed: true });
    // Quem já disse a colocação no dia não fica preso em "planejado".
    const comResultado = { ...plano, entries: [{ format: 'doubles', placement: 'semis' }] };
    expect(withDerivedStatus(comResultado, HOJE).status).toBe('played');
    // Fim antes do início não segura nada; registro novo de hoje continua jogado.
    expect(deriveCareerStatus('2026-11-01', { current: 'planned', endDate: '2026-10-01', today: HOJE })).toBe('played');
    expect(deriveCareerStatus(HOJE, { today: HOJE, endDate: '2026-11-08' })).toBe('played');
  });
  it('⭐ plano sem resposta espera o "Como foi?" e não conta como jogado; nem o plano de um torneio daqui', () => {
    const semResposta = withDerivedStatus({ id: 'a', status: 'planned', start_date: '2026-10-01', entries: [{ format: 'doubles' }] }, HOJE);
    const respondido = withDerivedStatus({ id: 'b', status: 'planned', start_date: '2026-10-01', entries: [{ format: 'doubles', placement: 'groups' }] }, HOJE);
    const daqui = withDerivedStatus({ id: 'c', status: 'planned', start_date: '2026-10-01', origin_ref: 'tor:t1', entries: [{ format: 'doubles' }] }, HOJE);
    expect([semResposta, respondido, daqui].map(awaitsResult)).toEqual([true, false, false]);
    expect([semResposta, respondido, daqui, { status: 'played' }, { status: 'cancelled' }].map(isOutsidePlayed)).toEqual([false, true, false, true, false]);
    expect(registeredProgress([semResposta, respondido, daqui], 10)).toMatchObject({ done: 1 });
    // "Não fui": o cancelado gravado continua cancelado, em qualquer data.
    expect(withDerivedStatus({ ...semResposta, status: 'cancelled' }, HOJE).status).toBe('cancelled');
  });
});

describe('normalizeCareerEvent', () => {
  it('⭐ nome, data e uma categoria bastam; status sai da data', () => {
    const r = normalizeCareerEvent(base(), { uid: UID, today: HOJE, nowMs: 5 });
    expect(r.valid).toBe(true);
    expect(r.value).toMatchObject({ uid: UID, status: 'played', name: 'Open de Floripa', start_date: '2026-05-10', created_at_ms: 5, updated_at_ms: 5 });
    expect(r.value.entries).toEqual([{ format: 'doubles', gender: 'mixed', age: null, level_bracket: null, placement: null }]);
    expect(r.value.priority).toBeUndefined();
  });
  it('futuro ganha prioridade (padrão "só para jogar")', () => {
    expect(normalizeCareerEvent(base({ start_date: '2027-02-01' }), { uid: UID, today: HOJE }).value).toMatchObject({ status: 'planned', priority: 'casual' });
  });
  it('recusa sem nome, sem data ou sem categoria', () => {
    expect(normalizeCareerEvent(base({ name: '  ' }), { today: HOJE }).valid).toBe(false);
    expect(normalizeCareerEvent(base({ start_date: '10/05/2026' }), { today: HOJE }).valid).toBe(false);
    expect(normalizeCareerEvent(base({ entries: [] }), { today: HOJE }).valid).toBe(false);
  });
  it('⭐ limites: texto cortado, até 6 categorias e 6 fotos, UF só da lista, fim antes do início some', () => {
    const r = normalizeCareerEvent(base({
      name: 'x'.repeat(500), notes: 'n'.repeat(3000), state: 'zz', end_date: '2026-05-01',
      entries: Array.from({ length: 9 }, () => ({ format: 'singles' })),
      photos: Array.from({ length: 9 }, (_, i) => ({ path: `carreira/${UID}/${i}.webp`, kind: 'medal', alt: 'a' })),
    }), { uid: UID, today: HOJE }).value;
    expect(r.name).toHaveLength(CAREER_LIMITS.name);
    expect(r.notes).toHaveLength(CAREER_LIMITS.notes);
    expect(r.entries).toHaveLength(6);
    expect(r.photos).toHaveLength(6);
    expect(r.state).toBe('');
    expect(r.end_date).toBeNull();
  });
  it('⭐ o plano salvo no dia do torneio continua planejado (o aviso D+1 do servidor depende disso)', () => {
    const n = (extra) => normalizeCareerEvent(base({ start_date: HOJE, status: 'planned', ...extra }), { uid: UID, today: HOJE }).value.status;
    expect(n()).toBe('planned');
    expect(n({ start_date: '2026-11-02', end_date: '2026-11-05' })).toBe('planned');
    expect(n({ entries: [{ format: 'doubles', placement: 'champion' }] })).toBe('played');
    // Registro novo (sem status) com a data de hoje: jogado.
    expect(n({ status: undefined })).toBe('played');
  });
  it('⭐ data que não existe e ano absurdo são recusados; fim com ano absurdo some', () => {
    const v = (extra) => normalizeCareerEvent(base(extra), { today: HOJE });
    expect(v({ start_date: '2026-02-31' }).valid).toBe(false);
    expect(v({ start_date: '0202-05-10' }).valid).toBe(false);
    expect(v({ start_date: '2206-05-10' }).valid).toBe(false);
    expect(v({ start_date: '1990-01-01' }).valid).toBe(true);
    expect(v({ start_date: '2031-12-31' }).valid).toBe(true);
    expect(v({ end_date: '2206-05-12' }).value.end_date).toBeNull();
    expect(v({ end_date: '2026-05-12' }).value.end_date).toBe('2026-05-12');
  });
  it('federação do diretório marca "federado"', () => {
    expect(normalizeCareerEvent(base({ federation_id: 'fgp', federation_acronym: 'FGP' }), { today: HOJE }).value).toMatchObject({ federated: true, federation_id: 'fgp' });
  });
});

describe('participação', () => {
  it('⭐ listas fechadas: valor desconhecido vira vazio, "equipes" vale só aqui', () => {
    expect(normalizeEntry({ format: 'teams', gender: 'x', age: '40plus', level_bracket: '9.9', placement: 'medalha' }))
      .toEqual({ format: 'teams', gender: null, age: null, level_bracket: null, placement: null });
  });
  it('"outro" leva o rótulo livre; pontuação declarada é número', () => {
    const e = normalizeEntry({ format: 'doubles', age: 'other', age_label: '40+', level_bracket: 'other', level_label: 'Iniciante', placement: 'other', placement_n: '5', points_declared: '250' });
    expect(e).toMatchObject({ age_label: '40+', level_label: 'Iniciante', placement_n: 5, points_declared: 250 });
  });
  it('simples não guarda dupla; dupla só guarda o uid quando ele parece um uid', () => {
    expect(normalizeEntry({ format: 'singles', partner: { name: 'Ana' } }).partner).toBeUndefined();
    expect(normalizeEntry({ format: 'doubles', partner: { name: 'Ana', uid: 'abcdef123' } }).partner).toEqual({ uid: 'abcdef123', name: 'Ana' });
    expect(normalizeEntry({ format: 'doubles', partner: { name: 'Ana', uid: '../x' } }).partner).toEqual({ name: 'Ana' });
  });
  it('⭐ americano é formato gravado e não tem dupla fixa (a dupla troca a cada jogo)', () => {
    expect(Object.values(CAREER_FORMAT)).toEqual(['singles', 'doubles', 'teams', 'americano']);
    expect(normalizeEntry({ format: 'americano', partner: { name: 'Ana', uid: 'abcdef123' } })).toEqual({ format: 'americano', gender: null, age: null, level_bracket: null, placement: null });
    expect(['singles', 'americano'].map(formatHasPartner)).toEqual([false, false]);
    expect(['doubles', 'teams'].map(formatHasPartner)).toEqual([true, true]);
    expect(entryLabel({ format: 'americano', gender: 'mixed' })).toBe('Americano Mista');
    // A camada "dupla" não fica pendente no americano.
    const c = careerCompleteness({ status: 'played', entries: [{ format: 'americano', placement: 'champion' }], photos: [{ path: 'carreira/x/a.webp' }] }, { debriefDone: true });
    expect(c.layers.find((l) => l.id === 'dupla').done).toBe(true);
  });
  it('⭐ faixas de nível: a lista nova, na ordem pedida, com o texto de cada uma', () => {
    expect(LEVEL_BRACKETS.map((b) => levelBracketText(b))).toEqual([
      'Entre 2,000 e 2,999', 'Entre 3,000 e 3,499', 'Entre 3,500 e 3,999', 'Entre 3,000 e 3,999', 'Entre 4,000 e 4,499',
      'Superior a 4,500', 'Iniciante', 'Intermediário', 'Avançado', 'PRO', 'OPEN', 'Outra',
    ]);
    expect(entryLabel(normalizeEntry({ format: 'doubles', gender: 'mixed', level_bracket: '3.500-3.999' }))).toBe('Duplas Mista · Entre 3,500 e 3,999');
  });
  it('🔴 faixa da lista antiga já gravada não se perde: salva de novo e aparece como foi gravada', () => {
    for (const b of LEGACY_LEVEL_BRACKETS) {
      expect(LEVEL_BRACKETS).not.toContain(b);
      expect(normalizeEntry({ format: 'doubles', level_bracket: b }).level_bracket).toBe(b);
      expect(levelBracketText(b)).toBe(b);
    }
    expect(levelBracketText('open')).toBe('OPEN');
    expect(levelBracketText('other', 'B+')).toBe('B+');
  });
  it('rótulo e melhor degrau', () => {
    expect(entryLabel(normalizeEntry({ format: 'doubles', gender: 'mixed', level_bracket: '4.0' }))).toBe('Duplas Mista · 4.0');
    expect(bestPosition({ entries: [{ placement: 'semis' }, { placement: 'runner_up' }, { placement: 'third' }] })).toBe(2);
    expect(bestPosition({ entries: [{ placement: 'groups' }] })).toBeNull();
  });
});

describe('foto e link', () => {
  it('🔴 foto só da pasta do dono; tipo fora da lista vira "other"', () => {
    expect(normalizePhoto({ path: 'carreira/outro/a.webp' }, UID)).toBeNull();
    expect(normalizePhoto({ path: 'treino/uid_dono_1/a.webp' }, UID)).toBeNull();
    expect(normalizePhoto({ path: `carreira/${UID}/a.webp`, url: 'https://x/y', kind: 'selfie', alt: 'Medalha' }, UID))
      .toEqual({ path: `carreira/${UID}/a.webp`, url: 'https://x/y', kind: 'other', alt: 'Medalha' });
  });
  it('🔴 link só https, sem usuário, ≤ 300', () => {
    expect(normalizeCareerLink('https://fgp.com.br/etapa')).toBe('https://fgp.com.br/etapa');
    expect(normalizeCareerLink('http://fgp.com.br')).toBe('');
    expect(normalizeCareerLink('javascript:alert(1)')).toBe('');
    expect(normalizeCareerLink('https://a:b@fgp.com.br')).toBe('');
    expect(normalizeCareerLink(`https://fgp.com.br/${'a'.repeat(300)}`)).toBe('');
  });
});

describe('completude em camadas', () => {
  const ev = (extra) => normalizeCareerEvent(base(extra), { uid: UID, today: HOJE }).value;
  it('⭐ "0 de 3" com o ÚNICO próximo passo; o balanço só conta quando existe', () => {
    const c = careerCompleteness(ev());
    expect([c.done, c.total]).toEqual([0, 3]);
    expect(c.next.id).toBe('resultado');
    expect(careerCompleteness(ev(), { debriefDone: false }).total).toBe(4);
  });
  it('⭐ "N de 4": o balanço conta e é o próximo passo quando é o que falta', () => {
    const completo = { entries: [{ format: 'singles', placement: 'champion' }], photos: [{ path: `carreira/${UID}/a.webp` }] };
    const sem = careerCompleteness(ev(completo), { debriefDone: false });
    expect([sem.done, sem.total, sem.next.id]).toEqual([3, 4, 'balanco']);
    const com = careerCompleteness(ev(completo), { debriefDone: true });
    expect([com.done, com.total, com.next]).toEqual([4, 4, null]);
  });
  it('resultado + foto ⇒ falta a dupla; simples não precisa de dupla', () => {
    const c = careerCompleteness(ev({ entries: [{ format: 'doubles', placement: 'champion' }], photos: [{ path: `carreira/${UID}/a.webp` }] }));
    expect([c.done, c.next.id]).toEqual([2, 'dupla']);
    const s = careerCompleteness(ev({ entries: [{ format: 'singles', placement: 'champion' }], photos: [{ path: `carreira/${UID}/a.webp` }] }));
    expect([s.done, s.total, s.next]).toEqual([3, 3, null]);
  });
  it('planejado não tem o que completar', () => {
    expect(careerCompleteness(ev({ start_date: '2027-01-01' }))).toBeNull();
  });
});

describe('"É este?"', () => {
  const meus = [
    { id: 't1', name: 'Open Floripa 2026', starts_at: '2026-05-11', city: 'Florianópolis', is_player: true },
    { id: 't2', name: 'Open de Floripa', starts_at: '2026-05-10', city: 'Florianópolis', is_player: false },
    { id: 't3', name: 'Copa Sul', starts_at: '2026-05-10', is_player: true },
  ];
  const ev = { name: 'Open de Floripa', start_date: '2026-05-10', city: 'florianopolis' };
  it('⭐ nome normalizado + data ±3 dias + cidade, só onde a pessoa JOGOU', () => {
    expect(matchPlatformTournament(ev, meus)?.id).toBe('t1');
    expect(normalizeTournamentName('Open de Floripa 2026')).toEqual(['floripa']);
  });
  it('fora da janela, outra cidade ou nome diferente: nenhum', () => {
    expect(matchPlatformTournament({ ...ev, start_date: '2026-05-20' }, meus)).toBeNull();
    expect(matchPlatformTournament({ ...ev, city: 'Joinville' }, meus)).toBeNull();
    expect(matchPlatformTournament({ ...ev, name: 'Liga Norte' }, meus)).toBeNull();
  });
  it('🔴 lista que falhou não vira "não está na plataforma"', () => {
    expect(matchPlatformTournament(ev, undefined)).toBeNull();
  });
  it('selo oficial só com o torneio na lista de quem jogou', () => {
    expect(careerSeal({ platform_tournament_id: 't1' }, meus)).toBe('official');
    expect(careerSeal({ platform_tournament_id: 't2' }, meus)).toBe('declared');
    expect(careerSeal({ platform_tournament_id: 't1' }, undefined)).toBe('declared');
  });
});

describe('modo lista', () => {
  it('⭐ linhas → eventos de ano (1º de janeiro), linha sem nome ignorada, ano inválido dito', () => {
    const { events, errors } = listRowsToEvents([
      { year: 2023, name: 'Etapa Sul', format: 'doubles', gender: 'male', placement: 'champion' },
      { year: 2024, name: '' },
      { year: 2031, name: 'Futuro' },
    ], { uid: UID, today: HOJE, nowMs: 100, rand: () => 0.5 });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ uid: UID, start_date: '2023-01-01', date_precision: 'year', status: 'played' });
    expect(events[0].id.startsWith(`${UID}_`)).toBe(true);
    expect(errors).toEqual([{ row: 2, error: expect.any(String) }]);
  });
  it('⭐ a linha com id do dono o mantém (salvar de novo regrava o mesmo documento); id alheio é trocado', () => {
    const linhas = [{ id: `${UID}_fixo`, year: 2023, name: 'A' }, { id: 'outro_x', year: 2023, name: 'B' }];
    const um = listRowsToEvents(linhas, { uid: UID, today: HOJE });
    const dois = listRowsToEvents(linhas, { uid: UID, today: HOJE });
    expect(um.events[0].id).toBe(`${UID}_fixo`);
    expect(dois.events[0].id).toBe(`${UID}_fixo`);
    expect(um.events[1].id).not.toBe('outro_x');
    expect(um.events[1].id.startsWith(`${UID}_`)).toBe(true);
  });
  it('linha sem nome mas com categoria ou medalha é erro; a vazia segue ignorada', () => {
    const { events, errors } = listRowsToEvents([{ year: 2024, name: '', placement: 'champion' }, { year: 2024, name: ' ' }], { uid: UID, today: HOJE });
    expect(events).toEqual([]);
    expect(errors).toEqual([{ row: 0, error: expect.any(String) }]);
  });
  it('"7 de ~20": só com a estimativa', () => {
    expect(registeredProgress([{ status: 'played' }, { status: 'planned' }], 20)).toEqual({ done: 1, estimate: 20, complete: false });
    expect(registeredProgress([], null)).toBeNull();
    // A lista que não carregou não vira "0 de ~20".
    expect(registeredProgress(undefined, 20)).toBeNull();
  });
  it('torneio rascunho ou privado não dá selo oficial', () => {
    const ev = { platform_tournament_id: 't1' };
    expect(careerSeal(ev, [{ id: 't1', is_player: true, status: 'finished', visibility: 'public' }])).toBe('official');
    expect(careerSeal(ev, [{ id: 't1', is_player: true, status: 'draft' }])).toBe('declared');
    expect(careerSeal(ev, [{ id: 't1', is_player: true, status: 'finished', visibility: 'private' }])).toBe('declared');
  });
  it('id novo leva o prefixo do dono', () => {
    expect(newCareerEventId(UID, 1000, 0.1).startsWith(`${UID}_`)).toBe(true);
  });
});

describe('repetir o do ano passado', () => {
  it('⭐ nome (com o ano somado), organizador, cidade e federação; resultado em branco', () => {
    const r = repeatEvent({ name: 'Open Floripa 2025', organizer: 'FCP', city: 'Floripa', state: 'SC', federation_id: 'f', federation_acronym: 'FCP', federated: true, start_date: '2025-05-10', entries: [{ placement: 'champion' }] }, '2026-03-01');
    expect(r).toMatchObject({ name: 'Open Floripa 2026', organizer: 'FCP', city: 'Floripa', state: 'SC', federation_id: 'f', federated: true, start_date: '2026-05-09' });
    expect(r.entries).toBeUndefined();
  });
  it('⭐ torneio de anos atrás vem para ESTE ano; do ano corrente, +1', () => {
    const ev = (ano) => ({ name: `Open de Gramado ${ano}`, start_date: `${ano}-12-10` });
    expect(repeatEvent(ev(2024), HOJE)).toMatchObject({ name: 'Open de Gramado 2026', start_date: '2026-12-08' });
    expect(repeatEvent(ev(2023), HOJE)).toMatchObject({ name: 'Open de Gramado 2026', start_date: '2026-12-06' });
    expect(repeatEvent(ev(2025), HOJE)).toMatchObject({ name: 'Open de Gramado 2026', start_date: '2026-12-09' });
    expect(repeatEvent(ev(2026), HOJE)).toMatchObject({ name: 'Open de Gramado 2027', start_date: '2027-12-09' });
  });
  it('⭐ a sugestão nunca nasce no passado: a data deste ano já passou ⇒ vai para o próximo', () => {
    const ev = (ano) => ({ name: `Open de Gramado ${ano}`, start_date: `${ano}-08-10` });
    expect(repeatEvent(ev(2025), HOJE)).toMatchObject({ name: 'Open de Gramado 2027', start_date: '2027-08-08' });
    expect(repeatEvent(ev(2023), HOJE)).toMatchObject({ name: 'Open de Gramado 2027', start_date: '2027-08-05' });
    // Só o ano conhecido: sem data sugerida, e o nome anda uma edição.
    expect(repeatEvent({ name: 'Copa 2025', start_date: '2025-01-01', date_precision: 'year' }, HOJE)).toMatchObject({ name: 'Copa 2026', start_date: '' });
  });
  it('⭐ o plano de um torneio do PickleRush que passou não é "repetir" (duplicaria o oficial)', () => {
    expect(repeatableEvents([{ status: 'played', start_date: '2025-01-01', origin_ref: 'tor:t1' }, { status: 'played', planned_passed: true, start_date: '2025-02-01', entries: [{}] }], HOJE)).toEqual([]);
  });
  it('só os jogados de anos anteriores', () => {
    const l = repeatableEvents([{ status: 'played', start_date: '2025-01-01' }, { status: 'played', start_date: '2026-03-01' }, { status: 'planned', start_date: '2024-01-01' }], HOJE);
    expect(l.map((e) => e.start_date)).toEqual(['2025-01-01']);
  });
});
