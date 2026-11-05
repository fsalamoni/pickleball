/**
 * ⭐ O SELETOR DE PESSOAS da plataforma — UM só, em toda funcionalidade que
 * escolhe usuário (dupla, convidado, organizador, membro, aluno, equipe da
 * federação…). Padrão fixo (docs/07-DESIGN-STANDARD.md §3.2):
 *
 *  - a LISTA aparece já aberta, em ordem alfabética, com foto, nome e cidade;
 *    a busca (nome ou cidade, sem acento) só ESTREITA — nunca uma busca cega
 *    em que a pessoa tem de adivinhar o nome antes de ver alguém;
 *  - quem não pode ser escolhido aparece COM O MOTIVO, sem botão (`excluir`);
 *    quem não deve nem aparecer (a própria pessoa) sai por `ocultar`;
 *  - `sugestoes` vêm antes da lista ("Com quem você já jogou"), um toque escolhe;
 *  - lista que FALHOU é dita, com "Tentar de novo" — nunca "ninguém encontrado"
 *    (docs/27-FALHA-NAO-E-VAZIO.md);
 *  - três modos: um (`selecionados` com 0–1, mostra o escolhido com "Trocar"),
 *    vários (`multiple`, com os escolhidos em fichas) e AÇÃO (`onEscolher` +
 *    `rotuloAcao`: cada linha é um botão, ex. "Inserir", sem estado de seleção).
 *
 * Fonte: `pessoas` (lista própria: membros do clube, participantes do dia…) ou,
 * sem ela, o diretório de atletas (`diretorio="listados"`, padrão) ou todos os
 * perfis (`diretorio="todos"`, telas de gestão). O item volta como veio.
 *
 * ⚠️ Nunca escreva outro seletor de pessoas numa tela: embrulhe este
 * (guarda `src/core/guards/seletorDePessoas.test.js`).
 */
import React, { useMemo, useState } from 'react';
import { Check, Plus, X } from 'lucide-react';
import { useAllAthletes, useAthletes } from '@/modules/athletes/hooks/useAthletes';
import { V2Avatar, V2Badge, V2Button, V2ErrorState, V2SearchInput, V2Skeleton } from '@/v2/ui/primitives';
import { t, tn } from '@/core/i18n';

const LIMITE = 50;
const normaliza = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** O id de uma pessoa, venha de onde vier (perfil, membro, participante). */
// A conta vem antes do id do documento: num membro ou participante, `id` é o
// do documento e `user_id` é a pessoa.
const idDaPessoa = (p) => p?.user_id || p?.uid || p?.id || null;
/** O nome a mostrar. */
const nomeDaPessoa = (p) => p?.platform_name || p?.full_name || p?.display_name || p?.name || p?.user_name || '';
const fotoDe = (p) => p?.photo_url || p?.photo || null;
const ondeMora = (p) => (p?.city ? `${p.city}${p.state ? `/${p.state}` : ''}` : '');

/**
 * @param {{
 *   id?: string, multiple?: boolean, selecionados?: object[], onChange?: (lista: object[]) => void,
 *   onEscolher?: (pessoa: object) => void, rotuloAcao?: string,
 *   excluir?: Map<string, string>, ocultar?: Iterable<string>, max?: number,
 *   pessoas?: object[], carregando?: boolean, falhou?: boolean, onRetry?: () => void,
 *   diretorio?: 'listados'|'todos',
 *   sugestoes?: object[], tituloSugestoes?: string,
 *   detalhe?: (pessoa: object) => string, dicaEscolhido?: string,
 *   vazio?: string, placeholder?: string, rotulo?: string, primeiro?: (pessoa: object) => boolean, tituloFalha?: string,
 * }} props
 */
export default function PersonPicker(props) {
  if (Array.isArray(props.pessoas)) return <Lista {...props} />;
  return props.diretorio === 'todos' ? <DiretorioTodos {...props} /> : <Diretorio {...props} />;
}

// A fonte é escolhida por componente (nunca um hook condicional): só o
// diretório pedido é lido.
function Diretorio(props) {
  const q = useAthletes();
  return <Lista {...props} pessoas={q.data || []} carregando={q.isLoading} falhou={q.isError} onRetry={() => q.refetch()} />;
}

function DiretorioTodos(props) {
  const q = useAllAthletes();
  return <Lista {...props} pessoas={q.data || []} carregando={q.isLoading} falhou={q.isError} onRetry={() => q.refetch()} />;
}

function Lista({
  id, multiple = false, selecionados = [], onChange, onEscolher, rotuloAcao,
  excluir = new Map(), ocultar = [], max = Infinity,
  pessoas, carregando = false, falhou = false, onRetry,
  sugestoes = [], tituloSugestoes, detalhe = ondeMora, dicaEscolhido,
  vazio, placeholder, rotulo, primeiro, tituloFalha,
}) {
  const fonte = pessoas;
  const estaCarregando = carregando;
  const estaFalhando = falhou;
  const tentar = onRetry;

  const [busca, setBusca] = useState('');
  const fora = useMemo(() => new Set(Array.from(ocultar || []).filter(Boolean)), [ocultar]);
  const todos = useMemo(() => (fonte || [])
    .filter((p) => p && p.hidden !== true && nomeDaPessoa(p) && !fora.has(idDaPessoa(p)))
    // `primeiro`: quem vem antes (ex.: quem confirmou presença), depois a ordem alfabética.
    .sort((a, b) => (primeiro ? Number(Boolean(primeiro(b))) - Number(Boolean(primeiro(a))) : 0)
      || nomeDaPessoa(a).localeCompare(nomeDaPessoa(b), 'pt-BR')), [fonte, fora, primeiro]);
  const termo = normaliza(busca.trim());
  const achados = useMemo(() => (termo ? todos.filter((p) => normaliza(`${nomeDaPessoa(p)} ${p.city || ''}`).includes(termo)) : todos), [todos, termo]);
  const ids = new Set(selecionados.map(idDaPessoa));
  const cheio = multiple && selecionados.length >= max;
  const recentes = (sugestoes || []).filter((p) => !fora.has(idDaPessoa(p)) && !excluir.has(idDaPessoa(p)) && !ids.has(idDaPessoa(p))).slice(0, 6);

  const escolher = (p) => {
    if (onEscolher) { onEscolher(p); return; }
    const pid = idDaPessoa(p);
    if (!multiple) { onChange?.(ids.has(pid) ? [] : [p]); return; }
    onChange?.(ids.has(pid) ? selecionados.filter((x) => idDaPessoa(x) !== pid) : [...selecionados, p]);
  };

  // Um só, já escolhido: mostra quem é, com a troca.
  if (!multiple && !onEscolher && selecionados[0]) {
    const p = selecionados[0];
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-acid/40 bg-acid/10 px-3 py-2">
        <V2Avatar name={nomeDaPessoa(p)} photoUrl={fotoDe(p)} size="sm" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-ink">{nomeDaPessoa(p)}</span>
          {(dicaEscolhido || detalhe(p)) && <span className="block truncate text-xs text-gray-500">{dicaEscolhido || detalhe(p)}</span>}
        </span>
        <V2Button type="button" size="sm" variant="ghost" onClick={() => onChange?.([])}>{t('Trocar')}</V2Button>
      </div>
    );
  }

  if (estaFalhando) return <V2ErrorState inline title={tituloFalha || t('Não carregou a lista de pessoas')} description={t('Sem a lista não dá para saber quem já tem conta.')} onRetry={tentar} />;
  if (estaCarregando) return <V2Skeleton lines={4} />;

  return (
    <div className="space-y-2">
      {multiple && selecionados.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label={t('Pessoas escolhidas')}>
          {selecionados.map((p) => (
            <li key={idDaPessoa(p)}>
              <button type="button" onClick={() => escolher(p)} className="inline-flex items-center gap-1.5 rounded-full bg-acid/25 px-3 py-1 text-sm font-semibold text-ink hover:bg-acid/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink" aria-label={t('Tirar {nome}', { nome: nomeDaPessoa(p) })}>
                <V2Avatar name={nomeDaPessoa(p)} photoUrl={fotoDe(p)} size="xs" />
                {nomeDaPessoa(p)}<X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {recentes.length > 0 && !termo && (
        <div className="space-y-1">
          <p className="text-xs font-semibold text-gray-600">{tituloSugestoes || t('Com quem você já jogou')}</p>
          <div className="flex flex-wrap gap-2">
            {recentes.map((p) => (
              <button type="button" key={idDaPessoa(p)} onClick={() => escolher(p)} disabled={cheio}
                className="flex items-center gap-2 rounded-full border border-gray-100 bg-paper-pure px-2 py-1 text-left text-sm hover:border-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-ink disabled:opacity-50 coarse:min-h-11">
                <V2Avatar name={nomeDaPessoa(p)} photoUrl={fotoDe(p)} size="xs" />
                <span className="truncate">{nomeDaPessoa(p)}</span>
                {p.together > 0 && <span className="text-xs text-gray-500">{tn(p.together, '{n} vez', '{n} vezes')}</span>}
              </button>
            ))}
          </div>
        </div>
      )}
      <V2SearchInput id={id} value={busca} onChange={(e) => setBusca(e.target.value)} placeholder={placeholder || t('Filtrar por nome ou cidade')} aria-label={rotulo || t('Filtrar pessoas')} />
      <p className="text-xs text-gray-500">
        {termo ? tn(achados.length, '{n} pessoa encontrada', '{n} pessoas encontradas') : tn(todos.length, '{n} pessoa na lista', '{n} pessoas na lista')}
        {achados.length > LIMITE ? ` · ${t('mostrando as {n} primeiras; filtre para achar as outras', { n: LIMITE })}` : ''}
      </p>
      {achados.length === 0 ? <p className="text-sm text-gray-500">{vazio || t('Ninguém com esse nome ou cidade.')}</p> : (
        <ul className="max-h-80 divide-y divide-gray-100 overflow-y-auto rounded-2xl border border-gray-100" aria-label={rotulo || t('Pessoas')}>
          {achados.slice(0, LIMITE).map((p) => {
            const pid = idDaPessoa(p);
            const motivo = excluir.get(pid);
            const escolhido = !onEscolher && ids.has(pid);
            const bloqueado = Boolean(motivo) || (cheio && !escolhido);
            const sub = detalhe(p);
            return (
              <li key={pid}>
                <button type="button"
                  disabled={bloqueado}
                  aria-pressed={onEscolher ? undefined : escolhido}
                  onClick={() => escolher(p)}
                  className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-paper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ink disabled:cursor-not-allowed disabled:hover:bg-transparent coarse:min-h-11"
                >
                  <V2Avatar name={nomeDaPessoa(p)} photoUrl={fotoDe(p)} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className={`block truncate text-sm ${bloqueado ? 'text-gray-500' : 'text-ink'}`}>{nomeDaPessoa(p)}</span>
                    {sub && <span className="block truncate text-xs text-gray-500">{sub}</span>}
                  </span>
                  {motivo ? <V2Badge tone="neutral">{motivo}</V2Badge>
                    : escolhido ? <Check className="h-4 w-4 text-ink" aria-hidden="true" />
                      : onEscolher ? <span className="inline-flex items-center gap-1 text-xs font-semibold text-ink"><Plus className="h-3.5 w-3.5" aria-hidden="true" />{rotuloAcao || t('Escolher')}</span> : null}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
