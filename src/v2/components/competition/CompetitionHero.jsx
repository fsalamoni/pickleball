/**
 * As peças de MOLDURA que o torneio e a liga dividem (pedido do Flavio,
 * 2026-11-14: "as duas funcionalidades o mais semelhantes possível, com as
 * mesmas ferramentas"). Cada uma é só desenho: quem decide o que entra é a
 * tela de cada módulo, que segue sem importar nada do outro.
 *
 * - `CompetitionHero`: a capa (ícone, nome, descrição, selos, três fatos, a
 *   linha de prazos e as ações).
 * - `CompetitionAdminHeader` + `CompetitionAdminHub`: o topo da página de
 *   gestão (`/torneios/:id/gerenciar` e `/ligas/:id/gerenciar`).
 * - `HERO_CHIP`, `HERO_ACTION`, `HERO_ACTION_PRIMARY`: as classes dos selos e
 *   dos botões em cima da capa escura.
 */
import React from 'react';
import { MapPin, ShieldAlert, ShieldCheck, Sparkles } from 'lucide-react';
import { t } from '@/core/i18n';
import { cn } from '@/core/lib/utils';
import { HERO_TITLE, V2Badge } from '@/v2/ui/primitives';

export const HERO_CHIP = 'rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-bold text-white';
export const HERO_CHIP_ACID = 'rounded-full bg-acid px-3 py-1 text-xs font-bold text-ink';
export const HERO_ACTION = 'btn-press inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white coarse:min-h-11';
export const HERO_ACTION_PRIMARY = 'btn-press inline-flex items-center gap-2 rounded-full bg-acid px-4 py-2 text-sm font-bold text-ink coarse:min-h-11';

/** O selo "Admin" da capa, para quem organiza. */
export function HeroAdminChip() {
  return <span className={HERO_CHIP_ACID}><ShieldCheck className="mr-1 inline h-3 w-3" aria-hidden="true" /> {t('Admin')}</span>;
}

export function HeroFact({ icon: Icon, label, value }) {
  return (
    <div className="rounded-2.5xl border border-white/10 bg-white/10 p-4 backdrop-blur-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="text-2xs font-bold uppercase tracking-widest text-white/60">{label}</span>
        <Icon className="h-4 w-4 text-white/70" aria-hidden="true" />
      </div>
      <p className="mt-2 text-sm font-medium text-white">{value}</p>
    </div>
  );
}

/**
 * @param {{
 *   icon: React.ComponentType<any>,
 *   title: React.ReactNode,
 *   description?: React.ReactNode,
 *   chips?: React.ReactNode,
 *   facts?: Array<{ icon: React.ComponentType<any>, label: string, value: React.ReactNode }>,
 *   note?: React.ReactNode,
 *   actions?: React.ReactNode,
 * }} props
 */
export function CompetitionHero({ icon: Icon, title, description, chips, facts = [], note, actions }) {
  return (
    <div className="relative overflow-hidden rounded-4xl bg-mesh p-6 shadow-organic sm:p-8">
      <div className="absolute -right-10 -top-10 h-64 w-64 rounded-full bg-acid opacity-20 blur-[80px]" />
      <div className="relative z-10">
        <div className="flex flex-wrap items-start gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 text-white backdrop-blur-sm"><Icon className="h-6 w-6" aria-hidden="true" /></div>
          <div className="min-w-0 flex-1">
            <h1 className={HERO_TITLE}>{title}</h1>
            {description && <p className="mt-2 max-w-2xl text-sm leading-7 text-gray-300">{description}</p>}
          </div>
        </div>

        {chips && <div className="mt-6 flex flex-wrap items-center gap-2">{chips}</div>}

        {facts.length > 0 && (
          <div className={cn('mt-6 grid gap-3', facts.length >= 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2')}>
            {facts.map((f) => <HeroFact key={f.label} {...f} />)}
          </div>
        )}
        {note}

        {actions && <div className="mt-6 flex flex-wrap gap-2">{actions}</div>}
      </div>
    </div>
  );
}

function PreviewFact({ icon: Icon, label, value }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-2xs font-bold uppercase tracking-widest text-white/50">{label}</span>
        <Icon className="h-3.5 w-3.5 text-white/60" aria-hidden="true" />
      </div>
      <p className="mt-1.5 truncate text-xs font-semibold text-white">{value}</p>
    </div>
  );
}

/**
 * A capa da CRIAÇÃO (a coluna da esquerda do assistente): selo, frase, texto,
 * o que vier em `children` (o tutorial, um atalho) e a prévia que se atualiza
 * enquanto a pessoa preenche.
 * @param {{
 *   eyebrow: string, title: string, description: React.ReactNode, children?: React.ReactNode,
 *   preview: { name: string, description: string, location: string, facts: Array<{ icon: React.ComponentType<any>, label: string, value: string }> },
 * }} props
 */
export function CompetitionCreateHero({ eyebrow, title, description, children, preview }) {
  return (
    <div className="relative overflow-hidden rounded-4xl bg-mesh p-6 shadow-organic sm:p-8">
      <div className="absolute -right-10 -top-10 h-56 w-56 rounded-full bg-acid opacity-20 blur-[80px]" />
      <div className="relative z-10">
        <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-acid">{eyebrow}</span>
        <h1 className={`mt-4 ${HERO_TITLE}`}>{title}</h1>
        <p className="mt-3 max-w-xl text-sm leading-7 text-gray-300">{description}</p>
        {children && <div className="mt-5">{children}</div>}

        <div className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur-lg">
          <div className="text-2xs font-bold uppercase tracking-widest text-acid">{t('Prévia do evento')}</div>
          <div className="mt-2 font-display text-2xl font-bold text-white">{preview.name}</div>
          <p className="mt-2 text-sm leading-6 text-gray-300">{preview.description}</p>
          <div className="mt-4 flex items-center gap-2 text-sm text-gray-300"><MapPin className="h-4 w-4 text-acid" aria-hidden="true" /> {preview.location}</div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            {preview.facts.map((f) => <PreviewFact key={f.label} {...f} />)}
          </div>
        </div>
      </div>
    </div>
  );
}

/** O cabeçalho compacto da página de gestão: o que é, o nome, a situação e as saídas. */
export function CompetitionAdminHeader({ kicker, title, status, children }) {
  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-paper-pure p-4">
      <div className="min-w-0">
        <div className="flex items-center gap-2 text-2xs font-bold uppercase tracking-widest text-gray-500">
          <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" /> {kicker}
        </div>
        <h1 className="mt-0.5 truncate font-display text-xl font-bold text-ink">{title}</h1>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {status && <V2Badge tone="neutral">{status}</V2Badge>}
        {children}
      </div>
    </div>
  );
}

/** A faixa escura do topo da gestão ("Hub administrativo · Somente admins"). */
export function CompetitionAdminHub({ title, description }) {
  return (
    <div className="relative overflow-hidden rounded-4xl bg-ink p-6 shadow-organic sm:p-8">
      <div className="absolute -right-10 -top-10 h-56 w-56 rounded-full bg-acid opacity-20 blur-[80px]" />
      <div className="relative z-10 max-w-3xl">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/10 px-3 py-1 font-display text-xs font-bold uppercase tracking-widest text-acid">
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" /> {t('Hub administrativo')}
          </span>
          <V2Badge tone="amber">{t('Somente admins')}</V2Badge>
        </div>

        <div className="mt-5 flex items-start gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-white backdrop-blur-sm">
            <ShieldAlert className="h-6 w-6" aria-hidden="true" />
          </div>
          <div>
            <h2 className="font-display text-2xl font-bold leading-tight text-white sm:text-3xl">{title}</h2>
            <p className="mt-3 text-sm leading-7 text-white/60 sm:text-base">{description}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
