/**
 * MODO LISTA para o passado (Carreira, docs/54 §4.2): linhas de ano ·
 * nome · categoria · medalha, "+ linha", tudo salvo de uma vez (um lote).
 * É o jeito realista de recuperar anos de torneio — amador não tem planilha.
 *
 * Na primeira visita pergunta "Quantos torneios você já jogou fora do
 * PickleRush?" (guardado no navegador, por uid) e daí mostra "7 de ~20".
 */
import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Plus, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { readViewPreference, writeViewPreference } from '@/core/lib/viewPreference';
import { CAREER_FORMAT, CAREER_FORMAT_LABEL, CAREER_GENDER_LABEL, emptyListRow, listRowsToEvents, registeredProgress } from '@/modules/career/domain/careerEvent.js';
import { CAREER_ESTIMATE_PREF } from '@/modules/career/domain/draftQueue.js';
import { useCareerEvents, useSaveCareerBatch } from '@/modules/career/hooks/useCareer';
import { V2Button, V2Field, V2Input, V2Select } from '@/v2/ui/primitives';
import { MEDAL_CHOICES } from './careerUi';
import { t } from '@/core/i18n';

/** A estimativa guardada: número, `skip` ("Agora não") ou `null` (ainda não perguntou). */
export function useCareerEstimate() {
  const { user } = useAuth();
  const uid = user?.uid || null;
  const [valor, setValor] = useState(() => readViewPreference(uid, CAREER_ESTIMATE_PREF));
  useEffect(() => { setValor(readViewPreference(uid, CAREER_ESTIMATE_PREF)); }, [uid]);
  const gravar = (v) => { writeViewPreference(uid, CAREER_ESTIMATE_PREF, v == null ? null : String(v)); setValor(v == null ? null : String(v)); };
  return { valor, gravar };
}

const linhasIniciais = () => [emptyListRow(), emptyListRow()];

/**
 * @param {{ open: boolean, onOpenChange: Function }} props
 */
export default function CareerListMode({ open, onOpenChange }) {
  const { user } = useAuth();
  // Consulta própria: aberto pela aba Conquistas, a linha do tempo não consulta.
  const eventsQ = useCareerEvents({ enabled: open });
  const events = eventsQ.isSuccess ? eventsQ.data : undefined;
  const estimativa = useCareerEstimate();
  const [quantos, setQuantos] = useState('');
  const [linhas, setLinhas] = useState(linhasIniciais);
  const [erros, setErros] = useState([]);
  const lote = useSaveCareerBatch();

  useEffect(() => { if (open) { setLinhas(linhasIniciais()); setErros([]); setQuantos(''); } }, [open]);

  const perguntar = estimativa.valor === null;
  const progresso = registeredProgress(events, estimativa.valor);
  const setLinha = (i, k, v) => setLinhas((ls) => ls.map((l, j) => (j === i ? { ...l, [k]: v } : l)));

  async function salvar() {
    const { events: novos, errors } = listRowsToEvents(linhas, { uid: user?.uid });
    setErros(errors);
    if (errors.length || !novos.length) return;
    try {
      await lote.mutateAsync(novos);
      toast.success(t('{n} torneios registrados.', { n: novos.length }));
      onOpenChange(false);
    } catch (err) {
      setErros([{ row: -1, error: err?.code === 'permission-denied' ? t('O registro de torneios está desligado agora.') : t('Não foi possível salvar. Confira a conexão e tente de novo — as linhas continuam aqui.') }]);
    }
  }

  const erroDa = (i) => erros.find((e) => e.row === i)?.error;
  const geral = erros.find((e) => e.row === -1)?.error;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl" sheet>
        <DialogHeader>
          <DialogTitle>{t('Registrar vários de uma vez')}</DialogTitle>
          <DialogDescription>{t('Uma linha por torneio: o ano, o nome, a categoria e a medalha. O resto você completa depois, se quiser.')}</DialogDescription>
        </DialogHeader>

        {perguntar ? (
          <div className="space-y-3 rounded-2xl border border-gray-100 bg-paper p-4">
            <V2Field label={t('Quantos torneios você já jogou fora do PickleRush?')} htmlFor="carreira-quantos" hint={t('Um chute basta. É só para você ver quanto falta registrar.')}>
              <V2Input id="carreira-quantos" type="number" min={1} max={999} value={quantos} onChange={(e) => setQuantos(e.target.value)} className="max-w-[10rem]" />
            </V2Field>
            <div className="flex flex-wrap gap-2">
              <V2Button type="button" size="sm" variant="primary" disabled={!(Number(quantos) > 0)} onClick={() => estimativa.gravar(Math.round(Number(quantos)))}>{t('Continuar')}</V2Button>
              <V2Button type="button" size="sm" variant="ghost" onClick={() => estimativa.gravar('skip')}>{t('Agora não')}</V2Button>
            </div>
          </div>
        ) : progresso && (
          <p className="text-sm font-semibold text-ink">
            {t('{feitos} de ~{total} registrados', { feitos: progresso.done, total: progresso.estimate })}
            <button type="button" className="ml-2 text-xs font-normal text-gray-500 underline-offset-2 hover:underline" onClick={() => estimativa.gravar(null)}>{t('mudar')}</button>
          </p>
        )}

        <ol className="space-y-3" data-dica="carreira-lista-linhas">
          {linhas.map((l, i) => (
            <li key={i} className="grid grid-cols-2 gap-2 rounded-2xl border border-gray-100 p-3 sm:grid-cols-[5.5rem_1fr_8rem_8rem_5rem_auto] sm:items-end">
              <V2Field label={t('Ano')} htmlFor={`lista-ano-${i}`}>
                <V2Input id={`lista-ano-${i}`} type="number" min={1990} value={l.year} onChange={(e) => setLinha(i, 'year', e.target.value)} />
              </V2Field>
              <V2Field label={t('Torneio')} htmlFor={`lista-nome-${i}`} className="col-span-2 sm:col-span-1">
                <V2Input id={`lista-nome-${i}`} value={l.name} maxLength={120} onChange={(e) => setLinha(i, 'name', e.target.value)} />
              </V2Field>
              <V2Field label={t('Formato')} htmlFor={`lista-formato-${i}`}>
                <V2Select id={`lista-formato-${i}`} value={l.format} onChange={(e) => setLinha(i, 'format', e.target.value)}>
                  {Object.values(CAREER_FORMAT).map((v) => <option key={v} value={v}>{t(CAREER_FORMAT_LABEL[v])}</option>)}
                </V2Select>
              </V2Field>
              <V2Field label={t('Categoria')} htmlFor={`lista-genero-${i}`}>
                <V2Select id={`lista-genero-${i}`} value={l.gender || ''} onChange={(e) => setLinha(i, 'gender', e.target.value || null)}>
                  <option value="">—</option>
                  {['male', 'female', 'mixed', 'open'].map((v) => <option key={v} value={v}>{t(CAREER_GENDER_LABEL[v])}</option>)}
                </V2Select>
              </V2Field>
              <V2Field label={t('Medalha')} htmlFor={`lista-medalha-${i}`}>
                <V2Select id={`lista-medalha-${i}`} value={l.placement || ''} onChange={(e) => setLinha(i, 'placement', e.target.value || null)}>
                  {MEDAL_CHOICES.map((m) => <option key={String(m.value)} value={m.value || ''}>{m.value ? `${m.label} ${t(m.aria)}` : '—'}</option>)}
                </V2Select>
              </V2Field>
              <V2Button type="button" size="sm" variant="ghost" aria-label={t('Tirar esta linha')} disabled={linhas.length === 1} onClick={() => setLinhas((ls) => ls.filter((_, j) => j !== i))}>
                <Trash2 className="h-4 w-4" />
              </V2Button>
              {erroDa(i) && <p role="alert" className="col-span-2 text-xs font-medium text-red-600 sm:col-span-6">{erroDa(i)}</p>}
            </li>
          ))}
        </ol>

        {geral && <p role="alert" className="text-sm font-medium text-red-600">{geral}</p>}

        <div className="flex flex-wrap justify-between gap-2">
          <V2Button type="button" variant="secondary" disabled={linhas.length >= 30} onClick={() => setLinhas((ls) => [...ls, emptyListRow(Number(ls[ls.length - 1]?.year) || undefined)])}>
            <Plus className="h-4 w-4" /> {t('Linha')}
          </V2Button>
          <V2Button type="button" variant="primary" onClick={salvar} disabled={lote.isPending || !linhas.some((l) => l.name.trim())}>
            {lote.isPending ? t('Salvando…') : t('Salvar todos')}
          </V2Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
