/**
 * O que o DIRETOR do torneio chancelado entrega (Bloco 2): o checklist antes
 * do evento (seguro, arbitragem, local, primeiros socorros, programação) e o
 * relatório depois (inscritos, W.O., ocorrências, lesões, reclamações). Quem
 * grava é o servidor (`federationCompetition`); a régua é
 * `domain/competitions.js`. Serve à gestão do torneio e à Minha área.
 */
import React, { useState } from 'react';
import { toast } from 'sonner';
import { ClipboardCheck, FileText } from 'lucide-react';
import { CHECKLIST_ITEMS, CHECKLIST_LABELS, directorStage, validateEventReport } from '@/modules/federations/domain/competitions';
import { isoDate } from '@/modules/federations/domain/membership';
import { competitionAction } from '@/modules/federations/services/competitionsService';
import { useFederation, useFederationMutation } from '@/modules/federations/hooks/useFederations';
import { fedModuleOn } from '@/modules/federations/domain/federation';
import { V2Badge, V2Button, V2Field, V2Input, V2Textarea, V2Toggle } from '@/v2/ui/primitives';
import { t } from '@/core/i18n';
import { quando } from '../federationUi';

const NUMEROS = [
  ['entrants', 'Inscritos'], ['walkovers', 'W.O.'], ['injuries', 'Lesões'], ['complaints', 'Reclamações'],
];

export default function DirectorReportForm({ report, readOnly = false }) {
  const hoje = isoDate();
  const etapa = directorStage(report, report, hoje);
  const c = report.checklist || null;
  const r = report.report || null;
  const [itens, setItens] = useState(() => Object.fromEntries(CHECKLIST_ITEMS.map((id) => [id, Boolean(c?.items?.[id])])));
  const [notas, setNotas] = useState(c?.notes || '');
  const [f, setF] = useState(() => ({
    entrants: r?.entrants ?? '', walkovers: r?.walkovers ?? '', injuries: r?.injuries ?? '', complaints: r?.complaints ?? '',
    incidents_text: r?.incidents_text || '', injuries_text: r?.injuries_text || '', complaints_text: r?.complaints_text || '', notes: r?.notes || '',
    equipment_checked: r?.equipment_checked === true, antidoping_clauses: r?.antidoping_clauses === true,
  }));
  const [editando, setEditando] = useState(false);
  // Jogo limpo: as duas confirmações só aparecem com o módulo ligado na federação.
  const fq = useFederation(report.federation_id);
  const pedeEquip = fedModuleOn(fq.data, 'equipment');
  const pedeDoping = fedModuleOn(fq.data, 'antidoping');
  const salvarChecklist = useFederationMutation(() => competitionAction(report.federation_id, 'checklist', { tournamentId: report.id, items: itens, notes: notas }));
  const enviar = useFederationMutation(() => competitionAction(report.federation_id, 'report', { tournamentId: report.id, ...f }));
  const validado = validateEventReport(f);
  const mostrarRelatorio = etapa !== 'checklist';
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));

  return (
    <div className="space-y-4" data-dica="torneio-diretor">
      <section className="space-y-2">
        <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-ink">
          <ClipboardCheck className="h-4 w-4" />{t('Checklist antes do evento')}
          {c ? <V2Badge tone={c.complete ? 'green' : 'amber'}>{c.complete ? t('Completo') : t('Incompleto')}</V2Badge> : <V2Badge tone="neutral">{t('Não feito')}</V2Badge>}
        </p>
        {c?.at_ms && <p className="text-xs text-gray-500">{t('Atualizado em {data} por {nome}', { data: quando(c.at_ms), nome: c.by_name || '' })}</p>}
        <div className="grid gap-2 sm:grid-cols-2">
          {CHECKLIST_ITEMS.map((id) => (
            <V2Toggle key={id} id={`chk-${report.id}-${id}`} checked={itens[id]} disabled={readOnly || etapa === 'done'} onChange={(v) => setItens((x) => ({ ...x, [id]: v }))} label={t(CHECKLIST_LABELS[id])} />
          ))}
        </div>
        {!readOnly && etapa !== 'done' && (
          <>
            <V2Field label={t('Observações')} htmlFor={`chk-notas-${report.id}`}>
              <V2Textarea id={`chk-notas-${report.id}`} rows={2} value={notas} onChange={(e) => setNotas(e.target.value)} maxLength={500} />
            </V2Field>
            <div className="flex justify-end">
              <V2Button type="button" size="sm" variant="secondary" disabled={salvarChecklist.isPending} onClick={() => salvarChecklist.mutate(undefined, { onSuccess: () => toast.success(t('Checklist salvo.')), onError: (e) => toast.error(e.message) })}>{t('Salvar checklist')}</V2Button>
            </div>
          </>
        )}
      </section>

      {mostrarRelatorio && (
        <section className="space-y-2 border-t border-gray-100 pt-3">
          <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-ink">
            <FileText className="h-4 w-4" />{t('Relatório do evento')}
            {r ? <V2Badge tone="green">{t('Entregue')}</V2Badge> : <V2Badge tone="amber">{t('Pendente')}</V2Badge>}
          </p>
          {r && !editando ? (
            <div className="space-y-1 text-sm text-gray-700">
              <p>{t('{inscritos} inscritos · {wo} W.O. · {lesoes} lesões · {reclamacoes} reclamações', { inscritos: r.entrants, wo: r.walkovers, lesoes: r.injuries, reclamacoes: r.complaints })}</p>
              {r.incidents_text && <p><strong>{t('Ocorrências')}:</strong> {r.incidents_text}</p>}
              {r.injuries_text && <p><strong>{t('Lesões')}:</strong> {r.injuries_text}</p>}
              {r.complaints_text && <p><strong>{t('Reclamações')}:</strong> {r.complaints_text}</p>}
              {r.notes && <p><strong>{t('Observações')}:</strong> {r.notes}</p>}
              {(pedeEquip || r.equipment_checked) && <p>{r.equipment_checked ? t('✓ Equipamentos conferidos com a lista homologada') : t('Equipamentos não conferidos com a lista homologada')}</p>}
              {(pedeDoping || r.antidoping_clauses) && <p>{r.antidoping_clauses ? t('✓ Cláusulas de antidopagem no regulamento') : t('Cláusulas de antidopagem não confirmadas')}</p>}
              <p className="text-xs text-gray-500">{t('Entregue em {data} por {nome}', { data: quando(r.submitted_at_ms), nome: r.by_name || '' })}</p>
              {!readOnly && <V2Button type="button" size="sm" variant="ghost" onClick={() => setEditando(true)}>{t('Corrigir relatório')}</V2Button>}
            </div>
          ) : !readOnly && (
            <form className="space-y-3" onSubmit={(e) => {
              e.preventDefault();
              if (!validado.ok) { toast.error(t('Descreva as lesões e as reclamações que você contou.')); return; }
              enviar.mutate(undefined, { onSuccess: () => { setEditando(false); toast.success(t('Relatório entregue. A federação foi avisada.')); }, onError: (er) => toast.error(er.message) });
            }}>
              <div className="grid gap-3 sm:grid-cols-4">
                {NUMEROS.map(([k, rotulo]) => (
                  <V2Field key={k} label={t(rotulo)} htmlFor={`rel-${report.id}-${k}`}>
                    <V2Input id={`rel-${report.id}-${k}`} type="number" min={0} max={9999} inputMode="numeric" value={f[k]} onChange={set(k)} />
                  </V2Field>
                ))}
              </div>
              <V2Field label={t('Ocorrências (atrasos, quadra, conduta)')} htmlFor={`rel-${report.id}-inc`}>
                <V2Textarea id={`rel-${report.id}-inc`} rows={2} maxLength={2000} value={f.incidents_text} onChange={set('incidents_text')} />
              </V2Field>
              <V2Field label={t('Lesões')} htmlFor={`rel-${report.id}-les`} error={validado.errors.injuries_text ? t('Descreva as lesões que você contou.') : ''}>
                <V2Textarea id={`rel-${report.id}-les`} rows={2} maxLength={2000} value={f.injuries_text} onChange={set('injuries_text')} />
              </V2Field>
              <V2Field label={t('Reclamações')} htmlFor={`rel-${report.id}-rec`} error={validado.errors.complaints_text ? t('Descreva as reclamações que você contou.') : ''}>
                <V2Textarea id={`rel-${report.id}-rec`} rows={2} maxLength={2000} value={f.complaints_text} onChange={set('complaints_text')} />
              </V2Field>
              <V2Field label={t('Observações')} htmlFor={`rel-${report.id}-obs`}>
                <V2Textarea id={`rel-${report.id}-obs`} rows={2} maxLength={2000} value={f.notes} onChange={set('notes')} />
              </V2Field>
              {pedeEquip && <V2Toggle id={`rel-${report.id}-equip`} checked={f.equipment_checked} onChange={(v) => setF((x) => ({ ...x, equipment_checked: v }))} label={t('Conferi os equipamentos com a lista homologada')} />}
              {pedeDoping && <V2Toggle id={`rel-${report.id}-doping`} checked={f.antidoping_clauses} onChange={(v) => setF((x) => ({ ...x, antidoping_clauses: v }))} label={t('O regulamento trouxe as cláusulas de antidopagem e a lista de inscritos saiu 30 dias antes')} />}
              <div className="flex justify-end gap-2">
                {editando && <V2Button type="button" size="sm" variant="ghost" onClick={() => setEditando(false)}>{t('Cancelar')}</V2Button>}
                <V2Button type="submit" size="sm" disabled={enviar.isPending}>{t('Entregar relatório')}</V2Button>
              </div>
            </form>
          )}
          {readOnly && !r && <p className="text-sm text-gray-500">{t('O diretor ainda não entregou o relatório.')}</p>}
        </section>
      )}
      {!mostrarRelatorio && <p className="text-xs text-gray-500">{t('O relatório do evento abre no dia do início do torneio.')}</p>}
    </div>
  );
}
