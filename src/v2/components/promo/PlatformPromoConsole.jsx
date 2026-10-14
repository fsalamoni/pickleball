/**
 * A divulgação DA PLATAFORMA (Onda CG) — a aba "Divulgação" do painel admin
 * (Plataforma → Divulgação), atrás da flag `platform_marketing`.
 *
 * Arquivo próprio para o painel admin carregá-lo sob demanda: o console de
 * divulgação (editores, formulários) só baixa quando a aba abre.
 */
import React from 'react';
import PromoMarketingConsole from './PromoMarketingConsole';
import { PLATFORM_ISSUER } from './promoUi';
import { t } from '@/core/i18n';

export default function PlatformPromoConsole() {
  return (
    <PromoMarketingConsole
      issuer={PLATFORM_ISSUER}
      intro={(
        <p className="max-w-3xl text-sm text-gray-600">
          {t('Cupons e campanhas da plataforma, com as mesmas ferramentas das arenas: tipos de cupom, arte, banner com modelos ou imagem, destino, aviso com o público contado antes e controle de uso. O banner aparece na vitrine de promoções e, se quiser, na tela inicial — no Brasil todo ou numa região.')}
        </p>
      )}
    />
  );
}
