/**
 * Arbitragem → REGRAS E NÍVEIS (Central): os níveis do quadro (do mais
 * baixo ao mais alto — a ordem decide "abaixo do mínimo"), o nível mínimo e
 * a diária padrão de cada função, quantos de cada função um evento precisa
 * (a cobertura), o prazo de resposta e se o árbitro vê a escala inteira;
 * o que acontece quando a credencial vence (carência, aviso, perda da
 * escala — o servidor aplica) e os requisitos para subir a cada nível.
 * O código de um nível é gravado nos cadastros: não muda depois de criado.
 */
import React, { useState } from 'react';
import { toast } from 'sonner';
import { ArrowDown, ArrowUp, Plus, Save, Trash2 } from 'lucide-react';
import { refereesAction } from '@/modules/federations/services/refereesService';
import { useFederationMutation } from '@/modules/federations/hooks/useFederations';
import { CREDENTIAL_ON_EXPIRE_LABELS, REFEREE_FUNCTIONS, REFEREE_LIMITS, validateRefereeRules } from '@/modules/federations/domain/referees';
import { formatBrlCents, parseBrlCents } from '@/modules/federations/domain/charges';
import { useAvisoNaoSalvo } from '../manage/naoSalvo';
import { V2Button, V2Field, V2Input, V2Select, V2Surface, V2Toggle } from '@/v2/ui/primitives';
import { t } from '@/core/i18n';
import { funcao } from './refUi';

const codigo = (label, usados) => {
  const base = String(label || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 16) || 'nivel';
  let id = base;
  for (let i = 2; usados.has(id); i += 1) id = `${base}_${i}`.slice(0, 20);
  return id;
};
const reaisDe = (c) => (c == null ? '' : (c / 100).toFixed(2).replace('.', ','));

function deRegras(rules) {
  return {
    levels: rules.levels.map((l) => ({ ...l, salvo: true })),
    min: { ...rules.min_level_by_function },
    fee: Object.fromEntries(REFEREE_FUNCTIONS.map((f) => [f, reaisDe(rules.fee_default_cents[f])])),
    needs: Object.fromEntries(REFEREE_FUNCTIONS.map((f) => [f, rules.needs[f] == null ? '' : String(rules.needs[f])])),
    respond_days: String(rules.respond_days),
    crew_visible: rules.crew_visible,
    cred: { ...rules.credential_policy, grace_days: String(rules.credential_policy.grace_days), warn_days: String(rules.credential_policy.warn_days) },
    promo: Object.fromEntries(Object.entries(rules.promotion).map(([id, p]) => [id, { events: p.events ? String(p.events) : '', avg: p.avg ? String(p.avg).replace('.', ',') : '', months: p.months ? String(p.months) : '' }])),
  };
}
const numero = (v) => (String(v).trim() === '' ? '' : Number(String(v).replace(',', '.')));

export default function RefRulesTab({ federation, rules }) {
  const [f, setF] = useState(() => deRegras(rules));
  const [base] = useState(f);
  useAvisoNaoSalvo(JSON.stringify(f) !== JSON.stringify(base));
  // Nível novo ganha o código ao salvar (a partir do nome, sem repetir).
  const usados = new Set(f.levels.map((l) => l.id).filter(Boolean));
  const comCodigo = f.levels.map((l) => {
    if (l.id || !l.label.trim()) return l;
    const id = codigo(l.label, usados);
    usados.add(id);
    return { ...l, id };
  });
  const fees = Object.fromEntries(REFEREE_FUNCTIONS.map((fn) => [fn, f.fee[fn].trim() ? parseBrlCents(f.fee[fn]) : null]));
  const feeRuim = REFEREE_FUNCTIONS.find((fn) => fees[fn] != null && !(Number.isFinite(fees[fn]) && fees[fn] <= REFEREE_LIMITS.FEE_MAX_CENTS));
  const entrada = {
    levels: comCodigo.map(({ id, label }) => ({ id, label })),
    min_level_by_function: f.min,
    fee_default_cents: Object.fromEntries(REFEREE_FUNCTIONS.filter((fn) => fees[fn] != null).map((fn) => [fn, fees[fn]])),
    needs: Object.fromEntries(REFEREE_FUNCTIONS.filter((fn) => f.needs[fn] !== '').map((fn) => [fn, Number(f.needs[fn])])),
    respond_days: Number(f.respond_days),
    crew_visible: f.crew_visible,
    credential_policy: { required: f.cred.required, grace_days: numero(f.cred.grace_days), warn_days: numero(f.cred.warn_days), on_expire: f.cred.on_expire },
    promotion: Object.fromEntries(Object.entries(f.promo).map(([id, p]) => [id, { events: numero(p.events), avg: numero(p.avg), months: numero(p.months) }])),
  };
  const r = validateRefereeRules(entrada);
  const setCred = (k, v) => setF((x) => ({ ...x, cred: { ...x.cred, [k]: v } }));
  const setPromo = (id, k, v) => setF((x) => ({ ...x, promo: { ...x.promo, [id]: { ...(x.promo[id] || {}), [k]: v } } }));
  const m = useFederationMutation(() => refereesAction({ federationId: federation.id, action: 'rules', rules: r.value }));
  const setLevel = (i, label) => setF((x) => ({ ...x, levels: x.levels.map((l, j) => (j === i ? { ...l, label } : l)) }));
  const mover = (i, d) => setF((x) => { const l = [...x.levels]; [l[i], l[i + d]] = [l[i + d], l[i]]; return { ...x, levels: l }; });
  const tirar = (i) => setF((x) => ({ ...x, levels: x.levels.filter((_, j) => j !== i) }));
  const incluir = () => setF((x) => ({ ...x, levels: [...x.levels, { id: '', label: '' }] }));
  const enviar = (e) => {
    e.preventDefault();
    if (feeRuim) { toast.error(t('Diária inválida em {funcao}: use reais com até dois decimais.', { funcao: funcao(feeRuim) })); return; }
    if (!r.ok) { toast.error(Object.values(r.errors)[0]); return; }
    m.mutate(undefined, { onSuccess: () => { setF((x) => ({ ...x, levels: comCodigo.map((l) => ({ ...l, salvo: true })) })); toast.success(t('Regras da arbitragem salvas.')); }, onError: (er) => toast.error(er.message) });
  };
  return (
    <form onSubmit={enviar} noValidate className="space-y-4" aria-label={t('Regras e níveis')} data-dica="federacao-arbitragem-regras">
      <V2Surface variant="compacto" className="space-y-3 p-4">
        <h3 className="font-bold text-ink">{t('Níveis do quadro')}</h3>
        <p className="text-sm text-gray-500">{t('Do mais baixo (em cima) ao mais alto (embaixo). O código de um nível salvo não muda: os cadastros o guardam.')}</p>
        <ul className="space-y-2">
          {f.levels.map((l, i) => (
            <li key={l.id || `novo${i}`} className="flex flex-wrap items-end gap-2">
              <V2Field label={t('Nível {n}', { n: i + 1 })} htmlFor={`ref-nivel-${i}`} className="min-w-0 flex-1" hint={l.id ? t('código: {c}', { c: l.id }) : undefined}>
                <V2Input id={`ref-nivel-${i}`} maxLength={REFEREE_LIMITS.LEVEL_LABEL_MAX} value={l.label} onChange={(e) => setLevel(i, e.target.value)} />
              </V2Field>
              <V2Button type="button" size="icon" variant="ghost" disabled={i === 0} onClick={() => mover(i, -1)} aria-label={t('Subir {nivel}', { nivel: l.label })}><ArrowUp className="h-4 w-4" /></V2Button>
              <V2Button type="button" size="icon" variant="ghost" disabled={i === f.levels.length - 1} onClick={() => mover(i, 1)} aria-label={t('Descer {nivel}', { nivel: l.label })}><ArrowDown className="h-4 w-4" /></V2Button>
              <V2Button type="button" size="icon" variant="ghost" disabled={f.levels.length <= 1} onClick={() => tirar(i)} aria-label={t('Tirar {nivel}', { nivel: l.label })}><Trash2 className="h-4 w-4" /></V2Button>
            </li>
          ))}
        </ul>
        {r.errors.levels && <p className="text-xs font-semibold text-red-600">{r.errors.levels}</p>}
        <V2Button type="button" variant="ghost" size="sm" disabled={f.levels.length >= REFEREE_LIMITS.LEVELS_MAX} onClick={incluir}><Plus className="h-4 w-4" />{t('Incluir nível')}</V2Button>
      </V2Surface>

      <V2Surface variant="compacto" className="space-y-3 p-4">
        <h3 className="font-bold text-ink">{t('Por função')}</h3>
        <p className="text-sm text-gray-500">{t('Quantos um evento precisa (a cobertura da escala), o nível mínimo (abaixo dele, a convocação mostra um alerta) e a diária padrão.')}</p>
        <ul className="space-y-3">
          {REFEREE_FUNCTIONS.map((fn) => (
            <li key={fn} className="grid gap-2 sm:grid-cols-[1.2fr_1fr_1fr_1fr] sm:items-end">
              <p className="text-sm font-semibold text-ink">{funcao(fn)}</p>
              <V2Field label={t('Por evento')} htmlFor={`ref-need-${fn}`}><V2Input id={`ref-need-${fn}`} type="number" min={0} max={REFEREE_LIMITS.NEED_MAX} value={f.needs[fn]} onChange={(e) => setF((x) => ({ ...x, needs: { ...x.needs, [fn]: e.target.value } }))} /></V2Field>
              <V2Field label={t('Nível mínimo')} htmlFor={`ref-min-${fn}`}>
                <V2Select id={`ref-min-${fn}`} value={f.min[fn] || ''} onChange={(e) => setF((x) => ({ ...x, min: { ...x.min, [fn]: e.target.value || undefined } }))}>
                  <option value="">{t('Qualquer')}</option>
                  {f.levels.filter((l) => l.id).map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
                </V2Select>
              </V2Field>
              <V2Field label={t('Diária (R$)')} htmlFor={`ref-fee-${fn}`}><V2Input id={`ref-fee-${fn}`} inputMode="decimal" placeholder={formatBrlCents(0)} value={f.fee[fn]} onChange={(e) => setF((x) => ({ ...x, fee: { ...x.fee, [fn]: e.target.value } }))} /></V2Field>
            </li>
          ))}
        </ul>
      </V2Surface>

      <V2Surface variant="compacto" className="space-y-3 p-4">
        <V2Field label={t('Prazo para responder (dias)')} htmlFor="ref-dias" hint={t('Contado da convocação, nunca depois da véspera do evento.')}>
          <V2Input id="ref-dias" type="number" min={1} max={REFEREE_LIMITS.RESPOND_DAYS_MAX} value={f.respond_days} onChange={(e) => setF((x) => ({ ...x, respond_days: e.target.value }))} />
        </V2Field>
        <V2Toggle id="ref-crew" checked={f.crew_visible} onChange={(v) => setF((x) => ({ ...x, crew_visible: v }))} label={t('O árbitro vê a escala inteira do evento')} hint={t('Nome e função de quem mais foi escalado (nunca valores nem avaliações).')} />
      </V2Surface>

      <V2Surface variant="compacto" className="space-y-3 p-4" data-dica="federacao-arbitragem-credencial">
        <h3 className="font-bold text-ink">{t('Vencimento da credencial')}</h3>
        <p className="text-sm text-gray-500">{t('Vale nas funções de arbitragem (árbitro, árbitro geral, juiz de linha e avaliador). Renovar é passar num curso de reciclagem da federação, que emite credencial nova.')}</p>
        <V2Toggle id="ref-cred-exige" checked={f.cred.required} onChange={(v) => setCred('required', v)} label={t('Exigir credencial de árbitro em dia')} hint={t('Desligado, a credencial só aparece no cadastro: nada é barrado.')} />
        {f.cred.required && (
          <div className="grid gap-3 sm:grid-cols-3">
            <V2Field label={t('Avisar antes (dias)')} htmlFor="ref-cred-aviso" hint={t('O árbitro recebe um aviso, uma vez por validade.')}>
              <V2Input id="ref-cred-aviso" type="number" min={0} max={REFEREE_LIMITS.WARN_DAYS_MAX} value={f.cred.warn_days} onChange={(e) => setCred('warn_days', e.target.value)} />
            </V2Field>
            <V2Field label={t('Carência depois de vencer (dias)')} htmlFor="ref-cred-carencia" hint={t('Na carência, nada é barrado.')}>
              <V2Input id="ref-cred-carencia" type="number" min={0} max={REFEREE_LIMITS.GRACE_DAYS_MAX} value={f.cred.grace_days} onChange={(e) => setCred('grace_days', e.target.value)} />
            </V2Field>
            <V2Field label={t('Vencida, depois da carência')} htmlFor="ref-cred-efeito">
              <V2Select id="ref-cred-efeito" value={f.cred.on_expire} onChange={(e) => setCred('on_expire', e.target.value)}>
                {Object.entries(CREDENTIAL_ON_EXPIRE_LABELS).map(([k, l]) => <option key={k} value={k}>{t(l)}</option>)}
              </V2Select>
            </V2Field>
          </div>
        )}
        {f.cred.required && f.cred.on_expire === 'block_and_release' && <p className="text-xs font-semibold text-amber-700">{t('A varredura diária cancela as escalas futuras em aberto de quem venceu e avisa o árbitro e a equipe.')}</p>}
      </V2Surface>

      {comCodigo.filter((l) => l.id).length > 1 && (
        <V2Surface variant="compacto" className="space-y-3 p-4" data-dica="federacao-arbitragem-progressao">
          <h3 className="font-bold text-ink">{t('Progressão de nível')}</h3>
          <p className="text-sm text-gray-500">{t('O que o árbitro precisa no nível de baixo para pedir o próximo. Em branco, não há requisito e a equipe decide. Quem decide a promoção é sempre a equipe.')}</p>
          <ul className="space-y-3">
            {comCodigo.filter((l) => l.id).slice(1).map((l) => (
              <li key={l.id} className="grid gap-2 sm:grid-cols-[1.2fr_1fr_1fr_1fr] sm:items-end">
                <p className="text-sm font-semibold text-ink">{t('Para chegar a {nivel}', { nivel: l.label })}</p>
                <V2Field label={t('Atuações')} htmlFor={`ref-promo-ev-${l.id}`}><V2Input id={`ref-promo-ev-${l.id}`} type="number" min={0} max={REFEREE_LIMITS.PROMO_EVENTS_MAX} value={f.promo[l.id]?.events || ''} onChange={(e) => setPromo(l.id, 'events', e.target.value)} /></V2Field>
                <V2Field label={t('Média mínima (1 a 5)')} htmlFor={`ref-promo-avg-${l.id}`}><V2Input id={`ref-promo-avg-${l.id}`} inputMode="decimal" value={f.promo[l.id]?.avg || ''} onChange={(e) => setPromo(l.id, 'avg', e.target.value)} /></V2Field>
                <V2Field label={t('Meses no nível')} htmlFor={`ref-promo-m-${l.id}`}><V2Input id={`ref-promo-m-${l.id}`} type="number" min={0} max={REFEREE_LIMITS.PROMO_MONTHS_MAX} value={f.promo[l.id]?.months || ''} onChange={(e) => setPromo(l.id, 'months', e.target.value)} /></V2Field>
              </li>
            ))}
          </ul>
        </V2Surface>
      )}

      <div className="flex justify-end">
        <V2Button type="submit" disabled={m.isPending}><Save className="h-4 w-4" />{t('Salvar as regras')}</V2Button>
      </div>
    </form>
  );
}
