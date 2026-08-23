/**
 * Formulário de inscrição/edição de EQUIPE (roster). Usado por atletas (visão
 * pública) e pelo admin. Valida o elenco contra a `team_config` da modalidade
 * pelo domínio puro antes de salvar.
 *
 * Nesta primeira versão os membros são informados por NOME + gênero (padrão de
 * "convidado", como no resto da plataforma); vincular a contas fica para uma
 * evolução seguinte, sem quebrar o que é gravado (campo `user_id` fica null).
 */

import React, { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { UserPlus } from 'lucide-react';
import { V2Button, V2Surface } from '@/v2/ui/primitives';
import { COMPETITION_GENDER } from '@/modules/tournament/domain/constants';
import { validateTeamRoster, TEAM_GENDER } from '@/modules/tournament/domain/teamFormat';
import { useRegisterTeam, useUpdateTeamRoster } from '@/modules/tournament/hooks/useTeams';

const inputCls = 'w-full rounded-2xl border border-gray-200 bg-paper px-4 py-3 text-sm text-ink outline-none focus-visible:ring-4 focus-visible:ring-acid/30';
const labelCls = 'text-[11px] font-bold uppercase tracking-widest text-gray-400';

function emptyMembers(config, existing) {
  const size = config?.team_size || 0;
  const base = Array.isArray(existing) ? existing.slice(0, size) : [];
  const rows = [];
  for (let i = 0; i < size; i += 1) {
    const m = base[i] || {};
    // Em mistas, pré-rotula metade masculina / metade feminina como sugestão.
    let gender = m.gender;
    if (!gender) {
      if (config.gender === TEAM_GENDER.MALE) gender = COMPETITION_GENDER.MALE;
      else if (config.gender === TEAM_GENDER.FEMALE) gender = COMPETITION_GENDER.FEMALE;
      else gender = i < (config.male_slots || 0) ? COMPETITION_GENDER.MALE : COMPETITION_GENDER.FEMALE;
    }
    rows.push({ user_id: m.user_id || null, name: m.name || '', gender });
  }
  return rows;
}

export default function TeamRegistrationForm({ tournament, modality, editingTeam = null, onDone }) {
  const config = modality.team_config;
  const [teamName, setTeamName] = useState(editingTeam?.team_name || '');
  const [members, setMembers] = useState(() => emptyMembers(config, editingTeam?.members));
  const registerMutation = useRegisterTeam();
  const updateMutation = useUpdateTeamRoster();
  const saving = registerMutation.isPending || updateMutation.isPending;
  const isEditing = !!editingTeam;

  const check = useMemo(
    () => validateTeamRoster(members.filter((m) => m.name.trim()), config),
    [members, config],
  );

  function setMember(i, patch) {
    setMembers((list) => list.map((m, idx) => (idx === i ? { ...m, ...patch } : m)));
  }

  async function handleSave() {
    if (!teamName.trim()) return toast.error('Dê um nome à equipe.');
    const cleaned = members
      .map((m) => ({ ...m, name: m.name.trim() }))
      .filter((m) => m.name);
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

  return (
    <V2Surface className="space-y-4 p-5">
      <div className="flex items-center gap-2 font-bold text-ink">
        <UserPlus className="h-4 w-4" /> {isEditing ? 'Editar equipe' : 'Inscrever equipe'}
      </div>
      <div className="space-y-2">
        <label className={labelCls}>Nome da equipe *</label>
        <input value={teamName} onChange={(e) => setTeamName(e.target.value)} maxLength={80} className={inputCls} />
      </div>

      <div className="space-y-2">
        <label className={labelCls}>Elenco ({config.team_size} atleta{config.team_size === 1 ? '' : 's'})</label>
        <div className="space-y-2">
          {members.map((m, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="w-6 text-center text-xs font-bold text-gray-400">{i + 1}</span>
              <input
                value={m.name}
                onChange={(e) => setMember(i, { name: e.target.value })}
                placeholder="Nome do atleta"
                className={inputCls}
              />
              <select
                value={m.gender}
                onChange={(e) => setMember(i, { gender: e.target.value })}
                disabled={config.gender !== TEAM_GENDER.MIXED}
                className="rounded-2xl border border-gray-200 bg-paper px-3 py-3 text-sm text-ink outline-none focus-visible:ring-4 focus-visible:ring-acid/30 disabled:opacity-60"
              >
                <option value={COMPETITION_GENDER.MALE}>M</option>
                <option value={COMPETITION_GENDER.FEMALE}>F</option>
              </select>
            </div>
          ))}
        </div>
      </div>

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
