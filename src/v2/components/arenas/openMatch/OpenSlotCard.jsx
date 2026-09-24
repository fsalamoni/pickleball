/**
 * O cartão de um jogo aberto, do lado do ATLETA — e o da chamada da fila.
 *
 * Moravam dentro de `V2ArenaOpenMatch`, e agora aparecem em quatro lugares
 * (a página de jogos abertos, a seção da página da arena, Minhas reservas e
 * Procura-se jogo). Um cartão só é o que garante que "lotado", "você está
 * dentro" e "fora da sua faixa" querem dizer a mesma coisa em todos eles.
 */

import React from 'react';
import { Link } from 'react-router-dom';
import { BellRing, Building2, Check, Clock, Info, MapPin, Users } from 'lucide-react';
import {
  formatLevel, getSlotFillPct, slotLevelFit, slotLevelRangeLabel,
} from '@/modules/arenas/domain/openMatch';
import { formatSlotLabel } from '@/modules/arenas/domain/calendar';
import { formatPrice } from '@/modules/arenas/domain/pricing';
import { OPEN_SLOT_FORMAT_LABEL, slotActionState } from '@/modules/arenas/domain/openMatchView';
import { V2Badge, V2Button, V2Surface } from '@/v2/ui/primitives';

/**
 * O botão da vaga, pelo estado que o domínio decidiu (`slotActionState`).
 * Sem conta, não há botão — só o convite para entrar.
 */
function SlotAction({ estado, semConta, ocupado, onEntrar, onSair, onFila, size = 'sm' }) {
  if (semConta) {
    return (
      <span className="text-xs text-gray-500">
        <Link to="/entrar" className="font-bold text-ink underline">Entre na sua conta</Link> para jogar.
      </span>
    );
  }
  switch (estado) {
    case 'sair':
      return <V2Button variant="ghost" size={size} disabled={ocupado} onClick={onSair}>Sair deste jogo</V2Button>;
    case 'encerrado':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs text-gray-400">
          <Clock className="h-3.5 w-3.5" /> Inscrições encerradas
        </span>
      );
    case 'na-fila':
      return <V2Badge tone="blue">Você está na fila de espera</V2Badge>;
    case 'fila':
      return <V2Button variant="secondary" size={size} disabled={ocupado} onClick={onFila}>Entrar na fila de espera</V2Button>;
    case 'fora-da-faixa':
      return <V2Button size={size} disabled>Fora da sua faixa</V2Button>;
    default:
      return <V2Button size={size} disabled={ocupado} onClick={onEntrar}>Quero jogar</V2Button>;
  }
}

/**
 * A linha compacta de um jogo aberto — para a seção da página da arena, onde
 * o cartão grande empurraria o resto da página para baixo. Mesmas regras do
 * cartão (`slotActionState`); só a altura muda.
 */
export function OpenSlotRow({
  slot, meuNivel = null, jaEstou = false, naFila = false,
  onEntrar, onSair, onFila, ocupado = false, semConta = false,
}) {
  const faixa = slotLevelRangeLabel(slot);
  const { estado, vagas, motivo } = slotActionState(slot, { jaEstou, naFila, level: meuNivel });
  return (
    <li className={`flex flex-wrap items-center justify-between gap-2 rounded-2xl border p-3 ${
      jaEstou ? 'border-acid/60 bg-acid/[0.05]' : 'border-gray-100 bg-paper'
    }`}
    >
      <div className="min-w-0">
        <p className="text-sm font-bold text-ink">{formatSlotLabel(slot)}</p>
        <p className="mt-0.5 text-xs text-gray-500">
          {[
            slot.court,
            slot.format ? (OPEN_SLOT_FORMAT_LABEL[slot.format] || slot.format) : null,
            faixa ? `nível ${faixa}` : null,
            Number(slot.price) > 0 ? `${formatPrice(Number(slot.price))} por atleta` : null,
          ].filter(Boolean).join(' · ')}
        </p>
        <p className="mt-0.5 flex items-center gap-1 text-xs text-gray-500">
          <Users className="h-3 w-3" />
          {vagas > 0 ? `${vagas} vaga${vagas === 1 ? '' : 's'}` : 'lotado'}
          {motivo && <span className="text-amber-700"> · {motivo}</span>}
        </p>
      </div>
      <SlotAction estado={estado} semConta={semConta} ocupado={ocupado}
        onEntrar={() => onEntrar?.(slot)} onSair={() => onSair?.(slot)} onFila={() => onFila?.(slot)} />
    </li>
  );
}

/**
 * @param {{
 *   slot: object, meuNivel?: number|null, jaEstou?: boolean, naFila?: boolean,
 *   onEntrar?: Function, onSair?: Function, onFila?: Function, ocupado?: boolean,
 *   mostrarArena?: boolean, semConta?: boolean,
 * }} props
 *   `mostrarArena`: nas listas que atravessam arenas o cartão diz de qual é,
 *   e o nome leva à página dela. `semConta`: sem login não há botão de entrar —
 *   só o convite para entrar na conta.
 */
export function OpenSlotCard({
  slot, meuNivel = null, jaEstou = false, naFila = false,
  onEntrar, onSair, onFila, ocupado = false, mostrarArena = false, semConta = false,
}) {
  const pct = getSlotFillPct(slot);
  const faixa = slotLevelRangeLabel(slot);
  const encaixe = slotLevelFit(slot, meuNivel);
  const { estado, vagas } = slotActionState(slot, { jaEstou, naFila, level: meuNivel });
  const lotado = vagas <= 0;

  return (
    <V2Surface className={jaEstou ? 'border-acid/60 bg-acid/[0.05]' : undefined}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-display text-lg font-bold text-ink">{formatSlotLabel(slot)}</h3>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
            {mostrarArena && slot.arena_name && (
              <Link to={`/arenas/${slot.arena_id}`} className="inline-flex items-center gap-1 font-bold text-ink hover:underline">
                <Building2 className="h-3.5 w-3.5" /> {slot.arena_name}
              </Link>
            )}
            {slot.court && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" /> {slot.court}
              </span>
            )}
            {slot.format && <span>{OPEN_SLOT_FORMAT_LABEL[slot.format] || slot.format}</span>}
            {Number.isFinite(Number(slot.price)) && Number(slot.price) > 0 && (
              <span>{formatPrice(Number(slot.price))} por atleta</span>
            )}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          {jaEstou && <V2Badge tone="green"><Check className="h-3 w-3" /> Você está dentro</V2Badge>}
          <V2Badge tone={lotado ? 'amber' : 'green'}>
            {lotado ? 'Lotado' : `${vagas} vaga${vagas === 1 ? '' : 's'}`}
          </V2Badge>
        </div>
      </div>

      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
        <div
          className={`h-full rounded-full ${lotado ? 'bg-amber-400' : 'bg-acid'}`}
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* O nível dos DOIS lados: só a faixa não diz se a pessoa entra. */}
      {faixa && (
        <p className={`mt-3 flex gap-1.5 rounded-2xl p-2.5 text-xs leading-5 ${
          encaixe.ok ? 'bg-paper text-gray-600' : 'bg-amber-50 text-amber-800'
        }`}
        >
          <Info className="mt-px h-3.5 w-3.5 shrink-0" />
          <span>
            Nível <strong>{faixa}</strong>
            {Number.isFinite(meuNivel)
              ? ` · o seu é ${formatLevel(meuNivel)}`
              : ' · ainda não temos o seu nível, então você pode entrar'}
            {!encaixe.ok && ' — fora da faixa desta vaga.'}
          </span>
        </p>
      )}

      {slot.notes && <p className="mt-2 text-xs leading-5 text-gray-500">{slot.notes}</p>}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <SlotAction estado={estado} semConta={semConta} ocupado={ocupado}
          onEntrar={() => onEntrar?.(slot)} onSair={() => onSair?.(slot)} onFila={() => onFila?.(slot)} />
      </div>
    </V2Surface>
  );
}

/**
 * "Vagou para você" — o outro lado da fila de espera.
 *
 * Sem isto a fila era meia funcionalidade: o atleta entrava na fila, recebia
 * uma notificação com prazo... e não tinha onde aceitar. (Pior: a notificação
 * apontava para `/minha-fila`, rota que nunca existiu.)
 */
export function WaitlistCallCard({
  entrada, slot, onAceitar, onRecusar, ocupado = false, mostrarArena = false,
}) {
  return (
    <V2Surface className="border-acid bg-acid/10">
      <div className="flex flex-wrap items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-ink text-acid">
          <BellRing className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-display text-base font-bold text-ink">Vagou um lugar para você</p>
          <p className="mt-0.5 text-sm text-gray-700">
            {slot ? formatSlotLabel(slot) : 'Jogo aberto'}
            {mostrarArena && slot?.arena_name ? ` · ${slot.arena_name}` : ''}
            {slot?.court ? ` · ${slot.court}` : ''}
          </p>
          <p className="mt-1 text-xs text-gray-500">
            Confirme para garantir a vaga. Se não confirmar, ela passa para o próximo da fila.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <V2Button size="sm" disabled={ocupado} onClick={() => onAceitar?.(entrada)}>
              Confirmar minha vaga
            </V2Button>
            <V2Button variant="ghost" size="sm" disabled={ocupado} onClick={() => onRecusar?.(entrada)}>
              Não vou poder
            </V2Button>
          </div>
        </div>
      </div>
    </V2Surface>
  );
}
