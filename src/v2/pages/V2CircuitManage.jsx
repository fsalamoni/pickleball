/**
 * V2CircuitManage — Dashboard de gestão de circuito (Sprint 4 ORG-20).
 *
 * Rota: /circuits/:circuitId
 * Mostra:
 *  - Info do circuito
 *  - Lista de torneios do circuito
 *  - Ranking (top 50)
 *  - Botão para adicionar torneio (se user é admin)
 */

import React, { useState, useMemo } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Trophy, Plus, Award, Users, Calendar, Trash2, Edit3 } from 'lucide-react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { cn } from '@/core/lib/utils';
import {
  useCircuit, useCircuitTournaments, useCircuitRanking,
  useAddTournamentToCircuit, useRemoveTournamentFromCircuit,
  useRecordCircuitResults, useUpdateCircuit, useMyCircuits,
} from '@/modules/circuits/hooks/useCircuits';
import { useMyTournaments } from '@/modules/tournament/hooks/useTournament';
import { useAllAthletes } from '@/modules/athletes/hooks/useAthletes';
import { V2Badge, V2Button, V2EmptyState, V2ErrorState, V2Field, V2Input, V2Select, V2Surface, V2Textarea, V2Skeleton, V2BackLink } from '@/v2/ui/primitives';
import { t, tn, fmtData } from '@/core/i18n';

const athleteLabel = (a) => a.platform_name || a.full_name || a.name || t('Atleta');

const RANK_TONES = {
  1: 'amber', 2: 'blue', 3: 'neutral',
};

function RankBadge({ rank }) {
  if (!rank) return null;
  const tone = RANK_TONES[rank] || 'neutral';
  return <V2Badge tone={tone} className="font-bold">#{rank}</V2Badge>;
}

function CircuitInfo({ circuit, isAdmin, onEdit }) {
  return (
    <V2Surface>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <h2 className="font-display text-2xl font-bold text-ink">{circuit.name}</h2>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-gray-500">
            <V2Badge tone="green"><Calendar className="h-3 w-3" /> {circuit.season}</V2Badge>
            {circuit.start_date && <span>· {circuit.start_date} → {circuit.end_date || t('em aberto')}</span>}
            {!circuit.active && <V2Badge tone="red">{t('Inativo')}</V2Badge>}
          </div>
        </div>
        {isAdmin && (
          <V2Button variant="ghost" size="sm" onClick={onEdit}>
            <Edit3 className="h-4 w-4" /> {t('Editar')}
          </V2Button>
        )}
      </div>
      {circuit.description && (
        <p className="mt-3 whitespace-pre-line text-sm text-gray-600">{circuit.description}</p>
      )}
      <div className="mt-4 flex flex-wrap gap-1.5">
        {(circuit.categories || []).map((cat) => (
          <V2Badge key={cat} tone="blue">{cat}</V2Badge>
        ))}
      </div>
    </V2Surface>
  );
}

function TournamentList({ circuitId, isAdmin }) {
  const { data: tournaments = [], isLoading, isError, refetch } = useCircuitTournaments(circuitId);
  const { data: myTournaments = [] } = useMyTournaments();
  const [adding, setAdding] = useState(false);
  const [tournamentId, setTournamentId] = useState('');
  const add = useAddTournamentToCircuit();
  const remove = useRemoveTournamentFromCircuit();

  // Mapa id → nome, para exibir o nome em vez do id cru.
  const nameById = useMemo(() => {
    const m = {};
    (myTournaments || []).forEach((tt) => { m[tt.id] = tt.name; });
    return m;
  }, [myTournaments]);

  const linkedIds = useMemo(() => new Set(tournaments.map((tt) => tt.tournament_id)), [tournaments]);
  const options = useMemo(
    () => (myTournaments || []).filter((tt) => !linkedIds.has(tt.id)),
    [myTournaments, linkedIds],
  );

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!tournamentId.trim()) { toast.error(t('Escolha um torneio.')); return; }
    try {
      await add.mutateAsync({ circuitId, tournamentId: tournamentId.trim() });
      toast.success(t('Torneio vinculado ao circuito.'));
      setTournamentId('');
      setAdding(false);
    } catch (err) {
      toast.error(err.message);
    }
  };

  if (isLoading) return <V2Skeleton lines={3} />;
  // Sem a lista, "Vincular torneio" ofereceria de novo o que já está no
  // circuito — o comando não aparece sobre estado desconhecido.
  if (isError) {
    return (
      <V2Surface>
        <V2ErrorState
          inline
          title={t('Não foi possível carregar os torneios do circuito')}
          description={t('Os vínculos continuam lá — só não conseguimos buscá-los agora.')}
          onRetry={() => refetch()}
        />
      </V2Surface>
    );
  }
  return (
    <V2Surface>
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 font-display text-base font-bold text-ink">
          <Trophy className="h-4 w-4" /> {t('Torneios do circuito')}
        </h3>
        {isAdmin && !adding && (
          <V2Button size="sm" onClick={() => setAdding(true)}><Plus className="h-4 w-4" /> {t('Vincular torneio')}</V2Button>
        )}
      </div>
      {adding && (
        <form onSubmit={handleAdd} className="mt-3 flex flex-wrap gap-2">
          <V2Select value={tournamentId} onChange={(e) => setTournamentId(e.target.value)} className="min-w-0 flex-1">
            <option value="">{t('— Escolha um dos seus torneios —')}</option>
            {options.map((tt) => <option key={tt.id} value={tt.id}>{tt.name}</option>)}
          </V2Select>
          <V2Button type="submit" size="sm" disabled={add.isPending || !tournamentId}>
            {add.isPending ? t('Vinculando…') : t('Vincular')}
          </V2Button>
          <V2Button type="button" variant="ghost" size="sm" onClick={() => { setAdding(false); setTournamentId(''); }}>
            {t('Cancelar')}
          </V2Button>
        </form>
      )}
      {adding && options.length === 0 && (
        <p className="mt-2 text-xs text-gray-500">{t('Você não tem torneios disponíveis para vincular (ou todos já estão no circuito).')}</p>
      )}
      <div className="mt-3 space-y-2">
        {tournaments.length === 0 ? (
          <p className="text-sm text-gray-500">{t('Nenhum torneio vinculado ainda. Use “Vincular torneio” para montar as etapas do circuito.')}</p>
        ) : (
          tournaments.map((tt) => (
            <div key={tt.id} className="flex items-center justify-between rounded-2xl border border-gray-100 bg-paper p-3">
              <div className="min-w-0 flex-1">
                <Link to={`/torneios/${tt.tournament_id}`} className="truncate text-sm font-bold text-ink hover:underline">
                  {nameById[tt.tournament_id] || t('Torneio {tournament_id}', { tournament_id: tt.tournament_id })}
                </Link>
                <div className="text-xs text-gray-500">{t('Vinculado em')} {tt.added_at?.toDate ? fmtData(tt.added_at.toDate(), { dateStyle: 'short' }) || '—' : '—'}</div>
              </div>
              {isAdmin && (
                <V2Button variant="ghost" size="sm" onClick={() => remove.mutate({ circuitId, tournamentId: tt.tournament_id })}>
                  <Trash2 className="h-3.5 w-3.5 text-red-500" />
                </V2Button>
              )}
            </div>
          ))
        )}
      </div>
    </V2Surface>
  );
}

function CircuitResultsEntry({ circuit, circuitId }) {
  const { data: linked = [] } = useCircuitTournaments(circuitId);
  const { data: myTournaments = [] } = useMyTournaments();
  const { data: athletes = [] } = useAllAthletes();
  const record = useRecordCircuitResults();
  const [tid, setTid] = useState('');
  const [rows, setRows] = useState([{ user_id: '', position: '' }]);

  const nameById = useMemo(() => {
    const m = {};
    (myTournaments || []).forEach((tt) => { m[tt.id] = tt.name; });
    return m;
  }, [myTournaments]);

  const sortedAthletes = useMemo(
    () => [...(athletes || [])].filter((a) => a.id).sort((a, b) => athleteLabel(a).localeCompare(athleteLabel(b), 'pt-BR')),
    [athletes],
  );

  const setRow = (i, patch) => setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const addRow = () => setRows((rs) => [...rs, { user_id: '', position: '' }]);
  const removeRow = (i) => setRows((rs) => (rs.length > 1 ? rs.filter((_, idx) => idx !== i) : rs));

  const save = async () => {
    if (!tid) { toast.error(t('Escolha o torneio (etapa) do circuito.')); return; }
    const athleteMap = Object.fromEntries((athletes || []).map((a) => [a.id, a]));
    const results = rows
      .filter((r) => r.user_id && Number(r.position) >= 1)
      .map((r) => {
        const a = athleteMap[r.user_id];
        return {
          user_id: r.user_id,
          user_name: a ? athleteLabel(a) : '',
          user_photo: a?.photo_url || null,
          position: Number(r.position),
          points_table: circuit.points_table,
        };
      });
    if (results.length === 0) { toast.error(t('Adicione ao menos um atleta e sua colocação.')); return; }
    try {
      const n = await record.mutateAsync({ circuitId, tournamentId: tid, results });
      toast.success(t('{n} resultado(s) registrado(s). Ranking atualizado.', { n }));
      setRows([{ user_id: '', position: '' }]);
    } catch (err) {
      toast.error(err.message || t('Não foi possível registrar os resultados.'));
    }
  };

  if (linked.length === 0) return null;

  return (
    <V2Surface>
      <h3 className="flex items-center gap-1.5 font-display text-base font-bold text-ink">
        <Award className="h-4 w-4" /> {t('Registrar resultados')}
      </h3>
      <p className="mt-1 text-xs text-gray-500">
        {t('Escolha a etapa (torneio) e informe a colocação de cada atleta. Os pontos são calculados pela tabela do circuito e somados no ranking.')}
      </p>
      <div className="mt-3 space-y-2">
        <V2Field label={t('Etapa (torneio)')}>
          <V2Select value={tid} onChange={(e) => setTid(e.target.value)}>
            <option value="">{t('— Escolha o torneio —')}</option>
            {linked.map((tt) => (
              <option key={tt.tournament_id} value={tt.tournament_id}>
                {nameById[tt.tournament_id] || t('Torneio {tournament_id}', { tournament_id: tt.tournament_id })}
              </option>
            ))}
          </V2Select>
        </V2Field>

        {rows.map((r, i) => (
          <div key={i} className="flex items-end gap-2">
            <V2Field label={i === 0 ? t('Atleta') : ''} className="min-w-0 flex-1">
              <V2Select value={r.user_id} onChange={(e) => setRow(i, { user_id: e.target.value })}>
                <option value="">{t('— Atleta —')}</option>
                {sortedAthletes.map((a) => <option key={a.id} value={a.id}>{athleteLabel(a)}</option>)}
              </V2Select>
            </V2Field>
            <V2Field label={i === 0 ? t('Colocação') : ''} className="w-28">
              <V2Input type="number" min="1" value={r.position} onChange={(e) => setRow(i, { position: e.target.value })} placeholder="1" />
            </V2Field>
            <V2Button type="button" variant="ghost" size="sm" onClick={() => removeRow(i)} disabled={rows.length === 1}>
              <Trash2 className="h-3.5 w-3.5" />
            </V2Button>
          </div>
        ))}

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <V2Button type="button" variant="ghost" size="sm" onClick={addRow}>
            <Plus className="h-4 w-4" /> {t('Adicionar atleta')}
          </V2Button>
          <V2Button type="button" size="sm" onClick={save} disabled={record.isPending || !tid}>
            {record.isPending ? t('Salvando…') : t('Salvar resultados')}
          </V2Button>
        </div>
      </div>
    </V2Surface>
  );
}

function Ranking({ circuitId }) {
  const {
    data: ranking = [], isLoading, isError, refetch, pointsTable,
  } = useCircuitRanking(circuitId);
  if (isLoading) return <V2Skeleton lines={5} />;
  if (isError) {
    return (
      <V2Surface>
        <V2ErrorState
          inline
          title={t('Não foi possível carregar o ranking do circuito')}
          description={t('Os resultados continuam registrados — só não conseguimos buscá-los agora.')}
          onRetry={() => refetch()}
        />
      </V2Surface>
    );
  }
  return (
    <V2Surface>
      <h3 className="flex items-center gap-1.5 font-display text-base font-bold text-ink">
        <Award className="h-4 w-4" /> {t('Ranking do circuito')}
      </h3>
      <p className="mt-1 text-xs text-gray-500">
        {t('Pontos por posição: 1º')} {pointsTable?.[1] || 100} · 2º {pointsTable?.[2] || 75} · 3º/4º {pointsTable?.[3] || 50}
      </p>
      <div className="mt-3 space-y-1.5">
        {ranking.length === 0 ? (
          <V2EmptyState icon={Trophy} title={t('Sem resultados ainda')} description={t('Vincule torneios e registre os resultados para o ranking aparecer.')} />
        ) : (
          ranking.slice(0, 50).map((u) => (
            <div key={u.user_id} className={cn(
              'flex items-center gap-3 rounded-2xl border p-3',
              u.rank <= 3 ? 'border-amber-200 bg-amber-50/40' : 'border-gray-100 bg-paper',
            )}>
              <RankBadge rank={u.rank} />
              <div className="flex-1">
                <div className="text-sm font-bold text-ink">{u.user_name}</div>
                <div className="text-xs text-gray-500">
                  {tn(u.tournaments, '{n} torneio', '{n} torneios')}
                  {u.best_position && t('· melhor {best_position}º', { best_position: u.best_position })}
                </div>
              </div>
              <div className="text-right">
                <div className="font-display text-lg font-bold text-green-700">{u.total_points}</div>
                <div className="text-2xs uppercase tracking-widest text-gray-500">{t('pontos')}</div>
              </div>
            </div>
          ))
        )}
      </div>
    </V2Surface>
  );
}

function EditCircuitModal({ circuit, onClose }) {
  const [form, setForm] = useState({
    name: circuit.name || '',
    description: circuit.description || '',
    season: circuit.season || '',
    categories: (circuit.categories || []).join(', '),
    start_date: circuit.start_date || '',
    end_date: circuit.end_date || '',
    active: circuit.active !== false,
  });
  const update = useUpdateCircuit();
  const setField = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await update.mutateAsync({
        id: circuit.id,
        updates: {
          ...form,
          categories: form.categories.split(',').map((c) => c.trim()).filter(Boolean),
        },
      });
      toast.success(t('Circuito atualizado.'));
      onClose();
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <V2Surface className="w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-display text-lg font-bold text-ink">{t('Editar circuito')}</h3>
        <form onSubmit={handleSubmit} className="mt-3 space-y-3">
          <V2Field label={t('Nome')}><V2Input value={form.name} onChange={setField('name')} required maxLength={80} /></V2Field>
          <V2Field label={t('Temporada')}><V2Input value={form.season} onChange={setField('season')} required maxLength={40} /></V2Field>
          <V2Field label={t('Categorias (separadas por vírgula)')}><V2Input value={form.categories} onChange={setField('categories')} placeholder={t('Open, Sênior, Misto')} /></V2Field>
          <V2Field label={t('Descrição')}><V2Textarea value={form.description} onChange={setField('description')} maxLength={500} /></V2Field>
          <div className="grid grid-cols-2 gap-2">
            <V2Field label={t('Início')}><V2Input type="date" value={form.start_date} onChange={setField('start_date')} className="bg-paper px-3 py-2" /></V2Field>
            <V2Field label={t('Fim')}><V2Input type="date" value={form.end_date} onChange={setField('end_date')} className="bg-paper px-3 py-2" /></V2Field>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.active} onChange={setField('active')} />
            {t('Circuito ativo')}
          </label>
          <div className="flex justify-end gap-2">
            <V2Button type="button" variant="ghost" size="sm" onClick={onClose}>{t('Cancelar')}</V2Button>
            <V2Button type="submit" size="sm" disabled={update.isPending}>
              {update.isPending ? t('Salvando…') : t('Salvar')}
            </V2Button>
          </div>
        </form>
      </V2Surface>
    </div>
  );
}

export default function V2CircuitManage() {
  const { circuitId } = useParams();
  const { user, isAuthenticated } = useAuth();
  const {
    data: circuit, isLoading, isError, refetch,
  } = useCircuit(circuitId);
  const { data: myCircuits = [] } = useMyCircuits();
  const isAdmin = useMemo(() => {
    if (!user || !circuit) return false;
    if (user.isPlatformAdmin) return true;
    if (circuit.created_by === user.uid) return true;
    return myCircuits.some((c) => c.id === circuitId);
  }, [user, circuit, myCircuits, circuitId]);
  const [editing, setEditing] = useState(false);

  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (isLoading) return <div className="p-4"><V2Skeleton lines={6} /></div>;
  // Falha não é "circuito não encontrado — confira o link": o link está certo.
  if (isError) return (
    <div className="p-4">
      <V2ErrorState
        title={t('Não foi possível carregar o circuito')}
        description={t('O circuito continua lá — só não conseguimos buscá-lo agora.')}
        onRetry={() => refetch()}
      />
      <Link to="/circuits" className="mt-3 inline-block text-sm font-bold text-green-700">{t('← Ver circuitos')}</Link>
    </div>
  );
  if (!circuit) return (
    <div className="p-4">
      <V2EmptyState icon={Trophy} title={t('Circuito não encontrado')} description={t('Confira o link ou volte para a lista.')} />
      <Link to="/circuits" className="mt-3 inline-block text-sm font-bold text-green-700">{t('← Ver circuitos')}</Link>
    </div>
  );

  return (
    <div className="space-y-4 p-4">
      <V2BackLink to="/circuits">{t('Circuitos')}</V2BackLink>
      <CircuitInfo circuit={circuit} isAdmin={isAdmin} onEdit={() => setEditing(true)} />
      <TournamentList circuitId={circuitId} isAdmin={isAdmin} />
      {isAdmin && <CircuitResultsEntry circuit={circuit} circuitId={circuitId} />}
      <Ranking circuitId={circuitId} />
      {editing && <EditCircuitModal circuit={circuit} onClose={() => setEditing(false)} />}
    </div>
  );
}
