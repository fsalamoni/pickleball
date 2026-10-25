/**
 * PublicClubVerify — a verificação pública da carteirinha do clube
 * (`/c/verificar/:codigo`), sem login: quem lê o QR vê se a associação está em
 * dia, de quem é e de qual clube. A resposta vem do SERVIDOR
 * (`clubAssociationVerify`), que só devolve o mínimo; código errado, trocado
 * por uma renovação ou clube sem associação ⇒ "não encontrado", sem detalhe.
 * Sem código na URL, um campo para digitar.
 */
import React, { useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { BadgeCheck, Clock, IdCard, ShieldAlert, ShieldCheck } from 'lucide-react';
import { useFeatureFlags } from '@/core/lib/FeatureFlagsContext';
import { FEATURE_FLAG } from '@/core/featureFlags';
import { useDocumentMeta } from '@/core/seo/useDocumentMeta';
import { useClubCardVerification } from '@/modules/clubs/hooks/useClubAssociation';
import { MEMBER_STATUS, MEMBER_STATUS_LABELS, clubVerifyPath, dataCurta } from '@/modules/clubs/domain/association';
import { normalizeCardCode } from '@/modules/federations/domain/membership';
import { V2Avatar, V2Button, V2ErrorState, V2Input, V2Skeleton } from '@/v2/ui/primitives';
import { fmtData, t } from '@/core/i18n';

function Resultado({ r, consultadoEm }) {
  if (!r.found) {
    return (
      <div className="rounded-4xl border border-red-200 bg-red-50 p-8 text-center">
        <ShieldAlert className="mx-auto h-10 w-10 text-red-600" aria-hidden="true" />
        <h2 className="mt-3 font-display text-2xl font-bold text-ink">{t('Código não encontrado')}</h2>
        <p className="mt-2 text-sm text-gray-700">{t('O código não existe, foi substituído por uma renovação, ou o clube não está com a associação ativa. Peça à pessoa a carteirinha atualizada.')}</p>
      </div>
    );
  }
  const emDia = r.status === MEMBER_STATUS.ACTIVE;
  return (
    <div className={`rounded-4xl border p-8 ${emDia ? 'border-green-200 bg-green-50' : 'border-amber-200 bg-amber-50'}`}>
      <div className="flex items-center gap-3">
        {emDia ? <ShieldCheck className="h-10 w-10 text-green-700" aria-hidden="true" /> : <ShieldAlert className="h-10 w-10 text-amber-600" aria-hidden="true" />}
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-gray-500">{t('Carteirinha')} · {r.club?.name}</p>
          <h2 className="font-display text-2xl font-bold text-ink">{emDia ? t('Associação em dia') : t(MEMBER_STATUS_LABELS[r.status] || 'Associação irregular')}</h2>
        </div>
      </div>
      <div className="mt-6 flex items-center gap-4">
        <V2Avatar name={r.name} photoUrl={r.photo_url} size="lg" />
        <div className="min-w-0">
          <p className="font-display text-xl font-bold text-ink">{r.name}</p>
          <p className="text-sm text-gray-700">{[r.plan_name, r.category].filter(Boolean).join(' · ')}</p>
          {r.member_number && <p className="text-sm text-gray-700">{t('Nº {numero}', { numero: r.member_number })}</p>}
          {r.valid_until && <p className="text-sm text-gray-700">{t('Válida até {data}', { data: dataCurta(r.valid_until) })}</p>}
        </div>
      </div>
      <div className="mt-6 space-y-1 border-t border-black/10 pt-4 text-sm text-gray-700">
        <p className="flex items-center gap-2"><Clock className="h-4 w-4" aria-hidden="true" />{t('Consultado agora: {data}', { data: fmtData(new Date(consultadoEm), { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) })}</p>
        {r.club?.id && <p><Link to={`/c/${encodeURIComponent(r.club.id)}`} className="font-semibold text-ink underline">{t('Ver a página do {clube}', { clube: r.club.name })}</Link></p>}
      </div>
    </div>
  );
}

export default function PublicClubVerify() {
  const { codigo } = useParams();
  const navigate = useNavigate();
  const { flags, isLoading: flagsLoading } = useFeatureFlags();
  const ligada = Boolean(flags?.[FEATURE_FLAG.CLUB_ASSOCIATION]);
  const code = normalizeCardCode(codigo || '');
  const vq = useClubCardVerification(ligada && code ? code : null);
  const [digitado, setDigitado] = useState('');
  const [erroDigitado, setErroDigitado] = useState(false);
  useDocumentMeta({ title: t('Verificar carteirinha de clube'), description: t('Confira se a associação ao clube está em dia.') }, true);
  if (!flagsLoading && !ligada) return <Navigate to="/" replace />;
  const linkInvalido = Boolean(codigo) && !code;
  return (
    <div className="min-h-screen bg-paper">
      <div className="mx-auto max-w-[560px] space-y-6 px-4 py-10">
        <header className="text-center">
          <IdCard className="mx-auto h-10 w-10 text-ink" aria-hidden="true" />
          <h1 className="mt-3 font-display text-3xl font-bold text-ink">{t('Verificar carteirinha de clube')}</h1>
          <p className="mt-2 text-sm text-gray-500">{t('A carteirinha digital de associado do PickleRush traz um código. Leia o QR ou digite-o aqui.')}</p>
        </header>
        <form className="space-y-1" noValidate onSubmit={(e) => { e.preventDefault(); const c = normalizeCardCode(digitado); setErroDigitado(!c); if (c) navigate(clubVerifyPath(c)); }}>
          <div className="flex gap-2">
            <V2Input aria-label={t('Código da carteirinha')} aria-invalid={erroDigitado || undefined} aria-describedby={erroDigitado ? 'verificar-clube-erro' : undefined} value={digitado} onChange={(e) => { setDigitado(e.target.value.toUpperCase()); setErroDigitado(false); }} placeholder={code || 'ABCD-EFGH-JK'} maxLength={14} className="font-mono uppercase" />
            <V2Button type="submit"><BadgeCheck className="h-4 w-4" aria-hidden="true" />{t('Verificar')}</V2Button>
          </div>
          {erroDigitado && <p id="verificar-clube-erro" role="alert" className="text-sm text-red-600">{t('O código tem 10 letras e números (os traços são opcionais). Confira o que foi digitado.')}</p>}
        </form>
        {linkInvalido && (
          <div role="alert" className="rounded-4xl border border-red-200 bg-red-50 p-6 text-center text-sm text-red-900">
            <p className="font-display text-xl font-bold text-ink">{t('Código inválido')}</p>
            <p className="mt-1">{t('O código deste link não tem o formato de uma carteirinha. Leia o QR de novo ou digite o código acima.')}</p>
          </div>
        )}
        {code && (flagsLoading || vq.isLoading ? <V2Skeleton lines={4} /> : vq.isError ? <V2ErrorState title={t('Não foi possível verificar agora')} description={t('A conexão falhou. O código continua valendo.')} onRetry={() => vq.refetch()} /> : vq.data ? <Resultado r={vq.data} consultadoEm={vq.dataUpdatedAt || Date.now()} /> : null)}
      </div>
    </div>
  );
}
