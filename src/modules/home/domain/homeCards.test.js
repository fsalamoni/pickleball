/**
 * O início sob medida — o que protege:
 *
 *  1. ⭐ o padrão são EXATAMENTE Dias de jogo, Horários da arena e Ranking,
 *     nessa ordem; todo o resto começa desligado;
 *  2. ⭐ toda seção da tela inicial tem o seu card (seção nova sem card seria
 *     uma seção que ninguém consegue ligar);
 *  3. a ordem é da pessoa: ligar põe no fim, mover não dá a volta;
 *  4. "não quero nada" é escolha (lista vazia), diferente de "nunca escolhi";
 *  5. card de funcionalidade desligada não aparece, mas não é esquecido;
 *  6. o que a pessoa FAZ vira sugestão — o "começo comum" não sugere nada.
 */
import { describe, it, expect } from 'vitest';
import {
  ALL_HOME_CARDS, DEFAULT_HOME_CARDS, HOME_CARD, HOME_CARD_GROUP, HOME_CARD_GROUP_LABEL, HOME_CARD_META,
  chosenHomeCards, homeCardAvailable, homeCardsOfGroup, homeCardsSummary, isDefaultHomeCards, isSectionCard,
  moveHomeCard, normalizeHomeCards, suggestedHomeCards, toggleHomeCard, visibleHomeCards,
  wideHomeCards,
} from './homeCards.js';
import { FOCUS_REASON, HOME_FOCUS, HOME_SECTION, resolveHomeFoci } from './homeProfile.js';

const TUDO = { promocoes: true, evolucao: true, treino: true };

describe('⭐ o padrão', () => {
  it('são três cards: Dias de jogo, Horários da arena e Ranking — nessa ordem', () => {
    expect(DEFAULT_HOME_CARDS).toEqual(['jogar', 'reservar', 'ranking']);
    expect(DEFAULT_HOME_CARDS.map((id) => HOME_CARD_META[id].label))
      .toEqual(['Dias de jogo', 'Horários da arena', 'Ranking']);
  });

  it('quem nunca escolheu fica com o padrão; o resto começa desligado', () => {
    expect(chosenHomeCards(null)).toEqual(DEFAULT_HOME_CARDS);
    expect(chosenHomeCards(undefined)).toEqual(DEFAULT_HOME_CARDS);
    ALL_HOME_CARDS.filter((id) => !DEFAULT_HOME_CARDS.includes(id))
      .forEach((id) => expect(chosenHomeCards(null), id).not.toContain(id));
  });

  it('⭐ "não quero nada" é escolha: a lista vazia NÃO volta ao padrão', () => {
    expect(chosenHomeCards([])).toEqual([]);
  });

  it('reconhece o padrão (mesmos cards, mesma ordem)', () => {
    expect(isDefaultHomeCards(['jogar', 'reservar', 'ranking'])).toBe(true);
    expect(isDefaultHomeCards(['reservar', 'jogar', 'ranking'])).toBe(false);
    expect(isDefaultHomeCards(['jogar', 'reservar'])).toBe(false);
  });
});

describe('o catálogo', () => {
  it('⭐ toda seção da tela inicial tem o seu card', () => {
    Object.values(HOME_SECTION).forEach((s) => {
      expect(HOME_CARD_META[s], `seção ${s} sem card`).toBeTruthy();
      expect(isSectionCard(s)).toBe(true);
    });
    ['atalhos', 'destaques', 'evolucao'].forEach((c) => expect(isSectionCard(c)).toBe(false));
  });

  it('todo card tem rótulo, descrição e grupo em pt-BR', () => {
    ALL_HOME_CARDS.forEach((id) => {
      const m = HOME_CARD_META[id];
      expect(m.label.length, id).toBeGreaterThan(3);
      expect(m.description.length, id).toBeGreaterThan(20);
      expect(Object.values(HOME_CARD_GROUP)).toContain(m.group);
      expect(m.icon, id).toMatch(/^[A-Z]/);
    });
    Object.values(HOME_CARD_GROUP).forEach((g) => expect(HOME_CARD_GROUP_LABEL[g].length).toBeGreaterThan(3));
  });

  it('todo card aparece em algum grupo do seletor (com tudo ligado)', () => {
    const noSeletor = Object.values(HOME_CARD_GROUP).flatMap((g) => homeCardsOfGroup(g, TUDO));
    expect(noSeletor.sort()).toEqual([...ALL_HOME_CARDS].sort());
  });

  it('as frentes que sugerem cards existem', () => {
    const frentes = new Set(Object.values(HOME_FOCUS));
    ALL_HOME_CARDS.forEach((id) => (HOME_CARD_META[id].focos || []).forEach((f) => expect(frentes.has(f), `${id}→${f}`).toBe(true)));
  });
});

describe('a escolha', () => {
  it('normaliza: só conhecidos, sem repetir, na ordem', () => {
    expect(normalizeHomeCards(['ranking', 'x', 'ranking', 42, 'jogar'])).toEqual(['ranking', 'jogar']);
    expect(normalizeHomeCards('jogar')).toEqual([]);
    expect(normalizeHomeCards(null)).toEqual([]);
  });

  it('⭐ ligar põe no FIM (o que a pessoa já arrumou não se mexe); desligar tira', () => {
    const l = toggleHomeCard(DEFAULT_HOME_CARDS, HOME_CARD.AGENDA);
    expect(l).toEqual(['jogar', 'reservar', 'ranking', 'agenda']);
    expect(toggleHomeCard(l, HOME_CARD.RESERVAR)).toEqual(['jogar', 'ranking', 'agenda']);
    expect(toggleHomeCard(l, 'inventado')).toEqual(l);
  });

  it('move uma posição, e nunca dá a volta', () => {
    expect(moveHomeCard(DEFAULT_HOME_CARDS, 'ranking', -1)).toEqual(['jogar', 'ranking', 'reservar']);
    expect(moveHomeCard(DEFAULT_HOME_CARDS, 'jogar', 1)).toEqual(['reservar', 'jogar', 'ranking']);
    expect(moveHomeCard(DEFAULT_HOME_CARDS, 'jogar', -1)).toEqual(DEFAULT_HOME_CARDS);
    expect(moveHomeCard(DEFAULT_HOME_CARDS, 'ranking', 1)).toEqual(DEFAULT_HOME_CARDS);
    expect(moveHomeCard(DEFAULT_HOME_CARDS, 'agenda', -1)).toEqual(DEFAULT_HOME_CARDS);
  });
});

describe('o que depende de outra funcionalidade', () => {
  it('destaques precisam de alguma fonte de promoção; evolução, da sua flag', () => {
    expect(homeCardAvailable('destaques', {})).toBe(false);
    expect(homeCardAvailable('destaques', { promocoes: true })).toBe(true);
    expect(homeCardAvailable('evolucao', {})).toBe(false);
    expect(homeCardAvailable('evolucao', { evolucao: true })).toBe(true);
    expect(homeCardAvailable('jogar', {})).toBe(true);
    expect(homeCardAvailable('inventado', TUDO)).toBe(false);
  });

  it('⭐ o treino só existe com o Centro de Treino ligado, e nunca no padrão', () => {
    expect(homeCardAvailable(HOME_CARD.TREINO, {})).toBe(false);
    expect(homeCardAvailable(HOME_CARD.TREINO, { treino: true })).toBe(true);
    expect(DEFAULT_HOME_CARDS).not.toContain(HOME_CARD.TREINO);
    expect(homeCardsOfGroup(HOME_CARD_GROUP.ROTINA, {})).not.toContain(HOME_CARD.TREINO);
  });

  it('⭐ fica de fora da tela, mas não é esquecido na escolha', () => {
    const escolha = ['jogar', 'destaques', 'ranking'];
    expect(visibleHomeCards(escolha, {})).toEqual(['jogar', 'ranking']);
    expect(visibleHomeCards(escolha, TUDO)).toEqual(escolha);
    expect(homeCardsOfGroup(HOME_CARD_GROUP.ROTINA, {})).not.toContain('destaques');
  });
});

describe('sugestões', () => {
  it('⭐ quem gere arena e dá aula vê as duas sugeridas, com o motivo', () => {
    const foci = resolveHomeFoci({ interests: [], sinais: { arenasGeridas: 1, ehProfessor: true } });
    const s = suggestedHomeCards(foci, DEFAULT_HOME_CARDS, TUDO);
    expect(s.map((x) => x.id).slice(0, 2)).toEqual(['arena', 'professor']);
    expect(s[0]).toMatchObject({ reason: FOCUS_REASON.PAPEL, motivo: 'Porque você faz isso na plataforma' });
  });

  it('não sugere o que já está escolhido, nem o que está indisponível', () => {
    const foci = [{ focus: HOME_FOCUS.ARENA, reason: FOCUS_REASON.PAPEL, weight: 4 }];
    expect(suggestedHomeCards(foci, ['arena'], TUDO)).toEqual([]);
  });

  it('o "começo comum" de quem não disse nada não sugere nada', () => {
    const foci = resolveHomeFoci({ interests: [], sinais: {} });
    expect(suggestedHomeCards(foci, [], TUDO)).toEqual([]);
  });

  it('⭐ "Organizar meu treino" sugere o card do treino — só com o Centro de Treino ligado', () => {
    const ligado = resolveHomeFoci({ interests: ['personal_training'], treino: true });
    expect(suggestedHomeCards(ligado, DEFAULT_HOME_CARDS, TUDO).map((x) => x.id)).toContain(HOME_CARD.TREINO);
    const desligado = resolveHomeFoci({ interests: ['personal_training'] });
    expect(suggestedHomeCards(desligado, DEFAULT_HOME_CARDS, TUDO).map((x) => x.id)).not.toContain(HOME_CARD.TREINO);
    expect(suggestedHomeCards(ligado, DEFAULT_HOME_CARDS, { promocoes: true }).map((x) => x.id)).not.toContain(HOME_CARD.TREINO);
  });

  it('atividade em andamento sugere (tem clube → Seus clubes)', () => {
    const foci = resolveHomeFoci({ interests: ['ranking'], sinais: { temClubes: true } });
    expect(suggestedHomeCards(foci, DEFAULT_HOME_CARDS, TUDO).map((x) => x.id)).toContain('clubes');
  });
});

describe('o resumo', () => {
  it('diz quantos e quais', () => {
    expect(homeCardsSummary(DEFAULT_HOME_CARDS)).toBe('3 cards: Dias de jogo, Horários da arena e Ranking');
    expect(homeCardsSummary(['ranking'])).toBe('1 card: Ranking');
    expect(homeCardsSummary([])).toBe('Nenhum card escolhido');
    expect(homeCardsSummary(['destaques'], {})).toBe('Nenhum card escolhido');
  });
});

describe('⭐ a grade não deixa buraco', () => {
  const largos = (lista) => [...wideHomeCards(lista)];

  it('o padrão: dois numa linha e o Ranking na linha inteira (não sozinho com um buraco ao lado)', () => {
    expect(largos(DEFAULT_HOME_CARDS)).toEqual(['ranking']);
  });

  it('número par de cards: ninguém se estica', () => {
    expect(largos(['jogar', 'reservar', 'ranking', 'torneios'])).toEqual([]);
  });

  it('agenda, atalhos, destaques e evolução são sempre largos, e quebram a sequência', () => {
    // jogar sobra antes da agenda; reservar e ranking fecham a linha depois dela.
    expect(largos(['jogar', 'agenda', 'reservar', 'ranking'])).toEqual(['jogar', 'agenda']);
    expect(largos(['atalhos', 'ranking', 'evolucao', 'destaques'])).toEqual(['atalhos', 'ranking', 'evolucao', 'destaques']);
  });

  it('o que sobra é o ÚLTIMO da sequência — a ordem da pessoa não muda', () => {
    expect(largos(['torneios', 'aulas', 'clubes'])).toEqual(['clubes']);
  });

  it('lista vazia ou com lixo não quebra', () => {
    expect(largos([])).toEqual([]);
    expect(largos(null)).toEqual([]);
    expect(largos(['sumiu', 'jogar'])).toEqual(['jogar']);
  });
});
