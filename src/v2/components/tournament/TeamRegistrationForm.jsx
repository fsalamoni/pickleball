/**
 * Inscrição/edição de EQUIPE (roster) — mesmo padrão de inscrição do resto da
 * plataforma: escolhe atletas cadastrados no diretório (com conta/user_id) e,
 * como no fluxo de duplas, permite também um convidado avulso (nome + gênero).
 *
 * Atletas com conta pontuam no ranking individual (via espelho das etapas);
 * convidados avulsos contam só para a equipe.
 */

import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { UserPlus, Search, X, Plus } from 'lucide-react';
import { V2Button, V2Surface } from '@/v2/ui/primitives';
import { UserAvatar } from '@/components/ui/user-avatar';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { listAthletes } from '@/modules/athletes/services/athleteService';
import { COMPETITION_GENDER } from '@/modules/tournament/domain/constants';
import {
  filterPartnerCandidates, publicProfileToPartnerFields,
} from '@/modules/tournament/domain/partnerInvite';
import { validateTeamRoster, TEAM_GENDER } from '@/modules/tournament/domain/teamFormat';
import { useRegisterTeam, useUpdateTeamRoster } from '@/modules/tournament/hooks/useTeams';

const inputCls = 'w-full rounded-2xl border border-gray-200 bg-paper px-4 py-3 text-sm text-ink outline-none focus-visible:ring-4 focus-visible:ring-acid/30';
const labelCls = 'text-[11px] font-bold uppercase tracking-widest text-gray-400';

/** Gênero-padrão sugerido para uma nova vaga, conforme a composição da equipe. */
function defaultGender(config, males, females) {
  if (config.gender === TEAM_GENDER.MALE) return COMPETITION_GENDER.MALE;
  if (config.gender === TEAM_GENDER.FEMALE) return COMPETITION_GENDER.FEMALE;
  // Mista: completa primeiro o gênero que ainda tem vaga.
  if (males < (config.male_slots || 0)) return COMPETITION_GENDER.MALE;
  if (females < (config.female_slots || 0)) return COMPETITION_GENDER.FEMALE;
  return COMPETITION_GENDER.MALE;
}

export default function TeamRegistrationForm({ tournament, modality, editingTeam = null, onDone }) {
  const config = modality.team_config;
  const { user } = useAuth();
  const [teamName, setTeamName] = useState(editingTeam?.team_name || '');
  const [members, setMembers] = useState(() => (editingTeam?.members || []).map((m) => ({
    user_id: m.user_id || null, name: m.name || '', gender: m.gender || COMPETITION_GENDER.MALE, photo_url: m.photo_url || null,
  })));
  const [term, setTerm] = useState('');
  const registerMutation = useRegisterTeam();
  const updateMutation = useUpdateTeamRoster();
  const saving = registerMutation.isPending || updateMutation.isPending;
  const isEditing = !!editingTeam;

  const { data: directory = [] } = useQuery({ queryKey: ['athletes'], queryFn: listAthletes, staleTime: 60_000 });

  const males = members.filter((m) => m.gender === COMPETITION_GENDER.MALE).length;
  const females = members.filter((m) => m.gender === COMPETITION_GENDER.FEMALE).length;
  const full = members.length >= config.team_size;

  const excludedUids = useMemo(() => members.map((m) => m.user_id).filter(Boolean), [members]);
  const results = useMemo(
    () => (term.trim() ? filterPartnerCandidates(directory, { term, selfUid: null, excludedUids }).slice(0, 20) : []),
    [directory, term, excludedUids],
  );

  const check = useMemo(
    () => validateTeamRoster(members.filter((m) => m.name.trim()), config),
    [members, config],
  );

  function addAthlete(profile) {
    if (full) return;
    const p = publicProfileToPartnerFields(profile);
    const gender = p.competition_gender || defaultGender(config, males, females);
    setMembers((list) => [...list, { user_id: p.user_id, name: p.name, gender, photo_url: p.photo_url }]);
    setTerm('');
  }
  function addGuest() {
    if (full) return;
    setMembers((list) => [...list, { user_id: null, name: '', gender: defaultGender(config, males, females), photo_url: null }]);
  }
  function setMember(i, patch) {
    setMembers((list) => list.map((m, idx) => (idx === i ? { ...m, ...patch } : m)));
  }
  function removeMember(i) {
    setMembers((list) => list.filter((_, idx) => idx !== i));
  }
  function addSelf() {
    if (full || !user?.uid || excludedUids.includes(user.uid)) return;
    const own = directory.find((p) => (p.uid || p.id) === user.uid);
    if (own) addAthlete(own);
    else setMembers((list) => [...list, { user_id: user.uid, name: user.displayName || 'Eu', gender: defaultGender(config, males, females), photo_url: user.photoURL || null }]);
  }

  async function handleSave() {
    if (!teamName.trim()) return toast.error('Dê um nome à equipe.');
    const cleaned = members.map((m) => ({ ...m, name: m.name.trim() })).filter((m) => m.name);
    const v = validateTeamRoster(cleaned, config);
    if (!v.valid) return toast.error(v.errors[0] || 'Elenco inválido.');
    try {
      if (isEditing) {
        await updateMutation.mutateAsync({ regId: editingTeam.id, input: { team_name: teamName, members: cleaned }, modality });
        toast.success('Equipe atualizada.');
      } else {
        await registerMutation.mutateAsync({ tournament, modality, input: { team_name: teamName, members: cleaned } });
        toast.success('Equipe inscrita!');
      }
      onDone?.();
    } catch (err) {
      toast.error(err.message || 'Não foi possível salvar a equipe.');
    }
    return undefined;
  }

  const remainingHint = config.gender === TEAM_GENDER.MIXED
    ? `Faltam ${Math.max(0, (config.male_slots || 0) - males)}M e ${Math.max(0, (config.female_slots || 0) - females)}F`
    : `Faltam ${Math.max(0, config.team_size - members.length)} atleta(s)`;

  return (
    <V2Surface className="space-y-4 p-5">
      <div className="flex items-center gap-2 font-bold text-ink">
        <UserPlus className="h-4 w-4" /> {isEditing ? 'Editar equipe' : 'Inscrever equipe'}
      </div>
      <div className="space-y-2">
        <label className={labelCls}>Nome da equipe *</label>
        <input value={teamName} onChange={(e) => setTeamName(e.target.value)} maxLength={80} className={inputCls} />
      </div>

      {/* Elenco escolhido */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className={labelCls}>Elenco ({members.length}/{config.team_size})</label>
          <span className="text-xs text-gray-400">{full ? 'Completo' : remainingHint}</span>
        </div>
        <div className="space-y-2">
          {members.map((m, i) => (
            <div key={i} className="flex items-center gap-2 rounded-2xl border border-gray-100 bg-paper p-2">
              <UserAvatar name={m.name || 'Atleta'} photoUrl={m.photo_url} size="sm" />
              {m.user_id ? (
                <span className="min-w-0 flex-1 truncate text-sm text-ink">{m.name}</span>
              ) : (
                <input
                  value={m.name}
                  onChange={(e) => setMember(i, { name: e.target.value })}
                  placeholder="Nome do convidado"
                  className="min-w-0 flex-1 rounded-xl border border-gray-200 bg-paper px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-acid/30"
                />
              )}
              <select
                value={m.gender}
                onChange={(e) => setMember(i, { gender: e.target.value })}
                disabled={config.gender !== TEAM_GENDER.MIXED}
                className="rounded-xl border border-gray-200 bg-paper px-2 py-2 text-sm text-ink outline-none disabled:opacity-60"
              >
                <option value={COMPETITION_GENDER.MALE}>M</option>
                <option value={COMPETITION_GENDER.FEMALE}>F</option>
              </select>
              <button type="button" onClick={() => removeMember(i)} className="p-1 text-gray-400 hover:text-red-500" aria-label="Remover">
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
          {members.length === 0 && <p className="text-xs text-gray-500">Adicione atletas ao elenco.</p>}
        </div>
      </div>

      {/* Buscar atleta cadastrado */}
      {!full && (
        <div className="space-y-2 rounded-2xl border border-gray-100 bg-paper/40 p-3">
          <div className="flex items-center justify-between gap-2">
            <label className={labelCls}>Adicionar atleta cadastrado</label>
            <div className="flex gap-2">
              {user?.uid && !excludedUids.includes(user.uid) && (
                <button type="button" onClick={addSelf} className="text-xs font-semibold text-gray-500 hover:text-ink">+ Eu</button>
              )}
              <button type="button" onClick={addGuest} className="flex items-center gap-1 text-xs font-semibold text-gray-500 hover:text-ink">
                <Plus className="h-3 w-3" /> convidado
              </button>
            </div>
          </div>
          <div className="relative">
            <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input className={`${inputCls} pl-8`} placeholder="Buscar por nome ou cidade…" value={term} onChange={(e) => setTerm(e.target.value)} />
          </div>
          {term.trim() && (
            <div className="max-h-48 divide-y overflow-y-auto rounded-xl border border-gray-100">
              {results.length === 0 ? (
                <div className="p-3 text-center text-xs text-gray-500">Nenhum atleta encontrado. Use “convidado” para incluir sem conta.</div>
              ) : results.map((profile) => {
                const uid = profile.uid || profile.id;
                return (
                  <button key={uid} type="button" onClick={() => addAthlete(profile)} className="flex w-full items-center gap-2 p-2 text-left hover:bg-paper">
                    <UserAvatar name={profile.platform_name} photoUrl={profile.photo_url} size="sm" />
                    <span className="min-w-0 flex-1 truncate text-sm">{profile.platform_name}</span>
                    <span className="text-xs text-gray-400">{profile.city || ''}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {!check.valid && members.some((m) => m.name.trim()) && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">
          {check.errors.map((msg) => <div key={msg}>• {msg}</div>)}
        </div>
      )}

      <div className="flex gap-2">
        <V2Button onClick={handleSave} disabled={saving}>{isEditing ? 'Salvar' : 'Inscrever equipe'}</V2Button>
        {onDone && <V2Button variant="ghost" onClick={onDone}>Cancelar</V2Button>}
      </div>
    </V2Surface>
  );
}
