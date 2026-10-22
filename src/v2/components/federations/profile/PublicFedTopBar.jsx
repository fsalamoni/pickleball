/**
 * A barra de cima das páginas PÚBLICAS da federação (`/f/:slug`, o acervo e a
 * agenda): a marca leva ao início e o botão entra na conta (voltando para a
 * mesma página) ou, com conta, abre a federação no app. Antes só a página
 * principal tinha a barra, e quem chegava ao acervo ou à agenda por um link
 * ficava sem caminho para entrar.
 */
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import BrandMark from '@/v2/ui/BrandMark';
import { V2Button } from '@/v2/ui/primitives';
import { PAGE_FRAME } from '@/v2/ui/pageFrame';
import { t } from '@/core/i18n';

/** @param {{ appPath?: string }} props `appPath`: para onde "Abrir no app" leva (sem ele, só "Entrar" para quem não tem conta). */
export default function PublicFedTopBar({ appPath = '' }) {
  const { isAuthenticated } = useAuth();
  const { pathname, search } = useLocation();
  const destino = isAuthenticated ? appPath : `/login?next=${encodeURIComponent(appPath || `${pathname}${search}`)}`;
  return (
    <header className="border-b border-gray-100 bg-paper-pure print:hidden">
      <div className={`${PAGE_FRAME} flex items-center justify-between gap-3 px-4 py-3`}>
        <Link to="/" aria-label={t('PickleRush — início')}><BrandMark className="h-7 w-auto" /></Link>
        {destino && <V2Button asChild size="sm" variant="ghost"><Link to={destino}>{isAuthenticated ? t('Abrir no app') : t('Entrar')}</Link></V2Button>}
      </div>
    </header>
  );
}
