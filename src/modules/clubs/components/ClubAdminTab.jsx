import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Check, Copy, RefreshCw, Save, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { ImageUpload } from '@/components/ui/image-upload';
import { useClipboard } from '@/core/lib/useClipboard';
import { useUpdateClub, useRegenerateInviteCode, useDeleteClub } from '@/modules/clubs/hooks/useClubs';

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
      <Card className="rounded-xl">
        <CardHeader className="p-4 sm:p-5">
          <CardTitle className="text-base">Código de convite</CardTitle>
          <CardDescription>Compartilhe este código para que atletas ingressem no clube.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 p-4 pt-0 sm:p-5 sm:pt-0">
          <div className="flex flex-wrap items-center gap-2">
            <code className="rounded-md border border-emerald-950/10 bg-secondary/40 px-4 py-2 text-lg font-bold tracking-[0.25em] text-slate-900">
              {club.invite_code}
            </code>
            <Button variant="outline" size="sm" onClick={() => copy(club.invite_code, 'Código copiado!')}>
              {copied ? <Check className="mr-1.5 h-4 w-4" /> : <Copy className="mr-1.5 h-4 w-4" />} Copiar
            </Button>
            <Button variant="outline" size="sm" onClick={() => setConfirmRegen(true)} disabled={regenerate.isPending}>
              <RefreshCw className="mr-1.5 h-4 w-4" /> Gerar novo
            </Button>
          </div>
          <p className="text-xs text-slate-500">
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
            <Button type="submit" disabled={updateClub.isPending} className="bg-emerald-700 hover:bg-emerald-800">
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
