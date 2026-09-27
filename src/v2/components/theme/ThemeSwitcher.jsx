/**
 * O seletor de APARÊNCIA — Claro, Escuro, Automático — nos três lugares onde
 * a pessoa procura por ele:
 *
 *  - `ThemeMenuSection`: no menu do usuário (o avatar, no computador). O menu
 *    NÃO fecha ao escolher: a página troca por trás dele, e a pessoa vê o
 *    resultado antes de decidir se fica;
 *  - `ThemeDrawerSwitcher`: na gaveta do celular (onde o menu do avatar não
 *    existe), sobre o véu escuro da gaveta;
 *  - `ThemeSettingsCard`: em Configurações, com uma MINIATURA da plataforma em
 *    cada modo — escolher aparência pelo nome é adivinhar; pela imagem, é ver.
 *
 * Todos somem quando o escuro não está disponível (flag desligada) — nenhuma
 * opção que não faz nada. A escolha é de cada usuário e fica no aparelho
 * (`core/theme/themePreference.js`); nada vai ao banco.
 */
import React, { useId, useRef } from 'react';
import { Check, Moon, Palette, Sun, SunMoon } from 'lucide-react';
import { cn } from '@/core/lib/utils';
import { useTheme } from '@/core/lib/ThemeContext';
import { OPCOES_DE_TEMA, TEMA } from '@/core/theme/themePreference';
import {
  DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { V2Surface } from '@/v2/ui/primitives';

/** O ícone de cada aparência. */
export const ICONE_DO_TEMA = Object.freeze({
  [TEMA.CLARO]: Sun,
  [TEMA.ESCURO]: Moon,
  [TEMA.AUTOMATICO]: SunMoon,
});

/**
 * Teclado de um grupo de rádio (padrão WAI-ARIA): as setas movem E escolhem,
 * Home/End vão às pontas, e só o item escolhido entra no Tab.
 */
function useTecladoDoGrupo(escolha, setEscolha) {
  const refs = useRef([]);
  const valores = OPCOES_DE_TEMA.map((o) => o.valor);
  const aoTeclar = (evento, indice) => {
    const passo = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[evento.key];
    let alvo = null;
    if (passo) alvo = (indice + passo + valores.length) % valores.length;
    else if (evento.key === 'Home') alvo = 0;
    else if (evento.key === 'End') alvo = valores.length - 1;
    if (alvo === null) return;
    evento.preventDefault();
    refs.current[alvo]?.focus();
    if (valores[alvo] !== escolha) setEscolha(valores[alvo]);
  };
  return { refs, aoTeclar };
}

/** No menu do usuário: um controle segmentado de três. */
export function ThemeMenuSection() {
  const { disponivel, escolha, setEscolha } = useTheme();
  if (!disponivel) return null;
  return (
    <>
      <DropdownMenuSeparator />
      <DropdownMenuLabel className="px-2 pb-1 pt-1.5 text-[11px] font-bold uppercase tracking-widest text-gray-500">
        Aparência
      </DropdownMenuLabel>
      <DropdownMenuRadioGroup
        value={escolha}
        onValueChange={setEscolha}
        aria-label="Aparência"
        className="grid grid-cols-3 gap-1 px-1 pb-1"
      >
        {OPCOES_DE_TEMA.map(({ valor, rotulo }) => {
          const Icone = ICONE_DO_TEMA[valor];
          return (
            <DropdownMenuRadioItem
              key={valor}
              value={valor}
              // Não fecha: a página troca por trás do menu, e a pessoa compara.
              onSelect={(e) => e.preventDefault()}
              className={cn(
                'flex cursor-pointer flex-col items-center gap-1 rounded-xl px-1 py-2 text-[11px] font-semibold text-gray-500',
                'focus:bg-transparent focus:text-gray-500',
                'data-[state=unchecked]:data-[highlighted]:bg-gray-50 data-[state=unchecked]:data-[highlighted]:text-ink',
                // Marcado: o mesmo "ativo" da barra lateral (ink, ícone ácido).
                'data-[state=checked]:bg-ink data-[state=checked]:text-white [&[data-state=checked]_svg]:text-acid',
                'data-[state=checked]:data-[highlighted]:ring-2 data-[state=checked]:data-[highlighted]:ring-acid/60',
              )}
            >
              <Icone className="h-4 w-4" aria-hidden />
              {rotulo}
            </DropdownMenuRadioItem>
          );
        })}
      </DropdownMenuRadioGroup>
    </>
  );
}

/** Na gaveta do celular (fundo escuro, sempre): segmentado sobre o véu. */
export function ThemeDrawerSwitcher() {
  const { disponivel, escolha, setEscolha } = useTheme();
  const rotuloId = useId();
  const { refs, aoTeclar } = useTecladoDoGrupo(escolha, setEscolha);
  if (!disponivel) return null;
  return (
    <div className="px-4 pb-3 pt-1">
      <p id={rotuloId} className="mb-2 text-[11px] font-bold uppercase tracking-widest text-white/40">Aparência</p>
      <div role="radiogroup" aria-labelledby={rotuloId} className="grid grid-cols-3 gap-1 rounded-2xl bg-white/10 p-1">
        {OPCOES_DE_TEMA.map(({ valor, rotulo }, i) => {
          const Icone = ICONE_DO_TEMA[valor];
          const marcado = escolha === valor;
          return (
            <button
              key={valor}
              ref={(el) => { refs.current[i] = el; }}
              type="button"
              role="radio"
              aria-checked={marcado}
              tabIndex={marcado ? 0 : -1}
              onClick={() => setEscolha(valor)}
              onKeyDown={(e) => aoTeclar(e, i)}
              className={cn(
                // Ícone em cima do nome: numa gaveta de 390px, "Automático" ao
                // lado do ícone não cabe no terço da largura.
                'flex min-h-[52px] flex-col items-center justify-center gap-1 rounded-xl px-1 text-xs font-semibold outline-none transition-colors',
                'focus-visible:ring-2 focus-visible:ring-acid',
                marcado ? 'bg-acid text-ink' : 'text-white/70 hover:bg-white/10 hover:text-white',
              )}
            >
              <Icone className="h-4 w-4 shrink-0" aria-hidden />
              {rotulo}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Uma miniatura da plataforma — barra lateral, destaque, cartões — desenhada
 * com as MESMAS classes das telas. Por isso ela mostra o modo de verdade:
 * dentro de `.dark` sai o escuro, dentro de `.tema-claro` sai o claro, e
 * qualquer ajuste na paleta aparece aqui sozinho.
 */
function MiniPlataforma() {
  return (
    <span className="flex h-full w-full bg-paper">
      <span className="flex w-[26%] flex-col gap-1.5 border-r border-gray-100 bg-paper-pure p-1.5">
        <span className="block h-2.5 w-2.5 rounded-full bg-acid" />
        <span className="mt-0.5 block h-1.5 w-full rounded-full bg-ink" />
        <span className="block h-1 w-4/5 rounded-full bg-gray-200" />
        <span className="block h-1 w-3/5 rounded-full bg-gray-200" />
        <span className="block h-1 w-4/5 rounded-full bg-gray-200" />
      </span>
      <span className="flex flex-1 flex-col gap-1.5 p-1.5">
        <span className="flex flex-col gap-1 rounded-md bg-ink p-1.5">
          <span className="block h-1.5 w-1/2 rounded-full bg-acid" />
          <span className="block h-1 w-3/4 rounded-full bg-white/40" />
        </span>
        <span className="flex flex-col gap-1 rounded-md border border-gray-100 bg-white p-1.5 shadow-organic-sm">
          <span className="block h-1.5 w-2/3 rounded-full bg-current text-ink" />
          <span className="block h-1 w-full rounded-full bg-current text-gray-300" />
          <span className="mt-0.5 flex gap-1">
            <span className="block h-2 w-6 rounded-full bg-acid" />
            <span className="block h-2 w-5 rounded-full bg-green-100" />
          </span>
        </span>
        <span className="grid grid-cols-2 gap-1.5">
          <span className="block h-4 rounded-md border border-gray-100 bg-white" />
          <span className="block h-4 rounded-md border border-gray-100 bg-white" />
        </span>
      </span>
    </span>
  );
}

/** A miniatura de cada aparência (o automático é metade de cada). */
function PreviaDoTema({ valor }) {
  if (valor === TEMA.CLARO) return <span className="tema-claro block h-full"><MiniPlataforma /></span>;
  if (valor === TEMA.ESCURO) return <span className="dark block h-full"><MiniPlataforma /></span>;
  return (
    <span className="relative block h-full">
      <span className="tema-claro absolute inset-0"><MiniPlataforma /></span>
      <span className="dark absolute inset-0" style={{ clipPath: 'polygon(62% 0, 100% 0, 100% 100%, 38% 100%)' }}>
        <MiniPlataforma />
      </span>
    </span>
  );
}

/** Em Configurações: três cartões com a miniatura de cada modo. */
export function ThemeSettingsCard() {
  const { disponivel, escolha, efetivo, setEscolha } = useTheme();
  const rotuloId = useId();
  const { refs, aoTeclar } = useTecladoDoGrupo(escolha, setEscolha);
  if (!disponivel) return null;
  const atual = OPCOES_DE_TEMA.find((o) => o.valor === escolha) || OPCOES_DE_TEMA[0];

  return (
    <V2Surface data-dica="config-aparencia">
      <div className="flex items-center gap-2">
        <Palette className="h-5 w-5 text-ink" aria-hidden />
        <h2 id={rotuloId} className="font-display text-lg font-bold text-ink">Aparência</h2>
      </div>
      <p className="mt-1 text-sm text-gray-500">
        Escolha como o PickleRush aparece para você. Fica salvo neste aparelho, na sua conta.
      </p>

      <div role="radiogroup" aria-labelledby={rotuloId} className="mt-4 grid grid-cols-3 gap-2 sm:gap-3">
        {OPCOES_DE_TEMA.map(({ valor, rotulo, descricao }, i) => {
          const Icone = ICONE_DO_TEMA[valor];
          const marcado = escolha === valor;
          return (
            <button
              key={valor}
              ref={(el) => { refs.current[i] = el; }}
              type="button"
              role="radio"
              aria-checked={marcado}
              aria-describedby={`${rotuloId}-${valor}`}
              tabIndex={marcado ? 0 : -1}
              onClick={() => setEscolha(valor)}
              onKeyDown={(e) => aoTeclar(e, i)}
              className={cn(
                'group flex flex-col rounded-2xl border bg-white p-1.5 text-left outline-none transition-all sm:rounded-3xl sm:p-2',
                'focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2',
                marcado ? 'border-ink shadow-organic-sm' : 'border-gray-100 hover:border-gray-300',
              )}
            >
              <span className="relative block aspect-[16/10] overflow-hidden rounded-xl border border-gray-100 sm:rounded-2xl" aria-hidden>
                <PreviaDoTema valor={valor} />
                {marcado && (
                  <span className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-acid text-ink shadow-sm">
                    <Check className="h-3 w-3" strokeWidth={3} />
                  </span>
                )}
              </span>
              <span className="flex items-center gap-1.5 px-0.5 pt-2 sm:px-1">
                {/* No celular o cartão é estreito: sem o ícone, "Automático" cabe inteiro. */}
                <Icone className={cn('hidden h-4 w-4 shrink-0 sm:block', marcado ? 'text-ink' : 'text-gray-400')} aria-hidden />
                <span className="truncate font-display text-[11px] font-bold tracking-tight text-ink sm:text-sm sm:tracking-normal">{rotulo}</span>
              </span>
              <span id={`${rotuloId}-${valor}`} className="hidden px-1 pb-1 pt-1 text-xs leading-snug text-gray-500 sm:block">
                {descricao}
              </span>
            </button>
          );
        })}
      </div>

      {/* No celular os cartões são estreitos: a descrição da escolhida vem embaixo. */}
      <p className="mt-3 text-xs leading-snug text-gray-500 sm:hidden">{atual.descricao}</p>
      {escolha === TEMA.AUTOMATICO && (
        <p className="mt-2 text-xs text-gray-500">
          Agora o aparelho está no {efetivo === TEMA.ESCURO ? 'escuro' : 'claro'}.
        </p>
      )}
      <p className="mt-3 text-xs text-gray-500">
        O telão, o totem da arena e a impressão continuam claros, para quem está na quadra e no papel.
      </p>
    </V2Surface>
  );
}
