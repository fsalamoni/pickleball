/**
 * PICKLEBALL ADAPTADO na modalidade do torneio (módulo `adapted`, `docs/50`
 * §41). Num torneio de federação com o módulo ligado, quem organiza marca a
 * modalidade como adaptada (`adapted_class` + `adapted_class_label`) e confere
 * a classificação dos inscritos pelo servidor — só o resultado, nunca o laudo.
 */
import React, { useState } from 'react';
import { Accessibility } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { fedModuleOn } from '@/modules/federations/domain/federation';
import { ADAPTED_CHECK, ADAPTED_CHECK_LABELS, adaptedClassesOf } from '@/modules/federations/domain/adapted';
import { useAdaptedCheck } from '@/modules/federations/hooks/useAdapted';
import { useFederation } from '@/modules/federations/hooks/useFederations';
import { V2Badge, V2Button, V2ErrorState, V2Skeleton } from '@/v2/ui/primitives';
import { t } from '@/core/i18n';

/** As categorias adaptadas que o torneio pode usar (vazio fora de federação ou com o módulo desligado). */
export function useAdaptedOptions(tournament) {
  const fedId = tournament?.federation_id || '';
  const q = useFederation(fedId, { enabled: !!fedId });
  return q.data && fedModuleOn(q.data, 'adapted') ? adaptedClassesOf(q.data) : [];
}

/** O seletor no formulário da modalidade. A categoria já gravada aparece mesmo sem a lista carregada. */
export function AdaptedClassField({ options, value, label, onChange }) {
  if (!options.length && !value) return null;
  const opcoes = value && !options.some((c) => c.id === value) ? [...options, { id: value, label: label || value }] : options;
  return (
    <div className="space-y-2" data-dica="federacao-modalidade-adaptada">
      <label htmlFor="mod-adaptada" className="text-2xs font-bold uppercase tracking-widest text-gray-500">{t('Pickleball adaptado')}</label>
      <select id="mod-adaptada" value={value || ''} onChange={(e) => onChange(e.target.value, opcoes.find((c) => c.id === e.target.value)?.label || '')} className="w-full rounded-2xl border border-gray-200 bg-paper px-4 py-3 text-sm text-ink outline-none focus-visible:ring-4 focus-visible:ring-acid/30">
        <option value="">{t('Não é adaptada')}</option>
        {opcoes.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
      </select>
      <p className="text-xs text-gray-500">{t('Modalidade adaptada: quem organiza confere aqui a classificação de cada inscrito pela federação.')}</p>
    </div>
  );
}

const TOM = { ok: 'green', other_class: 'amber', expired: 'red', pending: 'blue', missing: 'red', no_account: 'gray' };

function CheckDialog({ tournament, modality, onClose }) {
  const q = useAdaptedCheck(tournament.id, modality.id);
  const pendencias = (q.data?.rows || []).flatMap((r) => r.players).filter((p) => p.check !== ADAPTED_CHECK.OK).length;
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-h-[90dvh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('Classificação dos inscritos')}</DialogTitle>
          <DialogDescription>{t('{modalidade} · categoria {classe}. A situação vem da federação; o laudo de cada atleta é privado.', { modalidade: modality.name, classe: q.data?.class_label || modality.adapted_class_label || modality.adapted_class })}</DialogDescription>
        </DialogHeader>
        {q.isError ? <V2ErrorState inline title={t('Não deu para conferir agora')} description={q.error?.message} onRetry={q.refetch} />
          : q.isLoading ? <V2Skeleton lines={4} />
            : !q.data.rows.length ? <p className="text-sm text-gray-600">{t('Nenhuma inscrição ativa nesta modalidade.')}</p>
              : (
                <>
                  <p className="text-sm font-semibold text-ink">{pendencias ? t('{n} atleta(s) sem a classificação desta categoria.', { n: pendencias }) : t('Todos os inscritos estão classificados nesta categoria.')}</p>
                  <ul className="divide-y divide-gray-100" aria-label={t('Inscrições')}>
                    {q.data.rows.map((r) => (
                      <li key={r.registration_id} className="space-y-1 py-2">
                        {r.players.map((p, i) => (
                          <div key={i} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                            <span className="text-ink">{p.name}</span>
                            <V2Badge tone={TOM[p.check] || 'gray'}>{t(ADAPTED_CHECK_LABELS[p.check] || p.check)}</V2Badge>
                          </div>
                        ))}
                      </li>
                    ))}
                  </ul>
                  <p className="text-xs text-gray-500">{t('Quem não está classificado pede na aba "Minha filiação" da página da federação. Retirar ou manter a inscrição é decisão de quem organiza, pelo regulamento do torneio.')}</p>
                </>
              )}
      </DialogContent>
    </Dialog>
  );
}

/** O selo "Adaptada" no cartão da modalidade e, para quem organiza, a conferência. */
export function AdaptedModalityBadge({ tournament, modality, canCheck }) {
  const [aberto, setAberto] = useState(false);
  if (!modality.adapted_class) return null;
  return (
    <>
      <V2Badge tone="blue"><Accessibility className="mr-1 inline h-3 w-3" aria-hidden="true" />{t('Adaptada: {c}', { c: modality.adapted_class_label || modality.adapted_class })}</V2Badge>
      {canCheck && <V2Button type="button" variant="ghost" size="sm" onClick={() => setAberto(true)}>{t('Conferir classificação')}</V2Button>}
      {aberto && <CheckDialog tournament={tournament} modality={modality} onClose={() => setAberto(false)} />}
    </>
  );
}
