/**
 * "Registrar torneio" em 30 segundos (Carreira, docs/54 §4): uma tela,
 * nome + data, dois grupos de botões (Simples / Duplas / Equipe e Masc / Fem
 * / Mista) e a medalha opcional. Data passada vira jogado; futura, planejado.
 * "+ outra categoria" só aparece depois de salvar a primeira.
 *
 * "Repetir o torneio do ano passado" preenche nome, organizador, cidade e
 * federação. Sem sinal, o registro fica guardado no aparelho e é enviado
 * quando a conexão volta (`useCareerSaveWithDraft`).
 */
import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Check, Plus, Repeat } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { todayLocal } from '@/modules/training/domain/dates.js';
import { CAREER_FORMAT, CAREER_STATUS, entryLabel, placementText, repeatEvent, repeatableEvents } from '@/modules/career/domain/careerEvent.js';
import { V2Button, V2Field, V2Input } from '@/v2/ui/primitives';
import { ChoiceGroup, FORMAT_CHOICES, GENDER_CHOICES, MEDAL_CHOICES } from './careerUi';
import { t } from '@/core/i18n';

const categoriaVazia = () => ({ format: CAREER_FORMAT.DOUBLES, gender: null, placement: null });

/**
 * @param {{ open: boolean, onOpenChange: Function, save: Function, events?: object[], onDetail?: (ev: object) => void }} props
 *   `save` = o `save` de `useCareerSaveWithDraft`.
 */
export default function CareerQuickRegister({ open, onOpenChange, save, events, onDetail, initial = null }) {
  const [extra, setExtra] = useState({});
  const [name, setName] = useState('');
  const [date, setDate] = useState(todayLocal());
  const [cat, setCat] = useState(categoriaVazia);
  const [salvo, setSalvo] = useState(null);
  const [outra, setOutra] = useState(false);
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState('');
  const [falta, setFalta] = useState({ nome: false, data: false });
  const anoMax = Number(todayLocal().slice(0, 4)) + 5;

  /** Preenche com o rascunho de `repeatEvent` (nome, organizador, cidade, federação). */
  function preencher(r) {
    const { name: nome, start_date: data, ...resto } = r;
    setExtra(resto);
    setName(nome);
    if (data) setDate(data);
  }

  useEffect(() => {
    if (!open) return;
    setExtra({}); setName(''); setDate(todayLocal()); setCat(categoriaVazia()); setSalvo(null); setOutra(false); setErro(''); setFalta({ nome: false, data: false });
    if (initial) preencher(initial);
  }, [open, initial]);

  const repetiveis = useMemo(() => repeatableEvents(events).slice(0, 3), [events]);
  const repetir = (ev) => preencher(repeatEvent(ev));

  async function salvar(e) {
    e?.preventDefault();
    if (busy) return;
    // O campo que falta é dito NELE (botão desabilitado não explica nada).
    const semNome = !salvo && !name.trim();
    const semData = !salvo && !date;
    setFalta({ nome: semNome, data: semData });
    if (semNome || semData) return;
    setErro('');
    setBusy(true);
    try {
      const entries = salvo ? [...salvo.entries, cat] : [cat];
      const input = salvo ? { ...salvo, entries } : { ...extra, name, start_date: date, entries };
      const { saved, event } = await save(input);
      setSalvo({ ...input, ...event, entries: event.entries || entries });
      setOutra(false);
      setCat(categoriaVazia());
      if (saved) toast.success(t('Torneio registrado.'));
      else toast.message(t('Guardado neste aparelho. Enviamos quando a conexão voltar.'));
    } catch (err) {
      setErro(err?.code === 'permission-denied' ? t('O registro de torneios está desligado agora.') : (err?.message || t('Não foi possível salvar. Tente de novo.')));
    } finally {
      setBusy(false);
    }
  }

  const formulario = !salvo || outra;
  const planejado = salvo && salvo.status === CAREER_STATUS.PLANNED;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" sheet>
        <DialogHeader>
          <DialogTitle>{t('Registrar torneio')}</DialogTitle>
          <DialogDescription>{t('Um torneio de fora do PickleRush. O resto você completa depois, quando quiser.')}</DialogDescription>
        </DialogHeader>

        {!salvo && repetiveis.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-gray-500">{t('Repetir o torneio do ano passado')}</p>
            <div className="flex flex-wrap gap-2">
              {repetiveis.map((ev) => (
                <V2Button key={ev.id} type="button" size="sm" variant="secondary" className="max-w-full" onClick={() => repetir(ev)}>
                  <Repeat className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /> <span className="truncate">{ev.name}</span>
                </V2Button>
              ))}
            </div>
          </div>
        )}

        {salvo && (
          <div className="rounded-2xl border border-gray-100 bg-paper p-4">
            <p className="flex items-center gap-2 font-semibold text-ink"><Check className="h-4 w-4 text-green-600" aria-hidden="true" /> {salvo.name}</p>
            <ul className="mt-2 space-y-1 text-sm text-gray-600">
              {salvo.entries.map((e, i) => (
                <li key={`${e.format}-${i}`}>{[entryLabel(e), placementText(e)].filter(Boolean).join(' — ')}</li>
              ))}
            </ul>
            {planejado && <p className="mt-2 text-xs text-gray-500">{t('Data futura: entrou como planejado.')}</p>}
          </div>
        )}

        {/* Formulário de verdade: o Enter e o "Ir" do teclado do celular salvam. */}
        <form onSubmit={salvar} noValidate className="grid gap-4">
          {formulario && (
            <div className="space-y-4">
              {!salvo && (
                <>
                  <V2Field label={t('Nome do torneio')} htmlFor="carreira-nome" required>
                    <V2Input
                      id="carreira-nome" value={name} maxLength={120} placeholder={t('Ex.: Open de Floripa')} autoComplete="off"
                      onChange={(e) => { setName(e.target.value); setFalta((f) => ({ ...f, nome: false })); }}
                      aria-invalid={falta.nome || undefined} aria-describedby={falta.nome ? 'carreira-nome-erro' : undefined}
                    />
                    {falta.nome && <p id="carreira-nome-erro" role="alert" className="text-xs font-medium text-red-600">{t('Dê um nome ao torneio.')}</p>}
                  </V2Field>
                  <V2Field label={t('Data')} htmlFor="carreira-data" required>
                    <V2Input
                      id="carreira-data" type="date" value={date} min="1990-01-01" max={`${anoMax}-12-31`}
                      onChange={(e) => { setDate(e.target.value); setFalta((f) => ({ ...f, data: false })); }}
                      aria-invalid={falta.data || undefined} aria-describedby={falta.data ? 'carreira-data-erro' : undefined}
                    />
                    {falta.data && <p id="carreira-data-erro" role="alert" className="text-xs font-medium text-red-600">{t('Escolha a data.')}</p>}
                  </V2Field>
                </>
              )}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-gray-500">{t('Formato')}</p>
                <ChoiceGroup dica="carreira-registrar-formato" label={t('Formato')} options={FORMAT_CHOICES} value={cat.format} onChange={(v) => setCat((c) => ({ ...c, format: v || CAREER_FORMAT.DOUBLES }))} />
              </div>
              <div className="space-y-2">
                <p className="text-xs font-semibold text-gray-500">{t('Categoria (opcional)')}</p>
                <ChoiceGroup label={t('Categoria')} options={GENDER_CHOICES} value={cat.gender} onChange={(v) => setCat((c) => ({ ...c, gender: v }))} allowNone />
              </div>
              <div className="space-y-2">
                <p className="text-xs font-semibold text-gray-500">{t('Medalha (opcional)')}</p>
                <ChoiceGroup label={t('Medalha')} options={MEDAL_CHOICES} value={cat.placement} onChange={(v) => setCat((c) => ({ ...c, placement: v }))} />
              </div>
            </div>
          )}

          {erro && <p role="alert" className="text-sm font-medium text-red-600">{erro}</p>}

          <div className="flex flex-wrap justify-end gap-2">
            {formulario ? (
              <>
                {outra && <V2Button type="button" variant="ghost" onClick={() => setOutra(false)}>{t('Cancelar')}</V2Button>}
                <V2Button type="submit" variant="primary" disabled={busy}>
                  {busy ? t('Salvando…') : t('Salvar')}
                </V2Button>
              </>
            ) : (
              <>
                {salvo.entries.length < 6 && (
                  <V2Button type="button" variant="secondary" onClick={() => setOutra(true)}><Plus className="h-4 w-4" /> {t('Outra categoria')}</V2Button>
                )}
                {onDetail && salvo.id && <V2Button type="button" variant="secondary" onClick={() => onDetail(salvo)}>{t('Completar a ficha')}</V2Button>}
                {/* O formulário (e o botão que tinha o foco) saiu da tela: o foco vai para a saída. */}
                <V2Button type="button" variant="primary" autoFocus onClick={() => onOpenChange(false)}>{t('Pronto')}</V2Button>
              </>
            )}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
