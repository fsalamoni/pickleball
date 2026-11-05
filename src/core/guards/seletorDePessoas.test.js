/**
 * ⭐ UM SELETOR DE PESSOAS SÓ (pedido do dono, 2026-11-05).
 *
 * Cada tela tinha o seu: na Carreira a dupla era uma busca cega (a lista só
 * aparecia depois de digitar), no dia de jogo a lista vinha aberta com
 * "Inserir", na federação com o motivo de quem não pode, no chat com caixas
 * de seleção, no circuito um `<select>` com a plataforma inteira. O padrão
 * agora é `PersonPicker` (`src/v2/components/people/`, docs/07 §3.2): lista
 * aberta, busca que só estreita, motivo de quem não pode, falha dita.
 *
 * Este guarda reprova (1) um componente novo com cara de seletor de pessoas
 * (`…AthletePicker`, `…PersonPicker`, `…MemberPicker`…) que não embrulhe o
 * padrão e (2) a volta de um seletor próprio nas telas já convertidas.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const RAIZ = path.resolve(__dirname, '../..');
const PADRAO = 'v2/components/people/PersonPicker.jsx';
const USA_PADRAO = /from ['"](?:@\/v2\/components\/people\/PersonPicker|\.\/PersonPicker|@\/v2\/components\/federations\/manage\/FedPersonPicker|\.\.?\/(?:manage\/)?FedPersonPicker)['"]/;

/** As telas que escolhem pessoas — todas pelo padrão. */
const CONVERTIDAS = [
  'v2/components/people/PartnerPicker.jsx',
  'v2/components/federations/manage/FedPersonPicker.jsx',
  'modules/athletes/components/AthleteMultiPicker.jsx',
  'v2/components/arenas/marketing/coupons/VoucherReception.jsx',
  'modules/tournament/components/ModalityRegistrationDialog.jsx',
  'v2/components/games/AthletePlayOrganizer.jsx',
  'v2/components/games/AthleteGameDayOrganizer.jsx',
  'v2/components/games/GameDaySettingsCard.jsx',
  'modules/clubs/components/GameDayOrganizer.jsx',
  'v2/components/clubs/V2EventParticipantsPanel.jsx',
  'v2/components/clubs/V2ClubAdmin.jsx',
  'v2/components/arenas/classes/ProfessorForm.jsx',
  'modules/progression/components/MentorshipInvite.jsx',
  'modules/chat/components/NewChatDialog.jsx',
  'v2/components/tournament/TeamRegistrationForm.jsx',
  'v2/pages/V2CircuitManage.jsx',
];

function listar(dir, saida = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) listar(p, saida);
    else if (/\.jsx$/.test(e.name) && !/\.test\./.test(e.name)) saida.push(p);
  }
  return saida;
}

describe('⭐ seletor de pessoas único', () => {
  it('as telas que escolhem pessoas usam o PersonPicker', () => {
    const fora = CONVERTIDAS.filter((rel) => !USA_PADRAO.test(fs.readFileSync(path.join(RAIZ, rel), 'utf8')));
    expect(fora).toEqual([]);
  });

  it('componente novo com nome de seletor de pessoas embrulha o padrão', () => {
    const nome = /(?:function|const)\s+(\w*(?:Athlete|Person|Partner|Member|Student|User|Player|Pessoa|Atleta|Membro|Aluno)\w*Picker)\b/g;
    const achados = [];
    for (const arq of listar(RAIZ)) {
      const rel = path.relative(RAIZ, arq).split(path.sep).join('/');
      if (rel === PADRAO) continue;
      const src = fs.readFileSync(arq, 'utf8');
      let m;
      while ((m = nome.exec(src))) if (!USA_PADRAO.test(src)) achados.push(`${rel}: ${m[1]}`);
    }
    expect(achados).toEqual([]);
  });

  it('o padrão mantém a lista aberta, o motivo de quem não pode e a falha dita', () => {
    const src = fs.readFileSync(path.join(RAIZ, PADRAO), 'utf8');
    expect(src).toMatch(/excluir\.get\(/);
    expect(src).toMatch(/V2ErrorState/);
    // A lista aparece sem digitar: nada de "só com termo".
    expect(src).not.toMatch(/if \(!termo\) return \[\]/);
  });
});
