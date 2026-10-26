/**
 * O PAINEL de uma eleição para quem a conduz (a comissão; sem comissão, o
 * admin) e para o admin da federação: linha do tempo com o próximo passo,
 * chapas (análise, apoios, alertas), impugnações (julgadas depois da
 * defesa), votação ao vivo só em PERCENTUAL, apuração, votação presencial
 * e o resultado. Tudo passa pelo servidor (`federationElections`).
 */
import React, { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { AlertTriangle, Ban, FileText, Gavel, Lock, Pencil, Play, Square, Trophy, Users } from 'lucide-react';
import {
  CANDIDACY_STATUS, REASON_MIN, STATUS, TODO_LABEL, challengeReady, commissionTodo, votingClosesMs, votingOpensMs,
} from '@/modules/federations/domain/elections';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { V2Badge, V2Button, V2EmptyState, V2ErrorState, V2Field, V2Input, V2Skeleton, V2Surface, V2Textarea, V2Toggle } from '@/v2/ui/primitives';
import { BuscaLista, MostrarMais, useBuscaLista } from '../manage/listTools';
import FedPersonPicker from '../manage/FedPersonPicker';
import { fmtNumero, t } from '@/core/i18n';
import { CandidacyCard, ElectionStatusBadge, ElectionTimeline, Participation, ResultChart, hojeBr } from './electionsUi';
import { isClubElections, useScopedCandidacies, useScopedElectionAction, useScopedVoters } from './electionsScope';
import ClubPosseDialog from './ClubPosseDialog';

const CAMPOS_ELEITOR = ['name'];
const nomeDaPessoa =(a) => a?.platform_name || a?.full_name || a?.display_name || '';

/** Pergunta com motivo (julgar, cancelar): o botão só libera com o mínimo de letras. */
function ComMotivo({ pedido, onClose, onConfirm, loading }) {
  const [motivo, setMotivo] = useState('');
  const obrigatorio = pedido?.obrigatorio !== false;
  return (
    <ConfirmDialog
      open={Boolean(pedido)}
      onOpenChange={(o) => { if (!o) { setMotivo(''); onClose(); } }}
      destructive={pedido?.destructive}
      title={pedido?.title || ''}
      description={pedido?.description || ''}
      confirmLabel={pedido?.confirmLabel || t('Confirmar')}
      cancelLabel={t('Voltar')}
      loading={loading}
      confirmDisabled={obrigatorio && motivo.trim().length < REASON_MIN}
      onConfirm={() => { onConfirm(motivo.trim()); setMotivo(''); }}
    >
      <V2Field label={obrigatorio ? t('Motivo (vai para a chapa e para o histórico)') : t('Observação (opcional)')} htmlFor="el-motivo-acao" hint={obrigatorio ? t('Mínimo de {n} caracteres.', { n: REASON_MIN }) : undefined}>
        <V2Textarea id="el-motivo-acao" rows={3} maxLength={1000} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
      </V2Field>
    </ConfirmDialog>
  );
}

function Chapas({ federation, e, podeConduzir, executar, pendente }) {
  const q = useScopedCandidacies(federation, e.id, { all: true });
  const clube = isClubElections(federation);
  const [pedido, setPedido] = useState(null);
  const hoje = hojeBr();
  if (q.isError) return <V2ErrorState inline title={t('Não carregaram as chapas')} onRetry={q.refetch} />;
  if (q.isLoading) return <V2Skeleton lines={3} />;
  const chapas = (q.data || []).filter((c) => c.status !== CANDIDACY_STATUS.WITHDRAWN || podeConduzir);
  if (!chapas.length) return <V2EmptyState icon={Users} title={t('Nenhuma chapa registrada ainda')} description={e.status === STATUS.PUBLISHED ? (clube ? t('Os associados registram as chapas pela aba Eleições da página do clube, no prazo do edital.') : t('Os filiados registram as chapas pela aba Eleições da página da federação, no prazo do edital.')) : undefined} />;
  const julgar = e.status === STATUS.PUBLISHED && podeConduzir;
  const confirmar = (motivo) => {
    const p = pedido;
    setPedido(null);
    executar({ action: 'judge', candidacyId: p.c.id, ...(p.challengeId ? { challengeId: p.challengeId, upheld: p.upheld } : { decision: p.decision }), reason: motivo }, p.ok);
  };
  return (
    <div className="space-y-3">
      {chapas.map((c) => {
        const position = (e.positions || []).find((p) => p.id === c.position_id);
        const faltam = Math.max(0, (e.endorsements_needed || 0) - (c.endorsement_count || 0));
        return (
          <CandidacyCard key={c.id} c={c} position={position} showStatus>
            <div className="w-full space-y-2">
              <p className="text-xs text-gray-500">{t('Apoios: {n} de {m} exigidos', { n: fmtNumero(c.endorsement_count || 0), m: fmtNumero(e.endorsements_needed || 0) })} · {t('Registrada por {nome}', { nome: c.submitted_by_name || '—' })}</p>
              {(c.alerts || []).map((a) => (
                <p key={a.id} className="flex items-start gap-1 text-sm text-amber-800"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  {a.id === 'women' ? t('Mulheres abaixo de 30% na chapa ({n} de {total}). A lei pede ao menos 30% na diretoria.', { n: a.women, total: a.total }) : t('O cabeça de chapa é o presidente atual: confira se a recondução é permitida (a lei admite uma só).')}
                </p>
              ))}
              {(c.challenges || []).map((ch) => (
                <div key={ch.id} className="rounded-xl bg-gray-50 p-3 text-sm">
                  <p className="font-semibold text-ink">{t('Impugnação de {nome}', { nome: ch.by_name || '—' })}</p>
                  <p className="whitespace-pre-line text-gray-600">{ch.reason}</p>
                  <p className="mt-1 text-gray-500">{ch.defense ? <><span className="font-semibold text-ink">{t('Defesa:')}</span> {ch.defense}</> : t('Sem defesa ainda (prazo: {data}).', { data: e.calendar?.defense_to?.split('-').reverse().join('/') })}</p>
                  {ch.decision && <p className="mt-1 font-semibold text-ink">{ch.decision.upheld ? t('Procedente: chapa indeferida.') : t('Improcedente: a chapa segue.')} <span className="font-normal text-gray-500">{ch.decision.reason}</span></p>}
                  {julgar && !ch.decision && (challengeReady(ch, e, hoje) ? (
                    <div className="mt-2 flex flex-wrap gap-2">
                      <V2Button type="button" size="sm" variant="danger" disabled={pendente} onClick={() => setPedido({ c, challengeId: ch.id, upheld: true, destructive: true, title: t('Impugnação procedente?'), description: t('A chapa "{nome}" sai da eleição.', { nome: c.name }), confirmLabel: t('Procedente'), ok: t('Impugnação julgada.') })}><Gavel className="h-4 w-4" />{t('Procedente')}</V2Button>
                      <V2Button type="button" size="sm" variant="secondary" disabled={pendente} onClick={() => setPedido({ c, challengeId: ch.id, upheld: false, title: t('Impugnação improcedente?'), description: t('A chapa "{nome}" segue na eleição.', { nome: c.name }), confirmLabel: t('Improcedente'), ok: t('Impugnação julgada.') })}>{t('Improcedente')}</V2Button>
                    </div>
                  ) : <p className="mt-1 text-xs text-gray-500">{t('Julgue depois da defesa ou do fim do prazo de defesa.')}</p>)}
                </div>
              ))}
              {julgar && c.status === CANDIDACY_STATUS.SUBMITTED && (
                <div className="flex flex-wrap gap-2">
                  <V2Button type="button" size="sm" disabled={pendente || faltam > 0} data-dica="federacao-eleicao-aceitar" onClick={() => setPedido({ c, decision: 'accept', obrigatorio: false, title: t('Aceitar a chapa?'), description: t('A chapa "{nome}" passa a aparecer na página e na cédula.', { nome: c.name }), confirmLabel: t('Aceitar'), ok: t('Chapa aceita.') })}>{t('Aceitar')}</V2Button>
                  <V2Button type="button" size="sm" variant="danger" disabled={pendente} onClick={() => setPedido({ c, decision: 'reject', destructive: true, title: t('Indeferir a chapa?'), description: t('A chapa "{nome}" não concorre. Quem está nela é avisado.', { nome: c.name }), confirmLabel: t('Indeferir'), ok: t('Chapa indeferida.') })}>{t('Indeferir')}</V2Button>
                  {faltam > 0 && <p className="self-center text-xs text-gray-500">{t('Faltam {n} apoios para aceitar.', { n: faltam })}</p>}
                </div>
              )}
            </div>
          </CandidacyCard>
        );
      })}
      <ComMotivo pedido={pedido} loading={pendente} onClose={() => setPedido(null)} onConfirm={confirmar} />
    </div>
  );
}

/** A mesa presencial: quem votou na mesa e os totais de cada cargo (precisam fechar com o peso). */
function Presencial({ federation, e, executar, pendente }) {
  const votersQ = useScopedVoters(federation, e.id);
  const chapasQ = useScopedCandidacies(federation, e.id, { all: true });
  const [marcados, setMarcados] = useState(() => new Set());
  const [totais, setTotais] = useState({});
  const faltam = useMemo(() => (votersQ.data || []).filter((v) => !v.voted_at_ms), [votersQ.data]);
  const busca = useBuscaLista(faltam, CAMPOS_ELEITOR);
  if (votersQ.isError || chapasQ.isError) return <V2ErrorState inline title={t('Não carregou o colégio eleitoral')} onRetry={() => { votersQ.refetch(); chapasQ.refetch(); }} />;
  if (votersQ.isLoading || chapasQ.isLoading) return <V2Skeleton lines={4} />;
  const peso = faltam.filter((v) => marcados.has(v.id)).reduce((s, v) => s + (Number(v.weight) || 0), 0);
  const aceitas = (chapasQ.data || []).filter((c) => c.status === CANDIDACY_STATUS.ACCEPTED);
  const setTotal = (pid, op, v) => setTotais((x) => ({ ...x, [pid]: { ...(x[pid] || {}), [op]: v } }));
  const soma = (pid) => Object.values(totais[pid] || {}).reduce((s, v) => s + (Number(v) || 0), 0);
  const fecha = (e.positions || []).every((p) => soma(p.id) === peso);
  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">{t('Marque quem votou na mesa (quem já votou pelo aplicativo não aparece) e lance os totais de cada cargo, em PESO. O lançamento é feito uma vez só.')}</p>
      <BuscaLista id={`pres-busca-${e.id}`} value={busca.termo} onChange={busca.setTermo} placeholder={t('Buscar eleitor')} total={faltam.length} achados={busca.filtrados.length} />
      <ul className="max-h-72 space-y-1 overflow-auto">
        {busca.visiveis.map((v) => (
          <li key={v.id}><label className="flex min-h-11 items-center gap-3 rounded-xl px-2 hover:bg-gray-50"><input type="checkbox" className="h-5 w-5" checked={marcados.has(v.id)} onChange={(ev) => setMarcados((s) => { const n = new Set(s); if (ev.target.checked) n.add(v.id); else n.delete(v.id); return n; })} /><span className="flex-1 text-sm text-ink">{v.name || '—'}</span><span className="text-xs text-gray-500">{t('peso {n}', { n: v.weight })}</span></label></li>
        ))}
      </ul>
      <MostrarMais restam={busca.restam} onClick={busca.mostrarMais} />
      <p className="text-sm font-semibold text-ink">{t('Votaram na mesa: {n} eleitores, peso {p}.', { n: marcados.size, p: peso })}</p>
      {(e.positions || []).map((p) => (
        <fieldset key={p.id} className="rounded-2xl border border-gray-100 p-3">
          <legend className="px-1 text-sm font-semibold text-ink">{p.label} <span className={soma(p.id) === peso ? 'text-green-800' : 'text-amber-800'}>({t('soma {s} de {p}', { s: soma(p.id), p: peso })})</span></legend>
          <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
            {[...aceitas.filter((c) => c.position_id === p.id).map((c) => [c.id, c.name]), ['blank', t('Em branco')], ['null', t('Nulo')]].map(([op, nome]) => (
              <V2Field key={op} label={nome} htmlFor={`pres-${p.id}-${op}`}><V2Input id={`pres-${p.id}-${op}`} type="number" min={0} value={totais[p.id]?.[op] ?? ''} onChange={(ev) => setTotal(p.id, op, ev.target.value)} /></V2Field>
            ))}
          </div>
        </fieldset>
      ))}
      <V2Button type="button" disabled={pendente || !marcados.size || !fecha} onClick={() => executar({ action: 'record_presential', voterIds: [...marcados], totals: Object.fromEntries(Object.entries(totais).map(([pid, ops]) => [pid, Object.fromEntries(Object.entries(ops).map(([k, v]) => [k, Number(v) || 0]))])) }, t('Votação presencial lançada.'))}>{t('Lançar a votação presencial')}</V2Button>
    </div>
  );
}

function Comissao({ e, executar, pendente, onClose }) {
  const [lista, setLista] = useState(() => (e.commission || []).map((p) => ({ id: p.uid, platform_name: p.name })));
  return (
    <div className="space-y-3 rounded-2xl border border-gray-100 p-4">
      <p className="text-sm font-semibold text-ink">{t('Comissão eleitoral')}</p>
      <FedPersonPicker id={`el-com-${e.id}`} multiple max={7} selecionados={lista} onChange={setLista} />
      <div className="flex gap-2">
        <V2Button type="button" disabled={pendente} onClick={() => executar({ action: 'commission', commission: lista.map((a) => ({ uid: a.id, name: nomeDaPessoa(a) })) }, t('Comissão salva.'), onClose)}>{t('Salvar a comissão')}</V2Button>
        <V2Button type="button" variant="ghost" onClick={onClose}>{t('Cancelar')}</V2Button>
      </div>
    </div>
  );
}

export default function ElectionConductPanel({ federation, election: e, isAdmin = false, canConduct = false, onEdit }) {
  const acao = useScopedElectionAction(federation);
  const clube = isClubElections(federation);
  const [posse, setPosse] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [cancelar, setCancelar] = useState(false);
  const [comissao, setComissao] = useState(false);
  const [apuracao, setApuracao] = useState(null);
  const [aplicar, setAplicar] = useState(false);
  const [fimMandato, setFimMandato] = useState('');
  const hoje = hojeBr();
  const agora = Date.now();
  const chapasQ = useScopedCandidacies(federation, e.id, { all: true, enabled: canConduct || isAdmin });
  const todo = chapasQ.isSuccess ? commissionTodo(e, chapasQ.data, { hoje, nowMs: agora }) : [];
  const executar = (payload, ok, depois) => acao.mutate({ federationId: federation.id, electionId: e.id, ...payload }, {
    onSuccess: (res) => { if (ok) toast.success(ok); if (payload.action === 'count') setApuracao(res.results); depois?.(res); },
    onError: (er) => toast.error(er.message),
  });
  const semComissao = !(e.commission_uids || []).length;
  return (
    <V2Surface className="space-y-5 p-5 sm:p-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-display text-xl text-ink">{e.title}</h3>
          <div className="mt-1 flex flex-wrap items-center gap-2"><ElectionStatusBadge e={e} hoje={hoje} />{e.notice_code && <V2Badge tone="neutral"><FileText className="mr-1 h-3 w-3" aria-hidden="true" />{e.notice_code}</V2Badge>}</div>
        </div>
        {isAdmin && (
          <div className="flex flex-wrap gap-2">
            {[STATUS.DRAFT, STATUS.PUBLISHED].includes(e.status) && <V2Button type="button" size="sm" variant="secondary" onClick={() => onEdit?.(e)}><Pencil className="h-4 w-4" />{e.status === STATUS.DRAFT ? t('Editar') : t('Ajustar calendário/colégio')}</V2Button>}
            {e.status !== STATUS.CLOSED && e.status !== STATUS.CANCELLED && <V2Button type="button" size="sm" variant="ghost" onClick={() => setComissao((x) => !x)}><Users className="h-4 w-4" />{t('Comissão')}</V2Button>}
            {e.status !== STATUS.CLOSED && e.status !== STATUS.CANCELLED && <V2Button type="button" size="sm" variant="ghost" onClick={() => setCancelar(true)}><Ban className="h-4 w-4" />{t('Cancelar a eleição')}</V2Button>}
          </div>
        )}
      </header>

      {semComissao && e.status !== STATUS.CLOSED && e.status !== STATUS.CANCELLED && <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900">{clube ? t('Sem comissão eleitoral nomeada: a administração do clube conduz. O ideal é nomear uma comissão independente.') : t('Sem comissão eleitoral nomeada: o admin da federação conduz. O ideal é nomear uma comissão independente.')}</p>}
      {comissao && <Comissao e={e} executar={executar} pendente={acao.isPending} onClose={() => setComissao(false)} />}
      {e.status === STATUS.CANCELLED && <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-800">{t('Cancelada: {motivo}', { motivo: e.cancel_reason || '—' })}</p>}

      {canConduct && todo.length > 0 && (
        <div className="rounded-2xl bg-acid/20 px-4 py-3">
          <p className="text-xs font-bold uppercase tracking-widest text-gray-500">{t('Próximo passo')}</p>
          <ul className="mt-1 space-y-0.5">{todo.map((x) => <li key={x.id} className="text-sm font-semibold text-ink">{t(TODO_LABEL[x.id])}{x.count ? ` (${x.count})` : ''}</li>)}</ul>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <ElectionTimeline e={e} hoje={hoje} />
        <div className="space-y-5">
          {e.status === STATUS.PUBLISHED && canConduct && (
            <div className="flex flex-wrap items-center gap-2">
              <V2Button type="button" disabled={acao.isPending || !todo.some((x) => x.id === 'open_voting')} onClick={() => setConfirm({ action: 'open_voting', title: t('Abrir a votação?'), description: t('O colégio eleitoral é congelado agora: quem não estiver em dia neste momento não vota. Os eleitores são avisados.'), label: t('Abrir a votação'), ok: t('Votação aberta.') })} data-dica="federacao-eleicao-abrir"><Play className="h-4 w-4" />{t('Abrir a votação')}</V2Button>
              {agora < votingOpensMs(e) && <p className="text-xs text-gray-500">{t('Abre a partir de {data} às {hora}.', { data: e.calendar.voting_from.split('-').reverse().join('/'), hora: e.calendar.voting_opens })}</p>}
            </div>
          )}
          {e.status === STATUS.VOTING && (
            <div className="space-y-3">
              <Participation e={e} />
              <p className="flex items-center gap-1 text-xs text-gray-500"><Lock className="h-3.5 w-3.5" aria-hidden="true" />{t('O voto é secreto: ninguém vê em quem cada eleitor votou, nem a comissão. Parcial de resultado não existe.')}</p>
              {canConduct && <V2Button type="button" variant="secondary" disabled={acao.isPending || agora < votingClosesMs(e)} onClick={() => setConfirm({ action: 'close_voting', title: t('Encerrar a votação?'), description: t('Ninguém mais vota pelo aplicativo depois disso.'), label: t('Encerrar'), ok: t('Votação encerrada.') })}><Square className="h-4 w-4" />{t('Encerrar a votação')}</V2Button>}
            </div>
          )}
          {e.status === STATUS.COUNTING && canConduct && (
            <div className="space-y-4">
              <Participation e={e} />
              {e.mode !== 'online' && !e.presential && <Presencial federation={federation} e={e} executar={executar} pendente={acao.isPending} />}
              <div className="flex flex-wrap gap-2">
                <V2Button type="button" variant="secondary" disabled={acao.isPending} onClick={() => executar({ action: 'count' })}>{t('Apurar (prévia só da comissão)')}</V2Button>
                <V2Button type="button" disabled={acao.isPending || (e.mode !== 'online' && !e.presential)} onClick={() => setConfirm({ action: 'publish_result', title: t('Publicar o resultado?'), description: clube ? t('A apuração é refeita no servidor, o resultado vai para a página e a ata para os documentos do clube. Todos os associados são avisados.') : t('A apuração é refeita no servidor, o resultado vai para a página e a ata para o acervo. Todos os filiados são avisados.'), label: t('Publicar'), ok: t('Resultado publicado.'), governanca: isAdmin && !clube })} data-dica="federacao-eleicao-resultado"><Trophy className="h-4 w-4" />{t('Publicar o resultado')}</V2Button>
              </div>
              {apuracao && <ResultChart results={apuracao} />}
            </div>
          )}
          {e.status === STATUS.CLOSED && (
            <div className="space-y-3">
              <ResultChart results={e.results || []} />
              {e.minutes_code && <p className="text-sm text-gray-500">{t('Ata no acervo: {codigo}', { codigo: e.minutes_code })}</p>}
              {isAdmin && clube && <V2Button type="button" variant="secondary" onClick={() => setPosse(true)} data-dica="clube-eleicao-posse">{e.governance_applied ? t('Dar posse a mais gente') : t('Dar posse aos eleitos')}</V2Button>}
              {isAdmin && !clube && !e.governance_applied && <V2Button type="button" variant="secondary" disabled={acao.isPending} onClick={() => setConfirm({ action: 'apply_governance', title: t('Levar os eleitos para a governança?'), description: t('A diretoria e o conselho fiscal eleitos substituem a lista da página (Transparência). As permissões da equipe não mudam.'), label: t('Atualizar a governança'), ok: t('Governança atualizada.'), mandato: true })}>{t('Levar os eleitos para a governança')}</V2Button>}
            </div>
          )}
          {(canConduct || isAdmin) && e.status !== STATUS.DRAFT && (
            <section className="space-y-2">
              <h4 className="font-semibold text-ink">{t('Chapas')}</h4>
              <Chapas federation={federation} e={e} podeConduzir={canConduct} executar={executar} pendente={acao.isPending} />
            </section>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={Boolean(confirm)}
        onOpenChange={(o) => { if (!o) setConfirm(null); }}
        title={confirm?.title || ''}
        description={confirm?.description || ''}
        confirmLabel={confirm?.label || t('Confirmar')}
        cancelLabel={t('Voltar')}
        loading={acao.isPending}
        onConfirm={() => {
          const c = confirm;
          setConfirm(null);
          executar({ action: c.action, ...(c.governanca && aplicar ? { applyGovernance: true, mandateEnd: fimMandato } : {}), ...(c.mandato ? { mandateEnd: fimMandato } : {}) }, c.ok);
        }}
      >
        {(confirm?.governanca || confirm?.mandato) && (
          <div className="space-y-3">
            {confirm?.governanca && <V2Toggle id="el-aplicar" checked={aplicar} onChange={setAplicar} label={t('Levar os eleitos para a governança da federação')} />}
            {(confirm?.mandato || aplicar) && <V2Field label={t('Fim do mandato (opcional)')} htmlFor="el-fim-mandato"><V2Input id="el-fim-mandato" type="date" value={fimMandato} onChange={(ev) => setFimMandato(ev.target.value)} /></V2Field>}
          </div>
        )}
      </ConfirmDialog>
      {clube && posse && <ClubPosseDialog club={federation} election={e} open={posse} onClose={() => setPosse(false)} />}
      <ComMotivo
        pedido={cancelar ? { destructive: true, title: t('Cancelar a eleição?'), description: clube ? t('Não tem volta. Os associados são avisados com o motivo.') : t('Não tem volta. Os filiados são avisados com o motivo.'), confirmLabel: t('Cancelar a eleição') } : null}
        loading={acao.isPending}
        onClose={() => setCancelar(false)}
        onConfirm={(motivo) => { setCancelar(false); executar({ action: 'cancel', reason: motivo }, t('Eleição cancelada.')); }}
      />
    </V2Surface>
  );
}
