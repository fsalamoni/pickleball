/**
 * "Planos" da Central do clube: o que o clube oferece a quem quer se associar
 * (gratuito, mensal ou anual — a vontade da administração) e o Pix que recebe.
 * Plano não se apaga: pausa. Quem já está nele continua, e o histórico das
 * cobranças fica de pé.
 */
import React, { useState } from 'react';
import { toast } from 'sonner';
import { Pencil, Plus, Users } from 'lucide-react';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { EMPTY_PLAN, PLAN_BILLING, benefitLines, parseBrlCents, planPriceLabel, validatePix, validatePlan } from '@/modules/clubs/domain/association';
import { AssociationError } from '@/modules/clubs/services/associationService';
import { useAssociationAction, useClubPix, useSavePix, useSavePlan, useSetPlanActive } from '@/modules/clubs/hooks/useClubAssociation';
import { V2Badge, V2Button, V2EmptyState, V2ErrorState, V2Field, V2Input, V2Select, V2Skeleton, V2Surface, V2Textarea, V2Toggle } from '@/v2/ui/primitives';
import { podeAfirmarVazio } from '@/core/lib/queryState';
import { t } from '@/core/i18n';

function reaisDe(cents) {
  const n = Number(cents) || 0;
  return n ? (n / 100).toFixed(2).replace('.', ',') : '';
}

function PlanDialog({ open, onOpenChange, clubId, plan }) {
  const salvar = useSavePlan(clubId);
  const [f, setF] = useState(() => formDe(plan));
  const [erros, setErros] = useState({});
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));

  function enviar(e) {
    e.preventDefault();
    const cents = f.preco.trim() === '' ? 0 : parseBrlCents(f.preco);
    if (Number.isNaN(cents)) { setErros({ price_cents: t('Informe o valor em reais, por exemplo 120,00.') }); return; }
    const input = { ...f, price_cents: cents, benefits: f.benefits, discounts: { minor_pct: f.minor_pct, senior_pct: f.senior_pct } };
    const v = validatePlan(input);
    if (!v.ok) { setErros(v.errors); return; }
    setErros({});
    salvar.mutate({ planId: plan?.id || null, input }, {
      onSuccess: () => { toast.success(plan ? t('Plano atualizado.') : t('Plano criado.')); onOpenChange(false); },
      onError: (er) => { if (er instanceof AssociationError) setErros(er.fieldErrors); toast.error(er.message); },
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] max-w-lg overflow-y-auto" sheet>
        <DialogHeader>
          <DialogTitle>{plan ? t('Editar o plano') : t('Novo plano de associação')}</DialogTitle>
          <DialogDescription>{t('Valor zero é um plano gratuito. O valor é cobrado por mês ou por ano, como o clube preferir.')}</DialogDescription>
        </DialogHeader>
        <form onSubmit={enviar} className="space-y-4" noValidate>
          <V2Field label={t('Nome do plano')} htmlFor="plano-nome" error={erros.name} required>
            <V2Input id="plano-nome" value={f.name} maxLength={80} onChange={(e) => set('name', e.target.value)} placeholder={t('Ex.: Sócio, Sócio família, Juvenil')} />
          </V2Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <V2Field label={t('Valor (R$)')} htmlFor="plano-preco" error={erros.price_cents} hint={t('Em branco ou 0 = gratuito.')}>
              <V2Input id="plano-preco" inputMode="decimal" value={f.preco} onChange={(e) => set('preco', e.target.value)} placeholder="0,00" />
            </V2Field>
            <V2Field label={t('Cobrança')} htmlFor="plano-cobranca">
              <V2Select id="plano-cobranca" value={f.billing} onChange={(e) => set('billing', e.target.value)}>
                <option value={PLAN_BILLING.MONTHLY}>{t('Mensal')}</option>
                <option value={PLAN_BILLING.ANNUAL}>{t('Anual')}</option>
              </V2Select>
            </V2Field>
          </div>
          <V2Field label={t('Descrição curta')} htmlFor="plano-desc">
            <V2Textarea id="plano-desc" rows={2} maxLength={400} value={f.description} onChange={(e) => set('description', e.target.value)} />
          </V2Field>
          <V2Field label={t('Vantagens (uma por linha)')} htmlFor="plano-vantagens" hint={t('Aparecem como lista no cartão do plano. Até 10 linhas.')}>
            <V2Textarea id="plano-vantagens" rows={4} value={f.benefits} onChange={(e) => set('benefits', e.target.value)} placeholder={t('Quadra com desconto\nPrioridade nos eventos\nCupons exclusivos')} />
          </V2Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <V2Field label={t('Idade mínima')} htmlFor="plano-idade-min" error={erros.age}><V2Input id="plano-idade-min" inputMode="numeric" value={f.age_min} onChange={(e) => set('age_min', e.target.value)} /></V2Field>
            <V2Field label={t('Idade máxima')} htmlFor="plano-idade-max"><V2Input id="plano-idade-max" inputMode="numeric" value={f.age_max} onChange={(e) => set('age_max', e.target.value)} /></V2Field>
            <V2Field label={t('Desconto para menores de 18 (%)')} htmlFor="plano-menor"><V2Input id="plano-menor" inputMode="numeric" value={f.minor_pct} onChange={(e) => set('minor_pct', e.target.value)} /></V2Field>
            <V2Field label={t('Desconto a partir de 60 anos (%)')} htmlFor="plano-idoso"><V2Input id="plano-idoso" inputMode="numeric" value={f.senior_pct} onChange={(e) => set('senior_pct', e.target.value)} /></V2Field>
          </div>
          <V2Toggle id="plano-auto" checked={f.auto_approve} onChange={(v) => set('auto_approve', v)} label={t('Aprovar pedidos automaticamente')} hint={t('Desligado, a secretaria analisa cada pedido antes de gerar a cobrança.')} />
          <V2Toggle id="plano-publico" checked={f.public} onChange={(v) => set('public', v)} label={t('Aparece na página pública do clube')} hint={t('Desligado, o plano fica interno: só você associa as pessoas a ele.')} />
          <div className="flex justify-end gap-2">
            <V2Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>{t('Cancelar')}</V2Button>
            <V2Button type="submit" disabled={salvar.isPending}>{salvar.isPending ? t('Salvando…') : t('Salvar plano')}</V2Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function formDe(plan) {
  const p = { ...EMPTY_PLAN, ...(plan || {}) };
  return {
    name: p.name, description: p.description, category: p.category, preco: reaisDe(p.price_cents), billing: p.billing,
    benefits: benefitLines(p).join('\n'), public: p.public !== false, active: p.active !== false, auto_approve: p.auto_approve === true, votes: p.votes === true,
    age_min: p.age_min ?? '', age_max: p.age_max ?? '', minor_pct: p.discounts?.minor_pct || '', senior_pct: p.discounts?.senior_pct || '', sort: p.sort || 0,
  };
}

export function ClubPlansTab({ club, plansQ, canEdit, canAdopt = false }) {
  const [edicao, setEdicao] = useState(null); // null | 'novo' | plano
  const [pausar, setPausar] = useState(null);
  const ativar = useSetPlanActive(club.id);
  const adotar = useAssociationAction(club.id);
  const [adotarPlano, setAdotarPlano] = useState(null);
  const lista = [...(plansQ.data || [])].sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0) || (a.price_cents ?? 0) - (b.price_cents ?? 0));
  const gratuitos = lista.filter((p) => p.active !== false && !(p.price_cents > 0));

  return (
    <section className="space-y-4" aria-label={t('Planos de associação')} data-dica="clube-planos-gestao">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-xl text-sm text-gray-600">{t('Os planos públicos aparecem na página do clube para quem quer se associar. Plano pago gera cobrança Pix para a chave do clube.')}</p>
        {canEdit && <V2Button type="button" size="sm" onClick={() => setEdicao('novo')}><Plus className="h-4 w-4" />{t('Novo plano')}</V2Button>}
      </div>
      {plansQ.isLoading && <V2Skeleton lines={4} />}
      {plansQ.isError && <V2ErrorState title={t('Não carregaram os planos')} onRetry={() => plansQ.refetch()} />}
      {plansQ.isSuccess && podeAfirmarVazio(plansQ) && lista.length === 0 && (
        <V2Surface><V2EmptyState icon={Users} title={t('Nenhum plano ainda')} description={t('Crie ao menos um plano — pode ser gratuito — para o clube receber associados.')} action={canEdit ? <V2Button type="button" onClick={() => setEdicao('novo')}>{t('Criar o primeiro plano')}</V2Button> : null} /></V2Surface>
      )}
      {lista.length > 0 && (
        <ul className="grid gap-3 sm:grid-cols-2">
          {lista.map((p) => (
            <V2Surface as="li" key={p.id} variant="compacto" className="flex flex-col gap-2 p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-display text-lg font-bold text-ink">{p.name}</p>
                  <p className="text-sm font-semibold text-gray-700">{planPriceLabel(p)}</p>
                </div>
                <div className="flex flex-wrap justify-end gap-1">
                  {p.active === false && <V2Badge tone="neutral">{t('Pausado')}</V2Badge>}
                  {p.public === false && <V2Badge tone="neutral">{t('Interno')}</V2Badge>}
                  {p.auto_approve && <V2Badge tone="green">{t('Aprovação automática')}</V2Badge>}
                </div>
              </div>
              {p.description && <p className="text-sm text-gray-600">{p.description}</p>}
              {benefitLines(p).length > 0 && <p className="text-xs text-gray-500">{t('{n} vantagem(ns)', { n: benefitLines(p).length })}</p>}
              {canEdit && (
                <div className="mt-auto flex flex-wrap gap-2 pt-2">
                  <V2Button type="button" size="sm" variant="secondary" onClick={() => setEdicao(p)}><Pencil className="h-4 w-4" />{t('Editar')}</V2Button>
                  <V2Button type="button" size="sm" variant="ghost" onClick={() => (p.active === false ? ativar.mutate({ planId: p.id, active: true }, { onSuccess: () => toast.success(t('Plano reativado.')), onError: (er) => toast.error(er.message) }) : setPausar(p))}>
                    {p.active === false ? t('Reativar') : t('Pausar')}
                  </V2Button>
                </div>
              )}
            </V2Surface>
          ))}
        </ul>
      )}
      {canAdopt && gratuitos.length > 0 && (
        <V2Surface variant="compacto" className="flex flex-wrap items-center justify-between gap-3 p-4">
          <p className="max-w-xl text-sm text-gray-700">{t('Quer que todos os membros atuais do clube já sejam associados? Aplique um plano gratuito a quem ainda não tem filiação (até 200 por vez).')}</p>
          <V2Select aria-label={t('Plano gratuito para aplicar')} className="max-w-xs" defaultValue="" onChange={(e) => e.target.value && setAdotarPlano(gratuitos.find((p) => p.id === e.target.value))}>
            <option value="">{t('Aplicar um plano gratuito…')}</option>
            {gratuitos.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </V2Select>
        </V2Surface>
      )}

      {edicao && <PlanDialog key={edicao === 'novo' ? 'novo' : edicao.id} open onOpenChange={(o) => { if (!o) setEdicao(null); }} clubId={club.id} plan={edicao === 'novo' ? null : edicao} />}
      <ConfirmDialog
        open={Boolean(pausar)}
        onOpenChange={(o) => { if (!o) setPausar(null); }}
        title={t('Pausar o plano?')}
        description={t('Ele some da página do clube e ninguém novo entra. Quem já está nele continua associado e pode renovar.')}
        confirmLabel={t('Pausar plano')}
        onConfirm={() => { ativar.mutate({ planId: pausar.id, active: false }, { onSuccess: () => toast.success(t('Plano pausado.')), onError: (er) => toast.error(er.message) }); setPausar(null); }}
      />
      <ConfirmDialog
        open={Boolean(adotarPlano)}
        onOpenChange={(o) => { if (!o) setAdotarPlano(null); }}
        title={t('Associar todos os membros?')}
        description={t('Quem é do clube e ainda não tem filiação entra no plano "{plano}", sem cobrança, e recebe número e carteirinha.', { plano: adotarPlano?.name || '' })}
        confirmLabel={t('Associar todos')}
        loading={adotar.isPending}
        onConfirm={() => adotar.mutate({ action: 'adopt', planId: adotarPlano.id }, {
          onSuccess: (r) => { toast.success(r?.remaining ? t('{n} associados. Ainda faltam {m}: aplique de novo.', { n: r.adopted, m: r.remaining }) : t('{n} membros foram associados.', { n: r?.adopted || 0 })); setAdotarPlano(null); },
          onError: (er) => toast.error(er.message),
        })}
      />
    </section>
  );
}

export function ClubPixTab({ club }) {
  const pixQ = useClubPix(club.id);
  const salvar = useSavePix(club.id);
  const [f, setF] = useState(null);
  const [erros, setErros] = useState({});
  const atual = f || { pix_key: pixQ.data?.pix_key || '', receiver_name: pixQ.data?.receiver_name || club.name || '', instructions: pixQ.data?.instructions || '', key_type: pixQ.data?.key_type || '' };
  const set = (k, v) => setF({ ...atual, [k]: v });

  if (pixQ.isLoading) return <V2Skeleton lines={4} />;
  if (pixQ.isError) return <V2ErrorState title={t('Não carregou o Pix do clube')} onRetry={() => pixQ.refetch()} />;

  function enviar(e) {
    e.preventDefault();
    const v = validatePix(atual);
    if (!v.ok) { setErros(v.errors); return; }
    setErros({});
    salvar.mutate(atual, { onSuccess: () => { toast.success(t('Pix do clube salvo.')); setF(null); }, onError: (er) => toast.error(er.message) });
  }

  return (
    <section className="space-y-4" aria-label={t('Pix do clube')} data-dica="clube-pix">
      <p className="max-w-2xl text-sm text-gray-600">{t('O dinheiro das associações vai direto para a chave do clube: a plataforma não toca no valor. Cada cobrança leva uma cópia desta chave, para o associado pagar pelo app do banco.')}</p>
      <V2Surface>
        <form onSubmit={enviar} className="space-y-4" noValidate>
          <V2Field label={t('Chave Pix')} htmlFor="pix-chave" error={erros.pix_key} required hint={t('CPF, CNPJ, e-mail, telefone ou chave aleatória.')}>
            <V2Input id="pix-chave" value={atual.pix_key} maxLength={140} onChange={(e) => set('pix_key', e.target.value)} autoComplete="off" />
          </V2Field>
          <V2Field label={t('Nome de quem recebe')} htmlFor="pix-nome" error={erros.receiver_name} required>
            <V2Input id="pix-nome" value={atual.receiver_name} maxLength={60} onChange={(e) => set('receiver_name', e.target.value)} />
          </V2Field>
          <V2Field label={t('Instruções para quem paga (opcional)')} htmlFor="pix-instrucoes" hint={t('Aparecem junto do Pix. Ex.: "Depois de pagar, toque em Já paguei."')}>
            <V2Textarea id="pix-instrucoes" rows={3} maxLength={500} value={atual.instructions} onChange={(e) => set('instructions', e.target.value)} />
          </V2Field>
          <div className="flex justify-end"><V2Button type="submit" disabled={salvar.isPending}>{salvar.isPending ? t('Salvando…') : t('Salvar Pix')}</V2Button></div>
        </form>
      </V2Surface>
    </section>
  );
}
