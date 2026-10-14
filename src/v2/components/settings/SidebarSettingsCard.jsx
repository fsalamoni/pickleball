/**
 * Configurações → **Menu**: o que aparece na barra lateral (e na gaveta do
 * celular), e em que ordem. Três padrões — Atleta, Arena, Professor —
 * escolhidos sozinhos pelo papel e editáveis item a item.
 *
 * Os papéis saem do que a barra lateral já tem em cache (as arenas que a
 * pessoa gere, o perfil de professor): abrir Configurações não dispara
 * consulta nova. A escolha fica no navegador, por usuário — zero banco.
 */
import React, { useId, useMemo, useState } from 'react';
import {
  Building2, ChevronDown, ChevronUp, GraduationCap, HeartHandshake, LayoutDashboard, LayoutGrid, Lock, PanelLeft,
  RotateCcw, Swords, Trophy, User, Users,
} from 'lucide-react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useFeatureFlag } from '@/core/lib/FeatureFlagsContext';
import { FEATURE_FLAG } from '@/core/featureFlags';
import { cn } from '@/core/lib/utils';
import { useMyArenaSummary } from '@/modules/arenas/hooks/useMyArenaSummary';
import { useCoach } from '@/modules/coaches/hooks/useCoaches';
import {
  SIDEBAR_ITEM_META, SIDEBAR_PRESET, SIDEBAR_PRESET_META, hiddenSidebarItems, sidebarPresetAvailable,
} from '@/core/domain/sidebarNav';
import { useSidebarNav } from '@/core/lib/useSidebarNav';
import SettingsSection from './SettingsSection';

const ICONES = {
  inicio: LayoutGrid, jogar: Swords, competir: Trophy, comunidade: Users, arenas: Building2, ensino: GraduationCap,
  perfil: User, parceiros: HeartHandshake, 'minha-arena': LayoutDashboard, professor: GraduationCap, admin: LayoutDashboard,
};

function Interruptor({ ligado, onClick, labelledBy }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={ligado}
      aria-labelledby={labelledBy}
      onClick={onClick}
      className={cn(
        'relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors',
        'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-acid/40',
        ligado ? 'bg-acid' : 'bg-gray-200',
      )}
    >
      <span className={cn('inline-block h-5 w-5 rounded-full bg-[#fff] shadow transition-transform', ligado ? 'translate-x-6' : 'translate-x-1')} />
    </button>
  );
}

function BotaoMover({ direcao, label, ponta, onMover }) {
  const Icone = direcao < 0 ? ChevronUp : ChevronDown;
  return (
    <button
      type="button"
      aria-label={`${direcao < 0 ? 'Subir' : 'Descer'} “${label}”`}
      aria-disabled={ponta || undefined}
      onClick={() => { if (!ponta) onMover(direcao); }}
      className={cn(
        'flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border transition-colors sm:h-9 sm:w-9',
        'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-acid/30',
        ponta ? 'cursor-default border-transparent text-gray-300' : 'border-gray-100 text-gray-500 hover:border-gray-300 hover:text-ink',
      )}
    >
      <Icone className="h-4 w-4" aria-hidden="true" />
    </button>
  );
}

function Linha({ id, ligado, posicao, total, nome, onAlternar, onMover }) {
  const base = useId();
  const meta = SIDEBAR_ITEM_META[id];
  const Icone = ICONES[id] || LayoutGrid;
  const tituloId = `${base}-t`;
  const podeMover = posicao != null && id !== 'inicio';
  return (
    <li
      data-item-menu={id}
      className={cn(
        'flex items-center gap-2.5 rounded-3xl border p-3 sm:gap-3 sm:p-3.5',
        ligado ? 'border-gray-200 bg-paper-pure' : 'border-gray-100 bg-paper',
      )}
    >
      {posicao != null && (
        <span className="hidden w-5 shrink-0 text-center font-display text-sm font-bold tabular-nums text-gray-500 sm:block" aria-hidden="true">{posicao}</span>
      )}
      <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl sm:h-10 sm:w-10', ligado ? 'bg-ink text-acid' : 'bg-paper-pure text-gray-500')} aria-hidden="true">
        <Icone className="h-[18px] w-[18px] sm:h-5 sm:w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p id={tituloId} className="font-display text-sm font-bold leading-tight text-ink sm:text-base">{nome || meta.label}</p>
        <p className="mt-0.5 text-xs leading-snug text-gray-500">{meta.description}</p>
      </div>
      {podeMover && (
        <div className="flex shrink-0 flex-col gap-1 sm:flex-row">
          <BotaoMover direcao={-1} label={meta.label} ponta={posicao === 2} onMover={(d) => onMover(id, d)} />
          <BotaoMover direcao={1} label={meta.label} ponta={posicao === total} onMover={(d) => onMover(id, d)} />
        </div>
      )}
      {meta.fixo ? (
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-paper px-2.5 py-1 text-2xs font-bold text-gray-500" title="Este item fica sempre no menu">
          <Lock className="h-3 w-3" aria-hidden="true" /> Fixo
        </span>
      ) : (
        <Interruptor ligado={ligado} onClick={() => onAlternar(id)} labelledBy={tituloId} />
      )}
    </li>
  );
}

const ordinal = (n) => `${n}º`;

/** O seletor em si (também serve a quem quiser montá-lo noutro lugar). */
export function SidebarPicker({ papeis, nomes = {} }) {
  const { itens, preset, padrao, alternar, mover, aplicarPreset, restaurar } = useSidebarNav(papeis);
  const [aviso, setAviso] = useState('');
  const escondidos = useMemo(() => hiddenSidebarItems(itens, papeis), [itens, papeis]);
  const presets = Object.values(SIDEBAR_PRESET).filter((p) => sidebarPresetAvailable(p, papeis));

  const onAlternar = (id) => {
    const label = SIDEBAR_ITEM_META[id].label;
    const entra = !itens.includes(id);
    alternar(id);
    setAviso(entra ? `${label} entrou no menu.` : `${label} saiu do menu.`);
  };
  const onMover = (id, passo) => {
    mover(id, passo);
    setAviso(`${SIDEBAR_ITEM_META[id].label} agora é o ${ordinal(itens.indexOf(id) + 1 + passo)}.`);
  };
  const onPreset = (p) => {
    aplicarPreset(p);
    setAviso(`Menu no padrão ${SIDEBAR_PRESET_META[p].label}.`);
  };

  return (
    <div className="space-y-6">
      <p className="sr-only" aria-live="polite">{aviso}</p>

      <section aria-labelledby="menu-padroes" className="space-y-2">
        <h3 id="menu-padroes" className="px-1 text-2xs font-bold uppercase tracking-widest text-gray-500">Comece por um padrão</h3>
        <div className="grid gap-2 sm:grid-cols-3" role="group" aria-labelledby="menu-padroes">
          {presets.map((p) => {
            const ativo = preset === p && padrao;
            return (
              <button
                key={p}
                type="button"
                aria-pressed={ativo}
                onClick={() => onPreset(p)}
                className={cn(
                  'rounded-3xl border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-acid/30',
                  ativo ? 'border-ink bg-ink text-white' : 'border-gray-200 bg-paper-pure hover:border-ink/40',
                )}
              >
                <p className={cn('font-display text-sm font-bold', ativo ? 'text-acid' : 'text-ink')}>{SIDEBAR_PRESET_META[p].label}</p>
                <p className={cn('mt-0.5 text-xs leading-snug', ativo ? 'text-white/80' : 'text-gray-500')}>{SIDEBAR_PRESET_META[p].description}</p>
              </button>
            );
          })}
        </div>
        {presets.length === 1 && (
          <p className="px-1 text-xs text-gray-500">Os padrões Arena e Professor aparecem para quem gere uma arena ou dá aula.</p>
        )}
      </section>

      <section aria-labelledby="menu-ligados" className="space-y-2">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 px-1">
          <h3 id="menu-ligados" className="text-2xs font-bold uppercase tracking-widest text-gray-500">No seu menu, nesta ordem</h3>
          <p className="text-xs text-gray-500">{itens.length} {itens.length === 1 ? 'item' : 'itens'}</p>
        </div>
        <ol className="space-y-2">
          {itens.map((id, i) => (
            <Linha key={id} id={id} ligado posicao={i + 1} total={itens.length} nome={nomes[id]} onAlternar={onAlternar} onMover={onMover} />
          ))}
        </ol>
        {!padrao && (
          <button
            type="button"
            onClick={() => { restaurar(); setAviso('O menu voltou ao padrão do seu papel.'); }}
            className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-semibold text-gray-500 transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-acid/30"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" /> Restaurar o padrão
          </button>
        )}
      </section>

      {escondidos.length > 0 && (
        <section aria-labelledby="menu-escondidos" className="space-y-2">
          <h3 id="menu-escondidos" className="px-1 text-2xs font-bold uppercase tracking-widest text-gray-500">Para acrescentar</h3>
          <ul className="space-y-2">
            {escondidos.map((id) => (
              <Linha key={id} id={id} ligado={false} nome={nomes[id]} onAlternar={onAlternar} />
            ))}
          </ul>
        </section>
      )}

      <div className="flex items-start gap-2 rounded-3xl bg-paper p-4 text-xs leading-relaxed text-gray-500">
        <PanelLeft className="mt-0.5 h-4 w-4 shrink-0 text-gray-500" aria-hidden="true" />
        <p>
          Início e Minha área ficam sempre: é na Minha área que moram a sua arena, o painel do professor e estas configurações.
          O que você tirar do menu continua ao alcance por lá e pela busca (Ctrl K). A escolha fica salva neste aparelho, na sua conta.
        </p>
      </div>
    </div>
  );
}

export default function SidebarSettingsCard() {
  const { user, isPlatformAdmin } = useAuth();
  const { arenas } = useMyArenaSummary();
  const coach = useCoach(user?.uid).data;
  const mercado = useFeatureFlag(FEATURE_FLAG.MARKETPLACE);
  const papeis = useMemo(() => ({
    arenas: arenas.length > 0,
    professor: !!coach,
    admin: !!isPlatformAdmin,
    mercado,
  }), [arenas.length, coach, isPlatformAdmin, mercado]);
  const nomes = useMemo(() => (arenas.length === 1 ? { 'minha-arena': arenas[0].name || 'Minha arena' } : {}), [arenas]);

  const { itens, preset, padrao } = useSidebarNav(papeis);
  const resumo = `${itens.length} ${itens.length === 1 ? 'item' : 'itens'} · ${padrao ? `padrão ${SIDEBAR_PRESET_META[preset]?.label || ''}`.trim() : 'personalizado'}`;

  return (
    <SettingsSection id="menu-lateral" dica="config-menu" icon={PanelLeft} title="Menu" summary={resumo}>
      <p className="text-sm text-gray-500">
        O que aparece na barra lateral e na gaveta do celular, e em que ordem. Padrões para atleta, arena e professor — e o seu, por cima.
      </p>
      <div className="mt-5">
        <SidebarPicker papeis={papeis} nomes={nomes} />
      </div>
    </SettingsSection>
  );
}
