/**
 * Tradução de cortesia dos documentos legais, baixada SÓ para quem usa en/es
 * (pt-BR não baixa nada). Falhou ou não chegou ainda: `null`, e a tela mostra o
 * português — que é o texto que vale.
 */
import { useQuery } from '@tanstack/react-query';
import { idiomaAtivo } from '@/core/i18n';

const CARREGAR = {
  en: () => import('../i18n/documentos/en.js'),
  es: () => import('../i18n/documentos/es.js'),
};

/** Mapa key → tradução do idioma ativo, ou null. */
export function useLegalTranslations(enabled = true) {
  const idioma = idiomaAtivo();
  const carregar = CARREGAR[idioma];
  const { data } = useQuery({
    queryKey: ['legal-traducoes', idioma],
    queryFn: async () => (await carregar()).default,
    enabled: enabled && !!carregar,
    staleTime: Infinity,
  });
  return (enabled && data) || null;
}
