import React, { useState } from 'react';
import { Navigate, useNavigate, Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Building2, ArrowLeft, CalendarClock, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { PlatformFormSection, PlatformSurfaceCard } from '@/components/ui/platform-page';
import { useFeatureFlag } from '@/core/lib/FeatureFlagsContext';
import { FEATURE_FLAG } from '@/core/featureFlags';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import ProfileFields from '../components/ProfileFields.jsx';
import { useCreateArena } from '../hooks/useArenas.js';

const INITIAL = {
  name: '', description: '', address: '', neighborhood: '', city: '', state: '',
  contact_phone: '', contact_whatsapp: '', contact_email: '', instagram: '', website: '',
  court_count: '', hours: '',
};

export default function CreateArena() {
  const enabled = useFeatureFlag(FEATURE_FLAG.ARENAS);
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const createArena = useCreateArena();
  const [form, setForm] = useState(INITIAL);
  const [errors, setErrors] = useState({});

  if (!enabled) return <Navigate to="/inicio" replace />;

  const setField = (key) => (e) => setForm((prev) => ({ ...prev, [key]: e.target.value }));

  async function onSubmit(e) {
    e.preventDefault();
    const next = {};
    if (!form.name.trim()) next.name = 'Informe o nome da arena.';
    if (form.contact_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.contact_email.trim())) {
      next.contact_email = 'Informe um e-mail válido.';
    }
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    if (!isAuthenticated) {
      toast.error('Entre na plataforma para cadastrar uma arena.');
      return;
    }
    try {
      const id = await createArena.mutateAsync(form);
      toast.success('Arena cadastrada! Agora adicione fotos e preços.');
      navigate(`/arenas/${id}/gerir`);
    } catch (err) {
      toast.error(err?.message || 'Não foi possível cadastrar a arena.');
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Link to="/arenas" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> Voltar às arenas
      </Link>

      <section className="grid gap-6 xl:grid-cols-[1.02fr,0.98fr]">
        <Card className="bg-ink text-white overflow-hidden rounded-[1.25rem] border-0 sm:rounded-[2rem]">
          <CardContent className="p-5 sm:p-8 lg:p-10">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-paper-pure px-3 py-1 text-xs font-bold text-ink border-white/15 bg-white/10 text-white/70">
              <Sparkles className="h-3.5 w-3.5 text-white/70" /> Nova arena
            </span>
            <h1 className="mt-5 text-3xl font-semibold leading-tight text-white sm:text-4xl">
              Cadastre uma arena com contexto operacional claro para reservas e visibilidade.
            </h1>
            <p className="mt-4 text-sm leading-7 text-white/70 sm:text-base">
              A arena deixa de ser só um contato solto e passa a ter agenda, fotos, preços e canal de negociação com os atletas.
            </p>
          </CardContent>
        </Card>

        <PlatformSurfaceCard>
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-green-100 text-green-700">
              <CalendarClock className="h-4.5 w-4.5" />
            </div>
            <div>
              <div className="text-base font-semibold text-ink">O que você prepara aqui</div>
              <p className="mt-1 text-sm leading-6 text-gray-500">
                Dados públicos da arena, contato, horários e base para reservas. Fotos e preços podem ser aprofundados logo depois do cadastro.
              </p>
            </div>
          </div>
        </PlatformSurfaceCard>
      </section>

      <PlatformSurfaceCard contentClassName="p-5 sm:p-6">
          <form onSubmit={onSubmit} className="space-y-4">
            <PlatformFormSection
              icon={Building2}
              title="Dados da arena"
              description="Preencha o perfil que aparecerá para atletas, gestores e futuras solicitações de reserva."
            >
              <ProfileFields form={form} setField={setField} errors={errors} />
            </PlatformFormSection>
            <div className="flex justify-end">
              <Button type="submit" disabled={createArena.isPending}>
                {createArena.isPending ? 'Cadastrando…' : 'Cadastrar arena'}
              </Button>
            </div>
          </form>
      </PlatformSurfaceCard>
    </div>
  );
}
