import { describe, expect, it } from 'vitest';
import {
  avatarRemoveUpdate, avatarRestorePhotoUpdate, avatarSaveUpdate, avatarUseAsPhotoUpdate, photoIsAvatar, publicAvatar,
} from './profileAvatar.js';
import { DEFAULT_RECIPE } from './recipe.js';

const FOTO = 'https://storage.example/foto.jpg';
const salvo = (asPhoto, extra = {}) => ({ recipe: { hair: 'afro', email: 'x@y.z' }, url: 'https://storage.example/a1.webp', fullUrl: 'https://storage.example/a1-full.webp', path: 'p', fullPath: 'pf', asPhoto, now: 123, ...extra });

describe('salvar o avatar', () => {
  it('sem virar foto, a foto do perfil não muda', () => {
    const u = avatarSaveUpdate({ photo_url: FOTO }, salvo(false));
    expect(u).not.toHaveProperty('photo_url');
    expect(u.avatar).toMatchObject({ v: 1, url: 'https://storage.example/a1.webp', as_photo: false, photo_backup: FOTO, updated_at_ms: 123 });
  });

  it('a receita gravada é a normalizada (nada pessoal vai junto)', () => {
    const { recipe } = avatarSaveUpdate({}, salvo(false)).avatar;
    expect(recipe).toEqual({ ...DEFAULT_RECIPE, hair: 'afro' });
  });

  it('ao virar foto, guarda a foto de verdade para voltar', () => {
    const u = avatarSaveUpdate({ photo_url: FOTO }, salvo(true));
    expect(u.photo_url).toBe('https://storage.example/a1.webp');
    expect(u.avatar.photo_backup).toBe(FOTO);
  });

  // 🐞 Sem isto, salvar o avatar duas vezes guardava o PRIMEIRO avatar como "foto de antes" e a foto real se perdia.
  it('salvar de novo não troca a foto guardada pelo avatar anterior', () => {
    const primeiro = avatarSaveUpdate({ photo_url: FOTO }, salvo(true));
    const perfil = { photo_url: primeiro.photo_url, avatar: primeiro.avatar };
    const segundo = avatarSaveUpdate(perfil, salvo(true, { url: 'https://storage.example/a2.webp' }));
    expect(segundo.avatar.photo_backup).toBe(FOTO);
    expect(segundo.photo_url).toBe('https://storage.example/a2.webp');
  });

  it('salvar sem "usar como foto" quando o avatar era a foto devolve a foto guardada', () => {
    const primeiro = avatarSaveUpdate({ photo_url: FOTO }, salvo(true));
    const u = avatarSaveUpdate({ photo_url: primeiro.photo_url, avatar: primeiro.avatar }, salvo(false, { url: 'https://storage.example/a2.webp' }));
    expect(u.photo_url).toBe(FOTO);
    expect(u.avatar.as_photo).toBe(false);
  });
});

describe('voltar para a foto, usar de novo e apagar', () => {
  const comAvatar = (() => {
    const u = avatarSaveUpdate({ photo_url: FOTO }, salvo(true));
    return { photo_url: u.photo_url, avatar: u.avatar };
  })();

  it('reconhece quando a foto do perfil é o avatar', () => {
    expect(photoIsAvatar(comAvatar)).toBe(true);
    expect(photoIsAvatar({ ...comAvatar, photo_url: FOTO })).toBe(false);
    expect(photoIsAvatar({ photo_url: FOTO })).toBe(false);
  });

  it('voltar para a foto devolve a guardada e mantém o avatar salvo', () => {
    const u = avatarRestorePhotoUpdate(comAvatar);
    expect(u.photo_url).toBe(FOTO);
    expect(u.avatar).toMatchObject({ as_photo: false, url: comAvatar.avatar.url });
    expect(avatarRestorePhotoUpdate({ photo_url: FOTO })).toBeNull();
  });

  it('usar de novo como foto guarda a foto que estava lá', () => {
    const semFoto = { photo_url: 'https://storage.example/nova.jpg', avatar: { ...comAvatar.avatar, as_photo: false } };
    const u = avatarUseAsPhotoUpdate(semFoto);
    expect(u.photo_url).toBe(comAvatar.avatar.url);
    expect(u.avatar).toMatchObject({ as_photo: true, photo_backup: 'https://storage.example/nova.jpg' });
    expect(avatarUseAsPhotoUpdate({ avatar: {} })).toBeNull();
  });

  it('apagar devolve a foto guardada só se o avatar era a foto', () => {
    expect(avatarRemoveUpdate(comAvatar)).toEqual({ avatar: null, photo_url: FOTO });
    expect(avatarRemoveUpdate({ photo_url: FOTO, avatar: comAvatar.avatar })).toEqual({ avatar: null });
    expect(avatarRemoveUpdate({})).toBeNull();
  });
});

describe('o que vai para o perfil público', () => {
  const u = avatarSaveUpdate({ photo_url: FOTO }, salvo(true));
  const perfil = { photo_url: u.photo_url, avatar: u.avatar };

  it('só quando o avatar É a foto do perfil', () => {
    expect(publicAvatar(perfil)).toEqual({ recipe: u.avatar.recipe, full_url: u.avatar.full_url, updated_at_ms: 123 });
    expect(publicAvatar({ ...perfil, avatar: { ...u.avatar, as_photo: false } })).toBeNull();
    expect(publicAvatar({})).toBeNull();
  });

  it('trocar a foto por outra tira o avatar do espelho', () => {
    expect(publicAvatar({ ...perfil, photo_url: FOTO })).toBeNull();
  });

  it('não leva a foto guardada nem os caminhos do Storage', () => {
    expect(Object.keys(publicAvatar(perfil)).sort()).toEqual(['full_url', 'recipe', 'updated_at_ms']);
  });
});
