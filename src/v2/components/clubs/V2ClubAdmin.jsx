import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Check, Copy, RefreshCw, Save, Search, Trash2, UserPlus, Users, X } from 'lucide-react';
import { UserAvatar } from '@/components/ui/user-avatar';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { ImageUpload } from '@/components/ui/image-upload';
import { useClipboard } from '@/core/lib/useClipboard';
import {
  useUpdateClub,
  useRegenerateInviteCode,
  useDeleteClub,
  useJoinRequests,
  useApproveJoinRequest,
  useRejectJoinRequest,
  useClubInvites,
  useInviteMembersToClub,
  useCancelClubInvite,
  useClubMembers,
} from '@/modules/clubs/hooks/useClubs';
import { useAllAthletes } from '@/modules/athletes/hooks/useAthletes';
import { useFeatureFlag } from '@/core/lib/FeatureFlagsContext';
import { FEATURE_FLAG } from '@/core/featureFlags';
import { V2Badge, V2Button, V2Surface, V2Toggle } from '@/v2/ui/primitives';
import { cn } from '@/core/lib/utils';

export default function V2ClubAdmin({ club }) {
  const navigate = useNavigate();
  const { copy, copied } = useClipboard();
  const updateClub = useUpdateClub(club.id);
  const publicPageOn = useFeatureFlag(FEATURE_FLAG.CLUB_PUBLIC_PAGE);
  const regenerate = useRegenerateInviteCode(club.id);
  const deleteClub = useDeleteClub(club.id);
  const [confirmRegen, setConfirmRegen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const [form, setForm] = useState({
    name: club.name || '',
    description: club.description || '',
    city: club.city || '',
    state: club.state || '',
    home_venue: club.home_venue || '',
    contact_email: club.contact_email || '',
    contact_phone: club.contact_phone || '',
    instagram: club.instagram || '',
    logo_url: club.logo_url || '',
  });

  const setField = (key) => (e) => setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error('O nome do clube é obrigatório.');
      return;
    }
    try {
      await updateClub.mutateAsync(form);
      toast.success('Clube atualizado.');
    } catch (err) {
      toast.error(err.message || 'Não foi possível salvar.');
    }
  };

  const handleRegenerate = async () => {
    try {
      const code = await regenerate.mutateAsync();
      toast.success(`Novo código gerado: ${code}`);
      setConfirmRegen(false);
    } catch (err) {
      toast.error(err.message || 'Não foi possível gerar novo código.');
    }
  };

  const handleDelete = async () => {
    try {
      await deleteClub.mutateAsync();
      toast.success('Clube excluído.');
      navigate('/clubes');
    } catch (err) {
      toast.error(err.message || 'Não foi possível excluir o clube.');
    }
  };

  return (
    <div className="space-y-4">
      <V2ClubJoinRequests club={club} />
      <V2ClubAddMembers club={club} />

      <V2Surface>
        <h3 className="font-display text-base font-bold text-ink">Código de convite</h3>
        <p className="mt-1 text-sm text-gray-500">Compartilhe este código para que atletas ingressem no clube.</p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <code className="rounded-2xl border border-gray-100 bg-paper-pure px-4 py-2 font-display text-lg font-bold tracking-[0.25em] text-ink shadow-organic-sm">
            {club.invite_code}
          </code>
          <V2Button variant="ghost" size="sm" onClick={() => copy(club.invite_code, 'Código copiado!')}>
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} Copiar
          </V2Button>
          <V2Button variant="ghost" size="sm" onClick={() => setConfirmRegen(true)} disabled={regenerate.isPending}>
            <RefreshCw className="h-4 w-4" /> Gerar novo
          </V2Button>
        </div>
        <p className="mt-3 text-xs text-gray-400">Ao gerar um novo código, o anterior deixa de funcionar imediatamente.</p>
      </V2Surface>

      {publicPageOn && <V2ClubPublicPageCard club={club} updateClub={updateClub} copy={copy} />}

      <V2Surface>
        <h3 className="font-display text-base font-bold text-ink">Editar clube</h3>
        <p className="mt-1 text-sm text-gray-500">Atualize as informações exibidas para a comunidade.</p>
        <form onSubmit={handleSave} className="mt-5 space-y-4">
          <div className="space-y-2">
            <label className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Logo / imagem do clube</label>
            <ImageUpload
              value={form.logo_url}
              onChange={(url) => setForm((prev) => ({ ...prev, logo_url: url }))}
              folder="clubs"
              shape="square"
              label="Enviar logo"
              hint="Logo ou foto do clube exibida no diretório e na página do clube."
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="admin_name" className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Nome *</label>
            <input
              id="admin_name" value={form.name} onChange={setField('name')} maxLength={80} required
              className="w-full rounded-2xl border border-gray-200 bg-paper px-4 py-3 text-sm text-ink outline-none focus-visible:ring-4 focus-visible:ring-acid/30"
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="admin_description" className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Descrição</label>
            <textarea
              id="admin_description" value={form.description} onChange={setField('description')} rows={3} maxLength={1000}
              className="w-full resize-y rounded-2xl border border-gray-200 bg-paper px-4 py-3 text-sm text-ink outline-none focus-visible:ring-4 focus-visible:ring-acid/30"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label htmlFor="admin_city" className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Cidade</label>
              <input id="admin_city" value={form.city} onChange={setField('city')} maxLength={60} className="w-full rounded-2xl border border-gray-200 bg-paper px-4 py-3 text-sm text-ink outline-none focus-visible:ring-4 focus-visible:ring-acid/30" />
            </div>
            <div className="space-y-2">
              <label htmlFor="admin_state" className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Estado (UF)</label>
              <input id="admin_state" value={form.state} onChange={setField('state')} maxLength={2} className="w-full rounded-2xl border border-gray-200 bg-paper px-4 py-3 text-sm text-ink outline-none focus-visible:ring-4 focus-visible:ring-acid/30" />
            </div>
          </div>
          <div className="space-y-2">
            <label htmlFor="admin_venue" className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Local / quadra principal</label>
            <input id="admin_venue" value={form.home_venue} onChange={setField('home_venue')} maxLength={120} className="w-full rounded-2xl border border-gray-200 bg-paper px-4 py-3 text-sm text-ink outline-none focus-visible:ring-4 focus-visible:ring-acid/30" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label htmlFor="admin_email" className="text-[11px] font-bold uppercase tracking-widest text-gray-400">E-mail de contato</label>
              <input id="admin_email" type="email" value={form.contact_email} onChange={setField('contact_email')} maxLength={120} className="w-full rounded-2xl border border-gray-200 bg-paper px-4 py-3 text-sm text-ink outline-none focus-visible:ring-4 focus-visible:ring-acid/30" />
            </div>
            <div className="space-y-2">
              <label htmlFor="admin_phone" className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Telefone de contato</label>
              <input id="admin_phone" type="tel" value={form.contact_phone} onChange={setField('contact_phone')} maxLength={30} className="w-full rounded-2xl border border-gray-200 bg-paper px-4 py-3 text-sm text-ink outline-none focus-visible:ring-4 focus-visible:ring-acid/30" />
            </div>
          </div>
          <div className="space-y-2">
            <label htmlFor="admin_instagram" className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Instagram</label>
            <input id="admin_instagram" value={form.instagram} onChange={setField('instagram')} maxLength={60} className="w-full rounded-2xl border border-gray-200 bg-paper px-4 py-3 text-sm text-ink outline-none focus-visible:ring-4 focus-visible:ring-acid/30" />
          </div>
          <div className="pt-2">
            <V2Button type="submit" disabled={updateClub.isPending}>
              <Save className="h-4 w-4" /> {updateClub.isPending ? 'Salvando…' : 'Salvar alterações'}
            </V2Button>
          </div>
        </form>
      </V2Surface>

      <V2Surface className="border-red-100 bg-red-50/30">
        <h3 className="font-display text-base font-bold text-red-600">Zona de risco</h3>
        <p className="mt-1 text-sm text-gray-600">A exclusão do clube remove membros, eventos e mural. Não pode ser desfeita.</p>
        <div className="mt-4">
          <V2Button variant="danger" onClick={() => setConfirmDelete(true)} disabled={deleteClub.isPending}>
            <Trash2 className="h-4 w-4" /> Excluir clube
          </V2Button>
        </div>
      </V2Surface>

      <ConfirmDialog
        open={confirmRegen}
        onOpenChange={setConfirmRegen}
        title="Gerar novo código"
        description="O código atual deixará de funcionar. Deseja continuar?"
        confirmLabel="Gerar novo"
        loading={regenerate.isPending}
        onConfirm={handleRegenerate}
      />
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Excluir clube"
        description={`Tem certeza que deseja excluir "${club.name}"? Esta ação não pode ser desfeita.`}
        confirmLabel="Excluir definitivamente"
        destructive
        loading={deleteClub.isPending}
        onConfirm={handleDelete}
      />
    </div>
  );
}

function V2ClubPublicPageCard({ club, updateClub, copy }) {
  const isPublic = club.is_public === true;
  const publicLink = typeof window !== 'undefined' ? `${window.location.origin}/c/${club.id}` : `/c/${club.id}`;

  const handleToggle = async (next) => {
    try {
      await updateClub.mutateAsync({ is_public: next });
      toast.success(next ? 'Página pública ativada.' : 'Página pública desativada.');
    } catch (err) {
      toast.error(err.message || 'Não foi possível atualizar.');
    }
  };

  return (
    <V2Surface>
      <h3 className="font-display text-base font-bold text-ink">Página pública do clube</h3>
      <p className="mt-1 text-sm text-gray-500">
        Quando ativada, qualquer pessoa pode ver uma vitrine do clube (nome, local e descrição) sem entrar na plataforma.
      </p>
      <div className="mt-4 rounded-3xl border border-gray-100 bg-paper-pure p-4 shadow-organic-sm">
        <V2Toggle
          id="club-is-public"
          checked={isPublic}
          onChange={handleToggle}
          label="Clube público"
          hint="Exibir vitrine para visitantes não autenticados."
        />
      </div>
      {isPublic && (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <code className="min-w-0 flex-1 truncate rounded-2xl border border-gray-100 bg-paper px-4 py-2 text-xs text-gray-600">
            {publicLink}
          </code>
          <V2Button variant="ghost" size="sm" onClick={() => copy(publicLink, 'Link copiado!')}>
            <Copy className="h-4 w-4" /> Copiar link
          </V2Button>
        </div>
      )}
    </V2Surface>
  );
}

function V2ClubJoinRequests({ club }) {
  const { data: requests = [], isLoading } = useJoinRequests(club.id);
  const approve = useApproveJoinRequest(club.id);
  const reject = useRejectJoinRequest(club.id);

  const handle = async (mutation, request, okMsg) => {
    try {
      await mutation.mutateAsync(request);
      toast.success(okMsg);
    } catch (err) {
      toast.error(err.message || 'Não foi possível concluir a ação.');
    }
  };

  return (
    <V2Surface>
      <div className="flex items-center gap-2">
        <h3 className="font-display text-base font-bold text-ink">Pedidos de ingresso</h3>
        {requests.length > 0 && <V2Badge tone="amber">{requests.length}</V2Badge>}
      </div>
      <p className="mt-1 text-sm text-gray-500">Atletas que pediram para entrar no clube.</p>

      <div className="mt-5 space-y-2">
        {isLoading ? (
          <p className="text-sm text-gray-500">Carregando…</p>
        ) : requests.length === 0 ? (
          <p className="text-sm text-gray-500">Nenhum pedido pendente.</p>
        ) : (
          requests.map((r) => (
            <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-gray-100 bg-paper-pure p-4 shadow-organic-sm">
              <div className="flex items-center gap-3">
                <UserAvatar name={r.user_name} photoUrl={r.photo_url} size="md" />
                <div className="min-w-0">
                  <div className="truncate text-sm font-bold text-ink">{r.user_name}</div>
                  {r.user_email && <div className="truncate text-xs text-gray-500">{r.user_email}</div>}
                </div>
              </div>
              <div className="flex shrink-0 gap-2">
                <V2Button size="sm" onClick={() => handle(approve, r, 'Pedido aprovado.')} disabled={approve.isPending}>
                  <Check className="h-4 w-4" /> Aprovar
                </V2Button>
                <V2Button size="sm" variant="ghost" onClick={() => handle(reject, r, 'Pedido recusado.')} disabled={reject.isPending}>
                  <X className="h-4 w-4" /> Recusar
                </V2Button>
              </div>
            </div>
          ))
        )}
      </div>
    </V2Surface>
  );
}

function V2ClubAddMembers({ club }) {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState({});
  const { data: athletes = [], isLoading } = useAllAthletes();
  const { data: members = [] } = useClubMembers(club.id);
  const { data: invites = [] } = useClubInvites(club.id);
  const inviteMany = useInviteMembersToClub(club);
  const cancelInvite = useCancelClubInvite(club.id);

  const memberIds = useMemo(() => new Set(members.map((m) => m.user_id)), [members]);
  const invitedIds = useMemo(() => new Set(invites.map((i) => i.user_id)), [invites]);

  const athleteName = (a) => a.platform_name || a.full_name || a.name || 'Atleta';

  const available = useMemo(() => {
    const q = search.trim().toLowerCase();
    return athletes
      .filter((a) => a.id && !memberIds.has(a.id) && !invitedIds.has(a.id))
      .filter((a) => {
        if (!q) return true;
        const hay = `${athleteName(a)} ${a.city || ''} ${a.email || ''}`.toLowerCase();
        return hay.includes(q);
      })
      .sort((a, b) => athleteName(a).localeCompare(athleteName(b), 'pt-BR'));
  }, [athletes, memberIds, invitedIds, search]);

  const selectedCount = Object.keys(selected).length;

  const toggle = (a) => setSelected((prev) => {
    const next = { ...prev };
    if (next[a.id]) delete next[a.id];
    else next[a.id] = a;
    return next;
  });

  const handleInviteSelected = async () => {
    const targets = Object.values(selected).map((a) => ({
      user_id: a.id,
      user_name: athleteName(a),
      user_email: a.email || '',
      photo_url: a.photo_url || '',
    }));
    try {
      const { invited, failed } = await inviteMany.mutateAsync(targets);
      setSelected({});
      if (invited > 0) toast.success(`${invited} convite(s) enviado(s).${failed ? ` ${failed} falhou(aram).` : ''}`);
      else toast.error('Não foi possível enviar os convites.');
    } catch (err) {
      toast.error(err.message || 'Não foi possível convidar.');
    }
  };

  const handleCancel = async (inv) => {
    try {
      await cancelInvite.mutateAsync(inv);
      toast.success('Convite cancelado.');
    } catch (err) {
      toast.error(err.message || 'Não foi possível cancelar o convite.');
    }
  };

  return (
    <V2Surface>
      <h3 className="flex items-center gap-2 font-display text-base font-bold text-ink"><UserPlus className="h-4 w-4" /> Adicionar membros</h3>
      <p className="mt-1 text-sm text-gray-500">Selecione atletas da plataforma e envie convites. Eles recebem um aviso e decidem aceitar.</p>

      <div className="mt-5 space-y-4">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filtrar por nome, cidade ou e-mail"
            className="w-full rounded-full border border-gray-200 bg-paper px-4 py-2.5 pl-10 text-sm text-ink outline-none focus-visible:ring-4 focus-visible:ring-acid/30"
          />
        </div>

        {isLoading ? (
          <p className="text-sm text-gray-500">Carregando atletas…</p>
        ) : available.length === 0 ? (
          <div className="flex items-center gap-2 rounded-2xl bg-paper px-4 py-5 text-sm text-gray-500">
            <Users className="h-4 w-4 shrink-0" />
            {search.trim() ? 'Nenhum atleta encontrado para esse filtro.' : 'Todos os atletas já são membros ou já foram convidados.'}
          </div>
        ) : (
          <div className="max-h-80 space-y-1.5 overflow-y-auto rounded-3xl border border-gray-100 bg-paper-pure p-1.5">
            {available.map((a) => {
              const isSel = !!selected[a.id];
              return (
                <button
                  type="button"
                  key={a.id}
                  onClick={() => toggle(a)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition-colors',
                    isSel ? 'border-ink bg-ink/5' : 'border-transparent bg-white hover:bg-paper'
                  )}
                >
                  <span className={cn(
                    'flex h-5 w-5 shrink-0 items-center justify-center rounded border',
                    isSel ? 'border-ink bg-ink text-acid' : 'border-gray-300 bg-white'
                  )}>
                    {isSel && <Check className="h-3 w-3" />}
                  </span>
                  <UserAvatar name={athleteName(a)} photoUrl={a.photo_url} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-bold text-ink">{athleteName(a)}</div>
                    {(a.city || a.email) && (
                      <div className="truncate text-xs text-gray-500">
                        {a.city ? `${a.city}${a.state ? ` / ${a.state}` : ''}` : a.email}
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        <V2Button
          onClick={handleInviteSelected}
          disabled={selectedCount === 0 || inviteMany.isPending}
          className="w-full"
        >
          <UserPlus className="h-4 w-4" />
          {inviteMany.isPending
            ? 'Enviando…'
            : selectedCount > 0 ? `Convidar selecionados (${selectedCount})` : 'Selecione atletas para convidar'}
        </V2Button>

        {invites.length > 0 && (
          <div className="border-t border-gray-100 pt-4">
            <div className="mb-2 text-[11px] font-bold uppercase tracking-widest text-gray-400">Convites pendentes ({invites.length})</div>
            <div className="space-y-1.5">
              {invites.map((i) => (
                <div key={i.id} className="flex items-center gap-3 rounded-2xl bg-paper px-3 py-2">
                  <UserAvatar name={i.user_name} photoUrl={i.photo_url} size="sm" />
                  <span className="min-w-0 flex-1 truncate text-sm font-bold text-ink">{i.user_name}</span>
                  <button
                    type="button"
                    onClick={() => handleCancel(i)}
                    disabled={cancelInvite.isPending}
                    className="flex h-8 w-8 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-white hover:text-red-500"
                    title="Cancelar convite"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </V2Surface>
  );
}
