/**
 * A EQUIPE na página da federação: uma barra só, escura, no topo — separada do
 * conteúdo, que é o que o público vê. Cargo, "Abrir a Central", "Ver como
 * visitante" e, com a federação oculta, o aviso (e o atalho de publicar para o
 * admin). Nenhum botão de gestão fica no meio da página pública.
 *
 * `FedPreviewBanner` é o outro lado: na prévia (`?visao=publico`) a barra some,
 * a área do filiado também, e a faixa diz que aquilo é o que o público vê.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { Eye, EyeOff, Globe, Settings2, ShieldCheck, X } from 'lucide-react';
import { FED_PERMISSION } from '@/modules/federations/domain/constants';
import { isFederationHidden } from '@/modules/federations/domain/federation';
import { V2Button } from '@/v2/ui/primitives';
import { fedManagePath, fedPath } from '../federationUi';
import { t } from '@/core/i18n';

export const PREVIEW_PARAM = 'visao';
export const PREVIEW_VALUE = 'publico';
export const fedPreviewPath = (f) => `${fedPath(f)}?${PREVIEW_PARAM}=${PREVIEW_VALUE}`;

/** @param {{ federation: object, papel: object }} props `papel` = `useMyFederationRole` */
export function FedStaffBar({ federation: f, papel }) {
  const oculta = isFederationHidden(f);
  const quem = papel.grant || papel.needsGrant ? t('Suporte da plataforma') : (papel.roleName || t('Equipe'));
  return (
    <div className="flex flex-col gap-3 rounded-3xl bg-ink px-4 py-3 text-white sm:flex-row sm:items-center sm:justify-between sm:px-5" data-dica="federacao-gerir">
      <div className="flex min-w-0 items-start gap-3">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-acid" aria-hidden="true" />
        <div className="min-w-0">
          <p className="text-sm font-bold">{t('Área da equipe')} · <span className="font-semibold text-white/80">{quem}</span></p>
          <p className="text-xs text-white/70">
            {oculta
              ? t('A federação está oculta: só a equipe e os filiados veem esta página.')
              : t('Só a equipe vê esta barra. O restante da página é o que o público vê.')}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {oculta && papel.has?.(FED_PERMISSION.ADMIN) && (
          <V2Button asChild size="sm" variant="subtle"><Link to={fedManagePath(f, 'publicacao')}><Globe className="h-4 w-4" />{t('Revisar e publicar')}</Link></V2Button>
        )}
        <V2Button asChild size="sm" variant="subtle"><Link to={fedPreviewPath(f)}><Eye className="h-4 w-4" />{t('Ver como visitante')}</Link></V2Button>
        <V2Button asChild size="sm" variant="primary"><Link to={fedManagePath(f)}><Settings2 className="h-4 w-4" />{t('Abrir a Central')}</Link></V2Button>
      </div>
    </div>
  );
}

/** A faixa da prévia "ver como visitante". */
export function FedPreviewBanner({ federation: f, staff = false }) {
  const oculta = isFederationHidden(f);
  return (
    <div className="flex flex-col gap-3 rounded-3xl border-2 border-dashed border-ink/30 bg-paper px-4 py-3 sm:flex-row sm:items-center sm:justify-between" role="status">
      <p className="flex items-start gap-2 text-sm text-ink">
        {oculta ? <EyeOff className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /> : <Eye className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />}
        <span>
          <span className="font-bold">{t('Prévia: é assim que o público vê esta página.')}</span>{' '}
          {oculta ? t('Ainda está oculta: ninguém de fora a vê até o admin publicar.') : t('Sem a barra da equipe e sem a área do filiado.')}
        </span>
      </p>
      <div className="flex flex-wrap gap-2">
        <V2Button asChild size="sm" variant="ghost"><Link to={fedPath(f)}><X className="h-4 w-4" />{t('Sair da prévia')}</Link></V2Button>
        {staff && <V2Button asChild size="sm" variant="secondary"><Link to={fedManagePath(f)}><Settings2 className="h-4 w-4" />{t('Voltar à Central')}</Link></V2Button>}
      </div>
    </div>
  );
}
