/**
 * BridgeFinder — a página comanda a ponte (go2rtc) da câmera IP, sem a pessoa
 * editar arquivo (docs/53 §5b):
 *
 * - ponte FORA do ar: o download certo para o sistema, o arquivo mínimo e o
 *   "liga sozinha"; a tela confere de novo a cada poucos segundos e segue
 *   sozinha quando a ponte abre;
 * - ponte NO AR: as câmeras que ela já tem (um toque abre), "Procurar câmeras
 *   na rede" (ONVIF) → usuário e senha → a câmera entra na ponte já com o
 *   nome da posição, e a tela avisa se ela manda H.265 (o navegador não toca).
 *
 * A senha vai só deste navegador para a ponte; nada vai para o banco nem fica
 * guardado aqui.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { Download, Search, Radio, AlertTriangle, Check, RefreshCw } from 'lucide-react';

import { V2Button, V2Input, V2Badge, V2Select } from '@/v2/ui/primitives';
import {
  bridgeBase, webrtcUrl, withOnvifCredentials, freeStreamName, codecPlaysInBrowser, BRIDGE_DEFAULT_BASE,
} from '@/modules/linecall/domain/bridgeDiscovery';
import {
  go2rtcBaseConfig, bridgeAutostart, guessBridgeOs, BRIDGE_DOWNLOADS, bridgeDownloadUrl, bridgeInstallCommand,
} from '@/modules/linecall/domain/ipCamera';
import CopyCodeButton from '@/v2/ui/CopyCodeButton';
import {
  bridgeStreams, discoverOnvif, cameraProfiles, addBridgeStream, probeStreamCodec,
} from '@/modules/linecall/services/bridgeService';
import IpBridgeWizard from './IpBridgeWizard';
import { baixarArquivo } from './baixarArquivo';
import { t, tk } from '@/core/i18n';

const OS_LABEL = {
  win: tk('Windows 10 ou 11'), mac_arm: tk('Mac com chip Apple (M1 em diante)'), mac_intel: tk('Mac com Intel'),
  linux: tk('Linux (PC)'), pi: tk('Raspberry Pi (64 bits)'),
};
const POLL_MS = 3000;

/**
 * @param {{ savedUrl: string, suggestedName: string, onOpen: (url: string) => void }} props
 *   `savedUrl`: o endereço já guardado (dele sai a raiz da ponte); `onOpen`: abre a câmera
 */
export default function BridgeFinder({ savedUrl, suggestedName, onOpen }) {
  const [baseText, setBaseText] = useState(() => bridgeBase(savedUrl)?.base || BRIDGE_DEFAULT_BASE);
  const bridge = bridgeBase(baseText);
  const [estado, setEstado] = useState('checking'); // checking | offline | online
  const [streams, setStreams] = useState([]);
  const [os, setOs] = useState(() => guessBridgeOs(globalThis.navigator?.userAgent, globalThis.navigator?.platform));
  const [busca, setBusca] = useState(null); // null | 'searching' | Array<device>
  const [escolhida, setEscolhida] = useState(null); // device
  const [cred, setCred] = useState({ user: 'admin', pass: '' });
  const [passo, setPasso] = useState(null); // null | 'adding' | 'probing'
  const [aviso, setAviso] = useState(null); // { tone, text }
  const [manual, setManual] = useState(false);
  const [aMao, setAMao] = useState(false);

  const conferir = useCallback(async () => {
    if (!bridge) { setEstado('offline'); return; }
    try {
      setStreams(await bridgeStreams(bridge));
      setEstado('online');
    } catch {
      setEstado('offline');
    }
  }, [bridge?.base]); // eslint-disable-line react-hooks/exhaustive-deps

  // Confere já, e de novo a cada poucos segundos enquanto a ponte não responde.
  useEffect(() => { setEstado('checking'); conferir(); }, [conferir]);
  useEffect(() => {
    if (estado !== 'offline') return undefined;
    const id = setInterval(conferir, POLL_MS);
    return () => clearInterval(id);
  }, [estado, conferir]);

  const abrirNome = (name) => onOpen(webrtcUrl(bridge.base, name), true);

  const procurar = async () => {
    setBusca('searching');
    setAviso(null);
    try {
      setBusca(await discoverOnvif(bridge));
    } catch {
      setBusca([]);
      setEstado('offline');
    }
  };

  // Liga na câmera escolhida: perfis → o principal entra na ponte → confere o formato → abre.
  const adicionar = async () => {
    const url = withOnvifCredentials(escolhida.url, cred.user.trim(), cred.pass);
    if (!url) return;
    setPasso('adding');
    setAviso(null);
    try {
      const perfis = await cameraProfiles(bridge, url);
      const principal = perfis.find((p) => p.main);
      if (!principal) {
        setAviso({ tone: 'red', text: t('A câmera não aceitou o usuário e a senha, ou não mostrou nenhum vídeo. Confira e tente de novo.') });
        return;
      }
      const nome = freeStreamName(suggestedName, streams);
      await addBridgeStream(bridge, nome, principal.url);
      setStreams((s) => [...s, nome].sort((a, b) => a.localeCompare(b)));
      setPasso('probing');
      let codec = null;
      try { codec = await probeStreamCodec(bridge, nome); } catch { /* sem saber, tenta abrir */ }
      if (!codecPlaysInBrowser(codec)) {
        setAviso({ tone: 'amber', text: t('Esta câmera manda vídeo em H.265, que o navegador não toca. No site da câmera, troque o "Codificação" do fluxo principal para H.264 e toque em "Usar" de novo.') });
        return;
      }
      setEscolhida(null);
      setCred((c) => ({ ...c, pass: '' }));
      setAviso({ tone: 'green', text: t('A câmera {nome} entrou na ponte e está abrindo.', { nome }) });
      abrirNome(nome);
    } catch (e) {
      setAviso({
        tone: 'red',
        text: e?.message === 'bridge-offline'
          ? t('A ponte parou de responder. Confira se a go2rtc continua aberta e tente de novo.')
          : t('A ponte não conseguiu falar com a câmera. Confira o usuário e a senha.'),
      });
    } finally {
      setPasso(null);
    }
  };

  const baixarScript = () => {
    const s = bridgeAutostart(os === 'win' ? 'win' : 'unix');
    baixarArquivo(s.file, s.text, s.mime);
  };
  const download = BRIDGE_DOWNLOADS.find((d) => d.id === os) || BRIDGE_DOWNLOADS[0];
  const comando = bridgeInstallCommand(os, globalThis.location?.origin);

  return (
    <div className="space-y-3" data-dica="linhas-ponte">
      <div className="flex flex-wrap items-end gap-2">
        <label className="min-w-0 flex-1 text-xs font-semibold text-gray-500">
          {t('Onde está a ponte')}
          <V2Input value={baseText} onChange={(e) => setBaseText(e.target.value)} placeholder={BRIDGE_DEFAULT_BASE} inputMode="url" autoComplete="off" spellCheck={false} className="mt-1" />
        </label>
        <V2Badge tone={estado === 'online' ? 'green' : estado === 'offline' ? 'amber' : 'neutral'}>
          {estado === 'online' ? t('Ponte no ar') : estado === 'offline' ? t('Ponte fora do ar') : t('Procurando a ponte…')}
        </V2Badge>
      </div>
      {!bridge && <p className="text-sm text-red-700" role="alert">{t('Esse não é um endereço válido. Exemplo: {ex}', { ex: BRIDGE_DEFAULT_BASE })}</p>}

      {estado === 'offline' && bridge && (
        <div className="space-y-3 rounded-2xl border border-gray-100 bg-white p-3">
          <p className="text-sm text-ink">{t('A ponte ainda não respondeu. Para ligá-la neste computador, uma vez só:')}</p>
          <div className="flex flex-wrap items-center gap-2">
            <V2Select value={os} onChange={(e) => setOs(e.target.value)} aria-label={t('Sistema do computador da ponte')} className="w-auto">
              {BRIDGE_DOWNLOADS.map((d) => <option key={d.id} value={d.id}>{t(OS_LABEL[d.id])}</option>)}
            </V2Select>
          </div>
          {/* O comando monta a ponte NESTE computador; ponte em outro da rede vai pelo passo a passo. */}
          {!bridge.local && <div className="space-y-2" data-dica="linhas-ponte-comando">
            <p className="text-sm font-semibold text-ink">
              {comando.shell === 'powershell'
                ? t('Um comando só: aperte a tecla Windows, digite PowerShell, abra, cole o comando abaixo e aperte Enter.')
                : t('Um comando só: abra o Terminal (no Mac, Command + Espaço e digite Terminal), cole o comando abaixo e aperte Enter.')}
            </p>
            <CopyCodeButton code={comando.text} size="sm" successMessage={t('Comando copiado.')} label={t('Copiar o comando de instalação da ponte')} className="max-w-full break-all text-left font-mono" />
            <p className="text-sm text-gray-500">
              {t('Ele baixa a go2rtc da página oficial, cria o arquivo da ponte, deixa a ponte ligando sozinha com o computador e já a liga. Não precisa de administrador, e rodar de novo atualiza sem perder as câmeras.')}
            </p>
          </div>}
          {!bridge.local && (
            <V2Button type="button" size="sm" variant="ghost" aria-expanded={aMao} onClick={() => setAMao(!aMao)}>
              {aMao ? t('Fechar o passo a passo à mão') : t('Prefiro fazer à mão')}
            </V2Button>
          )}
          {(aMao || bridge.local) && <ol className="list-decimal space-y-2 pl-5 text-sm text-gray-600">
            <li className="space-y-2">
              <span>{t('Baixe a go2rtc (programa gratuito, um arquivo só) para o seu sistema:')}</span>
              <div className="flex flex-wrap items-center gap-2">
                <a href={bridgeDownloadUrl(download.file)} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-ink px-3 py-1.5 text-sm font-semibold text-white coarse:min-h-11">
                  <Download className="h-4 w-4" aria-hidden="true" /> {t('Baixar a go2rtc')}
                </a>
              </div>
            </li>
            <li className="space-y-2">
              <span>{t('Baixe o arquivo da ponte e ponha na mesma pasta:')}</span>
              <div>
                <V2Button type="button" size="sm" variant="secondary" onClick={() => baixarArquivo('go2rtc.yaml', go2rtcBaseConfig({ sameComputer: !bridge.local }), 'text/yaml;charset=utf-8')}>
                  <Download className="mr-1.5 h-4 w-4" /> {t('Baixar go2rtc.yaml')}
                </V2Button>
              </div>
            </li>
            <li className="space-y-2">
              <span>{t('Para a ponte abrir sozinha sempre que o computador ligar, baixe o "liga sozinha", ponha na mesma pasta e abra-o uma vez:')}</span>
              <div>
                <V2Button type="button" size="sm" variant="secondary" onClick={baixarScript}>
                  <Download className="mr-1.5 h-4 w-4" /> {t('Baixar o "liga sozinha"')}
                </V2Button>
              </div>
            </li>
          </ol>}
          <p className="flex items-center gap-2 text-sm text-gray-500" aria-live="polite">
            <RefreshCw className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
            {t('Esta tela confere sozinha e segue quando a ponte abrir. Se o Chrome perguntar sobre a rede local, permita.')}
          </p>
        </div>
      )}

      {estado === 'online' && (
        <div className="space-y-3">
          {streams.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{t('Câmeras que a ponte já tem')}</p>
              <ul className="flex flex-wrap gap-2">
                {streams.map((n) => (
                  <li key={n}>
                    <V2Button type="button" size="sm" variant="secondary" onClick={() => abrirNome(n)}>
                      <Radio className="mr-1.5 h-4 w-4" /> {t('Usar {nome}', { nome: n })}
                    </V2Button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="space-y-2">
            <V2Button type="button" size="sm" onClick={procurar} disabled={busca === 'searching' || passo !== null}>
              <Search className="mr-1.5 h-4 w-4" />
              {busca === 'searching' ? t('Procurando na rede…') : t('Procurar câmeras na rede')}
            </V2Button>
            {Array.isArray(busca) && busca.length === 0 && (
              <p className="text-sm text-gray-600">{t('Nenhuma câmera respondeu. Confira se o ONVIF está ligado no site da câmera e se ela está na mesma rede da ponte, ou preencha à mão abaixo.')}</p>
            )}
            {Array.isArray(busca) && busca.length > 0 && (
              <ul className="space-y-2">
                {busca.map((d) => (
                  <li key={d.host} className="rounded-2xl border border-gray-100 bg-white p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-ink">{d.info || t('Câmera')}</p>
                        <p className="text-xs text-gray-500">{d.host}</p>
                      </div>
                      {escolhida?.host !== d.host && (
                        <V2Button type="button" size="sm" variant="secondary" onClick={() => { setEscolhida(d); setAviso(null); }}>
                          {t('Usar esta')}
                        </V2Button>
                      )}
                    </div>
                    {escolhida?.host === d.host && (
                      <form className="mt-2 grid gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end" onSubmit={(e) => { e.preventDefault(); adicionar(); }}>
                        <label className="text-xs font-semibold text-gray-500">
                          {t('Usuário da câmera')}
                          <V2Input value={cred.user} onChange={(e) => setCred((c) => ({ ...c, user: e.target.value }))} autoComplete="off" className="mt-1" />
                        </label>
                        <label className="text-xs font-semibold text-gray-500">
                          {t('Senha da câmera')}
                          <V2Input type="password" value={cred.pass} onChange={(e) => setCred((c) => ({ ...c, pass: e.target.value }))} autoComplete="new-password" className="mt-1" />
                        </label>
                        <V2Button type="submit" size="sm" disabled={passo !== null}>
                          {passo === 'adding' ? t('Ligando na câmera…') : passo === 'probing' ? t('Conferindo o vídeo…') : t('Ligar e abrir')}
                        </V2Button>
                      </form>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {aviso && (
        <p role={aviso.tone === 'green' ? 'status' : 'alert'}
          className={`flex items-start gap-2 text-sm ${aviso.tone === 'green' ? 'text-green-700' : aviso.tone === 'amber' ? 'text-amber-800' : 'text-red-700'}`}>
          {aviso.tone === 'green' ? <Check className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /> : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />}
          {aviso.text}
        </p>
      )}

      <V2Button type="button" size="sm" variant="ghost" aria-expanded={manual} onClick={() => setManual(!manual)}>
        {manual ? t('Fechar o preenchimento à mão') : t('Câmera sem ONVIF: preencher marca, IP e senha à mão')}
      </V2Button>
      {manual && (
        <IpBridgeWizard
          suggestedName={suggestedName}
          bridge={estado === 'online' ? bridge : null}
          onUse={onOpen}
        />
      )}
    </div>
  );
}
