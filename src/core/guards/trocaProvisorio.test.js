import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// A troca do inscrito provisório pela conta do atleta é COMPLETA e do servidor
// (docs/18-RANKINGS.md §10.2a). O que não pode voltar: ligar só o uid pelo
// cliente, e o formulário do lápis regravar o lado que está sendo ligado.
const ler = (p) => readFileSync(resolve(process.cwd(), p), 'utf8');
const servico = ler('src/modules/tournament/services/registrationService.js');
const tela = ler('src/v2/components/tournament/V2TournamentRegistrationsTab.jsx');
const fn = ler('functions/index.js');

describe('troca do inscrito provisório pela conta', () => {
  it('o vínculo passa pela função de servidor, nunca por updateDoc no cliente', () => {
    const corpo = servico.slice(servico.indexOf('export async function linkRegistrationPlayerToAccount'), servico.indexOf('async function callRegistrationLink'));
    expect(corpo).toContain('callRegistrationLink(');
    expect(corpo).not.toMatch(/updateDoc\(/);
    expect(servico).toContain("'tournamentLinkRegistrationAccount'");
    expect(fn).toMatch(/^exports\.tournamentLinkRegistrationAccount = onCall/m);
  });
  it('o lápis não regrava o lado que recebe os dados oficiais', () => {
    expect(tela).toContain('player_a: editaA ? playerA : null');
    expect(tela).toContain('player_b: editaB ? playerB : null');
  });
});
