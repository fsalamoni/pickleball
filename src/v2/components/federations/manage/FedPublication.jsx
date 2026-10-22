/**
 * Publicação da federação (Central → Página pública → Publicação).
 *
 * Aprovada pela plataforma, a federação nasce OCULTA (`published` ausente): a
 * equipe estrutura planos, Pix, página, módulos, acervo e agenda sem ninguém
 * de fora ver. Só o admin dela a torna pública — e pode tirar do ar de novo.
 * A regra (`fedPublic`/`fedSees`) é quem esconde; esta tela só liga a chave.
 */
import React, { useState } from 'react';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { CheckCircle2, Circle, EyeOff, Globe, HelpCircle } from 'lucide-react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { setFederationPublished } from '@/modules/federations/services/federationService';
import { useFederationMutation } from '@/modules/federations/hooks/useFederations';
import { isFederationHidden, isFederationPublic, publicationChecklist } from '@/modules/federations/domain/federation';
import { V2Badge, V2Button, V2Surface } from '@/v2/ui/primitives';
import { fedManagePath, fedPublicPath, publicHost } from '../federationUi';
import { t } from '@/core/i18n';

/** A faixa "ainda não está pública": na Central (com o atalho para publicar) e na página da federação, para a equipe. */
export function FedHiddenBanner({ federation, canPublish = false, onOpen = null }) {
  if (!isFederationHidden(federation)) return null;
  const acao = canPublish
    ? (onOpen
      ? <V2Button type="button" size="sm" onClick={onOpen}><Globe className="h-4 w-4" />{t('Revisar e publicar')}</V2Button>
      : <V2Button asChild size="sm"><Link to={fedManagePath(federation, 'publicacao')}><Globe className="h-4 w-4" />{t('Revisar e publicar')}</Link></V2Button>)
    : null;
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between" data-dica="federacao-oculta">
      <p className="flex items-start gap-2 text-sm text-amber-900">
        <EyeOff className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <span>
          {canPublish
            ? t('A federação ainda não está pública: só a equipe a vê. Estruture planos, Pix, página e módulos e, quando estiver pronta, publique em Página pública → Publicação.')
            : t('A federação ainda não está pública: só a equipe a vê. Quem publica é o admin da federação.')}
        </span>
      </p>
      {acao}
    </div>
  );
}

/** A aba Publicação: o estado, o que conferir antes e o botão de abrir (ou tirar do ar). */
export default function FedPublicationTab({ federation, plansQ }) {
  const { user } = useAuth();
  const [confirmar, setConfirmar] = useState(null); // 'abrir' | 'fechar'
  const m = useFederationMutation((abrir) => setFederationPublished(federation, abrir, { uid: user?.uid }));
  const publica = isFederationPublic(federation);
  const aprovada = isFederationPublic(federation) || isFederationHidden(federation);
  const lista = publicationChecklist(federation, plansQ?.isSuccess ? plansQ.data : undefined);
  const endereco = `${publicHost()}${fedPublicPath(federation)}`;

  const executar = () => {
    const abrir = confirmar === 'abrir';
    m.mutate(abrir, {
      onSuccess: () => { toast.success(abrir ? t('Federação publicada. A página já está aberta a todos.') : t('Federação tirada do ar. Só a equipe a vê agora.')); setConfirmar(null); },
      onError: (e) => { toast.error(e.message); setConfirmar(null); },
    });
  };

  return (
    <section className="space-y-4" aria-label={t('Publicação da federação')} data-dica="federacao-publicacao">
      <div>
        <h2 className="font-display text-xl font-bold text-ink">{t('Publicação')}</h2>
        <p className="text-sm text-gray-500">{t('Enquanto a federação não é publicada, ela não aparece no diretório, a página pública não abre e ninguém de fora se filia, pede chancela ou filia clube. A equipe trabalha normalmente.')}</p>
      </div>

      <V2Surface className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {publica ? <V2Badge tone="green"><Globe className="h-3.5 w-3.5" aria-hidden="true" />{t('Pública')}</V2Badge> : <V2Badge tone="amber"><EyeOff className="h-3.5 w-3.5" aria-hidden="true" />{t('Oculta')}</V2Badge>}
            <span className="truncate text-sm text-gray-600">{endereco}</span>
          </div>
          <p className="mt-1 text-sm text-gray-500">
            {!aprovada ? t('A publicação libera depois que a plataforma aprovar a federação.')
              : publica ? t('Todos veem a federação: diretório, página pública, filiação e pedidos.')
                : t('Só a equipe, quem já é filiado e o suporte da plataforma veem a federação.')}
          </p>
        </div>
        {aprovada && (publica
          ? <V2Button type="button" variant="secondary" disabled={m.isPending} onClick={() => setConfirmar('fechar')}><EyeOff className="h-4 w-4" />{t('Tirar do ar')}</V2Button>
          : <V2Button type="button" disabled={m.isPending} onClick={() => setConfirmar('abrir')} data-dica="federacao-publicar"><Globe className="h-4 w-4" />{t('Tornar pública')}</V2Button>)}
      </V2Surface>

      {!publica && aprovada && (
        <V2Surface className="space-y-3">
          <p className="font-bold text-ink">{t('Antes de publicar, confira')}</p>
          <ul className="space-y-2">
            {lista.map((i) => (
              <li key={i.id} className="flex items-center gap-2 text-sm">
                {i.ok === true ? <CheckCircle2 className="h-4 w-4 text-green-600" aria-hidden="true" /> : i.ok === false ? <Circle className="h-4 w-4 text-amber-600" aria-hidden="true" /> : <HelpCircle className="h-4 w-4 text-gray-500" aria-hidden="true" />}
                <span className={i.ok === false ? 'text-gray-700' : 'text-gray-600'}>{t(i.label)}</span>
                <span className="sr-only">{i.ok === true ? t('feito') : i.ok === false ? t('falta') : t('não deu para conferir')}</span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-gray-500">{t('São recomendações: dá para publicar sem elas. A loja oficial, os cupons e as campanhas só abrem depois de publicar.')}</p>
        </V2Surface>
      )}

      <ConfirmDialog
        open={confirmar === 'abrir'}
        onOpenChange={(v) => { if (!v) setConfirmar(null); }}
        title={t('Tornar a federação pública?')}
        description={t('A federação entra no diretório, a página pública abre e qualquer pessoa pode se filiar, pedir chancela e filiar clube ou arena. Dá para tirar do ar depois.')}
        confirmLabel={t('Publicar')}
        cancelLabel={t('Voltar')}
        loading={m.isPending}
        onConfirm={executar}
      />
      <ConfirmDialog
        open={confirmar === 'fechar'}
        onOpenChange={(v) => { if (!v) setConfirmar(null); }}
        title={t('Tirar a federação do ar?')}
        description={t('Ela sai do diretório e a página pública fecha; ninguém novo se filia nem faz pedidos. Quem já é filiado continua vendo a federação e a carteirinha segue válida. A loja oficial sai do Mercado para a equipe até publicar de novo, mas os anúncios e cupons já publicados continuam no ar: pause-os antes, no Mercado e em Divulgação.')}
        confirmLabel={t('Tirar do ar')}
        cancelLabel={t('Voltar')}
        destructive
        loading={m.isPending}
        onConfirm={executar}
      />
    </section>
  );
}
