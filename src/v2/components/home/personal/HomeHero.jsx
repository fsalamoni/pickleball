/**
 * O topo da tela inicial personalizada: quem é, o que tem hoje, o que a tela
 * está mostrando e onde mudar.
 *
 * - A frase é a AGENDA em uma linha (`frasePrincipal`) — e com a agenda
 *   incompleta ela não afirma "livre".
 * - "Seu início mostra: …" lista as frentes, cada uma com o motivo no título
 *   (passar o dedo/mouse explica), e o botão Personalizar abre a escolha.
 */
import React, { useMemo, useState } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { formatDateLongBR } from '@/modules/arenas/domain/calendar';
import { HOME_FOCUS_LABEL, focusReasonText } from '@/modules/home/domain/homeProfile';
import { countToday, mergeAgenda } from '@/modules/home/domain/homeAgenda';
import { diasAte } from '@/modules/home/domain/freshness';
import { frasePrincipal, saudacao } from '@/modules/home/domain/homeShortcuts';
import PersonalizeHomeDialog from './PersonalizeHomeDialog';

function Contador({ label, value, destaque = false }) {
  return (
    <div className={destaque ? 'rounded-3xl bg-acid p-4 text-ink' : 'rounded-3xl border border-white/10 bg-white/5 p-4 backdrop-blur-lg'}>
      <p className={destaque ? 'text-[11px] font-bold uppercase tracking-wide text-ink/70' : 'text-[11px] font-bold uppercase tracking-wide text-gray-400'}>{label}</p>
      <p className="mt-1 font-display text-3xl font-black leading-none">{value}</p>
    </div>
  );
}

export default function HomeHero({ nome, hoje, agora, agenda, foci = [], pendenciasExtras = 0 }) {
  const [personalizar, setPersonalizar] = useState(false);
  const itens = useMemo(() => mergeAgenda([agenda?.itens || []]), [agenda?.itens]);
  const acoes = itens.filter((i) => i.acao).length + (pendenciasExtras || 0);
  const frase = frasePrincipal({ agenda: itens, hoje, completa: !!agenda?.completa, acoes });
  const semana = itens.filter((i) => {
    const n = diasAte(i.dia, hoje);
    return n != null && n >= 0 && n <= 7;
  }).length;
  const sabe = !agenda?.carregando;
  const completa = !!agenda?.completa;
  // Contagem com fonte faltando é um piso, não o total — a tela diz "2+".
  const numero = (n) => (!sabe ? '…' : `${n}${completa ? '' : '+'}`);

  return (
    <section
      aria-label="Resumo do seu dia"
      className="relative mb-6 overflow-hidden rounded-4xl bg-mesh p-6 text-white shadow-organic sm:p-8"
    >
      <div className="pointer-events-none absolute -right-16 -top-16 h-72 w-72 rounded-full bg-acid opacity-20 blur-[90px]" aria-hidden="true" />
      <div className="relative z-10 grid gap-6 lg:grid-cols-[1.5fr_1fr] lg:items-end">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-acid">{formatDateLongBR(hoje)}</p>
          <h1 className="mt-2 font-display text-3xl font-bold tracking-tight sm:text-4xl">
            {saudacao(new Date(agora))}, {nome}
          </h1>
          <p className="mt-2 max-w-2xl text-base font-medium text-gray-300" aria-live="polite">
            {frase || 'Carregando o que você tem pela frente…'}
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Seu início mostra</span>
            {foci.slice(0, 6).map((f) => (
              <span
                key={f.focus}
                title={focusReasonText(f.reason)}
                className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-semibold text-white"
              >
                {HOME_FOCUS_LABEL[f.focus] || f.focus}
              </span>
            ))}
            <button
              type="button"
              onClick={() => setPersonalizar(true)}
              className="btn-press inline-flex items-center gap-1.5 rounded-full bg-white px-3.5 py-1.5 text-xs font-bold text-ink transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-acid/50"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" /> Personalizar
            </button>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Contador label="Hoje" value={numero(countToday(itens, hoje))} />
          <Contador label="Próx. 7 dias" value={numero(semana)} />
          <Contador label="Pedem ação" value={sabe ? acoes : '…'} destaque={sabe && acoes > 0} />
        </div>
      </div>
      <PersonalizeHomeDialog open={personalizar} onOpenChange={setPersonalizar} />
    </section>
  );
}
