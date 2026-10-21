/**
 * Equipe da federação (permissão `admin`): quem faz o quê, pelos oito papéis
 * de `STAFF_ROLE`. Só o presidente passa a presidência (`canChangeStaff`); a
 * regra do Firestore confere o mesmo. A pessoa entra pela busca no diretório
 * de atletas da plataforma.
 */
import React, { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Trash2, UserCog, UserPlus } from 'lucide-react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useAthletes } from '@/modules/athletes/hooks/useAthletes';
import { removeStaff, setStaffRole } from '@/modules/federations/services/federationService';
import { useFederationMutation } from '@/modules/federations/hooks/useFederations';
import { assignableRoles, canChangeStaff } from '@/modules/federations/domain/staff';
import { STAFF_ROLE, STAFF_ROLE_DESCRIPTIONS, STAFF_ROLE_LABELS } from '@/modules/federations/domain/constants';
import { V2Avatar, V2Button, V2EmptyState, V2ErrorState, V2Field, V2SearchInput, V2Select, V2Skeleton, V2Surface } from '@/v2/ui/primitives';
import { t } from '@/core/i18n';

const normaliza = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const nomeDe = (a) => a.platform_name || a.full_name || a.display_name || '';

function NovoMembro({ federation, myRole, staff }) {
  const { user } = useAuth();
  const atletas = useAthletes();
  const [busca, setBusca] = useState('');
  const [escolhido, setEscolhido] = useState(null);
  const [role, setRole] = useState(STAFF_ROLE.SECRETARY);
  const m = useFederationMutation(() => setStaffRole(federation.id, { userId: escolhido.id, userName: nomeDe(escolhido), role, federationName: federation.name, federationAcronym: federation.acronym }, { actor: user, actorRole: myRole, targetRole: null }));
  const termo = normaliza(busca.trim());
  const jaNaEquipe = useMemo(() => new Set((staff || []).map((s) => s.user_id)), [staff]);
  const sugestoes = useMemo(() => (termo.length < 2 || !atletas.isSuccess ? [] : (atletas.data || []).filter((a) => !jaNaEquipe.has(a.id) && normaliza(nomeDe(a)).includes(termo)).slice(0, 8)), [termo, atletas.isSuccess, atletas.data, jaNaEquipe]);
  const papeis = assignableRoles(myRole);
  return (
    <V2Surface className="space-y-4" data-dica="federacao-equipe-adicionar">
      <h3 className="font-display text-lg font-bold text-ink">{t('Adicionar à equipe')}</h3>
      {atletas.isError ? <V2ErrorState inline title={t('Não carregou o diretório de atletas')} onRetry={() => atletas.refetch()} /> : (
        <>
          <V2SearchInput value={busca} onChange={(e) => { setBusca(e.target.value); setEscolhido(null); }} placeholder={t('Nome da pessoa (com conta no PickleRush)')} aria-label={t('Buscar pessoa')} />
          {!escolhido && sugestoes.length > 0 && (
            <ul className="divide-y divide-gray-100 rounded-2xl border border-gray-100">
              {sugestoes.map((a) => (
                <li key={a.id}>
                  <button type="button" onClick={() => { setEscolhido(a); setBusca(nomeDe(a)); }} className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-paper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink">
                    <V2Avatar name={nomeDe(a)} photoUrl={a.photo_url} size="sm" />
                    <span className="text-sm text-ink">{nomeDe(a)}</span>
                    {a.city && <span className="text-xs text-gray-500">· {a.city}{a.state ? `/${a.state}` : ''}</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {!escolhido && termo.length >= 2 && atletas.isSuccess && sugestoes.length === 0 && <p className="text-sm text-gray-500">{t('Ninguém com esse nome no diretório. A pessoa precisa ter conta e perfil visível.')}</p>}
        </>
      )}
      <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
        <V2Field label={t('Papel')} htmlFor="eq-papel" hint={t(STAFF_ROLE_DESCRIPTIONS[role] || '')}>
          <V2Select id="eq-papel" value={role} onChange={(e) => setRole(e.target.value)}>
            {papeis.map((r) => <option key={r} value={r}>{t(STAFF_ROLE_LABELS[r])}</option>)}
          </V2Select>
        </V2Field>
        <V2Button type="button" disabled={!escolhido || m.isPending} onClick={() => m.mutate(undefined, { onSuccess: () => { toast.success(t('{nome} entrou na equipe.', { nome: nomeDe(escolhido) })); setEscolhido(null); setBusca(''); }, onError: (e) => toast.error(e.message) })}>
          <UserPlus className="h-4 w-4" />{t('Adicionar')}
        </V2Button>
      </div>
    </V2Surface>
  );
}

function StaffRow({ federation, s, myRole, uid }) {
  const trocar = useFederationMutation((role) => setStaffRole(federation.id, { userId: s.user_id, userName: s.user_name, role, federationName: federation.name, federationAcronym: federation.acronym }, { actor: { uid }, actorRole: myRole, targetRole: s.role }));
  const tirar = useFederationMutation(() => removeStaff(federation.id, s.user_id, { actor: { uid }, actorRole: myRole, targetRole: s.role }));
  const euMesmo = s.user_id === uid;
  const podeTrocar = assignableRoles(myRole).filter((r) => r !== s.role).some((r) => canChangeStaff({ actorRole: myRole, targetRole: s.role, newRole: r, isSelf: euMesmo }));
  const podeTirar = !euMesmo && s.role !== STAFF_ROLE.PRESIDENT && canChangeStaff({ actorRole: myRole, targetRole: s.role, newRole: STAFF_ROLE.SECRETARY, isSelf: false });
  return (
    <li>
      <V2Surface variant="compacto" className="flex flex-wrap items-center gap-3 p-4">
        <V2Avatar name={s.user_name} photoUrl={s.photo_url} />
        <div className="min-w-0 flex-1">
          <p className="font-bold text-ink">{s.user_name}{euMesmo ? ` (${t('você')})` : ''}</p>
          <p className="text-xs text-gray-500">{t(STAFF_ROLE_DESCRIPTIONS[s.role] || '')}</p>
        </div>
        {podeTrocar ? (
          <V2Select aria-label={t('Papel de {nome}', { nome: s.user_name })} value={s.role} disabled={trocar.isPending} onChange={(e) => trocar.mutate(e.target.value, { onSuccess: () => toast.success(t('Papel atualizado.')), onError: (er) => toast.error(er.message) })} className="w-auto">
            {assignableRoles(myRole).map((r) => <option key={r} value={r} disabled={!canChangeStaff({ actorRole: myRole, targetRole: s.role, newRole: r, isSelf: euMesmo }) && r !== s.role}>{t(STAFF_ROLE_LABELS[r])}</option>)}
          </V2Select>
        ) : <span className="rounded-full bg-paper px-3 py-1 text-sm font-semibold text-ink">{t(STAFF_ROLE_LABELS[s.role] || s.role)}</span>}
        {podeTirar && <V2Button type="button" size="sm" variant="ghost" aria-label={t('Tirar {nome} da equipe', { nome: s.user_name })} disabled={tirar.isPending} onClick={() => tirar.mutate(undefined, { onSuccess: () => toast.success(t('{nome} saiu da equipe.', { nome: s.user_name })), onError: (er) => toast.error(er.message) })}><Trash2 className="h-4 w-4" /></V2Button>}
      </V2Surface>
    </li>
  );
}

export default function FedStaffPanel({ federation, staffQ, myRole }) {
  const { user } = useAuth();
  if (staffQ.isError) return <V2ErrorState title={t('Não carregou a equipe')} onRetry={() => staffQ.refetch()} />;
  if (staffQ.isLoading) return <V2Skeleton lines={5} />;
  const ordem = Object.values(STAFF_ROLE);
  const lista = [...(staffQ.data || [])].sort((a, b) => ordem.indexOf(a.role) - ordem.indexOf(b.role) || String(a.user_name).localeCompare(String(b.user_name), 'pt-BR'));
  return (
    <section className="space-y-4" aria-label={t('Equipe da federação')} data-dica="federacao-equipe">
      <div><h2 className="font-display text-xl font-bold text-ink">{t('Equipe')}</h2><p className="text-sm text-gray-500">{t('Cada papel abre só a parte da Central que lhe cabe. Presidente e diretor veem tudo; só o presidente passa a presidência.')}</p></div>
      {/* Sem a lista na mão não se oferece adicionar: a equipe é gravada pessoa a pessoa, mas o papel repetido confundiria. */}
      {!lista.length ? <V2EmptyState icon={UserCog} title={t('Só você na equipe')} /> : <ul className="space-y-3">{lista.map((s) => <StaffRow key={s.id} federation={federation} s={s} myRole={myRole} uid={user?.uid} />)}</ul>}
      <NovoMembro federation={federation} myRole={myRole} staff={lista} />
    </section>
  );
}
