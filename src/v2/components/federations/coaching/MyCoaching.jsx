/**
 * Minha área → Federações → "Licença de professor e proteção de menores": a
 * licença da pessoa em cada federação (pedir, pedir a renovação, mostrar ou
 * não o selo no perfil, com os requisitos de cada nível conferidos pelo
 * servidor) e a proteção de menores (o curso, a certidão de antecedentes —
 * enviar, acompanhar a conferência). Só o que é da própria pessoa: nem o
 * caminho do arquivo nem quem conferiu chegam aqui (`me` no servidor).
 */
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { FileUp, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useMyCoaching } from '@/modules/federations/hooks/useCoaching';
import { useFederationMutation } from '@/modules/federations/hooks/useFederations';
import { coachingAction, submitBackground } from '@/modules/federations/services/coachingService';
import { LICENSE_LIMITS, licenseState } from '@/modules/federations/domain/coachLicenses';
import { BACKGROUND_STATUS_LABELS, SG_FOREVER, SG_ROLE_LABELS, validateBackgroundSubmit } from '@/modules/federations/domain/safeguarding';
import { validateDocumentFile } from '@/modules/federations/domain/privateData';
import { isoDateBR } from '@/modules/federations/domain/referees';
import { V2Badge, V2Button, V2ErrorState, V2Field, V2Input, V2Select, V2Skeleton, V2Textarea, V2Toggle } from '@/v2/ui/primitives';
import { t } from '@/core/i18n';
import { FedLogo, fedPath } from '../federationUi';
import { dataCurta } from '../referees/refUi';
import { LicenseBadge, RequirementsList } from './coachingUi';

const ate = (iso) => (iso === SG_FOREVER ? t('sem vencimento') : t('até {data}', { data: dataCurta(iso) }));

function Licenca({ fed, me }) {
  const hoje = isoDateBR();
  const lic = me.license;
  const s = licenseState(lic, hoje);
  const [level, setLevel] = useState(lic?.level || me.levels?.[0]?.id || '');
  const [nota, setNota] = useState('');
  const pedir = useFederationMutation(() => coachingAction({ federationId: fed.id, action: 'license_apply', level, note: nota }));
  const prefs = useFederationMutation((v) => coachingAction({ federationId: fed.id, action: 'license_prefs', publicListing: v }));
  const nivel = (me.levels || []).find((l) => l.id === level);
  const podePedir = s.canApply && !['suspended', 'revoked'].includes(lic?.status);
  const enviar = (e) => {
    e.preventDefault();
    pedir.mutate(undefined, { onSuccess: (r) => { toast.success(r.renewal ? t('Renovação pedida. A federação vai conferir.') : t('Licença pedida. A federação vai conferir.')); setNota(''); }, onError: (er) => toast.error(er.message) });
  };
  return (
    <div className="space-y-3">
      <p className="flex flex-wrap items-center gap-2 text-sm font-bold text-ink">{t('Licença de professor')}{lic && <LicenseBadge lic={lic} hoje={hoje} />}</p>
      {lic && (
        <p className="text-xs text-gray-500">
          {[lic.level_label, lic.valid_until && t('válida até {data}', { data: dataCurta(lic.valid_until) })].filter(Boolean).join(' · ')}
          {lic.decision_reason && ['declined', 'suspended', 'revoked'].includes(lic.status) ? ` · ${t('Motivo: {motivo}', { motivo: lic.decision_reason })}` : ''}
        </p>
      )}
      {s.valid && (
        <V2Toggle id={`lic-selo-${fed.id}`} checked={lic.public_listing !== false} disabled={prefs.isPending}
          onChange={(v) => prefs.mutate(v, { onSuccess: () => toast.success(v ? t('O selo aparece no seu perfil.') : t('O selo saiu do seu perfil.')), onError: (er) => toast.error(er.message) })}
          label={t('Mostrar o selo "Professor credenciado pela {sigla}" no meu perfil', { sigla: fed.acronym || fed.name })} />
      )}
      {lic?.status === 'pending' && <p className="text-sm text-gray-600">{t('Seu pedido está em análise. Você recebe um aviso quando a federação decidir.')}</p>}
      {s.renewing && <p className="text-sm text-gray-600">{t('Sua renovação está em análise.')}</p>}
      {podePedir && (!s.valid || s.expiring) && (
        <form onSubmit={enviar} noValidate className="space-y-3 rounded-2xl border border-gray-100 p-3" data-dica="minha-area-licenca-pedir">
          <V2Field label={t('Nível')} htmlFor={`lic-nivel-${fed.id}`}>
            <V2Select id={`lic-nivel-${fed.id}`} value={level} onChange={(e) => setLevel(e.target.value)}>
              {(me.levels || []).map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
            </V2Select>
          </V2Field>
          {nivel && <RequirementsList req={nivel.requirements} />}
          {nivel && !nivel.requirements.ok && <p className="text-xs text-gray-500">{t('Dá para pedir assim mesmo: a federação confere e pode dispensar a credencial ou as horas com motivo. A proteção de menores não se dispensa.')}</p>}
          <V2Field label={t('Recado para a federação (opcional)')} htmlFor={`lic-nota-${fed.id}`}>
            <V2Textarea id={`lic-nota-${fed.id}`} rows={2} maxLength={LICENSE_LIMITS.NOTE_MAX} value={nota} onChange={(e) => setNota(e.target.value)} />
          </V2Field>
          <V2Button type="submit" size="sm" disabled={pedir.isPending || !level}>{s.valid ? t('Pedir a renovação') : t('Pedir a licença')}</V2Button>
        </form>
      )}
    </div>
  );
}

function Protecao({ fed, sg }) {
  const { user } = useAuth();
  const hoje = isoDateBR();
  const [emissao, setEmissao] = useState('');
  const [arquivo, setArquivo] = useState(null);
  const v = validateBackgroundSubmit({ issued_at: emissao, hoje, rules: sg.rules });
  const enviar = useFederationMutation(() => submitBackground({ fedId: fed.id, uid: user?.uid, file: arquivo, issuedAt: emissao }));
  const bg = sg.background || {};
  const mandar = (e) => {
    e.preventDefault();
    if (!arquivo) { toast.error(t('Escolha o arquivo da certidão.')); return; }
    if (!v.ok) { toast.error(Object.values(v.errors)[0]); return; }
    enviar.mutate(undefined, { onSuccess: () => { toast.success(t('Certidão enviada. O responsável pela proteção vai conferir.')); setArquivo(null); setEmissao(''); }, onError: (er) => toast.error(er.message) });
  };
  const exigido = (sg.rules?.required_for || []).map((r) => t(SG_ROLE_LABELS[r])).join(', ');
  return (
    <div className="space-y-3">
      <p className="flex flex-wrap items-center gap-2 text-sm font-bold text-ink">
        {t('Proteção de menores')}
        {sg.ok ? <V2Badge tone="green">{t('Em dia {ate}', { ate: ate(sg.until) })}</V2Badge> : <V2Badge tone="amber">{t('Não está em dia')}</V2Badge>}
      </p>
      {exigido && <p className="text-xs text-gray-500">{t('A federação exige de: {papeis}.', { papeis: exigido })}</p>}
      <ul className="space-y-1 text-sm text-gray-700">
        <li>{sg.training_until && sg.training_until >= hoje ? t('Curso de proteção válido {ate}.', { ate: ate(sg.training_until) }) : <>{t('Falta o curso de proteção de menores da federação.')} <Link className="font-semibold underline" to={`${fedPath(fed)}?aba=cursos`}>{t('Ver os cursos')}</Link></>}</li>
        <li>{bg.valid ? t('Certidão de antecedentes conferida {ate}.', { ate: ate(bg.until) }) : t(BACKGROUND_STATUS_LABELS[bg.status] || 'Sem certidão de antecedentes conferida.')}</li>
        {sg.revoked_reason && <li className="text-red-700">{t('Motivo da revogação: {motivo}', { motivo: sg.revoked_reason })}</li>}
        {sg.pending && <li className="text-amber-700">{t('Certidão emitida em {data} em conferência.', { data: dataCurta(sg.pending.issued_at) })}</li>}
        {!sg.pending && sg.last_rejection?.reason && <li className="text-red-700">{t('A última certidão não foi aceita: {motivo}', { motivo: sg.last_rejection.reason })}</li>}
      </ul>
      {!sg.pending && (
        <form onSubmit={mandar} noValidate className="space-y-3 rounded-2xl border border-gray-100 p-3" data-dica="minha-area-certidao">
          <p className="text-xs text-gray-500">{t('Certidão de antecedentes criminais (Justiça Federal, Estadual ou Polícia Civil), em PDF ou foto, até 5 MB. Só o responsável pela proteção vê, e o arquivo é apagado depois da conferência.')}</p>
          <V2Field label={t('Data de emissão')} htmlFor={`sg-emissao-${fed.id}`} error={emissao ? v.errors.issued_at : undefined}>
            <V2Input id={`sg-emissao-${fed.id}`} type="date" max={hoje} value={emissao} onChange={(e) => setEmissao(e.target.value)} />
          </V2Field>
          <label htmlFor={`sg-arquivo-${fed.id}`} className="inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-full border border-gray-200 px-3 py-1.5 text-sm font-semibold text-ink hover:border-ink focus-within:ring-4 focus-within:ring-acid/30 coarse:min-h-11">
            <FileUp className="h-4 w-4" aria-hidden="true" />{arquivo ? arquivo.name : t('Escolher arquivo')}
            <input id={`sg-arquivo-${fed.id}`} type="file" accept="application/pdf,image/jpeg,image/png,image/webp" className="sr-only" aria-label={t('Arquivo da certidão')}
              onChange={(e) => { const file = e.target.files?.[0]; e.target.value = ''; if (!file) return; const erro = validateDocumentFile(file); if (erro) { toast.error(erro); return; } setArquivo(file); }} />
          </label>
          <div><V2Button type="submit" size="sm" disabled={enviar.isPending || !arquivo || !emissao}><ShieldCheck className="h-4 w-4" />{enviar.isPending ? t('Enviando…') : t('Enviar certidão')}</V2Button></div>
        </form>
      )}
    </div>
  );
}

/** Uma federação: a licença (se ligada e a pessoa é professor ou tem licença) e a proteção (se ligada). */
export function MyCoachingFed({ fed, isCoach = false, hasLicense = false }) {
  const q = useMyCoaching(fed.id);
  if (q.isLoading) return <V2Skeleton lines={2} />;
  if (q.isError) return <V2ErrorState inline title={t('Não carregou a sua licença na {sigla}', { sigla: fed.acronym || fed.name })} onRetry={() => q.refetch()} />;
  const me = q.data || {};
  const licenca = me.coach_licenses && (isCoach || hasLicense || me.license);
  if (!licenca && !me.safeguarding) return null;
  return (
    <li className="space-y-4 rounded-2xl border border-gray-100 p-4">
      <p className="flex items-center gap-2 font-bold text-ink"><FedLogo federation={fed} size="sm" />{fed.name || fed.acronym}</p>
      {licenca && <Licenca fed={fed} me={me} />}
      {me.safeguarding && <Protecao fed={fed} sg={me.sg} />}
    </li>
  );
}
