import { describe, it, expect } from 'vitest';
import { describeRankingWorker, describeRankingExclusions, formatarMomento, MOTIVO_LABEL } from './rankingWorkerStatus.js';

const ts = (iso) => ({ toMillis: () => Date.parse(iso) });

describe('describeRankingWorker', () => {
  it('sem documento: o servidor nunca registrou passada', () => {
    expect(describeRankingWorker(null)).toEqual({
      registrado: false, ultimaPassadaMs: 0, motivo: null, emCurso: false, erro: null,
    });
  });

  it('⭐ o caso real: última passada de 18/09, motivo em português', () => {
    const e = describeRankingWorker({
      last_run_at: ts('2026-09-18T00:26:38Z'),
      last_request_reason: 'club-event-game',
      running_since: null,
    });
    expect(e.registrado).toBe(true);
    expect(e.ultimaPassadaMs).toBe(Date.parse('2026-09-18T00:26:38Z'));
    expect(e.motivo).toBe('dia de jogo publicado');
    expect(e.emCurso).toBe(false);
    expect(e.erro).toBeNull();
  });

  it('recálculo em curso é reconhecido', () => {
    expect(describeRankingWorker({ running_since: ts('2026-09-24T10:00:00Z') }).emCurso).toBe(true);
  });

  it('⭐ erro DEPOIS da última passada aparece', () => {
    const e = describeRankingWorker({
      last_run_at: ts('2026-09-18T00:00:00Z'),
      last_error: 'DEADLINE_EXCEEDED',
      last_error_at: ts('2026-09-19T00:00:00Z'),
    });
    expect(e.erro).toEqual({ mensagem: 'DEADLINE_EXCEEDED', ms: Date.parse('2026-09-19T00:00:00Z') });
  });

  it('erro ANTIGO, superado por uma passada bem-sucedida, não aparece', () => {
    const e = describeRankingWorker({
      last_run_at: ts('2026-09-20T00:00:00Z'),
      last_error: 'DEADLINE_EXCEEDED',
      last_error_at: ts('2026-09-19T00:00:00Z'),
    });
    expect(e.erro).toBeNull();
  });

  it('motivo desconhecido é mostrado cru, em vez de sumir', () => {
    expect(describeRankingWorker({ last_run_at: 5, last_request_reason: 'outro' }).motivo).toBe('outro');
  });

  it('aceita { seconds } (formato serializado)', () => {
    expect(describeRankingWorker({ last_run_at: { seconds: 10 } }).ultimaPassadaMs).toBe(10_000);
  });

  it('todos os motivos gravados pelos gatilhos têm rótulo', () => {
    ['tournament-change', 'tournament-match', 'tournament-registration', 'club-event-game', 'recuperacao-agendada']
      .forEach((m) => expect(MOTIVO_LABEL[m]).toBeTruthy());
  });
});

describe('formatarMomento', () => {
  it('pt-BR, no fuso de Brasília (00:26 UTC é 21:26 do dia anterior)', () => {
    expect(formatarMomento(Date.parse('2026-09-18T00:26:38Z'))).toBe('17/09/2026, 21:26');
  });

  it('sem momento, texto vazio', () => {
    expect(formatarMomento(0)).toBe('');
  });
});

describe('describeRankingExclusions — o que ficou fora e por quê', () => {
  it('sem relatório (servidor antigo) não afirma nada', () => {
    expect(describeRankingExclusions(null)).toBeNull();
    expect(describeRankingExclusions({ last_result: {} })).toBeNull();
  });

  it('traduz as contagens em linhas acionáveis, sem linha para zero', () => {
    const r = describeRankingExclusions({
      last_result: {
        excluded: {
          torneio: { lidas: 10, usadas: 4, por_motivo: { sem_conta: 3, torneio_fora: 3 }, torneio_fora: { rascunho: 2, privado: 1 } },
          dia_de_jogo: { lidas: 5, usadas: 5, por_motivo: {} },
          sem_placar: 1,
          torneios: [{ id: 't1', nome: 'Aberto', motivo: 'sem_conta', partidas_fora: 3, inscricoes_sem_conta: 2 }],
        },
      },
    });
    expect(r.usadas).toBe(9);
    expect(r.fora).toBe(6);
    expect(r.linhas.map((l) => l.chave)).toEqual(['sem_conta', 'torneio_rascunho', 'torneio_privado']);
    expect(r.torneios[0]).toMatchObject({ id: 't1', nome: 'Aberto', partidasFora: 3, texto: '2 inscrição(ões) sem conta' });
    expect(r.semPlacar).toBe(1);
  });
});
