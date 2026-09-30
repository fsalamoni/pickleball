/**
 * O BOTÃO de entrar (e de sair) de um jogo da lista do "Jogar" — o mesmo no
 * início, no Procura-se jogo e no "Com vaga para você" do Dia de jogo.
 *
 * *"Em todos os locais que existe a possibilidade de um usuário ingressar e
 * participar, deve haver o botão respectivo."* Antes, essas listas só levavam
 * para outra tela: para entrar era preciso abrir o dia de jogo e procurar o
 * botão lá. Agora quem vê o jogo entra ali mesmo, pelo caminho CERTO de cada
 * origem — que é o que não pode divergir entre as telas:
 *
 * | origem | entrar | sair |
 * |---|---|---|
 * | dia do atleta (público) | "Participar" — `joinPublicGameDay` | `leaveGameDay` |
 * | dia do CLUBE (para quem é do clube) | "Participar" — o mesmo serviço, que a regra confere | `leaveGameDay` |
 * | dia da ARENA, inscrição no dia | "Marcar presença" — `signUpToArenaGameDay` (teto de vagas) | `leaveGameDay` |
 * | dia da ARENA, inscrição por quadra | "Escolher a quadra" — abre o dia, onde as quadras estão | — |
 * | jogo aberto | `slotActionState`: entrar, fila ou "fora da faixa" (com o motivo) | sair do jogo |
 * | convite solto | "Chamar para jogar" (a conversa com quem convidou) | — |
 *
 * O botão de cada linha diz DE QUAL jogo é (`aria-label`): numa lista, dez
 * "Participar" iguais não dizem nada a quem usa leitor de tela.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowRight, Check, LayoutGrid, LogIn, LogOut } from 'lucide-react';
import { useJoinPublicGameDay, useLeaveGameDay } from '@/modules/games/hooks/useGameDays';
import { useSignUpToArenaGameDay } from '@/modules/games/hooks/useArenaGameDays';
import { useUserWaitlist } from '@/modules/arenas/hooks/useArenaV3';
import { useMyUnifiedLevel } from '@/modules/rating/hooks/useMyUnifiedLevel';
import { slotActionState } from '@/modules/arenas/domain/openMatchView';
import { PLAY_KIND, PLAY_ORIGIN } from '@/modules/games/domain/playDiscovery';
import { SlotAction } from '@/v2/components/arenas/openMatch/OpenSlotCard';
import { useOpenSlotActions } from '@/v2/components/arenas/openMatch/useOpenSlotActions';
import V2ChatLauncherButton from '@/v2/components/chat/V2ChatLauncherButton';
import { V2Button } from '@/v2/ui/primitives';

/** O link para dentro do jogo — sempre ao lado do botão, para ver antes de entrar. */
function Abrir({ item, size, rotulo = 'Abrir' }) {
  return (
    <V2Button asChild variant="ghost" size={size}>
      <Link to={item.link} aria-label={`${rotulo}: ${item.title}`}>
        {rotulo} <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
      </Link>
    </V2Button>
  );
}

/** Os dias de jogo (atleta, clube, arena). */
function AcaoDoDia({ item, size, mostrarAbrir }) {
  const entrar = useJoinPublicGameDay();
  const marcar = useSignUpToArenaGameDay();
  const sair = useLeaveGameDay();
  const daArena = item.origem === PLAY_ORIGIN.ARENA;
  const ocupado = entrar.isPending || marcar.isPending || sair.isPending;

  if (item.estou) {
    const onSair = async () => {
      try {
        await sair.mutateAsync(item.id);
        toast.success(daArena ? 'Presença desmarcada.' : 'Você saiu do dia de jogo.');
      } catch (err) {
        toast.error(err?.message || 'Não foi possível sair.');
      }
    };
    return (
      <>
        <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700">
          <Check className="h-3.5 w-3.5" aria-hidden="true" /> Você vai
        </span>
        {mostrarAbrir && <Abrir item={item} size={size} />}
        <V2Button variant="ghost" size={size} onClick={onSair} disabled={ocupado} aria-label={`Sair de ${item.title}`}>
          <LogOut className="h-3.5 w-3.5" aria-hidden="true" /> {sair.isPending ? 'Saindo…' : (daArena ? 'Desmarcar' : 'Sair')}
        </V2Button>
      </>
    );
  }

  // Inscrição por QUADRA: a escolha mora dentro do dia (vagas de cada quadra).
  if (daArena && item.porQuadra) {
    return (
      <V2Button asChild size={size}>
        <Link to={item.link} aria-label={`Escolher a quadra e entrar em ${item.title}`}>
          <LayoutGrid className="h-3.5 w-3.5" aria-hidden="true" /> Escolher a quadra
        </Link>
      </V2Button>
    );
  }

  const onEntrar = async () => {
    try {
      if (daArena) {
        await marcar.mutateAsync({ gameDay: item.fonte, courtId: null });
        toast.success('Presença confirmada. Bom jogo!');
      } else {
        await entrar.mutateAsync(item.fonte);
        toast.success('Você entrou no dia de jogo. Bom jogo!');
      }
    } catch (err) {
      toast.error(err?.message || 'Não foi possível entrar.');
    }
  };
  const pendente = entrar.isPending || marcar.isPending;
  return (
    <>
      <V2Button size={size} onClick={onEntrar} disabled={ocupado} aria-label={`${daArena ? 'Marcar presença em' : 'Participar de'} ${item.title}`}>
        <LogIn className="h-3.5 w-3.5" aria-hidden="true" />
        {pendente ? 'Entrando…' : (daArena ? 'Marcar presença' : 'Participar')}
      </V2Button>
      {mostrarAbrir && <Abrir item={item} size={size} rotulo="Ver" />}
    </>
  );
}

/** O jogo aberto: entrar, fila ou fora da faixa — pela mesma regra de todas as telas. */
function AcaoDoJogoAberto({ item, size, mostrarAbrir }) {
  const acoes = useOpenSlotActions();
  const { level } = useMyUnifiedLevel();
  const { data: fila = [] } = useUserWaitlist();
  const slot = item.fonte;
  const naFila = fila.some((f) => f.slot_id === slot.id);
  const { estado } = slotActionState(slot, { jaEstou: item.estou, naFila, level });
  return (
    <>
      <SlotAction
        estado={estado}
        size={size}
        ocupado={acoes.ocupado}
        onEntrar={() => acoes.onEntrar(slot)}
        onSair={() => acoes.onSair(slot)}
        onFila={() => acoes.onFila(slot)}
      />
      {mostrarAbrir && <Abrir item={item} size={size} rotulo="Ver" />}
    </>
  );
}

/** O convite solto: quem convidou está a uma conversa de distância. */
function AcaoDoConvite({ item, size }) {
  const g = item.fonte || {};
  if (g.kind === 'game_day' && g.game_day_id) {
    return <Abrir item={item} size={size} rotulo="Ver e participar" />;
  }
  return (
    <V2ChatLauncherButton
      athlete={{ id: g.created_by, platform_name: g.creator_name, photo_url: g.creator_photo }}
      size={size}
      label="Chamar para jogar"
    />
  );
}

/**
 * @param {{ item: object, size?: 'sm'|'default', mostrarAbrir?: boolean }} props
 *   `mostrarAbrir`: o link para dentro do jogo ao lado do botão (nas linhas em
 *   que o título já é o link, ele sobra).
 */
export default function PlayItemAction({ item, size = 'sm', mostrarAbrir = false }) {
  if (!item) return null;
  if (item.kind === PLAY_KIND.JOGO_ABERTO) return <AcaoDoJogoAberto item={item} size={size} mostrarAbrir={mostrarAbrir} />;
  if (item.kind === PLAY_KIND.CONVITE) return <AcaoDoConvite item={item} size={size} />;
  return <AcaoDoDia item={item} size={size} mostrarAbrir={mostrarAbrir} />;
}
