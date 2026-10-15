import React from 'react';
import { Languages } from 'lucide-react';

/**
 * Bandeira redonda de cada idioma do registro (`core/i18n/languages.js`).
 * SVG, não emoji: no Windows o emoji de bandeira vira "BR"/"US" em letras.
 * Cor fixa de propósito — bandeira não muda no modo escuro.
 * Idioma novo sem bandeira aqui cai no ícone de idiomas.
 */
const RISCA = 24 / 13;

const DESENHOS = {
  'pt-BR': (
    <>
      <rect width="24" height="24" fill="#009C3B" />
      <polygon points="12,3.2 22.5,12 12,20.8 1.5,12" fill="#FFDF00" />
      <circle cx="12" cy="12" r="4.8" fill="#002776" />
      <path d="M7.3 11.1 Q12 9.4 16.7 12.4" stroke="#fff" strokeWidth="0.9" fill="none" />
    </>
  ),
  en: (
    <>
      <rect width="24" height="24" fill="#fff" />
      {[0, 1, 2, 3, 4, 5, 6].map((k) => (
        <rect key={k} y={k * 2 * RISCA} width="24" height={RISCA} fill="#B22234" />
      ))}
      <rect width="12" height={7 * RISCA} fill="#3C3B6E" />
      {[2.4, 6, 9.6].flatMap((x) => [3.2, 6.4, 9.6].map((y) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r="0.7" fill="#fff" />
      )))}
    </>
  ),
  es: (
    <>
      <rect width="24" height="24" fill="#AA151B" />
      <rect y="6" width="24" height="12" fill="#F1BF00" />
    </>
  ),
};

export default function Bandeira({ codigo, className = 'h-6 w-6' }) {
  const desenho = DESENHOS[codigo];
  if (!desenho) return <Languages className={className} aria-hidden="true" />;
  return (
    <svg viewBox="0 0 24 24" className={`shrink-0 overflow-hidden rounded-full ring-1 ring-black/10 ${className}`} aria-hidden="true">
      {desenho}
    </svg>
  );
}
