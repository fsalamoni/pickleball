/**
 * V2AdminConsole — Painel Admin (hub em /admin/painel).
 *
 * Navegação por tarefa do admin (ver `SECTIONS`): Hoje (com "Precisa de você"),
 * Pessoas, Torneios, Arenas, Treino, Gamificação, Divulgação, Funcionalidades e,
 * no fim, Sistema (auditoria, exportação DUPR, diagnóstico). A aba mora na URL
 * (`?tab=`), então links e avisos antigos continuam abrindo.
 *
 * Branding e Conteúdo saíram: gravavam em `platform_settings/global` campos que
 * nenhuma tela da plataforma lê.
 */

import React, { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  Archive,
  CheckCircle2,
  ExternalLink,
  Flag,
  Handshake,
  LayoutDashboard,
  ListChecks,
  Loader2,
  Pencil,
  Plus,
  Puzzle,
  Stethoscope,
  Trash2,
  Trophy,
  Users,
  Building2,
  ShoppingBasket,
  Check,
  X,
  KeyRound,
  Megaphone,
  Sparkles,
  SlidersHorizontal,
  Gift,
  ShieldAlert,
  BarChart3,
  Dumbbell,
  ClipboardCheck,
  BookOpenCheck,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  collection,
  getCountFromServer,
} from 'firebase/firestore';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { ImageUpload } from '@/components/ui/image-upload';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { UserCog, Wrench, FileDown } from 'lucide-react';
import ProfilesTab from './V2AdminProfiles.jsx';
import {
  FLAG_GROUPS, FLAG_GROUP_OTHER, FLAG_GROUP_ARENA_V3, bucketAllFlags,
  arenaFlagFamily, ARENA_FAMILY_LABEL, humanizeFlagKey,
} from '@/core/featureFlagGroups';
import { AuditLogTable } from '@/components/AuditLogTable';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useFeatureFlags } from '@/core/lib/FeatureFlagsContext';
import { FEATURE_FLAG_META, countFlags } from '@/core/featureFlags';
import {
  setFeatureFlag,
} from '@/core/services/platformSettingsService';
import { db, firebaseDisabledReason, firebaseServicesEnabled } from '@/core/config/firebase';
import RankingAutomatico from '@/modules/admin/components/RankingAutomatico';
import {
  cancelAndArchiveTournament,
  deleteTournamentCascading,
  listAllTournaments,
  setTournamentArchived,
} from '@/modules/admin/services/adminService';
import { listArenas } from '@/modules/arenas/services/arenaService';
import AdminCatalogTab from '@/v2/components/admin/AdminCatalogTab';
import AdminAccessTab from '@/v2/components/admin/AdminAccessTab';
import AdminUserRecordsTab from '@/v2/components/admin/AdminUserRecordsTab';
import AdminDuprExportTab from '@/v2/components/admin/AdminDuprExportTab';
import AdminArenaModulesTab from '@/v2/components/admin/AdminArenaModulesTab';
import { useAdminInbox } from '@/v2/components/admin/useAdminInbox';

// Sob demanda: só com a flag `platform_marketing`, e só quando a aba abre.
const PlatformPromoConsole = lazy(() => import('@/v2/components/promo/PlatformPromoConsole'));
import {
  useAffiliateLinks,
  useCreateAffiliateLink,
  useDeleteAffiliateLink,
  useUpdateAffiliateLink,
} from '@/modules/partners/hooks/useAffiliates';
import {
  AFFILIATE_CATEGORY_LABELS,
  normalizeAffiliateInput,
  safeAffiliateUrl,
} from '@/modules/partners/domain/affiliate';
import { TOURNAMENT_STATUS_LABELS } from '@/modules/tournament/domain/constants';
import { cn } from '@/core/lib/utils';
import { V2Badge, V2Button, V2EmptyState, V2Field, V2Input, V2PageIntro, V2Skeleton, V2StatCard, V2Surface, V2Textarea, V2Toggle, V2Select } from '@/v2/ui/primitives';
import AdminConsoleNav from '@/v2/components/admin/AdminConsoleNav';
import { flagsQueMudam, resolveAdminTab } from '@/modules/admin/domain/consoleNav';

// Navegação em dois níveis, por TAREFA do admin: o que se usa todo dia vem
// primeiro, o que é raro (auditoria, exportação, diagnóstico) fica em Sistema.
// Os ids das abas são contrato (links, avisos, dicas guiadas): nunca renomeie.
const AdminGamificationPanel = lazy(() => import('@/v2/components/admin/gamification/AdminGamificationPanel'));
const AdminTrainingPanel = lazy(() => import('@/v2/components/admin/training/AdminTrainingPanel'));

const SECTIONS = Object.freeze([
  { id: 'today', label: 'Hoje', icon: LayoutDashboard, tabs: [
    { id: 'overview', label: 'Resumo', icon: LayoutDashboard, keywords: ['precisa de você', 'pendências', 'fila', 'ranking', 'métricas'] },
  ] },
  { id: 'people', label: 'Pessoas', icon: Users, tabs: [
    // Cadastros + Perfis: uma pessoa, um lugar. As ferramentas do diretório
    // (perfis públicos, moderação, migração) abrem dentro de Cadastros.
    { id: 'records', label: 'Cadastros', icon: UserCog, keywords: ['usuários', 'perfis', 'excluir conta', 'contas excluídas', 'unificar', 'moderação'] },
    { id: 'access', label: 'Acessos', icon: KeyRound, keywords: ['admin', 'poderes', 'permissões'] },
  ] },
  { id: 'competition', label: 'Torneios', icon: Trophy, tabs: [
    { id: 'tournaments', label: 'Torneios', icon: Trophy },
  ] },
  { id: 'arenasSection', label: 'Arenas', icon: Building2, tabs: [
    { id: 'arenas', label: 'Arenas', icon: Building2 },
    { id: 'catalog', label: 'Catálogo', icon: ShoppingBasket },
    // A camada em que o admin LIBERA os módulos adicionais às arenas.
    { id: 'arena-modules', label: 'Módulos de arena', icon: Puzzle, keywords: ['liberar'] },
  ] },
  // O Centro de Treino: conteúdo, revisão, denúncias, biblioteca inicial e configuração.
  { id: 'training', label: 'Treino', icon: Dumbbell, dica: 'admin-secao-treino', tabs: [
    { id: 'treino-conteudo', label: 'Conteúdo', icon: Dumbbell },
    { id: 'treino-revisao', label: 'Revisão', icon: ClipboardCheck },
    { id: 'treino-denuncias', label: 'Denúncias', icon: Flag },
    { id: 'treino-biblioteca', label: 'Biblioteca inicial', icon: BookOpenCheck },
    { id: 'treino-config', label: 'Configurações', icon: SlidersHorizontal },
  ] },
  { id: 'gamification', label: 'Gamificação', icon: Sparkles, dica: 'admin-secao-gamificacao', tabs: [
    { id: 'gam-config', label: 'Configuração', icon: SlidersHorizontal },
    { id: 'gam-challenges', label: 'Desafios', icon: Trophy },
    { id: 'gam-rewards', label: 'Recompensas', icon: Gift },
    { id: 'gam-integrity', label: 'Integridade', icon: ShieldAlert, keywords: ['sinais', 'cartas', 'moderação'] },
    { id: 'gam-metrics', label: 'Métricas', icon: BarChart3 },
  ] },
  // A voz da plataforma e dos parceiros falando com todos.
  { id: 'outreach', label: 'Divulgação', icon: Megaphone, tabs: [
    { id: 'promo', label: 'Cupons e campanhas', icon: Megaphone, keywords: ['divulgação', 'banner'] },
    { id: 'partners', label: 'Parceiros', icon: Handshake, keywords: ['afiliados', 'logos'] },
  ] },
  { id: 'features', label: 'Funcionalidades', icon: Flag, tabs: [
    { id: 'flags', label: 'Funcionalidades', icon: Flag, keywords: ['flags', 'ligar', 'desligar', 'opcionais'] },
  ] },
  { id: 'system', label: 'Sistema', icon: ListChecks, quieta: true, tabs: [
    { id: 'audit', label: 'Auditoria', icon: ListChecks },
    { id: 'dupr', label: 'Exportar DUPR', icon: FileDown },
    { id: 'tools', label: 'Diagnóstico', icon: Wrench, keywords: ['ferramentas', 'avançado', 'restaurar'] },
  ] },
]);

const ALL_TABS = SECTIONS.flatMap((s) => s.tabs);

export default function V2AdminConsole() {
  const { isPlatformAdmin } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const inbox = useAdminInbox(isPlatformAdmin);

  // Tab ativa vem de ?tab= (deep link). Default: overview. Validada contra
  // ALL_TABS; ids antigos (`profiles`, `branding`) seguem abrindo um lugar válido.
  const tab = resolveAdminTab(searchParams.get('tab'), ALL_TABS);
  const setTab = (id) => {
    const next = new URLSearchParams(searchParams);
    next.set('tab', id);
    setSearchParams(next, { replace: false });
  };

  if (!isPlatformAdmin) return <Navigate to="/" replace />;

  return (
    <div className="mx-auto max-w-[1200px]">
      <V2PageIntro
        title="Painel Admin"
        subtitle="Administre pessoas, torneios, arenas e o que a plataforma oferece."
        action={
          <Link
            to="/admin/owner-debug"
            className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-paper-pure px-4 py-2 text-xs font-semibold text-ink hover:border-ink"
          >
            <Stethoscope className="h-3.5 w-3.5" /> Diagnóstico profundo
            <ExternalLink className="h-3 w-3 opacity-50" />
          </Link>
        }
      />

      <div className="lg:grid lg:grid-cols-[240px_minmax(0,1fr)] lg:items-start lg:gap-6">
      <AdminConsoleNav sections={SECTIONS} tab={tab} onTab={setTab} badges={inbox.badges} />

      <div className="mt-6 min-w-0 lg:mt-0">
        {tab === 'overview'   && <OverviewTab inbox={inbox} onTab={setTab} />}
        {tab === 'tournaments' && <TournamentsTab />}
        {tab === 'partners'   && <PartnersTab />}
        {tab === 'arenas'     && <ArenasTab />}
        {tab === 'catalog'    && <AdminCatalogTab />}
        {tab === 'records'    && <RecordsTab />}
        {tab === 'flags'      && <FlagsTab />}
        {tab === 'access'     && <AdminAccessTab />}
        {tab === 'audit'      && <AuditTab />}
        {tab === 'tools'      && <ToolsTab navigate={navigate} />}
        {tab === 'dupr'       && <AdminDuprExportTab />}
        {tab === 'arena-modules' && <AdminArenaModulesTab />}
        {tab.startsWith('gam-') && (
          <Suspense fallback={<V2Skeleton className="h-40 rounded-3xl" />}>
            <AdminGamificationPanel tab={tab} />
          </Suspense>
        )}
        {tab.startsWith('treino-') && (
          <Suspense fallback={<V2Skeleton className="h-40 rounded-3xl" />}>
            <AdminTrainingPanel tab={tab} onTab={setTab} />
          </Suspense>
        )}
        {tab === 'promo' && (
          <Suspense fallback={<V2Skeleton className="h-40 rounded-3xl" />}>
            <PlatformPromoConsole />
          </Suspense>
        )}
      </div>
      </div>
    </div>
  );
}

/* ------------------------- Cadastros + Perfis --------------------------- */

/**
 * Cadastros (corrigir, excluir, unificar) e, embaixo, as ferramentas do
 * diretório que eram a aba Perfis — só montadas quando a pessoa pede, porque
 * elas leem a coleção de perfis inteira ao abrir.
 */
function RecordsTab() {
  const [perfis, setPerfis] = useState(false);
  return (
    <div className="space-y-6">
      <AdminUserRecordsTab />
      {perfis ? <ProfilesTab embedded /> : (
        <V2Surface variant="compacto" className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-base font-bold text-ink">Ferramentas do diretório de perfis</h2>
            <p className="text-sm text-gray-500">Restaurar perfil público, re-sincronizar o diretório, ocultar conta e migrar dados provisórios.</p>
          </div>
          <V2Button variant="secondary" size="sm" onClick={() => setPerfis(true)}>Abrir ferramentas</V2Button>
        </V2Surface>
      )}
    </div>
  );
}

/* ----------------------------- Tabs nav -------------------------------- */

/* ---------------------- 1. Visão geral ------------------------------ */

/** "Precisa de você": cada linha leva à aba que resolve. Fonte sem resposta não vira "nada pendente". */
function PrecisaDeVoce({ inbox, onTab }) {
  const { itens, total, incompleto } = inbox;
  const pendentes = itens.filter((i) => i.atencao);
  return (
    <V2Surface data-dica="admin-precisa-de-voce">
      <div className="flex items-center gap-2">
        <Activity className="h-5 w-5 text-ink" aria-hidden />
        <h2 className="font-display text-lg font-bold text-ink">Precisa de você</h2>
        {total > 0 && <V2Badge variant="warning">{total}</V2Badge>}
      </div>
      {pendentes.length === 0 ? (
        <p className="mt-2 flex items-center gap-2 text-sm text-gray-600">
          {incompleto
            ? 'Nada pendente nas filas que carregaram; algumas não deu para verificar agora.'
            : <><CheckCircle2 className="h-4 w-4 text-green-600" aria-hidden /> Tudo em dia: nenhuma fila esperando decisão.</>}
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-gray-100">
          {pendentes.map((i) => (
            <li key={i.id}>
              <button type="button" onClick={() => onTab(i.tab)} className="flex w-full items-center justify-between gap-3 py-2.5 text-left text-sm hover:text-ink coarse:min-h-11">
                <span className="font-semibold text-ink">{i.label}</span>
                <span className="shrink-0 text-xs text-gray-500">{i.detalhe} ›</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {pendentes.length > 0 && incompleto && <p className="mt-2 text-xs text-gray-500">Algumas filas não deu para verificar agora.</p>}
    </V2Surface>
  );
}

function OverviewTab({ inbox, onTab }) {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!firebaseServicesEnabled || !db) return undefined;
    let active = true;
    (async () => {
      try {
        const [u, t, m, r, ta, ra, ar] = await Promise.all([
          getCountFromServer(collection(db, 'users')),
          getCountFromServer(collection(db, 'tournaments')),
          getCountFromServer(collection(db, 'tournament_matches')),
          getCountFromServer(collection(db, 'tournament_registrations')),
          getCountFromServer(collection(db, 'tournament_admins')),
          getCountFromServer(collection(db, 'athlete_profiles')),
          getCountFromServer(collection(db, 'arenas')),
        ]);
        if (!active) return;
        setStats({
          users: u.data().count,
          tournaments: t.data().count,
          matches: m.data().count,
          registrations: r.data().count,
          tournament_admins: ta.data().count,
          athlete_profiles: ra.data().count,
          arenas: ar.data().count,
        });
      } catch (e) {
        if (active) setError(e.message);
      }
    })();
    return () => { active = false; };
  }, []);

  return (
    <div className="space-y-6">
      <PrecisaDeVoce inbox={inbox} onTab={onTab} />
      {!firebaseServicesEnabled ? (
        <V2Surface className="border-amber-200 bg-amber-50">
          <p className="text-sm text-amber-800">
            Ambiente sem Firebase configurado. As estatísticas não podem ser carregadas.
            {firebaseDisabledReason ? ` ${firebaseDisabledReason}` : ''}
          </p>
        </V2Surface>
      ) : (
        <>
          {error && (
            <V2Surface className="border-red-200 bg-red-50">
              <p className="text-sm text-red-700">{error}</p>
            </V2Surface>
          )}
          {!stats ? (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
              {[1, 2, 3, 4, 5, 6].map((i) => <V2Skeleton key={i} className="h-32 rounded-4xl" />)}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
              <V2StatCard icon={Users}     accent="ink"   label="Usuários"          value={stats.users} />
              <V2StatCard icon={Trophy}    accent="acid"  label="Torneios"          value={stats.tournaments} />
              <V2StatCard icon={ListChecks} accent="blue" label="Inscrições"        value={stats.registrations} />
              <V2StatCard icon={Trophy}    accent="green" label="Jogos"            value={stats.matches} />
              <V2StatCard icon={Users}     accent="ink"   label="Perfis de atleta" value={stats.athlete_profiles} />
              <V2StatCard icon={Building2} accent="acid"  label="Arenas"            value={stats.arenas} />
            </div>
          )}
        </>
      )}

      <div className="mt-6">
        <RankingAutomatico />
      </div>
    </div>
  );
}

/* ---------------------- 2. Torneios ------------------------------ */

function TournamentsTab() {
  const [tournaments, setTournaments] = useState(null);
  const [error, setError] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const { user } = useAuth();

  async function load() {
    try {
      setError(null);
      setTournaments(await listAllTournaments());
    } catch (err) {
      setError(err.message || 'Não foi possível carregar os torneios.');
    }
  }

  useEffect(() => { void load(); }, []);

  const items = tournaments || [];
  const archivedCount = useMemo(() => items.filter((t) => t.archived).length, [items]);
  const activeCount = items.length - archivedCount;

  async function handleArchive(t) {
    try {
      if (t.archived) {
        await setTournamentArchived(t.id, false, user);
        toast.success('Torneio desarquivado.');
      } else if (t.status === 'cancelled') {
        await setTournamentArchived(t.id, true, user);
        toast.success('Torneio arquivado.');
      } else {
        await cancelAndArchiveTournament(t.id, user);
        toast.success('Torneio cancelado e arquivado.');
      }
      void load();
    } catch (err) { toast.error(err.message); }
  }

  async function handleDelete(t) {
    setDeleting(true);
    try {
      await deleteTournamentCascading(t.id, user);
      toast.success('Torneio removido.');
      setDeleteTarget(null);
      void load();
    } catch (err) { toast.error(err.message); } finally { setDeleting(false); }
  }

  return (
    <V2Surface className="overflow-hidden p-0">
      <div className="border-b border-gray-100 p-6">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="font-display text-lg font-bold text-ink">Gestão de torneios</h2>
          <span className="ml-auto text-xs text-gray-500">{items.length} no total · {activeCount} ativos · {archivedCount} arquivados</span>
        </div>
      </div>

      {error && (
        <div className="m-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
      )}

      {!tournaments ? (
        <div className="p-6"><V2Skeleton className="h-64 rounded-2xl" /></div>
      ) : items.length === 0 ? (
        <div className="p-6">
          <V2EmptyState icon={Trophy} title="Nenhum torneio cadastrado" description="Assim que o primeiro torneio for criado, ele aparece aqui." />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-paper">
              <tr className="text-left text-gray-500">
                <th className="px-4 py-3 font-semibold">Nome</th>
                <th className="px-4 py-3 font-semibold">Cidade</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Owner</th>
                <th className="px-4 py-3 text-right font-semibold">Ações</th>
              </tr>
            </thead>
            <tbody>
              {items.map((t) => (
                <tr key={t.id} className="border-t border-gray-100">
                  <td className="px-4 py-3 font-semibold text-ink">
                    <div className="flex items-center gap-2">
                      <span className="truncate">{t.name}</span>
                      {t.archived && <V2Badge tone="neutral">📦 Arquivado</V2Badge>}
                      {t.status === 'cancelled' && !t.archived && <V2Badge tone="neutral">Cancelado</V2Badge>}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{t.city || '—'}</td>
                  <td className="px-4 py-3 text-gray-500">{TOURNAMENT_STATUS_LABELS[t.status] || t.status}</td>
                  <td className="px-4 py-3 text-gray-500">{t.creator_name || t.creator_uid}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        title={t.archived ? 'Desarquivar' : (t.status === 'cancelled' ? 'Arquivar' : 'Cancelar e arquivar')}
                        onClick={() => handleArchive(t)}
                        className="flex h-9 w-9 items-center justify-center rounded-full text-gray-500 hover:bg-paper hover:text-ink"
                      >
                        {t.archived ? <Archive className="h-4 w-4" /> : <Archive className="h-4 w-4 opacity-50" />}
                      </button>
                      <button
                        title="Excluir"
                        onClick={() => setDeleteTarget(t)}
                        className="flex h-9 w-9 items-center justify-center rounded-full text-red-500 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(v) => !v && !deleting && setDeleteTarget(null)}
        title={`Excluir torneio "${deleteTarget?.name}"?`}
        description="Esta ação remove DEFINITIVAMENTE o torneio e todos os dados associados (modalidades, inscrições, jogos e ranking). Não há como desfazer."
        confirmLabel="Excluir definitivamente"
        destructive
        loading={deleting}
        onConfirm={() => handleDelete(deleteTarget)}
      />
    </V2Surface>
  );
}

/* ---------------------- 3. Parceiros ------------------------------ */

const PARTNER_EMPTY = { title: '', url: '', description: '', category: 'other', image_url: '', active: true, sort_order: 0 };

function PartnersTab() {
  const { data: links = [], isLoading } = useAffiliateLinks();
  const create = useCreateAffiliateLink();
  const update = useUpdateAffiliateLink();
  const remove = useDeleteAffiliateLink();
  const [form, setForm] = useState(PARTNER_EMPTY);
  const [editingId, setEditingId] = useState(null);
  const [errors, setErrors] = useState({});

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const resetForm = () => { setEditingId(null); setForm(PARTNER_EMPTY); setErrors({}); };
  const startEdit = (link) => { setEditingId(link.id); setForm({ ...PARTNER_EMPTY, ...link }); setErrors({}); };

  async function handleSubmit(e) {
    e.preventDefault();
    const check = normalizeAffiliateInput(form);
    if (!check.valid) { setErrors(check.errors); return; }
    try {
      if (editingId) {
        await update.mutateAsync({ id: editingId, input: form });
        toast.success('Parceiro atualizado.');
      } else {
        await create.mutateAsync(form);
        toast.success('Parceiro cadastrado.');
      }
      resetForm();
    } catch (err) { toast.error(err?.message || 'Não foi possível salvar.'); }
  }

  async function toggleActive(link) {
    try {
      await update.mutateAsync({ id: link.id, input: { ...link, active: !link.active } });
    } catch (err) { toast.error(err?.message || 'Não foi possível atualizar.'); }
  }

  async function handleDelete(link) {
    try {
      await remove.mutateAsync(link.id);
      toast.success('Parceiro removido.');
      if (editingId === link.id) resetForm();
    } catch (err) { toast.error(err?.message || 'Não foi possível remover.'); }
  }

  const activeCount = links.filter((l) => l.active !== false).length;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        <V2StatCard icon={Handshake} accent="ink"   label="Total"   value={links.length} />
        <V2StatCard icon={CheckCircle2} accent="green" label="Ativos"  value={activeCount} />
        <V2StatCard icon={Archive}    accent="acid"  label="Inativos" value={links.length - activeCount} />
      </div>

      <V2Surface>
        <div className="flex items-center gap-2">
          <Plus className="h-5 w-5 text-ink" />
          <h2 className="font-display text-lg font-bold text-ink">{editingId ? 'Editar parceiro' : 'Novo parceiro / afiliado'}</h2>
        </div>
        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <V2Field label="Título" error={errors.title}>
              <V2Input value={form.title} onChange={(e) => set({ title: e.target.value })} maxLength={100} />
            </V2Field>
            <V2Field label="URL (com https://)" error={errors.url}>
              <V2Input value={form.url} onChange={(e) => set({ url: e.target.value })} placeholder="https://..." />
            </V2Field>
          </div>
          <V2Field label="Descrição" error={errors.description}>
            <V2Textarea value={form.description} onChange={(e) => set({ description: e.target.value })} maxLength={300} />
          </V2Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <V2Field label="Categoria">
              <V2Select
                className="h-11 px-3"
                value={form.category}
                onChange={(e) => set({ category: e.target.value })}
              >
                {Object.entries(AFFILIATE_CATEGORY_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </V2Select>
            </V2Field>
            <V2Field label="Ordem" hint="Menor aparece primeiro">
              <V2Input type="number" value={form.sort_order} onChange={(e) => set({ sort_order: Number(e.target.value) })} />
            </V2Field>
            <V2Field label="Ativo">
              <V2Toggle checked={form.active !== false} onChange={(v) => set({ active: v })} />
            </V2Field>
          </div>
          <V2Field label="Imagem (opcional)" error={errors.image_url}>
            <ImageUpload
              value={form.image_url}
              onChange={(url) => set({ image_url: url })}
              folder="partners"
              aspectRatio="16:9"
            />
          </V2Field>
          <div className="flex gap-2">
            <V2Button type="submit" disabled={create.isPending || update.isPending}>
              {editingId ? 'Salvar alterações' : 'Cadastrar parceiro'}
            </V2Button>
            {editingId && (
              <V2Button type="button" variant="ghost" onClick={resetForm}>Cancelar</V2Button>
            )}
          </div>
        </form>
      </V2Surface>

      <V2Surface className="overflow-hidden p-0">
        <div className="border-b border-gray-100 p-4">
          <h2 className="font-display text-lg font-bold text-ink">Lista</h2>
        </div>
        {isLoading ? (
          <div className="p-6"><V2Skeleton className="h-32 rounded-2xl" /></div>
        ) : links.length === 0 ? (
          <div className="p-6">
            <V2EmptyState icon={Handshake} title="Nenhum parceiro" description="Cadastre o primeiro usando o formulário acima." />
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {links.map((l) => {
              const url = safeAffiliateUrl(l.url);
              return (
              <li key={l.id} className="flex items-center gap-4 p-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-semibold text-ink">{l.title}</span>
                    {l.active === false && <V2Badge tone="neutral">Inativo</V2Badge>}
                    <V2Badge tone="neutral">{AFFILIATE_CATEGORY_LABELS[l.category] || l.category}</V2Badge>
                  </div>
                  {url ? (
                    <a href={url} target="_blank" rel="noopener noreferrer" className="mt-0.5 block truncate text-xs text-gray-500 hover:text-ink">
                      {url}
                    </a>
                  ) : (
                    <span className="mt-0.5 block text-xs font-semibold text-red-600">URL inválida — edite antes de publicar</span>
                  )}
                </div>
                <V2Toggle checked={l.active !== false} onChange={() => toggleActive(l)} />
                <button
                  type="button"
                  onClick={() => startEdit(l)}
                  className="flex h-9 w-9 items-center justify-center rounded-full text-gray-500 hover:bg-paper hover:text-ink"
                  title="Editar"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(l)}
                  className="flex h-9 w-9 items-center justify-center rounded-full text-red-500 hover:bg-red-50"
                  title="Excluir"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
              );
            })}
          </ul>
        )}
      </V2Surface>
    </div>
  );
}

/* ---------------------- 4. Flags (funcionalidades) ------------------------------ */

function FlagRow({ flagKey, checked, disabled, onToggle }) {
  const meta = FEATURE_FLAG_META[flagKey];
  const label = meta?.label || humanizeFlagKey(flagKey);
  return (
    <div className="flex items-start justify-between gap-4 rounded-2xl border border-gray-100 bg-paper p-4">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-ink">{label}</span>
          <code className="rounded bg-paper-pure px-1.5 py-0.5 font-mono text-2xs text-gray-500">{flagKey}</code>
        </div>
        {meta?.description && <p className="mt-0.5 text-xs text-gray-500">{meta.description}</p>}
      </div>
      <V2Toggle checked={checked} onChange={(v) => !disabled && onToggle(flagKey, v)} />
    </div>
  );
}

/** Cabeçalho de grupo com contagem e ações em massa (ligar/desligar todas). */
function FlagGroupHeader({ label, on, total, onBulk, busy, mudamAoLigar = [], mudamAoDesligar = [] }) {
  // Nenhuma ação em massa sem confirmação — e a confirmação diz o QUE muda.
  const [pedido, setPedido] = useState(null); // true = ligar, false = desligar
  const mudam = pedido ? mudamAoLigar : mudamAoDesligar;
  const verbo = pedido ? 'Ligar' : 'Desligar';
  const nomes = mudam.map((k) => FEATURE_FLAG_META[k]?.label || humanizeFlagKey(k)).join(', ');
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      <h3 className="font-display text-base font-bold text-ink">{label}</h3>
      <V2Badge tone="neutral">{on} / {total}</V2Badge>
      <div className="ml-auto flex items-center gap-1.5">
        <V2Button variant="ghost" size="sm" disabled={busy || mudamAoLigar.length === 0} onClick={() => setPedido(true)}>Ligar todas</V2Button>
        <V2Button variant="ghost" size="sm" disabled={busy || mudamAoDesligar.length === 0} onClick={() => setPedido(false)}>Desligar todas</V2Button>
      </div>
      <ConfirmDialog
        open={pedido !== null}
        onOpenChange={(v) => !v && setPedido(null)}
        title={`${verbo} ${mudam.length === 1 ? '1 funcionalidade' : `${mudam.length} funcionalidades`} de ${label}?`}
        description={`${pedido ? 'Vão ligar' : 'Vão desligar'}, para todo mundo: ${nomes}.`}
        confirmLabel={`${verbo} todas`}
        destructive={!pedido}
        onConfirm={() => { onBulk(pedido); setPedido(null); }}
      />
    </div>
  );
}

function FlagsTab() {
  const { user } = useAuth();
  const { flags, isLoading, refresh } = useFeatureFlags();
  const [pending, setPending] = useState(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [q, setQ] = useState('');

  async function toggle(flagKey, enabled) {
    setPending(flagKey);
    try {
      await setFeatureFlag(flagKey, enabled, user);
      toast.success(enabled ? 'Funcionalidade ativada.' : 'Funcionalidade desativada.');
    } catch (err) {
      toast.error(err?.message || 'Não foi possível alterar a funcionalidade.');
    } finally {
      setPending(null);
    }
  }

  async function bulkToggle(keys, enabled) {
    setBulkBusy(true);
    try {
      for (const key of keys) {
        try { await setFeatureFlag(key, enabled, user); } catch { /* segue as demais */ }
      }
      await refresh?.();
      toast.success(enabled ? 'Funcionalidades ativadas.' : 'Funcionalidades desativadas.');
    } finally {
      setBulkBusy(false);
    }
  }

  const buckets = useMemo(() => bucketAllFlags(), []);
  const term = q.trim().toLowerCase();
  const matches = (key) => !term
    || key.toLowerCase().includes(term)
    || (FEATURE_FLAG_META[key]?.label || humanizeFlagKey(key)).toLowerCase().includes(term);

  // TODOS os grupos, incluindo a Arena V3 — sem página/painel separado.
  const groupsToRender = [...FLAG_GROUPS, FLAG_GROUP_ARENA_V3, FLAG_GROUP_OTHER];
  const { total: totalFlags, active: activeFlags } = countFlags(flags);

  const renderRows = (keys) => (
    <div className="space-y-2">
      {keys.map((key) => (
        <FlagRow
          key={key}
          flagKey={key}
          checked={Boolean(flags?.[key])}
          disabled={isLoading || bulkBusy || pending === key}
          onToggle={toggle}
        />
      ))}
    </div>
  );

  return (
    <div className="space-y-4">
      <V2Surface>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Flag className="h-5 w-5 text-ink" />
            <div>
              <h2 className="font-display text-lg font-bold text-ink">Funcionalidades (flags)</h2>
              <p className="text-xs text-gray-500">{activeFlags} ativas de {totalFlags}. Em 10/10/2026 as 33 funcionalidades que estavam ligadas viraram permanentes e saíram daqui; ficam só as opcionais.</p>
            </div>
          </div>
          <input
            type="text" value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar flag…"
            className="h-10 w-56 rounded-2xl border border-gray-200 bg-paper-pure px-4 text-sm"
          />
        </div>
      </V2Surface>

      {groupsToRender.map((group) => {
        const keys = (buckets[group.id] || []).filter(matches);
        if (keys.length === 0) return null;
        const on = keys.filter((k) => flags?.[k]).length;
        const isArena = group.id === FLAG_GROUP_ARENA_V3.id;

        // Arena V3: subdivide por família (mesmo FlagRow oficial).
        const families = isArena
          ? [...new Set(keys.map((k) => arenaFlagFamily(k) || 'other'))]
            .sort((a, b) => (a === 'master' ? -1 : b === 'master' ? 1 : a.localeCompare(b)))
          : null;

        return (
          <V2Surface key={group.id}>
            <FlagGroupHeader
              label={group.label}
              on={on}
              total={keys.length}
              busy={bulkBusy}
              mudamAoLigar={flagsQueMudam(keys, flags, true)}
              mudamAoDesligar={flagsQueMudam(keys, flags, false)}
              onBulk={(v) => bulkToggle(flagsQueMudam(keys, flags, v), v)}
            />
            {isArena ? (
              <div className="space-y-4">
                {families.map((fam) => {
                  const famKeys = keys.filter((k) => (arenaFlagFamily(k) || 'other') === fam);
                  return (
                    <div key={fam}>
                      <p className="mb-2 text-2xs font-bold uppercase tracking-widest text-gray-500">
                        {ARENA_FAMILY_LABEL[fam] || fam}
                      </p>
                      {renderRows(famKeys)}
                    </div>
                  );
                })}
              </div>
            ) : renderRows(keys)}
          </V2Surface>
        );
      })}
    </div>
  );
}

/* ---------------------- 7. Auditoria ------------------------------ */

function AuditTab() {
  return (
    <div className="space-y-6">
      <V2Surface>
        <div className="flex items-center gap-2">
          <ListChecks className="h-5 w-5 text-ink" />
          <h2 className="font-display text-lg font-bold text-ink">Auditoria</h2>
        </div>
        <p className="mt-1 text-xs text-gray-500">
          Log de todas as ações sensíveis (criar/editar/arquivar/excluir torneio, mudar flag, etc).
          Mantido pela camada de services — automaticamente. Use os filtros para focar em um
          ator, ação ou torneio específico.
        </p>
      </V2Surface>

      <AuditLogTable />

    </div>
  );
}

/* ----------------------------- Tools tab -------------------------------- */

/** Sistema → Diagnóstico: as ferramentas de suporte do dono (não são o dia a dia). */
function ToolsTab({ navigate }) {
  const itens = [
    { icon: Stethoscope, titulo: 'Diagnóstico profundo', texto: 'Lê o Firestore bruto, sem cache: contagens, erros e documentos de qualquer usuário.', ir: () => navigate('/admin/owner-debug') },
    { icon: AlertTriangle, aviso: true, titulo: 'Restaurar meu admin', texto: 'Força o papel platform_admin na sua conta (emergência).', ir: () => navigate('/admin/owner-restore') },
  ];
  return (
    <V2Surface>
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-ink text-acid"><Wrench className="h-4.5 w-4.5" /></div>
        <div className="flex-1">
          <h2 className="font-display text-xl font-bold text-ink">Diagnóstico e suporte</h2>
          <p className="mt-1 text-sm leading-6 text-gray-500">Ferramentas para quando algo deu errado, como &quot;usuário sumiu&quot; ou &quot;perfil zerado&quot;. No dia a dia você não precisa delas.</p>
        </div>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {itens.map((i) => (
          <button key={i.titulo} type="button" onClick={i.ir} className="btn-press flex items-center gap-3 rounded-[1.25rem] border border-gray-100 bg-paper-pure p-4 text-left transition-colors hover:border-ink">
            <i.icon className={cn('h-4 w-4', i.aviso ? 'text-amber-500' : 'text-gray-500')} />
            <div className="flex-1"><div className="font-semibold text-ink">{i.titulo}</div><div className="text-xs text-gray-500">{i.texto}</div></div>
          </button>
        ))}
        <a href="https://console.firebase.google.com/project/pickletour/firestore/databases/-/data/panel/users" target="_blank" rel="noopener noreferrer" className="btn-press flex items-center gap-3 rounded-[1.25rem] border border-gray-100 bg-paper-pure p-4 text-left transition-colors hover:border-ink">
          <ExternalLink className="h-4 w-4 text-gray-500" />
          <div className="flex-1"><div className="font-semibold text-ink">Console do Firestore</div><div className="text-xs text-gray-500">Abre o banco no Firebase (use só para leitura).</div></div>
        </a>
      </div>
    </V2Surface>
  );
}

/* ---------------------- 5. Arenas (bônus Sprint 0) ------------------ */

/**
 * ArenasTab — lista todas as arenas com status de onboarding.
 *
 * Sprint 0 (bônus) do roadmap arena: dá ao admin uma visão de "quem criou
 * arena e nunca terminou o setup" (90% das arenas ficam órfãs na origem
 * do problema). Métricas expostas:
 * - total de arenas
 * - quantas completaram onboarding (4/4)
 * - quantas estão sem fotos / sem preço
 * - quantas inativas
 *
 * Sem ações destrutivas (não deleta arena daqui — isso fica no V2ArenaManage
 * do próprio dono). Apenas leitura + atalho para a página da arena.
 */
function ArenasTab() {
  const [arenas, setArenas] = useState(null);
  const [error, setError] = useState(null);

  async function load() {
    try {
      setError(null);
      setArenas(await listArenas());
    } catch (err) {
      setError(err.message || 'Não foi possível carregar as arenas.');
    }
  }

  useEffect(() => { void load(); }, []);

  const items = arenas || [];
  const stats = useMemo(() => {
    const out = { total: items.length, withPhotos: 0, withPrice: 0, onboardingDone: 0, inactive: 0 };
    for (const a of items) {
      if (a.active === false) out.inactive += 1;
      if (Array.isArray(a.photos) && a.photos.length > 0) out.withPhotos += 1;
      const hasBase = Number.isFinite(a.base_price) && a.base_price > 0;
      const hasRules = Array.isArray(a.price_rules) && a.price_rules.length > 0;
      if (hasBase || hasRules) out.withPrice += 1;
      const ob = a.onboarding_complete || {};
      if (ob.fotos && ob.precos && ob.horarios && ob.compartilhar) out.onboardingDone += 1;
    }
    return out;
  }, [items]);

  if (error) {
    return (
      <V2Surface className="p-6">
        <p className="text-sm text-red-600">{error}</p>
      </V2Surface>
    );
  }

  if (!arenas) {
    return (
      <V2Surface className="flex items-center gap-2 p-6 text-sm text-gray-500">
        <Loader2 className="h-4 w-4 animate-spin" /> Carregando arenas…
      </V2Surface>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="Total" value={stats.total} />
        <Stat label="Inativas" value={stats.inactive} variant={stats.inactive > 0 ? 'amber' : 'default'} />
        <Stat label="Com fotos" value={stats.withPhotos} variant="success" />
        <Stat label="Com preço" value={stats.withPrice} variant="success" />
        <Stat label="Onboarding 4/4" value={stats.onboardingDone} variant="info" />
      </div>

      <V2Surface className="p-0">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="border-b border-gray-100 bg-gray-50/50 text-left text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3">Nome</th>
                <th className="px-4 py-3">Cidade</th>
                <th className="px-4 py-3 text-center">Onboarding</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-500">
                    Nenhuma arena cadastrada ainda.
                  </td>
                </tr>
              )}
              {items.map((a) => {
                const ob = a.onboarding_complete || {};
                const steps = ['fotos', 'precos', 'horarios', 'compartilhar'];
                const doneCount = steps.filter((k) => ob[k]).length;
                return (
                  <tr key={a.id} className="hover:bg-gray-50/50">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-ink">{a.name}</div>
                      <div className="text-xs text-gray-500">
                        {Array.isArray(a.photos) ? `${a.photos.length} foto(s)` : 'sem fotos'}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {[a.city, a.state].filter(Boolean).join(' / ') || '—'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <OnboardingBadge doneCount={doneCount} />
                    </td>
                    <td className="px-4 py-3 text-center">
                      {a.active === false ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                          <X className="h-3 w-3" /> Inativa
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-xs text-green-700">
                          <Check className="h-3 w-3" /> Ativa
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        to={`/arenas/${a.id}`}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-ink hover:underline"
                      >
                        Ver <ExternalLink className="h-3 w-3" />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </V2Surface>
    </div>
  );
}

function Stat({ label, value, variant = 'default' }) {
  const colorMap = {
    default: 'text-ink',
    success: 'text-green-700',
    amber: 'text-amber-700',
    info: 'text-blue-700',
  };
  return (
    <V2Surface className="p-4">
      <div className="text-xs text-gray-500">{label}</div>
      <div className={cn('mt-1 font-display text-2xl font-bold', colorMap[variant])}>{value}</div>
    </V2Surface>
  );
}

function OnboardingBadge({ doneCount }) {
  const label = `${doneCount}/4`;
  if (doneCount === 4) {
    return <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-xs font-bold text-green-700"><Check className="h-3 w-3" /> {label}</span>;
  }
  if (doneCount === 0) {
    return <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-bold text-red-700"><X className="h-3 w-3" /> {label}</span>;
  }
  return <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-bold text-amber-700"> {label}</span>;
}
