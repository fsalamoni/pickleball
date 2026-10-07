/**
 * OS GRUPOS DO PLAY TÊM UMA FONTE SÓ — e um interruptor só.
 *
 * Três propriedades que nenhum teste de comportamento pega, porque cada tela,
 * isolada, funciona:
 *
 *  1. **Previsão = criação.** A tela anuncia quem entra em cada quadra e o
 *     serviço cria a partida. Se cada um escolhesse por conta própria, a tela
 *     prometeria uma partida e a quadra receberia outra — o defeito que o Play
 *     já teve antes do rodízio. Por isso as duas pontas usam o MESMO sorteador
 *     (`makeGroupsDrawer`), e ninguém fora do domínio chama `pickGroupedMatch`.
 *  2. **A flag é o interruptor geral.** Os grupos gravados no dia só valem
 *     lidos por `usePlayGroups`/`isPlayGroupsActive`. Uma tela que leia
 *     `gameDay.play_groups` direto ignoraria a flag desligada.
 *  3. **Aditivo.** Nenhuma coleção ou índice novo: os grupos moram em campos
 *     opcionais de documentos que já existem. A ÚNICA regra é uma cláusula
 *     estreita para o administrador nomeado editar os grupos; se ela alargar
 *     (outras chaves, outros formatos, o participante), ou se aparecer regra
 *     nova "para os grupos", o banco passou a ser afetado e a decisão precisa
 *     ser consciente — não um efeito colateral.
 *
 * Mesmo estilo de `diaDeJogoUniforme.test.js`: lê o código-fonte.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { semComentarios } from './afirmaVazio.js';

const ler = (p) => readFileSync(p, 'utf8');

function varrer(raiz, filtro) {
  const achados = [];
  const visitar = (dir) => {
    for (const nome of readdirSync(dir)) {
      const caminho = join(dir, nome);
      if (statSync(caminho).isDirectory()) visitar(caminho);
      else if (filtro(caminho)) achados.push(caminho);
    }
  };
  visitar(raiz);
  return achados.sort();
}

const ehTeste = (c) => /\.(test|runtime\.test)\.(js|jsx)$/.test(c);
const codigo = (c) => /\.(js|jsx)$/.test(c) && !ehTeste(c);

describe('⭐ previsão e criação usam o MESMO sorteador', () => {
  it('só o domínio chama `pickGroupedMatch` — nenhuma tela, hook ou serviço', () => {
    const quem = varrer('src', codigo)
      .filter((c) => semComentarios(ler(c)).includes('pickGroupedMatch'))
      .filter((c) => !c.endsWith('modules/games/domain/playGroupsDraw.js'));
    expect(quem, `estes arquivos escolhem a partida por fora do sorteador:\n  ${quem.join('\n  ')}`).toEqual([]);
  });

  it('o serviço sorteia pelo `makeGroupsDrawer`', () => {
    expect(semComentarios(ler('src/modules/games/services/gameDayService.js'))).toContain('makeGroupsDrawer(');
  });

  it('as três telas do Play montam o sorteador pelo hook compartilhado (ou pela própria fábrica)', () => {
    ['src/v2/components/games/AthletePlayOrganizer.jsx',
      'src/v2/components/games/AthletePlayParticipant.jsx',
      'src/v2/pages/V2GameDayTelao.jsx'].forEach((c) => {
      const src = semComentarios(ler(c));
      expect(/usePlayGroupsContext\(|makeGroupsDrawer\(/.test(src), `${c} não usa o sorteador compartilhado`).toBe(true);
    });
  });

  it('a previsão e a ordem exibida recebem o sorteador (`groups`), não uma lógica própria', () => {
    const rot = semComentarios(ler('src/modules/games/domain/playRotation.js'));
    expect(rot).toContain('groups.pick(');
    // Sem import de playGroupsDraw: seria um ciclo, e o motivo de o sorteador ser injetado.
    expect(rot).not.toMatch(/from ['"]\.\/playGroupsDraw/);
  });
});

describe('⭐ a flag `play_groups` é o interruptor geral', () => {
  it('nenhuma tela lê o campo `play_groups` do dia — só por `usePlayGroups`', () => {
    const quem = varrer('src/v2', (c) => c.endsWith('.jsx') && !ehTeste(c))
      .filter((c) => /\bplay_groups\b/.test(semComentarios(ler(c))));
    expect(quem, `estas telas leem os grupos gravados sem passar pela flag:\n  ${quem.join('\n  ')}`).toEqual([]);
  });

  it('o hook consulta a flag e o domínio decide se os grupos valem', () => {
    const hook = semComentarios(ler('src/modules/games/hooks/usePlayGroups.js'));
    expect(hook).toContain('FEATURE_FLAG.PLAY_GROUPS');
    expect(hook).toContain('isPlayGroupsActive(');
  });

  it('o serviço também confere a flag antes de sortear com grupos', () => {
    const svc = semComentarios(ler('src/modules/games/services/gameDayService.js'));
    expect(svc).toContain('isPlayGroupsActive(');
  });

  it('nasce desligada', async () => {
    const { DEFAULT_FEATURE_FLAGS, FEATURE_FLAG } = await import('@/core/featureFlags');
    expect(DEFAULT_FEATURE_FLAGS[FEATURE_FLAG.PLAY_GROUPS]).toBe(false);
  });
});

describe('⭐ as mutações dos grupos moram à parte', () => {
  it('`useGameDays.js` não expõe as mutações de grupos (as seções compartilhadas dependem dele)', () => {
    // Foi a lição da integração: pôr as mutações ali fez 27 testes de seções
    // compartilhadas — e o Americano aprimorado — passarem a depender dos grupos.
    const src = semComentarios(ler('src/modules/games/hooks/useGameDays.js'));
    ['useSetPlayGroups', 'useSetPlayParticipantGroup', 'useAssignPlayGroups'].forEach((h) => {
      expect(src, `${h} voltou para useGameDays.js`).not.toContain(h);
    });
    expect(semComentarios(ler('src/modules/games/hooks/usePlayGroupMutations.js'))).toContain('useSetPlayGroups');
  });

  it('nenhuma seção COMPARTILHADA importa as mutações de grupos — só os filhos que existem com grupos', () => {
    const src = semComentarios(ler('src/v2/components/games/AthletePlayOrganizer.jsx'));
    const importa = /usePlayGroupMutations/.test(src);
    // Se importa, é por um componente-filho (ParticipantGroupSelect), nunca no corpo das seções.
    if (importa) {
      expect(src).toMatch(/function ParticipantGroupSelect/);
    }
  });
});

describe('⭐ nenhuma leitura de grupos engole a falha', () => {
  it('o hook de níveis não tem `.catch(() => …)`', () => {
    const src = semComentarios(ler('src/modules/games/hooks/usePlayGroups.js'));
    expect(src).not.toMatch(/\.catch\s*\(/);
  });
});

describe('⭐ banco: só campos opcionais e UMA cláusula estreita de regra', () => {
  it('`storage.rules` não conhece os grupos', () => {
    expect(ler('storage.rules')).not.toMatch(/play_group/);
  });

  it('⭐ no `firestore.rules` os grupos aparecem numa cláusula só: a do administrador nomeado, estreita', () => {
    const regras = ler('firestore.rules');
    // `play_group_id` (participante) e `group_*` (partida) não têm regra nenhuma:
    // `participants` e `games` não têm lista fechada de campos.
    expect(regras).not.toMatch(/play_group_id/);
    // Todas as menções a `play_groups` moram dentro da MESMA cláusula (do seu
    // comentário até o `allow delete` que vem logo depois)…
    const ini = regras.indexOf('GRUPOS DO PLAY (flag');
    const fim = regras.indexOf('allow delete', ini);
    expect(ini, 'o comentário da cláusula sumiu').toBeGreaterThan(-1);
    expect(fim).toBeGreaterThan(ini);
    const clausula = regras.slice(ini, fim);
    expect(regras.match(/play_groups/g).length).toBe(clausula.match(/play_groups/g).length);
    expect(regras).toContain("hasOnly(['play_groups', 'play_groups_policy', 'updated_at'])");
    // …e ela é estreita: só nomeado, só Play, dono intocado, grupos conferidos.
    expect(clausula).toContain("resource.data.format == 'play'");
    expect(clausula).toContain('request.auth.uid in resource.data.admin_uids');
    expect(clausula).toContain('request.resource.data.created_by == resource.data.created_by');
    expect(clausula).toContain('size() <= 10');
    expect(clausula).toContain("['queue', 'rotate', 'priority']");
    // Nada de abrir para quem só participa: a cláusula não consulta a gestão aberta.
    expect(clausula).not.toMatch(/canManageGameDayOf|gameDayOpenToParticipants|member_uids/);
  });

  it('⭐ a flag aparece no painel admin, no grupo "Dia de jogo", com rótulo e explicação', async () => {
    const { FLAG_GROUPS } = await import('@/core/featureFlagGroups');
    const { FEATURE_FLAG, FEATURE_FLAG_META } = await import('@/core/featureFlags');
    const grupo = FLAG_GROUPS.find((g) => g.keys.includes(FEATURE_FLAG.PLAY_GROUPS));
    expect(grupo?.label).toBe('Dia de jogo');
    expect(FEATURE_FLAG_META[FEATURE_FLAG.PLAY_GROUPS].label.length).toBeGreaterThan(5);
    expect(FEATURE_FLAG_META[FEATURE_FLAG.PLAY_GROUPS].description.length).toBeGreaterThan(40);
  });

  it('⭐ o cartão recebe a permissão de editar os grupos (`podeEditarGrupos`), não a de configurar o dia', () => {
    const src = semComentarios(ler('src/v2/components/games/AthletePlayOrganizer.jsx'));
    expect(src).toMatch(/podeConfigurar=\{podeEditarGrupos/);
    expect(src).not.toMatch(/podeConfigurar=\{podeConfigurar/);
  });

  it('`firestore.indexes.json` não ganhou índice por causa dos grupos', () => {
    expect(ler('firestore.indexes.json')).not.toMatch(/play_group|group_id/);
  });
});
