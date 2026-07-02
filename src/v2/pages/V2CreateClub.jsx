import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft } from 'lucide-react';
import { ImageUpload } from '@/components/ui/image-upload';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useCreateClub } from '@/modules/clubs/hooks/useClubs';
import { V2Button, V2Field, V2Input, V2SectionHeader, V2Surface, V2Textarea } from '@/v2/ui/primitives';

const INITIAL = {
  name: '', description: '', city: '', state: '', home_venue: '',
  contact_email: '', contact_phone: '', instagram: '', logo_url: '',
};

export default function V2CreateClub() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const createClub = useCreateClub();
  const [form, setForm] = useState(INITIAL);
  const [errors, setErrors] = useState({});

  const set = (key) => (e) => setForm((prev) => ({ ...prev, [key]: e.target.value }));

  async function onSubmit(e) {
    e.preventDefault();
    const next = {};
    if (!form.name.trim()) next.name = 'Informe o nome do clube.';
    if (form.contact_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.contact_email.trim())) next.contact_email = 'Informe um e-mail válido.';
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    try {
      const id = await createClub.mutateAsync(form);
      toast.success('Clube criado com sucesso!');
      navigate(`/v2/clubes/${id}`);
    } catch (err) {
      toast.error(err.message || 'Não foi possível criar o clube.');
    }
  }

  return (
    <div className="mx-auto max-w-[1000px]">
      <Link to="/v2/clubes" className="mb-5 inline-flex items-center gap-1.5 text-sm font-semibold text-gray-500 hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> Voltar para clubes
      </Link>

      <div className="relative mb-6 overflow-hidden rounded-4xl bg-mesh p-8 shadow-organic">
        <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-acid">Novo clube</span>
        <h1 className="mt-4 font-display text-3xl font-bold text-white sm:text-4xl">Crie seu clube e reúna a turma.</h1>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-gray-300">Você será o administrador e poderá convidar atletas por código. Ao criar, libera mural, eventos, fórum e gestão compartilhada.</p>
      </div>

      <V2Surface>
        {!isAuthenticated && (
          <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            Você precisa estar autenticado para criar um clube.
          </div>
        )}
        <form onSubmit={onSubmit} className="space-y-6">
          <V2SectionHeader eyebrow="Identidade" title="Dados do clube" titleClassName="text-xl" />

          <V2Field label="Logo / imagem do clube" hint="Aparece no diretório e na página do clube.">
            <ImageUpload
              value={form.logo_url}
              onChange={(url) => setForm((prev) => ({ ...prev, logo_url: url }))}
              folder="clubs"
              shape="square"
              label="Enviar logo"
            />
          </V2Field>

          <V2Field label="Nome do clube" required error={errors.name}>
            <V2Input value={form.name} onChange={set('name')} maxLength={80} />
          </V2Field>

          <V2Field label="Descrição">
            <V2Textarea value={form.description} onChange={set('description')} maxLength={1000} placeholder="Conte sobre o clube, horários de jogo, ambiente, valores…" />
          </V2Field>

          <div className="grid gap-4 sm:grid-cols-[1fr,120px]">
            <V2Field label="Cidade"><V2Input value={form.city} onChange={set('city')} maxLength={60} /></V2Field>
            <V2Field label="UF"><V2Input value={form.state} onChange={set('state')} maxLength={2} placeholder="SP" /></V2Field>
          </div>

          <V2Field label="Local / quadra principal"><V2Input value={form.home_venue} onChange={set('home_venue')} maxLength={120} /></V2Field>

          <V2SectionHeader eyebrow="Contato" title="Como falar com o clube" titleClassName="text-xl" />
          <div className="grid gap-4 sm:grid-cols-2">
            <V2Field label="E-mail de contato" error={errors.contact_email}><V2Input type="email" value={form.contact_email} onChange={set('contact_email')} maxLength={120} /></V2Field>
            <V2Field label="Telefone de contato"><V2Input type="tel" value={form.contact_phone} onChange={set('contact_phone')} maxLength={30} /></V2Field>
            <V2Field label="Instagram" className="sm:col-span-2"><V2Input value={form.instagram} onChange={set('instagram')} maxLength={60} placeholder="@seuclube" /></V2Field>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <V2Button type="button" variant="ghost" onClick={() => navigate('/v2/clubes')}>Cancelar</V2Button>
            <V2Button type="submit" disabled={createClub.isPending || !isAuthenticated}>
              {createClub.isPending ? 'Criando…' : 'Criar clube'}
            </V2Button>
          </div>
        </form>
      </V2Surface>
    </div>
  );
}
