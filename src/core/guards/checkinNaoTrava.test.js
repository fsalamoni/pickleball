/**
 * 🐞 O CHECK-IN NÃO PODE TIRAR NINGUÉM DE NADA.
 *
 * O check-in é opcional: confirma a presença de quem está no local. Uma
 * inscrição com check-in feito joga exatamente como uma confirmada — entra no
 * sorteio, nas fases, nas vagas e nas contagens. Essa pergunta tem UMA
 * resposta, `isActiveRegistration` (`modules/tournament/domain/checkin.js`).
 *
 * Ela estava escrita à mão em nove lugares (`status === CONFIRMED || status
 * === CHECKED_IN`), e uma das cópias — a contagem da aba de inscrições — só
 * somava o check-in atrás de uma condição. Cópia que esquece o check-in não
 * dá erro: a pessoa simplesmente some da conta depois de confirmar presença.
 *
 * Este guarda lê o código-fonte e reprova a comparação direta com
 * `REGISTRATION_STATUS.CONFIRMED` fora dos lugares em que ela significa
 * "ainda SEM check-in" (o botão de fazer check-in), com o motivo escrito.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const semComentarios = (src) => src
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .split('\n')
  .map((l) => (l.trim().startsWith('//') ? '' : l))
  .join('\n');

function arquivos(dir) {
  return readdirSync(dir).flatMap((nome) => {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) return arquivos(caminho);
    if (!/\.(js|jsx)$/.test(nome) || /\.test\.(js|jsx)$/.test(nome)) return [];
    return [caminho];
  });
}

/** Onde comparar com CONFIRMED quer dizer "confirmada e ainda SEM check-in". */
const PERMITIDOS = {
  'src/modules/tournament/domain/checkin.js': 'a fonte única: o check-in só sai de uma inscrição confirmada',
  'src/v2/components/tournament/V2TournamentRegistrationsTab.jsx': 'o botão "Fazer check-in" aparece só para quem ainda não fez',
};

const COMPARA_CONFIRMADA = /[!=]==\s*REGISTRATION_STATUS\.CONFIRMED\b|REGISTRATION_STATUS\.CONFIRMED\s*[!=]==/g;

describe('⭐ o check-in não tira ninguém do sorteio, das fases nem das contagens', () => {
  const todos = arquivos('src');

  it('ninguém compara com "confirmada" à mão (use isActiveRegistration)', () => {
    const achados = todos
      .filter((f) => !PERMITIDOS[f])
      .flatMap((f) => {
        const src = semComentarios(readFileSync(f, 'utf8'));
        return (src.match(COMPARA_CONFIRMADA) || []).map(() => f);
      });
    expect(achados).toEqual([]);
  });

  it('as exceções existem e continuam fazendo a comparação (senão a lista envelhece)', () => {
    Object.keys(PERMITIDOS).forEach((f) => {
      const src = semComentarios(readFileSync(f, 'utf8'));
      expect(src.match(COMPARA_CONFIRMADA), f).not.toBeNull();
    });
  });

  it('o sorteio, as fases e as vagas fictícias perguntam a isActiveRegistration', () => {
    [
      'src/modules/tournament/services/drawService.js',
      'src/modules/tournament/services/phaseService.js',
      'src/modules/tournament/services/registrationService.js',
      'src/modules/tournament/components/MultiPhaseDrawBlock.jsx',
      'src/v2/components/tournament/V2TournamentDrawTab.jsx',
      'src/v2/pages/V2ModalityPage.jsx',
      'src/v2/components/tournament/V2OverviewBlock.jsx',
    ].forEach((f) => {
      expect(readFileSync(f, 'utf8'), f).toContain('isActiveRegistration');
    });
  });
});
