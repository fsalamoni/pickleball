/**
 * A POSSE dos eleitos do clube (Bloco F2): depois do resultado publicado, a administração
 * escolhe o CARGO de cada eleito entre os cargos do clube (modelos ou montados por ela) e o
 * servidor grava a nomeação com mandato (`apply_governance`). Quem ficar sem cargo escolhido
 * não é empossado agora — dá para voltar aqui depois. A posse só vale para quem foi eleito
 * nesta eleição e é membro do clube; as permissões vêm do cargo, nunca da eleição.
 */
import React, { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Check } from 'lucide-react';
import { effectiveRoles, roleLabel } from '@/modules/clubs/domain/staff';
import { electedPeople, suggestRoleFor } from '@/modules/clubs/domain/elections';
import { useClubRoles } from '@/modules/clubs/hooks/useClubAssociation';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { V2Badge, V2Button, V2ErrorState, V2Field, V2Input, V2Select, V2Skeleton } from '@/v2/ui/primitives';
import { t } from '@/core/i18n';
import { useScopedCandidacies, useScopedElectionAction } from './electionsScope';

/** Cada eleito aparece uma vez, com todos os cargos em que foi eleito. */
function pessoasEleitas(election, candidacies) {
  const mapa = new Map();
  electedPeople(election.results, election.positions, candidacies).forEach((p) => {
    if (!p.uid) return;
    const atual = mapa.get(p.uid);
    if (atual) atual.labels.push(p.label);
    else mapa.set(p.uid, { ...p, labels: [p.label] });
  });
  return [...mapa.values()];
}

function Corpo({ club, election: e, onClose }) {
  const rolesQ = useClubRoles(club.id);
  const chapasQ = useScopedCandidacies(club, e.id, { all: true });
  const acao = useScopedElectionAction(club);
  const [escolhas, setEscolhas] = useState({});
  const [fim, setFim] = useState('');

  const roles = useMemo(() => effectiveRoles(rolesQ.data), [rolesQ.data]);
  const eleitos = useMemo(() => (chapasQ.data ? pessoasEleitas(e, chapasQ.data) : []), [e, chapasQ.data]);
  const empossados = new Set((e.appointed || []).map((x) => x.user_id));

  if (rolesQ.isError || chapasQ.isError) return <V2ErrorState inline title={t('Não carregaram os cargos e os eleitos')} onRetry={() => { rolesQ.refetch(); chapasQ.refetch(); }} />;
  if (rolesQ.isLoading || chapasQ.isLoading) return <V2Skeleton lines={4} />;
  if (!eleitos.length) return <p className="text-sm text-gray-500">{t('O resultado não trouxe eleitos para empossar.')}</p>;

  const valor = (p) => (escolhas[p.uid] !== undefined ? escolhas[p.uid] : (empossados.has(p.uid) ? '' : suggestRoleFor(p, roles)));
  const linhas = eleitos.map((p) => ({ p, roleId: valor(p) })).filter((x) => x.roleId);
  const enviar = () => {
    acao.mutate({
      action: 'apply_governance', electionId: e.id,
      appointments: linhas.map(({ p, roleId }) => ({ userId: p.uid, roleId, ...(fim ? { termEnd: fim } : {}) })),
    }, {
      onSuccess: (res) => { toast.success(t('{n} pessoa(s) empossada(s).', { n: res?.appointed || linhas.length })); onClose(); },
      onError: (er) => toast.error(er.message),
    });
  };

  return (
    <div className="space-y-4">
      <ul className="space-y-3">
        {eleitos.map((p) => (
          <li key={p.uid} className="grid gap-2 rounded-2xl border border-gray-100 p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,14rem)] sm:items-end">
            <div className="min-w-0">
              <p className="font-semibold text-ink">{p.name}</p>
              <p className="text-xs text-gray-500">{t('Eleito(a) para {cargo}', { cargo: p.labels.join(', ') })}{p.role ? ` · ${p.role}` : ''}</p>
              {empossados.has(p.uid) && <V2Badge tone="green" className="mt-1"><Check className="mr-1 h-3 w-3" aria-hidden="true" />{t('Já empossado(a)')}</V2Badge>}
            </div>
            <V2Field label={t('Cargo no clube')} htmlFor={`posse-${p.uid}`}>
              <V2Select id={`posse-${p.uid}`} value={valor(p)} onChange={(ev) => setEscolhas((x) => ({ ...x, [p.uid]: ev.target.value }))}>
                <option value="">{t('Sem cargo agora')}</option>
                {roles.map((r) => <option key={r.id} value={r.id}>{roleLabel(r)}</option>)}
              </V2Select>
            </V2Field>
          </li>
        ))}
      </ul>
      <V2Field label={t('Fim do mandato (opcional)')} htmlFor="posse-fim" hint={t('Em branco, vale a duração padrão de cada cargo.')}>
        <V2Input id="posse-fim" type="date" className="sm:w-48" value={fim} onChange={(ev) => setFim(ev.target.value)} />
      </V2Field>
      <p className="text-xs text-gray-500">{t('O cargo dá as permissões da Central do clube; a eleição só indica quem assume. Quem estiver sem cargo escolhido fica de fora por enquanto.')}</p>
      <div className="flex flex-wrap justify-end gap-2">
        <V2Button type="button" variant="ghost" onClick={onClose}>{t('Cancelar')}</V2Button>
        <V2Button type="button" disabled={acao.isPending || !linhas.length} onClick={enviar} data-dica="clube-eleicao-posse-confirmar">{t('Dar posse')}</V2Button>
      </div>
    </div>
  );
}

export default function ClubPosseDialog({ club, election, open, onClose }) {
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-h-[90dvh] max-w-2xl overflow-y-auto">
        <DialogTitle>{t('Dar posse aos eleitos')}</DialogTitle>
        <DialogDescription>{election.title}</DialogDescription>
        {open && <Corpo club={club} election={election} onClose={onClose} />}
      </DialogContent>
    </Dialog>
  );
}
