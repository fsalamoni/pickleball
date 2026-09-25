/**
 * "Copiar o código" — o mesmo gesto em todo lugar onde um código aparece
 * (cupom, promoção, indicação). Onda CD.
 *
 * O CÓDIGO é o botão: um alvo grande, com o código à vista (quem não quer
 * copiar lê e digita), o ícone de copiar ao lado e, depois do toque, um ✓ por
 * dois segundos. O nome acessível diz o que vai acontecer ("Copiar o código
 * VERAO10"), e o resultado é anunciado ao leitor de tela.
 *
 * Se copiar falhar (navegador antigo, página sem permissão), a mensagem de
 * erro traz o código — é o que a pessoa vai anotar.
 */
import React from 'react';
import { Check, Copy } from 'lucide-react';
import { useClipboard } from '@/core/lib/useClipboard';
import { cn } from '@/core/lib/utils';

/**
 * @param {{
 *   code: string,
 *   successMessage?: string,
 *   size?: 'sm'|'md',
 *   tone?: 'paper'|'ink'|'clear',
 *   className?: string,
 *   label?: string,
 * }} props
 */
export default function CopyCodeButton({
  code, successMessage = 'Código copiado.', size = 'md', tone = 'paper', className, label,
}) {
  const { copy, copied } = useClipboard();
  if (!code) return null;
  const Icone = copied ? Check : Copy;
  return (
    <button
      type="button"
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); copy(code, successMessage, `Não foi possível copiar. O código é: ${code}`); }}
      aria-label={label || `Copiar o código ${code}`}
      className={cn(
        'inline-flex max-w-full items-center gap-1.5 rounded-xl border border-dashed font-display font-bold tracking-widest transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-1',
        size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-sm',
        tone === 'ink' && 'border-white/50 bg-white/10 text-white hover:bg-white/20',
        tone === 'paper' && 'border-gray-300 bg-paper-pure text-ink hover:border-ink',
        tone === 'clear' && 'border-current bg-transparent hover:bg-black/5',
        className,
      )}
    >
      <span className="truncate">{code}</span>
      <Icone className={size === 'sm' ? 'h-3.5 w-3.5 shrink-0' : 'h-4 w-4 shrink-0'} aria-hidden />
      <span className="sr-only" aria-live="polite">{copied ? 'Copiado' : ''}</span>
    </button>
  );
}
