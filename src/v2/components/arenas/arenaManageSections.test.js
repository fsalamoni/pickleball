/**
 * A estrutura de navegação da Central da arena.
 *
 * O que protege:
 *  1. ⭐ nenhuma aba tem o mesmo valor em duas seções — a seção ativa é
 *     achada pela aba, e um valor repetido tornaria a segunda inalcançável;
 *  2. ⭐ com os módulos desligados, a Central é exatamente a de antes;
 *  3. módulo ligado vira SEÇÃO, logo depois de Reservas;
 *  4. ⭐ com Aulas ligado, "Professores" sai de Equipe e vira a lista única da
 *     seção Aulas — com o MESMO valor, para links antigos continuarem valendo;
 *  5. ⭐ as ferramentas da antiga página "Avançado" e da operação moram onde se
 *     procura por elas: Marca em Perfil, Presença em Reservas, Operação como
 *     seção, Rede e Inteligência em Desempenho, Plantão em Equipe;
 *  6. ⭐ toda seção está numa das duas linhas da barra — "Atender" (o trabalho
 *     do dia) ou "Gerir" (como a arena é) —, e a aba padrão (Reservas) abre a
 *     primeira linha.
 */
import { describe, it, expect } from 'vitest';
import { ARENA_SECTION_GROUPS, buildArenaSections } from './arenaManageSections.js';

const BASE = {
  coachResidentOn: true, linkedClubsOn: true, crmOn: true, opsKpisOn: true, arenaModulesOn: true,
};
const TUDO_LIGADO = {
  ...BASE,
  modulos: {
    jogoAberto: true, membros: true, pacotes: true, aulas: true, torneios: true, torneiosPlataforma: true,
    loja: true, marketing: true, cupons: true, campanhas: true, satisfacao: true, indicacoes: true,
    operacao: true, checklists: true, manutencao: true, plantao: true, equipamentos: true, presenca: true,
    marca: true, rede: true, inteligencia: true,
  },
};

const valores = (sections) => sections.flatMap((s) => s.tabs.map((t) => t.value));

describe('buildArenaSections', () => {
  it('⭐ nenhum valor de aba se repete, com tudo ligado', () => {
    const v = valores(buildArenaSections(TUDO_LIGADO));
    expect(new Set(v).size).toBe(v.length);
  });

  it('⭐ sem módulos, a Central é a de antes', () => {
    const ids = buildArenaSections(BASE).map((s) => s.id);
    expect(ids).toEqual(['perfil', 'estrutura', 'reservas', 'comercial', 'desempenho', 'equipe', 'configuracoes']);
    expect(valores(buildArenaSections(BASE))).not.toContain('membros');
  });

  it('Membros entra logo depois de Reservas (e do Jogo aberto, quando ligado)', () => {
    const ids = buildArenaSections(TUDO_LIGADO).map((s) => s.id);
    expect(ids.indexOf('membros')).toBe(ids.indexOf('jogo-aberto') + 1);
    const semJogo = buildArenaSections({ ...BASE, modulos: { membros: true } }).map((s) => s.id);
    expect(semJogo.indexOf('membros')).toBe(semJogo.indexOf('reservas') + 1);
  });

  it('⭐ Jogo aberto é seção logo depois de Reservas — vende horário de quadra, como a reserva', () => {
    const secs = buildArenaSections(TUDO_LIGADO);
    const ids = secs.map((s) => s.id);
    expect(ids.indexOf('jogo-aberto')).toBe(ids.indexOf('reservas') + 1);
    expect(secs.find((s) => s.id === 'jogo-aberto').tabs.map((t) => t.value)).toEqual(['jogo-aberto']);
    expect(valores(buildArenaSections(BASE))).not.toContain('jogo-aberto');
  });

  it('⭐ loja ligada: "Pedidos do app" é a PRIMEIRA aba de Pagamentos e loja; desligada, a seção é a de antes', () => {
    const com = buildArenaSections(TUDO_LIGADO).find((s) => s.id === 'comercial');
    expect(com.tabs.map((t) => t.value)).toEqual(['pedidos', 'pagamento', 'mercado']);
    const sem = buildArenaSections(BASE).find((s) => s.id === 'comercial');
    expect(sem.tabs.map((t) => t.value)).toEqual(['pagamento', 'mercado']);
  });

  it('⭐ Marketing: uma aba por ferramenta ligada, antes de Pagamentos e loja', () => {
    const secs = buildArenaSections(TUDO_LIGADO);
    const ids = secs.map((s) => s.id);
    expect(ids.indexOf('marketing')).toBe(ids.indexOf('comercial') - 1);
    expect(secs.find((s) => s.id === 'marketing').tabs.map((t) => t.value))
      .toEqual(['cupons', 'campanhas', 'satisfacao', 'indicacoes']);
    const soCupons = buildArenaSections({ ...BASE, modulos: { marketing: true, cupons: true } });
    expect(soCupons.find((s) => s.id === 'marketing').tabs.map((t) => t.value)).toEqual(['cupons']);
    expect(valores(buildArenaSections(BASE))).not.toContain('cupons');
  });

  it('Marketing ligado sem ferramenta: UMA aba que explica (seção sem aba não existe)', () => {
    const secs = buildArenaSections({ ...BASE, modulos: { marketing: true } });
    expect(secs.find((s) => s.id === 'marketing').tabs.map((t) => t.value)).toEqual(['marketing']);
  });

  it('Pacotes só com o módulo de pacotes', () => {
    const sem = buildArenaSections({ ...BASE, modulos: { membros: true, pacotes: false } });
    const membros = sem.find((s) => s.id === 'membros');
    expect(membros.tabs.map((t) => t.value)).toEqual(['membros']);
    const com = buildArenaSections(TUDO_LIGADO).find((s) => s.id === 'membros');
    expect(com.tabs.map((t) => t.value)).toEqual(['membros', 'planos']);
  });

  it('toda seção tem ao menos uma aba e rótulo', () => {
    buildArenaSections(TUDO_LIGADO).forEach((s) => {
      expect(s.label).toBeTruthy();
      expect(s.tabs.length).toBeGreaterThan(0);
      s.tabs.forEach((t) => expect(t.label).toBeTruthy());
    });
  });

  it('⭐ Aulas: agenda e professores numa seção só, depois de Membros', () => {
    const secs = buildArenaSections(TUDO_LIGADO);
    const ids = secs.map((s) => s.id);
    expect(ids.indexOf('aulas')).toBe(ids.indexOf('membros') + 1);
    const aulas = secs.find((s) => s.id === 'aulas');
    expect(aulas.tabs.map((t) => t.value)).toEqual(['aulas', 'professores']);
  });

  it('⭐ com Aulas ligado, Professores SAI de Equipe (uma lista, num lugar)', () => {
    const equipe = buildArenaSections(TUDO_LIGADO).find((s) => s.id === 'equipe');
    expect(equipe.tabs.map((t) => t.value)).not.toContain('professores');
  });

  it('com Aulas desligado, Professores continua em Equipe, como era', () => {
    const secs = buildArenaSections({ ...BASE, modulos: { membros: true } });
    expect(secs.find((s) => s.id === 'aulas')).toBeUndefined();
    expect(secs.find((s) => s.id === 'equipe').tabs.map((t) => t.value)).toContain('professores');
  });

  it('⭐ Torneios: da casa e da plataforma numa seção só, depois de Aulas', () => {
    const secs = buildArenaSections(TUDO_LIGADO);
    const ids = secs.map((s) => s.id);
    expect(ids.indexOf('torneios')).toBe(ids.indexOf('aulas') + 1);
    expect(secs.find((s) => s.id === 'torneios').tabs.map((t) => t.value)).toEqual(['torneios', 'torneios-plataforma']);
  });

  it('sem o módulo, mas com torneio da plataforma sediado aqui, a seção aparece só com eles', () => {
    const secs = buildArenaSections({ ...BASE, modulos: { torneiosPlataforma: true } });
    expect(secs.find((s) => s.id === 'torneios').tabs.map((t) => t.value)).toEqual(['torneios-plataforma']);
  });

  it('nenhum dos dois: a seção não existe', () => {
    expect(buildArenaSections(BASE).find((s) => s.id === 'torneios')).toBeUndefined();
  });

  it('⭐ Operação: seção depois de Pagamentos e loja, com Hoje primeiro', () => {
    const secs = buildArenaSections(TUDO_LIGADO);
    const ids = secs.map((s) => s.id);
    expect(ids.indexOf('operacao')).toBe(ids.indexOf('comercial') + 1);
    expect(secs.find((s) => s.id === 'operacao').tabs.map((t) => t.value))
      .toEqual(['operacao', 'checklists', 'manutencao', 'equipamentos']);
    expect(ids).not.toContain('avancado');
  });

  it('só os equipamentos ligados: a seção Operação existe, só com eles', () => {
    const secs = buildArenaSections({ ...BASE, modulos: { equipamentos: true } });
    expect(secs.find((s) => s.id === 'operacao').tabs.map((t) => t.value)).toEqual(['equipamentos']);
  });

  it('operação ligada sem ferramenta: só "Hoje", que explica o que ligar', () => {
    const secs = buildArenaSections({ ...BASE, modulos: { operacao: true } });
    expect(secs.find((s) => s.id === 'operacao').tabs.map((t) => t.value)).toEqual(['operacao']);
  });

  it('⭐ Marca em Perfil, Presença em Reservas, Rede e Inteligência em Desempenho, Plantão em Equipe', () => {
    const secs = buildArenaSections(TUDO_LIGADO);
    const abas = (id) => secs.find((s) => s.id === id).tabs.map((t) => t.value);
    expect(abas('perfil')).toEqual(['info', 'fotos', 'marca']);
    expect(abas('reservas')).toContain('presenca');
    expect(abas('desempenho')).toEqual(['semana', 'metricas', 'retornos', 'inteligencia', 'rede']);
    expect(abas('equipe')).toContain('plantao');
  });

  it('⭐ desligados, nenhuma dessas abas aparece — a Central é a de antes', () => {
    const v = valores(buildArenaSections(BASE));
    for (const aba of ['marca', 'presenca', 'operacao', 'checklists', 'manutencao', 'equipamentos', 'plantao', 'rede', 'inteligencia']) {
      expect(v).not.toContain(aba);
    }
  });
});

describe('as duas linhas da barra: Atender e Gerir', () => {
  const grupoDe = (secs) => Object.fromEntries(secs.map((s) => [s.id, s.grupo]));

  it('⭐ toda seção tem uma linha conhecida — com tudo ligado e com tudo desligado', () => {
    const conhecidos = new Set(ARENA_SECTION_GROUPS.map((g) => g.id));
    for (const cfg of [TUDO_LIGADO, BASE, { ...BASE, arenaModulesOn: false }]) {
      for (const sec of buildArenaSections(cfg)) expect(conhecidos.has(sec.grupo)).toBe(true);
    }
  });

  it('⭐ Atender: o trabalho do dia, com o cliente na frente', () => {
    const atender = buildArenaSections(TUDO_LIGADO).filter((s) => s.grupo === 'atender').map((s) => s.id);
    expect(atender).toEqual(['reservas', 'jogo-aberto', 'membros', 'aulas', 'torneios', 'comercial', 'operacao']);
  });

  it('Gerir: como a arena é configurada', () => {
    const gerir = buildArenaSections(TUDO_LIGADO).filter((s) => s.grupo === 'gerir').map((s) => s.id);
    expect(gerir).toEqual(['perfil', 'estrutura', 'marketing', 'desempenho', 'equipe', 'configuracoes']);
  });

  it('Atender vem primeiro, e é onde mora a aba padrão (Reservas)', () => {
    expect(ARENA_SECTION_GROUPS[0].id).toBe('atender');
    expect(grupoDe(buildArenaSections(BASE)).reservas).toBe('atender');
  });

  it('com tudo ligado, as duas linhas ficam equilibradas (nenhuma com o dobro da outra)', () => {
    const secs = buildArenaSections(TUDO_LIGADO);
    const a = secs.filter((s) => s.grupo === 'atender').length;
    const g = secs.filter((s) => s.grupo === 'gerir').length;
    expect(Math.max(a, g)).toBeLessThan(2 * Math.min(a, g));
  });
});
