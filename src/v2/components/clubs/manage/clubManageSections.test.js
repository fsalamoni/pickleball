import { describe, it, expect } from 'vitest';
import { ALL_CLUB_PERMS, CLUB_PERM } from '@/modules/clubs/domain/association';
import { SECOES_DA_GESTAO, buildClubSections } from './clubManageSections';

const ids = (secoes) => secoes.map((s) => s.id);
const abas = (secoes) => secoes.flatMap((s) => s.tabs.map((x) => x.value));

describe('Central do clube: gestão do clube × associação', () => {
  it('com a associação desligada, quem administra só vê a gestão do clube', () => {
    const secoes = buildClubSections([...ALL_CLUB_PERMS], { association: false });
    expect(new Set(ids(secoes))).toEqual(SECOES_DA_GESTAO);
    // O que era a aba "Administração" e a aba "Atividade" da página do clube:
    expect(abas(secoes)).toEqual(expect.arrayContaining(['membros', 'ingresso', 'dados', 'pagina', 'engajamento', 'ranking']));
  });

  it('com a associação ligada, a gestão continua e as seções da associação se somam', () => {
    const secoes = buildClubSections([...ALL_CLUB_PERMS], { association: true });
    expect(ids(secoes)).toEqual(expect.arrayContaining([...SECOES_DA_GESTAO, 'hoje', 'associados', 'planos', 'config']));
  });

  it('o padrão (sem opção) é o de antes: a associação inclusa', () => {
    expect(ids(buildClubSections([...ALL_CLUB_PERMS]))).toContain('hoje');
  });

  it('a gestão é só da administração: cargo, mesmo com permissões, não vê membros nem dados do clube', () => {
    const cargo = buildClubSections([CLUB_PERM.MEMBERS, CLUB_PERM.FINANCE, CLUB_PERM.COMMS], { association: true });
    SECOES_DA_GESTAO.forEach((id) => expect(ids(cargo)).not.toContain(id));
  });

  it('sem permissão alguma, nada aparece — nem com a associação desligada', () => {
    expect(buildClubSections([], { association: false })).toEqual([]);
  });

  it('o valor de cada aba é único em toda a Central (a seção ativa é achada pela aba)', () => {
    const todas = abas(buildClubSections([...ALL_CLUB_PERMS], { association: true }));
    expect(new Set(todas).size).toBe(todas.length);
  });
});
