/**
 * MODO LISTA para o passado (Carreira, docs/54 §4.2): linhas de ano ·
 * nome · categoria · medalha, "+ linha", tudo salvo de uma vez (um lote).
 * É o jeito realista de recuperar anos de torneio — amador não tem planilha.
 *
 * Na primeira visita pergunta "Quantos torneios você já jogou fora do
 * PickleRush?" (guardado no navegador, por uid) e daí mostra "7 de ~20".
 *
 * Cada linha nasce com o id definitivo do torneio (salvar de novo regrava o
 * MESMO documento) e as linhas ficam guardadas no navegador, por uid, até o
 * servidor confirmar: fechar sem querer ou ficar sem sinal não perde a digitação.
 */
import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Plus, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { readViewPreference, writeViewPreference } from '@/core/lib/viewPreference';
import {
  CAREER_FORMAT, CAREER_FORMAT_LABEL, CAREER_GENDER_LABEL, emptyListRow, listRowsToEvents, newCareerEventId, registeredProgress,
} from '@/modules/career/domain/careerEvent.js';
import { todayLocal } from '@/modules/training/domain/dates.js';
import { useCareerEvents, useSaveCareerBatch } from '@/modules/career/hooks/useCareer';
import { V2Button, V2Field, V2Input, V2Select } from '@/v2/ui/primitives';
import { MEDAL_CHOICES, useCareerEstimate } from './careerUi';
import { t, tn } from '@/core/i18n';

/** As linhas digitadas e ainda não confirmadas — por pessoa, no navegador (zero banco). */
export const CAREER_LIST_PREF = 'carreira:lista';
const MAX_LINHAS = 30;

const novaLinha = (uid, ano) => ({ ...emptyListRow(ano), id: newCareerEventId(uid) });
const temConteudo = (l) => Boolean(String(l?.name || '').trim() || l?.gender || l?.placement);

/** As linhas guardadas (texto estragado ou de outro formato ⇒ nenhuma). */
function lerGuardadas(uid) {
  try {
    const v = JSON.parse(readViewPreference(uid, CAREER_LIST_PREF) || '[]');
    return Array.isArray(v) ? v.filter((l) => l && typeof l.id === 'string' && typeof l.name === 'string').slice(0, MAX_LINHAS) : [];
  } catch {
    return [];
  }
}

function linhasDeAbertura(uid) {
  const guardadas = lerGuardadas(uid);
  return guardadas.length ? guardadas : [novaLinha(uid), novaLinha(uid)];
}

/**
 * @param {{ open: boolean, onOpenChange: Function }} props
 */
export default function CareerListMode({ open, onOpenChange }) {
  const { user } = useAuth();
  const uid = user?.uid || null;
  // Consulta própria: aberto pela aba Conquistas, a linha do tempo não consulta.
  const eventsQ = useCareerEvents({ enabled: open });
  const events = eventsQ.isSuccess ? eventsQ.data : undefined;
  const estimativa = useCareerEstimate();
  const [quantos, setQuantos] = useState('');
  const [linhas, setLinhas] = useState(() => linhasDeAbertura(uid));
  const [erros, setErros] = useState([]);
  const lote = useSaveCareerBatch();

  useEffect(() => { if (open) { setLinhas(linhasDeAbertura(uid)); setErros([]); setQuantos(''); } }, [open, uid]);
  // Guarda a cada mudança; sem nada digitado, apaga.
  useEffect(() => {
    if (!open) return;
    writeViewPreference(uid, CAREER_LIST_PREF, linhas.some(temConteudo) ? JSON.stringify(linhas) : null);
  }, [open, uid, linhas]);
  // Envio que só chegou depois do prazo: a linha já é torneio — sai daqui, para o
  // novo "Salvar" não regravar por cima do que a pessoa completou na ficha.
  useEffect(() => {
    if (!events?.length) return;
    const gravados = new Set(events.map((e) => e.id));
    setLinhas((ls) => {
      if (!ls.some((l) => gravados.has(l.id))) return ls;
      const resto = ls.filter((l) => !gravados.has(l.id));
      return resto.length ? resto : [novaLinha(uid)];
    });
  }, [events, uid]);

  const perguntar = estimativa.valor === null;
  const progresso = registeredProgress(events, estimativa.valor);
  const anoAtual = Number(todayLocal().slice(0, 4));
  const setLinha = (i, k, v) => setLinhas((ls) => ls.map((l, j) => (j === i ? { ...l, [k]: v } : l)));
  const sujo = linhas.some(temConteudo);

  async function salvar() {
    const { events: novos, errors } = listRowsToEvents(linhas, { uid });
    setErros(errors);
    if (errors.length || !novos.length) return;
    try {
      await lote.mutateAsync(novos);
      writeViewPreference(uid, CAREER_LIST_PREF, null);
      toast.success(tn(novos.length, '{n} torneio registrado.', '{n} torneios registrados.'));
      onOpenChange(false);
    } catch (err) {
      // A mutação falha no prazo e sem conexão com a frase certa: mostrar a dela.
      const motivo = err?.code === 'permission-denied'
        ? t('O registro de torneios está desligado agora.')
        : (err?.message || t('Não foi possível salvar. Confira a conexão e tente de novo.'));
      setErros([{ row: -1, error: `${motivo} ${t('As linhas continuam guardadas aqui.')}` }]);
    }
  }

  const erroDa = (i) => erros.find((e) => e.row === i)?.error;
  const geral = erros.find((e) => e.row === -1)?.error;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Com linhas digitadas, o toque fora não fecha (as linhas ficam guardadas de todo jeito). */}
      <DialogContent className="max-w-3xl" sheet onInteractOutside={(e) => { if (sujo) e.preventDefault(); }}>
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
          <p className="flex flex-wrap items-center gap-x-2 text-sm font-semibold text-ink">
            {t('{feitos} de ~{total} registrados', { feitos: progresso.done, total: progresso.estimate })}
            <button type="button" className="inline-flex min-h-11 items-center px-2 text-xs font-normal text-gray-500 underline underline-offset-2 hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-ink" onClick={() => estimativa.gravar(null)}>{t('mudar')}</button>
          </p>
        )}

        <ol className="space-y-3" data-dica="carreira-lista-linhas">
          {linhas.map((l, i) => {
            const erro = erroDa(i);
            const ligado = erro ? { 'aria-invalid': true, 'aria-describedby': `lista-erro-${i}` } : {};
            return (
              // `md:` e não `sm:`: entre 640 e 767 px o diálogo é estreito e o nome ficava com 5 letras.
              <li key={l.id} className="grid grid-cols-2 gap-2 rounded-2xl border border-gray-100 p-3 md:grid-cols-[5.5rem_minmax(10rem,1fr)_8rem_8rem_5rem_auto] md:items-end">
                <V2Field label={t('Ano')} htmlFor={`lista-ano-${i}`}>
                  <V2Input id={`lista-ano-${i}`} type="number" min={1990} max={anoAtual} value={l.year} onChange={(e) => setLinha(i, 'year', e.target.value)} {...ligado} />
                </V2Field>
                <V2Field label={t('Torneio')} htmlFor={`lista-nome-${i}`} className="col-span-2 md:col-span-1">
                  <V2Input id={`lista-nome-${i}`} value={l.name} maxLength={120} onChange={(e) => setLinha(i, 'name', e.target.value)} {...ligado} />
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
                <V2Button
                  type="button" size="icon" variant="ghost" className="self-end justify-self-end"
                  aria-label={t('Tirar a linha {n}', { n: i + 1 })} disabled={linhas.length === 1}
                  // Os erros são por posição: tirar uma linha os deslocaria para a errada.
                  onClick={() => { setErros([]); setLinhas((ls) => ls.filter((x) => x.id !== l.id)); }}
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </V2Button>
                {erro && <p id={`lista-erro-${i}`} role="alert" className="col-span-2 text-xs font-medium text-red-600 md:col-span-6">{t('Linha {n}:', { n: i + 1 })} {erro}</p>}
              </li>
            );
          })}
        </ol>

        {geral && <p role="alert" className="text-sm font-medium text-red-600">{geral}</p>}

        <div className="flex flex-wrap justify-between gap-2">
          <V2Button type="button" variant="secondary" disabled={linhas.length >= MAX_LINHAS} onClick={() => setLinhas((ls) => [...ls, novaLinha(uid, Number(ls[ls.length - 1]?.year) || undefined)])}>
            <Plus className="h-4 w-4" /> {t('Linha')}
          </V2Button>
          <V2Button type="button" variant="primary" onClick={salvar} disabled={lote.isPending || !sujo}>
            {lote.isPending ? t('Salvando…') : t('Salvar todos')}
          </V2Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
