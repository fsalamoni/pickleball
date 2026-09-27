/**
 * O INÍCIO SOB MEDIDA — as regras que um teste de comportamento não enxerga.
 *
 *  1. ⭐ todo card do catálogo tem desenho na tela inicial. Card acrescentado
 *     ao catálogo e esquecido no `switch` não dá erro: a pessoa liga o
 *     interruptor e NADA aparece — e conclui que a plataforma não funciona;
 *  2. ⭐ zero banco: a escolha mora no navegador, por usuário. Nenhum arquivo
 *     do início sob medida fala com o Firestore nem grava o perfil — um dia
 *     alguém "melhora" a escolha para sincronizar entre aparelhos, e isso é
 *     uma decisão de projeto (coleção, regra, privacidade), não um atalho;
 *  3. o seletor é baixado SOB DEMANDA na tela inicial (a tela que todo mundo
 *     abre não paga por um diálogo que quase ninguém abre todo dia).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { HOME_SECTION } from '@/modules/home/domain/homeProfile';
import { ALL_HOME_CARDS, HOME_CARD, isSectionCard } from '@/modules/home/domain/homeCards';

const ler = (p) => readFileSync(p, 'utf8');
const semComentarios = (src) => src
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
  .split('\n')
  .filter((l) => !l.trim().startsWith('//'))
  .join('\n');

const TELA = 'src/v2/components/home/personal/V2PersonalHome.jsx';

const ARQUIVOS_DO_RECURSO = [
  'src/modules/home/domain/homeCards.js',
  'src/modules/home/services/homeCardsPreference.js',
  'src/modules/home/hooks/useHomeCards.js',
  'src/v2/components/home/cards/HomeCardsPicker.jsx',
  'src/v2/components/home/cards/HomeCardsDialog.jsx',
  'src/v2/components/home/cards/HomeCardsSettingsCard.jsx',
  'src/v2/components/home/cards/HomeCardsEmpty.jsx',
];

describe('⭐ todo card do catálogo tem desenho na tela inicial', () => {
  const fonte = semComentarios(ler(TELA));
  const chave = (grupo, valor) => Object.entries(grupo).find(([, v]) => v === valor)?.[0];

  it('cada seção do catálogo é tratada no switch das seções', () => {
    const faltando = ALL_HOME_CARDS.filter(isSectionCard)
      .filter((id) => !fonte.includes(`case HOME_SECTION.${chave(HOME_SECTION, id)}:`));
    expect(faltando).toEqual([]);
  });

  it('cada card que não é seção é tratado no switch dos cards extras', () => {
    const extras = ALL_HOME_CARDS.filter((id) => !isSectionCard(id));
    expect(extras.length).toBeGreaterThan(0);
    const faltando = extras.filter((id) => !fonte.includes(`case HOME_CARD.${chave(HOME_CARD, id)}:`));
    expect(faltando).toEqual([]);
  });
});

describe('⭐ zero banco', () => {
  it.each(ARQUIVOS_DO_RECURSO)('%s não fala com o Firestore nem grava o perfil', (arquivo) => {
    const fonte = semComentarios(ler(arquivo));
    expect(fonte).not.toMatch(/from ['"]firebase\//);
    expect(fonte).not.toMatch(/from ['"]@\/core\/firebase/);
    expect(fonte).not.toMatch(/updateUserProfile|setDoc|updateDoc|addDoc/);
  });
});

describe('o seletor sai do pacote da tela inicial', () => {
  it('HomeCardsDialog é importado com lazy(), nunca direto', () => {
    const fonte = semComentarios(ler(TELA));
    expect(fonte).toMatch(/lazy\(\(\) => import\(['"]\.\.\/cards\/HomeCardsDialog['"]\)\)/);
    expect(fonte).not.toMatch(/^import HomeCardsDialog/m);
    expect(fonte).not.toMatch(/import HomeCardsPicker/);
  });
});
