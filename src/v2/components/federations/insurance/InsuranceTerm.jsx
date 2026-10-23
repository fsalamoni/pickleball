/**
 * O TERMO DO SEGURO (módulo `insurance`, `docs/50` §42): a caixa com o texto
 * e o "Li e aceito", usada no pedido de filiação, e o diálogo que pede o
 * aceite antes de renovar (ou em Minha filiação). Quem confere e grava é o
 * servidor — a tela só manda a versão do texto que mostrou.
 */
import React, { useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { termState, termVersion } from '@/modules/federations/domain/insurance';
import { V2Button } from '@/v2/ui/primitives';
import { t } from '@/core/i18n';

/** O texto do termo (rolável) e a caixa de aceite. */
export function InsuranceTermBox({ federation, id, checked, onChange }) {
  const ins = federation?.insurance || {};
  return (
    <div className="space-y-2" data-dica="federacao-termo-seguro">
      <p className="flex items-center gap-2 text-sm font-semibold text-ink"><ShieldCheck className="h-4 w-4" aria-hidden="true" />{t('Termo do seguro esportivo')}{ins.insurer ? ` · ${ins.insurer}` : ''}</p>
      <div className="max-h-48 overflow-y-auto whitespace-pre-line rounded-2xl border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700" tabIndex={0} aria-label={t('Texto do termo do seguro')}>{ins.term_text}</div>
      <label htmlFor={id} className="flex items-start gap-3 text-sm text-gray-700">
        <input id={id} type="checkbox" className="mt-1 h-5 w-5 accent-ink" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <span>{t('Li e aceito o termo do seguro esportivo da federação.')}</span>
      </label>
    </div>
  );
}

/** Pede o aceite num diálogo; `onAccept(version)`. */
export function InsuranceTermDialog({ federation, onCancel, onAccept, loading, confirmLabel }) {
  const [ok, setOk] = useState(false);
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onCancel(); }}>
      <DialogContent className="max-h-[90dvh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('Aceite o termo do seguro')}</DialogTitle>
          <DialogDescription>{t('A {sigla} pede que cada filiado aceite o termo do seguro esportivo. O aceite fica registrado na sua filiação.', { sigla: federation?.acronym || federation?.name || '' })}</DialogDescription>
        </DialogHeader>
        <InsuranceTermBox federation={federation} id="termo-seguro-dialogo" checked={ok} onChange={setOk} />
        <div className="mt-3 flex justify-end gap-2">
          <V2Button type="button" variant="ghost" onClick={onCancel}>{t('Voltar')}</V2Button>
          <V2Button type="button" disabled={!ok || loading} onClick={() => onAccept(termVersion(federation.insurance.term_text))}>{confirmLabel || t('Aceitar')}</V2Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Antes de uma ação que exige o termo (a renovação): `run(fn)` chama
 * `fn(version)` direto quando não há o que aceitar, ou abre o diálogo.
 */
export function useInsuranceTermGate(federation, member, { confirmLabel, loading } = {}) {
  const [pendente, setPendente] = useState(null);
  const st = termState(member, federation);
  const run = (fn) => {
    if (!st.required || st.accepted) fn(undefined);
    else setPendente(() => fn);
  };
  const dialog = pendente ? (
    <InsuranceTermDialog
      federation={federation}
      loading={loading}
      confirmLabel={confirmLabel}
      onCancel={() => setPendente(null)}
      onAccept={(v) => { const fn = pendente; setPendente(null); fn(v); }}
    />
  ) : null;
  return { run, dialog, state: st };
}
