import React, { useState } from 'react';
import { EyeOff, Flag, RotateCcw, ShieldAlert, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import ConfirmDialog from '@/components/ConfirmDialog';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useAdminFlags, useAdminModeration, useReportedLetters } from '@/modules/progression/hooks/useGamificationAdmin';
import { usePeople } from '@/modules/progression/hooks/usePeople';
import { V2Badge, V2Button, V2EmptyState, V2ErrorState, V2Input, V2Skeleton, V2Surface } from '@/v2/ui/primitives';
import { V2SubTabs } from '@/v2/ui/V2SectionNav';

const TIPO = {
  xp_unverified: 'XP acima do que os jogos verificados sustentam',
  xp_jump: 'Salto de XP em pouco tempo',
  kudos_ring: 'Troca de kudos entre os mesmos atletas',
  review_retaliation: 'Avaliações de vingança no mesmo jogo',
};
const SEV = { high: 'red', medium: 'amber' };

function detalhe(f) {
  const d = f.detail || {};
  if (f.type === 'xp_unverified') return `XP ${d.xpTotal} · jogos verificados pelo servidor: ${d.verifiedGames} (${d.verifiedWins} vitórias) · teto estimado ${d.ceiling}`;
  if (f.type === 'xp_jump') return `De ${d.from} para ${d.to} XP em ${d.hours} h`;
  if (f.type === 'kudos_ring') return `${d.ab} kudos num sentido, ${d.ba} no outro (7 dias)`;
  if (f.type === 'review_retaliation') return `Jogo ${d.matchKey}`;
  return '';
}

function Sinais() {
  const { user } = useAuth();
  const flags = useAdminFlags();
  const [filtro, setFiltro] = useState('open');
  const actor = { uid: user?.uid, email: user?.email };
  const lista = flags.flags.filter((f) => (filtro === 'open' ? f.status === 'open' : f.status !== 'open'));
  const { people } = usePeople(lista.flatMap((f) => [f.subjectUid, f.otherUid]));
  const nome = (u) => (u ? (people.get(u)?.name || 'Atleta') : '');

  if (flags.isLoading) return <V2Skeleton lines={4} />;
  if (flags.isError) return <V2ErrorState inline title="Não deu para carregar os sinais" onRetry={flags.refetch} />;
  const decidir = (f, status) => flags.review.mutate({ id: f.id, status, note: '', actor }, { onSuccess: () => toast.success('Sinal atualizado.'), onError: (e) => toast.error(e?.message || 'Falhou.') });

  return (
    <div className="space-y-3">
      <V2SubTabs tabs={[{ value: 'open', label: `Abertos (${flags.flags.filter((f) => f.status === 'open').length})` }, { value: 'done', label: 'Revisados' }]} activeValue={filtro} onSelect={(t) => setFiltro(t.value)} ariaLabel="Estado dos sinais" />
      <p className="text-xs text-gray-500">O servidor <strong>marca</strong>, nunca pune: quem tem sinal de gravidade alta fica fora do placar público até você decidir.</p>
      {lista.length === 0 ? <V2EmptyState icon={ShieldAlert} title={filtro === 'open' ? 'Nenhum sinal aberto' : 'Nada revisado ainda'} description="A varredura roda uma vez por dia." /> : (
        <ul className="space-y-2">
          {lista.map((f) => (
            <li key={f.id} className="rounded-2xl border border-gray-100 p-3" data-flag={f.id}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-ink">{TIPO[f.type] || f.type}</p>
                  <p className="text-xs text-gray-600">{nome(f.subjectUid)}{f.otherUid ? ` × ${nome(f.otherUid)}` : ''}</p>
                  <p className="text-xs text-gray-400">{detalhe(f)}</p>
                </div>
                <V2Badge tone={SEV[f.severity] || 'neutral'}>{f.severity === 'high' ? 'alta' : 'média'}</V2Badge>
              </div>
              {f.status === 'open' ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  <V2Button size="sm" variant="secondary" onClick={() => decidir(f, 'reviewed')}>Está tudo certo</V2Button>
                  <V2Button size="sm" variant="ghost" onClick={() => decidir(f, 'dismissed')}>Dispensar</V2Button>
                  <V2Button size="sm" variant="ghost" onClick={() => decidir(f, 'actioned')}>Tomei providência</V2Button>
                </div>
              ) : <p className="mt-1 text-xs text-gray-400">Estado: {f.status}{f.reviewNote ? ` · ${f.reviewNote}` : ''}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Contas() {
  const { user } = useAuth();
  const mod = useAdminModeration();
  const [uid, setUid] = useState('');
  const [motivo, setMotivo] = useState('');
  const actor = { uid: user?.uid, email: user?.email };
  const { people } = usePeople(mod.moderated.map((m) => m.uid));

  if (mod.isLoading) return <V2Skeleton lines={4} />;
  if (mod.isError) return <V2ErrorState inline title="Não deu para carregar a moderação" onRetry={mod.refetch} />;

  const aplicar = (u, estado) => mod.set.mutate({ uid: u, state: { ...estado, reason: motivo }, actor }, {
    onSuccess: () => { toast.success('Moderação atualizada. Vale na próxima passada do servidor.'); setUid(''); setMotivo(''); },
    onError: (e) => toast.error(e?.message || 'Falhou.'),
  });
  const zerar = (u) => mod.reset.mutate({ uid: u, actor, reason: 'Recalculado pelo admin' }, {
    onSuccess: (n) => toast.success(`Progressão zerada (${n} registros). A pessoa a refaz com os jogos reais.`),
    onError: (e) => toast.error(e?.message || 'Falhou.'),
  });

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-gray-100 p-3">
        <p className="mb-2 text-sm font-bold text-ink">Moderar uma conta</p>
        <div className="flex flex-wrap items-center gap-2">
          <V2Input aria-label="ID da conta (uid)" placeholder="uid da conta" className="max-w-xs" value={uid} onChange={(e) => setUid(e.target.value.trim())} />
          <V2Input aria-label="Motivo" placeholder="Motivo (fica na auditoria)" className="max-w-xs" value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={200} />
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          <V2Button size="sm" variant="secondary" disabled={!uid} onClick={() => aplicar(uid, { hiddenFromPublic: true })}><EyeOff className="mr-1 h-3.5 w-3.5" /> Esconder do público</V2Button>
          <V2Button size="sm" variant="secondary" disabled={!uid} onClick={() => aplicar(uid, { excluded: true })}><Flag className="mr-1 h-3.5 w-3.5" /> Tirar do placar</V2Button>
          <ConfirmDialog
            trigger={<V2Button size="sm" variant="ghost" disabled={!uid}><RotateCcw className="mr-1 h-3.5 w-3.5" /> Zerar a progressão</V2Button>}
            title="Zerar a progressão desta conta?" description="Apaga missões, conquistas registradas e o resumo de XP. A pessoa as refaz a partir dos jogos reais. Prêmios do servidor e preferências não são tocados."
            confirmLabel="Zerar" onConfirm={() => zerar(uid)}
          />
        </div>
      </div>
      {mod.moderated.length === 0 ? <V2EmptyState icon={ShieldAlert} title="Nenhuma conta moderada" description="Quem você esconder ou tirar do placar aparece aqui." /> : (
        <ul className="space-y-2">
          {mod.moderated.map((m) => (
            <li key={m.uid} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-gray-100 p-3">
              <div>
                <p className="text-sm font-bold text-ink">{people.get(m.uid)?.name || 'Atleta'} <span className="font-mono text-[11px] font-normal text-gray-400">{m.uid}</span></p>
                <p className="text-xs text-gray-500">{m.excluded ? 'Fora do placar' : 'Escondida do público'}{m.reason ? ` · ${m.reason}` : ''}</p>
              </div>
              <V2Button size="sm" variant="ghost" onClick={() => aplicar(m.uid, {})}>Devolver ao normal</V2Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Cartas() {
  const q = useReportedLetters();
  if (q.isLoading) return <V2Skeleton lines={3} />;
  if (q.isError) return <V2ErrorState inline title="Não deu para carregar as cartas denunciadas" onRetry={q.refetch} />;
  if (q.letters.length === 0) return <V2EmptyState icon={ShieldAlert} title="Nenhuma carta denunciada" description="As cartas que os destinatários denunciarem aparecem aqui." />;
  return (
    <ul className="space-y-2">
      {q.letters.map((l) => (
        <li key={l.id} className="rounded-2xl border border-gray-100 p-3">
          <p className="text-sm text-ink">“{l.text}”</p>
          <div className="mt-2 flex justify-end">
            <ConfirmDialog
              trigger={<V2Button size="sm" variant="ghost"><Trash2 className="mr-1 h-3.5 w-3.5" /> Apagar carta</V2Button>}
              title="Apagar esta carta?" description="Ela some para o destinatário." confirmLabel="Apagar" onConfirm={() => q.remove.mutate(l.id)}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

const TABS = [
  { value: 'sinais', label: 'Sinais de integridade' },
  { value: 'contas', label: 'Contas moderadas' },
  { value: 'cartas', label: 'Cartas denunciadas' },
];

/** Painel admin → Gamificação → Integridade: sinais, moderação e denúncias. */
export default function AdminGamificationIntegrity() {
  const [aba, setAba] = useState('sinais');
  return (
    <V2Surface className="space-y-4" data-testid="admin-gamification-integrity">
      <V2SubTabs tabs={TABS} activeValue={aba} onSelect={(t) => setAba(t.value)} ariaLabel="Integridade" />
      {aba === 'sinais' && <Sinais />}
      {aba === 'contas' && <Contas />}
      {aba === 'cartas' && <Cartas />}
    </V2Surface>
  );
}
