import { describe, it, expect } from 'vitest';
import { describeGameDayRules, formatHonorsFixedPairs, formatRhythm } from './gameDayRules.js';
import { GAME_DAY_FORMAT } from '@/modules/clubs/domain/gameDayFormats';
import { GAME_DAY_MANAGE_MODE } from './gameDayRoles.js';

const dia = (over = {}) => ({
  id: 'g1', title: 'Rachão', format: GAME_DAY_FORMAT.AMERICANO, visibility: 'private', ...over,
});
const chaves = (gd, ctx) => describeGameDayRules(gd, ctx).rows.map((r) => r.key);
const linha = (gd, k, ctx) => describeGameDayRules(gd, ctx).rows.find((r) => r.key === k);

describe('formatHonorsFixedPairs — onde a dupla vinculada vale', () => {
  it('Play, Americano e Americano aprimorado honram', () => {
    [GAME_DAY_FORMAT.PLAY, GAME_DAY_FORMAT.AMERICANO, GAME_DAY_FORMAT.AMERICANO_LIVE]
      .forEach((f) => expect(formatHonorsFixedPairs(f), f).toBe(true));
  });

  it('⭐ Mexicano e Rei da Quadra NÃO honram — e isso não é omissão', () => {
    [GAME_DAY_FORMAT.MEXICANO, GAME_DAY_FORMAT.KING_OF_COURT]
      .forEach((f) => expect(formatHonorsFixedPairs(f), f).toBe(false));
  });
});

describe('formatRhythm — como as partidas saem', () => {
  it('cada formato tem a sua frase, e nenhuma é vazia', () => {
    Object.values(GAME_DAY_FORMAT).forEach((f) => {
      expect(formatRhythm(f).length, f).toBeGreaterThan(20);
    });
  });

  it('o Play diz que não tem placar; o aprimorado diz que tem', () => {
    expect(formatRhythm(GAME_DAY_FORMAT.PLAY)).toMatch(/Sem placar/);
    expect(formatRhythm(GAME_DAY_FORMAT.AMERICANO_LIVE)).toMatch(/placar/);
  });
});

describe('describeGameDayRules — o dia diz o que ele é', () => {
  it('⭐ o FORMATO é sempre a primeira linha — era o que faltava na tela', () => {
    expect(describeGameDayRules(dia()).rows[0].key).toBe('formato');
  });

  it('Play: sem placar, e por isso sem linha de ranking da plataforma', () => {
    const gd = dia({ format: GAME_DAY_FORMAT.PLAY });
    expect(linha(gd, 'placar').value).toMatch(/Não/);
    expect(chaves(gd)).not.toContain('ranking');
  });

  it('formato com placar fala do ranking, e diz que publicar é decisão', () => {
    const l = linha(dia(), 'ranking');
    expect(l.value).toBe('Só depois de publicado');
    expect(l.help).toMatch(/DECISÃO/);
  });

  it('já publicado, a linha muda', () => {
    expect(linha(dia({ publish_to_ranking: true }), 'ranking').value).toBe('Publicado');
  });

  it('⭐ Mexicano AVISA que a dupla vinculada não vale — em vez de ignorar calado', () => {
    const l = linha(dia({ format: GAME_DAY_FORMAT.MEXICANO }), 'duplas');
    expect(l.value).toBe('Não vale neste formato');
    expect(l.help).toMatch(/classificação da rodada/);
  });

  it('quadras só aparecem nos formatos quadra a quadra, e com número', () => {
    expect(chaves(dia({ format: GAME_DAY_FORMAT.PLAY, play_courts: 2 }))).toContain('quadras');
    expect(chaves(dia({ format: GAME_DAY_FORMAT.PLAY, play_courts: 0 }))).not.toContain('quadras');
    expect(chaves(dia({ format: GAME_DAY_FORMAT.AMERICANO, play_courts: 2 }))).not.toContain('quadras');
  });

  it('com mais de uma quadra, a ajuda ensina a sortear a rodada inteira', () => {
    const l = linha(dia({ format: GAME_DAY_FORMAT.PLAY, play_courts: 3 }), 'quadras');
    expect(l.help).toMatch(/RODADA inteira/);
  });

  it('vagas só existem em dia de jogo de ARENA com limite', () => {
    expect(chaves(dia({ capacity: 12 }))).not.toContain('vagas');
    const arena = dia({ arena_id: 'a1', capacity: 12 });
    expect(linha(arena, 'vagas', { participantCount: 7 }).value).toBe('7 de 12');
    expect(chaves(dia({ arena_id: 'a1', capacity: 0 }))).not.toContain('vagas');
  });

  it('⭐ "quem conduz" só aparece para quem pode organizar', () => {
    expect(chaves(dia())).not.toContain('organiza');
    expect(chaves(dia(), { podeGerenciar: true })).toContain('organiza');
  });

  it('o modo aberto e o restrito dizem coisas diferentes', () => {
    const restrito = linha(dia(), 'organiza', { podeGerenciar: true });
    const aberto = linha(
      dia({ manage_mode: GAME_DAY_MANAGE_MODE.PARTICIPANTS }), 'organiza', { podeGerenciar: true },
    );
    expect(restrito.value).toMatch(/Só eu/);
    expect(aberto.value).toMatch(/Qualquer participante/);
  });

  it('administradores nomeados aparecem no número', () => {
    const l = linha(dia({ admin_uids: ['a', 'b'] }), 'organiza', { podeGerenciar: true });
    expect(l.value).toMatch(/2 nomeado\(s\)/);
  });

  it('⭐ visibilidade só no dia do ATLETA — na arena e no clube quem decide é o local', () => {
    expect(chaves(dia())).toContain('visibilidade');
    expect(chaves(dia({ arena_id: 'a1' }))).not.toContain('visibilidade');
    expect(chaves(dia({ club_id: 'c1' }))).not.toContain('visibilidade');
  });

  it('público e privado dizem quem enxerga', () => {
    expect(linha(dia({ visibility: 'public' }), 'visibilidade').value).toMatch(/Qualquer atleta/);
    expect(linha(dia(), 'visibilidade').value).toMatch(/convidado/);
  });

  it('toda linha tem rótulo, valor e explicação', () => {
    [
      dia(), dia({ format: GAME_DAY_FORMAT.PLAY, play_courts: 2 }),
      dia({ format: GAME_DAY_FORMAT.MEXICANO }),
      dia({ arena_id: 'a1', capacity: 8, format: GAME_DAY_FORMAT.AMERICANO_LIVE, play_courts: 2 }),
    ].forEach((gd) => {
      describeGameDayRules(gd, { podeGerenciar: true, participantCount: 4 }).rows.forEach((r) => {
        expect(r.label.length, r.key).toBeGreaterThan(2);
        expect(r.value.length, r.key).toBeGreaterThan(1);
        expect(r.help.length, r.key).toBeGreaterThan(25);
      });
    });
  });

  it('dia de jogo ausente não quebra', () => {
    expect(describeGameDayRules(null).rows).toEqual([]);
    expect(describeGameDayRules(undefined).rows).toEqual([]);
  });
});
