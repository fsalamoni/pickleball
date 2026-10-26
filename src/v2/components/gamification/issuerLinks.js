import { t } from '@/core/i18n';
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
    out.push({ key: 'admin', kind: 'admin', label: t('Plataforma'), hint: t('Configuração, desafios, recompensas e moderação'), to: '/admin/painel?tab=gam-config' });
  }
  (arenas || []).slice(0, 5).forEach((a) => {
    if (!a?.id) return;
    out.push({ key: `arena_${a.id}`, kind: 'arena', label: a.name || t('Minha arena'), hint: t('Engajamento, desafios e recompensas da arena'), to: `/arenas/${a.id}/gerir?aba=engajamento` });
  });
  if (coach) {
    out.push({ key: 'coach', kind: 'coach', label: t('Painel do professor'), hint: t('Engajamento dos alunos, desafios e recompensas'), to: '/aulas?aba=engajamento' });
  }
  (clubs || []).filter((c) => c?.my_role === 'admin' || c?.my_role === 'owner').slice(0, 5).forEach((c) => {
    out.push({ key: `club_${c.id}`, kind: 'club', label: c.name || t('Meu clube'), hint: t('Atividade do clube, desafios e recompensas'), to: `/clubes/${c.id}/gerir?aba=engajamento` });
  });
  return out;
}
