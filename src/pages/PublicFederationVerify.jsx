/**
 * PublicFederationVerify — a verificação pública da carteirinha
 * (`/f/verificar/:codigo`), sem login: quem lê o QR vê se a filiação está em
 * dia, de quem é e de qual federação. A resposta vem do SERVIDOR
 * (`federationVerify`), que só devolve o que `publicVerification` escolhe;
 * código errado ou federação não aprovada ⇒ "não encontrado", sem detalhe.
 * Sem código na URL, um campo para digitar.
 */
import React, { useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { BadgeCheck, IdCard, ShieldAlert, ShieldCheck } from 'lucide-react';
import { useFeatureFlags } from '@/core/lib/FeatureFlagsContext';
import { FEATURE_FLAG } from '@/core/featureFlags';
import { useDocumentMeta } from '@/core/seo/useDocumentMeta';
import { useCardVerification } from '@/modules/federations/hooks/useFederations';
import { normalizeCardCode } from '@/modules/federations/domain/membership';
import { verifyPath } from '@/modules/federations/domain/card';
import { COURSE_KIND_LABELS, CREDENTIAL_STATUS, CREDENTIAL_STATUS_LABELS, MEMBER_STATUS, MEMBER_STATUS_LABELS, PLAN_PERSON_TYPE_LABELS, PLAN_TIER_LABELS } from '@/modules/federations/domain/constants';
import { V2Avatar, V2Button, V2ErrorState, V2Input, V2Skeleton } from '@/v2/ui/primitives';
import { quando } from '@/v2/components/federations/federationUi';
import { t } from '@/core/i18n';

function Resultado({ r }) {
  if (!r.found) {
    return (
      <div className="rounded-4xl border border-red-200 bg-red-50 p-8 text-center">
        <ShieldAlert className="mx-auto h-10 w-10 text-red-600" aria-hidden="true" />
        <h2 className="mt-3 font-display text-2xl font-bold text-ink">{t('Carteirinha não encontrada')}</h2>
        <p className="mt-2 text-sm text-gray-700">{t('O código não existe, foi substituído por uma renovação, ou a federação não está ativa. Peça à pessoa a carteirinha ou a credencial atualizada.')}</p>
      </div>
    );
  }
  if (r.kind === 'credential') {
    const valida = r.status === CREDENTIAL_STATUS.ACTIVE;
    return (
      <div className={`rounded-4xl border p-8 ${valida ? 'border-green-200 bg-green-50' : 'border-amber-200 bg-amber-50'}`}>
        <div className="flex items-center gap-3">
          {valida ? <ShieldCheck className="h-10 w-10 text-green-700" aria-hidden="true" /> : <ShieldAlert className="h-10 w-10 text-amber-600" aria-hidden="true" />}
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-gray-500">{r.federation?.acronym} · {r.federation?.name}</p>
            <h2 className="font-display text-2xl font-bold text-ink">{valida ? t('Credencial válida') : t('Credencial {estado}', { estado: t(CREDENTIAL_STATUS_LABELS[r.status] || r.status).toLowerCase() })}</h2>
          </div>
        </div>
        <div className="mt-6 flex items-center gap-4">
          <V2Avatar name={r.name} photoUrl={r.photo_url} size="lg" />
          <div className="min-w-0">
            <p className="font-display text-xl font-bold text-ink">{r.name}</p>
            <p className="text-sm text-gray-700">{t(COURSE_KIND_LABELS[r.credential_kind] || COURSE_KIND_LABELS.clinic)}{r.level ? ` · ${r.level}` : ''}</p>
            {r.course_name && <p className="text-sm text-gray-700">{r.course_name}</p>}
            {r.issued_at && <p className="text-sm text-gray-700">{t('Emitida em {data}', { data: quando(r.issued_at) })}{r.valid_until ? ` · ${t('válida até {data}', { data: quando(r.valid_until) })}` : ''}</p>}
          </div>
        </div>
      </div>
    );
  }
  const emDia = r.status === MEMBER_STATUS.ACTIVE;
  return (
    <div className={`rounded-4xl border p-8 ${emDia ? 'border-green-200 bg-green-50' : 'border-amber-200 bg-amber-50'}`}>
      <div className="flex items-center gap-3">
        {emDia ? <ShieldCheck className="h-10 w-10 text-green-700" aria-hidden="true" /> : <ShieldAlert className="h-10 w-10 text-amber-600" aria-hidden="true" />}
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-gray-500">{r.federation?.acronym} · {r.federation?.name}</p>
          <h2 className="font-display text-2xl font-bold text-ink">{emDia ? t('Filiação em dia') : t(MEMBER_STATUS_LABELS[r.status] || 'Filiação irregular')}</h2>
        </div>
      </div>
      <div className="mt-6 flex items-center gap-4">
        <V2Avatar name={r.name} photoUrl={r.photo_url} size="lg" />
        <div className="min-w-0">
          <p className="font-display text-xl font-bold text-ink">{r.name}</p>
          <p className="text-sm text-gray-700">{t(PLAN_PERSON_TYPE_LABELS[r.person_type] || PLAN_PERSON_TYPE_LABELS.athlete)} · {t(PLAN_TIER_LABELS[r.tier] || PLAN_TIER_LABELS.federated)}</p>
          {r.member_number && <p className="text-sm text-gray-700">{t('Nº {numero}', { numero: r.member_number })}</p>}
          {r.valid_until && <p className="text-sm text-gray-700">{t('Válida até {data}', { data: quando(r.valid_until) })}</p>}
        </div>
      </div>
    </div>
  );
}

export default function PublicFederationVerify() {
  const { codigo } = useParams();
  const navigate = useNavigate();
  const { flags, isLoading: flagsLoading } = useFeatureFlags();
  const ligada = Boolean(flags?.[FEATURE_FLAG.FEDERATIONS]);
  const code = normalizeCardCode(codigo || '');
  const vq = useCardVerification(ligada && code ? code : null);
  const [digitado, setDigitado] = useState('');
  useDocumentMeta({ title: t('Verificar carteirinha de federação'), description: t('Confira se a filiação está em dia.') }, true);
  if (!flagsLoading && !ligada) return <Navigate to="/" replace />;
  return (
    <div className="min-h-screen bg-paper">
      <div className="mx-auto max-w-[560px] space-y-6 px-4 py-10">
        <header className="text-center">
          <IdCard className="mx-auto h-10 w-10 text-ink" aria-hidden="true" />
          <h1 className="mt-3 font-display text-3xl font-bold text-ink">{t('Verificar carteirinha')}</h1>
          <p className="mt-2 text-sm text-gray-500">{t('A carteirinha digital de federação do PickleRush traz um código. Leia o QR ou digite-o aqui.')}</p>
        </header>
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); const c = normalizeCardCode(digitado); if (c) navigate(verifyPath(c)); }}>
          <V2Input aria-label={t('Código da carteirinha')} value={digitado} onChange={(e) => setDigitado(e.target.value.toUpperCase())} placeholder={code || 'ABCD-EFGH-JK'} maxLength={14} className="font-mono uppercase" />
          <V2Button type="submit"><BadgeCheck className="h-4 w-4" aria-hidden="true" />{t('Verificar')}</V2Button>
        </form>
        {code && (flagsLoading || vq.isLoading ? <V2Skeleton lines={4} /> : vq.isError ? <V2ErrorState title={t('Não foi possível verificar agora')} description={t('A conexão falhou. O código continua valendo.')} onRetry={() => vq.refetch()} /> : vq.data ? <Resultado r={vq.data} /> : null)}
      </div>
    </div>
  );
}
