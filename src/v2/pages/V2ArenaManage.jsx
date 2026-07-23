import React, { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useLocation, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { collection, getDocs, query, where } from 'firebase/firestore';
import {
  ArrowLeft, Building2, Settings, Trash2, UserPlus, Users,
  BarChart3, CalendarClock, CalendarDays, CalendarRange, Wallet, ClipboardList,
  Package, LayoutGrid, DollarSign, Image, Info, Star,
} from 'lucide-react';
import V2CourtsTab from '@/v2/components/arenas/V2CourtsTab';
import V2ArenaCalendar from '@/v2/components/arenas/V2ArenaCalendar';
import V2ArenaMetrics from '@/v2/components/arenas/V2ArenaMetrics';
import V2AdminBookingCalendar from '@/v2/components/arenas/V2AdminBookingCalendar';
import V2ArenaPaymentTab from '@/v2/components/arenas/V2ArenaPaymentTab';
import V2ArenaRulesTab from '@/v2/components/arenas/V2ArenaRulesTab';
import V2ArenaMercadoTab from '@/v2/components/arenas/V2ArenaMercadoTab';
import FeatureFlagGuard from '@/v2/components/FeatureFlagGuard';
import { db } from '@/core/config/firebase';
import { FEATURE_FLAG } from '@/core/featureFlags';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { ImageUpload } from '@/components/ui/image-upload';
import { PhotoLightbox } from '@/components/ui/photo-lightbox';
import ConfirmDialog from '@/components/ConfirmDialog';
import { V2ProfileFields, V2PricingEditor } from '@/v2/components/arenas/V2ArenaEditors';
import V2ArenaReviews from '@/v2/components/arenas/V2ArenaReviews';
import V2BookingRow from '@/v2/components/arenas/V2BookingRow';
import { sortBookings } from '@/modules/arenas/domain/booking';
import { ARENA_MANAGER_ROLE, BOOKING_STATUS } from '@/modules/arenas/domain/constants';
import {
  useArena, useMyManagedArenas, useUpdateArena, useSetArenaPhotos, useDeleteArena,
  useArenaManagers, useAddManager, useRemoveManager,
} from '@/modules/arenas/hooks/useArenas';
import { useArenaBookings } from '@/modules/arenas/hooks/useBookings';
import { V2Badge, V2Button, V2Field, V2Input, V2Skeleton, V2Surface } from '@/v2/ui/primitives';
import { cn } from '@/core/lib/utils';

export default function V2ArenaManage() {
  const { arenaId } = useParams();
  const { user, isPlatformAdmin } = useAuth();
  const { data: arena, isLoading } = useArena(arenaId);
  const { data: managed = [] } = useMyManagedArenas();
  const deleteArena = useDeleteArena();
  const location = useLocation();
  const [tab, setTab] = useState('reservas');

  return (
    <FeatureFlagGuard
      flag={FEATURE_FLAG.ARENAS}
      label="Arenas"
      description="O painel de gestão de arenas fica disponível quando a flag Arenas está ligada."
    >
      <V2ArenaManageContent
        arenaId={arenaId}
        user={user}
        isPlatformAdmin={isPlatformAdmin}
        arena={arena}
        managed={managed}
        isLoading={isLoading}
        deleteArena={deleteArena}
        location={location}
        tab={tab}
        setTab={setTab}
      />
    </FeatureFlagGuard>
  );
}

function V2ArenaManageContent({ arenaId, user, isPlatformAdmin, arena, managed, isLoading, deleteArena, location, tab, setTab }) {

  // Âncora para o stepper de onboarding: ao montar, lê o hash
  // (#fotos / #precos / #horarios), troca a aba e rola até a seção.
  // Cada panel abaixo tem um `id` correspondente; #horarios aponta para
  // a aba 'info' (onde fica o campo de horário de funcionamento).
  useEffect(() => {
    const hash = location.hash?.replace('#', '').toLowerCase();
    if (!hash) return;
    const target = hash === 'horarios' ? 'info' : hash;
    const valid = ['reservas', 'precos', 'fotos', 'info', 'admins', 'retornos'].includes(target);
    if (!valid) return;
    setTab(target);
    // Espera o próximo frame pra garantir que o panel está montado
    requestAnimationFrame(() => {
      const el = document.getElementById(`arena-manage-${hash}`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, [location.hash]);

  if (isLoading) return <div className="mx-auto max-w-[1000px] space-y-4"><V2Skeleton className="h-40 rounded-4xl" /><V2Skeleton className="h-64 rounded-4xl" /></div>;
  if (!arena) {
    return (
      <div className="mx-auto max-w-[700px]">
        <V2Surface className="text-center">
          <Building2 className="mx-auto h-10 w-10 text-gray-300" />
          <h2 className="mt-3 font-display text-lg font-bold text-ink">Arena não encontrada</h2>
          <Link to="/arenas" className="mt-2 inline-block text-sm font-bold text-ink underline">Voltar ao diretório</Link>
        </V2Surface>
      </div>
    );
  }

  const canManage = arena.owner_id === user?.uid || managed.some((m) => m.id === arena.id) || isPlatformAdmin;
  if (!canManage) return <Navigate to={`/arenas/${arena.id}`} replace />;
  const isOwner = arena.owner_id === user?.uid || isPlatformAdmin;

  // Abas agrupadas por finalidade, com rótulo de grupo visível e ícone por
  // aba (mesmo padrão visual: pill rounded-full). Grupo 1 = operação do
  // dia-a-dia; grupo 2 = configuração da arena.
  const tabGroups = [
    {
      title: 'Operação',
      items: [
        { value: 'metricas', label: 'Métricas', icon: BarChart3 },
        { value: 'reservas', label: 'Reservas', icon: CalendarClock },
        { value: 'calendario', label: 'Calendário', icon: CalendarDays },
        { value: 'calendario-admin', label: 'Reservas (Admin)', icon: CalendarRange },
        { value: 'pagamento', label: 'Pagamento', icon: Wallet },
        { value: 'regras', label: 'Regras', icon: ClipboardList },
        { value: 'mercado', label: 'Mercado', icon: Package },
      ],
    },
    {
      title: 'Configuração da arena',
      items: [
        { value: 'quadras', label: 'Quadras', icon: LayoutGrid },
        { value: 'precos', label: 'Preços', icon: DollarSign },
        { value: 'fotos', label: 'Fotos', icon: Image },
        { value: 'info', label: 'Informações', icon: Info },
        { value: 'admins', label: 'Admins', icon: Users },
        { value: 'retornos', label: 'Retornos', icon: Star },
      ],
    },
  ];

  return (
    <div className="mx-auto max-w-[1000px]">
      <div className="mb-5 flex items-center justify-between gap-2">
        <Link to={`/arenas/${arena.id}`} className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-500 hover:text-ink">
          <ArrowLeft className="h-4 w-4" /> {arena.name}
        </Link>
        {isOwner && (
          <ConfirmDialog
            title="Excluir arena?"
            description="A arena, suas reservas e avaliações serão removidas permanentemente."
            confirmLabel="Excluir"
            onConfirm={async () => {
              try { await deleteArena.mutateAsync(arena.id); toast.success('Arena excluída.'); window.location.assign('/arenas'); }
              catch (err) { toast.error(err?.message || 'Não foi possível excluir.'); }
            }}
            trigger={<V2Button variant="danger" size="sm"><Trash2 className="h-4 w-4" /> Excluir</V2Button>}
          />
        )}
      </div>

      <div className="relative overflow-hidden rounded-4xl bg-mesh p-8 shadow-organic">
        <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-acid">Central da arena</span>
        <h1 className="mt-4 font-display text-3xl font-bold text-white sm:text-4xl">{arena.name}</h1>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-gray-300">Gerencie reservas, preços, fotos, admins e informações públicas no mesmo fluxo operacional.</p>
        <div className="mt-5 flex flex-wrap gap-2">
          <V2Button asChild variant="secondary" size="sm">
            <Link to={`/arenas/${arena.id}/gerir/modulos`}><Settings className="h-4 w-4" /> Módulos V3</Link>
          </V2Button>
          <V2Button asChild variant="secondary" size="sm">
            <Link to={`/arenas/${arena.id}/gerir/open-match`}>Open Match</Link>
          </V2Button>
          <V2Button asChild variant="secondary" size="sm">
            <Link to={`/arenas/${arena.id}/gerir/membros`}>Membros</Link>
          </V2Button>
        </div>
      </div>

      <div className="mt-6 space-y-3">
        {tabGroups.map((group) => (
          <div key={group.title}>
            <p className="mb-1.5 px-1 text-[11px] font-bold uppercase tracking-widest text-gray-400">{group.title}</p>
            <div className="overflow-x-auto">
              <div className="inline-flex gap-1.5 rounded-full border border-gray-100 bg-paper-pure p-1.5 shadow-sm">
                {group.items.map((t) => {
                  const Icon = t.icon;
                  const active = tab === t.value;
                  return (
                    <button key={t.value} onClick={() => setTab(t.value)}
                      aria-current={active ? 'page' : undefined}
                      className={cn('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition-colors', active ? 'bg-ink text-white shadow-md' : 'text-gray-500 hover:text-ink')}>
                      {Icon && <Icon className={cn('h-4 w-4', active ? 'text-acid' : 'text-gray-400')} />}
                      {t.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6">
        {tab === 'metricas' && <V2ArenaMetrics arena={arena} />}
        {tab === 'reservas' && <BookingsTab arena={arena} />}
        {tab === 'calendario' && <V2ArenaCalendar arena={arena} />}
        {tab === 'calendario-admin' && <V2AdminBookingCalendar arenaId={arena.id} />}
        {tab === 'pagamento' && <V2ArenaPaymentTab />}
        {tab === 'regras' && <V2ArenaRulesTab />}
        {tab === 'mercado' && <V2ArenaMercadoTab />}
        {tab === 'quadras' && <V2CourtsTab arena={arena} />}
        {tab === 'precos' && <V2Surface id="arena-manage-precos"><V2PricingEditor arena={arena} /></V2Surface>}
        {tab === 'fotos' && <div id="arena-manage-fotos"><PhotosTab arena={arena} /></div>}
        {tab === 'info' && <InfoTab arena={arena} />}
        {tab === 'admins' && <ManagersTab arena={arena} />}
        {tab === 'retornos' && <V2ArenaReviews arena={arena} canModerate />}
      </div>
    </div>
  );
}

function InfoTab({ arena }) {
  const update = useUpdateArena();
  const [form, setForm] = useState({
    name: arena.name || '', description: arena.description || '', address: arena.address || '',
    neighborhood: arena.neighborhood || '', city: arena.city || '', state: arena.state || '',
    contact_phone: arena.contact_phone || '', contact_whatsapp: arena.contact_whatsapp || '',
    contact_email: arena.contact_email || '', instagram: arena.instagram || '', website: arena.website || '',
    court_count: arena.court_count ?? '', hours: arena.hours || '',
    house_rules_md: arena.house_rules_md || '',
  });
  const setField = (key) => (e) => setForm((p) => ({ ...p, [key]: e.target.value }));

  async function save() {
    try { await update.mutateAsync({ id: arena.id, updates: form }); toast.success('Informações atualizadas.'); }
    catch (err) { toast.error(err?.message || 'Não foi possível salvar.'); }
  }

  return (
    <V2Surface id="arena-manage-horarios" className="space-y-4 p-5 sm:p-6">
      <V2ProfileFields form={form} setField={setField} />
      <div className="flex justify-end pt-2">
        <V2Button onClick={save} disabled={update.isPending}>{update.isPending ? 'Salvando…' : 'Salvar informações'}</V2Button>
      </div>
    </V2Surface>
  );
}

function PhotosTab({ arena }) {
  const setPhotos = useSetArenaPhotos();
  const photos = arena.photos || [];

  async function addPhoto(url, meta) {
    if (!url) return;
    const next = [...photos, { url, path: meta?.path || '', name: meta?.name || 'foto' }];
    try { await setPhotos.mutateAsync({ id: arena.id, photos: next }); toast.success('Foto adicionada.'); }
    catch (err) { toast.error(err?.message || 'Falha ao adicionar a foto.'); }
  }
  async function removePhoto(idx) {
    const next = photos.filter((_, i) => i !== idx);
    try { await setPhotos.mutateAsync({ id: arena.id, photos: next }); }
    catch (err) { toast.error(err?.message || 'Falha ao remover a foto.'); }
  }

  return (
    <V2Surface className="space-y-4 p-5 sm:p-6">
      <div>
        <p className="text-sm font-bold text-ink">Fotos da arena</p>
        <p className="mt-1 text-xs text-gray-500">A primeira foto é usada como capa. Até 20 fotos.</p>
      </div>
      {photos.length > 0 && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {photos.map((p, i) => (
            <div key={p.path || i} className="group relative">
              <PhotoLightbox src={p.url} alt={`Foto ${i + 1} da arena`}
                trigger={<img src={p.url} alt="" className="h-28 w-full cursor-zoom-in rounded-2xl object-cover" />} />
              {i === 0 && <span className="absolute left-1 top-1 rounded bg-acid px-1.5 py-0.5 text-[10px] font-bold text-ink">Capa</span>}
              <button type="button" onClick={() => removePhoto(i)} className="absolute right-1 top-1 rounded-full bg-white/90 p-1 text-red-600 opacity-0 transition-opacity group-hover:opacity-100" aria-label="Remover foto">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
      {photos.length < 20 && <ImageUpload value="" onChange={addPhoto} folder="arenas" label="Adicionar foto" hint="JPG/PNG da arena, quadras, estrutura." />}
    </V2Surface>
  );
}

function BookingsTab({ arena }) {
  const { data: bookings = [], isLoading } = useArenaBookings(arena.id);
  const grouped = useMemo(() => {
    const active = sortBookings(bookings.filter((b) => [BOOKING_STATUS.REQUESTED, BOOKING_STATUS.NEGOTIATING, BOOKING_STATUS.CONFIRMED].includes(b.status)));
    const past = sortBookings(bookings.filter((b) => [BOOKING_STATUS.DECLINED, BOOKING_STATUS.CANCELLED, BOOKING_STATUS.COMPLETED].includes(b.status)));
    return { active, past };
  }, [bookings]);

  if (isLoading) return <V2Skeleton className="h-40 rounded-4xl" />;
  if (bookings.length === 0) return <V2Surface className="text-center"><p className="py-6 text-sm text-gray-500">Nenhuma solicitação de reserva ainda.</p></V2Surface>;

  return (
    <div className="space-y-4">
      <V2Surface className="space-y-2 p-4 sm:p-5">
        <h3 className="text-sm font-bold text-ink">Ativas</h3>
        {grouped.active.length === 0 ? <p className="text-sm text-gray-500">Nenhuma reserva ativa.</p>
          : grouped.active.map((b) => <V2BookingRow key={b.id} booking={b} perspective="arena" />)}
      </V2Surface>
      {grouped.past.length > 0 && (
        <V2Surface className="space-y-2 p-4 sm:p-5">
          <h3 className="text-sm font-bold text-ink">Histórico</h3>
          {grouped.past.map((b) => <V2BookingRow key={b.id} booking={b} perspective="arena" />)}
        </V2Surface>
      )}
    </div>
  );
}

function ManagersTab({ arena }) {
  const { data: managers = [] } = useArenaManagers(arena.id);
  const addManager = useAddManager();
  const removeManager = useRemoveManager();
  const [email, setEmail] = useState('');

  async function handleAddManager() {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) return;
    try {
      const snap = await getDocs(query(collection(db, 'users'), where('email', '==', trimmed)));
      if (snap.empty) { toast.error('Usuário não encontrado. Peça para a pessoa entrar na plataforma ao menos uma vez.'); return; }
      const target = snap.docs[0].data();
      if (managers.some((m) => m.user_id === target.uid)) { toast.error('Esse usuário já administra esta arena.'); return; }
      await addManager.mutateAsync({ arena, target: { user_id: target.uid, user_name: target.platform_name || target.full_name || target.email, user_photo: target.photo_url || '' } });
      toast.success('Admin da arena adicionado.');
      setEmail('');
    } catch (err) { toast.error(err?.message || 'Não foi possível adicionar o admin da arena.'); }
  }

  return (
    <V2Surface>
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-ink text-acid"><Users className="h-5 w-5" /></div>
        <div>
          <div className="font-display text-base font-bold text-ink">Admins da arena</div>
          <p className="mt-1 text-sm leading-6 text-gray-500">O criador já nasce como owner. Qualquer admin pode compartilhar a administração com outros usuários.</p>
        </div>
      </div>

      <ul className="mt-5 space-y-3">
        {managers.map((m) => (
          <li key={m.user_id} className="flex items-center justify-between gap-3 rounded-2xl border border-gray-100 bg-paper px-4 py-3">
            <div className="min-w-0">
              <div className="truncate font-semibold text-ink">{m.user_name || 'Usuário'}</div>
              <div className="mt-0.5 text-xs text-gray-400">{m.user_id}</div>
            </div>
            <div className="flex items-center gap-2">
              <V2Badge tone="neutral">{m.role === ARENA_MANAGER_ROLE.OWNER ? 'Owner' : 'Admin'}</V2Badge>
              {m.role !== ARENA_MANAGER_ROLE.OWNER && (
                <button onClick={() => removeManager.mutate({ arenaId: arena.id, userId: m.user_id })} disabled={removeManager.isPending} className="flex h-9 w-9 items-center justify-center rounded-full text-red-500 hover:bg-red-50">
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-5 rounded-3xl border border-gray-100 bg-paper p-4">
        <V2Field label="Adicionar admin (e-mail do usuário já cadastrado)">
          <div className="flex gap-2">
            <V2Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@dominio.com" type="email" />
            <V2Button onClick={handleAddManager} disabled={addManager.isPending}><UserPlus className="h-4 w-4" /></V2Button>
          </div>
        </V2Field>
      </div>
    </V2Surface>
  );
}
