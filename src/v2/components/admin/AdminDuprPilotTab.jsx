/**
 * Piloto do DUPR (Painel admin → DUPR → Piloto) — só o admin da plataforma.
 *
 * Um ambiente de teste fechado: jogadores que existem SÓ aqui e partidas de
 * teste que vão ao DUPR de teste (UAT) de verdade. Nada daqui aparece para
 * outra pessoa, nem entra em ranking, perfil ou exportação: o servidor
 * (`functions/duprPilot.js`) só escreve `dupr_pilot_players`,
 * `dupr_pilot_matches` e a auditoria. Funciona com a flag desligada.
 *
 * O jogador nasce com nome e, se quiser, o e-mail da conta de teste; o ID DUPR
 * entra depois (conferido no DUPR) ou é gerado pelo convite do DUPR, quando a
 * plataforma tiver essa permissão.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { FlaskConical, Link2, Plus, RefreshCw, Send, Trash2, UserPlus } from 'lucide-react';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { usePilotAction, usePilotMatches, usePilotPlayers, usePilotSsoConfig } from '@/modules/rating/hooks/useDuprPilot';
import { originOf, parseSsoMessage } from '@/modules/rating/domain/duprSso';
import { todayISO, formatDateShortBR } from '@/modules/arenas/domain/calendar';
import {
  V2Badge, V2Button, V2EmptyState, V2ErrorState, V2Field, V2Input, V2Select, V2Skeleton, V2Surface,
} from '@/v2/ui/primitives';
import { t, tk, fmtNumero } from '@/core/i18n';

const VAZIO = { id: '', name: '', email: '', duprId: '' };
const nota = (n) => (n == null ? '—' : fmtNumero(n, { minimumFractionDigits: 3, maximumFractionDigits: 3 }));

export default function AdminDuprPilotTab() {
  const players = usePilotPlayers();
  const matches = usePilotMatches();
  const acao = usePilotAction();

  async function rodar(payload, ok) {
    try {
      const r = await acao.mutateAsync(payload);
      if (ok) toast.success(ok);
      return r;
    } catch (err) {
      toast.error(err?.message || t('Não foi possível falar com o DUPR agora. Tente de novo em instantes.'));
      return null;
    }
  }

  return (
    <div className="space-y-6" data-dica="admin-dupr-piloto">
      <V2Surface className="space-y-2">
        <h2 className="flex items-center gap-2 font-display text-lg font-bold text-ink">
          <FlaskConical className="h-5 w-5" /> {t('Piloto do DUPR')}
        </h2>
        <p className="text-sm text-gray-500">
          {t('Um ambiente de teste fechado, só do admin. Os jogadores e as partidas daqui existem só no piloto: não aparecem para ninguém e não entram em ranking, perfil nem exportação. As partidas vão ao DUPR de teste (UAT) de verdade, e o piloto funciona mesmo com a integração desligada.')}
        </p>
        <p className="text-sm text-gray-500">
          {t('Crie os jogadores agora, só com o nome. Quando as contas de teste (com e-mail) existirem no DUPR, informe o ID DUPR de cada uma no jogador correspondente.')}
        </p>
      </V2Surface>

      <PilotPlayers query={players} rodar={rodar} ocupado={acao.isPending} />
      <NewPilotMatch players={players.data} rodar={rodar} ocupado={acao.isPending} />
      <PilotMatches query={matches} rodar={rodar} ocupado={acao.isPending} />
    </div>
  );
}

function PilotPlayers({ query, rodar, ocupado }) {
  const [form, setForm] = useState(VAZIO);
  const [remover, setRemover] = useState(null);
  const [autorizando, setAutorizando] = useState(null);
  const editando = Boolean(form.id);

  async function salvar(e) {
    e.preventDefault();
    const r = await rodar({ acao: 'player_save', ...form }, editando ? t('Jogador atualizado.') : t('Jogador criado no piloto.'));
    if (r) setForm(VAZIO);
  }

  return (
    <V2Surface className="space-y-4">
      <h3 className="font-display text-base font-bold text-ink">{t('Jogadores do piloto')}</h3>
      <p className="text-sm text-gray-500">
        {t('O DUPR só mostra uma conta depois que ela autoriza a plataforma. Em cada jogador, toque em "Autorizar pelo login do DUPR" e entre com a conta de teste DELE: o ID vem do próprio DUPR. Entre um jogador e outro, saia da conta no quadro do DUPR.')}
      </p>
      {autorizando && (
        <PilotSsoFrame
          player={autorizando}
          onCancel={() => setAutorizando(null)}
          onLogin={async (dados) => {
            setAutorizando(null);
            await rodar({ acao: 'player_sso', id: autorizando.id, accessToken: dados.accessToken }, t('Conta autorizada no DUPR.'));
          }}
        />
      )}

      {query.isLoading && <V2Skeleton className="h-24 rounded-3xl" />}
      {query.isError && <V2ErrorState inline title={t('Os jogadores do piloto não carregaram')} description="" onRetry={() => query.refetch()} />}
      {query.isSuccess && query.data.length === 0 && (
        <V2EmptyState icon={UserPlus} title={t('Nenhum jogador no piloto ainda')} description={t('Crie pelo menos dois (simples) ou quatro (duplas) para enviar uma partida de teste.')} />
      )}
      {query.isSuccess && query.data.length > 0 && (
        <ul className="divide-y divide-gray-100">
          {query.data.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center gap-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-ink">{p.name}</p>
                <p className="text-xs text-gray-500">
                  {[p.email, p.dupr_id ? t('DUPR {id}', { id: p.dupr_id }) : null].filter(Boolean).join(' · ') || t('Sem e-mail')}
                  {p.dupr_id && ` · ${t('Simples {s} · Duplas {d}', { s: nota(p.ratings?.singles), d: nota(p.ratings?.doubles) })}`}
                </p>
              </div>
              {!p.dupr_id
                ? <V2Badge tone="amber">{t('Aguardando conta DUPR')}</V2Badge>
                : p.status === 'consent'
                  ? <V2Badge tone="amber">{t('Falta autorizar no DUPR')}</V2Badge>
                  : <V2Badge tone="green">{t('Pronto')}</V2Badge>}
              <div className="flex flex-wrap gap-2">
                {(!p.dupr_id || p.status === 'consent') && (
                  <V2Button type="button" size="sm" disabled={ocupado} onClick={() => setAutorizando(p)}>
                    <Link2 className="h-3.5 w-3.5" /> {t('Autorizar pelo login do DUPR')}
                  </V2Button>
                )}
                <V2Button type="button" size="sm" variant="subtle" onClick={() => setForm({ id: p.id, name: p.name || '', email: p.email || '', duprId: p.dupr_id || '' })}>{t('Editar')}</V2Button>
                {p.dupr_id && (
                  <V2Button type="button" size="sm" variant="subtle" disabled={ocupado} onClick={() => rodar({ acao: 'player_refresh', id: p.id }, t('Ratings atualizados.'))}>
                    <RefreshCw className="h-3.5 w-3.5" /> {t('Atualizar')}
                  </V2Button>
                )}
                {!p.dupr_id && p.email && (
                  <V2Button type="button" size="sm" variant="subtle" disabled={ocupado} onClick={() => rodar({ acao: 'player_invite', id: p.id }, t('Conta criada no DUPR.'))}>
                    {t('Criar conta no DUPR')}
                  </V2Button>
                )}
                <V2Button type="button" size="sm" variant="ghost" aria-label={t('Remover {nome}', { nome: p.name })} onClick={() => setRemover(p)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </V2Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={salvar} className="grid gap-3 border-t border-gray-100 pt-4 sm:grid-cols-3">
        <p className="text-sm font-semibold text-ink sm:col-span-3">{editando ? t('Editar jogador') : t('Novo jogador')}</p>
        <V2Field label={t('Nome')} htmlFor="piloto-nome" required>
          <V2Input id="piloto-nome" value={form.name} maxLength={80} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </V2Field>
        <V2Field label={t('E-mail da conta de teste')} htmlFor="piloto-email" hint={t('Opcional.')}>
          <V2Input id="piloto-email" type="email" value={form.email} maxLength={120} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </V2Field>
        <V2Field label={t('ID DUPR')} htmlFor="piloto-dupr" hint={t('Opcional. Conferido no DUPR ao salvar.')}>
          <V2Input id="piloto-dupr" value={form.duprId} maxLength={20} onChange={(e) => setForm({ ...form, duprId: e.target.value })} />
        </V2Field>
        <div className="flex flex-wrap justify-end gap-2 sm:col-span-3">
          {editando && <V2Button type="button" variant="ghost" onClick={() => setForm(VAZIO)}>{t('Cancelar')}</V2Button>}
          <V2Button type="submit" disabled={ocupado || form.name.trim().length < 2}>
            {editando ? t('Salvar') : <><Plus className="h-4 w-4" /> {t('Criar jogador')}</>}
          </V2Button>
        </div>
      </form>

      <ConfirmDialog
        open={Boolean(remover)}
        onOpenChange={(v) => { if (!v) setRemover(null); }}
        title={t('Remover {nome} do piloto?', { nome: remover?.name || '' })}
        description={t('Só sai do piloto. A conta no DUPR e as partidas já enviadas continuam lá.')}
        confirmLabel={t('Remover')}
        destructive
        onConfirm={async () => { await rodar({ acao: 'player_remove', id: remover.id }, t('Jogador removido do piloto.')); setRemover(null); }}
      />
    </V2Surface>
  );
}

const JOGO_VAZIO = { a: '', b: '' };

/**
 * O login do DUPR (SSO) dentro do painel, para autorizar a conta de teste de um
 * jogador. Só a mensagem do quadro do DUPR, da origem do DUPR, é aceita
 * (`parseSsoMessage`); o token segue direto ao servidor e não é guardado.
 */
function PilotSsoFrame({ player, onLogin, onCancel }) {
  const config = usePilotSsoConfig();
  const frameRef = useRef(null);
  const ssoUrl = config.data?.ssoUrl || '';
  const ssoOrigin = useMemo(() => originOf(ssoUrl), [ssoUrl]);
  const aoEntrar = useRef(onLogin);
  aoEntrar.current = onLogin;

  useEffect(() => {
    if (!ssoOrigin) return undefined;
    const onMessage = (event) => {
      const dados = parseSsoMessage(event, { ssoOrigin, frameWindow: frameRef.current?.contentWindow });
      if (dados) aoEntrar.current(dados);
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [ssoOrigin]);

  return (
    <div className="space-y-2 rounded-2xl border border-gray-100 bg-paper p-4">
      <p className="text-sm font-semibold text-ink">{t('Entre no DUPR com a conta de teste de {nome}', { nome: player.name })}</p>
      {player.email && <p className="text-xs text-gray-500">{t('E-mail da conta: {email}', { email: player.email })}</p>}
      {config.isPending && <V2Skeleton className="h-40 rounded-xl" />}
      {config.isError && <V2ErrorState inline title={t('O login do DUPR não abriu')} description={config.error?.message || ''} onRetry={() => config.refetch()} />}
      {ssoUrl && (
        <iframe
          ref={frameRef}
          title={t('Login no DUPR')}
          src={ssoUrl}
          className="h-[480px] w-full rounded-xl border border-gray-100 bg-white"
          referrerPolicy="strict-origin"
        />
      )}
      <V2Button type="button" variant="ghost" size="sm" onClick={onCancel}>{t('Cancelar')}</V2Button>
    </div>
  );
}

function NewPilotMatch({ players, rodar, ocupado }) {
  const prontos = useMemo(() => (players || []).filter((p) => p.dupr_id), [players]);
  const [duplas, setDuplas] = useState(true);
  const [lados, setLados] = useState({ a1: '', a2: '', b1: '', b2: '' });
  const [games, setGames] = useState([{ ...JOGO_VAZIO }]);
  const [date, setDate] = useState(todayISO());
  const [event, setEvent] = useState('Piloto PickleRush');
  const [matchType, setMatchType] = useState('SIDEOUT');

  const vagas = duplas ? ['a1', 'a2', 'b1', 'b2'] : ['a1', 'b1'];
  const minimo = duplas ? 4 : 2;
  const opcoes = [{ value: '', label: t('Escolha') }, ...prontos.map((p) => ({ value: p.id, label: p.name }))];
  const completa = vagas.every((v) => lados[v]) && games.every((g) => g.a !== '' && g.b !== '');

  async function enviar(e) {
    e.preventDefault();
    const r = await rodar({
      acao: 'match_send',
      sideA: duplas ? [lados.a1, lados.a2] : [lados.a1],
      sideB: duplas ? [lados.b1, lados.b2] : [lados.b1],
      games: games.map((g) => ({ a: Number(g.a), b: Number(g.b) })),
      date, event, matchType,
    });
    if (!r) return;
    if (r.status === 'sent') {
      toast.success(t('Partida enviada ao DUPR.'));
      setGames([{ ...JOGO_VAZIO }]);
    } else toast.error(t('O DUPR recusou a partida: {motivo}', { motivo: r.error || '' }));
  }

  const rotulo = { a1: t('Lado A — jogador 1'), a2: t('Lado A — jogador 2'), b1: t('Lado B — jogador 1'), b2: t('Lado B — jogador 2') };
  if (!duplas) { rotulo.a1 = t('Lado A'); rotulo.b1 = t('Lado B'); }

  return (
    <V2Surface className="space-y-4">
      <h3 className="font-display text-base font-bold text-ink">{t('Enviar partida de teste')}</h3>
      {prontos.length < minimo ? (
        <p className="text-sm text-gray-500">
          {t('Faltam jogadores com ID DUPR: são {n} para uma partida de {formato}.', { n: minimo, formato: duplas ? t('duplas') : t('simples') })}
          {' '}
          <button type="button" className="font-semibold text-ink underline" onClick={() => setDuplas(!duplas)}>
            {duplas ? t('Testar simples') : t('Testar duplas')}
          </button>
        </p>
      ) : null}
      <form onSubmit={enviar} className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <V2Field label={t('Formato')} htmlFor="piloto-formato">
            <V2Select id="piloto-formato" value={duplas ? 'd' : 's'} onChange={(e) => setDuplas(e.target.value === 'd')} options={[{ value: 'd', label: t('Duplas') }, { value: 's', label: t('Simples') }]} />
          </V2Field>
          <V2Field label={t('Data da partida')} htmlFor="piloto-data">
            <V2Input id="piloto-data" type="date" value={date} max={todayISO()} onChange={(e) => setDate(e.target.value)} />
          </V2Field>
          <V2Field label={t('Contagem de pontos')} htmlFor="piloto-tipo">
            <V2Select id="piloto-tipo" value={matchType} onChange={(e) => setMatchType(e.target.value)} options={[{ value: 'SIDEOUT', label: t('Com vantagem (side-out)') }, { value: 'RALLY', label: t('Ponto corrido (rally)') }]} />
          </V2Field>
        </div>
        <V2Field label={t('Nome do evento')} htmlFor="piloto-evento">
          <V2Input id="piloto-evento" value={event} maxLength={80} onChange={(e) => setEvent(e.target.value)} />
        </V2Field>
        <div className="grid gap-3 sm:grid-cols-2">
          {vagas.map((v) => (
            <V2Field key={v} label={rotulo[v]} htmlFor={`piloto-${v}`}>
              <V2Select id={`piloto-${v}`} value={lados[v]} onChange={(e) => setLados({ ...lados, [v]: e.target.value })} options={opcoes} />
            </V2Field>
          ))}
        </div>
        <div className="space-y-2">
          <p className="text-sm font-semibold text-ink">{t('Placar por game (Lado A × Lado B)')}</p>
          {games.map((g, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="w-16 text-xs font-semibold text-gray-500">{t('Game {n}', { n: i + 1 })}</span>
              <V2Input aria-label={t('Game {n}, lado A', { n: i + 1 })} type="number" min={0} max={99} className="w-20" value={g.a} onChange={(e) => setGames(games.map((x, j) => (j === i ? { ...x, a: e.target.value } : x)))} />
              <span className="text-gray-500">×</span>
              <V2Input aria-label={t('Game {n}, lado B', { n: i + 1 })} type="number" min={0} max={99} className="w-20" value={g.b} onChange={(e) => setGames(games.map((x, j) => (j === i ? { ...x, b: e.target.value } : x)))} />
              {games.length > 1 && (
                <V2Button type="button" size="sm" variant="ghost" aria-label={t('Tirar o game {n}', { n: i + 1 })} onClick={() => setGames(games.filter((_, j) => j !== i))}>
                  <Trash2 className="h-3.5 w-3.5" />
                </V2Button>
              )}
            </div>
          ))}
          {games.length < 5 && (
            <V2Button type="button" size="sm" variant="subtle" onClick={() => setGames([...games, { ...JOGO_VAZIO }])}>
              <Plus className="h-3.5 w-3.5" /> {t('Mais um game')}
            </V2Button>
          )}
        </div>
        <div className="flex justify-end">
          <V2Button type="submit" disabled={ocupado || !completa}>
            <Send className="h-4 w-4" /> {t('Enviar ao DUPR (teste)')}
          </V2Button>
        </div>
      </form>
    </V2Surface>
  );
}

const STATUS = {
  sent: { tone: 'green', label: tk('Enviada') },
  failed: { tone: 'red', label: tk('Recusada') },
  deleted: { tone: 'neutral', label: tk('Apagada no DUPR') },
};

function PilotMatches({ query, rodar, ocupado }) {
  const [apagar, setApagar] = useState(null);
  const nomes = (lado) => (lado || []).map((p) => p.name).join(' / ');
  const placar = (m) => {
    const a = m.payload?.teamA || {}; const b = m.payload?.teamB || {};
    return [1, 2, 3, 4, 5].filter((i) => a[`game${i}`] != null).map((i) => `${a[`game${i}`]}–${b[`game${i}`]}`).join(', ');
  };

  return (
    <V2Surface className="space-y-4">
      <h3 className="font-display text-base font-bold text-ink">{t('Partidas de teste')}</h3>
      {query.isLoading && <V2Skeleton className="h-24 rounded-3xl" />}
      {query.isError && <V2ErrorState inline title={t('As partidas de teste não carregaram')} description="" onRetry={() => query.refetch()} />}
      {query.isSuccess && query.data.length === 0 && <p className="text-sm text-gray-500">{t('Nenhuma partida de teste enviada ainda.')}</p>}
      {query.isSuccess && query.data.length > 0 && (
        <ul className="divide-y divide-gray-100">
          {query.data.map((m) => {
            const s = STATUS[m.status] || STATUS.failed;
            return (
              <li key={m.id} className="flex flex-wrap items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-ink">{nomes(m.side_a)} × {nomes(m.side_b)}</p>
                  <p className="text-xs text-gray-500">
                    {[m.payload?.matchDate ? formatDateShortBR(m.payload.matchDate) : null, placar(m), m.match_code ? t('código {c}', { c: m.match_code }) : null].filter(Boolean).join(' · ')}
                  </p>
                  {m.error && <p className="mt-1 text-xs text-red-600">{m.error}</p>}
                </div>
                <V2Badge tone={s.tone}>{t(s.label)}</V2Badge>
                {m.status !== 'deleted' && (
                  <V2Button type="button" size="sm" variant="ghost" disabled={ocupado} onClick={() => setApagar(m)}>
                    <Trash2 className="h-3.5 w-3.5" /> {m.status === 'sent' ? t('Apagar no DUPR') : t('Tirar da lista')}
                  </V2Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <ConfirmDialog
        open={Boolean(apagar)}
        onOpenChange={(v) => { if (!v) setApagar(null); }}
        title={apagar?.status === 'sent' ? t('Apagar esta partida no DUPR?') : t('Tirar esta partida da lista?')}
        description={apagar?.status === 'sent' ? t('O DUPR desfaz a partida e recalcula os ratings de teste.') : t('Ela nunca chegou ao DUPR.')}
        confirmLabel={t('Confirmar')}
        destructive
        onConfirm={async () => { await rodar({ acao: 'match_delete', id: apagar.id }, t('Pronto.')); setApagar(null); }}
      />
    </V2Surface>
  );
}
