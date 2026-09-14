import { describe, it, expect } from 'vitest';
import {
  minutesOfTime, isoDay, newKioskToken, isKioskTokenFresh, kioskCodeMatches,
  bookingDayWindow, checkinState, myCheckinBookings, attendanceOfDay,
  noShowCandidates, checkinBlockedReason,
  KIOSK_TOKEN_TTL_MS, KIOSK_CODE_LEN,
} from './checkin.js';

/** Um `Date` local em 2026-09-14 às `hh:mm`. */
const emHoje = (hh, mm = 0) => new Date(2026, 8, 14, hh, mm, 0);
const HOJE = '2026-09-14';

const reserva = (over = {}) => ({
  id: 'b1',
  arena_id: 'a1',
  athlete_id: 'u1',
  status: 'confirmed',
  slots: [{ date: HOJE, start: '19:00', end: '20:00' }],
  ...over,
});

describe('minutesOfTime', () => {
  it('converte HH:MM', () => {
    expect(minutesOfTime('00:00')).toBe(0);
    expect(minutesOfTime('19:30')).toBe(19 * 60 + 30);
    expect(minutesOfTime('9:05')).toBe(9 * 60 + 5);
  });

  it('recusa hora inválida em vez de devolver NaN', () => {
    expect(minutesOfTime('25:00')).toBeNull();
    expect(minutesOfTime('19:70')).toBeNull();
    expect(minutesOfTime('tarde')).toBeNull();
    expect(minutesOfTime(null)).toBeNull();
  });
});

describe('isoDay', () => {
  it('usa a data LOCAL, não UTC', () => {
    // 23h no fuso local é o dia seguinte em UTC. Usar toISOString aqui daria
    // o dia errado para toda reserva noturna — que é a maioria.
    expect(isoDay(new Date(2026, 8, 14, 23, 30))).toBe('2026-09-14');
  });
});

describe('newKioskToken', () => {
  it('gera código do tamanho combinado, só com o alfabeto sem ambiguidade', () => {
    const { code } = newKioskToken(0, () => 0.5);
    expect(code).toHaveLength(KIOSK_CODE_LEN);
    expect(code).toMatch(/^[ABCDEFGHJKMNPQRTUVWXYZ2346789]+$/);
  });

  it('nunca inclui 0, O, 1, I, L, 5 nem S', () => {
    let todos = '';
    for (let i = 0; i < 200; i += 1) {
      todos += newKioskToken(0, () => i / 200).code;
    }
    expect(todos).not.toMatch(/[0O1IL5S]/);
  });

  it('carimba a validade', () => {
    const t = newKioskToken(1000, () => 0);
    expect(t.issued_at_ms).toBe(1000);
    expect(t.expires_at_ms).toBe(1000 + KIOSK_TOKEN_TTL_MS);
  });
});

describe('isKioskTokenFresh / kioskCodeMatches', () => {
  const device = { checkin_token: { code: 'AB2CD', expires_at_ms: 10_000 } };

  it('vale antes de vencer e não vale depois', () => {
    expect(isKioskTokenFresh(device, 9_999)).toBe(true);
    expect(isKioskTokenFresh(device, 10_000)).toBe(false);
    expect(isKioskTokenFresh(device, 10_001)).toBe(false);
  });

  it('aceita minúscula e espaço — o erro é do teclado, não da pessoa', () => {
    expect(kioskCodeMatches(device, 'ab2cd', 0)).toBe(true);
    expect(kioskCodeMatches(device, ' AB2 CD ', 0)).toBe(true);
  });

  it('recusa código vencido, mesmo correto', () => {
    expect(kioskCodeMatches(device, 'AB2CD', 20_000)).toBe(false);
  });

  it('recusa código vazio dos dois lados (senão "sem totem" viraria "entra todo mundo")', () => {
    expect(kioskCodeMatches(device, '', 0)).toBe(false);
    expect(kioskCodeMatches({ checkin_token: { code: '', expires_at_ms: 10_000 } }, '', 0)).toBe(false);
    expect(kioskCodeMatches(null, 'AB2CD', 0)).toBe(false);
  });
});

describe('bookingDayWindow', () => {
  it('junta vários horários do MESMO dia numa janela só', () => {
    const b = reserva({
      slots: [
        { date: HOJE, start: '19:00', end: '20:00' },
        { date: HOJE, start: '20:00', end: '21:00' },
      ],
    });
    expect(bookingDayWindow(b, HOJE)).toEqual({ start: 19 * 60, end: 21 * 60 });
  });

  it('ignora os horários de outro dia', () => {
    const b = reserva({
      slots: [
        { date: '2026-09-13', start: '08:00', end: '09:00' },
        { date: HOJE, start: '19:00', end: '20:00' },
      ],
    });
    expect(bookingDayWindow(b, HOJE)).toEqual({ start: 19 * 60, end: 20 * 60 });
  });

  it('reserva sem horário naquele dia devolve null', () => {
    expect(bookingDayWindow(reserva(), '2026-09-15')).toBeNull();
  });
});

describe('checkinState', () => {
  it('abre 1 hora antes', () => {
    expect(checkinState(reserva(), emHoje(17, 59)).state).toBe('early');
    expect(checkinState(reserva(), emHoje(18, 0)).state).toBe('open');
    expect(checkinState(reserva(), emHoje(19, 30)).state).toBe('open');
  });

  it('fecha 30 minutos depois do fim', () => {
    expect(checkinState(reserva(), emHoje(20, 30)).state).toBe('open');
    expect(checkinState(reserva(), emHoje(20, 31)).state).toBe('late');
  });

  it('quem já chegou continua "chegou" — inclusive fora da janela', () => {
    const b = reserva({ checked_in_at: 'ontem' });
    expect(checkinState(b, emHoje(23, 0)).state).toBe('checked_in');
  });

  it('pedido não aceito não tem chegada', () => {
    expect(checkinState(reserva({ status: 'requested' }), emHoje(19)).state).toBe('not_confirmed');
    expect(checkinState(reserva({ status: 'cancelled' }), emHoje(19)).state).toBe('cancelled');
    expect(checkinState(reserva({ status: 'rejected' }), emHoje(19)).state).toBe('cancelled');
  });

  it('reserva de outro dia não é chegada de hoje', () => {
    const b = reserva({ slots: [{ date: '2026-09-20', start: '19:00', end: '20:00' }] });
    expect(checkinState(b, emHoje(19)).state).toBe('other_day');
  });

  it('diz quantos minutos faltam, para a tela poder explicar', () => {
    expect(checkinState(reserva(), emHoje(17, 0)).minutesToStart).toBe(120);
  });
});

describe('myCheckinBookings', () => {
  it('traz as de hoje desta arena, da mais cedo para a mais tarde', () => {
    const cedo = reserva({ id: 'cedo', slots: [{ date: HOJE, start: '08:00', end: '09:00' }] });
    const tarde = reserva({ id: 'tarde' });
    const lista = myCheckinBookings([tarde, cedo], 'u1', 'a1', emHoje(7, 30));
    expect(lista.map((b) => b.id)).toEqual(['cedo', 'tarde']);
  });

  it('inclui quem só PARTICIPA — quem dividiu a quadra também chega', () => {
    const b = reserva({ athlete_id: 'outro', participant_ids: ['u1'] });
    expect(myCheckinBookings([b], 'u1', 'a1', emHoje(19)).map((x) => x.id)).toEqual(['b1']);
  });

  it('não traz reserva de outra arena', () => {
    expect(myCheckinBookings([reserva({ arena_id: 'a2' })], 'u1', 'a1', emHoje(19))).toEqual([]);
  });

  it('mantém quem já chegou (senão o cartão some e a pessoa toca de novo)', () => {
    const b = reserva({ checked_in_at: 'x' });
    const lista = myCheckinBookings([b], 'u1', 'a1', emHoje(19));
    expect(lista).toHaveLength(1);
    expect(lista[0].checkin.state).toBe('checked_in');
  });

  it('some com a que já passou da hora', () => {
    expect(myCheckinBookings([reserva()], 'u1', 'a1', emHoje(22))).toEqual([]);
  });
});

describe('attendanceOfDay', () => {
  const presente = reserva({ id: 'p', checked_in_at: 'x' });
  const aberta = reserva({ id: 'ab', slots: [{ date: HOJE, start: '21:00', end: '22:00' }] });
  const perdida = reserva({ id: 'pe', slots: [{ date: HOJE, start: '08:00', end: '09:00' }] });

  it('não chama de falta quem ainda está na janela', () => {
    const r = attendanceOfDay([aberta], HOJE, emHoje(21, 10));
    expect(r.linhas[0].situacao).toBe('aguardando');
    expect(r.faltas).toBe(0);
  });

  it('conta falta só depois que a janela fecha', () => {
    expect(attendanceOfDay([perdida], HOJE, emHoje(9, 20)).faltas).toBe(0);
    expect(attendanceOfDay([perdida], HOJE, emHoje(9, 31)).faltas).toBe(1);
  });

  it('num dia PASSADO tudo já está decidido', () => {
    const ontem = reserva({ id: 'o', slots: [{ date: '2026-09-13', start: '19:00', end: '20:00' }] });
    const r = attendanceOfDay([ontem], '2026-09-13', emHoje(6, 0));
    expect(r.linhas[0].situacao).toBe('faltou');
  });

  it('a taxa sai sobre o que foi DECIDIDO, não sobre o dia inteiro', () => {
    // Às 9h30: uma falta (08h), uma presente, uma ainda por vir (21h).
    const r = attendanceOfDay([perdida, presente, aberta], HOJE, emHoje(9, 31));
    expect(r.presentes).toBe(1);
    expect(r.faltas).toBe(1);
    expect(r.aguardando).toBe(1);
    expect(r.taxaFalta).toBe(50);
  });

  it('não divide por zero quando nada foi decidido', () => {
    expect(attendanceOfDay([aberta], HOJE, emHoje(21, 10)).taxaFalta).toBe(0);
  });

  it('ignora pedido não confirmado — não há presença a cobrar', () => {
    const pedido = reserva({ id: 'req', status: 'requested' });
    expect(attendanceOfDay([pedido], HOJE, emHoje(23)).total).toBe(0);
  });

  it('respeita o no_show que a arena já tinha marcado', () => {
    const marcada = reserva({ id: 'm', no_show: true });
    const r = attendanceOfDay([marcada], HOJE, emHoje(19, 10));
    expect(r.linhas[0].situacao).toBe('faltou');
    expect(r.linhas[0].pendenteDeMarcacao).toBe(false);
  });

  it('sai em ordem de horário', () => {
    const r = attendanceOfDay([reserva({ id: 'tarde' }), perdida], HOJE, emHoje(23));
    expect(r.linhas.map((l) => l.id)).toEqual(['pe', 'tarde']);
  });
});

describe('noShowCandidates', () => {
  it('devolve só quem faltou e ainda não foi marcado', () => {
    const faltou = reserva({ id: 'f', slots: [{ date: HOJE, start: '08:00', end: '09:00' }] });
    const jaMarcada = reserva({ id: 'j', no_show: true, slots: [{ date: HOJE, start: '08:00', end: '09:00' }] });
    const veio = reserva({ id: 'v', checked_in_at: 'x', slots: [{ date: HOJE, start: '08:00', end: '09:00' }] });
    const r = noShowCandidates([faltou, jaMarcada, veio], HOJE, emHoje(12));
    expect(r.map((b) => b.id)).toEqual(['f']);
  });
});

describe('checkinBlockedReason', () => {
  it('diz quanto falta em horas e minutos', () => {
    expect(checkinBlockedReason('early', 120)).toContain('2h');
    expect(checkinBlockedReason('early', 45)).toContain('45 min');
    expect(checkinBlockedReason('early', 90)).toContain('1h30');
  });

  it('tem texto para cada recusa, e nenhum para o caso liberado', () => {
    expect(checkinBlockedReason('late')).not.toBe('');
    expect(checkinBlockedReason('not_confirmed')).not.toBe('');
    expect(checkinBlockedReason('cancelled')).not.toBe('');
    expect(checkinBlockedReason('other_day')).not.toBe('');
    expect(checkinBlockedReason('open')).toBe('');
  });
});
