import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Check, Copy, RefreshCw, Save, Search, Trash2, UserPlus, Users, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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

export default function ClubAdminTab({ club }) {
  const navigate = useNavigate();
  const { copy, copied } = useClipboard();
  const updateClub = useUpdateClub(club.id);
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
      <ClubJoinRequests club={club} />
      <ClubAddMembers club={club} />

      <Card className="rounded-xl">
        <CardHeader className="p-4 sm:p-5">
          <CardTitle className="text-base">Código de convite</CardTitle>
          <CardDescription>Compartilhe este código para que atletas ingressem no clube.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 p-4 pt-0 sm:p-5 sm:pt-0">
          <div className="flex flex-wrap items-center gap-2">
            <code className="rounded-md border border-gray-100 bg-paper px-4 py-2 text-lg font-bold tracking-[0.25em] text-ink">
              {club.invite_code}
            </code>
            <Button variant="outline" size="sm" onClick={() => copy(club.invite_code, 'Código copiado!')}>
              {copied ? <Check className="mr-1.5 h-4 w-4" /> : <Copy className="mr-1.5 h-4 w-4" />} Copiar
            </Button>
            <Button variant="outline" size="sm" onClick={() => setConfirmRegen(true)} disabled={regenerate.isPending}>
              <RefreshCw className="mr-1.5 h-4 w-4" /> Gerar novo
            </Button>
          </div>
          <p className="text-xs text-gray-500">
            Ao gerar um novo código, o anterior deixa de funcionar imediatamente.
          </p>
        </CardContent>
      </Card>

      <Card className="rounded-xl">
        <CardHeader className="p-4 sm:p-5">
          <CardTitle className="text-base">Editar clube</CardTitle>
          <CardDescription>Atualize as informações exibidas para a comunidade.</CardDescription>
        </CardHeader>
        <CardContent className="p-4 pt-0 sm:p-5 sm:pt-0">
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-2">
              <Label>Logo / imagem do clube</Label>
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
              <Label htmlFor="admin_name">Nome *</Label>
              <Input id="admin_name" value={form.name} onChange={setField('name')} maxLength={80} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="admin_description">Descrição</Label>
              <textarea
                id="admin_description"
                value={form.description}
                onChange={setField('description')}
                rows={3}
                maxLength={1000}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="admin_city">Cidade</Label>
                <Input id="admin_city" value={form.city} onChange={setField('city')} maxLength={60} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="admin_state">Estado (UF)</Label>
                <Input id="admin_state" value={form.state} onChange={setField('state')} maxLength={2} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="admin_venue">Local / quadra principal</Label>
              <Input id="admin_venue" value={form.home_venue} onChange={setField('home_venue')} maxLength={120} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="admin_email">E-mail de contato</Label>
                <Input id="admin_email" type="email" value={form.contact_email} onChange={setField('contact_email')} maxLength={120} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="admin_phone">Telefone de contato</Label>
                <Input id="admin_phone" type="tel" value={form.contact_phone} onChange={setField('contact_phone')} maxLength={30} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="admin_instagram">Instagram</Label>
              <Input id="admin_instagram" value={form.instagram} onChange={setField('instagram')} maxLength={60} />
            </div>
            <Button type="submit" disabled={updateClub.isPending} className="bg-ink hover:bg-ink-light">
              <Save className="mr-1.5 h-4 w-4" /> {updateClub.isPending ? 'Salvando…' : 'Salvar alterações'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="rounded-xl border-red-200">
        <CardHeader className="p-4 sm:p-5">
          <CardTitle className="text-base text-red-700">Zona de risco</CardTitle>
          <CardDescription>A exclusão do clube remove membros, eventos e mural. Não pode ser desfeita.</CardDescription>
        </CardHeader>
        <CardContent className="p-4 pt-0 sm:p-5 sm:pt-0">
          <Button variant="destructive" onClick={() => setConfirmDelete(true)} disabled={deleteClub.isPending}>
            <Trash2 className="mr-1.5 h-4 w-4" /> Excluir clube
          </Button>
        </CardContent>
      </Card>

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

/** Pedidos de ingresso pendentes — o admin aprova ou recusa. */
function ClubJoinRequests({ club }) {
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
    <Card className="rounded-xl">
      <CardHeader className="p-4 sm:p-5">
        <CardTitle className="flex items-center gap-2 text-base">
          Pedidos de ingresso
          {requests.length > 0 && <Badge variant="warning" className="rounded-full">{requests.length}</Badge>}
        </CardTitle>
        <CardDescription>Atletas que pediram para entrar no clube.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 p-4 pt-0 sm:p-5 sm:pt-0">
        {isLoading ? (
          <p className="text-sm text-gray-500">Carregando…</p>
        ) : requests.length === 0 ? (
          <p className="text-sm text-gray-500">Nenhum pedido pendente.</p>
        ) : (
          requests.map((r) => (
            <div key={r.id} className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-3">
              <UserAvatar name={r.user_name} photoUrl={r.photo_url} size="sm" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-ink">{r.user_name}</div>
                {r.user_email && <div className="truncate text-xs text-gray-500">{r.user_email}</div>}
              </div>
              <div className="flex shrink-0 gap-1.5">
                <Button size="sm" onClick={() => handle(approve, r, 'Pedido aprovado.')} disabled={approve.isPending}>
                  <Check className="mr-1 h-3.5 w-3.5" /> Aprovar
                </Button>
                <Button size="sm" variant="outline" onClick={() => handle(reject, r, 'Pedido recusado.')} disabled={reject.isPending}>
                  <X className="mr-1 h-3.5 w-3.5" /> Recusar
                </Button>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Adicionar membros: lista navegável de TODOS os atletas/usuários da
 * plataforma, com busca, seleção múltipla e convite em lote. Os convidados
 * recebem um aviso no sino e decidem aceitar ou recusar.
 */
function ClubAddMembers({ club }) {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState({}); // { uid: athlete }
  const { data: athletes = [], isLoading } = useAllAthletes();
  const { data: members = [] } = useClubMembers(club.id);
  const { data: invites = [] } = useClubInvites(club.id);
  const inviteMany = useInviteMembersToClub(club);
  const cancelInvite = useCancelClubInvite(club.id);

  const memberIds = useMemo(() => new Set(members.map((m) => m.user_id)), [members]);
  const invitedIds = useMemo(() => new Set(invites.map((i) => i.user_id)), [invites]);

  const athleteName = (a) => a.platform_name || a.full_name || a.name || 'Atleta';

  // Disponíveis = todos os perfis menos quem já é membro ou já tem convite.
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
    <Card className="rounded-xl">
      <CardHeader className="p-4 sm:p-5">
        <CardTitle className="flex items-center gap-2 text-base"><UserPlus className="h-4 w-4" /> Adicionar membros</CardTitle>
        <CardDescription>Selecione atletas da plataforma e envie convites. Eles recebem um aviso e decidem aceitar.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 p-4 pt-0 sm:p-5 sm:pt-0">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filtrar por nome, cidade ou e-mail"
            className="pl-9"
          />
        </div>

        {isLoading ? (
          <p className="text-sm text-gray-500">Carregando atletas…</p>
        ) : available.length === 0 ? (
          <div className="flex items-center gap-2 rounded-lg bg-paper px-3 py-4 text-sm text-gray-500">
            <Users className="h-4 w-4 shrink-0" />
            {search.trim() ? 'Nenhum atleta encontrado para esse filtro.' : 'Todos os atletas já são membros ou já foram convidados.'}
          </div>
        ) : (
          <div className="max-h-80 space-y-1.5 overflow-y-auto rounded-lg border border-gray-100 p-1.5">
            {available.map((a) => {
              const isSel = !!selected[a.id];
              return (
                <button
                  type="button"
                  key={a.id}
                  onClick={() => toggle(a)}
                  className={`flex w-full items-center gap-3 rounded-lg border p-2.5 text-left transition-colors ${
                    isSel ? 'border-green-300 bg-green-50' : 'border-transparent bg-white hover:bg-paper'
                  }`}
                >
                  <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${
                    isSel ? 'border-ink bg-ink text-white' : 'border-gray-200 bg-white'
                  }`}>
                    {isSel && <Check className="h-3.5 w-3.5" />}
                  </span>
                  <UserAvatar name={athleteName(a)} photoUrl={a.photo_url} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-ink">{athleteName(a)}</div>
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

        <Button
          onClick={handleInviteSelected}
          disabled={selectedCount === 0 || inviteMany.isPending}
          className="w-full bg-ink hover:bg-ink-light"
        >
          <UserPlus className="mr-1.5 h-4 w-4" />
          {inviteMany.isPending
            ? 'Enviando…'
            : selectedCount > 0 ? `Convidar selecionados (${selectedCount})` : 'Selecione atletas para convidar'}
        </Button>

        {invites.length > 0 && (
          <div className="border-t border-gray-100 pt-3">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Convites pendentes ({invites.length})</div>
            <div className="space-y-1.5">
              {invites.map((i) => (
                <div key={i.id} className="flex items-center gap-2 rounded-lg bg-paper px-2.5 py-1.5">
                  <UserAvatar name={i.user_name} photoUrl={i.photo_url} size="sm" />
                  <span className="min-w-0 flex-1 truncate text-sm text-gray-600">{i.user_name}</span>
                  <button
                    type="button"
                    onClick={() => handleCancel(i)}
                    disabled={cancelInvite.isPending}
                    className="text-gray-400 transition-colors hover:text-red-600"
                    title="Cancelar convite"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
