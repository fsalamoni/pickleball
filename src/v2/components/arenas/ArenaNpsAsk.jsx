/**
 * ArenaNpsAsk — "como foi?", perguntado no momento em que dá para responder.
 *
 * Módulo: `marketing_nps`.
 *
 * ## Por que este componente não é uma tela
 *
 * Ninguém abre uma página para avaliar uma arena. A pergunta tem que aparecer
 * onde a pessoa já está, logo depois de jogar, e sumir sozinha depois. Por
 * isso ela mora na página da arena e obedece a três condições — todas do
 * domínio (`shouldAskNps`):
 *
 * - **teve visita concluída** — perguntar a quem nunca veio não faz sentido;
 * - **a visita foi recente** (30 dias) — depois disso ninguém lembra;
 * - **não respondeu nos últimos 90 dias** — pedir nota toda semana é a forma
 *   mais rápida de a pessoa parar de responder para sempre.
 *
 * ## O que ela evita
 *
 * O cartão só aparece quando há algo a perguntar: sem visita, sem módulo, ou
 * já respondido, ele **não renderiza nada** — nada de caixa cinza dizendo "você
 * ainda não pode avaliar". Enquanto os dados carregam também não aparece: um
 * cartão que pisca na tela é pior do que um que demora meio segundo.
 *
 * A nota vai embora no clique (um número, um toque), e o comentário é
 * OPCIONAL e vem DEPOIS — pedir texto antes da nota derruba a taxa de resposta
 * e é o motivo de a maioria dos NPS não ter resposta nenhuma.
 */

import React, { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { MessageSquare, Star, X } from 'lucide-react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useMyBookings } from '@/modules/arenas/hooks/useBookings';
import {
  useArenaModules,
} from '@/modules/arenas/hooks/useArenaModules';
import { useMyNpsAnswers, useSubmitNps } from '@/modules/arenas/hooks/useArenaV3';
import { ARENA_MODULE_ID } from '@/modules/arenas/domain/modules';
import { shouldAskNps } from '@/modules/arenas/domain/marketing';
import { V2Button, V2Surface, V2Textarea } from '@/v2/ui/primitives';

/** `Timestamp | Date | number` → ms. */
function ms(v) {
  if (!v) return null;
  const n = v?.toMillis ? v.toMillis() : v instanceof Date ? v.getTime() : v?.seconds ? v.seconds * 1000 : Number(v);
  return Number.isFinite(n) ? n : null;
}

/** A data (ISO) da minha última visita CONCLUÍDA a esta arena. */
export function lastVisitAt(bookings = [], arenaId, hojeISO) {
  const datas = (bookings || [])
    .filter((b) => b?.arena_id === arenaId && ['completed', 'confirmed'].includes(b?.status))
    .flatMap((b) => (b.slots || []).map((s) => s?.date))
    .filter((d) => typeof d === 'string' && d && d <= hojeISO)
    .sort();
  return datas[datas.length - 1] || null;
}

export default function ArenaNpsAsk({ arenaId, arenaName = 'esta arena' }) {
  const { user } = useAuth();
  const { isOn, isLoading: modulosCarregando } = useArenaModules(arenaId);
  const { data: reservas = [], isLoading: reservasCarregando } = useMyBookings();
  const { data: respostas = [], isLoading: respostasCarregando } = useMyNpsAnswers(arenaId);
  const enviar = useSubmitNps();

  const [nota, setNota] = useState(null);
  const [comentario, setComentario] = useState('');
  const [enviado, setEnviado] = useState(false);
  const [dispensado, setDispensado] = useState(false);

  const hojeISO = useMemo(() => {
    const d = new Date();
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  }, []);

  const ultimaVisita = useMemo(
    () => lastVisitAt(reservas, arenaId, hojeISO),
    [reservas, arenaId, hojeISO],
  );

  const ultimaResposta = useMemo(() => {
    const tempos = (respostas || []).map((r) => ms(r.created_at)).filter(Boolean);
    return tempos.length > 0 ? Math.max(...tempos) : null;
  }, [respostas]);

  const carregando = modulosCarregando || reservasCarregando || respostasCarregando;
  const vale = !carregando
    && !!user?.uid
    && isOn(ARENA_MODULE_ID.MARKETING_NPS)
    && shouldAskNps({ lastVisitISO: ultimaVisita, lastAnswerMs: ultimaResposta });

  if (dispensado || (!vale && !enviado)) return null;

  const registrar = async (valor) => {
    setNota(valor);
    try {
      await enviar.mutateAsync({ arenaId, score: valor, comment: '' });
      setEnviado(true);
    } catch (err) {
      setNota(null);
      toast.error(err?.message || 'Não foi possível registrar sua nota.');
    }
  };

  const completar = async () => {
    if (!comentario.trim()) { setDispensado(true); return; }
    try {
      // A resposta com comentário substitui a nota crua (mesmo dia, mesma
      // pessoa): o painel da arena mostra as duas linhas, e a de baixo tem o
      // motivo. Reenviar é mais simples — e mais honesto — do que editar.
      await enviar.mutateAsync({ arenaId, score: nota, comment: comentario.trim() });
      toast.success('Obrigado! Sua opinião chega direto à arena.');
      setDispensado(true);
    } catch (err) {
      toast.error(err?.message || 'Não foi possível enviar o comentário.');
    }
  };

  if (enviado) {
    return (
      <V2Surface className="border-green-200 bg-green-50/40">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-display text-base font-bold text-ink">
              Obrigado! Sua nota {nota} foi registrada.
            </p>
            <p className="mt-0.5 text-sm text-gray-600">
              Quer contar o motivo? A arena lê — é o que faz a nota virar mudança.
            </p>
          </div>
          <button type="button" onClick={() => setDispensado(true)} aria-label="Fechar"
            className="rounded-full p-1.5 text-gray-400 hover:bg-gray-100 hover:text-ink">
            <X className="h-4 w-4" />
          </button>
        </div>
        <V2Textarea
          className="mt-3" rows={2} maxLength={500}
          placeholder="O que foi bom, o que dava para melhorar…"
          value={comentario}
          onChange={(e) => setComentario(e.target.value)}
        />
        <div className="mt-2 flex justify-end gap-2">
          <V2Button variant="ghost" size="sm" onClick={() => setDispensado(true)}>Agora não</V2Button>
          <V2Button size="sm" disabled={enviar.isPending} onClick={completar}>
            <MessageSquare className="mr-1.5 h-4 w-4" /> Enviar comentário
          </V2Button>
        </div>
      </V2Surface>
    );
  }

  return (
    <V2Surface>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2">
          <Star className="mt-0.5 h-5 w-5 shrink-0 text-acid" />
          <div>
            <p className="font-display text-base font-bold text-ink">
              Como foi sua última partida na {arenaName}?
            </p>
            <p className="mt-0.5 text-sm text-gray-500">
              De 0 a 10, qual a chance de você indicar a amigos? Um toque e pronto.
            </p>
          </div>
        </div>
        <button type="button" onClick={() => setDispensado(true)} aria-label="Dispensar"
          className="rounded-full p-1.5 text-gray-400 hover:bg-gray-100 hover:text-ink">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {Array.from({ length: 11 }, (_, i) => (
          <button
            key={i}
            type="button"
            disabled={enviar.isPending}
            onClick={() => registrar(i)}
            aria-label={`Nota ${i}`}
            className="h-10 w-10 rounded-2xl border border-gray-200 bg-paper-pure text-sm font-bold text-ink transition hover:border-ink hover:bg-ink hover:text-acid disabled:opacity-50"
          >
            {i}
          </button>
        ))}
      </div>
      <div className="mt-1.5 flex justify-between text-[11px] text-gray-400">
        <span>Não indicaria</span>
        <span>Indicaria com certeza</span>
      </div>
    </V2Surface>
  );
}
