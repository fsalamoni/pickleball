import React, { useMemo, useState } from 'react';
import { Navigate, useParams, Link } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, Trash2, Building2, UserPlus, Users } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ImageUpload } from '@/components/ui/image-upload';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PlatformSurfaceCard } from '@/components/ui/platform-page';
import { PhotoLightbox } from '@/components/ui/photo-lightbox';
import ConfirmDialog from '@/components/ConfirmDialog';
import { useFeatureFlag } from '@/core/lib/FeatureFlagsContext';
import { FEATURE_FLAG } from '@/core/featureFlags';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/core/config/firebase';
import ProfileFields from '../components/ProfileFields.jsx';
import PricingEditor from '../components/PricingEditor.jsx';
import ArenaReviews from '../components/ArenaReviews.jsx';
import BookingRow from '../components/BookingRow.jsx';
import { sortBookings } from '../domain/booking.js';
import { ARENA_MANAGER_ROLE, BOOKING_STATUS } from '../domain/constants.js';
import {
  useArena,
  useMyManagedArenas,
  useUpdateArena,
  useSetArenaPhotos,
  useDeleteArena,
  useArenaManagers,
  useAddManager,
  useRemoveManager,
} from '../hooks/useArenas.js';
import { useArenaBookings } from '../hooks/useBookings.js';

function InfoTab({ arena }) {
  const update = useUpdateArena();
  const [form, setForm] = useState({
    name: arena.name || '', description: arena.description || '', address: arena.address || '',
    neighborhood: arena.neighborhood || '', city: arena.city || '', state: arena.state || '',
    contact_phone: arena.contact_phone || '', contact_whatsapp: arena.contact_whatsapp || '',
    contact_email: arena.contact_email || '', instagram: arena.instagram || '', website: arena.website || '',
    court_count: arena.court_count ?? '', hours: arena.hours || '',
  });
  const setField = (key) => (e) => setForm((p) => ({ ...p, [key]: e.target.value }));

  async function save() {
    try {
      await update.mutateAsync({ id: arena.id, updates: form });
      toast.success('Informações atualizadas.');
    } catch (err) {
      toast.error(err?.message || 'Não foi possível salvar.');
    }
  }

  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        <ProfileFields form={form} setField={setField} />
        <div className="flex justify-end">
          <Button onClick={save} disabled={update.isPending}>{update.isPending ? 'Salvando…' : 'Salvar informações'}</Button>
        </div>
      </CardContent>
    </Card>
  );
}

function PhotosTab({ arena }) {
  const setPhotos = useSetArenaPhotos();
  const photos = arena.photos || [];

  async function addPhoto(url, meta) {
    if (!url) return;
    const next = [...photos, { url, path: meta?.path || '', name: meta?.name || 'foto' }];
    try {
      await setPhotos.mutateAsync({ id: arena.id, photos: next });
      toast.success('Foto adicionada.');
    } catch (err) {
      toast.error(err?.message || 'Falha ao adicionar a foto.');
    }
  }
  async function removePhoto(idx) {
    const next = photos.filter((_, i) => i !== idx);
    try {
      await setPhotos.mutateAsync({ id: arena.id, photos: next });
    } catch (err) {
      toast.error(err?.message || 'Falha ao remover a foto.');
    }
  }

  return (
    <PlatformSurfaceCard contentClassName="space-y-4 p-5">
        <div>
          <p className="mb-2 text-sm font-semibold text-slate-800">Fotos da arena</p>
          <p className="mb-3 text-xs text-slate-500">A primeira foto é usada como capa. Até 20 fotos.</p>
          {photos.length > 0 && (
            <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {photos.map((p, i) => (
                <div key={p.path || i} className="group relative">
                  <PhotoLightbox
                    src={p.url}
                    alt={`Foto ${i + 1} da arena`}
                    trigger={<img src={p.url} alt="" className="h-28 w-full cursor-zoom-in rounded-lg object-cover" />}
                  />
                  {i === 0 && <span className="absolute left-1 top-1 rounded bg-emerald-600 px-1.5 py-0.5 text-[10px] text-white">Capa</span>}
                  <button
                    type="button"
                    onClick={() => removePhoto(i)}
                    className="absolute right-1 top-1 rounded-full bg-white/90 p-1 text-red-600 opacity-0 transition-opacity group-hover:opacity-100"
                    aria-label="Remover foto"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
          {photos.length < 20 && (
            <ImageUpload value="" onChange={addPhoto} folder="arenas" label="Adicionar foto" hint="JPG/PNG da arena, quadras, estrutura." />
          )}
        </div>
    </PlatformSurfaceCard>
  );
}

function BookingsTab({ arena }) {
  const { data: bookings = [], isLoading } = useArenaBookings(arena.id);
  const grouped = useMemo(() => {
    const active = sortBookings(bookings.filter((b) => [BOOKING_STATUS.REQUESTED, BOOKING_STATUS.NEGOTIATING, BOOKING_STATUS.CONFIRMED].includes(b.status)));
    const past = sortBookings(bookings.filter((b) => [BOOKING_STATUS.DECLINED, BOOKING_STATUS.CANCELLED, BOOKING_STATUS.COMPLETED].includes(b.status)));
    return { active, past };
  }, [bookings]);

  if (isLoading) return <Skeleton className="h-40" />;
  if (bookings.length === 0) {
    return <Card><CardContent className="p-8 text-center text-sm text-slate-500">Nenhuma solicitação de reserva ainda.</CardContent></Card>;
  }
  return (
    <div className="space-y-4">
      <Card><CardContent className="space-y-2 p-4">
        <h3 className="text-sm font-semibold text-slate-800">Ativas</h3>
        {grouped.active.length === 0 ? <p className="text-sm text-slate-500">Nenhuma reserva ativa.</p>
          : grouped.active.map((b) => <BookingRow key={b.id} booking={b} perspective="arena" />)}
      </CardContent></Card>
      {grouped.past.length > 0 && (
        <Card><CardContent className="space-y-2 p-4">
          <h3 className="text-sm font-semibold text-slate-800">Histórico</h3>
          {grouped.past.map((b) => <BookingRow key={b.id} booking={b} perspective="arena" />)}
        </CardContent></Card>
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
      if (snap.empty) {
        toast.error('Usuário não encontrado. Peça para a pessoa entrar na plataforma ao menos uma vez.');
        return;
      }

      const target = snap.docs[0].data();
      if (managers.some((manager) => manager.user_id === target.uid)) {
        toast.error('Esse usuário já administra esta arena.');
        return;
      }

      await addManager.mutateAsync({
        arena,
        target: {
          user_id: target.uid,
          user_name: target.platform_name || target.full_name || target.email,
          user_photo: target.photo_url || '',
        },
      });
      toast.success('Admin da arena adicionado.');
      setEmail('');
    } catch (err) {
      toast.error(err?.message || 'Não foi possível adicionar o admin da arena.');
    }
  }

  return (
    <PlatformSurfaceCard>
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
          <Users className="h-4.5 w-4.5" />
        </div>
        <div>
          <div className="text-base font-semibold text-slate-950">Admins da arena</div>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            O criador da arena já nasce como owner. Qualquer admin da arena pode compartilhar a administração com outros usuários da plataforma.
          </p>
        </div>
      </div>

      <ul className="mt-5 space-y-3">
        {managers.map((manager) => (
          <li key={manager.user_id} className="flex items-center justify-between gap-3 rounded-[1.25rem] border border-emerald-950/10 bg-white/75 px-4 py-3">
            <div className="min-w-0">
              <div className="truncate font-medium text-slate-950">{manager.user_name || 'Usuário'}</div>
              <div className="mt-1 text-xs text-slate-500">{manager.user_id}</div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="shadow-none">
                {manager.role === ARENA_MANAGER_ROLE.OWNER ? 'Owner' : 'Admin'}
              </Badge>
              {manager.role !== ARENA_MANAGER_ROLE.OWNER && (
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => removeManager.mutate({ arenaId: arena.id, userId: manager.user_id })}
                  disabled={removeManager.isPending}
                >
                  <Trash2 className="w-4 h-4 text-red-600" />
                </Button>
              )}
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-5 rounded-[1.5rem] border border-emerald-950/10 bg-secondary/35 p-4">
        <Label>Adicionar admin da arena (e-mail do usuário já cadastrado)</Label>
        <div className="mt-3 flex gap-2">
          <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@dominio.com" type="email" />
          <Button onClick={handleAddManager} disabled={addManager.isPending}>
            <UserPlus className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </PlatformSurfaceCard>
  );
}

export default function ArenaManage() {
  const enabled = useFeatureFlag(FEATURE_FLAG.ARENAS);
  const { arenaId } = useParams();
  const { user, isPlatformAdmin } = useAuth();
  const { data: arena, isLoading } = useArena(arenaId);
  const { data: managed = [] } = useMyManagedArenas();
  const deleteArena = useDeleteArena();

  if (!enabled) return <Navigate to="/inicio" replace />;
  if (isLoading) return <div className="mx-auto max-w-3xl space-y-4"><Skeleton className="h-12" /><Skeleton className="h-64" /></div>;
  if (!arena) {
    return (
      <div className="mx-auto max-w-md p-6 text-center">
        <Building2 className="mx-auto h-10 w-10 text-slate-300" />
        <h2 className="mt-3 font-semibold">Arena não encontrada</h2>
        <Link to="/arenas" className="mt-1 inline-block text-sm text-emerald-700 underline">Voltar ao diretório</Link>
      </div>
    );
  }

  const canManage = arena.owner_id === user?.uid || managed.some((m) => m.id === arena.id) || isPlatformAdmin;
  if (!canManage) return <Navigate to={`/arenas/${arena.id}`} replace />;
  const isOwner = arena.owner_id === user?.uid || isPlatformAdmin;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center justify-between gap-2">
        <Link to={`/arenas/${arena.id}`} className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
          <ArrowLeft className="h-4 w-4" /> {arena.name}
        </Link>
        {isOwner && (
          <ConfirmDialog
            title="Excluir arena?"
            description="A arena, suas reservas e avaliações serão removidas permanentemente."
            confirmLabel="Excluir"
            onConfirm={async () => {
              try {
                await deleteArena.mutateAsync(arena.id);
                toast.success('Arena excluída.');
                window.location.assign('/arenas');
              } catch (err) {
                toast.error(err?.message || 'Não foi possível excluir.');
              }
            }}
            trigger={<Button size="sm" variant="outline" className="text-red-600"><Trash2 className="h-4 w-4" /> <span className="ml-1 hidden sm:inline">Excluir</span></Button>}
          />
        )}
      </div>

      <PlatformSurfaceCard>
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
            <Building2 className="h-4.5 w-4.5" />
          </div>
          <div>
            <div className="text-base font-semibold text-slate-950">Central da arena</div>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              Aqui você gerencia reservas, preços, fotos, admins e informações públicas da arena no mesmo fluxo operacional.
            </p>
          </div>
        </div>
      </PlatformSurfaceCard>

      <Tabs defaultValue="reservas">
        <div className="overflow-x-auto -mx-1 px-1">
          <TabsList className="inline-flex h-auto min-w-full justify-start gap-2 rounded-[1.25rem] bg-amber-50 p-2">
            <TabsTrigger value="reservas">Reservas</TabsTrigger>
            <TabsTrigger value="precos">Preços</TabsTrigger>
            <TabsTrigger value="fotos">Fotos</TabsTrigger>
            <TabsTrigger value="info">Informações</TabsTrigger>
            <TabsTrigger value="admins">Admins</TabsTrigger>
            <TabsTrigger value="retornos">Retornos</TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="reservas" className="mt-4"><BookingsTab arena={arena} /></TabsContent>
        <TabsContent value="precos" className="mt-4"><Card><CardContent className="p-5"><PricingEditor arena={arena} /></CardContent></Card></TabsContent>
        <TabsContent value="fotos" className="mt-4"><PhotosTab arena={arena} /></TabsContent>
        <TabsContent value="info" className="mt-4"><InfoTab arena={arena} /></TabsContent>
        <TabsContent value="admins" className="mt-4"><ManagersTab arena={arena} /></TabsContent>
        <TabsContent value="retornos" className="mt-4"><ArenaReviews arena={arena} canModerate /></TabsContent>
      </Tabs>
    </div>
  );
}
