/**
 * V2ArenaKiosk — o totem de chegada da arena.
 *
 * Rota: `/arenas/:arenaId/totem` (fora do V2Layout — a tela inteira é
 * conteúdo, como o telão do dia de jogo). Módulo: `iot_qr_kiosk`.
 *
 * É um tablet apoiado na recepção, logado na conta da arena, que fica ligado o
 * dia todo mostrando duas coisas: um **QR** e um **código curto**. Quem chega
 * aponta a câmera (ou digita o código no aplicativo) e a presença é
 * registrada na própria reserva — sem ninguém atrás do balcão.
 *
 * ## As três decisões que moldaram esta tela
 *
 * **1. O código gira.** Vale 90 segundos. Um código fixo colado na parede
 * viraria mensagem de grupo — "manda aí o código que eu confirmo do carro" —
 * e a arena estaria medindo boa vontade, não presença.
 *
 * **2. A tela não lista ninguém.** Ela cumprimenta **a última pessoa que
 * chegou, pelo primeiro nome, por 20 segundos**. Um painel público num
 * corredor com a agenda nominal do dia é exposição de dado pessoal que ninguém
 * pediu — e a única função útil do aviso é a pessoa saber que deu certo.
 *
 * **3. Ela usa a marca da arena.** A cor e o logo saem de `arenas.branding`
 * (Onda AN), com o texto escolhido por contraste. É a tela mais vista pelo
 * cliente da arena; sair com a cara da plataforma seria desperdiçar o único
 * lugar onde o white label realmente aparece.
 *
 * O totem escreve `checkin_token` no próprio `arena_devices` — escrita de
 * gestor, coerente com o que ele é. Ao fechar a tela, o código é apagado:
 * totem desligado que deixa um código válido para trás é exatamente a chegada
 * confirmada de casa que a validade curta evita.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import QRCode from 'qrcode';
import { ArrowLeft, Loader2, Maximize2, Minimize2, QrCode, WifiOff } from 'lucide-react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useArena, useMyManagedArenas } from '@/modules/arenas/hooks/useArenas';
import { useArenaBookings } from '@/modules/arenas/hooks/useBookings';
import { useArenaModules } from '@/modules/arenas/hooks/useArenaModules';
import { useArenaDevices, useCreateDevice } from '@/modules/arenas/hooks/useArenaV3';
import { ARENA_MODULE_ID } from '@/modules/arenas/domain/modules';
import { useRotateKioskToken, useMarkKioskOffline } from '@/modules/arenas/hooks/useCheckin';
import { KIOSK_TOKEN_TTL_MS, isoDay } from '@/modules/arenas/domain/checkin';
import { brandingOf } from '@/modules/arenas/domain/whiteLabel';
import { V2Button, V2Skeleton } from '@/v2/ui/primitives';

/** De quanto em quanto tempo o código é trocado. Antes de vencer, com folga. */
const ROTACAO_MS = Math.round(KIOSK_TOKEN_TTL_MS * 0.7);
/** Quanto tempo o cumprimento fica na tela. */
const SAUDACAO_MS = 20_000;

const primeiroNome = (nome) => String(nome || '').trim().split(/\s+/)[0] || 'Bem-vindo';

/** O relógio grande — quem olha o totem de longe quer saber a hora. */
function Relogio() {
  const [agora, setAgora] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setAgora(new Date()), 20_000);
    return () => clearInterval(t);
  }, []);
  return (
    <span className="tabular-nums">
      {String(agora.getHours()).padStart(2, '0')}:{String(agora.getMinutes()).padStart(2, '0')}
    </span>
  );
}

export default function V2ArenaKiosk() {
  const { arenaId } = useParams();
  const { user } = useAuth();
  const { data: arena, isLoading } = useArena(arenaId);
  const { data: minhas = [] } = useMyManagedArenas();
  const { isOn, isLoading: modulosCarregando } = useArenaModules(arenaId);
  const { data: devices = [], isLoading: dvCarregando } = useArenaDevices(arenaId);
  const { data: reservas = [] } = useArenaBookings(arenaId);

  const rotate = useRotateKioskToken();
  const offline = useMarkKioskOffline();
  const criar = useCreateDevice();

  const [codigo, setCodigo] = useState('');
  const [qr, setQr] = useState('');
  const [erro, setErro] = useState('');
  const [cheio, setCheio] = useState(false);
  const criandoRef = useRef(false);

  const totem = useMemo(() => devices.find((d) => d.kind === 'qr_kiosk') || null, [devices]);
  const marca = useMemo(() => brandingOf(arena), [arena]);

  /* --- o código gira sozinho -------------------------------------------- */
  const girar = useCallback(async () => {
    if (!totem?.id) return;
    try {
      const t = await rotate.mutateAsync({ deviceId: totem.id });
      setCodigo(t?.code || '');
      setErro('');
    } catch {
      // Rede caiu: o código antigo continua na tela até vencer, e o aviso
      // aparece. Apagar a tela porque uma rotação falhou deixaria a recepção
      // sem nada justamente quando ninguém pode ajudar.
      setErro('Sem conexão. O código pode estar vencido.');
    }
  }, [totem?.id, rotate]);

  useEffect(() => {
    if (!totem?.id) return undefined;
    girar();
    const t = setInterval(girar, ROTACAO_MS);
    return () => clearInterval(t);
    // `girar` muda a cada render da mutação; prender ao id evita reiniciar o
    // relógio de rotação a cada troca de código.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totem?.id]);

  /* --- ao fechar a tela, o código morre ---------------------------------- */
  useEffect(() => {
    if (!totem?.id) return undefined;
    const encerrar = () => { offline.mutate({ deviceId: totem.id }); };
    window.addEventListener('pagehide', encerrar);
    return () => {
      window.removeEventListener('pagehide', encerrar);
      encerrar();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totem?.id]);

  /* --- o QR leva o código junto: quem escaneia não digita nada ----------- */
  useEffect(() => {
    if (!codigo || !arenaId || typeof window === 'undefined') { setQr(''); return; }
    const url = `${window.location.origin}/arenas/${arenaId}/chegada?d=${encodeURIComponent(totem?.id || '')}&c=${encodeURIComponent(codigo)}`;
    QRCode.toDataURL(url, { width: 520, margin: 1, color: { dark: '#0B0B0B', light: '#FFFFFF' } })
      .then(setQr)
      .catch(() => setQr(''));
  }, [codigo, arenaId, totem?.id]);

  /* --- quem acabou de chegar (só o último, e por pouco tempo) ------------ */
  const saudacao = useMemo(() => {
    const hoje = isoDay();
    const limite = Date.now() - SAUDACAO_MS;
    const recentes = (reservas || [])
      .filter((b) => b?.checked_in_at && b?.checked_in_by === 'athlete')
      .filter((b) => (b.slots || []).some((s) => s?.date === hoje))
      .map((b) => ({
        nome: primeiroNome(b.athlete_name),
        ms: b.checked_in_at?.toMillis ? b.checked_in_at.toMillis() : 0,
      }))
      .filter((x) => x.ms > limite)
      .sort((a, b) => b.ms - a.ms);
    return recentes[0] || null;
  }, [reservas]);

  const alternarTelaCheia = () => {
    const el = document.documentElement;
    if (!document.fullscreenElement) {
      el.requestFullscreen?.().then(() => setCheio(true)).catch(() => {});
    } else {
      document.exitFullscreen?.().then(() => setCheio(false)).catch(() => {});
    }
  };

  if (isLoading || modulosCarregando || dvCarregando) {
    return <div className="min-h-screen bg-ink p-10"><V2Skeleton lines={6} /></div>;
  }
  if (!arena) return <Navigate to="/arenas" replace />;

  const podeGerir = arena.owner_id === user?.uid
    || (arena.manager_ids || []).includes(user?.uid)
    || minhas.some((a) => a.id === arena.id);

  // O totem é a conta da ARENA numa tela de recepção. Uma pessoa qualquer
  // abrindo esta rota veria um código válido — e é justamente o código que
  // separa "cheguei" de "digo que cheguei".
  if (!podeGerir || !isOn(ARENA_MODULE_ID.IOT_QR_KIOSK)) {
    return <Navigate to={`/arenas/${arenaId}`} replace />;
  }

  const fundo = marca.on ? marca.color : '#0B0B0B';
  const tinta = marca.on ? marca.ink : '#FFFFFF';

  if (!totem) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-ink px-6 text-center text-white">
        <QrCode className="h-12 w-12 opacity-60" />
        <h1 className="font-display text-2xl font-bold">Nenhum totem cadastrado</h1>
        <p className="max-w-md text-sm text-white/70">
          O totem é um equipamento desta arena. Criamos um agora e esta tela passa a
          funcionar — depois ele aparece em Gestão → Avançado → Equipamentos.
        </p>
        <V2Button
          disabled={criar.isPending}
          onClick={async () => {
            if (criandoRef.current) return;
            criandoRef.current = true;
            try {
              await criar.mutateAsync({
                arenaId,
                input: { name: 'Totem da recepção', kind: 'qr_kiosk', location: 'Recepção' },
              });
            } finally {
              criandoRef.current = false;
            }
          }}
        >
          {criar.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <QrCode className="h-4 w-4" />}
          Criar o totem desta arena
        </V2Button>
        <Link to={`/arenas/${arenaId}/gerir/presenca`} className="text-xs text-white/60 underline">
          Voltar para a presença
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: fundo, color: tinta }}>
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-6">
        {/* Cabeçalho: marca da arena, relógio e os controles pequenos */}
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {marca.logo ? (
              <img src={marca.logo} alt="" className="h-10 w-auto max-w-[10rem] object-contain" />
            ) : null}
            <div>
              <p className="font-display text-xl font-bold leading-tight">{arena.name}</p>
              <p className="text-sm opacity-70">{marca.tagline || 'Confirme sua chegada'}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <p className="font-display text-3xl font-bold"><Relogio /></p>
            <button
              type="button"
              onClick={alternarTelaCheia}
              className="rounded-full border border-current/20 p-2 opacity-60 transition hover:opacity-100"
              aria-label={cheio ? 'Sair da tela cheia' : 'Tela cheia'}
            >
              {cheio ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </button>
          </div>
        </header>

        {/* Miolo: o QR e o código, do tamanho de quem lê de pé, a um metro */}
        <main className="flex flex-1 flex-col items-center justify-center gap-8 py-8 sm:flex-row sm:gap-14">
          <div className="rounded-3xl bg-white p-4 shadow-2xl">
            {qr ? (
              <img src={qr} alt="QR de chegada" className="h-56 w-56 sm:h-72 sm:w-72" />
            ) : (
              <div className="flex h-56 w-56 items-center justify-center sm:h-72 sm:w-72">
                <Loader2 className="h-8 w-8 animate-spin text-ink/40" />
              </div>
            )}
          </div>

          <div className="text-center sm:text-left">
            <p className="text-sm font-bold uppercase tracking-[0.2em] opacity-70">
              Aponte a câmera
            </p>
            <p className="mt-2 max-w-sm text-lg leading-6 opacity-80">
              ou digite este código no aplicativo, em <strong>Chegada</strong>:
            </p>
            <p className="mt-4 font-display text-[3.5rem] font-black leading-none tracking-[0.35em] tabular-nums sm:text-[5rem]">
              {codigo || '·····'}
            </p>
            <p className="mt-3 text-sm opacity-60">
              O código muda a cada minuto e meio.
            </p>
            {erro && (
              <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-black/20 px-3 py-1.5 text-sm">
                <WifiOff className="h-4 w-4" /> {erro}
              </p>
            )}
          </div>
        </main>

        {/* Rodapé: o cumprimento de quem acabou de chegar, e só ele */}
        <footer className="flex min-h-[4.5rem] items-center justify-center">
          {saudacao ? (
            <p className="animate-in fade-in font-display text-2xl font-bold sm:text-3xl">
              Bem-vindo, {saudacao.nome}! Bom jogo. 🎾
            </p>
          ) : (
            <Link
              to={`/arenas/${arenaId}/gerir/presenca`}
              className="inline-flex items-center gap-1.5 text-xs uppercase tracking-wider opacity-40 transition hover:opacity-80"
            >
              <ArrowLeft className="h-3 w-3" /> Painel de presença
            </Link>
          )}
        </footer>
      </div>
    </div>
  );
}
