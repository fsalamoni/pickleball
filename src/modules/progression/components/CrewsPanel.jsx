import React, { useState } from 'react';
import { Users, Plus, LogOut, Crown } from 'lucide-react';
import { cn } from '@/core/lib/utils';
import { CREW_MAX_MEMBERS } from '@/modules/progression/services/socialBondService';
import {
  V2Badge, V2Button, V2EmptyState, V2Field, V2Input, V2Skeleton, V2Surface,
} from '@/v2/ui/primitives';

const NOME_MAX = 40;

/**
 * CrewsPanel — as crews do atleta + crews públicas para entrar.
 *
 * @param {{
 *   uid: string,
 *   myCrews?: Array<object>,
 *   publicCrews?: Array<object>,
 *   isLoading?: boolean,
 *   onCreate?: (dados: {name: string}) => void,
 *   onJoin?: (crewId: string) => void,
 *   onLeave?: (crewId: string) => void,
 *   isBusy?: boolean,
 *   error?: string|null,
 *   className?: string,
 * }} props
 */
export default function CrewsPanel({
  uid,
  myCrews = [],
  publicCrews = [],
  isLoading = false,
  onCreate,
  onJoin,
  onLeave,
  isBusy = false,
  error = null,
  className,
}) {
  const [criando, setCriando] = useState(false);
  const [nome, setNome] = useState('');

  const meusIds = new Set(myCrews.map((c) => c.crewId));
  // Crews públicas em que o atleta ainda não está — entrar de novo não faz sentido.
  const paraEntrar = publicCrews.filter((c) => !meusIds.has(c.crewId));

  function submeter(e) {
    e.preventDefault();
    const limpo = nome.trim().slice(0, NOME_MAX);
    if (!limpo) return;
    onCreate?.({ name: limpo });
    setNome('');
    setCriando(false);
  }

  if (isLoading) return <V2Skeleton className={cn('h-40 rounded-4xl', className)} />;

  return (
    <div className={cn('space-y-4', className)} data-testid="crews-panel">
      <V2Surface>
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="font-display text-base font-bold text-ink">Minhas crews</h3>
          {!criando && (
            <V2Button variant="secondary" size="sm" onClick={() => setCriando(true)} data-testid="crew-new-btn">
              <Plus className="h-4 w-4" aria-hidden="true" /> Criar crew
            </V2Button>
          )}
        </div>

        {criando && (
          <form onSubmit={submeter} className="mb-4 space-y-3" data-testid="crew-form">
            <V2Field label="Nome da crew" htmlFor="crew-nome" hint={`Até ${NOME_MAX} caracteres.`}>
              <V2Input
                id="crew-nome"
                value={nome}
                maxLength={NOME_MAX}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex.: Turma da manhã"
                autoFocus
              />
            </V2Field>
            <div className="flex gap-2">
              <V2Button type="submit" disabled={!nome.trim() || isBusy}>
                {isBusy ? 'Criando…' : 'Criar'}
              </V2Button>
              <V2Button type="button" variant="ghost" onClick={() => { setCriando(false); setNome(''); }}>
                Cancelar
              </V2Button>
            </div>
          </form>
        )}

        {error && <p className="mb-3 text-sm font-medium text-red-500" role="alert">{error}</p>}

        {myCrews.length === 0 ? (
          <V2EmptyState
            icon={Users}
            title="Você ainda não está numa crew"
            description="Crew é seu grupo fixo de jogo. Crie a sua ou entre em uma pública abaixo."
          />
        ) : (
          <ul className="space-y-2">
            {myCrews.map((c) => (
              <li
                key={c.crewId}
                data-testid="my-crew-item"
                data-crew-id={c.crewId}
                className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-paper-pure p-3"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-green-100 text-green-700">
                  <Users className="h-4 w-4" aria-hidden="true" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 truncate text-sm font-semibold text-ink">
                    {c.name}
                    {c.createdBy === uid && (
                      <Crown className="h-3.5 w-3.5 text-amber-500" aria-label="Você criou esta crew" />
                    )}
                  </p>
                  <p className="text-xs text-gray-500">
                    {c.membersCount}/{CREW_MAX_MEMBERS} membros
                    {c.totalXp > 0 && ` · ${c.totalXp.toLocaleString('pt-BR')} XP`}
                  </p>
                </div>
                {/* Quem criou não pode sair sem transferir a posse — o service
                    recusa, então nem oferecemos o botão. */}
                {c.createdBy !== uid && (
                  <V2Button
                    variant="ghost"
                    size="sm"
                    disabled={isBusy}
                    onClick={() => onLeave?.(c.crewId)}
                    data-testid="crew-leave-btn"
                  >
                    <LogOut className="h-4 w-4" aria-hidden="true" /> Sair
                  </V2Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </V2Surface>

      <V2Surface>
        <h3 className="mb-3 font-display text-base font-bold text-ink">Crews abertas</h3>
        {paraEntrar.length === 0 ? (
          <p className="text-sm text-gray-500">Nenhuma crew pública disponível agora.</p>
        ) : (
          <ul className="space-y-2">
            {paraEntrar.map((c) => {
              const lotada = c.membersCount >= CREW_MAX_MEMBERS;
              return (
                <li
                  key={c.crewId}
                  data-testid="public-crew-item"
                  data-crew-id={c.crewId}
                  className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-paper-pure p-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink">{c.name}</p>
                    <p className="text-xs text-gray-500">{c.membersCount}/{CREW_MAX_MEMBERS} membros</p>
                  </div>
                  {lotada ? (
                    <V2Badge tone="neutral">Lotada</V2Badge>
                  ) : (
                    <V2Button
                      variant="secondary"
                      size="sm"
                      disabled={isBusy}
                      onClick={() => onJoin?.(c.crewId)}
                      data-testid="crew-join-btn"
                    >
                      Entrar
                    </V2Button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </V2Surface>
    </div>
  );
}
