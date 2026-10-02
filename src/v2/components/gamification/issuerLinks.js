/**
 * Para onde cada quem que OFERECE (arena, professor, clube, plataforma) vai
 * criar desafios, recompensas e ver o engajamento. Puro: o hub só desenha.
 *
 * Os destinos são contrato com as centrais (`?aba=` de cada uma) — há teste.
 */

/** @returns {Array<{ key: string, kind: 'admin'|'arena'|'coach'|'club', label: string, hint: string, to: string }>} */
export function issuerLinks({ isAdmin = false, arenas = [], coach = null, clubs = [] } = {}) {
  const out = [];
  if (isAdmin) {
    out.push({ key: 'admin', kind: 'admin', label: 'Plataforma', hint: 'Configuração, desafios, recompensas e moderação', to: '/admin/painel?tab=gamificacao' });
  }
  (arenas || []).slice(0, 5).forEach((a) => {
    if (!a?.id) return;
    out.push({ key: `arena_${a.id}`, kind: 'arena', label: a.name || 'Minha arena', hint: 'Engajamento, desafios e recompensas da arena', to: `/arenas/${a.id}/gerir?aba=engajamento` });
  });
  if (coach) {
    out.push({ key: 'coach', kind: 'coach', label: 'Painel do professor', hint: 'Engajamento dos alunos, desafios e recompensas', to: '/aulas?aba=engajamento' });
  }
  (clubs || []).filter((c) => c?.my_role === 'admin' || c?.my_role === 'owner').slice(0, 5).forEach((c) => {
    out.push({ key: `club_${c.id}`, kind: 'club', label: c.name || 'Meu clube', hint: 'Atividade do clube, desafios e recompensas', to: `/clubes/${c.id}?tab=atividade` });
  });
  return out;
}
