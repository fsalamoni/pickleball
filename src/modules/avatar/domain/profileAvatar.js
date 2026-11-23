/**
 * O avatar NO PERFIL (puro): o que gravar em `users` ao salvar, ao voltar
 * para a foto e ao apagar — e o que vai para o espelho público.
 *
 * A foto de verdade nunca se perde: ao virar foto do perfil, a anterior fica
 * em `avatar.photo_backup` (salvo se ela mesma já era um avatar).
 */
import { normalizeRecipe } from './recipe.js';

/** O `photo_url` atual é um avatar nosso? */
export function photoIsAvatar(profile) {
  const a = profile?.avatar;
  const photo = profile?.photo_url || '';
  return Boolean(a?.url && photo === a.url);
}

/**
 * Campos a gravar em `users` ao salvar um avatar.
 * @param {object} profile o cadastro atual
 * @param {{ recipe:object, url:string, fullUrl:string, path?:string, fullPath?:string, asPhoto:boolean, now?:number }} saved
 */
export function avatarSaveUpdate(profile, saved) {
  const prev = profile?.avatar || null;
  const photo = profile?.photo_url || '';
  const wasAvatar = Boolean(prev?.url && photo === prev.url);
  // A foto "de verdade": a que está lá agora, se não for um avatar; senão a guardada.
  const backup = wasAvatar ? (prev?.photo_backup || '') : photo;
  const avatar = {
    v: 1,
    // A raquete de marca já foi conferida pelo servidor ao criar a imagem: fica como veio.
    recipe: normalizeRecipe(saved.recipe, { brandIds: saved.recipe?.paddleBrand ? [saved.recipe.paddleBrand] : [] }),
    url: saved.url,
    full_url: saved.fullUrl,
    path: saved.path || '',
    full_path: saved.fullPath || '',
    as_photo: saved.asPhoto === true,
    photo_backup: backup || '',
    updated_at_ms: saved.now ?? Date.now(),
  };
  const update = { avatar };
  if (saved.asPhoto) update.photo_url = saved.url;
  else if (wasAvatar) update.photo_url = backup || '';
  return update;
}

/** Voltar para a foto: devolve a guardada e o avatar deixa de ser a foto. */
export function avatarRestorePhotoUpdate(profile) {
  const a = profile?.avatar;
  if (!a) return null;
  return { avatar: { ...a, as_photo: false }, photo_url: a.photo_backup || '' };
}

/** Usar de novo o avatar já salvo como foto. */
export function avatarUseAsPhotoUpdate(profile) {
  const a = profile?.avatar;
  if (!a?.url) return null;
  const photo = profile?.photo_url || '';
  const backup = photo && photo !== a.url ? photo : a.photo_backup || '';
  return { avatar: { ...a, as_photo: true, photo_backup: backup }, photo_url: a.url };
}

/** Apagar o avatar (a foto guardada volta, se o avatar era a foto). */
export function avatarRemoveUpdate(profile) {
  const a = profile?.avatar;
  if (!a) return null;
  const update = { avatar: null };
  if (profile?.photo_url && profile.photo_url === a.url) update.photo_url = a.photo_backup || '';
  return update;
}

/** O espelho público mora num arquivo-folha (vai no pacote inicial). */
export { publicAvatar } from './publicAvatar.js';
