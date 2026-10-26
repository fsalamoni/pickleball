/**
 * Registrar uma chapa (ou candidatura individual): o cargo, as pessoas (da
 * lista de usuários, já com quem registra), o cargo e o sexo de cada uma
 * (contam para o mínimo de cada sexo) e a proposta. O servidor confere a
 * filiação de todos, a comissão e chapa repetida; a tela só adianta.
 */
import React, { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { validateCandidacy } from '@/modules/federations/domain/elections';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { V2Button, V2Field, V2Input, V2Select, V2Textarea } from '@/v2/ui/primitives';
import { t } from '@/core/i18n';
import FedPersonPicker from '../manage/FedPersonPicker';
import { useAvisoNaoSalvo } from '../manage/naoSalvo';
import { isClubElections, useScopedElectionAction } from './electionsScope';

const nomeDaPessoa = (a) => a?.platform_name || a?.full_name || a?.display_name || '';

function Formulario({ federation, election: e, onClose }) {
  const { user, userProfile } = useAuth();
  const acao = useScopedElectionAction(federation);
  const clube = isClubElections(federation);
  const [positionId, setPositionId] = useState(e.positions?.[0]?.id || '');
  const [nome, setNome] = useState('');
  const [proposta, setProposta] = useState('');
  const [pessoas, setPessoas] = useState(() => (user?.uid ? [{ id: user.uid, platform_name: userProfile?.platform_name || user.displayName || '' }] : []));
  const [extra, setExtra] = useState({});
  const [tentou, setTentou] = useState(false);
  useAvisoNaoSalvo(Boolean(nome || proposta || pessoas.length > 1));
  const position = (e.positions || []).find((p) => p.id === positionId);
  const chapa = !position || position.kind === 'slate';
  const candidacy = {
    position_id: positionId, name: nome, platform: proposta,
    members: pessoas.map((a) => ({ uid: a.id, name: nomeDaPessoa(a), role: extra[a.id]?.role || '', gender: extra[a.id]?.gender || '' })),
  };
  const v = useMemo(() => validateCandidacy(candidacy, position), [JSON.stringify(candidacy), position]); // eslint-disable-line react-hooks/exhaustive-deps
  const erro = (k) => (tentou ? v.errors[k] : undefined);
  const setExtraDe = (uid, campo, valor) => setExtra((x) => ({ ...x, [uid]: { ...(x[uid] || {}), [campo]: valor } }));
  const enviar = () => {
    setTentou(true);
    if (!v.ok) return;
    acao.mutate({ federationId: federation.id, action: 'candidacy_submit', electionId: e.id, candidacy }, {
      onSuccess: (res) => {
        toast.success(res.endorsementsNeeded ? (clube ? t('Chapa registrada. Agora ela precisa de {n} apoios de associados: compartilhe o link de apoio.', { n: res.endorsementsNeeded }) : t('Chapa registrada. Agora ela precisa de {n} apoios de filiados: compartilhe o link de apoio.', { n: res.endorsementsNeeded })) : t('Chapa registrada. A comissão vai analisar.'));
        onClose(res.candidacyId);
      },
      onError: (er) => toast.error(er.message),
    });
  };
  return (
    <div className="space-y-4">
      <V2Field label={t('Cargo')} htmlFor="ch-cargo" error={erro('position_id')}>
        <V2Select id="ch-cargo" value={positionId} onChange={(ev) => setPositionId(ev.target.value)}>
          {(e.positions || []).map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
        </V2Select>
      </V2Field>
      {chapa && (
        <V2Field label={t('Nome da chapa')} htmlFor="ch-nome" error={erro('name')}>
          <V2Input id="ch-nome" maxLength={80} value={nome} onChange={(ev) => setNome(ev.target.value)} />
        </V2Field>
      )}
      <V2Field label={chapa ? t('Quem está na chapa') : t('Candidato(a)')} htmlFor="ch-pessoas" error={erro('members') || erro('gender_min')} hint={clube ? t('Todos precisam ser associados em dia do clube. Quem registra faz parte.') : t('Todos precisam ter filiação ativa nesta federação. Quem registra faz parte.')}>
        <FedPersonPicker id="ch-pessoas" multiple={chapa} max={chapa ? 20 : 1} selecionados={pessoas} onChange={setPessoas} />
      </V2Field>
      {pessoas.length > 0 && (
        <ul className="space-y-2">
          {pessoas.map((a, i) => (
            <li key={a.id} className="grid gap-2 rounded-2xl border border-gray-100 p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_9rem] sm:items-end">
              <p className="self-center font-semibold text-ink">{nomeDaPessoa(a) || '—'}</p>
              {chapa ? (
                <V2Field label={t('Cargo na chapa')} htmlFor={`ch-role-${a.id}`} error={erro(`members.${i}.role`)}>
                  <V2Input id={`ch-role-${a.id}`} maxLength={60} placeholder={t('Ex.: Presidente')} value={extra[a.id]?.role || ''} onChange={(ev) => setExtraDe(a.id, 'role', ev.target.value)} />
                </V2Field>
              ) : <span />}
              <V2Field label={t('Sexo')} htmlFor={`ch-sexo-${a.id}`} error={erro(`members.${i}.gender`)}>
                <V2Select id={`ch-sexo-${a.id}`} value={extra[a.id]?.gender || ''} onChange={(ev) => setExtraDe(a.id, 'gender', ev.target.value)}>
                  <option value="">{t('Escolha')}</option>
                  <option value="f">{t('Feminino')}</option>
                  <option value="m">{t('Masculino')}</option>
                </V2Select>
              </V2Field>
            </li>
          ))}
        </ul>
      )}
      <V2Field label={t('Proposta (opcional)')} htmlFor="ch-proposta" hint={clube ? t('Aparece na página para os associados lerem antes de votar.') : t('Aparece na página para os filiados lerem antes de votar.')}>
        <V2Textarea id="ch-proposta" rows={5} maxLength={4000} value={proposta} onChange={(ev) => setProposta(ev.target.value)} />
      </V2Field>
      <div className="flex flex-wrap justify-end gap-2">
        <V2Button type="button" variant="ghost" onClick={() => onClose(null)}>{t('Cancelar')}</V2Button>
        <V2Button type="button" disabled={acao.isPending} onClick={enviar} data-dica="federacao-eleicao-registrar-chapa">{t('Registrar')}</V2Button>
      </div>
    </div>
  );
}

export default function CandidacyDialog({ federation, election, open, onClose }) {
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(null); }}>
      <DialogContent className="max-h-[90dvh] max-w-2xl overflow-y-auto">
        <DialogTitle>{t('Registrar chapa')}</DialogTitle>
        <DialogDescription>{election.title}</DialogDescription>
        {open && <Formulario federation={federation} election={election} onClose={onClose} />}
      </DialogContent>
    </Dialog>
  );
}
