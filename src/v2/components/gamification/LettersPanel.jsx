import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Flag, Mail, MailOpen, PenLine, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { V2Avatar, V2Badge, V2Button, V2EmptyState, V2ErrorState, V2Skeleton, V2Surface, V2Textarea, V2Toggle } from '@/v2/ui/primitives';
import { useLetterActions, useReceivedLetters, useSentLetters } from '@/modules/progression/hooks/useSocialGamification';
import { usePeople } from '@/modules/progression/hooks/usePeople';
import { LETTER_MAX, LETTER_STARTERS, letterDocId, letterForRecipient, letterTargets } from '@/modules/progression/domain/partnerLetters';
import TermHint from './TermHint';

const quando = (ms) => new Date(Number(ms)).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });

function WriteDialog({ target, people, onClose, onSend, sending }) {
  const [text, setText] = useState('');
  const [showName, setShowName] = useState(false);
  const p = people.get(target.toUid) || { name: 'Atleta', photoUrl: '' };
  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Carta para {p.name}</DialogTitle>
          <DialogDescription>Uma frase de gratidão pela parceria. Por padrão ela chega sem o seu nome.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex flex-wrap gap-1.5">
            {LETTER_STARTERS.map((s) => (
              <button key={s} type="button" onClick={() => setText((t) => (t ? t : s))}
                className="rounded-full border border-gray-200 px-2.5 py-1 text-xs text-gray-600 hover:border-ink/40">{s.trim()}</button>
            ))}
          </div>
          <V2Textarea
            value={text} rows={4} maxLength={LETTER_MAX} placeholder="Escreva com carinho…" aria-label="Texto da carta"
            onChange={(e) => setText(e.target.value)}
          />
          <p className="text-right text-[11px] text-gray-400">{text.length}/{LETTER_MAX}</p>
          <V2Toggle id="letter-name" checked={showName} onChange={setShowName} label="Assinar com o meu nome" hint="Desligado: a pessoa recebe como “Um parceiro de dupla”." />
        </div>
        <DialogFooter>
          <V2Button variant="ghost" onClick={onClose}>Cancelar</V2Button>
          <V2Button disabled={text.trim().length < 3 || sending} onClick={() => onSend({ text, showName })}>Enviar carta</V2Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Cartas recebidas e o convite para escrever (parceiros de dupla dos jogos
 * recentes que ainda não receberam uma).
 * @param {{ uid: string, fromName?: string, records: Array<object>, windowDays?: number }} props
 */
export default function LettersPanel({ uid, fromName, records, windowDays = 30 }) {
  const received = useReceivedLetters(uid);
  const sent = useSentLetters(uid);
  const act = useLetterActions(uid);
  const [writing, setWriting] = useState(null);
  const marcadas = useRef(new Set());

  // Quem abriu a aba leu: marca como lidas depois de alguns segundos (e não ao
  // passar o mouse, que no celular nem existe).
  const naoLidas = received.letters.filter((l) => !l.readAt).map((l) => l.id).join(',');
  const { mutate: marcarLida } = act.read;
  useEffect(() => {
    if (!naoLidas) return undefined;
    const t = setTimeout(() => {
      naoLidas.split(',').forEach((id) => {
        if (!marcadas.current.has(id)) { marcadas.current.add(id); marcarLida(id); }
      });
    }, 4000);
    return () => clearTimeout(t);
  }, [naoLidas, marcarLida]);

  const sentIds = useMemo(() => new Set(sent.sent.map((l) => l.id)), [sent.sent]);
  const candidatos = useMemo(() => {
    const limite = Date.now() - windowDays * 86_400_000;
    const out = [];
    (records || []).forEach((r) => {
      if (!r.matchKey || r.at < limite) return;
      letterTargets(r, uid).forEach((toUid) => {
        if (!sentIds.has(letterDocId(r.matchKey, uid, toUid))) out.push({ toUid, matchKey: r.matchKey, at: r.at, label: r.label });
      });
    });
    // uma sugestão por pessoa (a mais recente)
    const vistos = new Set();
    return out.filter((c) => (vistos.has(c.toUid) ? false : vistos.add(c.toUid))).slice(0, 4);
  }, [records, sentIds, uid, windowDays]);

  const { people } = usePeople(candidatos.map((c) => c.toUid));

  if (received.isLoading || sent.isLoading) return <V2Skeleton className="h-40 rounded-4xl" />;
  if (received.isError || sent.isError) {
    return <V2Surface><V2ErrorState inline title="Não deu para carregar as cartas" onRetry={() => { received.refetch(); }} /></V2Surface>;
  }

  const enviar = async ({ text, showName }) => {
    try {
      await act.send.mutateAsync({ fromName, toUid: writing.toUid, matchKey: writing.matchKey, text, showName });
      toast.success('Carta enviada.');
      setWriting(null);
    } catch (err) {
      toast.error(err?.message || 'Não foi possível enviar agora.');
    }
  };

  return (
    <V2Surface data-testid="letters-panel" data-dica="cartas" className="space-y-5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-display text-lg font-bold text-ink">
          <Mail className="h-5 w-5" aria-hidden="true" /> Cartas dos parceiros <TermHint term="cartas" />
        </h2>
        {received.unread > 0 && <V2Badge tone="acid">{received.unread} {received.unread === 1 ? 'nova' : 'novas'}</V2Badge>}
      </div>

      {candidatos.length > 0 && (
        <div className="rounded-2xl bg-paper p-3">
          <p className="mb-2 text-sm font-bold text-ink">Quem jogou com você merece um obrigado</p>
          <div className="flex flex-wrap gap-2">
            {candidatos.map((c) => {
              const p = people.get(c.toUid) || { name: 'Atleta', photoUrl: '' };
              return (
                <button key={c.toUid} type="button" onClick={() => setWriting(c)}
                  className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white py-1 pl-1 pr-3 text-xs font-semibold text-ink hover:border-ink/40">
                  <V2Avatar name={p.name} photoUrl={p.photoUrl} size="sm" /> <PenLine className="h-3.5 w-3.5" aria-hidden="true" /> {p.name}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {received.letters.length === 0 ? (
        <V2EmptyState icon={MailOpen} title="Nenhuma carta ainda" description="Quando um parceiro de dupla escrever para você, a carta aparece aqui." />
      ) : (
        <ul className="space-y-2">
          {received.letters.map((raw) => {
            const l = letterForRecipient(raw, raw.fromName);
            return (
              <li key={l.id} data-unread={String(!l.readAt)}
                className="rounded-2xl border border-gray-100 p-3 data-[unread=true]:border-acid data-[unread=true]:bg-acid/10">
                <p className="text-sm leading-6 text-ink">“{l.text}”</p>
                <div className="mt-2 flex items-center justify-between gap-2 text-xs text-gray-500">
                  <span>{l.from} · {quando(l.createdAt)}</span>
                  <span className="flex gap-1">
                    <button type="button" aria-label="Denunciar carta" title="Denunciar" onClick={() => { act.report.mutate(l.id); toast('Carta denunciada. A moderação vai analisar.'); }}
                      className="rounded-full p-1.5 hover:bg-paper"><Flag className="h-3.5 w-3.5" /></button>
                    <button type="button" aria-label="Apagar carta" title="Apagar" onClick={() => act.remove.mutate(l.id)}
                      className="rounded-full p-1.5 hover:bg-paper"><Trash2 className="h-3.5 w-3.5" /></button>
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {writing && <WriteDialog target={writing} people={people} onClose={() => setWriting(null)} onSend={enviar} sending={act.send.isPending} />}
    </V2Surface>
  );
}
