/**
 * A MINHA PROTEÇÃO DE MENORES neste clube (Bloco E2b): para quem tem cargo na diretoria ou foi
 * incluído como treinador/voluntário — aceitar o compromisso de conduta e enviar a certidão de
 * antecedentes — e, para o associado menor de idade, o responsável legal. Só aparece a quem a
 * regra do clube alcança; fonte que falha vira "Tentar de novo", nunca "você está em dia".
 */
import React, { useState } from 'react';
import { toast } from 'sonner';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ShieldCheck, Upload } from 'lucide-react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { assocKeys } from '@/modules/clubs/hooks/useClubAssociation';
import { useClubSafeguardingAction, useMyClubProtection } from '@/modules/clubs/hooks/useClubSafeguarding';
import { submitClubBackground } from '@/modules/clubs/services/clubSafeguardingService';
import { GUARDIAN_RELATION_LABELS, SG_FOREVER, defaultPledgeText } from '@/modules/clubs/domain/safeguarding';
import { BACKGROUND_STATUS_LABELS } from '@/modules/federations/domain/safeguarding';
import { isoDateBR } from '@/modules/federations/domain/referees';
import { dataCurta } from '@/v2/components/federations/referees/refUi';
import { V2Badge, V2Button, V2ErrorState, V2Field, V2Input, V2Skeleton, V2Surface } from '@/v2/ui/primitives';
import ClubGuardianForm from './ClubGuardianForm';
import { t } from '@/core/i18n';

const ate = (iso) => (iso === SG_FOREVER ? t('sem vencimento') : t('até {data}', { data: dataCurta(iso) }));

function Compromisso({ clubId, eu }) {
  const m = useClubSafeguardingAction(clubId);
  const texto = eu.rules?.pledge_text || defaultPledgeText();
  return (
    <div className="space-y-2" data-dica="clube-protecao-compromisso">
      <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-ink">
        {t('1. Compromisso de conduta')}
        <V2Badge tone={eu.pledge?.ok ? 'green' : 'amber'}>{eu.pledge?.ok ? t('Aceito') : t('Falta aceitar')}</V2Badge>
      </p>
      <p className="whitespace-pre-wrap rounded-2xl bg-gray-50 p-3 text-sm leading-6 text-gray-700">{texto}</p>
      {!eu.pledge?.ok && (
        <div className="flex justify-end">
          <V2Button type="button" size="sm" disabled={m.isPending} onClick={() => m.mutate({ action: 'pledge' }, { onSuccess: () => toast.success(t('Compromisso aceito.')), onError: (er) => toast.error(er.message) })}>
            {t('Li e aceito o compromisso')}
          </V2Button>
        </div>
      )}
    </div>
  );
}

function Certidao({ clubId, eu }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [emitida, setEmitida] = useState('');
  const [arquivo, setArquivo] = useState(null);
  const bg = eu.background || {};
  const envio = useMutation({
    mutationFn: () => submitClubBackground({ clubId, uid: user?.uid, file: arquivo, issuedAt: emitida }),
    onSuccess: () => { toast.success(t('Certidão enviada. A disciplina do clube confere e você recebe um aviso.')); setArquivo(null); setEmitida(''); },
    onError: (er) => toast.error(er.message),
    onSettled: () => qc.invalidateQueries({ queryKey: assocKeys.all(clubId) }),
  });
  const podeEnviar = !eu.pending;
  return (
    <div className="space-y-2" data-dica="clube-protecao-certidao">
      <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-ink">
        {t('2. Certidão de antecedentes criminais')}
        {bg.valid ? <V2Badge tone="green">{t('Conferida {ate}', { ate: ate(bg.until) })}</V2Badge>
          : eu.pending ? <V2Badge tone="amber">{t('Em conferência')}</V2Badge>
            : <V2Badge tone="amber">{t(BACKGROUND_STATUS_LABELS[bg.status] || 'Falta enviar')}</V2Badge>}
      </p>
      {eu.last_rejection?.reason && !eu.pending && !bg.valid && <p className="text-sm text-red-700">{t('A última não foi aceita: {motivo}', { motivo: eu.last_rejection.reason })}</p>}
      {eu.revoked_reason && !bg.valid && <p className="text-sm text-red-700">{t('A conferência foi revogada: {motivo}', { motivo: eu.revoked_reason })}</p>}
      {eu.pending && <p className="text-sm text-gray-600">{t('Enviada (emitida em {data}). A disciplina do clube confere em breve; depois o arquivo é apagado e o clube guarda só a validade.', { data: dataCurta(eu.pending.issued_at) })}</p>}
      {podeEnviar && (
        <form
          noValidate
          className="space-y-3"
          onSubmit={(e) => { e.preventDefault(); if (!arquivo || !emitida) { toast.error(t('Informe a data de emissão e escolha o arquivo.')); return; } envio.mutate(); }}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <V2Field label={t('Data de emissão da certidão')} htmlFor="cmp-emissao" required>
              <V2Input id="cmp-emissao" type="date" max={isoDateBR()} value={emitida} onChange={(e) => setEmitida(e.target.value)} />
            </V2Field>
            <V2Field label={t('Arquivo (PDF ou foto, até 5 MB)')} htmlFor="cmp-arquivo" required hint={t('Só a disciplina do clube abre; depois de conferido o arquivo é apagado.')}>
              <input id="cmp-arquivo" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" className="block w-full text-sm text-gray-700 file:mr-3 file:rounded-xl file:border-0 file:bg-gray-100 file:px-3 file:py-2 file:text-sm file:font-semibold" onChange={(e) => setArquivo(e.target.files?.[0] || null)} />
            </V2Field>
          </div>
          <div className="flex justify-end">
            <V2Button type="submit" size="sm" disabled={envio.isPending}><Upload className="h-4 w-4" />{envio.isPending ? t('Enviando…') : eu.pending ? t('Enviar outra') : t('Enviar a certidão')}</V2Button>
          </div>
        </form>
      )}
    </div>
  );
}

function Menor({ clubId, eu }) {
  const [editar, setEditar] = useState(false);
  const g = eu.minor?.guardian;
  return (
    <div className="space-y-2" data-dica="clube-protecao-responsavel">
      <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-ink">
        {t('Responsável legal')}
        <V2Badge tone={g ? 'green' : 'amber'}>{g ? t('Registrado') : t('Falta registrar')}</V2Badge>
      </p>
      {!g && !editar && <p className="text-sm text-gray-600">{t('Você tem menos de 18 anos. O clube precisa do nome e do telefone do seu responsável legal, com a autorização para você participar.')}</p>}
      {g && !editar && (
        <ul className="text-sm text-gray-700">
          <li>{g.name} · {t(GUARDIAN_RELATION_LABELS[g.relation] || g.relation)}</li>
          <li>{g.phone}</li>
          <li>{g.consent ? t('Participação autorizada') : t('Participação não autorizada')} · {g.image_consent ? t('uso de imagem autorizado') : t('uso de imagem não autorizado')}</li>
        </ul>
      )}
      {editar
        ? <ClubGuardianForm clubId={clubId} initial={g} onDone={() => setEditar(false)} onCancel={() => setEditar(false)} />
        : <div className="flex justify-end"><V2Button type="button" size="sm" variant={g ? 'ghost' : 'primary'} onClick={() => setEditar(true)}>{g ? t('Corrigir os dados') : t('Registrar o responsável')}</V2Button></div>}
    </div>
  );
}

export default function ClubMyProtection({ clubId }) {
  const q = useMyClubProtection(clubId);
  if (q.isLoading) return <V2Skeleton className="h-24 rounded-3xl" />;
  if (q.isError) return <V2ErrorState inline title={t('Não carregou a sua proteção de menores')} onRetry={() => q.refetch()} />;
  const eu = q.data;
  if (!eu || !eu.member) return null;
  const exigida = eu.required === true;
  const menor = eu.minor?.is_minor === true;
  if (!exigida && !menor) return null;
  return (
    <V2Surface variant="compacto" className="space-y-4 p-4" data-dica="clube-minha-protecao">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="flex items-center gap-2 font-bold text-ink"><ShieldCheck className="h-4 w-4" aria-hidden="true" />{exigida ? t('Proteção de menores') : t('Seus dados de menor de idade')}</p>
        {exigida && (eu.ok_state
          ? <V2Badge tone="green">{t('Em dia {ate}', { ate: ate(eu.until) })}</V2Badge>
          : <V2Badge tone="red">{t('Não pode trabalhar com menores')}</V2Badge>)}
      </div>
      {exigida && (
        <>
          <p className="text-sm text-gray-600">
            {eu.designated
              ? t('Você foi incluído como {funcao}. Para trabalhar com crianças e adolescentes pelo clube, aceite o compromisso e envie a certidão de antecedentes.', { funcao: eu.designated.label || t('treinador ou voluntário') })
              : t('Pelo seu cargo na diretoria, o clube pede o compromisso de conduta e a certidão de antecedentes para atuar com crianças e adolescentes.')}
          </p>
          <Compromisso clubId={clubId} eu={eu} />
          <Certidao clubId={clubId} eu={eu} />
        </>
      )}
      {menor && <Menor clubId={clubId} eu={eu} />}
      <p className="text-xs text-gray-500">{t('Só você e a disciplina do clube veem isto.')}</p>
    </V2Surface>
  );
}
