/**
 * O seletor da MINHA REGIÃO (flag `my_region`) — o mesmo em Configurações e
 * no "Alterar" de cada tela.
 *
 * Quatro escolhas, cada uma dizendo o que vai aparecer:
 *  1. **Minha cidade** (a do perfil), só ela ou com as vizinhas até N km —
 *     com a lista das cidades que entram, para "50 km" deixar de ser abstrato;
 *  2. **Todo o meu estado**;
 *  3. **Outro lugar** — quem vai viajar, ou mora longe do cadastro: uma
 *     cidade (com o mesmo raio) ou um estado inteiro, ou **a localização do
 *     aparelho**, que vira a cidade mais próxima (as coordenadas não saem do
 *     aparelho e não são guardadas);
 *  4. **Todo lugar** — sem filtro; o mais perto continua primeiro.
 *
 * Muda na hora (as telas atrás já obedecem). Nada vai para o banco.
 */
import React, { useEffect, useId, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Globe2, LocateFixed, MapPin, Map as MapIcon, RotateCcw, Search } from 'lucide-react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useCityGeo, useMyRegion } from '@/core/lib/useMyRegion';
import { loadCityGeo } from '@/core/geo/cidadesBR';
import {
  DEFAULT_RADIUS_KM, RADIUS_CHOICES_KM, REGION_MODE, REGION_ORIGIN,
} from '@/core/domain/region';
import { BR_UFS, ufName } from '@/core/domain/ufs';
import { normalizeLocality } from '@/core/domain/locality';
import { cn } from '@/core/lib/utils';
import { V2Button } from '@/v2/ui/primitives';

const OPCAO = Object.freeze({ CIDADE: 'cidade', ESTADO: 'estado', OUTRO: 'outro', TODOS: 'todos' });

/** Qual opção está marcada, pela ESCOLHA guardada (ou pelo padrão). */
function opcaoDe(escolha) {
  if (!escolha) return OPCAO.CIDADE;
  if (escolha.modo === REGION_MODE.TODOS) return OPCAO.TODOS;
  if (escolha.origem !== REGION_ORIGIN.PERFIL) return OPCAO.OUTRO;
  return escolha.modo === REGION_MODE.ESTADO ? OPCAO.ESTADO : OPCAO.CIDADE;
}

/** Os chips de distância: "Só a cidade" + os raios. */
function Raios({ modo, raioKm, onChange, rotulo }) {
  return (
    <div role="group" aria-label={rotulo} className="flex flex-wrap gap-1.5">
      <ChipRaio ativo={modo === REGION_MODE.CIDADE} onClick={() => onChange(REGION_MODE.CIDADE, raioKm)}>
        Só a cidade
      </ChipRaio>
      {RADIUS_CHOICES_KM.map((km) => (
        <ChipRaio
          key={km}
          ativo={modo === REGION_MODE.RAIO && raioKm === km}
          onClick={() => onChange(REGION_MODE.RAIO, km)}
        >
          até {km} km
        </ChipRaio>
      ))}
    </div>
  );
}

function ChipRaio({ ativo, children, ...props }) {
  return (
    <button
      type="button"
      aria-pressed={ativo}
      className={cn(
        'btn-press rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-acid/30',
        ativo ? 'border-transparent bg-acid text-ink' : 'border-gray-200 bg-paper-pure text-gray-600 hover:border-ink hover:text-ink',
      )}
      {...props}
    >
      {children}
    </button>
  );
}

/** "Entram 14 cidades: Canoas, Gravataí, Viamão e mais 11." */
function Vizinhas({ geo, cidade, uf, modo, raioKm }) {
  const texto = useMemo(() => {
    if (!geo || !cidade) return null;
    const centro = geo.coordsOf(cidade, uf);
    if (!centro) return null;
    if (modo !== REGION_MODE.RAIO) return 'Só o que acontece na própria cidade.';
    const lista = geo.within(centro, raioKm, { limite: 400 });
    if (lista.length === 0) return `Nenhuma outra cidade a até ${raioKm} km — vale só a própria cidade.`;
    const nomes = lista.slice(0, 4).map((c) => c.nome);
    const resto = lista.length - nomes.length;
    return `Entram também ${lista.length} ${lista.length === 1 ? 'cidade' : 'cidades'}: ${nomes.join(', ')}${resto > 0 ? ` e mais ${resto}` : ''}.`;
  }, [geo, cidade, uf, modo, raioKm]);
  if (!texto) return null;
  return <p className="text-xs leading-5 text-gray-500">{texto}</p>;
}

function Opcao({ id, valor, marcada, onEscolher, icon: Icon, titulo, descricao, desabilitada = false, children }) {
  return (
    <div
      className={cn(
        'rounded-3xl border p-4 transition-colors',
        marcada ? 'border-ink bg-ink/[0.03]' : 'border-gray-100 bg-paper-pure',
        desabilitada && 'opacity-60',
      )}
    >
      <label htmlFor={`${id}-${valor}`} className={cn('flex items-start gap-3', desabilitada ? 'cursor-not-allowed' : 'cursor-pointer')}>
        <input
          id={`${id}-${valor}`}
          type="radio"
          name={`${id}-regiao`}
          value={valor}
          checked={marcada}
          disabled={desabilitada}
          onChange={() => onEscolher(valor)}
          className="mt-1 h-4 w-4 accent-ink"
        />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2 text-sm font-bold text-ink">
            <Icon className="h-4 w-4 text-gray-400" aria-hidden="true" /> {titulo}
          </span>
          {descricao && <span className="mt-0.5 block text-xs leading-5 text-gray-500">{descricao}</span>}
        </span>
      </label>
      {marcada && children && <div className="mt-3 space-y-2 pl-7">{children}</div>}
    </div>
  );
}

/** "Outro lugar": cidade (com sugestões do mapa), estado, ou a localização do aparelho. */
function OutroLugar({ escolha, region, geo, definir }) {
  const idBusca = useId();
  const doOutro = escolha && escolha.origem !== REGION_ORIGIN.PERFIL;
  const [texto, setTexto] = useState(doOutro ? escolha.cidade : '');
  const [uf, setUf] = useState(doOutro ? escolha.uf : '');
  const [localizando, setLocalizando] = useState(false);
  const [aviso, setAviso] = useState(null);
  useEffect(() => {
    if (!doOutro) return;
    setTexto(escolha.cidade);
    setUf(escolha.uf);
  }, [doOutro, escolha?.cidade, escolha?.uf]);

  const sugestoes = useMemo(() => {
    if (!geo || normalizeLocality(texto).length < 2) return [];
    const exata = doOutro && normalizeLocality(texto) === normalizeLocality(escolha.cidade);
    return exata ? [] : geo.search(texto, { uf, limite: 6 });
  }, [geo, texto, uf, doOutro, escolha?.cidade]);

  const modoAtual = doOutro && (escolha.modo === REGION_MODE.CIDADE || escolha.modo === REGION_MODE.RAIO)
    ? escolha.modo : REGION_MODE.RAIO;
  const raioAtual = escolha?.raioKm || DEFAULT_RADIUS_KM;

  const usarCidade = (cidade, estado, origem = REGION_ORIGIN.OUTRA) => {
    setTexto(cidade);
    setUf(estado || '');
    setAviso(null);
    definir({ modo: modoAtual, origem, cidade, uf: estado || '', raioKm: raioAtual });
  };
  const usarEstado = (estado) => {
    setUf(estado);
    if (!estado) return;
    if (!texto.trim()) definir({ modo: REGION_MODE.ESTADO, origem: REGION_ORIGIN.OUTRA, cidade: '', uf: estado, raioKm: raioAtual });
    else if (doOutro) definir({ ...escolha, uf: estado });
  };

  const podeLocalizar = typeof navigator !== 'undefined' && 'geolocation' in navigator;
  const localizar = () => {
    if (!podeLocalizar) return;
    setLocalizando(true);
    setAviso(null);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const mapa = await loadCityGeo();
          const perto = mapa.nearest(pos.coords.latitude, pos.coords.longitude);
          if (!perto) throw new Error('fora');
          usarCidade(perto.nome, perto.uf, REGION_ORIGIN.APARELHO);
        } catch {
          setAviso('Não achamos uma cidade do Brasil perto de você. Escolha na lista.');
        } finally {
          setLocalizando(false);
        }
      },
      (erro) => {
        setLocalizando(false);
        setAviso(erro?.code === 1
          ? 'A localização não foi permitida. Tudo bem — escolha a cidade na lista.'
          : 'Não deu para achar a sua localização agora. Escolha a cidade na lista.');
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 10 * 60_000 },
    );
  };

  const cidadeEscolhida = doOutro && escolha.cidade;
  const achadaNoMapa = cidadeEscolhida && geo ? Boolean(geo.coordsOf(escolha.cidade, escolha.uf)) : null;

  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-[1fr_7rem]">
        <div className="relative">
          <label htmlFor={idBusca} className="sr-only">Cidade</label>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
          <input
            id={idBusca}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Digite a cidade"
            autoComplete="off"
            className="w-full rounded-2xl border border-gray-200 bg-paper-pure py-2.5 pl-9 pr-3 text-sm text-ink placeholder-gray-400 focus:border-gray-300 focus:outline-none focus:ring-4 focus:ring-gray-100"
          />
        </div>
        <select
          aria-label="Estado"
          value={uf}
          onChange={(e) => usarEstado(e.target.value)}
          className="rounded-2xl border border-gray-200 bg-paper-pure px-3 py-2.5 text-sm text-ink focus:outline-none focus:ring-4 focus:ring-gray-100"
        >
          <option value="">UF</option>
          {BR_UFS.map((u) => <option key={u} value={u}>{u}</option>)}
        </select>
      </div>

      {sugestoes.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label="Cidades encontradas">
          {sugestoes.map((c) => (
            <li key={`${c.uf}-${c.nome}`}>
              <ChipRaio ativo={false} onClick={() => usarCidade(c.nome, c.uf)}>{c.nome} / {c.uf}</ChipRaio>
            </li>
          ))}
        </ul>
      )}
      {texto.trim().length >= 2 && sugestoes.length === 0 && !cidadeEscolhida && geo && (
        <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
          <span>Não achamos “{texto.trim()}” entre as cidades do Brasil.</span>
          <ChipRaio ativo={false} onClick={() => usarCidade(texto.trim(), uf)}>Usar assim mesmo</ChipRaio>
        </div>
      )}

      {cidadeEscolhida && (
        <>
          <p className="flex items-center gap-1.5 text-xs font-semibold text-ink">
            <Check className="h-3.5 w-3.5 text-acid-dark" aria-hidden="true" />
            {escolha.origem === REGION_ORIGIN.APARELHO ? 'Perto de mim: ' : ''}
            {escolha.cidade}{escolha.uf ? ` / ${escolha.uf}` : ''}
          </p>
          {achadaNoMapa === false ? (
            <p className="text-xs leading-5 text-gray-500">
              Essa cidade não está no mapa do Brasil, então não dá para medir distância: vale o nome exato.
            </p>
          ) : (
            <>
              <Raios
                modo={escolha.modo}
                raioKm={escolha.raioKm}
                rotulo="Distância a partir desse lugar"
                onChange={(modo, raioKm) => definir({ ...escolha, modo, raioKm })}
              />
              <Vizinhas geo={geo} cidade={escolha.cidade} uf={escolha.uf} modo={escolha.modo} raioKm={escolha.raioKm} />
            </>
          )}
        </>
      )}
      {doOutro && escolha.modo === REGION_MODE.ESTADO && (
        <p className="flex items-center gap-1.5 text-xs font-semibold text-ink">
          <Check className="h-3.5 w-3.5 text-acid-dark" aria-hidden="true" /> {ufName(escolha.uf)} (todo o estado)
        </p>
      )}

      {podeLocalizar && (
        <div className="space-y-1">
          <V2Button type="button" variant="secondary" size="sm" onClick={localizar} disabled={localizando}>
            <LocateFixed className="h-4 w-4" aria-hidden="true" /> {localizando ? 'Localizando…' : 'Usar a minha localização atual'}
          </V2Button>
          <p className="text-[11px] leading-4 text-gray-400">
            A localização é usada só neste aparelho para achar a cidade mais próxima. Ela não é enviada nem guardada.
          </p>
        </div>
      )}
      {aviso && <p role="status" className="text-xs font-medium text-amber-700">{aviso}</p>}
      {region.falta && doOutro && !cidadeEscolhida && escolha.modo !== REGION_MODE.ESTADO && (
        <p className="text-xs text-gray-500">Escolha uma cidade ou um estado.</p>
      )}
    </div>
  );
}

export default function RegionPicker({ className }) {
  const id = useId();
  const { userProfile } = useAuth();
  const {
    escolha, region, definir, restaurar, personalizada, rotulo, mapaFalhou,
  } = useMyRegion();
  // O seletor sempre precisa do mapa (sugestões de "outro lugar", as cidades
  // que entram no raio) — mesmo para quem ainda não tem cidade no perfil.
  const geoQ = useCityGeo();
  const geo = geoQ.data || null;
  const [marcadaLocal, setMarcadaLocal] = useState(null);
  const marcada = marcadaLocal || opcaoDe(escolha);
  useEffect(() => { setMarcadaLocal(null); }, [escolha]);

  const cidadePerfil = String(userProfile?.city || '').trim();
  const ufPerfil = String(userProfile?.state || '').trim().toUpperCase();
  const raio = escolha?.raioKm || DEFAULT_RADIUS_KM;
  const modoCidade = !escolha ? REGION_MODE.RAIO
    : (escolha.origem === REGION_ORIGIN.PERFIL && (escolha.modo === REGION_MODE.CIDADE || escolha.modo === REGION_MODE.RAIO)
      ? escolha.modo : REGION_MODE.RAIO);

  const escolher = (valor) => {
    if (valor === OPCAO.CIDADE) definir({ modo: modoCidade, origem: REGION_ORIGIN.PERFIL, raioKm: raio });
    else if (valor === OPCAO.ESTADO) definir({ modo: REGION_MODE.ESTADO, origem: REGION_ORIGIN.PERFIL, raioKm: raio });
    else if (valor === OPCAO.TODOS) {
      // O centro continua: em "todo lugar", o mais perto aparece primeiro.
      definir({ ...(escolha || { origem: REGION_ORIGIN.PERFIL }), modo: REGION_MODE.TODOS, raioKm: raio });
    } else if (escolha && escolha.origem !== REGION_ORIGIN.PERFIL && (escolha.cidade || escolha.uf)) {
      definir({ ...escolha, modo: escolha.cidade ? (escolha.modo === REGION_MODE.TODOS ? REGION_MODE.RAIO : escolha.modo) : REGION_MODE.ESTADO });
    } else {
      // Outro lugar ainda sem lugar: só abre os campos; nada muda até escolher.
      setMarcadaLocal(OPCAO.OUTRO);
    }
  };

  return (
    <div className={cn('space-y-3', className)}>
      <div role="radiogroup" aria-label="Minha região" className="space-y-2">
        <Opcao
          id={id}
          valor={OPCAO.CIDADE}
          marcada={marcada === OPCAO.CIDADE}
          onEscolher={escolher}
          icon={MapPin}
          titulo={cidadePerfil ? `Minha cidade — ${cidadePerfil}${ufPerfil ? ` / ${ufPerfil}` : ''}` : 'Minha cidade'}
          descricao={cidadePerfil
            ? 'A cidade do seu perfil, sozinha ou com as vizinhas.'
            : 'Seu perfil ainda não tem cidade.'}
          desabilitada={!cidadePerfil}
        >
          <Raios
            modo={modoCidade}
            raioKm={raio}
            rotulo="Distância a partir da sua cidade"
            onChange={(modo, raioKm) => definir({ modo, origem: REGION_ORIGIN.PERFIL, raioKm })}
          />
          <Vizinhas geo={geo} cidade={cidadePerfil} uf={ufPerfil} modo={modoCidade} raioKm={raio} />
          {mapaFalhou && (
            <p className="text-xs text-amber-700">O mapa das cidades não carregou agora; até ele voltar, vale só a própria cidade.</p>
          )}
        </Opcao>
        {!cidadePerfil && (
          <p className="pl-2 text-xs text-gray-500">
            <Link to="/perfil/editar" className="font-semibold text-ink underline">Informe a sua cidade no perfil</Link>
            {' '}para ver primeiro o que acontece perto de você.
          </p>
        )}

        <Opcao
          id={id}
          valor={OPCAO.ESTADO}
          marcada={marcada === OPCAO.ESTADO}
          onEscolher={escolher}
          icon={MapIcon}
          titulo={ufPerfil ? `Todo o meu estado — ${ufName(ufPerfil)}` : 'Todo o meu estado'}
          descricao={ufPerfil ? 'Qualquer cidade do estado do seu perfil.' : 'Seu perfil ainda não tem estado.'}
          desabilitada={!ufPerfil}
        />

        <Opcao
          id={id}
          valor={OPCAO.OUTRO}
          marcada={marcada === OPCAO.OUTRO}
          onEscolher={escolher}
          icon={LocateFixed}
          titulo="Outro lugar"
          descricao="Vai viajar, ou joga longe da cidade do cadastro? Escolha a cidade (ou só o estado) — ou use a sua localização."
        >
          <OutroLugar escolha={escolha} region={region} geo={geo} definir={definir} />
        </Opcao>

        <Opcao
          id={id}
          valor={OPCAO.TODOS}
          marcada={marcada === OPCAO.TODOS}
          onEscolher={escolher}
          icon={Globe2}
          titulo="Todo lugar"
          descricao="Sem filtro — outros estados e países também. O que está mais perto continua aparecendo primeiro."
        />
      </div>

      {geoQ.isError && (
        <p className="text-xs text-amber-700">
          O mapa das cidades não carregou agora — as sugestões e a lista de vizinhas voltam quando ele carregar.{' '}
          <button type="button" onClick={() => geoQ.refetch()} className="font-semibold underline">Tentar de novo</button>
        </p>
      )}
      <div className="flex flex-col gap-2 rounded-3xl bg-paper px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-gray-600" aria-live="polite">
          Você vê: <strong className="font-semibold text-ink">{rotulo}</strong>
        </p>
        {personalizada && (
          <button
            type="button"
            onClick={() => { restaurar(); setMarcadaLocal(null); }}
            className="inline-flex items-center gap-1 self-start rounded-full px-2 py-1 text-xs font-semibold text-gray-500 hover:text-ink focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-acid/30 sm:self-auto"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" /> Voltar ao padrão (minha cidade e até {DEFAULT_RADIUS_KM} km)
          </button>
        )}
      </div>
    </div>
  );
}
