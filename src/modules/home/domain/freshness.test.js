import { describe, it, expect } from 'vitest';
import { Timestamp } from 'firebase/firestore';
import {
  hojeLocal, diaLocal, instanteLocal,
  TOURNAMENT_PHASE, tournamentPhase, isTournamentOpen, isTournamentCurrent,
  diasAte, prazoRelativo,
} from './freshness.js';

const HOJE = '2026-09-26';
const t = (over = {}) => ({ id: 't1', status: 'registrations_open', ...over });

describe('hojeLocal / diaLocal', () => {
  it('hoje é o dia LOCAL', () => {
    expect(hojeLocal(new Date(2026, 8, 26, 23, 30))).toBe('2026-09-26');
  });

  it('texto de data é um dia, não um instante (não recua para o dia anterior no Brasil)', () => {
    expect(diaLocal('2026-09-26')).toBe('2026-09-26');
  });

  it('Timestamp do banco vira o dia local de quem olha', () => {
    const ts = Timestamp.fromDate(new Date(2026, 8, 26, 10, 0));
    expect(diaLocal(ts)).toBe('2026-09-26');
  });

  it('ms e ISO com hora também são aceitos; lixo vira null', () => {
    expect(diaLocal(new Date(2026, 8, 26, 12).getTime())).toBe('2026-09-26');
    expect(diaLocal(null)).toBeNull();
    expect(diaLocal('')).toBeNull();
    expect(diaLocal('amanhã')).toBeNull();
  });

  it('instanteLocal sem hora vale o fim do dia', () => {
    const fim = instanteLocal('2026-09-26');
    expect(new Date(fim).getHours()).toBe(23);
    expect(new Date(instanteLocal('2026-09-26', '19:30')).getHours()).toBe(19);
    expect(Number.isNaN(instanteLocal('26/09/2026'))).toBe(true);
  });
});

describe('tournamentPhase — o torneio encerrado nunca é atual', () => {
  it('encerrado, cancelado e arquivado ficam de fora', () => {
    expect(tournamentPhase(t({ status: 'finished' }), HOJE)).toBe(TOURNAMENT_PHASE.OVER);
    expect(tournamentPhase(t({ status: 'cancelled' }), HOJE)).toBe(TOURNAMENT_PHASE.OVER);
    expect(tournamentPhase(t({ archived: true }), HOJE)).toBe(TOURNAMENT_PHASE.OVER);
    expect(isTournamentCurrent(t({ status: 'finished' }), HOJE)).toBe(false);
  });

  it('inscrição aberta com o prazo em dia é ABERTA', () => {
    expect(tournamentPhase(t({ registration_deadline: '2026-09-30', starts_at: '2026-10-03' }), HOJE))
      .toBe(TOURNAMENT_PHASE.OPEN);
    expect(isTournamentOpen(t({ registration_deadline: HOJE }), HOJE)).toBe(true);
  });

  it('🐞 "inscrições abertas" com o prazo VENCIDO não aceita ninguém', () => {
    const vencido = t({ registration_deadline: '2026-09-20', starts_at: '2026-10-03' });
    expect(isTournamentOpen(vencido, HOJE)).toBe(false);
    expect(tournamentPhase(vencido, HOJE)).toBe(TOURNAMENT_PHASE.UPCOMING);
  });

  it('🐞 torneio cuja data de fim passou não é atual, mesmo com status aberto', () => {
    expect(tournamentPhase(t({ ends_at: '2026-09-20' }), HOJE)).toBe(TOURNAMENT_PHASE.STALE);
    expect(isTournamentCurrent(t({ ends_at: '2026-09-20' }), HOJE)).toBe(false);
  });

  it('"em andamento" com o fim vencido é esquecido, não ao vivo', () => {
    expect(tournamentPhase(t({ status: 'in_progress', ends_at: '2026-09-25' }), HOJE)).toBe(TOURNAMENT_PHASE.STALE);
    expect(tournamentPhase(t({ status: 'in_progress', ends_at: HOJE }), HOJE)).toBe(TOURNAMENT_PHASE.LIVE);
    expect(tournamentPhase(t({ status: 'in_progress' }), HOJE)).toBe(TOURNAMENT_PHASE.LIVE);
  });

  it('inscrições encerradas: em breve até começar, depois acontecendo', () => {
    expect(tournamentPhase(t({ status: 'registrations_closed', starts_at: '2026-10-01' }), HOJE)).toBe(TOURNAMENT_PHASE.UPCOMING);
    expect(tournamentPhase(t({ status: 'registrations_closed', starts_at: HOJE, ends_at: '2026-09-27' }), HOJE)).toBe(TOURNAMENT_PHASE.LIVE);
  });

  it('sem fim, vale o início como último dia', () => {
    expect(tournamentPhase(t({ status: 'registrations_closed', starts_at: '2026-09-20' }), HOJE)).toBe(TOURNAMENT_PHASE.STALE);
  });

  it('rascunho é rascunho; status desconhecido nunca é atual', () => {
    expect(tournamentPhase(t({ status: 'draft' }), HOJE)).toBe(TOURNAMENT_PHASE.DRAFT);
    expect(isTournamentCurrent(t({ status: 'draft' }), HOJE)).toBe(false);
    expect(tournamentPhase(t({ status: 'xyz' }), HOJE)).toBe(TOURNAMENT_PHASE.OVER);
    expect(tournamentPhase(null, HOJE)).toBe(TOURNAMENT_PHASE.OVER);
  });

  it('aceita datas gravadas como Timestamp', () => {
    const ontem = Timestamp.fromDate(new Date(2026, 8, 25, 12));
    expect(tournamentPhase(t({ ends_at: ontem }), HOJE)).toBe(TOURNAMENT_PHASE.STALE);
  });
});

describe('diasAte / prazoRelativo', () => {
  it('conta dias de calendário, sem depender de hora ou horário de verão', () => {
    expect(diasAte(HOJE, HOJE)).toBe(0);
    expect(diasAte('2026-09-27', HOJE)).toBe(1);
    expect(diasAte('2026-10-26', HOJE)).toBe(30);
    expect(diasAte('2026-09-20', HOJE)).toBe(-6);
    expect(diasAte(null, HOJE)).toBeNull();
  });

  it('fala como gente até uma semana, e cala depois', () => {
    expect(prazoRelativo(HOJE, HOJE)).toBe('hoje');
    expect(prazoRelativo('2026-09-27', HOJE)).toBe('amanhã');
    expect(prazoRelativo('2026-10-01', HOJE)).toBe('em 5 dias');
    expect(prazoRelativo('2026-10-20', HOJE)).toBeNull();
    expect(prazoRelativo('2026-09-20', HOJE)).toBeNull();
  });
});
