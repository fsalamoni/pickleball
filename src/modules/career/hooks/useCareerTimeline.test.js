/**
 * A linha do tempo mora fora de `useCareer.js` (o arquivo leve), e os dois se
 * importam em ciclo enquanto o reexport de compatibilidade existir: o ciclo tem
 * de carregar nas duas ordens, e o arquivo leve não pode voltar a importar por
 * import estático o que é pesado.
 */
import { readFileSync } from 'node:fs';
import { describe, it, expect, vi } from 'vitest';

vi.mock('@/core/config/firebase', () => ({ db: null, storage: null, functions: null, auth: null }));

describe('useCareer × useCareerTimeline', () => {
  it('a linha do tempo mora no arquivo próprio e o leve não a reexporta (seria ciclo de import)', async () => {
    const leve = await import('./useCareer.js');
    const linha = await import('./useCareerTimeline.js');
    expect(typeof linha.useCareerTimeline).toBe('function');
    expect(leve.useCareerTimeline).toBeUndefined();
    expect(linha.CAREER_GAMEDAYS_PREF).toBe('carreira:linha:dias-de-jogo');
  });

  it('⭐ o arquivo leve não importa torneios, pódios, dias de jogo nem as federações por import estático', () => {
    const fonte = readFileSync('src/modules/career/hooks/useCareer.js', 'utf8');
    const estaticos = fonte.split('\n').filter((l) => /^import\s/.test(l) || /^\}\s*from\s/.test(l)).join('\n');
    expect(estaticos).not.toMatch(/modules\/(tournament|trophies|games|federations)\//);
    expect(fonte).toMatch(/import\('@\/modules\/federations\/services\/federationService'\)/);
  });
});
