import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Building2, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ImageUpload } from '@/components/ui/image-upload';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useCreateClub } from '@/modules/clubs/hooks/useClubs';

const INITIAL = {
  name: '',
  description: '',
  city: '',
  state: '',
  home_venue: '',
  contact_email: '',
  contact_phone: '',
  instagram: '',
  logo_url: '',
};

export default function CreateClub() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const createClub = useCreateClub();
  const [form, setForm] = useState(INITIAL);
  const [errors, setErrors] = useState({});

  const setField = (key) => (e) => setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const onSubmit = async (e) => {
    e.preventDefault();
    const nextErrors = {};
    if (!form.name.trim()) nextErrors.name = 'Informe o nome do clube.';
    if (form.contact_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.contact_email.trim())) {
      nextErrors.contact_email = 'Informe um e-mail válido.';
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    try {
      const id = await createClub.mutateAsync(form);
      toast.success('Clube criado com sucesso!');
      navigate(`/clubes/${id}`);
    } catch (err) {
      toast.error(err.message || 'Não foi possível criar o clube.');
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Button asChild variant="ghost" size="sm" className="text-emerald-50 hover:bg-white/10 hover:text-white">
        <Link to="/clubes"><ArrowLeft className="mr-1.5 h-4 w-4" /> Voltar para clubes</Link>
      </Button>

      <section className="arena-panel-strong rounded-lg p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-amber-300 text-slate-950">
            <Building2 className="h-5 w-5" />
          </div>
          <div className="max-w-2xl space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-emerald-200">Novo clube</p>
            <h1 className="text-2xl font-bold text-white sm:text-3xl">Criar clube</h1>
            <p className="text-sm leading-6 text-emerald-50/85">
              Você será o administrador do clube e poderá convidar atletas por meio de um código exclusivo.
            </p>
          </div>
        </div>
      </section>

      <Card className="overflow-hidden">
        <CardHeader className="border-b border-emerald-950/10 bg-white/45 p-4 sm:p-5">
          <CardTitle className="text-base text-slate-950">Dados do clube</CardTitle>
          <CardDescription>Apenas o nome é obrigatório. Quanto mais completo, melhor para a comunidade encontrar você.</CardDescription>
        </CardHeader>
        <CardContent className="p-4 sm:p-5">
          {!isAuthenticated && (
            <p className="mb-4 rounded-md border border-amber-300/70 bg-amber-50 p-3 text-sm text-amber-900">
              Você precisa estar autenticado para criar um clube.
            </p>
          )}
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Logo / imagem do clube</Label>
              <ImageUpload
                value={form.logo_url}
                onChange={(url) => setForm((prev) => ({ ...prev, logo_url: url }))}
                folder="clubs"
                shape="square"
                label="Enviar logo"
                hint="Logo ou foto do clube. Aparece no diretório e na página do clube."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Nome do clube *</Label>
              <Input id="name" value={form.name} onChange={setField('name')} maxLength={80} required />
              {errors.name && <p className="text-xs text-red-600">{errors.name}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descrição</Label>
              <textarea
                id="description"
                value={form.description}
                onChange={setField('description')}
                maxLength={1000}
                rows={4}
                placeholder="Conte sobre o clube, horários de jogo, ambiente, valores…"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="city">Cidade</Label>
                <Input id="city" value={form.city} onChange={setField('city')} maxLength={60} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="state">Estado (UF)</Label>
                <Input id="state" value={form.state} onChange={setField('state')} maxLength={2} placeholder="SP" />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="home_venue">Local / quadra principal</Label>
              <Input id="home_venue" value={form.home_venue} onChange={setField('home_venue')} maxLength={120} />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="contact_email">E-mail de contato</Label>
                <Input id="contact_email" type="email" value={form.contact_email} onChange={setField('contact_email')} maxLength={120} />
                {errors.contact_email && <p className="text-xs text-red-600">{errors.contact_email}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="contact_phone">Telefone de contato</Label>
                <Input id="contact_phone" type="tel" value={form.contact_phone} onChange={setField('contact_phone')} maxLength={30} />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="instagram">Instagram</Label>
              <Input id="instagram" value={form.instagram} onChange={setField('instagram')} maxLength={60} placeholder="@seuclube" />
            </div>

            <Button type="submit" disabled={createClub.isPending || !isAuthenticated} className="bg-emerald-700 hover:bg-emerald-800">
              {createClub.isPending ? 'Criando…' : 'Criar clube'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
