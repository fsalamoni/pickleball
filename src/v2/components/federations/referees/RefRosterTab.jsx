/**
 * Arbitragem → QUADRO (Central): quem pode ser escalado, com nível, funções,
 * situação, credenciais, atuações e média das avaliações. Entra pela lista
 * de usuários ou por uma credencial de árbitro emitida pela federação; as
 * notas da equipe ficam em `private/staff` (o árbitro não lê). Mostra a
 * situação da credencial pela regra da federação e o pedido de promoção:
 * promover é mudar o nível no cadastro (com motivo, que vai no aviso e no
 * histórico); recusar pede motivo.
 */
import React, { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Award, Eye, Pencil, Plus, Trash2, TrendingUp, UserCheck, X } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { refereesAction } from '@/modules/federations/services/refereesService';
import { useFederationMutation } from '@/modules/federations/hooks/useFederations';
import { useRefereeNotes } from '@/modules/federations/hooks/useReferees';
import { CREDENTIAL_STANDING_LABELS, REFEREE_FUNCTIONS, REFEREE_LIMITS, REFEREE_STATUS, REFEREE_STATUS_LABELS, credentialStanding, isoDateBR, levelLabel, validateRosterInput } from '@/modules/federations/domain/referees';
import FedPersonPicker from '../manage/FedPersonPicker';
import { BuscaLista, MostrarMais, useBuscaLista } from '../manage/listTools';
import { haAlteracaoNaoSalva, useAvisoNaoSalvo } from '../manage/naoSalvo';
import { V2Avatar, V2Badge, V2Button, V2EmptyState, V2ErrorState, V2Field, V2Input, V2Select, V2Skeleton, V2Surface, V2Textarea } from '@/v2/ui/primitives';
import { t, tn } from '@/core/i18n';
import { PromotionProgress, dataCurta, funcao } from './refUi';

const TOM = { active: 'green', inactive: 'neutral', suspended: 'red' };
const TOM_CRED = { expiring: 'amber', grace: 'amber', lapsed: 'red', none: 'red' };

/** A credencial pela regra de HOJE da federação (só quando ela exige; cadastro antigo sem a cópia não mostra nada). */
function CredencialBadge({ referee, rules }) {
  if (!rules.credential_policy.required || referee.credential_until === undefined) return null;
  const st = credentialStanding(referee.credential_until, rules);
  if (!TOM_CRED[st.state]) return null;
  return <V2Badge tone={TOM_CRED[st.state]}>{t(CREDENTIAL_STANDING_LABELS[st.state])}{st.until ? ` · ${dataCurta(st.until)}` : ''}</V2Badge>;
}
const CAMPOS_BUSCA = (r) => `${r.name} ${r.city || ''}`;

function CadastroForm({ federation, rules, referee, roster, credentials, nivelInicial, onFechar }) {
  const novo = !referee;
  const [motivoNivel, setMotivoNivel] = useState('');
  const notasQ = useRefereeNotes(federation.id, referee?.user_id, { enabled: !novo });
  const [pessoa, setPessoa] = useState([]);
  const [credId, setCredId] = useState('');
  const [f, setF] = useState(() => ({
    level: nivelInicial || referee?.level || rules.levels[0]?.id || '', functions: referee?.functions || ['referee'], status: referee?.status || REFEREE_STATUS.ACTIVE, since: referee?.since || '',
  }));
  const [notas, setNotas] = useState(null); // null = não mexeu
  const [base] = useState(f);
  useAvisoNaoSalvo(JSON.stringify(f) !== JSON.stringify(base) || notas != null || pessoa.length > 0 || Boolean(credId));
  const r = validateRosterInput(f, rules);
  const jaNoQuadro = useMemo(() => new Map((roster || []).map((x) => [x.user_id, t('já no quadro')])), [roster]);
  const credsLivres = (credentials || []).filter((c) => c.kind === 'referee' && c.status === 'active' && !jaNoQuadro.has(c.user_id));
  const m = useFederationMutation(() => refereesAction({
    federationId: federation.id,
    action: novo ? 'roster_add' : 'roster_update',
    ...(novo ? (credId ? { credentialId: credId } : { userId: pessoa[0]?.id }) : { userId: referee.user_id }),
    referee: r.value,
    ...(notas != null ? { notes: notas } : {}),
    ...(!novo && f.level !== referee.level ? { levelReason: motivoNivel } : {}),
  }));
  const mudaNivel = !novo && f.level !== referee.level;
  const toggleFn = (fn) => setF((x) => ({ ...x, functions: x.functions.includes(fn) ? x.functions.filter((y) => y !== fn) : [...x.functions, fn] }));
  const enviar = (e) => {
    e.preventDefault();
    if (novo && !credId && !pessoa.length) { toast.error(t('Escolha a pessoa ou a credencial.')); return; }
    if (!r.ok) { toast.error(Object.values(r.errors)[0]); return; }
    m.mutate(undefined, { onSuccess: () => { toast.success(novo ? t('Árbitro incluído no quadro e avisado.') : t('Cadastro salvo.')); onFechar(); }, onError: (er) => toast.error(er.message) });
  };
  return (
    <form onSubmit={enviar} noValidate className="space-y-4">
      {novo && credsLivres.length > 0 && (
        <V2Field label={t('Pela credencial de árbitro (curso da federação)')} htmlFor="ref-cred" hint={t('Ou escolha a pessoa na lista abaixo.')}>
          <V2Select id="ref-cred" value={credId} onChange={(e) => { setCredId(e.target.value); setPessoa([]); }}>
            <option value="">{t('Nenhuma')}</option>
            {credsLivres.map((c) => <option key={c.id} value={c.id}>{c.user_name}{c.level ? ` · ${c.level}` : ''}</option>)}
          </V2Select>
        </V2Field>
      )}
      {novo && !credId && (
        <V2Field label={t('Pessoa')} htmlFor="ref-pessoa" required>
          <FedPersonPicker id="ref-pessoa" selecionados={pessoa} onChange={setPessoa} excluir={jaNoQuadro} />
        </V2Field>
      )}
      <div className="grid gap-3 sm:grid-cols-3">
        <V2Field label={t('Nível')} htmlFor="ref-nivel" required error={r.errors.level}>
          <V2Select id="ref-nivel" value={f.level} onChange={(e) => setF((x) => ({ ...x, level: e.target.value }))}>
            {rules.levels.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
          </V2Select>
        </V2Field>
        <V2Field label={t('Situação')} htmlFor="ref-situacao">
          <V2Select id="ref-situacao" value={f.status} onChange={(e) => setF((x) => ({ ...x, status: e.target.value }))}>
            {Object.values(REFEREE_STATUS).map((s) => <option key={s} value={s}>{t(REFEREE_STATUS_LABELS[s])}</option>)}
          </V2Select>
        </V2Field>
        <V2Field label={t('No quadro desde')} htmlFor="ref-desde"><V2Input id="ref-desde" type="date" max={isoDateBR()} value={f.since} onChange={(e) => setF((x) => ({ ...x, since: e.target.value }))} /></V2Field>
      </div>
      {mudaNivel && (
        <V2Field label={t('Motivo da mudança de nível (vai no aviso e no histórico)')} htmlFor="ref-motivo-nivel">
          <V2Textarea id="ref-motivo-nivel" rows={2} maxLength={REFEREE_LIMITS.REASON_MAX} value={motivoNivel} onChange={(e) => setMotivoNivel(e.target.value)} />
        </V2Field>
      )}
      {!novo && referee.promotion_progress && <PromotionProgress progress={referee.promotion_progress} />}
      {!novo && (referee.level_history || []).length > 0 && (
        <details>
          <summary className="flex min-h-11 cursor-pointer items-center text-sm font-semibold text-ink">{t('Histórico de nível ({n})', { n: referee.level_history.length })}</summary>
          <ul className="space-y-1 text-sm text-ink">
            {referee.level_history.slice().reverse().map((h) => (
              <li key={h.at_ms}>
                {dataCurta(h.at)} · {h.declined ? t('Pedido de {nivel} recusado', { nivel: levelLabel(rules, h.to) || h.to }) : t('{de} → {para}', { de: levelLabel(rules, h.from) || h.from || '—', para: levelLabel(rules, h.to) || h.to })}
                {h.reason ? <span className="text-gray-500"> · {h.reason}</span> : null}
              </li>
            ))}
          </ul>
        </details>
      )}
      <fieldset>
        <legend className="mb-1 text-sm font-semibold text-ink">{t('Funções em que atua')}</legend>
        <div className="grid gap-1 sm:grid-cols-2">
          {REFEREE_FUNCTIONS.map((fn) => (
            <label key={fn} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl px-2 hover:bg-gray-50">
              <input type="checkbox" className="h-4 w-4" checked={f.functions.includes(fn)} onChange={() => toggleFn(fn)} />
              <span className="text-sm text-ink">{funcao(fn)}</span>
            </label>
          ))}
        </div>
        {r.errors.functions && <p className="mt-1 text-xs font-semibold text-red-600">{r.errors.functions}</p>}
      </fieldset>
      <V2Field label={t('Notas da equipe (o árbitro não vê)')} htmlFor="ref-notas">
        {notasQ.isError
          ? <V2ErrorState inline title={t('Não carregou as notas')} onRetry={() => notasQ.refetch()} />
          : <V2Textarea id="ref-notas" rows={3} maxLength={REFEREE_LIMITS.NOTES_MAX} disabled={!novo && notasQ.isLoading} value={notas ?? (notasQ.data || '')} onChange={(e) => setNotas(e.target.value)} />}
      </V2Field>
      <div className="flex justify-end gap-2">
        <V2Button type="button" variant="ghost" onClick={onFechar}>{t('Voltar')}</V2Button>
        <V2Button type="submit" disabled={m.isPending}><UserCheck className="h-4 w-4" />{novo ? t('Incluir no quadro') : t('Salvar')}</V2Button>
      </div>
    </form>
  );
}

function RecusarPromocao({ federation, referee, rules, onFechar }) {
  const [reason, setReason] = useState('');
  const m = useFederationMutation(() => refereesAction({ federationId: federation.id, action: 'promotion_decline', userId: referee.user_id, reason }));
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onFechar(); }}>
      <DialogContent className="max-h-[90dvh] max-w-lg overflow-y-auto">
        <DialogTitle>{t('Recusar o pedido de promoção')}</DialogTitle>
        <DialogDescription>{t('{nome} pediu {nivel}. O motivo vai no aviso.', { nome: referee.name, nivel: levelLabel(rules, referee.promotion_request?.to) })}</DialogDescription>
        <form noValidate className="space-y-3" onSubmit={(e) => { e.preventDefault(); if (reason.trim().length < 3) { toast.error(t('Diga o motivo.')); return; } m.mutate(undefined, { onSuccess: () => { toast.success(t('Pedido recusado e árbitro avisado.')); onFechar(); }, onError: (er) => toast.error(er.message) }); }}>
          <V2Field label={t('Motivo')} htmlFor="ref-recusa-motivo" required><V2Textarea id="ref-recusa-motivo" rows={3} maxLength={REFEREE_LIMITS.REASON_MAX} value={reason} onChange={(e) => setReason(e.target.value)} /></V2Field>
          <div className="flex justify-end gap-2">
            <V2Button type="button" variant="ghost" onClick={onFechar}>{t('Voltar')}</V2Button>
            <V2Button type="submit" variant="danger" disabled={m.isPending}><X className="h-4 w-4" />{t('Recusar')}</V2Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function RemoverArbitro({ federation, referee, onFechar }) {
  const m = useFederationMutation(() => refereesAction({ federationId: federation.id, action: 'roster_remove', userId: referee.user_id }));
  return (
    <ConfirmDialog
      open
      onOpenChange={(o) => { if (!o) onFechar(); }}
      destructive
      loading={m.isPending}
      title={t('Tirar {nome} do quadro?', { nome: referee.name })}
      description={t('O cadastro e as notas da equipe são apagados; as atuações passadas ficam no histórico das escalas. Com escala em aberto, cancele ou substitua antes.')}
      confirmLabel={t('Tirar do quadro')}
      cancelLabel={t('Voltar')}
      onConfirm={() => m.mutate(undefined, { onSuccess: () => { toast.success(t('Árbitro retirado do quadro.')); onFechar(); }, onError: (e) => toast.error(e.message) })}
    />
  );
}

export default function RefRosterTab({ federation, rules, rosterQ, credentialsQ }) {
  const [aberto, setAberto] = useState(null); // { modo, referee }
  const roster = useMemo(() => (rosterQ.data || []).slice().sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')), [rosterQ.data]);
  const busca = useBuscaLista(roster, CAMPOS_BUSCA);
  const fechar = () => setAberto(null);
  return (
    <section className="space-y-4" aria-label={t('Quadro de arbitragem')} data-dica="federacao-arbitragem-quadro">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <BuscaLista id="ref-busca" className="min-w-0 flex-1 sm:max-w-sm" value={busca.termo} onChange={busca.setTermo} placeholder={t('Buscar por nome ou cidade')} total={roster.length} achados={busca.filtrados.length} />
        {rosterQ.isSuccess && <V2Button type="button" onClick={() => setAberto({ modo: 'novo' })} data-dica="federacao-arbitragem-incluir"><Plus className="h-4 w-4" />{t('Incluir árbitro')}</V2Button>}
      </div>
      {rosterQ.isError && <V2ErrorState inline title={t('Não carregou o quadro')} onRetry={() => rosterQ.refetch()} />}
      {rosterQ.isLoading && <V2Skeleton lines={4} />}
      {rosterQ.isSuccess && roster.length === 0 && (
        <V2EmptyState icon={Award} title={t('O quadro está vazio')} description={t('Inclua quem pode apitar: pela lista de usuários ou pela credencial de árbitro dos cursos da federação.')} />
      )}
      {busca.visiveis.length > 0 && (
        <ul className="grid gap-2 md:grid-cols-2">
          {busca.visiveis.map((r) => (
            <li key={r.user_id}>
              <V2Surface variant="compacto" className="flex items-start gap-3 p-3">
                <V2Avatar photoUrl={r.photo_url} name={r.name} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 font-bold text-ink">{r.name}<V2Badge tone={TOM[r.status] || 'neutral'}>{t(REFEREE_STATUS_LABELS[r.status] || r.status)}</V2Badge></p>
                  <p className="text-xs text-gray-500">{levelLabel(rules, r.level)} · {(r.functions || []).map(funcao).join(', ')}</p>
                  <p className="text-xs text-gray-500">
                    {tn(r.stats?.acts || 0, '{n} atuação', '{n} atuações')}
                    {r.stats?.no_show ? ` · ${tn(r.stats.no_show, '{n} ausência', '{n} ausências')}` : ''}
                    {r.stats?.evaluations ? ` · ${t('média {m}', { m: r.stats.avg })}` : ''}
                    {r.since ? ` · ${t('desde {data}', { data: dataCurta(r.since) })}` : ''}
                  </p>
                  <p className="mt-1 flex flex-wrap gap-1">
                    {r.public_listing && <V2Badge tone="blue"><Eye className="h-3 w-3" aria-hidden="true" />{t('No quadro público')}</V2Badge>}
                    {(r.unavailable || []).length > 0 && <V2Badge tone="neutral">{tn(r.unavailable.length, '{n} data indisponível', '{n} datas indisponíveis')}</V2Badge>}
                    {(r.credential_ids || []).length > 0 && <V2Badge tone="neutral">{t('Credenciado')}</V2Badge>}
                    <CredencialBadge referee={r} rules={rules} />
                  </p>
                  {r.promotion_request && (
                    <div className="mt-2 flex flex-wrap items-center gap-2 rounded-xl bg-acid/10 p-2">
                      <span className="flex items-center gap-1 text-xs font-semibold text-ink"><TrendingUp className="h-3.5 w-3.5" aria-hidden="true" />{t('Pediu {nivel}', { nivel: levelLabel(rules, r.promotion_request.to) || r.promotion_request.to })}{r.promotion_request.met === true ? ` · ${t('cumpre os requisitos')}` : ''}</span>
                      <V2Button type="button" size="sm" onClick={() => setAberto({ modo: 'editar', referee: r, nivel: r.promotion_request.to })}>{t('Promover')}</V2Button>
                      <V2Button type="button" size="sm" variant="ghost" onClick={() => setAberto({ modo: 'recusar', referee: r })}>{t('Recusar')}</V2Button>
                    </div>
                  )}
                </div>
                <div className="flex shrink-0 gap-1">
                  <V2Button type="button" size="icon" variant="ghost" aria-label={t('Editar {nome}', { nome: r.name })} onClick={() => setAberto({ modo: 'editar', referee: r })}><Pencil className="h-4 w-4" /></V2Button>
                  <V2Button type="button" size="icon" variant="ghost" aria-label={t('Tirar {nome} do quadro', { nome: r.name })} onClick={() => setAberto({ modo: 'remover', referee: r })}><Trash2 className="h-4 w-4" /></V2Button>
                </div>
              </V2Surface>
            </li>
          ))}
        </ul>
      )}
      <MostrarMais restam={busca.restam} onClick={busca.mostrarMais} />
      <Dialog open={aberto?.modo === 'novo' || aberto?.modo === 'editar'} onOpenChange={(o) => { if (!o) fechar(); }}>
        <DialogContent className="max-h-[90dvh] max-w-2xl overflow-y-auto" onInteractOutside={(e) => { if (haAlteracaoNaoSalva()) e.preventDefault(); }}>
          <DialogTitle>{aberto?.modo === 'novo' ? t('Incluir no quadro de arbitragem') : t('Cadastro no quadro')}</DialogTitle>
          <DialogDescription>{aberto?.referee?.name || t('A pessoa é avisada e passa a receber convocações.')}</DialogDescription>
          {(aberto?.modo === 'novo' || aberto?.modo === 'editar') && (
            <CadastroForm federation={federation} rules={rules} referee={aberto.referee} roster={roster} credentials={credentialsQ?.isSuccess ? credentialsQ.data : []} nivelInicial={aberto.nivel} onFechar={fechar} />
          )}
        </DialogContent>
      </Dialog>
      {aberto?.modo === 'remover' && <RemoverArbitro federation={federation} referee={aberto.referee} onFechar={fechar} />}
      {aberto?.modo === 'recusar' && <RecusarPromocao federation={federation} referee={aberto.referee} rules={rules} onFechar={fechar} />}
    </section>
  );
}
