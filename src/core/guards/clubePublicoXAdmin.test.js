import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * ⭐ A página do clube é visão pública e o que os membros fazem juntos; o que é
 * da administração mora na Central do clube (`/clubes/:id/gerir`).
 *
 * 🐞 Antes a página do clube tinha as abas "Administração" (editar o clube,
 * pedidos de ingresso, convites, código, excluir) e "Atividade" (metas,
 * desafios, recompensas), o botão de copiar o link de convite no cabeçalho, o
 * menu de promover/remover em cada membro e a escolha de incluir resultados
 * externos no ranking — tudo no meio do que qualquer membro vê, e a Central só
 * existia com a associação ligada. Cada trecho, isolado, funcionava; a mistura
 * é que confundia quem usa. A fonte única do que é da administração agora é a
 * Central, e este guarda impede que volte para a página pública.
 */
const RAIZ = path.resolve(__dirname, '../..');
const ler = (rel) => readFileSync(path.join(RAIZ, rel), 'utf8')
  .split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');

describe('a página do clube não carrega o que é da administração', () => {
  const pagina = ler('v2/pages/V2ClubDetail.jsx');

  it('não importa os painéis da administração', () => {
    expect(pagina).not.toMatch(/V2ClubAdmin|ClubEngagementPanel/);
  });

  it('não tem as abas "Administração" nem "Atividade"', () => {
    expect(pagina).not.toMatch(/value:\s*'admin'/);
    expect(pagina).not.toMatch(/value:\s*'atividade'/);
  });

  it('o link antigo (?tab=admin / ?tab=atividade) leva a administração à Central', () => {
    expect(pagina).toMatch(/admin:\s*'ingresso',\s*atividade:\s*'engajamento'/);
    expect(pagina).toMatch(/\/gerir\?aba=/);
  });

  it('a lista de membros e o ranking da página são só visão (sem menu de gestão nem escolha de fontes)', () => {
    expect(pagina).toMatch(/<V2ClubMembers clubId=\{clubId\} \/>/);
    expect(pagina).toMatch(/<ClubRankingTab clubId=\{clubId\} \/>/);
  });

  it('não copia o código de convite no cabeçalho (isso é da Central → Pedidos e convites)', () => {
    expect(pagina).not.toMatch(/useClubInviteCode|Copiar link de convite/);
  });

  it('o único ato de administração do cabeçalho é a porta para a Central, que não depende da flag da associação', () => {
    expect(pagina).toMatch(/data-dica="clube-central"/);
    expect(pagina).toMatch(/\(isAdmin \|\| papel\.isStaff\) && \(/);
  });
});

describe('a Central do clube reúne o que é da administração', () => {
  const central = ler('v2/pages/V2ClubManage.jsx');

  it('abre sem a flag da associação (só as seções da associação dependem dela)', () => {
    expect(central).not.toMatch(/<Navigate to=\{`\/clubes\/\$\{clubId\}`\} replace \/>\s*;?\s*return <Central/);
    expect(central).toMatch(/buildClubSections\(perms, \{ association: assocOn \}\)/);
  });

  it('com a associação desligada nenhuma consulta de `club_x` é feita (a regra a recusaria)', () => {
    expect(central).toMatch(/useMyClubRole\(clubId, \{ association: assocOn \}\)/);
    ['useClubAffiliations', 'useClubCharges', 'useAllPlans', 'useClubPix', 'useClubStaff', 'useClubRoles'].forEach((hook) => {
      const linha = central.split('\n').find((l) => l.includes(`${hook}(clubId`));
      expect(linha, hook).toMatch(/enabled: assocOn &&/);
    });
  });

  it('é a Central — e só ela — que liga o menu de gestão dos membros e as ferramentas do ranking', () => {
    expect(central).toMatch(/<V2ClubAdmin club=\{club\} tab=\{tab\} \/>/);
    expect(central).toMatch(/<ClubRankingTab clubId=\{clubId\} adminTools \/>/);
    expect(ler('v2/components/clubs/V2ClubAdmin.jsx')).toMatch(/<V2ClubMembers clubId=\{club\.id\} manage \/>/);
    // Ninguém mais passa `manage`/`adminTools`.
    ['v2/pages/V2ClubDetail.jsx', 'v2/components/clubs/V2ClubFeed.jsx', 'v2/components/clubs/V2ClubEvents.jsx'].forEach((rel) => {
      expect(ler(rel), rel).not.toMatch(/\bmanage\b|adminTools/);
    });
  });
});
