import React, { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { ShieldCheck, UserPlus, X, Crown } from 'lucide-react';

import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { UserAvatar } from '@/components/ui/user-avatar';
import { V2Button, V2Badge } from '@/v2/ui/primitives';
import V2CollapsibleCard from '@/v2/ui/V2CollapsibleCard';
import { GAME_DAY_SECTION } from '@/v2/components/games/gameDaySections';
import { cn } from '@/core/lib/utils';
import { useAthletes } from '@/modules/athletes/hooks/useAthletes';
import {
  GAME_DAY_MANAGE_MODE, GAME_DAY_MANAGE_MODE_LABELS, GAME_DAY_MANAGE_MODE_HINTS,
  gameDayManageMode, gameDayAdminList,
} from '@/modules/games/domain/gameDayRoles';
import {
  useAddGameDayAdmin, useRemoveGameDayAdmin, useSetGameDayManageMode,
} from '@/modules/games/hooks/useGameDays';

/**
 * "Organização" do dia de jogo — o painel do CRIADOR.
 *
 * Duas decisões moram aqui, e as duas são só dele:
 *
 * 1. **Quem organiza as partidas.** Restrito (ele e quem nomear) ou aberto a
 *    todos os inscritos. O padrão é restrito: é o comportamento que a
 *    plataforma sempre teve, e abrir precisa ser uma escolha consciente.
 * 2. **Quem são os organizadores.** O criador aparece sempre no topo, marcado,
 *    e não pode ser removido — é organizador por ser o criador, não por estar
 *    numa lista.
 *
 * O que este painel NÃO concede: editar o dia, arquivar, publicar no ranking ou
 * mexer nesta própria tela. Isso continua exclusivo do criador.
 *
 * O card só é renderizado para o criador — quem não é nem sabe que ele existe.
 */
export default function GameDayAdminsCard({ gameDay, participants = [] }) {
  const gdId = gameDay?.id;
  const setMode = useSetGameDayManageMode(gdId);
  const addAdmin = useAddGameDayAdmin(gdId);
  const removeAdmin = useRemoveGameDayAdmin(gdId);
  const { data: athletes = [] } = useAthletes();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(null);

  const modo = gameDayManageMode(gameDay);

  // Perfis conhecidos, para mostrar nome e foto de quem já é organizador. Os
  // participantes vêm primeiro: são os mais prováveis, e chegam sem consulta.
  const perfilPorUid = useMemo(() => {
    const mapa = new Map();
    (athletes || []).forEach((a) => { if (a?.uid) mapa.set(a.uid, a); });
    (participants || []).forEach((p) => {
      if (p?.user_id && !mapa.has(p.user_id)) {
        mapa.set(p.user_id, { platform_name: p.name, photo_url: p.photo_url });
      }
    });
    if (gameDay?.created_by && !mapa.has(gameDay.created_by)) {
      mapa.set(gameDay.created_by, {
        platform_name: gameDay.creator_name, photo_url: gameDay.creator_photo,
      });
    }
    return mapa;
  }, [athletes, participants, gameDay?.created_by, gameDay?.creator_name, gameDay?.creator_photo]);

  const organizadores = useMemo(
    () => gameDayAdminList(gameDay, perfilPorUid),
    [gameDay, perfilPorUid],
  );
  const jaOrganizam = useMemo(
    () => new Set(organizadores.map((o) => o.uid)),
    [organizadores],
  );

  // Candidatos: qualquer atleta da plataforma que ainda não organiza.
  const candidatos = useMemo(
    () => (athletes || [])
      .filter((a) => a?.uid && !jaOrganizam.has(a.uid))
      .map((a) => ({ uid: a.uid, name: a.platform_name || 'Atleta', photo_url: a.photo_url || null })),
    [athletes, jaOrganizam],
  );

  const trocarModo = async (novo) => {
    if (novo === modo) return;
    try {
      await setMode.mutateAsync(novo);
      toast.success(novo === GAME_DAY_MANAGE_MODE.PARTICIPANTS
        ? 'Agora qualquer participante pode organizar as partidas.'
        : 'Só você e os organizadores que nomear podem conduzir as partidas.');
    } catch (err) {
      toast.error(err?.message || 'Não foi possível mudar o modo.');
    }
  };

  const nomear = async (pessoa) => {
    try {
      await addAdmin.mutateAsync(pessoa.uid);
      toast.success(`${pessoa.name} agora organiza este dia de jogo.`);
      setPickerOpen(false);
    } catch (err) {
      toast.error(err?.message || 'Não foi possível nomear.');
    }
  };

  const remover = async (uid) => {
    try {
      await removeAdmin.mutateAsync(uid);
      toast.success('Organizador removido. Ele continua participando do dia de jogo.');
    } catch (err) {
      toast.error(err?.message || 'Não foi possível remover.');
    }
  };

  const nomeados = organizadores.filter((o) => !o.criador).length;

  return (
    <V2CollapsibleCard
      icon={ShieldCheck}
      title="Organização"
      sectionId={GAME_DAY_SECTION.ADMINS}
      defaultCollapsed
      summary={modo === GAME_DAY_MANAGE_MODE.PARTICIPANTS
        ? 'Aberto a todos os participantes'
        : `Só você${nomeados > 0 ? ` e mais ${nomeados}` : ''}`}
    >
      <div className="space-y-5">
        {/* Modo de gestão */}
        <div>
          <p className="text-sm font-semibold text-ink">Quem pode organizar as partidas</p>
          <div className="mt-2 grid gap-2">
            {Object.values(GAME_DAY_MANAGE_MODE).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => trocarModo(m)}
                disabled={setMode.isPending}
                aria-pressed={modo === m}
                className={cn(
                  'rounded-xl border px-3 py-2 text-left transition-colors disabled:opacity-60',
                  modo === m ? 'border-ink bg-ink text-white' : 'border-gray-200 hover:bg-paper',
                )}
              >
                <span className="block text-sm font-semibold">{GAME_DAY_MANAGE_MODE_LABELS[m]}</span>
                <span className={cn('mt-0.5 block text-[11px]', modo === m ? 'text-white/70' : 'text-gray-500')}>
                  {GAME_DAY_MANAGE_MODE_HINTS[m]}
                </span>
              </button>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-gray-500">
            Editar o dia de jogo, arquivar, publicar no ranking e nomear organizadores continuam só com você.
          </p>
        </div>

        {/* Organizadores */}
        <div>
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-ink">Organizadores</p>
            <V2Button size="sm" variant="ghost" onClick={() => setPickerOpen(true)}>
              <UserPlus className="mr-1.5 h-4 w-4" /> Nomear organizador
            </V2Button>
          </div>

          <div className="mt-2 space-y-1.5">
            {organizadores.map((o) => (
              <div key={o.uid} className="flex items-center gap-2 rounded-lg border border-gray-100 bg-white p-2">
                <UserAvatar name={o.nome || 'Atleta'} photoUrl={o.foto} size="sm" />
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">
                  {o.nome || 'Atleta da plataforma'}
                </span>
                {o.criador ? (
                  <V2Badge tone="neutral"><Crown className="mr-1 h-3 w-3" /> Criador</V2Badge>
                ) : (
                  <V2Button
                    variant="ghost"
                    className="text-gray-400 hover:text-red-600"
                    title="Remover organizador"
                    aria-label={`Remover ${o.nome || 'organizador'}`}
                    onClick={() => setConfirmRemove(o)}
                  >
                    <X className="h-4 w-4" />
                  </V2Button>
                )}
              </div>
            ))}
          </div>

          <p className="mt-2 text-[11px] text-gray-500">
            O organizador conduz as partidas e a lista de participantes. Remover não tira ninguém do dia de jogo.
          </p>
        </div>
      </div>

      <NomearDialog
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        candidatos={candidatos}
        onEscolher={nomear}
      />
      <ConfirmDialog
        open={!!confirmRemove}
        onOpenChange={(v) => !v && setConfirmRemove(null)}
        title="Remover organizador?"
        description={confirmRemove
          ? `${confirmRemove.nome || 'O atleta'} deixa de conduzir as partidas. Ele continua participando do dia de jogo.`
          : ''}
        confirmLabel="Remover"
        onConfirm={() => { const o = confirmRemove; setConfirmRemove(null); if (o) remover(o.uid); }}
      />
    </V2CollapsibleCard>
  );
}

function NomearDialog({ open, onClose, candidatos, onEscolher }) {
  const [busca, setBusca] = useState('');
  const q = busca.trim().toLowerCase();
  const lista = candidatos.filter((p) => !q || p.name.toLowerCase().includes(q));

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[90dvh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nomear organizador</DialogTitle>
          <DialogDescription>
            Quem você escolher passa a conduzir as partidas e a lista de participantes deste dia de jogo —
            e entra nele como membro, para poder acompanhar.
          </DialogDescription>
        </DialogHeader>
        <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por nome…" />
        <div className="max-h-[50vh] space-y-1.5 overflow-y-auto">
          {lista.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-400">Nenhum atleta encontrado.</p>
          ) : lista.map((p) => (
            <div key={p.uid} className="flex items-center justify-between gap-2 rounded-lg border border-gray-100 p-2">
              <div className="flex min-w-0 items-center gap-2">
                <UserAvatar name={p.name} photoUrl={p.photo_url} size="sm" />
                <span className="truncate text-sm font-medium text-ink">{p.name}</span>
              </div>
              <V2Button size="sm" variant="ghost" onClick={() => onEscolher(p)}>
                <ShieldCheck className="mr-1 h-3.5 w-3.5" /> Nomear
              </V2Button>
            </div>
          ))}
        </div>
        <DialogFooter>
          <V2Button variant="ghost" onClick={onClose}>Fechar</V2Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
