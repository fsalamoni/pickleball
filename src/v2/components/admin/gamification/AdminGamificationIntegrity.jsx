import React, { useState } from 'react';
import { EyeOff, Flag, RotateCcw, ShieldAlert, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import ConfirmDialog from '@/components/ConfirmDialog';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useAdminFlags, useAdminModeration, useReportedLetters } from '@/modules/progression/hooks/useGamificationAdmin';
import { usePeople } from '@/modules/progression/hooks/usePeople';
import { V2Badge, V2Button, V2EmptyState, V2ErrorState, V2Input, V2Skeleton, V2Surface } from '@/v2/ui/primitives';
import { V2SubTabs } from '@/v2/ui/V2SectionNav';
import TermHint, { TermNote } from '@/v2/components/gamification/TermHint';
import { t, tk } from '@/core/i18n';

const TIPO = {
  xp_unverified: tk('XP acima do que os jogos verificados sustentam'),
  xp_jump: tk('Salto de XP em pouco tempo'),
  kudos_ring: tk('Troca de kudos entre os mesmos atletas'),
  review_retaliation: tk('Avaliações de vingança no mesmo jogo'),
};
const SEV = { high: 'red', medium: 'amber' };

function detalhe(f) {
  const d = f.detail || {};
  if (f.type === 'xp_unverified') return t('XP {xpTotal} · jogos verificados pelo servidor: {verifiedGames} ({verifiedWins} vitórias) · teto estimado {ceiling}', { xpTotal: d.xpTotal, verifiedGames: d.verifiedGames, verifiedWins: d.verifiedWins, ceiling: d.ceiling });
  if (f.type === 'xp_jump') return t('De {from} para {to} XP em {hours} h', { from: d.from, to: d.to, hours: d.hours });
  if (f.type === 'kudos_ring') return t('{ab} kudos num sentido, {ba} no outro (7 dias)', { ab: d.ab, ba: d.ba });
  if (f.type === 'review_retaliation') return t('Jogo {matchKey}', { matchKey: d.matchKey });
  return '';
}

function Sinais() {
  const { user } = useAuth();
  const flags = useAdminFlags();
  const [filtro, setFiltro] = useState('open');
  const actor = { uid: user?.uid, email: user?.email };
  const lista = flags.flags.filter((f) => (filtro === 'open' ? f.status === 'open' : f.status !== 'open'));
  const { people } = usePeople(lista.flatMap((f) => [f.subjectUid, f.otherUid]));
  const nome = (u) => (u ? (people.get(u)?.name || t('Atleta')) : '');

  if (flags.isLoading) return <V2Skeleton lines={4} />;
  if (flags.isError) return <V2ErrorState inline title={t('Não deu para carregar os sinais')} onRetry={flags.refetch} />;
  const decidir = (f, status) => flags.review.mutate({ id: f.id, status, note: '', actor }, { onSuccess: () => toast.success(t('Sinal atualizado.')), onError: (e) => toast.error(e?.message || t('Falhou.')) });

  return (
    <div className="space-y-3" data-dica="admin-gam-sinais">
      <TermNote term="admin-antifarm" />
      <V2SubTabs tabs={[{ value: 'open', label: t('Abertos ({n})', { n: flags.flags.filter((f) => f.status === 'open').length }) }, { value: 'done', label: t('Revisados') }]} activeValue={filtro} onSelect={(aba) => setFiltro(aba.value)} ariaLabel={t('Estado dos sinais')} />
      <p className="text-xs text-gray-500">{t('O servidor')} <strong>{t('marca')}</strong>{t(', nunca pune: quem tem sinal de gravidade alta fica fora do placar público até você decidir.')}</p>
      {lista.length === 0 ? <V2EmptyState icon={ShieldAlert} title={filtro === 'open' ? t('Nenhum sinal aberto') : t('Nada revisado ainda')} description={t('A varredura roda uma vez por dia.')} /> : (
        <ul className="space-y-2">
          {lista.map((f) => (
            <li key={f.id} className="rounded-2xl border border-gray-100 p-3" data-flag={f.id}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-ink">{TIPO[f.type] ? t(TIPO[f.type]) : f.type}</p>
                  <p className="text-xs text-gray-600">{nome(f.subjectUid)}{f.otherUid ? ` × ${nome(f.otherUid)}` : ''}</p>
                  <p className="text-xs text-gray-500">{detalhe(f)}</p>
                </div>
                <V2Badge tone={SEV[f.severity] || 'neutral'}>{f.severity === 'high' ? t('alta') : t('média')}</V2Badge>
              </div>
              {f.status === 'open' ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  <V2Button size="sm" variant="secondary" onClick={() => decidir(f, 'reviewed')}>{t('Está tudo certo')}</V2Button>
                  <V2Button size="sm" variant="ghost" onClick={() => decidir(f, 'dismissed')}>{t('Dispensar')}</V2Button>
                  <V2Button size="sm" variant="ghost" onClick={() => decidir(f, 'actioned')}>{t('Tomei providência')}</V2Button>
                </div>
              ) : <p className="mt-1 text-xs text-gray-500">{t('Estado: {status}', { status: f.status })}{f.reviewNote ? ` · ${f.reviewNote}` : ''}</p>}
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
  if (mod.isError) return <V2ErrorState inline title={t('Não deu para carregar a moderação')} onRetry={mod.refetch} />;

  const aplicar = (u, estado) => mod.set.mutate({ uid: u, state: { ...estado, reason: motivo }, actor }, {
    onSuccess: () => { toast.success(t('Moderação atualizada. Vale na próxima passada do servidor.')); setUid(''); setMotivo(''); },
    onError: (e) => toast.error(e?.message || t('Falhou.')),
  });
  const zerar = (u) => mod.reset.mutate({ uid: u, actor, reason: 'Recalculado pelo admin' }, {
    onSuccess: (n) => toast.success(t('Progressão zerada ({n} registros). A pessoa a refaz com os jogos reais.', { n })),
    onError: (e) => toast.error(e?.message || t('Falhou.')),
  });

  return (
    <div className="space-y-4">
      <TermNote term="admin-moderacao" />
      <div className="rounded-2xl border border-gray-100 p-3">
        <p className="mb-2 text-sm font-bold text-ink">{t('Moderar uma conta')}</p>
        <div className="flex flex-wrap items-center gap-2">
          <V2Input aria-label={t('ID da conta (uid)')} placeholder={t('uid da conta')} className="max-w-xs" value={uid} onChange={(e) => setUid(e.target.value.trim())} />
          <V2Input aria-label={t('Motivo')} placeholder={t('Motivo (fica na auditoria)')} className="max-w-xs" value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={200} />
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          <V2Button size="sm" variant="secondary" disabled={!uid} onClick={() => aplicar(uid, { hiddenFromPublic: true })}><EyeOff className="mr-1 h-3.5 w-3.5" /> {t('Esconder do público')}</V2Button>
          <V2Button size="sm" variant="secondary" disabled={!uid} onClick={() => aplicar(uid, { excluded: true })}><Flag className="mr-1 h-3.5 w-3.5" /> {t('Tirar do placar')}</V2Button>
          <ConfirmDialog
            trigger={<V2Button size="sm" variant="ghost" disabled={!uid}><RotateCcw className="mr-1 h-3.5 w-3.5" /> {t('Zerar a progressão')}</V2Button>}
            title={t('Zerar a progressão desta conta?')} description={t('Apaga missões, conquistas registradas e o resumo de XP. A pessoa as refaz a partir dos jogos reais. Prêmios do servidor e preferências não são tocados.')}
            confirmLabel={t('Zerar')} onConfirm={() => zerar(uid)}
          />
        </div>
      </div>
      {mod.moderated.length === 0 ? <V2EmptyState icon={ShieldAlert} title={t('Nenhuma conta moderada')} description={t('Quem você esconder ou tirar do placar aparece aqui.')} /> : (
        <ul className="space-y-2">
          {mod.moderated.map((m) => (
            <li key={m.uid} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-gray-100 p-3">
              <div>
                <p className="text-sm font-bold text-ink">{people.get(m.uid)?.name || t('Atleta')} <span className="font-mono text-2xs font-normal text-gray-500">{m.uid}</span></p>
                <p className="text-xs text-gray-500">{m.excluded ? t('Fora do placar') : t('Escondida do público')}{m.reason ? ` · ${m.reason}` : ''}</p>
              </div>
              <V2Button size="sm" variant="ghost" onClick={() => aplicar(m.uid, {})}>{t('Devolver ao normal')}</V2Button>
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
  if (q.isError) return <V2ErrorState inline title={t('Não deu para carregar as cartas denunciadas')} onRetry={q.refetch} />;
  if (q.letters.length === 0) return <V2EmptyState icon={ShieldAlert} title={t('Nenhuma carta denunciada')} description={t('As cartas que os destinatários denunciarem aparecem aqui.')} />;
  return (
    <ul className="space-y-2">
      {q.letters.map((l) => (
        <li key={l.id} className="rounded-2xl border border-gray-100 p-3">
          <p className="text-sm text-ink">“{l.text}”</p>
          <div className="mt-2 flex justify-end">
            <ConfirmDialog
              trigger={<V2Button size="sm" variant="ghost"><Trash2 className="mr-1 h-3.5 w-3.5" /> {t('Apagar carta')}</V2Button>}
              title={t('Apagar esta carta?')} description={t('Ela some para o destinatário.')} confirmLabel={t('Apagar')} onConfirm={() => q.remove.mutate(l.id)}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

const TABS = [
  { value: 'sinais', label: tk('Sinais de integridade') },
  { value: 'contas', label: tk('Contas moderadas') },
  { value: 'cartas', label: tk('Cartas denunciadas') },
];

/** Painel admin → Gamificação → Integridade: sinais, moderação e denúncias. */
export default function AdminGamificationIntegrity() {
  const [aba, setAba] = useState('sinais');
  return (
    <V2Surface className="space-y-4" data-testid="admin-gamification-integrity">
      <V2SubTabs tabs={TABS.map((x) => ({ ...x, label: t(x.label) }))} activeValue={aba} onSelect={(x) => setAba(x.value)} ariaLabel={t('Integridade')} dica="admin-gam-integridade-abas" />
      {aba === 'sinais' && <Sinais />}
      {aba === 'contas' && <Contas />}
      {aba === 'cartas' && <Cartas />}
    </V2Surface>
  );
}
