/**
 * "Mostrar no meu perfil público" — a camada da VITRINE na ficha do torneio de
 * fora (PR 7, docs/54 §4.13). Quem grava é o servidor (`publish`/`unpublish`):
 * a tela só escolhe o torneio e as fotos. O que vai e o que nunca vai é dito
 * ANTES de publicar. Menor de 18 não vê o botão (o servidor confere de novo).
 *
 * Falha não é vazio: sem saber se o torneio já está na vitrine, a camada diz
 * que não carregou — nunca "não está publicado" (o botão publicaria por cima).
 */
import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Globe2 } from 'lucide-react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { todayLocal } from '@/modules/training/domain/dates.js';
import { ageOn } from '@/modules/career/domain/careerPartner.js';
import { SHOWCASE_LIMITS, canPublishShowcase, canShowcaseEvent, publishablePhotos, sourceOfPublicPhoto } from '@/modules/career/domain/careerPublic.js';
import { useCareerPartnerAction, useCareerPublic } from '@/modules/career/hooks/useCareer';
import { V2Badge, V2Button, V2ErrorState, V2Skeleton } from '@/v2/ui/primitives';
import { t } from '@/core/i18n';

/**
 * @param {{ event: object, saved: boolean, dirty: boolean }} props
 *   `event`: o GRAVADO (não o rascunho); `dirty`: há mudança não salva.
 */
export default function CareerShowcaseLayer({ event, saved, dirty }) {
  const { user, userProfile } = useAuth();
  const uid = user?.uid;
  const adulto = canPublishShowcase(userProfile, todayLocal());
  const jogado = canShowcaseEvent(event, todayLocal());
  const q = useCareerPublic(uid, { enabled: Boolean(saved && jogado && adulto) });
  const acao = useCareerPartnerAction();
  const publicado = q.isSuccess ? (q.data || []).find((x) => x.event_id === event?.id) || null : null;
  const podem = useMemo(() => publishablePhotos(event), [event]);
  const [fotos, setFotos] = useState([]);
  // A escolha recomeça pelo que JÁ está na vitrine (ou nenhuma foto) — só quando a vitrine MUDA,
  // não a cada nova leitura (voltar à aba não desfaz a escolha em andamento).
  const versao = publicado ? publicado.updated_at_ms || 0 : null;
  useEffect(() => {
    setFotos(publicado ? (publicado.photos || []).map((p) => sourceOfPublicPhoto(uid, p.path)).filter(Boolean) : []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event?.id, versao, uid]);

  // Plano em andamento (começou e o último dia não passou): só abre com a colocação salva — a tela diz.
  const emAndamento = event?.status === 'planned' && Boolean(event?.start_date) && String(event.start_date) <= todayLocal();
  if (!saved || !jogado) {
    return (
      <p className="text-xs text-gray-500">
        {emAndamento
          ? t('Este torneio ainda está em andamento. Salve a colocação em Resultado — ou espere o último dia passar — para mostrá-lo no seu perfil público.')
          : t('Depois de salvar um torneio já jogado, você pode mostrá-lo no seu perfil público.')}
      </p>
    );
  }
  if (!adulto) {
    return (
      <p className="text-xs text-gray-500">
        {ageOn(userProfile?.birth_date, todayLocal()) === null
          ? t('Preencha a sua data de nascimento no perfil para mostrar torneios no perfil público.')
          : t('A vitrine pública é só para maiores de 18 anos. A sua carreira continua só sua.')}
      </p>
    );
  }
  if (q.isPending) return <V2Skeleton lines={2} />;
  if (q.isError) return <V2ErrorState inline title={t('Não deu para saber se este torneio está no seu perfil')} onRetry={() => q.refetch()} />;

  const outrasFotos = (q.data || []).filter((x) => x.event_id !== event.id).reduce((n, x) => n + (x.photos || []).length, 0);
  const cabem = Math.max(0, SHOWCASE_LIMITS.photos - outrasFotos);
  const lotado = !publicado && (q.data || []).length >= SHOWCASE_LIMITS.items;
  const marcar = (path) => setFotos((xs) => (xs.includes(path) ? xs.filter((x) => x !== path) : xs.length < cabem ? [...xs, path] : xs));

  async function rodar(payload, ok) {
    try {
      await acao.mutateAsync(payload);
      toast.success(ok);
    } catch (err) {
      toast.error(err?.message || t('Não foi possível concluir. Tente de novo.'));
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {publicado ? <V2Badge tone="green">{t('No seu perfil público')}</V2Badge> : <V2Badge tone="neutral">{event.shared_coach_id ? t('Só você e o seu professor veem') : t('Só você vê')}</V2Badge>}
      </div>
      <p className="text-xs text-gray-600">
        {t('Vai ao perfil: o nome do torneio, a data, a cidade, a categoria, a colocação, o selo (declarado, confirmado ou oficial) e as fotos que você escolher. Nunca vão: anotações, link, custo, metas, o balanço nem a visão da dupla.')}
      </p>
      <p className="text-xs text-gray-600">{t('A dupla aparece só como "com dupla". O nome e a foto dela entram apenas se ela confirmou o torneio e permitiu.')}</p>
      {podem.length > 0 && (
        <fieldset className="space-y-2">
          <legend className="text-sm font-semibold text-ink">{t('Fotos para mostrar (até {n} na vitrine toda)', { n: SHOWCASE_LIMITS.photos })}</legend>
          <ul className="flex flex-wrap gap-2">
            {podem.map((p) => {
              const ativo = fotos.includes(p.path);
              return (
                <li key={p.path}>
                  <button type="button" aria-pressed={ativo} onClick={() => marcar(p.path)}
                    disabled={!ativo && fotos.length >= cabem}
                    className={`min-h-11 rounded-2xl border px-3 py-2 text-left text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ink disabled:opacity-50 ${ativo ? 'border-ink bg-ink text-acid' : 'border-gray-200 bg-paper-pure text-ink'}`}>
                    {p.alt}
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="text-xs text-gray-500">{t('Só fotos com descrição. A cópia pública sai sem os dados escondidos da foto (como a localização).')}</p>
          <p className="text-xs text-gray-500">{t('Mostre só fotos em que as outras pessoas concordam em aparecer — e evite rostos de crianças.')}</p>
        </fieldset>
      )}
      {lotado && <p className="text-xs text-gray-600">{t('A vitrine mostra até {n} torneios. Tire um antes de pôr outro.', { n: SHOWCASE_LIMITS.items })}</p>}
      <div className="flex flex-wrap gap-2">
        <V2Button type="button" size="sm" variant={publicado ? 'secondary' : 'primary'} disabled={acao.isPending || dirty || lotado}
          onClick={() => rodar({ action: 'publish', eventId: event.id, photos: fotos }, publicado ? t('Vitrine atualizada.') : t('No seu perfil público.'))}>
          <Globe2 className="h-4 w-4" /> {publicado ? t('Atualizar no perfil') : t('Mostrar no meu perfil público')}
        </V2Button>
        {publicado && (
          <V2Button type="button" size="sm" variant="ghost" disabled={acao.isPending}
            onClick={() => rodar({ action: 'unpublish', eventId: event.id }, t('Tirado do seu perfil público.'))}>
            {t('Tirar do perfil')}
          </V2Button>
        )}
      </div>
      {dirty && <p className="text-xs text-gray-500">{t('Salve a ficha antes: a vitrine mostra o que está salvo.')}</p>}
    </div>
  );
}
