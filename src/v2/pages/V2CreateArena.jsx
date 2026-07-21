import React, { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft } from 'lucide-react';
import { useFeatureFlag } from '@/core/lib/FeatureFlagsContext';
import { FEATURE_FLAG } from '@/core/featureFlags';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useCreateArena } from '@/modules/arenas/hooks/useArenas';
import { V2Button, V2Field, V2Input, V2SectionHeader, V2Surface, V2Textarea } from '@/v2/ui/primitives';

const INITIAL = {
  name: '', description: '', address: '', neighborhood: '', city: '', state: '',
  contact_phone: '', contact_whatsapp: '', contact_email: '', instagram: '', website: '',
  court_count: '', hours: '',
};

export default function V2CreateArena() {
  const enabled = useFeatureFlag(FEATURE_FLAG.ARENAS);
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const createArena = useCreateArena();
  const [form, setForm] = useState(INITIAL);
  const [errors, setErrors] = useState({});

  if (!enabled) return <Navigate to="/" replace />;

  const set = (key) => (e) => setForm((prev) => ({ ...prev, [key]: e.target.value }));

  async function onSubmit(e) {
    e.preventDefault();
    const next = {};
    if (!form.name.trim()) next.name = 'Informe o nome da arena.';
    if (form.contact_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.contact_email.trim())) next.contact_email = 'Informe um e-mail válido.';
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    if (!isAuthenticated) { toast.error('Entre na plataforma para cadastrar uma arena.'); return; }
    try {
      const id = await createArena.mutateAsync(form);
      toast.success('Arena cadastrada! Vamos configurar o básico?');
      navigate(`/arenas/${id}/onboarding`);
    } catch (err) {
      toast.error(err?.message || 'Não foi possível cadastrar a arena.');
    }
  }

  return (
    <div className="mx-auto max-w-[1000px]">
      <Link to="/arenas" className="mb-5 inline-flex items-center gap-1.5 text-sm font-semibold text-gray-500 hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> Voltar às arenas
      </Link>

      <div className="relative mb-6 overflow-hidden rounded-4xl bg-mesh p-8 shadow-organic">
        <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-acid">Nova arena</span>
        <h1 className="mt-4 font-display text-3xl font-bold text-white sm:text-4xl">Cadastre uma arena com contexto operacional claro.</h1>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-gray-300">A arena passa a ter agenda, fotos, preços e canal de negociação com os atletas. Fotos e preços podem ser aprofundados logo após o cadastro.</p>
      </div>

      <V2Surface>
        <form onSubmit={onSubmit} className="space-y-6">
          <V2SectionHeader eyebrow="Identidade" title="Dados da arena" titleClassName="text-xl" />
          <V2Field label="Nome da arena" required error={errors.name}>
            <V2Input value={form.name} onChange={set('name')} placeholder="Ex.: Arena Praia de Belas" />
          </V2Field>
          <V2Field label="Descrição">
            <V2Textarea value={form.description} onChange={set('description')} placeholder="Estrutura, quadras, diferenciais e regras da arena." />
          </V2Field>

          <V2SectionHeader eyebrow="Localização" title="Onde fica" titleClassName="text-xl" />
          <div className="grid gap-4 sm:grid-cols-2">
            <V2Field label="Endereço"><V2Input value={form.address} onChange={set('address')} /></V2Field>
            <V2Field label="Bairro"><V2Input value={form.neighborhood} onChange={set('neighborhood')} /></V2Field>
            <V2Field label="Cidade"><V2Input value={form.city} onChange={set('city')} /></V2Field>
            <V2Field label="UF"><V2Input value={form.state} onChange={set('state')} maxLength={2} /></V2Field>
          </div>

          <V2SectionHeader eyebrow="Operação" title="Quadras e horários" titleClassName="text-xl" />
          <div className="grid gap-4 sm:grid-cols-2">
            <V2Field label="Número de quadras"><V2Input type="number" min="0" value={form.court_count} onChange={set('court_count')} /></V2Field>
            <V2Field label="Horário de funcionamento" hint="Ex.: Seg a Sex 7h–22h, Sáb 8h–18h"><V2Input value={form.hours} onChange={set('hours')} /></V2Field>
          </div>

          <V2SectionHeader eyebrow="Contato" title="Como falar com a arena" titleClassName="text-xl" />
          <div className="grid gap-4 sm:grid-cols-2">
            <V2Field label="Telefone"><V2Input type="tel" value={form.contact_phone} onChange={set('contact_phone')} /></V2Field>
            <V2Field label="WhatsApp"><V2Input type="tel" value={form.contact_whatsapp} onChange={set('contact_whatsapp')} /></V2Field>
            <V2Field label="E-mail" error={errors.contact_email}><V2Input type="email" value={form.contact_email} onChange={set('contact_email')} /></V2Field>
            <V2Field label="Instagram"><V2Input value={form.instagram} onChange={set('instagram')} placeholder="@suaarena" /></V2Field>
            <V2Field label="Site" className="sm:col-span-2"><V2Input value={form.website} onChange={set('website')} placeholder="https://..." /></V2Field>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <V2Button type="button" variant="ghost" onClick={() => navigate('/arenas')}>Cancelar</V2Button>
            <V2Button type="submit" disabled={createArena.isPending}>
              {createArena.isPending ? 'Cadastrando…' : 'Cadastrar arena'}
            </V2Button>
          </div>
        </form>
      </V2Surface>
    </div>
  );
}
