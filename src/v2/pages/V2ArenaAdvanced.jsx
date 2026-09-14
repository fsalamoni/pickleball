/**
 * V2ArenaAdvanced — as ferramentas avançadas da arena.
 *
 * Rota: `/arenas/:arenaId/gerir/avancado`
 * Módulos: `white_label` (+ `branding`), `multi_unit` (+ rede, BI, cross
 * booking), `ai` (+ preço, previsão) e `iot` (+ totem QR).
 *
 * ## 🐞 Três defeitos que faziam a tela mentir
 *
 * **1. A marca era gravada onde o atleta não pode ler.** `updateBranding`
 * escrevia em `arena_settings.branding`, e aquela coleção é
 * `allow read: if isArenaManager(...)`. A cor e o logo nunca teriam como
 * chegar à página pública — e nada no projeto sequer tentava lê-los. Agora vão
 * para `arenas/{id}.branding`, que é público, e a página da arena os usa.
 *
 * **2. A previsão era calculada sobre lista vazia.** `getHistoricalBookings`
 * era `return []` com o comentário "só para satisfazer a interface": o número
 * exibido era sempre zero, com cara de análise.
 *
 * **3. A rede não podia ser criada.** `arena_networks` só aceitava escrita do
 * admin da plataforma, e o módulo é oferecido à arena: ela ligava, abria a
 * tela, clicava e recebia permissão negada. E a lista mostrava **todas as
 * redes da plataforma** para qualquer conta.
 *
 * ## O que a tela NÃO faz
 *
 * O preço sugerido é **sugestão**: a arena aplica se quiser, no preço da
 * quadra. Um sistema que muda o preço sozinho, sem a arena ver, é o tipo de
 * automação que se descobre pelo cliente reclamando.
 */

import React, { useMemo, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import {
  AlertTriangle, ArrowLeft, Check, Cpu, Network, Palette, Plus, Sparkles,
  Trash2, TrendingUp, X,
} from 'lucide-react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useArena, useMyManagedArenas, useArenaCourts } from '@/modules/arenas/hooks/useArenas';
import {
  useArenaDevices, useCreateDevice,
  useMyNetworks, useArenaNetwork, useCreateNetwork, useAddArenaToNetwork,
  useRemoveArenaFromNetwork, useUpdateBranding, useLegacyBranding, useArenaHistory,
} from '@/modules/arenas/hooks/useArenaV3';
import { useArenaModules } from '@/modules/arenas/hooks/useArenaModules';
import { ARENA_MODULE_ID } from '@/modules/arenas/domain/modules';
import {
  DEVICE_KIND, calculateDynamicPrice, forecastDemand,
} from '@/modules/arenas/domain/arenaV3Advanced';
import { brandingOf, normalizeBranding, readableInk } from '@/modules/arenas/domain/whiteLabel';
import { resolveArenaPrice, formatPrice } from '@/modules/arenas/domain/pricing';
import { formatDateShortBR } from '@/modules/arenas/domain/calendar';
import ConfirmDialog from '@/components/ConfirmDialog';
import {
  V2Badge, V2Button, V2EmptyState, V2Field, V2Input, V2Skeleton, V2Surface,
} from '@/v2/ui/primitives';

const DEVICE_LABEL = {
  [DEVICE_KIND.QR_KIOSK]: 'Totem QR',
  [DEVICE_KIND.LIGHTING]: 'Iluminação',
  [DEVICE_KIND.PRESENCE_SENSOR]: 'Sensor de presença',
  [DEVICE_KIND.VIDEO_CAMERA]: 'Câmera',
  [DEVICE_KIND.HVAC]: 'Climatização',
};
const STATUS_TONE = { online: 'green', offline: 'neutral', fault: 'red', maintenance: 'amber' };

/* ==================================================== 1. WHITE LABEL ==== */

function MarcaSecao({ arena }) {
  const { data: legado } = useLegacyBranding(arena.id);
  const salvar = useUpdateBranding();
  const atual = brandingOf(arena);

  const [form, setForm] = useState(() => ({
    primary_color: arena?.branding?.primary_color || legado?.primary_color || '#0B0B0C',
    logo_url: arena?.branding?.logo_url || legado?.logo_url || '',
    tagline: arena?.branding?.tagline || legado?.tagline || '',
    active: arena?.branding?.active !== false,
  }));
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const previa = normalizeBranding(form);
  const tinta = readableInk(previa.value.primary_color);

  const submit = async (e) => {
    e.preventDefault();
    try {
      await salvar.mutateAsync({ arenaId: arena.id, branding: form });
      toast.success('Marca salva. Ela já aparece na página da arena.');
    } catch (err) {
      toast.error(err?.message || 'Não foi possível salvar.');
    }
  };

  return (
    <V2Surface className="mb-6">
      <div className="mb-4 flex items-center gap-2">
        <Palette className="h-5 w-5 text-ink" />
        <h2 className="font-display text-lg font-bold text-ink">A marca da arena</h2>
      </div>

      {/* A prévia é a parte que importa: escolher cor sem ver o resultado é
          escolher no escuro, e o contraste do texto muda com a cor. */}
      <div className="mb-4 overflow-hidden rounded-2xl border border-gray-100">
        <div className="flex h-28 items-end p-4" style={{ backgroundColor: previa.value.primary_color, color: tinta }}>
          <div className="flex items-center gap-3">
            {previa.value.logo_url && (
              <img src={previa.value.logo_url} alt=""
                className="h-10 w-10 shrink-0 rounded-xl bg-white/90 object-contain p-1" />
            )}
            <div>
              <p className="font-display text-xl font-bold">{arena.name}</p>
              {previa.value.tagline && <p className="text-sm opacity-85">{previa.value.tagline}</p>}
            </div>
          </div>
        </div>
      </div>

      <form onSubmit={submit}>
        <div className="grid gap-3 sm:grid-cols-2">
          <V2Field label="Cor da marca" htmlFor="wl-cor" hint="Em hexadecimal, como #1D4ED8.">
            <div className="flex gap-2">
              <input type="color" aria-label="Escolher a cor"
                value={previa.value.primary_color}
                onChange={(e) => set({ primary_color: e.target.value })}
                className="h-11 w-14 shrink-0 cursor-pointer rounded-2xl border border-gray-200 bg-paper-pure p-1" />
              <V2Input id="wl-cor" value={form.primary_color} maxLength={7}
                onChange={(e) => set({ primary_color: e.target.value })} />
            </div>
          </V2Field>
          <V2Field label="Assinatura" htmlFor="wl-tag" hint="Uma linha, embaixo do nome.">
            <V2Input id="wl-tag" maxLength={60} placeholder="Ex.: pickleball todo dia"
              value={form.tagline} onChange={(e) => set({ tagline: e.target.value })} />
          </V2Field>
        </div>
        <V2Field label="Endereço do logo" htmlFor="wl-logo" className="mt-3"
          hint="Precisa começar com https://">
          <V2Input id="wl-logo" maxLength={500} placeholder="https://…/logo.png"
            value={form.logo_url} onChange={(e) => set({ logo_url: e.target.value })} />
        </V2Field>

        <label className="mt-3 flex items-center gap-2 text-sm text-gray-600">
          <input type="checkbox" checked={form.active} className="h-4 w-4 rounded border-gray-300"
            onChange={(e) => set({ active: e.target.checked })} />
          Usar a minha marca nas telas desta arena
        </label>

        {!previa.valid && (
          <p className="mt-2 text-xs text-amber-700">{Object.values(previa.errors)[0]}</p>
        )}

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-gray-500">
            {atual.on ? 'A marca está no ar.' : 'A página da arena está com a cor da plataforma.'}
          </p>
          <V2Button type="submit" disabled={salvar.isPending || !previa.valid}>
            {salvar.isPending ? 'Salvando…' : 'Salvar a marca'}
          </V2Button>
        </div>
      </form>
    </V2Surface>
  );
}

/* ==================================================== 2. MULTI-UNIDADE == */

function RedeSecao({ arena }) {
  const { data: minhasRedes = [] } = useMyNetworks();
  const { data: rede, isLoading } = useArenaNetwork(arena.id);
  const { data: minhasArenas = [] } = useMyManagedArenas();
  const criar = useCreateNetwork();
  const incluir = useAddArenaToNetwork();
  const remover = useRemoveArenaFromNetwork();
  const [nome, setNome] = useState('');

  const unidades = useMemo(() => {
    const ids = rede?.arenas || [];
    return ids.map((id) => minhasArenas.find((a) => a.id === id) || { id, name: 'Unidade' });
  }, [rede, minhasArenas]);

  const podemEntrar = minhasArenas.filter((a) => !(rede?.arenas || []).includes(a.id));

  return (
    <V2Surface className="mb-6">
      <div className="mb-4 flex items-center gap-2">
        <Network className="h-5 w-5 text-ink" />
        <h2 className="font-display text-lg font-bold text-ink">Rede de unidades</h2>
      </div>

      {isLoading && <V2Skeleton className="h-20 rounded-2xl" />}

      {!isLoading && !rede && (
        <>
          <V2EmptyState
            icon={Network}
            title="Esta arena não faz parte de uma rede"
            description="Uma rede junta várias unidades sob o mesmo grupo, com os números somados. Você cria a sua, e só entram unidades que você administra."
          />
          <form
            className="mt-3 flex flex-wrap items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              criar.mutateAsync({ arenaId: arena.id, name: nome })
                .then(() => { toast.success('Rede criada com esta unidade dentro.'); setNome(''); })
                .catch((err) => toast.error(err?.message || 'Não foi possível criar a rede.'));
            }}
          >
            <V2Field label="Nome da rede" htmlFor="rd-nome" className="min-w-[220px] flex-1">
              <V2Input id="rd-nome" required maxLength={80} placeholder="Ex.: Rede Pickle SP"
                value={nome} onChange={(e) => setNome(e.target.value)} />
            </V2Field>
            <V2Button type="submit" disabled={criar.isPending}>
              <Plus className="mr-1.5 h-4 w-4" /> Criar rede
            </V2Button>
          </form>
          {minhasRedes.length > 0 && (
            <div className="mt-3">
              <p className="mb-1.5 text-xs font-bold uppercase tracking-widest text-gray-400">
                Ou entrar numa rede sua
              </p>
              <div className="flex flex-wrap gap-1.5">
                {minhasRedes.map((r) => (
                  <V2Button key={r.id} size="sm" variant="ghost" disabled={incluir.isPending}
                    onClick={() => incluir.mutateAsync({ arenaId: arena.id, networkId: r.id })
                      .then(() => toast.success(`Entrou na ${r.name}.`))
                      .catch((e) => toast.error(e?.message || 'Não foi possível.'))}>
                    {r.name}
                  </V2Button>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {rede && (
        <>
          <p className="font-display text-base font-bold text-ink">{rede.name}</p>
          <p className="mt-0.5 text-xs text-gray-500">
            {unidades.length} {unidades.length === 1 ? 'unidade' : 'unidades'}
          </p>

          <ul className="mt-3 space-y-1.5">
            {unidades.map((u) => (
              <li key={u.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-gray-100 bg-paper p-2.5">
                <span className="text-sm text-ink">
                  {u.name}
                  {u.id === arena.id && <span className="ml-1.5 text-xs text-gray-500">(esta)</span>}
                </span>
                {u.id === arena.id && (
                  <ConfirmDialog
                    title="Sair da rede?"
                    description="A unidade deixa de aparecer nos números somados. A rede continua existindo."
                    confirmLabel="Sair da rede"
                    destructive
                    onConfirm={() => remover.mutateAsync({ arenaId: arena.id, networkId: rede.id })
                      .then(() => toast.success('Saiu da rede.'))
                      .catch((e) => toast.error(e?.message || 'Não foi possível sair.'))}
                    trigger={<V2Button size="sm" variant="ghost" className="text-red-600">Sair</V2Button>}
                  />
                )}
              </li>
            ))}
          </ul>

          {podemEntrar.length > 0 && (
            <div className="mt-3 border-t border-gray-100 pt-3">
              <p className="mb-1.5 text-xs font-bold uppercase tracking-widest text-gray-400">
                Incluir outra unidade sua
              </p>
              <div className="flex flex-wrap gap-1.5">
                {podemEntrar.map((a) => (
                  <V2Button key={a.id} size="sm" variant="ghost" disabled={incluir.isPending}
                    onClick={() => incluir.mutateAsync({ arenaId: a.id, networkId: rede.id })
                      .then(() => toast.success(`${a.name} entrou na rede.`))
                      .catch((e) => toast.error(e?.message || 'Não foi possível incluir.'))}>
                    <Plus className="mr-1 h-3.5 w-3.5" /> {a.name}
                  </V2Button>
                ))}
              </div>
            </div>
          )}

          <p className="mt-3 text-xs text-gray-500">
            Só entram unidades que <strong className="text-ink">você administra</strong>. Rede
            entre donos diferentes é combinada com a plataforma.
          </p>
        </>
      )}
    </V2Surface>
  );
}

/* ============================================================== 3. IA == */

function InteligenciaSecao({ arena, courts, temPreco, temPrevisao }) {
  const { data: historico = [], isLoading } = useArenaHistory(arena.id, 30);

  const serie = historico.map((d) => d.count);
  const previsao = forecastDemand(serie, 7);
  const mediaDia = serie.length > 0
    ? Math.round((serie.reduce((a, b) => a + b, 0) / serie.length) * 10) / 10
    : 0;
  const receita = historico.reduce((a, d) => a + (Number(d.revenue) || 0), 0);

  // A ocupação média dos últimos 30 dias, em horas-quadra — a mesma unidade
  // que o calendário usa, para os dois números não se contradizerem.
  const horasPorDia = Math.max(1, courts.length) * 14;
  const ocupacao = serie.length > 0
    ? Math.min(100, Math.round((mediaDia / horasPorDia) * 100))
    : 0;

  // ⚠️ `resolveArenaPrice` devolve um OBJETO `{ price, … }`, não um número —
  // usar o retorno cru faria `base > 0` ser sempre falso e o bloco de preço
  // nunca aparecer (foi o que aconteceu na primeira versão desta tela).
  const base = Number(resolveArenaPrice(arena, {})?.price) || Number(arena?.base_price) || 0;
  const sugestoes = [
    { rotulo: 'Manhã de semana', hour: 9, isWeekend: false },
    { rotulo: 'Pico de semana (19h)', hour: 19, isWeekend: false },
    { rotulo: 'Sábado à tarde', hour: 15, isWeekend: true },
  ].map((c) => ({
    ...c,
    preco: calculateDynamicPrice({ basePrice: base, occupancyPct: ocupacao, hour: c.hour, isWeekend: c.isWeekend }),
  }));

  return (
    <V2Surface className="mb-6">
      <div className="mb-4 flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-ink" />
        <h2 className="font-display text-lg font-bold text-ink">Leitura dos seus números</h2>
      </div>

      {isLoading && <V2Skeleton className="h-24 rounded-2xl" />}

      {!isLoading && historico.length === 0 && (
        <V2EmptyState
          icon={TrendingUp}
          title="Ainda não há histórico para ler"
          description="A leitura usa as reservas confirmadas dos últimos 30 dias. Com o primeiro mês de movimento, a previsão e o preço sugerido aparecem aqui."
        />
      )}

      {!isLoading && historico.length > 0 && (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-gray-100 bg-paper p-3">
              <p className="text-xs font-bold uppercase tracking-wider text-gray-500">Dias com movimento</p>
              <p className="mt-1 font-display text-2xl font-bold text-ink">{historico.length}</p>
              <p className="text-xs text-gray-500">nos últimos 30</p>
            </div>
            <div className="rounded-2xl border border-gray-100 bg-paper p-3">
              <p className="text-xs font-bold uppercase tracking-wider text-gray-500">Média por dia</p>
              <p className="mt-1 font-display text-2xl font-bold text-ink">{mediaDia}</p>
              <p className="text-xs text-gray-500">horas-quadra · {ocupacao}% de ocupação</p>
            </div>
            <div className="rounded-2xl border border-gray-100 bg-paper p-3">
              <p className="text-xs font-bold uppercase tracking-wider text-gray-500">Receita no período</p>
              <p className="mt-1 font-display text-2xl font-bold text-ink">{formatPrice(receita)}</p>
              <p className="text-xs text-gray-500">reservas confirmadas</p>
            </div>
          </div>

          {temPrevisao && (
            <div className="mt-3 rounded-2xl bg-paper p-3">
              <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-gray-400">
                <TrendingUp className="h-3.5 w-3.5" /> Próximos 7 dias
              </p>
              <p className="mt-1 font-display text-xl font-bold text-ink">
                ~{previsao} horas-quadra
              </p>
              <p className="text-xs text-gray-500">
                Média móvel ponderada dos {historico.length} dias com movimento — os mais
                recentes pesam mais. É estimativa, não promessa.
              </p>
            </div>
          )}

          {temPreco && base > 0 && (
            <div className="mt-3">
              <p className="mb-1.5 text-xs font-bold uppercase tracking-widest text-gray-400">
                Preço sugerido (sua tabela: {formatPrice(base)}/h)
              </p>
              <div className="space-y-1.5">
                {sugestoes.map((s) => (
                  <div key={s.rotulo} className="flex items-center justify-between gap-2 rounded-2xl border border-gray-100 bg-paper p-2.5">
                    <span className="text-sm text-gray-600">{s.rotulo}</span>
                    <span className="font-display text-base font-bold text-ink">
                      {formatPrice(s.preco)}
                      {s.preco !== base && (
                        <span className={`ml-1.5 text-xs ${s.preco > base ? 'text-green-700' : 'text-amber-700'}`}>
                          {s.preco > base ? '+' : ''}{Math.round(((s.preco - base) / base) * 100)}%
                        </span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
              <p className="mt-2 flex items-start gap-1.5 text-xs leading-5 text-gray-500">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>
                  Isto é <strong className="text-ink">sugestão</strong>. Nada muda de preço
                  sozinho — quem aplica é você, nas faixas de preço da quadra. Um sistema que
                  muda o preço sem a arena ver é o tipo de automação que se descobre pelo
                  cliente reclamando.
                </span>
              </p>
            </div>
          )}

          <p className="mt-3 text-[11px] text-gray-400">
            Último dia lido: {formatDateShortBR(historico[historico.length - 1].date)}
          </p>
        </>
      )}
    </V2Surface>
  );
}

/* ============================================================= 4. IOT == */

function DispositivosSecao({ arenaId }) {
  const { data: devices = [] } = useArenaDevices(arenaId);
  const criar = useCreateDevice();
  const [aberto, setAberto] = useState(false);
  const [form, setForm] = useState({ name: '', kind: DEVICE_KIND.QR_KIOSK, location: '' });

  const submit = async (e) => {
    e.preventDefault();
    try {
      await criar.mutateAsync({ arenaId, input: form });
      toast.success('Dispositivo cadastrado.');
      setForm({ name: '', kind: DEVICE_KIND.QR_KIOSK, location: '' });
      setAberto(false);
    } catch (err) {
      toast.error(err?.message || 'Não foi possível cadastrar.');
    }
  };

  return (
    <V2Surface>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Cpu className="h-5 w-5 text-ink" />
          <h2 className="font-display text-lg font-bold text-ink">Equipamentos</h2>
        </div>
        {!aberto && (
          <V2Button size="sm" onClick={() => setAberto(true)}>
            <Plus className="mr-1.5 h-4 w-4" /> Cadastrar
          </V2Button>
        )}
      </div>

      {aberto && (
        <form onSubmit={submit} className="mb-4 rounded-2xl border border-gray-100 bg-paper p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-display text-base font-bold text-ink">Novo equipamento</h3>
            <button type="button" onClick={() => setAberto(false)} aria-label="Fechar"
              className="rounded-full p-1.5 text-gray-400 hover:bg-gray-100 hover:text-ink">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <V2Field label="Nome" htmlFor="dv-nome">
              <V2Input id="dv-nome" required maxLength={120} placeholder="Ex.: Totem da entrada"
                value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </V2Field>
            <V2Field label="Tipo" htmlFor="dv-tipo">
              <select id="dv-tipo" value={form.kind}
                onChange={(e) => setForm((f) => ({ ...f, kind: e.target.value }))}
                className="h-11 w-full rounded-2xl border border-gray-200 bg-paper-pure px-4 text-sm">
                {Object.entries(DEVICE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </V2Field>
            <V2Field label="Onde fica" htmlFor="dv-local">
              <V2Input id="dv-local" maxLength={120} placeholder="Ex.: recepção"
                value={form.location} onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))} />
            </V2Field>
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <V2Button type="button" variant="ghost" onClick={() => setAberto(false)}>Cancelar</V2Button>
            <V2Button type="submit" disabled={criar.isPending}>Cadastrar</V2Button>
          </div>
        </form>
      )}

      {devices.length === 0 ? (
        <V2EmptyState
          icon={Cpu}
          title="Nenhum equipamento cadastrado"
          description="O cadastro serve para saber o que existe e onde fica. Luz, sensor e câmera dependem de integração do fabricante — a plataforma guarda o registro, não comanda o aparelho."
        />
      ) : (
        <div className="space-y-2">
          {devices.map((d) => (
            <div key={d.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-gray-100 bg-paper p-3">
              <div className="min-w-0">
                <p className="font-bold text-ink">{d.name}</p>
                <p className="text-xs text-gray-500">
                  {DEVICE_LABEL[d.kind] || d.kind}
                  {d.location ? ` · ${d.location}` : ''}
                </p>
              </div>
              <V2Badge tone={STATUS_TONE[d.status] || 'neutral'}>{d.status || 'sem status'}</V2Badge>
            </div>
          ))}
        </div>
      )}

      <p className="mt-3 flex items-start gap-1.5 text-xs leading-5 text-gray-500">
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        Iluminação, sensor e câmera são serviços de terceiro: a plataforma guarda o cadastro e
        o vínculo com a quadra, mas o comando depende de integração do fabricante. Isto está
        escrito assim também no catálogo de módulos — não é promessa por fazer, é o limite.
      </p>
    </V2Surface>
  );
}

/* ========================================================== A PÁGINA === */

export default function V2ArenaAdvanced() {
  const { arenaId } = useParams();
  const { user, isPlatformAdmin } = useAuth();
  const { data: arena, isLoading } = useArena(arenaId);
  const { data: managed = [] } = useMyManagedArenas();
  const { data: courts = [] } = useArenaCourts(arenaId);
  const { isOn, isLoading: modulosCarregando } = useArenaModules(arenaId);

  if (isLoading || modulosCarregando) {
    return <V2Skeleton className="mx-auto h-96 max-w-[1000px] rounded-4xl" />;
  }
  if (!arena) return <Navigate to="/arenas" replace />;

  const podeGerir = arena.owner_id === user?.uid
    || managed.some((m) => m.id === arena.id)
    || isPlatformAdmin;
  if (!podeGerir) return <Navigate to={`/arenas/${arenaId}`} replace />;

  const temMarca = isOn(ARENA_MODULE_ID.WHITE_LABEL_BRANDING) || isOn(ARENA_MODULE_ID.WHITE_LABEL);
  const temRede = isOn(ARENA_MODULE_ID.MULTI_UNIT);
  const temIA = isOn(ARENA_MODULE_ID.AI);
  const temPreco = isOn(ARENA_MODULE_ID.AI_PRICING);
  const temPrevisao = isOn(ARENA_MODULE_ID.AI_FORECAST);
  const temIoT = isOn(ARENA_MODULE_ID.IOT);
  const nenhum = !temMarca && !temRede && !temIA && !temIoT;

  return (
    <div className="mx-auto max-w-[1000px]">
      <div className="mb-6">
        <Link to={`/arenas/${arena.id}/gerir`} className="mb-3 inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-gray-500 hover:text-ink">
          <ArrowLeft className="h-3.5 w-3.5" /> Voltar para a gestão
        </Link>
        <h1 className="font-display text-3xl font-bold tracking-tight text-ink">Avançado</h1>
        <p className="mt-2 font-medium text-gray-500">
          {arena.name} · marca, rede, leitura dos números e equipamentos.
        </p>
      </div>

      {nenhum ? (
        <V2Surface>
          <V2EmptyState
            icon={Sparkles}
            title="Nenhuma ferramenta avançada ativa"
            description="Ative o que quiser usar em Gestão → Configurações → Módulos. Cada ferramenta liga separadamente."
            action={(
              <Link to={`/arenas/${arena.id}/gerir?secao=configuracoes&aba=modulos`} className="text-sm font-bold text-ink underline">
                Abrir os módulos
              </Link>
            )}
          />
        </V2Surface>
      ) : (
        <>
          {temMarca && <MarcaSecao arena={arena} />}
          {temRede && <RedeSecao arena={arena} />}
          {temIA && (
            <InteligenciaSecao arena={arena} courts={courts}
              temPreco={temPreco} temPrevisao={temPrevisao} />
          )}
          {temIoT && <DispositivosSecao arenaId={arena.id} />}
        </>
      )}
    </div>
  );
}
