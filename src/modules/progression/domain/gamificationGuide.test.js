import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  GUIDE_AUDIENCE, GUIDE_AUDIENCE_META, TERM_GROUP, TERM_GROUP_META,
  buildGamificationGuide, groupedTerms, normalizeText, searchTerms, streakRuleBullets, termsForAudience,
} from './gamificationGuide.js';
import { GAMIFICATION_MODULES, normalizeGamificationConfig } from './gamificationConfig.js';
import { TIERS } from './tiers.js';
import { XP_WEIGHTS_V2 } from './progressionV2.js';
import { MISSION_BONUS_XP, MISSIONS_PER_SCOPE } from './missions.js';
import { ONBOARDING_MAX_XP, ONBOARDING_STEPS } from './onboarding.js';
import { STREAK_VACATION_COOLDOWN_DAYS, STREAK_VACATION_MAX_DAYS } from './weekStreak.js';
import { LETTER_MAX } from './partnerLetters.js';
import { REVIEW_MAX_TAGS } from './matchReviews.js';

const guide = buildGamificationGuide();
const texto = (t) => [t.title, t.short, ...t.body, t.tip || ''].join(' ');
const todo = (id) => texto(guide.byId[id]);

describe('o guia — forma', () => {
  it('todo termo tem título, uma frase curta e corpo; ids únicos', () => {
    const ids = new Set();
    guide.terms.forEach((t) => {
      expect(t.id, 'id').toMatch(/^[a-z][a-z0-9-]+$/);
      expect(ids.has(t.id), `id repetido: ${t.id}`).toBe(false);
      ids.add(t.id);
      expect(t.title.trim().length, t.id).toBeGreaterThan(1);
      expect(t.short.trim().length, `${t.id} short`).toBeGreaterThan(20);
      expect(t.short.length, `${t.id} short cabe num balão`).toBeLessThanOrEqual(260);
      expect(t.body.length, `${t.id} body`).toBeGreaterThan(0);
      t.body.forEach((p) => expect(p.trim().length, `${t.id} parágrafo vazio`).toBeGreaterThan(10));
      expect(Object.values(TERM_GROUP), `${t.id} grupo`).toContain(t.group);
      expect(t.audiences.length, `${t.id} público`).toBeGreaterThan(0);
      t.audiences.forEach((a) => expect(Object.values(GUIDE_AUDIENCE), `${t.id} público inválido`).toContain(a));
    });
    expect(guide.byId.xp.title).toBe('XP');
  });

  it('nenhum texto vaza placeholder, "undefined", "NaN" ou número quebrado', () => {
    guide.terms.forEach((t) => {
      expect(texto(t), t.id).not.toMatch(/undefined|NaN|\[object|\$\{|null/);
    });
    guide.faq.forEach((f) => expect(`${f.q} ${f.a}`).not.toMatch(/undefined|NaN|\[object/));
  });

  it('cada público tem o que ler e todos os grupos têm rótulo', () => {
    Object.values(GUIDE_AUDIENCE).forEach((a) => {
      expect(GUIDE_AUDIENCE_META[a].label).toBeTruthy();
      expect(termsForAudience(guide, a).length, a).toBeGreaterThanOrEqual(3);
      expect(guide.faq.filter((f) => f.audience === a).length, `faq ${a}`).toBeGreaterThan(0);
    });
    Object.values(TERM_GROUP).forEach((g) => expect(TERM_GROUP_META[g].label).toBeTruthy());
  });

  it('o módulo que um termo cita existe no catálogo do admin', () => {
    guide.terms.filter((t) => t.module).forEach((t) => {
      expect(Object.keys(GAMIFICATION_MODULES), `${t.id} → ${t.module}`).toContain(t.module);
    });
  });

  it('⭐ todo link do guia aponta para uma rota que existe', () => {
    const fonte = readFileSync('src/v2/V2App.jsx', 'utf8');
    const rotas = new Set([...fonte.matchAll(/<Route\s+path="([^"]+)"/g)].map((m) => `/${m[1].replace(/^\//, '')}`));
    guide.terms.filter((t) => t.where).forEach((t) => {
      const alvo = t.where.to.split(/[?#]/)[0];
      expect(rotas.has(alvo), `${t.id} → ${t.where.to}`).toBe(true);
      expect(t.where.label.trim().length).toBeGreaterThan(3);
    });
  });
});

describe('o guia — os números são os do código (não escritos à mão)', () => {
  it('XP: pesos reais de jogo, vitória, torneio, pódio e título', () => {
    const t = todo('xp');
    [XP_WEIGHTS_V2.game_played, XP_WEIGHTS_V2.game_won, XP_WEIGHTS_V2.tournament_attended, XP_WEIGHTS_V2.tournament_podium, XP_WEIGHTS_V2.tournament_title]
      .forEach((n) => expect(t).toContain(`${n} XP`));
  });

  it('tiers: todos os nomes e limiares', () => {
    const t = todo('tier');
    TIERS.forEach((x) => {
      expect(t).toContain(x.name);
      expect(t).toContain(`${x.threshold.toLocaleString('pt-BR')} XP`);
    });
  });

  it('missões: quantas por período e o bônus de cada um', () => {
    const t = todo('missoes');
    expect(t).toContain(`${MISSIONS_PER_SCOPE.daily} missões por dia`);
    expect(t).toContain(`${MISSIONS_PER_SCOPE.weekly} por semana`);
    expect(t).toContain(`${MISSIONS_PER_SCOPE.monthly} por mês`);
    expect(t).toContain(`+${MISSION_BONUS_XP.daily} XP`);
    expect(t).toContain(`+${MISSION_BONUS_XP.weekly}`);
    expect(t).toContain('+1.000');
  });

  it('primeiros passos: quantos e quanto XP', () => {
    const t = todo('primeiros-passos');
    expect(t).toContain(`${ONBOARDING_STEPS.length} passos`);
    expect(t).toContain(`${ONBOARDING_MAX_XP} XP`);
  });

  it('sequência: férias e intervalo vêm das constantes', () => {
    const t = streakRuleBullets().join(' ');
    expect(t).toContain(`${STREAK_VACATION_MAX_DAYS / 7} semanas`);
    expect(t).toContain(`${STREAK_VACATION_COOLDOWN_DAYS} dias`);
    expect(todo('ferias')).toContain(`${STREAK_VACATION_COOLDOWN_DAYS} dias`);
  });

  it('avaliações e cartas: limites reais', () => {
    expect(todo('avaliacoes')).toContain(`até ${REVIEW_MAX_TAGS} elogios`);
    expect(todo('cartas')).toContain(`${LETTER_MAX} caracteres`);
  });

  it('⭐ acompanha a configuração do admin: mudou o prêmio, o texto muda', () => {
    const g = buildGamificationGuide({ season: { prizeTop1: 2500, prizeTop10Percent: 700, prizeParticipation: 80, publicMinTier: 'Veterano' }, reviews: { minForPublicScore: 9, windowDays: 30 }, duels: { winnerXp: 300, participationXp: 60 } });
    const texto2 = (id) => texto(g.byId[id]);
    expect(texto2('temporada')).toContain('2.500');
    expect(texto2('temporada')).toContain('700');
    expect(texto2('temporada')).toContain('80');
    expect(texto2('hall')).toContain('Veterano');
    expect(texto2('reputacao')).toContain('9 avaliações');
    expect(texto2('avaliacoes')).toContain('30 dias');
    expect(texto2('duelo')).toContain('300 XP');
    // e o padrão, sem configuração, usa os padrões
    expect(todo('temporada')).toContain('1.000');
  });

  it('configuração quebrada não derruba o guia (cai nos padrões)', () => {
    expect(() => buildGamificationGuide({ season: { prizeTop1: 'x' }, reviews: null })).not.toThrow();
    const g = buildGamificationGuide('lixo');
    expect(g.config.season.prizeTop1).toBe(normalizeGamificationConfig(null).season.prizeTop1);
  });
});

describe('o "Como funciona" de cada aba', () => {
  it('toda aba do hub tem a sua introdução, e cada termo citado existe', () => {
    ['jornada', 'missoes', 'competir', 'social', 'recompensas'].forEach((aba) => {
      const t = guide.tabs[aba];
      expect(t.title.length, aba).toBeGreaterThan(5);
      expect(t.bullets.length, aba).toBeGreaterThanOrEqual(3);
      expect(t.bullets.length, aba).toBeLessThanOrEqual(5);
      t.terms.forEach((id) => expect(guide.byId[id], `${aba} → ${id}`).toBeTruthy());
    });
  });

  it('os números das abas também vêm das constantes e da configuração', () => {
    expect(guide.tabs.missoes.bullets.join(' ')).toContain(`${MISSIONS_PER_SCOPE.weekly} por semana`);
    const g = buildGamificationGuide({ reviews: { minForPublicScore: 12 } });
    expect(g.tabs.social.bullets.join(' ')).toContain('12 avaliações');
  });
});

describe('groupedTerms — o que a pessoa vê', () => {
  it('agrupa na ordem do guia e esconde o módulo que o admin desligou', () => {
    const todos = groupedTerms(guide, GUIDE_AUDIENCE.ATHLETE);
    expect(todos[0].group).toBe('jornada');
    const semDuelo = groupedTerms(guide, GUIDE_AUDIENCE.ATHLETE, (m) => m !== 'duels');
    const ids = semDuelo.flatMap((g) => g.terms.map((t) => t.id));
    expect(ids).not.toContain('duelo');
    expect(todos.flatMap((g) => g.terms.map((t) => t.id))).toContain('duelo');
  });

  it('grupo sem nenhum termo some', () => {
    const so = groupedTerms(guide, GUIDE_AUDIENCE.ADMIN);
    expect(so.map((g) => g.group)).toEqual(['oferecer', 'administrar']);
  });
});

describe('o que o guia NÃO pode prometer', () => {
  it('XP não compra nada, e isso está dito', () => {
    expect(todo('xp')).toMatch(/não se gasta nem se compra/);
    expect(todo('recompensas')).toMatch(/Não se compram com XP|não é moeda/);
  });

  it('antifarm marca, nunca pune — em todos os lugares que falam dele', () => {
    expect(todo('fair-play')).toMatch(/Ninguém é punido automaticamente/);
    expect(todo('admin-antifarm')).toMatch(/Nunca pune sozinho/);
  });

  it('a nota de saúde é privada', () => {
    expect(todo('saude')).toMatch(/Só você vê/);
  });
});

describe('searchTerms — achar o termo sem saber o nome dele', () => {
  const atleta = termsForAudience(guide, GUIDE_AUDIENCE.ATHLETE);

  it('ignora acento e caixa', () => {
    expect(normalizeText('Sequência ÁÉÍ')).toBe('sequencia aei');
    expect(searchTerms(atleta, 'SEQUENCIA').map((t) => t.id)).toContain('sequencia');
  });

  it('o título pesa mais que o corpo: "tier" traz o Tier primeiro', () => {
    expect(searchTerms(atleta, 'tier')[0].id).toBe('tier');
  });

  it('vários termos estreitam; busca vazia não filtra; sem resultado é lista vazia', () => {
    expect(searchTerms(atleta, '')).toBe(atleta);
    expect(searchTerms(atleta, 'x')).toBe(atleta); // uma letra só não é busca
    const estreita = searchTerms(atleta, 'semanas folga');
    expect(estreita.length).toBeGreaterThan(0);
    expect(estreita.length).toBeLessThan(atleta.length);
    expect(searchTerms(atleta, 'zzzzzzzz')).toEqual([]);
  });

  it('acha pelo que a pessoa diria ("parar de aparecer" → privacidade)', () => {
    expect(searchTerms(atleta, 'placar publico').map((t) => t.id)).toContain('privacidade');
  });
});
