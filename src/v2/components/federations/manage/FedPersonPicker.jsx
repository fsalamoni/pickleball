/**
 * Escolher pessoas na LISTA DE USUÁRIOS da plataforma (os perfis de atleta),
 * para nomear na equipe ou convidar para filiar. A lista aparece já aberta,
 * em ordem alfabética, e a busca (nome ou cidade) só estreita. Quem não pode
 * ser escolhido aparece com o motivo, sem botão — sumir calado faria a
 * secretaria achar que a pessoa não tem conta.
 *
 * `multiple`: vários de uma vez (convite); sem ele, um só (equipe).
 * `excluir`: Map uid → motivo (ex.: "já na equipe", "já filiado").
 */
import React, { useMemo, useState } from 'react';
import { Check, X } from 'lucide-react';
import { useAllAthletes } from '@/modules/athletes/hooks/useAthletes';
import { V2Avatar, V2Badge, V2Button, V2ErrorState, V2SearchInput, V2Skeleton } from '@/v2/ui/primitives';
import { t, tn } from '@/core/i18n';

const LIMITE = 50;
const normaliza = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const nomeDaPessoa = (a) => a?.platform_name || a?.full_name || a?.display_name || '';

export default function FedPersonPicker({ id, multiple = false, selecionados = [], onChange, excluir = new Map(), max = Infinity }) {
  const atletas = useAllAthletes();
  const [busca, setBusca] = useState('');
  const todos = useMemo(() => (atletas.data || [])
    .filter((a) => a.hidden !== true && nomeDaPessoa(a))
    .sort((a, b) => nomeDaPessoa(a).localeCompare(nomeDaPessoa(b), 'pt-BR')), [atletas.data]);
  const termo = normaliza(busca.trim());
  const achados = useMemo(() => (termo ? todos.filter((a) => normaliza(`${nomeDaPessoa(a)} ${a.city || ''}`).includes(termo)) : todos), [todos, termo]);
  const ids = new Set(selecionados.map((a) => a.id));
  const cheio = multiple && selecionados.length >= max;

  const alternar = (a) => {
    if (!multiple) { onChange(ids.has(a.id) ? [] : [a]); return; }
    onChange(ids.has(a.id) ? selecionados.filter((x) => x.id !== a.id) : [...selecionados, a]);
  };

  if (atletas.isError) return <V2ErrorState inline title={t('Não carregou a lista de usuários')} onRetry={() => atletas.refetch()} />;
  if (atletas.isLoading) return <V2Skeleton lines={4} />;

  // Um só, já escolhido: mostra quem é, com a troca.
  if (!multiple && selecionados[0]) {
    const a = selecionados[0];
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-paper px-3 py-2">
        <V2Avatar name={nomeDaPessoa(a)} photoUrl={a.photo_url} size="sm" />
        <span className="min-w-0 flex-1 text-sm font-semibold text-ink">{nomeDaPessoa(a)}{a.city ? <span className="font-normal text-gray-500"> · {a.city}{a.state ? `/${a.state}` : ''}</span> : null}</span>
        <V2Button type="button" size="sm" variant="ghost" onClick={() => onChange([])}>{t('Trocar')}</V2Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {multiple && selecionados.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label={t('Pessoas escolhidas')}>
          {selecionados.map((a) => (
            <li key={a.id}>
              <button type="button" onClick={() => alternar(a)} className="inline-flex items-center gap-1.5 rounded-full bg-acid/25 px-3 py-1 text-sm font-semibold text-ink hover:bg-acid/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink" aria-label={t('Tirar {nome}', { nome: nomeDaPessoa(a) })}>
                {nomeDaPessoa(a)}<X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <V2SearchInput id={id} value={busca} onChange={(e) => setBusca(e.target.value)} placeholder={t('Filtrar por nome ou cidade')} aria-label={t('Filtrar usuários da plataforma')} />
      <p className="text-xs text-gray-500">
        {termo ? tn(achados.length, '{n} pessoa encontrada', '{n} pessoas encontradas') : tn(todos.length, '{n} pessoa na plataforma', '{n} pessoas na plataforma')}
        {achados.length > LIMITE ? ` · ${t('mostrando as {n} primeiras; filtre para achar as outras', { n: LIMITE })}` : ''}
      </p>
      {achados.length === 0 ? <p className="text-sm text-gray-500">{t('Ninguém com esse nome ou cidade. A pessoa precisa ter conta no PickleRush.')}</p> : (
        <ul className="max-h-80 divide-y divide-gray-100 overflow-y-auto rounded-2xl border border-gray-100" aria-label={t('Usuários da plataforma')}>
          {achados.slice(0, LIMITE).map((a) => {
            const motivo = excluir.get(a.id);
            const escolhido = ids.has(a.id);
            const bloqueado = Boolean(motivo) || (cheio && !escolhido);
            return (
              <li key={a.id}>
                <button type="button"
                  disabled={bloqueado}
                  aria-pressed={escolhido}
                  onClick={() => alternar(a)}
                  className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-paper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ink disabled:cursor-not-allowed disabled:hover:bg-transparent coarse:min-h-11"
                >
                  <V2Avatar name={nomeDaPessoa(a)} photoUrl={a.photo_url} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className={`block truncate text-sm ${bloqueado ? 'text-gray-500' : 'text-ink'}`}>{nomeDaPessoa(a)}</span>
                    {a.city && <span className="block truncate text-xs text-gray-500">{a.city}{a.state ? `/${a.state}` : ''}</span>}
                  </span>
                  {motivo ? <V2Badge tone="neutral">{motivo}</V2Badge> : escolhido ? <Check className="h-4 w-4 text-ink" aria-hidden="true" /> : null}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
