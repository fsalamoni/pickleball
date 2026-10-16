/**
 * Configurações → E-mail e celular (`/configuracoes#email-e-celular`).
 *
 * Com a funcionalidade `external_messaging` ligada, a pessoa decide por onde
 * a plataforma fala com ela: confirma o e-mail e o celular, liga cada canal
 * (WhatsApp e SMS só com o "sim" dela), escolhe por área e por canal, o
 * horário silencioso e quem ela bloqueou. O que o admin travou aparece
 * travado, com o motivo (`effectiveValue`, a mesma conta do servidor).
 *
 * As escolhas vão em `users/{uid}.notification_channels`, gravadas campo a
 * campo; o número confirmado só o servidor grava.
 */
import React, { useMemo, useState } from 'react';
import { Mail } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useFeatureFlag } from '@/core/lib/FeatureFlagsContext';
import { FEATURE_FLAG } from '@/core/featureFlags';
import {
  useMessagingSettings, useMyMessagingAction, useMyMessagingStatus, usePublicNames,
} from '@/modules/messaging/hooks/useMessaging';
import { saveMyChannels, sendVerificationEmail, unblockSender } from '@/modules/messaging/services/messagingService';
import { AREAS, EMAIL_MODES, effectiveValue, normalizeUserChannels } from '@/modules/messaging/domain/policy';
import { CHANNEL_META, EMAIL_MODE_META } from '@/modules/messaging/domain/meta';
import { noticeAreaMeta } from '@/modules/notifications/domain/noticeFeed';
import SettingsSection from '@/v2/components/settings/SettingsSection';
import {
  V2Badge, V2Button, V2ErrorState, V2Field, V2Input, V2Select, V2Skeleton, V2Surface, V2Toggle,
} from '@/v2/ui/primitives';
import { t, fmtData } from '@/core/i18n';

/** Grava `valor` no caminho com pontos (`email.areas.jogos`) de uma cópia. */
function comCaminho(obj, caminho, valor) {
  const partes = caminho.split('.');
  const raiz = { ...(obj || {}) };
  let atual = raiz;
  partes.slice(0, -1).forEach((p) => {
    atual[p] = { ...(atual[p] && typeof atual[p] === 'object' ? atual[p] : {}) };
    atual = atual[p];
  });
  atual[partes[partes.length - 1]] = valor;
  return raiz;
}

export default function MessagingSettingsCard() {
  const ligada = useFeatureFlag(FEATURE_FLAG.EXTERNAL_MESSAGING);
  if (!ligada) return null;
  return <Cartao />;
}

function Cartao() {
  const { user, userProfile } = useAuth();
  const mercadoOn = useFeatureFlag(FEATURE_FLAG.MARKETPLACE);
  const cfg = useMessagingSettings();
  const st = useMyMessagingStatus();
  const [bruto, setBruto] = useState(() => userProfile?.notification_channels || {});
  const prefs = useMemo(() => normalizeUserChannels(bruto), [bruto]);

  const gravar = async (caminho, valor) => {
    const antes = bruto;
    setBruto((b) => comCaminho(b, caminho, valor));
    try {
      await saveMyChannels(user.uid, { [caminho]: valor });
    } catch {
      setBruto(antes);
      toast.error(t('Não foi possível salvar. Tente de novo.'));
    }
  };

  const s = st.data;
  const pronto = s?.ready || {};
  const ligados = ['email', 'whatsapp', 'sms'].filter((c) => pronto[c] && prefs[c].on && (c === 'email' ? s?.email?.verified : s?.phone?.verified));
  const resumo = !s ? undefined : ligados.length
    ? t('Recebendo por: {canais}', { canais: ligados.map((c) => t(CHANNEL_META[c].label)).join(', ') })
    : t('Só no aplicativo');

  return (
    <SettingsSection id="email-e-celular" dica="config-email-celular" icon={Mail} title={t('E-mail e celular')} summary={resumo}>
      <p className="text-sm text-gray-500">
        {t('Além do sino, a plataforma pode avisar você por e-mail, WhatsApp e SMS. Você escolhe o quê e por onde. Os avisos essenciais da sua conta (como suspensão ou reativação) chegam sempre por e-mail.')}
      </p>
      {(st.isError || cfg.isError) && (
        <V2ErrorState inline className="mt-4" onRetry={() => { st.refetch(); cfg.refetch(); }} />
      )}
      {(st.isLoading || cfg.isLoading) && <V2Skeleton className="mt-4" lines={4} />}
      {s && cfg.data && (
        <div className="mt-5 space-y-6">
          <Contatos status={s} recarregar={() => st.refetch()} onEsquecer={() => setBruto((b) => comCaminho(comCaminho(b, 'whatsapp.on', false), 'sms.on', false))} />
          <Canais status={s} prefs={prefs} gravar={gravar} />
          <PorArea status={s} prefs={prefs} settings={cfg.data.settings} gravar={gravar} mercadoOn={mercadoOn} />
          <Silencio prefs={prefs} settings={cfg.data.settings} gravar={gravar} status={s} />
          <Bloqueados prefs={prefs} uid={user?.uid} onDesbloquear={(id) => setBruto((b) => comCaminho(b, 'blocked_senders', (b.blocked_senders || []).filter((x) => x !== id)))} />
        </div>
      )}
    </SettingsSection>
  );
}

function Titulo({ children }) {
  return <h3 className="text-sm font-bold text-ink">{children}</h3>;
}

/* ---------------------------------------------------- e-mail e celular -- */

function Contatos({ status, recarregar, onEsquecer }) {
  const acao = useMyMessagingAction();
  const [enviando, setEnviando] = useState(false);
  const celularDisponivel = Boolean(status.code_channel);
  const confirmarEmail = async () => {
    setEnviando(true);
    try {
      const r = await sendVerificationEmail();
      if (r.already) { toast.success(t('Seu e-mail já está confirmado.')); recarregar(); } else toast.success(t('Enviamos o link de confirmação. Abra o e-mail e toque no link.'));
    } catch (err) { toast.error(err?.message || t('Não foi possível mandar o e-mail agora.')); } finally { setEnviando(false); }
  };
  const teste = async () => {
    try {
      const r = await acao.mutateAsync({ action: 'email_test' });
      toast.success(t('Mandamos um e-mail de teste para {email}.', { email: r.masked }));
    } catch (err) { toast.error(err?.message || t('Não foi possível mandar o teste.')); }
  };
  return (
    <section className="space-y-3">
      <Titulo>{t('Seus contatos')}</Titulo>
      <V2Surface variant="compacto" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-ink">{t('E-mail')}</p>
            <p className="text-sm text-gray-500">{status.email?.masked || t('Sua conta não tem e-mail.')}</p>
          </div>
          {status.email?.masked && (status.email.verified
            ? <V2Badge tone="green">{t('Confirmado')}</V2Badge>
            : <V2Badge tone="amber">{t('Não confirmado')}</V2Badge>)}
        </div>
        {status.email?.masked && !status.email.verified && (
          <div className="flex flex-wrap gap-2">
            <V2Button type="button" size="sm" disabled={enviando} onClick={confirmarEmail}>{enviando ? t('Enviando…') : t('Mandar o link de confirmação')}</V2Button>
            <V2Button type="button" size="sm" variant="ghost" onClick={recarregar}>{t('Já confirmei')}</V2Button>
          </div>
        )}
        {status.email?.verified && status.ready?.email && (
          <V2Button type="button" size="sm" variant="ghost" disabled={acao.isPending} onClick={teste}>{t('Mandar um e-mail de teste')}</V2Button>
        )}
      </V2Surface>
      {celularDisponivel && <Celular status={status} onEsquecer={onEsquecer} />}
    </section>
  );
}

function Celular({ status, onEsquecer }) {
  const acao = useMyMessagingAction();
  const [trocando, setTrocando] = useState(false);
  const [numero, setNumero] = useState('');
  const [codigo, setCodigo] = useState('');
  const pendente = status.pending;
  const confirmado = status.phone?.verified;
  const pedir = async (e) => {
    e?.preventDefault();
    try {
      const r = await acao.mutateAsync({ action: 'phone_send_code', phone: numero });
      setCodigo('');
      toast.success(t('Código enviado por {canal} para {numero}.', { canal: t(CHANNEL_META[r.channel]?.label || r.channel), numero: r.masked }));
    } catch (err) { toast.error(err?.message || t('Não foi possível mandar o código.')); }
  };
  const confirmar = async (e) => {
    e.preventDefault();
    try {
      await acao.mutateAsync({ action: 'phone_confirm', code: codigo });
      setTrocando(false);
      setNumero('');
      toast.success(t('Celular confirmado.'));
    } catch (err) { toast.error(err?.message || t('Não foi possível confirmar.')); }
  };
  const esquecer = async () => {
    try {
      await acao.mutateAsync({ action: 'phone_forget' });
      onEsquecer();
      toast.success(t('Número esquecido. WhatsApp e SMS desligados.'));
    } catch (err) { toast.error(err?.message || t('Não foi possível esquecer o número.')); }
  };
  const mostrarFormulario = !confirmado || trocando;
  return (
    <V2Surface variant="compacto" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-ink">{t('Celular')}</p>
          <p className="text-sm text-gray-500">{confirmado ? status.phone.masked : t('Confirme um número para receber por WhatsApp ou SMS.')}</p>
        </div>
        {confirmado && <V2Badge tone="green">{t('Confirmado')}</V2Badge>}
      </div>
      {confirmado && !trocando && (
        <div className="flex flex-wrap gap-2">
          <V2Button type="button" size="sm" variant="ghost" onClick={() => setTrocando(true)}>{t('Trocar o número')}</V2Button>
          <V2Button type="button" size="sm" variant="ghost" disabled={acao.isPending} onClick={esquecer}>{t('Esquecer o número')}</V2Button>
        </div>
      )}
      {mostrarFormulario && (
        <form onSubmit={pedir} className="flex flex-wrap items-end gap-2">
          <V2Field htmlFor="cel-numero" label={t('Número com DDD')} hint={t('Mandamos um código de 6 números. Fora do Brasil, comece com + e o código do país.')} className="min-w-[14rem] flex-1">
            <V2Input id="cel-numero" type="tel" inputMode="tel" autoComplete="tel" value={numero} onChange={(e) => setNumero(e.target.value)} placeholder="51 99999-8888" />
          </V2Field>
          <V2Button type="submit" size="sm" disabled={!numero.trim() || acao.isPending}>{pendente ? t('Mandar outro código') : t('Mandar o código')}</V2Button>
          {trocando && <V2Button type="button" size="sm" variant="subtle" onClick={() => setTrocando(false)}>{t('Cancelar')}</V2Button>}
        </form>
      )}
      {pendente && mostrarFormulario && (
        <form onSubmit={confirmar} className="flex flex-wrap items-end gap-2">
          <V2Field
            htmlFor="cel-codigo"
            label={t('Código recebido')}
            hint={t('Enviado por {canal} para {numero}. Vale até {hora}.', {
              canal: t(CHANNEL_META[pendente.channel]?.label || pendente.channel),
              numero: pendente.masked,
              hora: fmtData(pendente.expires_ms, { hour: '2-digit', minute: '2-digit' }),
            })}
            className="min-w-[10rem] flex-1"
          >
            <V2Input id="cel-codigo" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={codigo} onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ''))} placeholder="000000" />
          </V2Field>
          <V2Button type="submit" size="sm" disabled={codigo.length !== 6 || acao.isPending}>{t('Confirmar')}</V2Button>
        </form>
      )}
    </V2Surface>
  );
}

/* --------------------------------------------------------------- canais -- */

function Canais({ status, prefs, gravar }) {
  const pronto = status.ready || {};
  const celular = status.phone?.verified;
  const linhas = [
    pronto.email && {
      ch: 'email',
      hint: status.email?.verified ? t('Os avisos que você escolher abaixo, na hora ou em resumo.') : t('Confirme o e-mail acima para começar a receber.'),
      pode: true,
    },
    pronto.whatsapp && {
      ch: 'whatsapp',
      hint: celular ? t('Mensagem do número oficial do PickleRush. Responda PARAR para deixar de receber.') : t('Confirme o celular acima para ligar.'),
      pode: celular,
    },
    pronto.sms && {
      ch: 'sms',
      hint: celular ? t('Só para o que tem prazo. Responda PARAR para deixar de receber.') : t('Confirme o celular acima para ligar.'),
      pode: celular,
    },
  ].filter(Boolean);
  return (
    <section className="space-y-3">
      <Titulo>{t('Por onde receber')}</Titulo>
      {linhas.length === 0 && <p className="text-sm text-gray-500">{t('Nenhum canal está disponível ainda. Por enquanto, os avisos ficam no aplicativo.')}</p>}
      {linhas.map((l) => (
        <V2Surface key={l.ch} variant="compacto">
          {l.pode ? (
            <V2Toggle id={`canal-${l.ch}`} checked={prefs[l.ch].on === true} onChange={(v) => gravar(`${l.ch}.on`, v)} label={t(CHANNEL_META[l.ch].label)} hint={l.hint} />
          ) : (
            <div>
              <p className="text-sm font-semibold text-ink">{t(CHANNEL_META[l.ch].label)}</p>
              <p className="text-xs leading-5 text-gray-500">{l.hint}</p>
            </div>
          )}
        </V2Surface>
      ))}
      <V2Surface variant="compacto">
        <V2Toggle
          id="canal-novidades"
          checked={prefs.marketing === true}
          onChange={(v) => gravar('marketing', v)}
          label={t('Novidades e promoções')}
          hint={t('Cupons, campanhas e novidades da plataforma, das arenas e dos professores, pelos canais ligados. Desligado, você continua vendo as promoções no aplicativo.')}
        />
      </V2Surface>
    </section>
  );
}

/* ------------------------------------------------------------- por área -- */

function Celula({ ch, area, settings, prefs, gravar }) {
  const { value, lock } = effectiveValue(settings, prefs, ch, area);
  const id = `area-${area}-${ch}`;
  const rotulo = t(CHANNEL_META[ch].label);
  if (lock === 'admin_always') return <Fixo rotulo={rotulo} texto={t('Sempre (essencial)')} />;
  if (lock === 'needs_marketing') return <Fixo rotulo={rotulo} texto={t('Ligue "Novidades e promoções"')} />;
  if (ch === 'email') {
    return (
      <div className="space-y-1">
        <label htmlFor={id} className="block text-xs font-semibold text-ink">{rotulo}</label>
        <V2Select id={id} value={value} onChange={(e) => gravar(`email.areas.${area}`, e.target.value)} options={EMAIL_MODES.map((m) => ({ value: m, label: t(EMAIL_MODE_META[m].label) }))} className="h-11 text-sm" />
      </div>
    );
  }
  return (
    <label htmlFor={id} className="flex min-h-11 cursor-pointer items-center gap-2 text-sm text-ink">
      <input id={id} type="checkbox" className="h-5 w-5 accent-ink" checked={value === true} onChange={(e) => gravar(`${ch}.areas.${area}`, e.target.checked)} />
      {rotulo}
    </label>
  );
}

function Fixo({ rotulo, texto }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-semibold text-ink">{rotulo}</p>
      <p className="text-xs text-gray-500">{texto}</p>
    </div>
  );
}

function PorArea({ status, prefs, settings, gravar, mercadoOn }) {
  const pronto = status.ready || {};
  const celular = status.phone?.verified;
  // Só os canais que a pessoa pode usar agora: o resto não precisa de escolha.
  const canais = [
    pronto.email && prefs.email.on && 'email',
    pronto.whatsapp && celular && prefs.whatsapp.on && 'whatsapp',
    pronto.sms && celular && prefs.sms.on && 'sms',
    pronto.push && 'push',
  ].filter(Boolean);
  const areas = AREAS.filter((a) => a !== 'mercado' || mercadoOn)
    .filter((a) => canais.some((ch) => effectiveValue(settings, prefs, ch, a).lock !== 'admin_off'));
  return (
    <section className="space-y-3">
      <Titulo>{t('O que chega por onde')}</Titulo>
      <p className="text-xs leading-5 text-gray-500">
        {t('"Resumo do dia" junta os avisos num e-mail só, uma vez por dia. O push é a notificação no aparelho, para quem ativou o push neste aparelho.')}
      </p>
      <ul className="space-y-3">
        {areas.map((area) => (
          <V2Surface as="li" key={area} variant="compacto">
            <p className="mb-3 text-sm font-semibold text-ink">{t(noticeAreaMeta(area).label)}</p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {canais.filter((ch) => effectiveValue(settings, prefs, ch, area).lock !== 'admin_off').map((ch) => (
                <Celula key={ch} ch={ch} area={area} settings={settings} prefs={prefs} gravar={gravar} />
              ))}
            </div>
          </V2Surface>
        ))}
      </ul>
    </section>
  );
}

/* --------------------------------------------------- horário silencioso -- */

function Silencio({ prefs, settings, gravar, status }) {
  const q = prefs.quiet;
  const celularOn = status.phone?.verified && (prefs.whatsapp.on || prefs.sms.on);
  return (
    <section className="space-y-3">
      <Titulo>{t('Horário silencioso')}</Titulo>
      <V2Surface variant="compacto" className="space-y-3">
        <V2Toggle
          id="silencio-on"
          checked={q.on}
          onChange={(v) => gravar('quiet.on', v)}
          label={t('Não mandar WhatsApp e SMS de madrugada')}
          hint={t('O que cairia neste horário chega quando ele acaba. Padrão da plataforma: das {inicio} às {fim}.', { inicio: settings.quiet_hours.start, fim: settings.quiet_hours.end })}
        />
        {q.on && (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <V2Field htmlFor="silencio-inicio" label={t('Começa às')}>
                <V2Input id="silencio-inicio" type="time" value={q.start || settings.quiet_hours.start} onChange={(e) => gravar('quiet.start', e.target.value)} />
              </V2Field>
              <V2Field htmlFor="silencio-fim" label={t('Termina às')}>
                <V2Input id="silencio-fim" type="time" value={q.end || settings.quiet_hours.end} onChange={(e) => gravar('quiet.end', e.target.value)} />
              </V2Field>
            </div>
            {status.ready?.push && (
              <V2Toggle id="silencio-push" checked={q.push} onChange={(v) => gravar('quiet.push', v)} label={t('Silenciar o push também')} hint={t('Nesse horário o aparelho não toca; o aviso fica no sino.')} />
            )}
          </>
        )}
        {!celularOn && q.on && <p className="text-xs text-gray-500">{t('Vale assim que você ligar o WhatsApp ou o SMS.')}</p>}
      </V2Surface>
    </section>
  );
}

/* ----------------------------------------------------------- bloqueados -- */

function Bloqueados({ prefs, uid, onDesbloquear }) {
  const ids = prefs.blocked_senders;
  const nomes = usePublicNames(ids);
  const [tirando, setTirando] = useState('');
  if (!ids.length) return null;
  const desbloquear = async (id) => {
    setTirando(id);
    try {
      await unblockSender(uid, id);
      onDesbloquear(id);
      toast.success(t('Desbloqueado.'));
    } catch { toast.error(t('Não foi possível desbloquear.')); } finally { setTirando(''); }
  };
  return (
    <section className="space-y-3">
      <Titulo>{t('Pessoas bloqueadas')}</Titulo>
      <p className="text-xs leading-5 text-gray-500">{t('Avisos escritos por estas pessoas não chegam por e-mail, WhatsApp nem SMS (continuam no sino). Você bloqueia pelo botão "Denunciar" do e-mail.')}</p>
      <V2Surface as="ul" variant="compacto" className="divide-y divide-gray-100 p-0">
        {ids.map((id) => (
          <li key={id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
            <span className="min-w-0 truncate text-ink">{nomes.data?.[id] || (nomes.isLoading ? '…' : t('Atleta'))}</span>
            <V2Button type="button" size="sm" variant="ghost" disabled={tirando === id} onClick={() => desbloquear(id)}>{t('Desbloquear')}</V2Button>
          </li>
        ))}
      </V2Surface>
    </section>
  );
}
