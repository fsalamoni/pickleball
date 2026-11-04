import { describe, expect, it } from 'vitest';
import { TRAINING_DEBRIEFS } from '@/modules/training/services/debriefService.js';
import {
  CAREER_DEBRIEF_COLLECTION, CAREER_DEBRIEF_DONE, CAREER_DEBRIEF_TYPE, careerDebriefDocId, careerDebriefFor, careerDebriefSource,
} from './careerDebrief.js';
import {
  DEBRIEF_SOURCE, DEBRIEF_STATUS, debriefId, debriefSourceKey, normalizeDebrief,
} from '@/modules/training/domain/debrief.js';

describe('paridade com o domínio do balanço', () => {
  it('a origem e o status são os mesmos (cópias para não pesar a estante)', () => {
    expect(CAREER_DEBRIEF_TYPE).toBe(DEBRIEF_SOURCE.EXTERNO);
    expect(CAREER_DEBRIEF_DONE).toBe(DEBRIEF_STATUS.RESPONDIDO);
    expect(CAREER_DEBRIEF_COLLECTION).toBe(TRAINING_DEBRIEFS);
    const ev1 = { id: 'u1_mabc', status: 'played', start_date: '2026-05-10', name: 'X' };
    expect(careerDebriefDocId('u1', ev1.id)).toBe(debriefId('u1', careerDebriefSource(ev1)));
  });
  it('o id do evento já é uma chave segura: o `ref_id` não muda na normalização', () => {
    const s = careerDebriefSource({ id: 'Ab9_x-1mabc', status: 'played', start_date: '2026-05-10', name: 'X' });
    expect(debriefSourceKey(s)).toBe('externo_Ab9_x-1mabc');
  });
});

const UID = 'uid_dono_1';
const ev = (extra = {}) => ({
  id: `${UID}_mabc123`, uid: UID, name: 'Open de Floripa', start_date: '2026-05-10', status: 'played', entries: [], ...extra,
});

describe('origem do balanço do torneio de fora', () => {
  it('⭐ origem `externo`, ref = id do evento, id `{uid}_externo_{evento}`', () => {
    const s = careerDebriefSource(ev({ end_date: '2026-05-11' }));
    expect(s).toMatchObject({ type: 'externo', ref_id: `${UID}_mabc123`, title: 'Open de Floripa', date: '2026-05-11', games: null, wins: null });
    expect(debriefId(UID, s)).toBe(`${UID}_externo_${UID}_mabc123`);
    expect(normalizeDebrief({ source: s, rating: 4 }).valid).toBe(true);
  });

  it('balanço só para torneio já jogado', () => {
    expect(careerDebriefSource(ev({ status: 'planned', start_date: '2027-01-01' }))).toBeNull();
    expect(careerDebriefSource(ev({ status: 'cancelled' }))).toBeNull();
    expect(careerDebriefSource(null)).toBeNull();
  });

  it('modo lista (só o ano): grava o 1º de janeiro, mas a tela mostra o ano', () => {
    const s = careerDebriefSource(ev({ start_date: '2024-01-01', date_precision: 'year', end_date: '2024-03-01' }));
    expect([s.date, s.dateLabel]).toEqual(['2024-01-01', '2024']);
    // `dateLabel` não é gravado: o normalizado não o leva.
    expect(normalizeDebrief({ source: s, rating: 3 }).value.source.dateLabel).toBeUndefined();
  });

  it('acha o balanço RESPONDIDO do torneio; dispensado ou de outro torneio não', () => {
    const fonte = careerDebriefSource(ev());
    const feito = { source: fonte, status: 'respondido' };
    expect(careerDebriefFor(ev(), [feito])).toBe(feito);
    expect(careerDebriefFor(ev(), [{ source: fonte, status: 'dispensado' }])).toBeNull();
    expect(careerDebriefFor(ev(), [{ source: { ...fonte, ref_id: 'outro' }, status: 'respondido' }])).toBeNull();
    expect(careerDebriefFor(ev(), [{ source: { ...fonte, type: 'torneio' }, status: 'respondido' }])).toBeNull();
  });
});
