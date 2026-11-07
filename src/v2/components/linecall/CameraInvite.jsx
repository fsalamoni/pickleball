/**
 * CameraInvite — chamar um aparelho para uma posição: QR + link que abrem o
 * controle de linhas já como câmera NAQUELA posição. Dois jeitos:
 *
 * · com conta — o aparelho entra com uma conta que pode ser câmera (participa
 *   do dia ou organiza);
 * · sem conta (só quem organiza gera) — qualquer celular vira a câmera
 *   daquela posição até o QR vencer (3, 6 ou 12 h) ou ser cancelado. O token
 *   vai só no link; o banco guarda o hash (docs/53 §5c).
 */

import React, { useEffect, useState } from 'react';
import { Copy, QrCode, UserX } from 'lucide-react';
import { V2Button, V2Select } from '@/v2/ui/primitives';
import { useClipboard } from '@/core/lib/useClipboard';
import { createGuestInvite, guestLink, revokeGuestInvite, GUEST_HOURS } from '@/modules/linecall/services/lineGuestService';
import { cn } from '@/core/lib/utils';
import { t, fmtData } from '@/core/i18n';

/**
 * @param {string} gameDayId  o dia de jogo — ou `linkBase`, o caminho da página
 *   (`/torneios/X/linhas?quadra=Y`) quando a câmera é de uma quadra de torneio
 */
export function cameraLink(gameDayId, position, linkBase = null) {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const base = linkBase || `/dia-de-jogo/${gameDayId}/linhas`;
  return `${origin}${base}${base.includes('?') ? '&' : '?'}modo=camera&posicao=${encodeURIComponent(position)}`;
}

/**
 * @param {{ gameDayId: string, position: string, positionLabel: string, linkBase?: string,
 *   host?: string, canGuest?: boolean }} props  `host`: o caminho da quadra; `canGuest`: quem organiza
 */
export default function CameraInvite({ gameDayId, position, positionLabel, linkBase = null, host = null, canGuest = false }) {
  const [aberto, setAberto] = useState(false);
  const [modo, setModo] = useState('conta');
  const [horas, setHoras] = useState(6);
  const [convite, setConvite] = useState(null); // { url, hash, expMs }
  const [gerando, setGerando] = useState(false);
  const [falhou, setFalhou] = useState(false);
  const [png, setPng] = useState(null);
  const url = modo === 'convidado' ? convite?.url || null : cameraLink(gameDayId, position, linkBase);
  useEffect(() => {
    setPng(null);
    if (!aberto || !url) return undefined;
    let vivo = true;
    import('qrcode')
      .then((m) => m.default.toDataURL(url, { margin: 1, width: 220 }))
      .then((d) => { if (vivo) setPng(d); })
      .catch(() => { if (vivo) setPng(false); });
    return () => { vivo = false; };
  }, [aberto, url]);

  const { copy } = useClipboard();
  const copiar = () => copy(url, t('Link copiado.'));
  const gerar = async () => {
    setGerando(true);
    setFalhou(false);
    try {
      const r = await createGuestInvite(host || gameDayId, position, horas);
      setConvite({ url: guestLink(host || gameDayId, r.token), hash: r.hash, expMs: r.expMs });
    } catch {
      setFalhou(true);
    } finally { setGerando(false); }
  };
  const cancelar = async () => {
    if (!convite) return;
    try { await revokeGuestInvite(host || gameDayId, convite.hash); } catch { /* vence sozinho */ }
    setConvite(null);
  };

  if (!aberto) {
    return (
      <V2Button size="sm" variant="secondary" onClick={() => setAberto(true)} data-dica="linhas-chamar-camera">
        <QrCode className="mr-1.5 h-4 w-4" /> {t('Chamar um aparelho')}
      </V2Button>
    );
  }
  const qr = url && (png ? (
    <img src={png} alt={t('QR para abrir a câmera {p}', { p: positionLabel })} className="h-36 w-36 rounded-xl bg-white" />
  ) : png === false ? null : (
    <div className="h-36 w-36 animate-pulse rounded-xl bg-paper" aria-hidden="true" />
  ));
  return (
    <div className="mt-2 w-full space-y-3 rounded-2xl border border-gray-100 bg-white p-3">
      {canGuest && (
        <div className="flex flex-wrap gap-2" role="group" aria-label={t('Como o aparelho entra')}>
          {[['conta', t('Com conta')], ['convidado', t('Sem conta')]].map(([id, rotulo]) => (
            <button
              key={id}
              type="button"
              aria-pressed={modo === id}
              onClick={() => setModo(id)}
              className={cn('rounded-full px-3 py-1.5 text-sm font-semibold coarse:min-h-11', modo === id ? 'bg-ink text-white' : 'bg-paper text-ink')}
            >
              {rotulo}
            </button>
          ))}
        </div>
      )}
      <div className="flex flex-wrap items-start gap-3">
        {qr}
        <div className="min-w-0 flex-1 space-y-2 text-sm text-ink">
          {modo === 'conta' ? (
            <>
              <p className="font-semibold">{t('Aponte a câmera do celular para o QR')}</p>
              <p className="text-gray-600">{t('Abre já como câmera: {p}. O aparelho precisa estar logado com uma conta que participa deste dia de jogo (ou a de quem organiza, num celular separado só para isso).', { p: positionLabel })}</p>
            </>
          ) : convite ? (
            <>
              <p className="font-semibold">{t('Qualquer celular que ler este QR vira a câmera: {p}', { p: positionLabel })}</p>
              <p className="text-gray-600">{t('Sem login. Vale até {h}; mostre só a quem vai filmar.', { h: fmtData(convite.expMs, { hour: '2-digit', minute: '2-digit' }) })}</p>
            </>
          ) : (
            <>
              <p className="font-semibold">{t('Câmera sem conta')}</p>
              <p className="text-gray-600">{t('Gera um QR que transforma qualquer celular na câmera: {p}, sem login, só nesta quadra e por algumas horas.', { p: positionLabel })}</p>
              <label className="flex items-center gap-2 text-sm">
                {t('Vale por')}
                <V2Select value={horas} onChange={(e) => setHoras(Number(e.target.value))} className="w-auto">
                  {GUEST_HOURS.map((h) => <option key={h} value={h}>{t('{n} horas', { n: h })}</option>)}
                </V2Select>
              </label>
              {falhou && <p role="alert" className="text-red-600">{t('Não deu para gerar o QR. Tente de novo.')}</p>}
            </>
          )}
          <div className="flex flex-wrap gap-2">
            {modo === 'convidado' && !convite && (
              <V2Button size="sm" onClick={gerar} disabled={gerando}><QrCode className="mr-1.5 h-4 w-4" /> {gerando ? t('Gerando…') : t('Gerar QR sem conta')}</V2Button>
            )}
            {url && <V2Button size="sm" variant="secondary" onClick={copiar}><Copy className="mr-1.5 h-4 w-4" /> {t('Copiar link')}</V2Button>}
            {modo === 'convidado' && convite && (
              <V2Button size="sm" variant="ghost" onClick={cancelar}><UserX className="mr-1.5 h-4 w-4" /> {t('Cancelar este QR')}</V2Button>
            )}
            <V2Button size="sm" variant="ghost" onClick={() => setAberto(false)}>{t('Fechar')}</V2Button>
          </div>
        </div>
      </div>
    </div>
  );
}
