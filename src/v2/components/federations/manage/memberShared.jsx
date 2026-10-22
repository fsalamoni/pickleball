/**
 * Peças da secretaria que a LISTA de filiados e a PASTA de cada um dividem:
 * o diálogo de motivo (recusar/suspender), os botões de decisão da filiação e
 * os dados reservados (CPF, nascimento, responsável), que só aparecem com
 * motivo registrado. Toda decisão é do servidor (`membershipAction`).
 */
import React, { useState } from 'react';
import { toast } from 'sonner';
import { Ban, CheckCircle2, Eye, FileText, RotateCcw, XCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { membershipAction, revealMemberPrivate } from '@/modules/federations/services/federationService';
import { useFederationMutation } from '@/modules/federations/hooks/useFederations';
import { membershipState } from '@/modules/federations/domain/membership';
import { formatCpf } from '@/modules/federations/domain/privateData';
import { MEMBER_STATUS } from '@/modules/federations/domain/constants';
import { V2Button, V2Field, V2Input, V2Textarea } from '@/v2/ui/primitives';
import { t } from '@/core/i18n';
import { quando } from '../federationUi';
import MembershipDeclarationDialog from '../MembershipDeclaration';

/** Recusar / suspender: o motivo é obrigatório, porque a pessoa vai ler. */
export function MotivoDialog({ acao, member, federationId, onClose }) {
  const [motivo, setMotivo] = useState('');
  const [erro, setErro] = useState('');
  const m = useFederationMutation(() => membershipAction({ federationId, action: acao, memberId: member.id, reason: motivo }));
  const recusar = acao === 'reject';
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent sheet className="max-w-md">
        <DialogTitle>{recusar ? t('Recusar o pedido') : t('Suspender a filiação')}</DialogTitle>
        <DialogDescription>{member.user_name}. {recusar ? t('A pessoa lê o motivo e pode pedir de novo.') : t('A carteirinha deixa de verificar até você reintegrar.')}</DialogDescription>
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); m.mutate(undefined, { onSuccess: () => { toast.success(recusar ? t('Pedido recusado. A pessoa foi avisada.') : t('Filiação suspensa. A pessoa foi avisada.')); onClose(); }, onError: (er) => setErro(er.message) }); }}>
          <V2Field label={t('Motivo')} htmlFor="motivo-filiacao" error={erro} hint={t('Pelo menos 3 caracteres. A pessoa recebe este texto no aviso.')}>
            <V2Textarea id="motivo-filiacao" rows={3} maxLength={500} value={motivo} onChange={(e) => { setMotivo(e.target.value); setErro(''); }} autoFocus />
          </V2Field>
          <div className="flex justify-end gap-2">
            <V2Button type="button" variant="ghost" onClick={onClose}>{t('Voltar')}</V2Button>
            <V2Button type="submit" variant="danger" disabled={m.isPending || motivo.trim().length < 3}>{recusar ? t('Recusar') : t('Suspender')}</V2Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Os botões de decisão da filiação: aprovar/recusar o pedido, declaração de
 * vínculo, suspender e reintegrar. `children` entra antes (ex.: "Abrir pasta").
 */
export function MemberActions({ member: mb, federation, pedido = false, children = null }) {
  const federationId = federation.id;
  const [motivo, setMotivo] = useState(null);
  const [declaracao, setDeclaracao] = useState(false);
  const m = useFederationMutation((action) => membershipAction({ federationId, action, memberId: mb.id }));
  const agir = (action, msg) => m.mutate(action, { onSuccess: () => toast.success(msg), onError: (e) => toast.error(e.message) });
  const st = membershipState(mb);
  return (
    <>
      <div className="flex flex-wrap gap-2">
        {children}
        {!pedido && st.status === MEMBER_STATUS.ACTIVE && mb.card_code && <V2Button type="button" size="sm" variant="ghost" onClick={() => setDeclaracao(true)}><FileText className="h-4 w-4" />{t('Declaração')}</V2Button>}
        {pedido && (
          <>
            <V2Button type="button" size="sm" disabled={m.isPending} onClick={() => agir('approve', t('Pedido aprovado. A pessoa foi avisada.'))}><CheckCircle2 className="h-4 w-4" />{t('Aprovar')}</V2Button>
            <V2Button type="button" size="sm" variant="danger" onClick={() => setMotivo('reject')}><XCircle className="h-4 w-4" />{t('Recusar')}</V2Button>
          </>
        )}
        {!pedido && [MEMBER_STATUS.ACTIVE, MEMBER_STATUS.EXPIRED].includes(st.status) && (
          <V2Button type="button" size="sm" variant="danger" onClick={() => setMotivo('suspend')}><Ban className="h-4 w-4" />{t('Suspender')}</V2Button>
        )}
        {/* A suspensão DISCIPLINAR termina sozinha na data (ou pela Disciplina); "Reintegrar" é só da administrativa. */}
        {!pedido && st.disciplined && mb.status !== MEMBER_STATUS.SUSPENDED && (
          <p className="self-center text-xs text-gray-500">{t('Suspensão disciplinar até {data}. Encerra na Disciplina.', { data: quando(mb.discipline_until_ms) })}</p>
        )}
        {!pedido && mb.status === MEMBER_STATUS.SUSPENDED && (
          <V2Button type="button" size="sm" variant="secondary" disabled={m.isPending} onClick={() => agir('reinstate', t('Filiação reintegrada.'))}><RotateCcw className="h-4 w-4" />{t('Reintegrar')}</V2Button>
        )}
      </div>
      {motivo && <MotivoDialog acao={motivo} member={mb} federationId={federationId} onClose={() => setMotivo(null)} />}
      {declaracao && <MembershipDeclarationDialog open onOpenChange={setDeclaracao} member={mb} federation={federation} />}
    </>
  );
}

/**
 * Os dados reservados da filiação (`private/data`): CPF, nascimento e
 * responsável aparecem só depois de "Revelar", com motivo — a leitura fica na
 * auditoria da federação, como no suporte do admin.
 */
export function DadosReservados({ member: mb }) {
  const { user } = useAuth();
  const [motivo, setMotivo] = useState('');
  const [privado, setPrivado] = useState(null);
  const [erro, setErro] = useState('');
  const revelar = useFederationMutation(() => revealMemberPrivate(mb, { uid: user?.uid, reason: motivo }));
  if (privado) {
    return (
      <dl className="grid gap-1 text-sm text-gray-700">
        <div className="flex gap-2"><dt className="font-semibold">{t('CPF:')}</dt><dd>{privado.cpf ? formatCpf(privado.cpf) : t('não informado')}</dd></div>
        {privado.birth_date && <div className="flex gap-2"><dt className="font-semibold">{t('Nascimento:')}</dt><dd>{quando(privado.birth_date)}</dd></div>}
        {privado.guardian && <div className="flex gap-2"><dt className="font-semibold">{t('Responsável:')}</dt><dd>{privado.guardian.name}{privado.guardian.contact ? ` · ${privado.guardian.contact}` : ''}</dd></div>}
        {!privado.cpf && !privado.guardian && !privado.birth_date && <p className="text-gray-500">{t('Nada reservado para esta filiação.')}</p>}
      </dl>
    );
  }
  return (
    <form className="flex flex-wrap items-end gap-2" onSubmit={(e) => { e.preventDefault(); revelar.mutate(undefined, { onSuccess: (p) => setPrivado(p || {}), onError: (er) => setErro(er.message) }); }}>
      <V2Field label={t('Motivo para ver CPF e responsável')} htmlFor={`reservado-${mb.id}`} error={erro} className="flex-1" hint={t('Fica registrado na auditoria da federação.')}>
        <V2Input id={`reservado-${mb.id}`} maxLength={300} value={motivo} onChange={(e) => { setMotivo(e.target.value); setErro(''); }} />
      </V2Field>
      <V2Button type="submit" size="sm" variant="secondary" disabled={revelar.isPending || motivo.trim().length < 5}><Eye className="h-4 w-4" />{t('Revelar')}</V2Button>
    </form>
  );
}
