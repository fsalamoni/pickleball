/**
 * A reunião ou assembleia na página do evento: a CONVOCAÇÃO (data, com
 * quantos dias de antecedência, edital, quórum, segunda chamada), a PAUTA e,
 * depois de registrado, o RESULTADO de cada item (votos, resumo, o ato que
 * saiu dele), a presença e os documentos (ata, lista, registro de votação).
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { FileText, Lock, Megaphone, Users } from 'lucide-react';
import { ITEM_RESULTS, MEETING_CALLS, convocationNotice, itemKind } from '@/modules/federations/domain/meeting';
import { docPublicPath } from '@/modules/federations/domain/acervo';
import { V2Badge } from '@/v2/ui/primitives';
import { fmtData, t } from '@/core/i18n';

const TOM = { approved: 'green', rejected: 'red', elected: 'green', informed: 'blue', postponed: 'amber', withdrawn: 'neutral' };

function DocLink({ federation, doc, rotulo }) {
  if (!doc?.doc_id) return null;
  return (
    <Link to={docPublicPath(federation, doc.doc_id)} className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink underline underline-offset-2">
      {doc.visibility && doc.visibility !== 'public' ? <Lock className="h-3.5 w-3.5" aria-label={t('Restrito')} /> : <FileText className="h-3.5 w-3.5" aria-hidden="true" />}
      {rotulo ? `${rotulo}: ` : ''}{[doc.code, doc.title].filter(Boolean).join(' — ') || t('Documento')}
    </Link>
  );
}

const dataBr = (iso) => { const [y, m, d] = String(iso || '').split('-').map(Number); return y ? fmtData(new Date(y, m - 1, d), { day: '2-digit', month: '2-digit', year: 'numeric' }) : ''; };

export default function MeetingBlock({ federation, ev }) {
  const m = ev?.meeting;
  if (!m?.convened_on) return null;
  const aviso = convocationNotice(ev);
  const rec = m.record;
  const porId = new Map((rec?.items || []).map((x) => [x.id, x]));
  const chamada = MEETING_CALLS.find((c) => c.id === rec?.call);
  return (
    <section aria-labelledby="ev-reuniao" className="space-y-4 rounded-2xl border border-gray-100 bg-paper-pure p-4" data-dica="federacao-reuniao-publica">
      <h2 id="ev-reuniao" className="flex items-center gap-2 font-display text-lg font-bold text-ink"><Megaphone className="h-5 w-5" aria-hidden="true" />{rec ? t('Reunião realizada') : t('Convocação')}</h2>
      <div className="space-y-1 text-sm text-gray-700">
        <p>{aviso ? t('Convocada em {data}, {dias} dias antes.', { data: dataBr(m.convened_on), dias: Math.max(0, aviso.days) }) : t('Convocada em {data}.', { data: dataBr(m.convened_on) })}</p>
        {m.quorum_first && <p>{t('Quórum na primeira chamada: {q}', { q: m.quorum_first })}</p>}
        {m.second_call_time && <p>{m.quorum_second ? t('Segunda chamada às {hora}: {q}', { hora: m.second_call_time, q: m.quorum_second }) : t('Segunda chamada às {hora}.', { hora: m.second_call_time })}</p>}
        <DocLink federation={federation} doc={m.edital} rotulo={t('Edital')} />
      </div>
      {rec && (
        <div className="space-y-1 text-sm text-gray-700">
          <p className="flex flex-wrap items-center gap-2">
            <Users className="h-4 w-4 text-gray-500" aria-hidden="true" />
            {rec.eligible != null ? t('{n} presentes de {total} aptos', { n: rec.present, total: rec.eligible }) : t('{n} presentes', { n: rec.present })}
            {chamada && <span>· {t(chamada.label)}{rec.opened_at ? ` · ${rec.opened_at}` : ''}</span>}
            <V2Badge tone={rec.quorum_reached ? 'green' : 'amber'}>{rec.quorum_reached ? t('Com quórum') : t('Sem quórum')}</V2Badge>
          </p>
        </div>
      )}
      <div className="space-y-2">
        <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500">{t('Pauta')}</h3>
        <ol className="space-y-3">
          {(m.items || []).map((p, i) => {
            const r = porId.get(p.id);
            const tipo = itemKind(p.kind);
            return (
              <li key={p.id} className="space-y-1">
                <p className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-ink">{i + 1}. {p.title}</span>
                  {tipo && p.kind !== 'deliberation' && <V2Badge tone="neutral">{t(tipo.label)}</V2Badge>}
                  {r?.result && <V2Badge tone={TOM[r.result] || 'neutral'}>{t(ITEM_RESULTS[r.result].label)}</V2Badge>}
                </p>
                {p.description && <p className="whitespace-pre-line text-sm text-gray-700">{p.description}</p>}
                {r?.votes && <p className="text-sm text-gray-500">{t('A favor {sim} · Contra {nao} · Abstenções {abs}', { sim: r.votes.yes, nao: r.votes.no, abs: r.votes.abstain })}</p>}
                {r?.summary && <p className="whitespace-pre-line text-sm text-gray-700">{r.summary}</p>}
                {r?.doc && <DocLink federation={federation} doc={r.doc} />}
              </li>
            );
          })}
        </ol>
      </div>
      {rec && (rec.notes || rec.minutes || rec.attendance || rec.votes) && (
        <div className="space-y-1 border-t border-gray-100 pt-3">
          {rec.notes && <p className="whitespace-pre-line text-sm text-gray-700">{rec.notes}</p>}
          <div className="flex flex-col gap-1">
            <DocLink federation={federation} doc={rec.minutes} rotulo={t('Ata')} />
            <DocLink federation={federation} doc={rec.attendance} rotulo={t('Lista de presença')} />
            <DocLink federation={federation} doc={rec.votes} rotulo={t('Registro de votação')} />
          </div>
        </div>
      )}
    </section>
  );
}
