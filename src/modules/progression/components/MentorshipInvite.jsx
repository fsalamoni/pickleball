import React, { useMemo, useState } from 'react';
import { Send, UserPlus } from 'lucide-react';
import { V2Avatar, V2Button, V2SearchInput, V2Surface } from '@/v2/ui/primitives';
import { cn } from '@/core/lib/utils';

const ROLES = [
  { id: 'mentor', label: 'Quero ser o mentor' },
  { id: 'apprentice', label: 'Quero um mentor' },
];

/**
 * Convidar alguém para uma mentoria. O convite não cria vínculo: a pessoa
 * convidada vê e aceita (ou recusa) em Vínculos. Presentacional — a lista de
 * quem pode ser convidado e o envio vêm da tela.
 *
 * @param {{
 *   uid: string,
 *   candidates?: Array<{ id?: string, uid?: string, platform_name?: string, photo_url?: string, city?: string, state?: string }>,
 *   busy?: boolean,
 *   onInvite: (p: { role: 'mentor'|'apprentice', otherUid: string }) => void,
 * }} props
 */
export default function MentorshipInvite({ uid, candidates = [], busy = false, onInvite, className }) {
  const [role, setRole] = useState('mentor');
  const [busca, setBusca] = useState('');
  const [escolhido, setEscolhido] = useState(null);

  const achados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (q.length < 2) return [];
    return candidates
      .filter((c) => (c.uid || c.id) !== uid && String(c.platform_name || '').toLowerCase().includes(q))
      .slice(0, 6);
  }, [busca, candidates, uid]);

  const enviar = () => {
    if (!escolhido) return;
    onInvite({ role, otherUid: escolhido.uid || escolhido.id });
    setEscolhido(null);
    setBusca('');
  };

  return (
    <V2Surface className={className} data-testid="mentorship-invite">
      <h2 className="mb-1 flex items-center gap-2 font-display text-lg font-bold text-ink"><UserPlus className="h-5 w-5" aria-hidden="true" /> Convidar para uma mentoria</h2>
      <p className="mb-3 text-sm text-gray-500">A pessoa recebe o convite e só entra se aceitar. Mentoria liga alguém experiente a quem está começando.</p>
      <div role="radiogroup" aria-label="Seu papel" className="mb-3 flex flex-wrap gap-2">
        {ROLES.map((r) => (
          <button key={r.id} type="button" role="radio" aria-checked={role === r.id} onClick={() => setRole(r.id)}
            className={cn('rounded-full px-4 py-1.5 text-xs font-bold', role === r.id ? 'bg-ink text-white' : 'bg-paper text-gray-600 hover:bg-gray-100')}>
            {r.label}
          </button>
        ))}
      </div>
      {escolhido ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-acid bg-acid/10 p-3">
          <span className="flex items-center gap-2 text-sm font-bold text-ink"><V2Avatar name={escolhido.platform_name} photoUrl={escolhido.photo_url} size="sm" /> {escolhido.platform_name}</span>
          <span className="flex gap-2">
            <V2Button size="sm" disabled={busy} onClick={enviar} data-testid="mentorship-invite-send"><Send className="mr-1 h-3.5 w-3.5" /> Enviar convite</V2Button>
            <V2Button size="sm" variant="ghost" onClick={() => setEscolhido(null)}>Trocar</V2Button>
          </span>
        </div>
      ) : (
        <>
          <V2SearchInput aria-label="Buscar atleta pelo nome" placeholder="Buscar atleta pelo nome…" value={busca} onChange={(e) => setBusca(e.target.value)} />
          {busca.trim().length >= 2 && (
            achados.length === 0 ? <p className="mt-2 text-xs text-gray-500">Ninguém com esse nome no diretório.</p> : (
              <ul className="mt-2 space-y-1" data-testid="mentorship-candidates">
                {achados.map((c) => (
                  <li key={c.uid || c.id}>
                    <button type="button" onClick={() => setEscolhido(c)} className="flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-left text-sm hover:bg-paper">
                      <V2Avatar name={c.platform_name} photoUrl={c.photo_url} size="sm" />
                      <span className="font-semibold text-ink">{c.platform_name}</span>
                      <span className="text-xs text-gray-500">{[c.city, c.state].filter(Boolean).join('/')}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )
          )}
        </>
      )}
    </V2Surface>
  );
}
