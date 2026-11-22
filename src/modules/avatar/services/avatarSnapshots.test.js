import { describe, expect, it, vi } from 'vitest';
import { normalizeBrandPaddle } from '../domain/brandItems.js';
import { DEFAULT_RECIPE } from '../domain/recipe.js';
import { cachedSnap, requestSnap, snapKey } from './avatarSnapshots.js';
import { renderAvatarBlob } from './avatarExport.js';

vi.mock('../three/stage.js', () => {
  throw new Error('a three.js não pode ser carregada sem WebGL');
});

const marca = normalizeBrandPaddle({ brand: 'ACME', name: 'Pro 16', color: '#ef4444' });

describe('fotos do avatar', () => {
  it('a chave muda com a receita, o enquadramento e o tamanho', () => {
    const base = snapKey(DEFAULT_RECIPE, { view: 'face' });
    expect(snapKey({ ...DEFAULT_RECIPE }, { view: 'face' })).toBe(base);
    expect(snapKey({ ...DEFAULT_RECIPE, hair: 'afro' }, { view: 'face' })).not.toBe(base);
    expect(snapKey(DEFAULT_RECIPE, { view: 'bust' })).not.toBe(base);
    expect(snapKey(DEFAULT_RECIPE, { view: 'face', width: 320, height: 320 })).not.toBe(base);
  });

  // A miniatura da raquete de marca tem de mudar quando o admin troca a cor do item.
  it('a chave leva a raquete de marca como ela está AGORA', () => {
    const r = { ...DEFAULT_RECIPE, paddleBrand: marca.id };
    const antes = snapKey(r, { view: 'paddle', brandItems: [marca] });
    expect(snapKey(r, { view: 'paddle', brandItems: [{ ...marca, color: '#2563eb' }] })).not.toBe(antes);
    expect(snapKey(DEFAULT_RECIPE, { view: 'paddle', brandItems: [marca] })).toBe(snapKey(DEFAULT_RECIPE, { view: 'paddle' }));
  });

  it('sem 3D no aparelho o pedido falha dizendo o motivo, sem baixar a three.js', async () => {
    const req = requestSnap(DEFAULT_RECIPE, { view: 'face' });
    await expect(req.promise).rejects.toThrow('webgl');
    expect(cachedSnap(req.key)).toBeNull();
    expect(() => req.cancel()).not.toThrow();
  });

  it('salvar a imagem falha com o mesmo motivo (a página avisa a pessoa)', async () => {
    await expect(renderAvatarBlob(DEFAULT_RECIPE, { view: 'bust' })).rejects.toThrow('webgl');
  });
});
