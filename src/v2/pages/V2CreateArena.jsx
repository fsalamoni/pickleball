import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft } from 'lucide-react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useCreateArena } from '@/modules/arenas/hooks/useArenas';
import { V2Button, V2Field, V2Input, V2SectionHeader, V2Surface, V2Textarea, V2BackLink, V2Page, HERO_TITLE } from '@/v2/ui/primitives';
import { useRoleConsent } from '@/v2/components/legal/useRoleConsent';
import { t } from '@/core/i18n';

const INITIAL = {
  name: '', description: '', address: '', neighborhood: '', city: '', state: '',
  contact_phone: '', contact_whatsapp: '', contact_email: '', instagram: '', website: '',
  court_count: '', hours: '',
};

export default function V2CreateArena() {
  return <V2CreateArenaContent />;
}

function V2CreateArenaContent() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const createArena = useCreateArena();
  const [form, setForm] = useState(INITIAL);
  const [errors, setErrors] = useState({});
  const roleConsent = useRoleConsent('termos-arena');


  const set = (key) => (e) => setForm((prev) => ({ ...prev, [key]: e.target.value }));

  async function onSubmit(e) {
    e.preventDefault();
    const next = {};
    if (!form.name.trim()) next.name = 'Informe o nome da arena.';
    if (form.contact_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.contact_email.trim())) next.contact_email = t('Informe um e-mail válido.');
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    if (!isAuthenticated) { toast.error(t('Entre na plataforma para cadastrar uma arena.')); return; }
    if (!roleConsent.guardBeforeSubmit()) return;
    try {
      const id = await createArena.mutateAsync(form);
      await roleConsent.recordAfterSuccess();
      toast.success(t('Arena cadastrada! Vamos configurar o básico?'));
      navigate(`/arenas/${id}/onboarding`);
    } catch (err) {
      toast.error(err?.message || t('Não foi possível cadastrar a arena.'));
    }
  }

  return (
    <V2Page>
      <V2BackLink to="/arenas" className="mb-5">{t('Voltar às arenas')}</V2BackLink>

      <div className="relative mb-6 overflow-hidden rounded-4xl bg-mesh p-8 shadow-organic">
        <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-acid">{t('Nova arena')}</span>
        <h1 className={`mt-4 ${HERO_TITLE}`}>{t('Cadastre uma arena com contexto operacional claro.')}</h1>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-gray-300">{t('A arena passa a ter agenda, fotos, preços e canal de negociação com os atletas. Fotos e preços podem ser aprofundados logo após o cadastro.')}</p>
      </div>

      <V2Surface>
        <form onSubmit={onSubmit} className="space-y-6">
          <V2SectionHeader eyebrow={t('Identidade')} title={t('Dados da arena')} titleClassName="text-xl" />
          <div data-dica="arena-criar-nome">
            <V2Field label={t('Nome da arena')} required error={errors.name}>
              <V2Input value={form.name} onChange={set('name')} placeholder={t('Ex.: Arena Praia de Belas')} />
            </V2Field>
          </div>
          <V2Field label={t('Descrição')}>
            <V2Textarea value={form.description} onChange={set('description')} placeholder={t('Estrutura, quadras, diferenciais e regras da arena.')} />
          </V2Field>

          <V2SectionHeader eyebrow={t('Localização')} title={t('Onde fica')} titleClassName="text-xl" />
          <div data-dica="arena-criar-local" className="grid gap-4 sm:grid-cols-2">
            <V2Field label={t('Endereço')}><V2Input value={form.address} onChange={set('address')} /></V2Field>
            <V2Field label={t('Bairro')}><V2Input value={form.neighborhood} onChange={set('neighborhood')} /></V2Field>
            <V2Field label={t('Cidade')}><V2Input value={form.city} onChange={set('city')} /></V2Field>
            <V2Field label={t('UF')}><V2Input value={form.state} onChange={set('state')} maxLength={2} /></V2Field>
          </div>

          <V2SectionHeader eyebrow={t('Operação')} title={t('Quadras e horários')} titleClassName="text-xl" />
          <div data-dica="arena-criar-quadras" className="grid gap-4 sm:grid-cols-2">
            <V2Field label={t('Número de quadras')}><V2Input type="number" min="0" value={form.court_count} onChange={set('court_count')} /></V2Field>
            <V2Field label={t('Horário de funcionamento')} hint={t('Ex.: Seg a Sex 7h–22h, Sáb 8h–18h')}><V2Input value={form.hours} onChange={set('hours')} /></V2Field>
          </div>

          <V2SectionHeader eyebrow={t('Contato')} title={t('Como falar com a arena')} titleClassName="text-xl" />
          <div className="grid gap-4 sm:grid-cols-2">
            <V2Field label={t('Telefone')}><V2Input type="tel" value={form.contact_phone} onChange={set('contact_phone')} /></V2Field>
            <V2Field label={t('WhatsApp')}><V2Input type="tel" value={form.contact_whatsapp} onChange={set('contact_whatsapp')} /></V2Field>
            <V2Field label={t('E-mail')} error={errors.contact_email}><V2Input type="email" value={form.contact_email} onChange={set('contact_email')} /></V2Field>
            <V2Field label={t('Instagram')}><V2Input value={form.instagram} onChange={set('instagram')} placeholder="@suaarena" /></V2Field>
            <V2Field label={t('Site')} className="sm:col-span-2"><V2Input value={form.website} onChange={set('website')} placeholder="https://..." /></V2Field>
          </div>

          {roleConsent.field && <div className="pt-2">{roleConsent.field}</div>}

          <div className="flex justify-end gap-2 pt-2">
            <V2Button type="button" variant="ghost" onClick={() => navigate('/arenas')}>{t('Cancelar')}</V2Button>
            <V2Button type="submit" disabled={createArena.isPending} data-dica="arena-criar-enviar">
              {createArena.isPending ? t('Cadastrando…') : t('Cadastrar arena')}
            </V2Button>
          </div>
        </form>
      </V2Surface>
    </V2Page>
  );
}
