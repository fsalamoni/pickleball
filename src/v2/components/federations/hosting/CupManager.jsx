/**
 * COPA DAS FEDERAÇÕES na Central da CONFEDERAÇÃO (`?aba=copa`, Bloco 3b): a
 * equipe de competições cria a Copa (categorias e tamanho do elenco de cada
 * uma, prazo de inscrição), abre — as equipes das estaduais da rede são
 * avisadas —, aprova ou devolve com motivo os elencos que chegam, encerra as
 * inscrições ou cancela. O elenco aprovado sai na página (nome e categoria).
 * Toda escrita é do servidor.
 */
import React, { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { CalendarClock, Pencil, Plus, Send, Trash2, Trophy } from 'lucide-react';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { isoDate } from '@/modules/federations/domain/membership';
import {
  CUP_LIMITS, CUP_STATUS as CS, CUP_STATUS_LABELS, CUP_TEAM_STATUS as TS, CUP_TEAM_STATUS_LABELS, normalizeCupCategories, validateCup,
} from '@/modules/federations/domain/hosting';
import { useCupTeams, useCups, useHostingAction } from '@/modules/federations/hooks/useHosting';
import { V2Badge, V2Button, V2EmptyState, V2ErrorState, V2Field, V2Input, V2Skeleton, V2Textarea } from '@/v2/ui/primitives';
import { t, tn } from '@/core/i18n';
import { TOM_COPA, TOM_ELENCO, br, periodo } from './hostingUi';

const ok = (msg, depois) => ({ onSuccess: () => { toast.success(msg); depois?.(); }, onError: (e) => toast.error(e.message) });

function CupEditor({ federation, cup, onClose }) {
  const hoje = isoDate();
  const [f, setF] = useState(() => ({
    title: cup?.title || '', year: String(cup?.year || hoje.slice(0, 4)), starts_at: cup?.starts_at || '', ends_at: cup?.ends_at || '', location: cup?.location || '',
    description: cup?.description || '', entries_until: cup?.entries_until || '',
    categories: cup?.categories?.length ? cup.categories : [{ id: '', label: '', roster_max: 2 }],
  }));
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const setCat = (i, patch) => set('categories', f.categories.map((c, j) => (j === i ? { ...c, ...patch } : c)));
  const m = useHostingAction(federation.id);
  const r = validateCup(f, hoje);
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-h-[90dvh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{cup ? t('Editar a Copa') : t('Nova Copa das Federações')}</DialogTitle>
          <DialogDescription>{t('A Copa nasce como rascunho. Aberta, as categorias não mudam: só o prazo de inscrição pode ser estendido, com motivo.')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <V2Field label={t('Nome')} htmlFor="cp-titulo" error={r.errors.title} hint={t('Ex.: Copa das Federações 2027')}><V2Input id="cp-titulo" value={f.title} maxLength={120} onChange={(e) => set('title', e.target.value)} /></V2Field>
          <div className="grid gap-3 sm:grid-cols-3">
            <V2Field label={t('Ano')} htmlFor="cp-ano" error={r.errors.year}><V2Input id="cp-ano" type="number" value={f.year} onChange={(e) => set('year', e.target.value)} /></V2Field>
            <V2Field label={t('Começa em')} htmlFor="cp-inicio" error={r.errors.starts_at}><V2Input id="cp-inicio" type="date" value={f.starts_at} onChange={(e) => set('starts_at', e.target.value)} /></V2Field>
            <V2Field label={t('Termina em (opcional)')} htmlFor="cp-fim" error={r.errors.ends_at}><V2Input id="cp-fim" type="date" value={f.ends_at} onChange={(e) => set('ends_at', e.target.value)} /></V2Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <V2Field label={t('Local')} htmlFor="cp-local"><V2Input id="cp-local" value={f.location} maxLength={120} onChange={(e) => set('location', e.target.value)} /></V2Field>
            <V2Field label={t('Inscrição dos elencos até')} htmlFor="cp-prazo" error={r.errors.entries_until}><V2Input id="cp-prazo" type="date" value={f.entries_until} onChange={(e) => set('entries_until', e.target.value)} /></V2Field>
          </div>
          <V2Field label={t('Regulamento resumido (opcional)')} htmlFor="cp-descricao"><V2Textarea id="cp-descricao" rows={4} maxLength={CUP_LIMITS.TEXT_MAX} value={f.description} onChange={(e) => set('description', e.target.value)} /></V2Field>
          <div className="space-y-2">
            <p className="text-sm font-semibold text-ink">{t('Categorias e tamanho do elenco')}</p>
            {f.categories.map((c, i) => (
              <div key={i} className="grid items-end gap-2 rounded-xl border border-gray-100 p-2 sm:grid-cols-[1fr_7rem_auto]">
                <V2Field label={t('Categoria {n}', { n: i + 1 })} htmlFor={`cp-cat-${i}`} hint={i === 0 ? t('Ex.: Dupla masculina 50+') : undefined}><V2Input id={`cp-cat-${i}`} value={c.label} maxLength={CUP_LIMITS.LABEL_MAX} onChange={(e) => setCat(i, { label: e.target.value })} /></V2Field>
                <V2Field label={t('Atletas no máximo')} htmlFor={`cp-max-${i}`}><V2Input id={`cp-max-${i}`} type="number" min={1} max={CUP_LIMITS.ROSTER_MAX} value={c.roster_max} onChange={(e) => setCat(i, { roster_max: e.target.value })} /></V2Field>
                <V2Button type="button" size="sm" variant="ghost" aria-label={t('Tirar categoria {n}', { n: i + 1 })} disabled={f.categories.length <= 1} onClick={() => set('categories', f.categories.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></V2Button>
              </div>
            ))}
            {r.errors.categories && <p className="text-xs text-red-600">{r.errors.categories}</p>}
            <V2Button type="button" size="sm" variant="ghost" disabled={f.categories.length >= CUP_LIMITS.CATEGORIES_MAX} onClick={() => set('categories', [...f.categories, { id: '', label: '', roster_max: 2 }])}><Plus className="h-4 w-4" />{t('Acrescentar categoria')}</V2Button>
          </div>
        </div>
        <div className="mt-3 flex justify-end gap-2">
          <V2Button type="button" variant="ghost" onClick={onClose}>{t('Cancelar')}</V2Button>
          <V2Button type="button" disabled={!r.ok || m.isPending} onClick={() => m.mutate({ action: 'cup_save', cupId: cup?.id, ...f, year: Number(f.year) }, ok(t('Copa salva.'), onClose))}>{t('Salvar')}</V2Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Elenco({ federation, cup, team, cats }) {
  const [acao, setAcao] = useState(null);
  const [motivo, setMotivo] = useState('');
  const m = useHostingAction(federation.id);
  const decide = [CS.OPEN, CS.CLOSED].includes(cup.status);
  const nomeCat = (id) => cats.find((c) => c.id === id)?.label || '';
  return (
    <li className="space-y-2 py-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-semibold text-ink">{team.acronym ? `${team.acronym} · ${team.federation_name}` : team.federation_name}</span>
        <V2Badge tone={TOM_ELENCO[team.status] || 'neutral'}>{t(CUP_TEAM_STATUS_LABELS[team.status] || team.status)}</V2Badge>
      </div>
      <ul className="grid gap-0.5 text-xs text-gray-700 sm:grid-cols-2">
        {(team.athletes || []).map((a, i) => <li key={`${a.member_id}-${a.category_id}-${i}`}>{a.name} <span className="text-gray-500">· {nomeCat(a.category_id)}</span></li>)}
      </ul>
      {team.decision?.reason && <p className="text-xs text-gray-600">{t('Motivo da devolução: {motivo}', { motivo: team.decision.reason })}</p>}
      {decide && (
        <div className="flex flex-wrap gap-2">
          {team.status === TS.SUBMITTED && <V2Button type="button" size="sm" onClick={() => setAcao('aprovar')}>{t('Aprovar elenco')}</V2Button>}
          {[TS.SUBMITTED, TS.APPROVED].includes(team.status) && <V2Button type="button" size="sm" variant="ghost" onClick={() => { setMotivo(''); setAcao('devolver'); }}>{t('Devolver para ajuste')}</V2Button>}
        </div>
      )}
      {acao && (
        <ConfirmDialog
          open
          onOpenChange={(o) => { if (!o) setAcao(null); }}
          loading={m.isPending}
          confirmDisabled={acao === 'devolver' && motivo.trim().length < 3}
          title={acao === 'aprovar' ? t('Aprovar o elenco da {sigla}?', { sigla: team.acronym || team.federation_name }) : t('Devolver o elenco da {sigla}?', { sigla: team.acronym || team.federation_name })}
          description={acao === 'aprovar' ? t('O elenco sai na página da confederação e cada atleta recebe um aviso.') : t('A federação recebe o motivo, ajusta e manda de novo. Se já estava aprovado, sai da página.')}
          confirmLabel={acao === 'aprovar' ? t('Aprovar') : t('Devolver')}
          cancelLabel={t('Voltar')}
          onConfirm={() => m.mutate({ action: acao === 'aprovar' ? 'team_approve' : 'team_return', cupId: cup.id, teamFederationId: team.federation_id, reason: motivo }, ok(acao === 'aprovar' ? t('Elenco aprovado.') : t('Elenco devolvido.'), () => setAcao(null)))}
        >
          {acao === 'devolver' && <V2Field label={t('Motivo')} htmlFor={`cp-dev-${team.federation_id}`} hint={t('A federação lê este texto. Mínimo 3 caracteres.')}><V2Input id={`cp-dev-${team.federation_id}`} value={motivo} maxLength={300} onChange={(e) => setMotivo(e.target.value)} /></V2Field>}
        </ConfirmDialog>
      )}
    </li>
  );
}

function CupDetail({ federation, cup, onEdit, onClose }) {
  const rascunho = cup.status === CS.DRAFT;
  const q = useCupTeams(federation.id, { enabled: !rascunho });
  const [acao, setAcao] = useState(null);
  const [motivo, setMotivo] = useState('');
  const [prazo, setPrazo] = useState(cup.entries_until || '');
  const m = useHostingAction(federation.id);
  const cats = normalizeCupCategories(cup.categories);
  const times = useMemo(() => (q.data || []).filter((x) => x.cup_id === cup.id && x.status !== TS.DRAFT).sort((a, b) => String(a.acronym || a.federation_name).localeCompare(String(b.acronym || b.federation_name), 'pt-BR')), [q.data, cup.id]);
  const executar = () => {
    const fim = (msg, fechar) => ok(msg, () => { setAcao(null); if (fechar) onClose(); });
    if (acao === 'abrir') m.mutate({ action: 'cup_publish', cupId: cup.id }, fim(t('Copa aberta. As federações da rede foram avisadas.')));
    if (acao === 'apagar') m.mutate({ action: 'cup_delete', cupId: cup.id }, fim(t('Rascunho apagado.'), true));
    if (acao === 'encerrar') m.mutate({ action: 'cup_close', cupId: cup.id }, fim(t('Inscrições encerradas.')));
    if (acao === 'cancelar') m.mutate({ action: 'cup_cancel', cupId: cup.id, reason: motivo }, fim(t('Copa cancelada.')));
    if (acao === 'estender') m.mutate({ action: 'cup_extend', cupId: cup.id, entries_until: prazo, reason: motivo }, fim(t('Prazo estendido.')));
  };
  const textos = {
    abrir: { title: t('Abrir a Copa?'), description: t('A Copa aparece na página da confederação e as equipes das federações da rede recebem um aviso para inscrever o elenco.'), label: t('Abrir inscrições') },
    apagar: { title: t('Apagar o rascunho?'), description: t('Ninguém viu a Copa: o rascunho some.'), label: t('Apagar') },
    encerrar: { title: t('Encerrar as inscrições?'), description: t('Ninguém manda mais elenco. Os enviados continuam podendo ser aprovados ou devolvidos.'), label: t('Encerrar') },
    cancelar: { title: t('Cancelar a Copa?'), description: t('As federações inscritas e os atletas aprovados recebem um aviso com o motivo.'), label: t('Cancelar Copa') },
    estender: { title: t('Estender o prazo de inscrição?'), description: t('Encerrada, a Copa volta a receber elencos até o novo prazo.'), label: t('Estender') },
  };
  const prazoOk = prazo > (cup.entries_until || '') && prazo >= isoDate() && prazo < cup.starts_at;
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-h-[90dvh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{cup.title}</DialogTitle>
          <DialogDescription>{[periodo(cup.starts_at, cup.ends_at), cup.location, t('inscrições até {data}', { data: br(cup.entries_until) })].filter(Boolean).join(' · ')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <V2Badge tone={TOM_COPA[cup.status] || 'neutral'}>{t(CUP_STATUS_LABELS[cup.status] || cup.status)}</V2Badge>
            <span className="text-sm text-gray-600">{cats.map((c) => t('{cat} (até {n})', { cat: c.label, n: c.roster_max })).join(' · ')}</span>
          </div>
          {cup.cancel_reason && <p className="text-sm text-gray-600">{t('Motivo do cancelamento: {motivo}', { motivo: cup.cancel_reason })}</p>}
          <div className="flex flex-wrap gap-2">
            {rascunho && <V2Button type="button" size="sm" variant="secondary" onClick={onEdit}><Pencil className="h-4 w-4" />{t('Editar')}</V2Button>}
            {rascunho && <V2Button type="button" size="sm" onClick={() => setAcao('abrir')}><Send className="h-4 w-4" />{t('Abrir inscrições')}</V2Button>}
            {rascunho && <V2Button type="button" size="sm" variant="ghost" onClick={() => setAcao('apagar')}><Trash2 className="h-4 w-4" />{t('Apagar rascunho')}</V2Button>}
            {[CS.OPEN, CS.CLOSED].includes(cup.status) && <V2Button type="button" size="sm" variant="secondary" onClick={() => { setMotivo(''); setAcao('estender'); }}><CalendarClock className="h-4 w-4" />{t('Estender prazo')}</V2Button>}
            {cup.status === CS.OPEN && <V2Button type="button" size="sm" variant="ghost" onClick={() => setAcao('encerrar')}>{t('Encerrar inscrições')}</V2Button>}
            {[CS.OPEN, CS.CLOSED].includes(cup.status) && <V2Button type="button" size="sm" variant="ghost" onClick={() => { setMotivo(''); setAcao('cancelar'); }}>{t('Cancelar Copa')}</V2Button>}
          </div>
          {!rascunho && (
            <section className="space-y-2">
              <p className="text-sm font-semibold text-ink">{t('Elencos')}</p>
              {q.isError && <V2ErrorState inline title={t('Não carregaram os elencos')} onRetry={() => q.refetch()} />}
              {q.isLoading && <V2Skeleton lines={3} />}
              {q.isSuccess && !times.length && <p className="text-sm text-gray-500">{t('Nenhuma federação mandou o elenco ainda.')}</p>}
              {times.length > 0 && <ul className="divide-y divide-gray-100 rounded-2xl border border-gray-100 px-3">{times.map((x) => <Elenco key={x.id} federation={federation} cup={cup} team={x} cats={cats} />)}</ul>}
            </section>
          )}
        </div>
        {acao && (
          <ConfirmDialog
            open
            destructive={acao === 'cancelar' || acao === 'apagar'}
            onOpenChange={(o) => { if (!o) setAcao(null); }}
            loading={m.isPending}
            confirmDisabled={(['cancelar', 'estender'].includes(acao) && motivo.trim().length < 3) || (acao === 'estender' && !prazoOk)}
            title={textos[acao].title}
            description={textos[acao].description}
            confirmLabel={textos[acao].label}
            cancelLabel={t('Voltar')}
            onConfirm={executar}
          >
            {acao === 'estender' && <V2Field label={t('Novo prazo')} htmlFor="cp-novo-prazo" hint={t('Depois do atual e antes de a Copa começar.')}><V2Input id="cp-novo-prazo" type="date" min={cup.entries_until} value={prazo} onChange={(e) => setPrazo(e.target.value)} /></V2Field>}
            {['cancelar', 'estender'].includes(acao) && <V2Field label={t('Motivo')} htmlFor="cp-motivo" hint={t('Fica no histórico da Copa. Mínimo 3 caracteres.')}><V2Input id="cp-motivo" value={motivo} maxLength={300} onChange={(e) => setMotivo(e.target.value)} /></V2Field>}
          </ConfirmDialog>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function CupManager({ federation }) {
  const q = useCups(federation.id, { equipe: true });
  const [editando, setEditando] = useState(null);
  const [abertaId, setAbertaId] = useState(null);
  const lista = q.data || [];
  const aberta = lista.find((k) => k.id === abertaId) || null;
  if (q.isError) return <V2ErrorState title={t('Não carregou a Copa das Federações')} onRetry={() => q.refetch()} />;
  if (q.isLoading) return <V2Skeleton lines={5} />;
  return (
    <div className="space-y-3" data-dica="federacao-copa-lista">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-gray-600">{t('A competição entre as federações da rede: cada uma inscreve o elenco com os filiados em dia, a confederação aprova.')}</p>
        <V2Button type="button" size="sm" onClick={() => setEditando({})}><Plus className="h-4 w-4" />{t('Nova Copa')}</V2Button>
      </div>
      {!lista.length && <V2EmptyState icon={Trophy} title={t('Nenhuma Copa ainda')} description={t('Crie a primeira para receber os elencos das federações da rede.')} />}
      <ul className="space-y-2">
        {lista.map((k) => (
          <li key={k.id}>
            <button type="button" onClick={() => setAbertaId(k.id)} className="w-full rounded-2xl border border-gray-100 bg-white p-3 text-left hover:border-gray-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink">
              <span className="flex flex-wrap items-center gap-2 font-semibold text-ink">{k.title}<V2Badge tone={TOM_COPA[k.status] || 'neutral'}>{t(CUP_STATUS_LABELS[k.status] || k.status)}</V2Badge></span>
              <span className="mt-0.5 block text-xs text-gray-500">{[periodo(k.starts_at, k.ends_at), k.location, k.counts ? tn(k.counts.approved || 0, '{n} elenco aprovado', '{n} elencos aprovados') : ''].filter(Boolean).join(' · ')}</span>
            </button>
          </li>
        ))}
      </ul>
      {editando && <CupEditor federation={federation} cup={editando.id ? editando : null} onClose={() => setEditando(null)} />}
      {aberta && !editando && <CupDetail federation={federation} cup={aberta} onEdit={() => setEditando(aberta)} onClose={() => setAbertaId(null)} />}
    </div>
  );
}
