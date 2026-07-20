/**
 * V2AdminConsole — Painel Admin centralizado (hub).
 *
 * Página única em /admin/painel que reúne tudo que um admin master precisa
 * para administrar a plataforma. Substitui a navegação entre as três rotas
 * independentes (Métricas / Torneios / Parceiros) por um hub com 7 abas.
 *
 * A página inteira vive atrás de uma feature flag (`ADMIN_CONSOLE`). Enquanto
 * a flag está desligada, o item do menu e a rota simplesmente não existem —
 * nada muda no comportamento atual. Ver `src/core/featureFlags.js`.
 *
 * Abas:
 *   1. Visão geral — escala, contagens, ações rápidas
 *   2. Torneios    — reusa o motor de V2AdminTournaments (sem Navigate duplo)
 *   3. Parceiros   — reusa o motor de V2AdminPartners
 *   4. Funcionalidades (flags) — todas as feature flags com toggle
 *   5. Branding    — nome/logo/cor primária persistidos em platform_settings
 *   6. Conteúdo    — textos da plataforma (read-only por enquanto)
 *   7. Auditoria   — audit log + atalho para /admin/owner-debug
 *
 * Cuidadoso: zero mudanças em regras Firestore, índices ou service code.
 * Tudo é puramente aditivo. As páginas V2AdminMetrics/Tournaments/Partners
 * seguem funcionando exatamente como antes — esta é uma alternativa, não
 * uma substituição.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  Archive,
  CheckCircle2,
  ExternalLink,
  FileText,
  Flag,
  Handshake,
  Image as ImageIcon,
  LayoutDashboard,
  ListChecks,
  Loader2,
  Medal,
  Palette,
  Pencil,
  Plus,
  Search,
  Settings as SettingsIcon,
  Stethoscope,
  Text as TextIcon,
  Trash2,
  Trophy,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  collection,
  doc,
  getCountFromServer,
  getDoc,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { ImageUpload } from '@/components/ui/image-upload';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { UserCog, Wrench, Settings } from 'lucide-react';
import ProfilesTab from './V2AdminProfiles.jsx';
import { AuditLogTable } from '@/components/AuditLogTable';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useFeatureFlags, useFeatureFlag } from '@/core/lib/FeatureFlagsContext';
import { FEATURE_FLAG, FEATURE_FLAG_META } from '@/core/featureFlags';
import {
  getPlatformSettings,
  setFeatureFlag,
  subscribePlatformSettings,
} from '@/core/services/platformSettingsService';
import { db, firebaseDisabledReason, firebaseServicesEnabled } from '@/core/config/firebase';
import { useRecomputeRatings } from '@/modules/rating/hooks/useRating';
import {
  cancelAndArchiveTournament,
  deleteTournamentCascading,
  listAllTournaments,
  setTournamentArchived,
} from '@/modules/admin/services/adminService';
import {
  useAffiliateLinks,
  useCreateAffiliateLink,
  useDeleteAffiliateLink,
  useUpdateAffiliateLink,
} from '@/modules/partners/hooks/useAffiliates';
import {
  AFFILIATE_CATEGORY_LABELS,
  normalizeAffiliateInput,
} from '@/modules/partners/domain/affiliate';
import { TOURNAMENT_STATUS_LABELS } from '@/modules/tournament/domain/constants';
import { cn } from '@/core/lib/utils';
import {
  V2Badge,
  V2Button,
  V2EmptyState,
  V2Field,
  V2Input,
  V2PageIntro,
  V2Skeleton,
  V2StatCard,
  V2Surface,
  V2Textarea,
  V2Toggle,
} from '@/v2/ui/primitives';

const TABS = Object.freeze([
  { id: 'overview',  label: 'Visão geral',      icon: LayoutDashboard },
  { id: 'tournaments', label: 'Torneios',         icon: Trophy },
  { id: 'partners',  label: 'Parceiros',        icon: Handshake },
  { id: 'profiles',  label: 'Perfis',           icon: UserCog },
  { id: 'flags',     label: 'Funcionalidades',  icon: Flag },
  { id: 'branding',  label: 'Branding',         icon: Palette },
  { id: 'content',   label: 'Conteúdo',         icon: TextIcon },
  { id: 'audit',     label: 'Auditoria',        icon: ListChecks },
  { id: 'tools',     label: 'Avançado',         icon: Wrench },
]);

const DEFAULT_BRANDING = Object.freeze({
  platform_name: 'PickleRush',
  tagline: 'A plataforma do pickleball brasileiro',
  logo_url: '',
  primary_color: '#0F1115',
  accent_color: '#C8FF3D',
});

const DEFAULT_CONTENT = Object.freeze({
  hero_eyebrow: 'Plataforma',
  hero_title: 'Encontre torneios, jogue, evolua.',
  hero_subtitle: 'Acompanhe seu ranking, dispute partidas e conecte-se com a comunidade do pickleball.',
  hero_cta_label: 'Criar torneio',
  empty_state_message: 'Ainda não há torneios por aqui. Que tal criar o primeiro?',
  footer_text: 'PickleRush — feito com amor para a comunidade do pickleball.',
  legal_link_label: 'Termos e privacidade',
});

export default function V2AdminConsole() {
  const { isPlatformAdmin } = useAuth();
  const enabled = useFeatureFlag(FEATURE_FLAG.ADMIN_CONSOLE);
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  // Tab ativa vem de ?tab= (deep link). Default: overview. Validada contra TABS.
  const tabFromUrl = searchParams.get('tab');
  const tab = TABS.some((t) => t.id === tabFromUrl) ? tabFromUrl : 'overview';
  const setTab = (id) => {
    const next = new URLSearchParams(searchParams);
    next.set('tab', id);
    setSearchParams(next, { replace: false });
  };

  if (!isPlatformAdmin) return <Navigate to="/" replace />;
  if (!enabled) return <Navigate to="/admin/metricas" replace />;

  return (
    <div className="mx-auto max-w-[1200px]">
      <V2PageIntro
        title="Painel Admin"
        subtitle="Hub completo para administrar a plataforma — escala, identidade, conteúdo e governança."
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

      <ConsoleTabs tab={tab} setTab={setTab} />

      <div className="mt-6">
        {tab === 'overview'   && <OverviewTab />}
        {tab === 'tournaments' && <TournamentsTab />}
        {tab === 'partners'   && <PartnersTab />}
        {tab === 'profiles'   && <ProfilesTab embedded />}
        {tab === 'flags'      && <FlagsTab />}
        {tab === 'branding'   && <BrandingTab />}
        {tab === 'content'    && <ContentTab />}
        {tab === 'audit'      && <AuditTab />}
        {tab === 'tools'      && <ToolsTab navigate={navigate} />}
      </div>
    </div>
  );
}

/* ----------------------------- Tabs nav -------------------------------- */

function ConsoleTabs({ tab, setTab }) {
  return (
    <div className="sticky top-2 z-20 -mx-4 mb-2 overflow-x-auto bg-paper-pure/80 px-4 py-2 backdrop-blur sm:top-3">
      <div className="inline-flex gap-1.5 rounded-full border border-gray-100 bg-paper-pure p-1.5 shadow-sm">
        {TABS.map(({ id, label, icon: Icon }) => {
          const active = tab === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={cn(
                'inline-flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold transition-colors',
                active ? 'bg-ink text-white shadow-sm' : 'text-gray-500 hover:text-ink',
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------------- 1. Visão geral ------------------------------ */

function OverviewTab() {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(null);
  const { flags } = useFeatureFlags();
  const { data: links = [] } = useAffiliateLinks();

  useEffect(() => {
    if (!firebaseServicesEnabled || !db) return undefined;
    let active = true;
    (async () => {
      try {
        const [u, t, m, r, ta, ra] = await Promise.all([
          getCountFromServer(collection(db, 'users')),
          getCountFromServer(collection(db, 'tournaments')),
          getCountFromServer(collection(db, 'tournament_matches')),
          getCountFromServer(collection(db, 'tournament_registrations')),
          getCountFromServer(collection(db, 'tournament_admins')),
          getCountFromServer(collection(db, 'athlete_profiles')),
        ]);
        if (!active) return;
        setStats({
          users: u.data().count,
          tournaments: t.data().count,
          matches: m.data().count,
          registrations: r.data().count,
          tournament_admins: ta.data().count,
          athlete_profiles: ra.data().count,
        });
      } catch (e) {
        if (active) setError(e.message);
      }
    })();
    return () => { active = false; };
  }, []);

  const flagsOn = useMemo(
    () => Object.entries(flags || {}).filter(([, v]) => v).length,
    [flags],
  );
  const flagsTotal = Object.keys(FEATURE_FLAG_META).length;
  const activePartners = links.filter((l) => l.active !== false).length;

  return (
    <div className="space-y-6">
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
              <V2StatCard icon={Flag}      accent="acid"  label="Flags ativas"      value={`${flagsOn} / ${flagsTotal}`} />
            </div>
          )}
        </>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <QuickActions />
        <GovernanceSummary activePartners={activePartners} flagsOn={flagsOn} flagsTotal={flagsTotal} />
      </div>
    </div>
  );
}

function QuickActions() {
  const ratingOn = useFeatureFlag(FEATURE_FLAG.PLAYER_RATING);
  const { mutateAsync, isPending } = useRecomputeRatings();
  const [last, setLast] = useState(null);

  async function handleRecompute() {
    try {
      const result = await mutateAsync();
      setLast(result);
      toast.success(`Ratings recalculados: ${result.players} atleta(s) a partir de ${result.matchesUsed} jogo(s).`);
    } catch (err) {
      toast.error(err?.message || 'Não foi possível recalcular os ratings.');
    }
  }

  return (
    <V2Surface>
      <div className="flex items-center gap-2">
        <Activity className="h-5 w-5 text-ink" />
        <h2 className="font-display text-lg font-bold text-ink">Ações rápidas</h2>
      </div>
      <p className="mt-1 text-xs text-gray-500">Operações que normalmente exigiriam várias telas, todas em um clique.</p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={handleRecompute}
          disabled={!ratingOn || isPending}
          className="flex items-start gap-3 rounded-2xl border border-gray-100 bg-paper p-4 text-left transition-colors hover:border-ink disabled:opacity-50"
        >
          <Medal className="mt-0.5 h-4 w-4 shrink-0 text-ink" />
          <div className="min-w-0">
            <div className="text-sm font-semibold text-ink">
              {isPending ? 'Recalculando…' : 'Recalcular ratings'}
            </div>
            <p className="mt-0.5 text-xs text-gray-500">
              Atualiza o rating de todos os atletas a partir dos jogos finalizados.
            </p>
          </div>
        </button>

        <Link
          to="/admin/owner-debug"
          className="flex items-start gap-3 rounded-2xl border border-gray-100 bg-paper p-4 transition-colors hover:border-ink"
        >
          <Stethoscope className="mt-0.5 h-4 w-4 shrink-0 text-ink" />
          <div className="min-w-0">
            <div className="text-sm font-semibold text-ink">Diagnóstico profundo</div>
            <p className="mt-0.5 text-xs text-gray-500">
              Lê o Firestore bruto e mostra contagens, erros e documentos de qualquer user.
            </p>
          </div>
        </Link>

        <Link
          to="/admin/owner-restore"
          className="flex items-start gap-3 rounded-2xl border border-gray-100 bg-paper p-4 transition-colors hover:border-ink"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <div className="min-w-0">
            <div className="text-sm font-semibold text-ink">Restaurar conta</div>
            <p className="mt-0.5 text-xs text-gray-500">
              Auto-restauração do perfil quando o usuário aparece zerado.
            </p>
          </div>
        </Link>

        <a
          href="https://console.firebase.google.com/project/pickletour/firestore/databases/-/data/panel/users"
          target="_blank"
          rel="noreferrer noopener"
          className="flex items-start gap-3 rounded-2xl border border-gray-100 bg-paper p-4 transition-colors hover:border-ink"
        >
          <ExternalLink className="mt-0.5 h-4 w-4 shrink-0 text-ink" />
          <div className="min-w-0">
            <div className="text-sm font-semibold text-ink">Abrir Firestore (console)</div>
            <p className="mt-0.5 text-xs text-gray-500">
              Acessa direto o banco no console do Firebase (read-only recomendado).
            </p>
          </div>
        </a>
      </div>

      {last && (
        <p className="mt-3 text-xs text-gray-500">
          Último recálculo: {last.players} atleta(s), {last.matchesUsed} de {last.matchesTotal} jogo(s).
        </p>
      )}
    </V2Surface>
  );
}

function GovernanceSummary({ activePartners, flagsOn, flagsTotal }) {
  return (
    <V2Surface>
      <div className="flex items-center gap-2">
        <SettingsIcon className="h-5 w-5 text-ink" />
        <h2 className="font-display text-lg font-bold text-ink">Governança</h2>
      </div>
      <p className="mt-1 text-xs text-gray-500">Estado atual das alavancas da plataforma.</p>

      <ul className="mt-4 divide-y divide-gray-100 text-sm">
        <li className="flex items-center justify-between py-2.5">
          <span className="text-gray-600">Funcionalidades (flags) ativas</span>
          <span className="font-semibold text-ink">{flagsOn} / {flagsTotal}</span>
        </li>
        <li className="flex items-center justify-between py-2.5">
          <span className="text-gray-600">Parceiros / afiliados ativos</span>
          <span className="font-semibold text-ink">{activePartners}</span>
        </li>
        <li className="flex items-center justify-between py-2.5">
          <span className="text-gray-600">Ambiente Firebase</span>
          <span className="font-semibold text-ink">
            {firebaseServicesEnabled ? 'Conectado' : 'Desconectado'}
          </span>
        </li>
      </ul>
    </V2Surface>
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
              <select
                className="h-11 w-full rounded-2xl border border-gray-200 bg-paper-pure px-3 text-sm"
                value={form.category}
                onChange={(e) => set({ category: e.target.value })}
              >
                {Object.entries(AFFILIATE_CATEGORY_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </V2Field>
            <V2Field label="Ordem" hint="Menor aparece primeiro">
              <V2Input type="number" value={form.sort_order} onChange={(e) => set({ sort_order: Number(e.target.value) })} />
            </V2Field>
            <V2Field label="Ativo">
              <V2Toggle checked={form.active !== false} onChange={(v) => set({ active: v })} />
            </V2Field>
          </div>
          <V2Field label="Imagem (opcional)">
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
            {links.map((l) => (
              <li key={l.id} className="flex items-center gap-4 p-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-semibold text-ink">{l.title}</span>
                    {l.active === false && <V2Badge tone="neutral">Inativo</V2Badge>}
                    <V2Badge tone="neutral">{AFFILIATE_CATEGORY_LABELS[l.category] || l.category}</V2Badge>
                  </div>
                  <a href={l.url} target="_blank" rel="noreferrer noopener" className="mt-0.5 block truncate text-xs text-gray-500 hover:text-ink">
                    {l.url}
                  </a>
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
            ))}
          </ul>
        )}
      </V2Surface>
    </div>
  );
}

/* ---------------------- 4. Flags (funcionalidades) ------------------------------ */

function FlagsTab() {
  const { user } = useAuth();
  const { flags, isLoading } = useFeatureFlags();
  const [pending, setPending] = useState(null);

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

  return (
    <V2Surface>
      <div className="flex items-center gap-2">
        <Flag className="h-5 w-5 text-ink" />
        <h2 className="font-display text-lg font-bold text-ink">Funcionalidades (flags)</h2>
      </div>
      <p className="mt-1 text-xs text-gray-500">
        Ative ou desative funcionalidades em tempo real. Cada flag nasce desligada e é puramente aditiva.
      </p>
      <div className="mt-4 space-y-2">
        {Object.entries(FEATURE_FLAG_META).map(([key, meta]) => (
          <div key={key} className="flex items-start justify-between gap-4 rounded-2xl border border-gray-100 bg-paper p-4">
            <div className="min-w-0">
              <div className="text-sm font-semibold text-ink">{meta.label}</div>
              <p className="mt-0.5 text-xs text-gray-500">{meta.description}</p>
            </div>
            <V2Toggle
              checked={Boolean(flags?.[key])}
              onChange={(v) => !isLoading && pending !== key && toggle(key, v)}
            />
          </div>
        ))}
      </div>
    </V2Surface>
  );
}

/* ---------------------- 5. Branding ------------------------------ */

function BrandingTab() {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(DEFAULT_BRANDING);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!firebaseServicesEnabled || !db) { setLoading(false); return undefined; }
    setLoading(true);
    const unsub = subscribePlatformSettings((s) => {
      const b = s?.branding || {};
      setSettings(s);
      setForm({ ...DEFAULT_BRANDING, ...b });
      setDirty(false);
      setLoading(false);
    });
    return unsub;
  }, []);

  const set = (patch) => { setForm((f) => ({ ...f, ...patch })); setDirty(true); };

  async function save() {
    if (!db) return;
    setSaving(true);
    try {
      const ref = doc(db, 'platform_settings', 'global');
      await setDoc(ref, { branding: form, updated_at: serverTimestamp() }, { merge: true });
      toast.success('Branding salvo.');
      setDirty(false);
    } catch (err) {
      toast.error(err?.message || 'Não foi possível salvar.');
    } finally {
      setSaving(false);
    }
  }

  async function reset() {
    setForm(DEFAULT_BRANDING);
    setDirty(true);
  }

  if (loading) return <V2Skeleton className="h-64 rounded-4xl" />;

  return (
    <V2Surface>
      <div className="flex items-center gap-2">
        <Palette className="h-5 w-5 text-ink" />
        <h2 className="font-display text-lg font-bold text-ink">Identidade visual</h2>
      </div>
      <p className="mt-1 text-xs text-gray-500">
        Nome, slogan, logo e cores principais da plataforma. Os valores ficam em <code>platform_settings/global</code>
        e podem ser lidos pelos componentes que quiserem respeitar a identidade customizada.
      </p>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
        <form
          onSubmit={(e) => { e.preventDefault(); save(); }}
          className="space-y-4"
        >
          <V2Field label="Nome da plataforma">
            <V2Input value={form.platform_name} onChange={(e) => set({ platform_name: e.target.value })} />
          </V2Field>
          <V2Field label="Slogan / tagline">
            <V2Input value={form.tagline} onChange={(e) => set({ tagline: e.target.value })} maxLength={120} />
          </V2Field>
          <V2Field label="URL do logo" hint="PNG/SVG com fundo transparente. Recomendado: 256x256.">
            <V2Input value={form.logo_url} onChange={(e) => set({ logo_url: e.target.value })} placeholder="https://..." />
          </V2Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <V2Field label="Cor primária" hint="Hex (#RRGGBB) — usada em textos, botões e headers.">
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={form.primary_color}
                  onChange={(e) => set({ primary_color: e.target.value })}
                  className="h-11 w-12 cursor-pointer rounded-2xl border border-gray-200 bg-paper-pure p-1"
                />
                <V2Input value={form.primary_color} onChange={(e) => set({ primary_color: e.target.value })} className="flex-1" />
              </div>
            </V2Field>
            <V2Field label="Cor de destaque" hint="Hex (#RRGGBB) — usada em CTAs e elementos de ação.">
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={form.accent_color}
                  onChange={(e) => set({ accent_color: e.target.value })}
                  className="h-11 w-12 cursor-pointer rounded-2xl border border-gray-200 bg-paper-pure p-1"
                />
                <V2Input value={form.accent_color} onChange={(e) => set({ accent_color: e.target.value })} className="flex-1" />
              </div>
            </V2Field>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <V2Button type="submit" disabled={!dirty || saving}>
              {saving ? 'Salvando…' : 'Salvar branding'}
            </V2Button>
            <V2Button type="button" variant="ghost" onClick={reset} disabled={!dirty || saving}>
              Restaurar padrão
            </V2Button>
            {dirty && <span className="text-xs text-amber-600">Alterações não salvas</span>}
          </div>
        </form>

        <div className="rounded-2xl border border-gray-100 bg-paper p-4">
          <h3 className="text-sm font-semibold text-ink">Pré-visualização</h3>
          <div className="mt-4 space-y-3">
            <div className="flex items-center gap-3 rounded-xl bg-white p-3 shadow-sm" style={{ borderTop: `4px solid ${form.accent_color}` }}>
              {form.logo_url ? (
                <img src={form.logo_url} alt="logo" className="h-8 w-8 rounded-lg object-contain" />
              ) : (
                <div className="flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold text-white" style={{ background: form.primary_color }}>
                  {(form.platform_name || 'PR').slice(0, 2).toUpperCase()}
                </div>
              )}
              <div>
                <div className="text-sm font-bold" style={{ color: form.primary_color }}>{form.platform_name || 'Plataforma'}</div>
                <div className="text-[10px] text-gray-500">{form.tagline || '—'}</div>
              </div>
            </div>
            <button
              type="button"
              className="w-full rounded-full px-4 py-2 text-xs font-bold"
              style={{ background: form.accent_color, color: form.primary_color }}
            >
              Botão de destaque
            </button>
            <button
              type="button"
              className="w-full rounded-full px-4 py-2 text-xs font-bold text-white"
              style={{ background: form.primary_color }}
            >
              Botão primário
            </button>
            <p className="text-[10px] text-gray-500">
              Pré-visualização aproximada. A aplicação das cores nos componentes existentes
              é progressiva — só os novos componentes lidos de platform_settings respeitam
              o branding customizado por enquanto.
            </p>
          </div>
        </div>
      </div>
    </V2Surface>
  );
}

/* ---------------------- 6. Conteúdo ------------------------------ */

function ContentTab() {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(DEFAULT_CONTENT);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!firebaseServicesEnabled || !db) { setLoading(false); return undefined; }
    setLoading(true);
    const unsub = subscribePlatformSettings((s) => {
      const c = s?.content || {};
      setSettings(s);
      setForm({ ...DEFAULT_CONTENT, ...c });
      setDirty(false);
      setLoading(false);
    });
    return unsub;
  }, []);

  const set = (patch) => { setForm((f) => ({ ...f, ...patch })); setDirty(true); };

  async function save() {
    if (!db) return;
    setSaving(true);
    try {
      const ref = doc(db, 'platform_settings', 'global');
      await setDoc(ref, { content: form, updated_at: serverTimestamp() }, { merge: true });
      toast.success('Conteúdo salvo.');
      setDirty(false);
    } catch (err) {
      toast.error(err?.message || 'Não foi possível salvar.');
    } finally {
      setSaving(false);
    }
  }

  async function reset() {
    setForm(DEFAULT_CONTENT);
    setDirty(true);
  }

  if (loading) return <V2Skeleton className="h-64 rounded-4xl" />;

  return (
    <V2Surface>
      <div className="flex items-center gap-2">
        <TextIcon className="h-5 w-5 text-ink" />
        <h2 className="font-display text-lg font-bold text-ink">Textos da plataforma</h2>
      </div>
      <p className="mt-1 text-xs text-gray-500">
        Hero, CTAs, mensagens e textos institucionais. Os valores ficam em <code>platform_settings/global</code>
        — esta tela é <strong>read-write</strong> (você pode editar), mas os componentes atuais ainda
        usam os valores hardcoded. Migração dos componentes para ler do Firestore é um próximo passo.
      </p>

      <form onSubmit={(e) => { e.preventDefault(); save(); }} className="mt-6 space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <V2Field label="Hero — eyebrow" hint="Pequeno texto acima do título">
            <V2Input value={form.hero_eyebrow} onChange={(e) => set({ hero_eyebrow: e.target.value })} />
          </V2Field>
          <V2Field label="Botão principal do hero">
            <V2Input value={form.hero_cta_label} onChange={(e) => set({ hero_cta_label: e.target.value })} />
          </V2Field>
        </div>
        <V2Field label="Hero — título">
          <V2Input value={form.hero_title} onChange={(e) => set({ hero_title: e.target.value })} maxLength={120} />
        </V2Field>
        <V2Field label="Hero — subtítulo">
          <V2Textarea value={form.hero_subtitle} onChange={(e) => set({ hero_subtitle: e.target.value })} maxLength={300} />
        </V2Field>
        <V2Field label="Empty state — mensagem padrão">
          <V2Textarea value={form.empty_state_message} onChange={(e) => set({ empty_state_message: e.target.value })} maxLength={300} />
        </V2Field>
        <div className="grid gap-4 md:grid-cols-2">
          <V2Field label="Rodapé — texto">
            <V2Input value={form.footer_text} onChange={(e) => set({ footer_text: e.target.value })} maxLength={200} />
          </V2Field>
          <V2Field label="Rodapé — link legal">
            <V2Input value={form.legal_link_label} onChange={(e) => set({ legal_link_label: e.target.value })} maxLength={60} />
          </V2Field>
        </div>

        <div className="flex items-center gap-2 pt-2">
          <V2Button type="submit" disabled={!dirty || saving}>
            {saving ? 'Salvando…' : 'Salvar conteúdo'}
          </V2Button>
          <V2Button type="button" variant="ghost" onClick={reset} disabled={!dirty || saving}>
            Restaurar padrão
          </V2Button>
          {dirty && <span className="text-xs text-amber-600">Alterações não salvas</span>}
        </div>
      </form>
    </V2Surface>
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

      <V2Surface>
        <div className="flex items-center gap-2">
          <Stethoscope className="h-5 w-5 text-ink" />
          <h2 className="font-display text-lg font-bold text-ink">Diagnóstico</h2>
        </div>
        <p className="mt-1 text-xs text-gray-500">
          Para "user sumiu", "perfil zerado" ou "useMyTournaments retorna vazio". Lê o Firestore
          bruto (sem hooks/cache) e mostra contagens + erros por seção.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link to="/admin/owner-debug" className="inline-flex items-center gap-1.5 rounded-full bg-ink px-4 py-2 text-xs font-bold text-white">
            <Stethoscope className="h-3.5 w-3.5" /> Abrir /admin/owner-debug
          </Link>
          <Link to="/admin/owner-restore" className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-paper-pure px-4 py-2 text-xs font-bold text-ink">
            <AlertTriangle className="h-3.5 w-3.5" /> Abrir /admin/owner-restore
          </Link>
        </div>
      </V2Surface>
    </div>
  );
}

/* ----------------------------- Tools tab -------------------------------- */

function ToolsTab({ navigate }) {
  return (
    <div className="space-y-4">
      <V2Surface>
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-ink text-acid">
            <Wrench className="h-4.5 w-4.5" />
          </div>
          <div className="flex-1">
            <h2 className="font-display text-xl font-bold text-ink">Ferramentas avançadas</h2>
            <p className="mt-1 text-sm leading-6 text-gray-500">
              Páginas de admin legadas (Métricas / Torneios / Parceiros) e ferramentas de diagnóstico
              do owner. Mantidas por compatibilidade — a partir de agora, a entrada principal é
              este Painel.
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <button
            type="button"
            onClick={() => navigate('/admin/metricas')}
            className="btn-press flex items-center gap-3 rounded-[1.25rem] border border-gray-100 bg-paper-pure p-4 text-left transition-colors hover:border-ink"
          >
            <Settings className="h-4 w-4 text-gray-400" />
            <div className="flex-1">
              <div className="font-semibold text-ink">Métricas (legado)</div>
              <div className="text-xs text-gray-500">Dashboard de métricas em página cheia</div>
            </div>
            <ExternalLink className="h-3.5 w-3.5 opacity-40" />
          </button>
          <button
            type="button"
            onClick={() => navigate('/admin/torneios')}
            className="btn-press flex items-center gap-3 rounded-[1.25rem] border border-gray-100 bg-paper-pure p-4 text-left transition-colors hover:border-ink"
          >
            <Trophy className="h-4 w-4 text-gray-400" />
            <div className="flex-1">
              <div className="font-semibold text-ink">Torneios (legado)</div>
              <div className="text-xs text-gray-500">Lista cheia de todos os torneios</div>
            </div>
            <ExternalLink className="h-3.5 w-3.5 opacity-40" />
          </button>
          <button
            type="button"
            onClick={() => navigate('/admin/parceiros')}
            className="btn-press flex items-center gap-3 rounded-[1.25rem] border border-gray-100 bg-paper-pure p-4 text-left transition-colors hover:border-ink"
          >
            <Handshake className="h-4 w-4 text-gray-400" />
            <div className="flex-1">
              <div className="font-semibold text-ink">Parceiros (legado)</div>
              <div className="text-xs text-gray-500">Lista cheia de todos os parceiros</div>
            </div>
            <ExternalLink className="h-3.5 w-3.5 opacity-40" />
          </button>
          <button
            type="button"
            onClick={() => navigate('/admin/owner-debug')}
            className="btn-press flex items-center gap-3 rounded-[1.25rem] border border-gray-100 bg-paper-pure p-4 text-left transition-colors hover:border-ink"
          >
            <Stethoscope className="h-4 w-4 text-gray-400" />
            <div className="flex-1">
              <div className="font-semibold text-ink">Diagnóstico profundo</div>
              <div className="text-xs text-gray-500">Lê Firestore bruto (sem cache)</div>
            </div>
            <ExternalLink className="h-3.5 w-3.5 opacity-40" />
          </button>
          <button
            type="button"
            onClick={() => navigate('/admin/owner-restore')}
            className="btn-press flex items-center gap-3 rounded-[1.25rem] border border-gray-100 bg-paper-pure p-4 text-left transition-colors hover:border-ink"
          >
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <div className="flex-1">
              <div className="font-semibold text-ink">Restaurar meu admin</div>
              <div className="text-xs text-gray-500">Force role platform_admin (emergência)</div>
            </div>
            <ExternalLink className="h-3.5 w-3.5 opacity-40" />
          </button>
        </div>
      </V2Surface>
    </div>
  );
}
