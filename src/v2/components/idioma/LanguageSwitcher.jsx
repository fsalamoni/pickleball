import React from 'react';
import { Check, ChevronDown, Languages } from 'lucide-react';
import { t, IDIOMAS } from '@/core/i18n';
import { useLanguage } from '@/core/i18n/useLanguage';
import { cn } from '@/core/lib/utils';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import SettingsSection from '@/v2/components/settings/SettingsSection';
import Bandeira from './Bandeira';

/**
 * Seletor com bandeiras: no cabeçalho (`variante="cabecalho"`, só a bandeira,
 * do tamanho dos outros botões redondos) e na tela de entrada (bandeira +
 * nome). Some com a flag desligada.
 */
export function LanguageMenu({ variante = 'cabecalho', className = '' }) {
  const { disponivel, codigo, escolher } = useLanguage();
  if (!disponivel) return null;
  const atual = IDIOMAS.find((i) => i.codigo === codigo) || IDIOMAS[0];
  const cabecalho = variante === 'cabecalho';
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          data-dica="botao-idioma"
          aria-label={t('Idioma: {idioma}. Trocar idioma', { idioma: atual.nomeNativo })}
          title={t('Idioma')}
          className={cn(
            'btn-press inline-flex shrink-0 items-center justify-center rounded-full bg-white text-ink shadow-sm transition-colors hover:bg-paper',
            'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-gray-200',
            cabecalho ? 'h-10 w-10 sm:h-11 sm:w-11' : 'gap-2 px-3 py-2 text-sm font-semibold',
            className,
          )}
        >
          <Bandeira codigo={atual.codigo} className={cabecalho ? 'h-6 w-6' : 'h-5 w-5'} />
          {!cabecalho && <span lang={atual.codigo}>{atual.nomeNativo}</span>}
          {!cabecalho && <ChevronDown className="h-4 w-4 text-gray-500" aria-hidden="true" />}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={cabecalho ? 'end' : 'center'} className="w-52">
        <DropdownMenuLabel className="text-xs font-bold uppercase tracking-wider text-gray-500">{t('Idioma')}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {IDIOMAS.map((i) => {
          const marcado = i.codigo === codigo;
          return (
            <DropdownMenuItem
              key={i.codigo}
              className="cursor-pointer gap-3 py-2.5"
              onClick={() => escolher(i.codigo)}
              aria-current={marcado ? 'true' : undefined}
            >
              <Bandeira codigo={i.codigo} className="h-5 w-5" />
              {/* lang: o leitor de tela pronuncia o nome no idioma dele. */}
              <span lang={i.codigo} className={cn('flex-1', marcado && 'font-bold')}>{i.nomeNativo}</span>
              {marcado && <Check className="h-4 w-4 text-ink" aria-hidden="true" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Cartão de Configurações → Tela e navegação. */
export function IdiomaSettingsCard() {
  const { disponivel, codigo, escolher } = useLanguage();
  if (!disponivel) return null;
  const atual = IDIOMAS.find((i) => i.codigo === codigo);
  return (
    <SettingsSection
      id="idioma"
      icon={Languages}
      title={t('Idioma')}
      summary={atual?.nomeNativo}
    >
      <div role="radiogroup" aria-label={t('Idioma')} className="grid gap-2 sm:grid-cols-3">
        {IDIOMAS.map((i) => {
          const marcado = i.codigo === codigo;
          return (
            <button type="button"
              key={i.codigo}
              role="radio"
              aria-checked={marcado}
              lang={i.codigo}
              onClick={() => escolher(i.codigo)}
              className={`rounded-xl border px-3 py-3 text-left text-sm font-semibold coarse:min-h-11 ${
                marcado ? 'border-ink bg-ink text-white' : 'border-gray-200 bg-white text-ink hover:border-gray-300'
              }`}
            >
              <span className="flex items-center gap-2.5">
                <Bandeira codigo={i.codigo} className="h-5 w-5" />
                {i.nomeNativo}
              </span>
            </button>
          );
        })}
      </div>
      <p className="mt-3 text-xs text-gray-500">
        {t('Fica salvo neste aparelho. A página recarrega ao trocar. O que as pessoas escrevem (nomes, descrições, mensagens) não é traduzido.')}
      </p>
    </SettingsSection>
  );
}
