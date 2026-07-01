import React, { useState } from 'react';
import { Navigate, useNavigate, Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Building2, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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
    <div className="mx-auto max-w-2xl space-y-4">
      <Link to="/arenas" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft className="h-4 w-4" /> Voltar às arenas
      </Link>
      <Card>
        <CardContent className="p-5">
          <div className="mb-4 flex items-center gap-2">
            <Building2 className="h-5 w-5 text-emerald-600" />
            <h1 className="text-lg font-semibold arena-heading">Cadastrar arena</h1>
          </div>
          <form onSubmit={onSubmit} className="space-y-4">
            <ProfileFields form={form} setField={setField} errors={errors} />
            <div className="flex justify-end">
              <Button type="submit" disabled={createArena.isPending}>
                {createArena.isPending ? 'Cadastrando…' : 'Cadastrar arena'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
