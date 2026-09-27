/**
 * O SELETOR dos cards da tela inicial — o mesmo em Configurações → Página
 * inicial e no "Personalizar" do próprio início.
 *
 * Três blocos, na ordem em que a pessoa pensa:
 *  1. **No seu início, nesta ordem** — os cards ligados, com subir/descer e o
 *     interruptor para tirar;
 *  2. **Sugeridos para você** — o que ela FAZ na plataforma (gere arena, dá
 *     aula, tem clube…) e ainda não está no início, com o motivo e um toque
 *     para acrescentar. Sugestão, não imposição: a tela não volta a se encher
 *     sozinha;
 *  3. **Para acrescentar** — o resto, por assunto.
 *
 * Muda NA HORA (a tela inicial atrás do diálogo já mostra), e cada mudança é
 * anunciada ao leitor de tela. Nada disso vai ao banco: a escolha fica no
 * navegador, por usuário (`useHomeCards`).
 */
import React, { useId, useMemo, useState } from 'react';
import {
  Building2, CalendarCheck, CalendarDays, ChevronDown, ChevronUp, ClipboardList, GraduationCap, Handshake,
  LayoutGrid, Medal, Megaphone, Plus, RotateCcw, Sparkles, Swords, TrendingUp, Trophy, Users, Zap,
} from 'lucide-react';
import { cn } from '@/core/lib/utils';
import {
  HOME_CARD_GROUP, HOME_CARD_GROUP_LABEL, HOME_CARD_META, homeCardAvailable, homeCardsOfGroup, suggestedHomeCards,
  visibleHomeCards,
} from '@/modules/home/domain/homeCards';
import { useHomeCards, useHomeCardsContext } from '@/modules/home/hooks/useHomeCards';

const ICONES = {
  Building2, CalendarCheck, CalendarDays, ClipboardList, GraduationCap, Handshake, Medal, Megaphone, Swords,
  TrendingUp, Trophy, Users, Zap,
};

/** O ícone de um card (o catálogo guarda o nome). */
function homeCardIcon(id) {
  return ICONES[HOME_CARD_META[id]?.icon] || LayoutGrid;
}

/** O interruptor — o mesmo desenho da chave do resto da plataforma. */
function Interruptor({ ligado, onClick, labelledBy, describedBy }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={ligado}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      onClick={onClick}
      className={cn(
        'relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors',
        'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-acid/40',
        ligado ? 'bg-acid' : 'bg-gray-200',
      )}
    >
      {/* Branco nos dois modos: `bg-white` é o cartão no modo escuro. */}
      <span className={cn('inline-block h-5 w-5 rounded-full bg-[#fff] shadow transition-transform', ligado ? 'translate-x-6' : 'translate-x-1')} />
    </button>
  );
}

/** Um botão de subir/descer. Na ponta fica focável e só avisa (não some sob o dedo). */
function BotaoMover({ direcao, label, ponta, onMover }) {
  const Icone = direcao < 0 ? ChevronUp : ChevronDown;
  return (
    <button
      type="button"
      aria-label={`${direcao < 0 ? 'Subir' : 'Descer'} “${label}”`}
      aria-disabled={ponta || undefined}
      onClick={() => { if (!ponta) onMover(direcao); }}
      className={cn(
        'flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border transition-colors sm:h-9 sm:w-9',
        'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-acid/30',
        ponta ? 'cursor-default border-transparent text-gray-300' : 'border-gray-100 text-gray-500 hover:border-gray-300 hover:text-ink',
      )}
    >
      <Icone className="h-4 w-4" aria-hidden="true" />
    </button>
  );
}

/** Uma linha do seletor. */
function LinhaCard({
  id, ligado, posicao, total, motivo, onAlternar, onMover, compacta,
}) {
  const base = useId();
  const meta = HOME_CARD_META[id];
  const Icone = homeCardIcon(id);
  const tituloId = `${base}-titulo`;
  const descId = `${base}-desc`;
  return (
    <li
      data-card-inicio={id}
      className={cn(
        'flex items-center gap-2.5 rounded-3xl border p-3 transition-colors sm:gap-3 sm:p-3.5',
        ligado ? 'border-gray-200 bg-paper-pure' : 'border-gray-100 bg-paper',
      )}
    >
      {posicao != null && (
        <span className="hidden w-5 shrink-0 text-center font-display text-sm font-bold tabular-nums text-gray-400 sm:block" aria-hidden="true">
          {posicao}
        </span>
      )}
      <span
        className={cn(
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl sm:h-10 sm:w-10',
          ligado ? 'bg-ink text-acid' : 'bg-paper-pure text-gray-500',
        )}
        aria-hidden="true"
      >
        <Icone className="h-[18px] w-[18px] sm:h-5 sm:w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p id={tituloId} className="font-display text-sm font-bold leading-tight text-ink sm:text-base">{meta.label}</p>
        {!compacta && (
          <p id={descId} className="mt-0.5 text-xs leading-snug text-gray-500">
            {motivo ? <span className="font-semibold text-ink">{motivo}. </span> : null}
            {meta.description}
            {meta.nota ? ` ${meta.nota}` : ''}
          </p>
        )}
      </div>
      {/* No celular as setas ficam uma sobre a outra: lado a lado, com o
          interruptor, espremiam a descrição em duas palavras por linha. */}
      {posicao != null && (
        <div className="flex shrink-0 flex-col gap-1 sm:flex-row">
          <BotaoMover direcao={-1} label={meta.label} ponta={posicao === 1} onMover={(d) => onMover(id, d)} />
          <BotaoMover direcao={1} label={meta.label} ponta={posicao === total} onMover={(d) => onMover(id, d)} />
        </div>
      )}
      {motivo ? (
        <button
          type="button"
          onClick={() => onAlternar(id)}
          aria-describedby={descId}
          className="btn-press inline-flex shrink-0 items-center gap-1 rounded-full bg-acid px-3 py-2 text-xs font-bold text-ink hover:bg-acid-light focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-acid/40"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden="true" /> Adicionar
          <span className="sr-only"> “{meta.label}”</span>
        </button>
      ) : (
        <Interruptor ligado={ligado} onClick={() => onAlternar(id)} labelledBy={tituloId} describedBy={compacta ? undefined : descId} />
      )}
    </li>
  );
}

/** O título de um bloco do seletor. */
function Bloco({ titulo, dica, children }) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="space-y-2">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 px-1">
        <h3 id={id} className="text-[11px] font-bold uppercase tracking-widest text-gray-500">{titulo}</h3>
        {dica && <p className="text-xs text-gray-500">{dica}</p>}
      </div>
      {children}
    </section>
  );
}

const ordinal = (n) => `${n}º`;

/**
 * @param {{ foci?: Array<{ focus: string, reason: string, weight: number }> }} props
 *   `foci`: as frentes da pessoa (`resolveHomeFoci`), para as sugestões.
 */
export default function HomeCardsPicker({ foci = [] }) {
  const {
    escolhidos, padrao, alternar, mover, restaurar,
  } = useHomeCards();
  const ctx = useHomeCardsContext();
  const [aviso, setAviso] = useState('');

  const ligados = useMemo(() => visibleHomeCards(escolhidos, ctx), [escolhidos, ctx]);
  const sugestoes = useMemo(() => suggestedHomeCards(foci, escolhidos, ctx), [foci, escolhidos, ctx]);
  const sugeridos = useMemo(() => new Set(sugestoes.map((s) => s.id)), [sugestoes]);
  const grupos = useMemo(() => Object.values(HOME_CARD_GROUP)
    .map((g) => ({
      g,
      ids: homeCardsOfGroup(g, ctx).filter((id) => !escolhidos.includes(id) && !sugeridos.has(id)),
    }))
    .filter((x) => x.ids.length > 0), [ctx, escolhidos, sugeridos]);

  const onAlternar = (id) => {
    const label = HOME_CARD_META[id].label;
    const entra = !escolhidos.includes(id);
    alternar(id);
    const posicao = visibleHomeCards([...escolhidos.filter((c) => c !== id), id], ctx).indexOf(id) + 1;
    setAviso(entra ? `${label} entrou no início, em ${ordinal(posicao)}.` : `${label} saiu do início.`);
  };
  const onMover = (id, passo) => {
    const agora = ligados.indexOf(id) + 1 + passo;
    mover(id, passo);
    setAviso(`${HOME_CARD_META[id].label} agora é o ${ordinal(agora)}.`);
  };
  const onRestaurar = () => {
    restaurar();
    setAviso('O início voltou ao padrão: Dias de jogo, Horários da arena e Ranking.');
  };

  // Um card escolhido que não aparece agora (funcionalidade desligada) segue
  // guardado — só não é listado aqui.
  const guardadosOcultos = escolhidos.filter((id) => !homeCardAvailable(id, ctx)).length;

  return (
    <div className="space-y-6">
      <p className="sr-only" aria-live="polite">{aviso}</p>

      <Bloco
        titulo="No seu início, nesta ordem"
        dica={ligados.length > 0 ? `${ligados.length} ${ligados.length === 1 ? 'card' : 'cards'}` : null}
      >
        {ligados.length > 0 ? (
          <ol className="space-y-2">
            {ligados.map((id, i) => (
              <LinhaCard
                key={id}
                id={id}
                ligado
                posicao={i + 1}
                total={ligados.length}
                onAlternar={onAlternar}
                onMover={onMover}
              />
            ))}
          </ol>
        ) : (
          <p className="rounded-3xl border border-dashed border-gray-200 bg-paper p-4 text-sm text-gray-600">
            Por enquanto o seu início mostra só o resumo do dia. Ligue abaixo o que quiser ver.
          </p>
        )}
        {!padrao && (
          <button
            type="button"
            onClick={onRestaurar}
            className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-semibold text-gray-500 transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-acid/30"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" /> Restaurar o padrão (Dias de jogo, Horários da arena e Ranking)
          </button>
        )}
      </Bloco>

      {sugestoes.length > 0 && (
        <Bloco titulo="Sugeridos para você" dica="Pelo que você faz na plataforma">
          <ul className="space-y-2">
            {sugestoes.map((s) => (
              <LinhaCard key={s.id} id={s.id} ligado={false} motivo={s.motivo} onAlternar={onAlternar} />
            ))}
          </ul>
        </Bloco>
      )}

      {grupos.length > 0 && (
        <Bloco titulo="Para acrescentar">
          <div className="space-y-4">
            {grupos.map(({ g, ids }) => (
              <div key={g} className="space-y-2">
                <p className="px-1 text-xs font-semibold text-gray-500">{HOME_CARD_GROUP_LABEL[g]}</p>
                <ul className="space-y-2">
                  {ids.map((id) => (
                    <LinhaCard key={id} id={id} ligado={false} onAlternar={onAlternar} />
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Bloco>
      )}

      <div className="flex items-start gap-2 rounded-3xl bg-paper p-4 text-xs leading-relaxed text-gray-500">
        <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" aria-hidden="true" />
        <p>
          O que tem prazo aparece sempre, fora dos cards — como a chamada da fila de um jogo aberto, que vence em 1 hora.
          A escolha fica salva neste aparelho, na sua conta.
          {guardadosOcultos > 0 && ' Um card que depende de uma funcionalidade desligada fica guardado e volta sozinho.'}
        </p>
      </div>
    </div>
  );
}
