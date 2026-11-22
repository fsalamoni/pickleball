/**
 * O que o espelho público (`athlete_profiles.avatar`) leva do avatar: a
 * receita (para o avatar VIVO no perfil público) e a imagem de corpo
 * inteiro — só quando a pessoa escolheu o avatar como foto. Nada pessoal:
 * ids do catálogo e cores.
 *
 * Arquivo-folha SEM imports de propósito: o perfil público é montado no
 * login (pacote inicial), e o catálogo do avatar não pode ir junto. Quem
 * desenha normaliza a receita na hora.
 */
export function publicAvatar(profile) {
  const a = profile?.avatar;
  // Trocar a foto por outra (Editar perfil) tira o avatar do espelho, mesmo com `as_photo` ainda marcado.
  if (!a?.as_photo || !a.url || profile.photo_url !== a.url || !a.recipe || typeof a.recipe !== 'object') return null;
  return { recipe: a.recipe, full_url: a.full_url || '', updated_at_ms: a.updated_at_ms || 0 };
}
