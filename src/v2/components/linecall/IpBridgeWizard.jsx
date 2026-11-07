/**
 * IpBridgeWizard — o assistente da câmera IP: a pessoa diz a marca, o IP e a
 * senha de cada câmera, e a tela gera o `go2rtc.yaml` pronto para baixar e os
 * endereços da ponte, que entram na tela com um toque (`go2rtcConfig`).
 *
 * Tudo acontece neste navegador: a senha vai só para o ARQUIVO baixado, nunca
 * para o banco nem para a preferência guardada (que lembra só marca, IP e
 * nome). Ver docs/53-CONTROLE-DE-LINHAS.md §5b.
 */

import React, { useMemo, useState } from 'react';
import { Download, Plus, Trash2, Wand2, Check } from 'lucide-react';

import { V2Button, V2Input, V2Select } from '@/v2/ui/primitives';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { readViewPreference, writeViewPreference } from '@/core/lib/viewPreference';
import { go2rtcConfig, IP_CAMERA_BRANDS } from '@/modules/linecall/domain/ipCamera';
import { t, tk } from '@/core/i18n';

const PREF = 'linhas:camera-ip:assistente';
const ERROR_TEXT = {
  'name:required': tk('Dê um nome à câmera.'),
  'name:duplicate': tk('Já há uma câmera com esse nome.'),
  'host:invalid': tk('IP inválido. Exemplo: 192.168.0.30'),
  'port:invalid': tk('Porta inválida (a padrão é 554).'),
  'path:required': tk('Copie do manual da câmera o caminho do fluxo principal.'),
};
const BRAND_LABEL = {
  intelbras: tk('Intelbras'), hikvision: tk('Hikvision'), dahua: tk('Dahua / Amcrest'),
  reolink: tk('Reolink'), tapo: tk('TP-Link Tapo'), outra: tk('Outra marca (caminho do manual)'),
};

function Err({ list }) {
  return list.length ? <p className="text-xs text-red-700" role="alert">{t(ERROR_TEXT[`${list[0].field}:${list[0].code}`])}</p> : null;
}

const blank = (n) => ({ name: t('quadra 1 câmera {n}', { n }), brand: 'intelbras', host: '', port: '', user: 'admin', pass: '', path: '' });

function loadSaved(uid) {
  try {
    const v = JSON.parse(readViewPreference(uid, PREF) || 'null');
    if (!v?.cameras?.length) return null;
    // A senha nunca foi guardada; o resto volta.
    return { ...v, cameras: v.cameras.map((c) => ({ ...c, pass: '' })) };
  } catch { return null; }
}

/**
 * @param {{ onUse: (url: string) => void, suggestedName?: string }} props
 *   `onUse`: põe o endereço da ponte no campo da tela
 */
export default function IpBridgeWizard({ onUse, suggestedName }) {
  const { user } = useAuth();
  const [form, setForm] = useState(() => loadSaved(user?.uid) || {
    sameComputer: true, bridgeHost: '', cameras: [{ ...blank(1), ...(suggestedName ? { name: suggestedName } : {}) }],
  });
  const [tried, setTried] = useState(false);
  const [usado, setUsado] = useState(null);
  const result = useMemo(() => go2rtcConfig(form), [form]);
  const errs = (i, field) => (tried && !result.ok ? result.errors.filter((e) => e.index === i && e.field === field) : []);
  const setCam = (i, patch) => setForm((f) => ({ ...f, cameras: f.cameras.map((c, j) => (j === i ? { ...c, ...patch } : c)) }));

  const baixar = () => {
    setTried(true);
    if (!result.ok) return;
    writeViewPreference(user?.uid, PREF, JSON.stringify({ ...form, cameras: form.cameras.map((c) => ({ ...c, pass: '' })) }));
    const url = URL.createObjectURL(new Blob([result.yaml], { type: 'text/yaml;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'go2rtc.yaml';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };


  return (
    <div className="space-y-3" data-dica="linhas-assistente-ip">
      <p className="flex items-start gap-2 text-sm text-ink">
        <Wand2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        {t('Preencha cada câmera e baixe o arquivo da ponte pronto. A senha vai só para o arquivo, neste aparelho: o PickleRush não a guarda nem a envia.')}
      </p>
      <fieldset className="flex flex-wrap gap-2">
        <legend className="sr-only">{t('Onde a ponte vai rodar')}</legend>
        <V2Button type="button" size="sm" variant={form.sameComputer ? 'primary' : 'secondary'} aria-pressed={form.sameComputer}
          onClick={() => setForm((f) => ({ ...f, sameComputer: true }))}>
          {t('Neste computador')}
        </V2Button>
        <V2Button type="button" size="sm" variant={!form.sameComputer ? 'primary' : 'secondary'} aria-pressed={!form.sameComputer}
          onClick={() => setForm((f) => ({ ...f, sameComputer: false }))}>
          {t('Em outro computador da rede')}
        </V2Button>
      </fieldset>
      {!form.sameComputer && (
        <label className="block text-xs font-semibold text-gray-500">
          {t('IP do computador da ponte')}
          <V2Input value={form.bridgeHost} onChange={(e) => setForm((f) => ({ ...f, bridgeHost: e.target.value }))} placeholder="192.168.0.10" inputMode="decimal" autoComplete="off" className="mt-1" />
          <Err list={tried && !result.ok ? result.errors.filter((e) => e.field === 'bridgeHost') : []} />
        </label>
      )}

      <ul className="space-y-3">
        {form.cameras.map((c, i) => (
          <li key={i} className="space-y-2 rounded-2xl border border-gray-100 bg-white p-3">
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="text-xs font-semibold text-gray-500">
                {t('Nome da câmera')}
                <V2Input value={c.name} onChange={(e) => setCam(i, { name: e.target.value })} autoComplete="off" className="mt-1" />
                <Err list={errs(i, 'name')} />
              </label>
              <label className="text-xs font-semibold text-gray-500">
                {t('Marca')}
                <V2Select value={c.brand} onChange={(e) => setCam(i, { brand: e.target.value })} className="mt-1">
                  {Object.keys(IP_CAMERA_BRANDS).map((id) => <option key={id} value={id}>{t(BRAND_LABEL[id])}</option>)}
                </V2Select>
              </label>
              <label className="text-xs font-semibold text-gray-500">
                {t('IP da câmera')}
                <V2Input value={c.host} onChange={(e) => setCam(i, { host: e.target.value })} placeholder="192.168.0.30" inputMode="decimal" autoComplete="off" className="mt-1" />
                <Err list={errs(i, 'host')} />
              </label>
              <label className="text-xs font-semibold text-gray-500">
                {t('Porta RTSP')}
                <V2Input type="number" value={c.port} onChange={(e) => setCam(i, { port: e.target.value })} placeholder="554" className="mt-1" />
                <Err list={errs(i, 'port')} />
              </label>
              <label className="text-xs font-semibold text-gray-500">
                {t('Usuário da câmera')}
                <V2Input value={c.user} onChange={(e) => setCam(i, { user: e.target.value })} autoComplete="off" className="mt-1" />
              </label>
              <label className="text-xs font-semibold text-gray-500">
                {t('Senha da câmera')}
                <V2Input type="password" value={c.pass} onChange={(e) => setCam(i, { pass: e.target.value })} autoComplete="new-password" className="mt-1" />
              </label>
              {(c.brand === 'outra' || c.path) && (
                <label className="text-xs font-semibold text-gray-500 sm:col-span-2">
                  {t('Caminho do fluxo principal')}
                  <V2Input value={c.path} onChange={(e) => setCam(i, { path: e.target.value })} placeholder={IP_CAMERA_BRANDS[c.brand]?.path || '/stream1'} autoComplete="off" spellCheck={false} className="mt-1" />
                  <Err list={errs(i, 'path')} />
                </label>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {result.ok && (
                <V2Button type="button" size="sm" variant={usado === i ? 'secondary' : 'primary'} onClick={() => { onUse(result.bridges[i].url); setUsado(i); }}>
                  {usado === i ? <Check className="mr-1.5 h-4 w-4" /> : null}
                  {usado === i ? t('Endereço preenchido') : t('Usar esta câmera aqui')}
                </V2Button>
              )}
              {form.cameras.length > 1 && (
                <V2Button type="button" size="sm" variant="ghost" onClick={() => setForm((f) => ({ ...f, cameras: f.cameras.filter((_, j) => j !== i) }))}>
                  <Trash2 className="mr-1.5 h-4 w-4" /> {t('Tirar')}
                </V2Button>
              )}
            </div>
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap gap-2">
        <V2Button type="button" size="sm" variant="secondary"
          onClick={() => setForm((f) => ({ ...f, cameras: [...f.cameras, blank(f.cameras.length + 1)] }))}>
          <Plus className="mr-1.5 h-4 w-4" /> {t('Outra câmera')}
        </V2Button>
        <V2Button type="button" size="sm" onClick={baixar}>
          <Download className="mr-1.5 h-4 w-4" /> {t('Baixar go2rtc.yaml')}
        </V2Button>
      </div>
      <ol className="list-decimal space-y-1 pl-5 text-sm text-gray-600">
        <li>{t('Ponha o arquivo na mesma pasta do programa go2rtc (página de versões do projeto AlexxIT/go2rtc) e abra o programa.')}</li>
        <li>{t('Confira em http://localhost:1984, no computador da ponte, se a câmera aparece tocando.')}</li>
        <li>{t('Toque em "Usar esta câmera aqui" e depois em "Abrir câmera".')}</li>
      </ol>
    </div>
  );
}
