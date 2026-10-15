/**
 * ⭐ As fronteiras da arquitetura, conferidas no código (2026-10-15).
 *
 * A plataforma é em camadas: `src/core` (núcleo) ← `src/modules/<X>` (domínio)
 * ← `src/v2` (telas). Dentro de cada módulo, `domain/` é lógica pura e
 * testável; `services/` fala com o Firebase; `hooks/` liga o serviço à tela.
 * Até aqui isso era convenção escrita em `docs/04-ARCHITECTURE.md` e respeitada
 * por disciplina. Este guarda a transforma em regra: quem cruzar uma fronteira
 * descobre no `npm test`, não em produção.
 *
 * Medido ao escrever: 1.224 arquivos, ZERO ciclo de import (havia um — draw.js
 * com suíço, Mexicano e dupla eliminação — desfeito em `drawPrimitives.js`),
 * zero `domain/` importando Firebase/React/serviço, e zero `modules` ou `core`
 * importando telas.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { grafoEstatico, ciclos, resolver, arquivosDoCodigo } from './grafoDeImports.js';

const RAIZ = process.cwd();
const rel = (p) => path.relative(RAIZ, p).split(path.sep).join('/');
const grafo = grafoEstatico(RAIZ);
const ESPEC = /(?:import|export)\s[^'"]*?from\s*['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

/** Todo import (estático ou dinâmico) de um arquivo: `{ spec, alvo }`. */
function importsDe(arq) {
  return [...readFileSync(arq, 'utf8').matchAll(ESPEC)].map((m) => {
    const spec = m[1] || m[2];
    const alvo = resolver(arq, spec, RAIZ);
    return { spec, alvo: alvo ? rel(alvo) : null };
  });
}

describe('⭐ fronteiras da arquitetura', () => {
  it('⭐ nenhum ciclo de import estático em src/', () => {
    // Ciclo carrega um módulo pela metade: o import chega `undefined` e o
    // erro aparece longe dali, só em certa ordem de carga.
    const grupos = ciclos(grafo).map((g) => g.map(rel).sort().join(' ⇄ '));
    expect(grupos, 'ciclo de import — mova o que é compartilhado para um arquivo-folha').toEqual([]);
  });

  it('⭐ domain/ é puro: sem Firebase, React, serviço, hook, componente ou tela', () => {
    const violacoes = [];
    for (const arq of arquivosDoCodigo(path.join(RAIZ, 'src/modules'))) {
      if (!/\/domain\//.test(arq)) continue;
      for (const { spec, alvo } of importsDe(arq)) {
        const proibido = /^(firebase|react|react-dom|@tanstack)(\/|$)/.test(spec)
          || (alvo && /\/(services|hooks|components|pages)\/|^src\/v2\/|\.jsx$|core\/lib\/firebase/.test(alvo));
        if (proibido) violacoes.push(`${rel(arq)} → ${spec}`);
      }
    }
    expect(violacoes, 'regra de negócio fica testável sem banco nem tela: passe o dado por parâmetro').toEqual([]);
  });

  it('⭐ src/modules nunca importa telas de src/v2 em domain/, services/ ou hooks/', () => {
    const violacoes = arquivosDoCodigo(path.join(RAIZ, 'src/modules'))
      .filter((a) => /\/(domain|services|hooks)\//.test(a))
      .flatMap((a) => importsDe(a).filter((i) => i.alvo?.startsWith('src/v2/')).map((i) => `${rel(a)} → ${i.spec}`));
    expect(violacoes).toEqual([]);
  });

  it('⭐ services/ não importa React, hooks nem componentes (é só I/O)', () => {
    const violacoes = arquivosDoCodigo(path.join(RAIZ, 'src/modules'))
      .filter((a) => /\/services\//.test(a))
      .flatMap((a) => importsDe(a)
        .filter((i) => /^(react|react-dom|@tanstack)(\/|$)/.test(i.spec) || /\/(hooks|components|pages)\/|\.jsx$/.test(i.alvo || ''))
        .map((i) => `${rel(a)} → ${i.spec}`));
    expect(violacoes).toEqual([]);
  });

  /** O núcleo não conhece os módulos. Exceção única, com motivo. */
  const CORE_PARA_MODULOS = new Map([
    ['src/core/lib/FirebaseAuthContext.jsx',
      'no login, sincroniza o perfil do atleta e reivindica inscrições provisórias — é o único ponto em que toda sessão passa'],
  ]);

  it('⭐ src/core não importa src/modules nem src/v2 (salvo a exceção escrita)', () => {
    const violacoes = arquivosDoCodigo(path.join(RAIZ, 'src/core'))
      .filter((a) => !/\/guards\//.test(a))
      .filter((a) => importsDe(a).some((i) => /^src\/(modules|v2)\//.test(i.alvo || '')))
      .map(rel)
      .filter((a) => !CORE_PARA_MODULOS.has(a));
    expect(violacoes, 'o núcleo virou dependente de um módulo — inverta: o módulo chama o núcleo').toEqual([]);
  });

  /**
   * Telas que ainda falam com o Firebase direto, sem serviço no meio. É
   * dívida (a tela fica impossível de testar sem banco): a lista só DIMINUI.
   */
  const TELAS_COM_FIREBASE = new Set([
    'src/v2/components/admin/AdminArenaModulesTab.jsx',
    'src/v2/components/onboarding/V2OnboardingWizard.jsx',
    'src/v2/pages/V2AdminConsole.jsx',
    'src/v2/pages/V2AdminOwnerDebug.jsx',
    'src/v2/pages/V2AdminOwnerRestore.jsx',
    'src/v2/pages/V2ArenaManage.jsx',
    'src/v2/pages/V2ArenaOnboarding.jsx',
    'src/v2/pages/V2ProfileEdit.jsx',
  ]);

  it('⭐ tela nova não importa o SDK do Firebase: o acesso a dados mora em services/', () => {
    const atuais = arquivosDoCodigo(path.join(RAIZ, 'src/v2'))
      .filter((a) => importsDe(a).some((i) => /^firebase\//.test(i.spec)))
      .map(rel);
    const novas = atuais.filter((a) => !TELAS_COM_FIREBASE.has(a));
    expect(novas, 'leia/grave pelo service do módulo (src/modules/X/services) e um hook').toEqual([]);
    const curadas = [...TELAS_COM_FIREBASE].filter((a) => !atuais.includes(a));
    expect(curadas, 'esta tela não fala mais com o Firebase direto: tire-a da lista').toEqual([]);
  });
});
