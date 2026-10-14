import React, { useId } from 'react';
import { Languages } from 'lucide-react';
import { t, IDIOMAS } from '@/core/i18n';
import { useLanguage } from '@/core/i18n/useLanguage';
import SettingsSection from '@/v2/components/settings/SettingsSection';

/** Seletor compacto (tela de entrada, menus). Some com a flag desligada. */
export function LanguageSelect({ className = '' }) {
  const { disponivel, codigo, escolher } = useLanguage();
  const id = useId();
  if (!disponivel) return null;
  return (
    <label htmlFor={id} className={`inline-flex items-center gap-1.5 text-xs text-gray-500 ${className}`}>
      <Languages className="h-4 w-4" aria-hidden />
      <span className="sr-only">{t('Idioma')}</span>
      <select
        id={id}
        value={codigo}
        onChange={(e) => escolher(e.target.value)}
        className="rounded-md border border-gray-200 bg-white px-2 py-1 text-xs text-ink"
      >
        {IDIOMAS.map((i) => (
          // lang no item: o leitor de tela pronuncia o nome no idioma dele.
          <option key={i.codigo} value={i.codigo} lang={i.codigo}>{i.nomeNativo}</option>
        ))}
      </select>
    </label>
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
              {i.nomeNativo}
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
