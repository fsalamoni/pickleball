/**
 * ANTIDOPAGEM (Central → Jogo limpo → Antidopagem, só o admin): o texto que
 * a página mostra (em branco = o padrão), o contato, os links da federação
 * (os da ABCD/WADA sempre aparecem) e se as cláusulas-padrão saem nos
 * torneios chancelados. Grava `federations.antidoping`.
 */
import React, { useState } from 'react';
import { toast } from 'sonner';
import { Plus, Trash2 } from 'lucide-react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { ANTIDOPING_DEFAULT_TEXT, ANTIDOPING_LINKS_MAX, antidopingView, validateAntidoping } from '@/modules/federations/domain/integrity';
import { updateFederationAntidoping } from '@/modules/federations/services/integrityService';
import { useFederationMutation } from '@/modules/federations/hooks/useFederations';
import { V2Button, V2Field, V2Input, V2Surface, V2Textarea, V2Toggle } from '@/v2/ui/primitives';
import { t } from '@/core/i18n';
import { AntidopingClauses, AntidopingLinks } from './IntegrityPublic';

export default function AntidopingSettings({ federation }) {
  const { user } = useAuth();
  const a = federation.antidoping || {};
  const [f, setF] = useState(() => ({ note: a.note || '', contact: a.contact || '', show_clauses: a.show_clauses !== false, links: Array.isArray(a.links) ? a.links : [] }));
  const m = useFederationMutation((input) => updateFederationAntidoping(federation.id, input, { uid: user?.uid }));
  const r = validateAntidoping(f);
  const setLink = (i, k) => (e) => setF((x) => ({ ...x, links: x.links.map((l, j) => (j === i ? { ...l, [k]: e.target.value } : l)) }));
  const previa = antidopingView({ antidoping: r.value });
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="space-y-3">
        <V2Field label={t('Texto da página')} htmlFor="ad-texto" hint={t('Em branco, vale o texto-padrão sobre o #JogoLimpo e a ABCD.')}>
          <V2Textarea id="ad-texto" rows={6} maxLength={2000} placeholder={t(ANTIDOPING_DEFAULT_TEXT)} value={f.note} onChange={(e) => setF((x) => ({ ...x, note: e.target.value }))} />
        </V2Field>
        <V2Field label={t('Contato na federação (opcional)')} htmlFor="ad-contato" hint={t('Quem responde dúvidas sobre medicação e autorização de uso terapêutico.')}>
          <V2Input id="ad-contato" maxLength={160} value={f.contact} onChange={(e) => setF((x) => ({ ...x, contact: e.target.value }))} />
        </V2Field>
        <V2Toggle id="ad-clausulas" checked={f.show_clauses} onChange={(v) => setF((x) => ({ ...x, show_clauses: v }))} label={t('Cláusulas-padrão nos torneios chancelados')} hint={t('O regulamento do torneio mostra as cláusulas de antidopagem e os links oficiais.')} />
        <div className="space-y-2">
          <p className="text-sm font-semibold text-ink">{t('Links da federação (opcional)')}</p>
          {f.links.map((l, i) => (
            <div key={i} className="grid gap-2 sm:grid-cols-[1fr_1.4fr_auto]">
              <V2Input aria-label={t('Nome do link')} placeholder={t('Nome')} maxLength={80} value={l.label} onChange={setLink(i, 'label')} />
              <V2Input aria-label={t('Endereço do link')} placeholder="https://" maxLength={300} value={l.url} onChange={setLink(i, 'url')} />
              <V2Button type="button" variant="ghost" aria-label={t('Tirar o link')} onClick={() => setF((x) => ({ ...x, links: x.links.filter((_, j) => j !== i) }))}><Trash2 className="h-4 w-4" /></V2Button>
            </div>
          ))}
          {r.errors.links && <p className="text-xs text-red-600">{r.errors.links}</p>}
          {f.links.length < ANTIDOPING_LINKS_MAX && <V2Button type="button" size="sm" variant="secondary" onClick={() => setF((x) => ({ ...x, links: [...x.links, { label: '', url: '' }] }))}><Plus className="h-4 w-4" />{t('Acrescentar link')}</V2Button>}
        </div>
        <div className="flex justify-end">
          <V2Button type="button" disabled={!r.ok || m.isPending} onClick={() => m.mutate(f, { onSuccess: () => toast.success(t('Antidopagem salva.')), onError: (e) => toast.error(e.message) })}>{t('Salvar')}</V2Button>
        </div>
      </div>
      <V2Surface variant="compacto" className="space-y-3 p-4">
        <p className="text-xs font-bold uppercase tracking-wider text-gray-500">{t('Como aparece na página')}</p>
        <p className="whitespace-pre-line text-sm text-gray-700">{previa.text}</p>
        {previa.contact && <p className="text-sm text-gray-700"><strong>{t('Fale com a federação')}:</strong> {previa.contact}</p>}
        <AntidopingLinks view={previa} />
        <AntidopingClauses view={previa} />
      </V2Surface>
    </div>
  );
}
