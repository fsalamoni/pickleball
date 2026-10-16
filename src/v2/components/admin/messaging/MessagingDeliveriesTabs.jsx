/**
 * Comunicações → Modelos (como cada mensagem chega, em cada idioma) e
 * Entregas ("por que não chegou?", registro de envios, lista de bloqueio e
 * denúncias de e-mail).
 */
import React, { useState } from 'react';
import { Search } from 'lucide-react';
import { toast } from 'sonner';
import { useMessagingAdminAction, useMessagingAdminList } from '@/modules/messaging/hooks/useMessaging';
import {
  CHANNEL_META, DECISION_ACTION_META, DECISION_REASON, OUTBOX_KIND_META, OUTBOX_STATUS_META, SUPPRESSION_REASON_META,
} from '@/modules/messaging/domain/meta';
import { CHANNELS, EXTERNAL_CHANNELS, smsSegments } from '@/modules/messaging/domain/policy';
import { noticeAreaMeta } from '@/modules/notifications/domain/noticeFeed';
import { IDIOMAS } from '@/core/i18n/languages';
import {
  V2Badge, V2Button, V2EmptyState, V2ErrorState, V2Field, V2Input, V2Select, V2Skeleton,
} from '@/v2/ui/primitives';
import { t, tk, fmtMoeda } from '@/core/i18n';
import { Block, Facts, quando } from './messagingUi';

export default function MessagingDeliveriesTabs({ tab }) {
  if (tab === 'com-modelos') return <PreviewTab />;
  return (
    <>
      <ExplainBlock />
      <OutboxBlock />
      <SuppressionsBlock />
      <ReportsBlock />
    </>
  );
}

const TONE = { success: 'green', warning: 'amber', danger: 'red', neutral: 'neutral' };
const statusBadge = (s) => {
  const m = OUTBOX_STATUS_META[s];
  return <V2Badge tone={TONE[m?.tone] || 'neutral'}>{m ? t(m.label) : s || '—'}</V2Badge>;
};
const motivo = (r) => (DECISION_REASON[r] ? t(DECISION_REASON[r]) : r || '');

/* -------------------------------------------------------------- modelos -- */

const TIPOS = [
  { value: 'notice', label: tk('Aviso da plataforma (ex.: reserva confirmada)') },
  { value: 'notice_user', label: tk('Aviso escrito por uma pessoa (ex.: convite)') },
  { value: 'digest', label: tk('Resumo do dia') },
  { value: 'password_reset', label: tk('Esqueci a senha') },
  { value: 'verify', label: tk('Confirmar o e-mail') },
  { value: 'test', label: tk('E-mail de teste') },
];
const IDIOMAS_OPCOES = IDIOMAS.map((i) => ({ value: i.codigo, label: i.nomeNativo }));

function PreviewTab() {
  const [kind, setKind] = useState('notice');
  const [lang, setLang] = useState('pt-BR');
  const q = useMessagingAdminList('preview', { kind, lang });
  const p = q.data || {};
  return (
    <Block
      title={t('Como as mensagens chegam')}
      description={t('O texto é o do próprio aviso — o mesmo do sino, no idioma de quem recebe. A moldura é fixa: cabeçalho, botão para abrir no aplicativo e rodapé com "parar de receber" e as preferências. O que muda daqui: nome do remetente, endereço e recado no rodapé (aba E-mail) e o tamanho do SMS (aba SMS). Aviso escrito por uma pessoa vai com o nome de quem mandou, links desarmados e o botão "Denunciar".')}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <V2Field htmlFor="prev-tipo" label={t('Mensagem')}>
          <V2Select id="prev-tipo" value={kind} onChange={(e) => setKind(e.target.value)} options={TIPOS.map((o) => ({ value: o.value, label: t(o.label) }))} />
        </V2Field>
        <V2Field htmlFor="prev-lang" label={t('Idioma')}>
          <V2Select id="prev-lang" value={lang} onChange={(e) => setLang(e.target.value)} options={IDIOMAS_OPCOES} />
        </V2Field>
      </div>
      {q.isError && <V2ErrorState inline onRetry={() => q.refetch()} description={q.error?.message} />}
      {q.isLoading && <V2Skeleton className="h-96 rounded-2xl" />}
      {p.email && (
        <div className="space-y-2">
          <p className="text-sm"><span className="text-gray-500">{t('Assunto:')}</span> <strong className="text-ink">{p.email.subject}</strong></p>
          <iframe
            title={t('Prévia do e-mail')}
            sandbox=""
            srcDoc={p.email.html}
            className="h-[560px] w-full rounded-2xl border border-gray-100 bg-[#fff]"
          />
          <details className="rounded-2xl border border-gray-100 bg-paper p-4">
            <summary className="cursor-pointer text-sm font-bold text-ink">{t('Versão em texto (para quem não abre HTML)')}</summary>
            <pre className="mt-2 whitespace-pre-wrap break-words text-xs leading-5 text-gray-600">{p.email.text}</pre>
          </details>
        </div>
      )}
      {p.whatsapp && (
        <div className="space-y-2 rounded-2xl border border-gray-100 p-4">
          <p className="text-sm font-bold text-ink">{t('WhatsApp (modelo de aviso)')}</p>
          <Facts items={[
            [t('Título'), p.whatsapp.params?.[0] || '—'],
            [t('Texto'), p.whatsapp.params?.[1] || '—'],
            [t('Botão "Abrir" leva a'), `/${p.whatsapp.button || ''}`],
            [t('Idioma do modelo'), p.whatsapp.lang],
          ]}
          />
        </div>
      )}
      {typeof p.sms === 'string' && (
        <div className="space-y-2 rounded-2xl border border-gray-100 p-4">
          <p className="text-sm font-bold text-ink">{t('SMS')}</p>
          <p className="rounded-xl bg-paper p-3 text-sm text-ink">{p.sms}</p>
          <p className="text-xs text-gray-500">{t('{letras} letras · {partes} SMS cobrado(s)', { letras: [...p.sms].length, partes: smsSegments(p.sms) })}</p>
        </div>
      )}
    </Block>
  );
}

/* ----------------------------------------------- por que não chegou? ----- */

function ExplainBlock() {
  const acao = useMessagingAdminAction();
  const [busca, setBusca] = useState('');
  const [r, setR] = useState(null);
  const buscar = async (e) => {
    e.preventDefault();
    setR(null);
    try { setR(await acao.mutateAsync({ action: 'explain_user', query: busca.trim() })); } catch (err) { toast.error(err?.message || t('Não foi possível consultar.')); }
  };
  return (
    <Block
      title={t('Por que não chegou?')}
      description={t('Digite o e-mail (ou o identificador) da conta. A plataforma refaz, para os últimos 15 avisos dela, a decisão de cada canal com as regras e as escolhas de hoje, e mostra o que de fato saiu. A consulta fica registrada no acesso do suporte.')}
    >
      <form onSubmit={buscar} className="flex flex-wrap items-end gap-3">
        <V2Field htmlFor="explicar-busca" label={t('E-mail ou identificador da conta')} className="min-w-[16rem] flex-1">
          <V2Input id="explicar-busca" value={busca} onChange={(e) => setBusca(e.target.value)} autoComplete="off" spellCheck={false} />
        </V2Field>
        <V2Button type="submit" size="sm" disabled={!busca.trim() || acao.isPending}><Search className="h-4 w-4" aria-hidden /> {acao.isPending ? t('Consultando…') : t('Consultar')}</V2Button>
      </form>
      {r && <ExplainResult r={r} />}
    </Block>
  );
}

function ExplainResult({ r }) {
  const sim = (v) => (v ? t('sim') : t('não'));
  return (
    <div className="space-y-4">
      <Facts items={[
        [t('Pessoa'), r.name || r.uid],
        [t('Conta'), r.closed ? t('Suspensa ou bloqueada') : t('Ativa')],
        [t('E-mail'), r.email?.masked ? `${r.email.masked} · ${r.email.verified ? t('confirmado') : t('não confirmado')}${r.email.suppressed ? ` · ${t('bloqueado')}` : ''}` : t('sem e-mail')],
        [t('Celular'), r.phone?.masked ? `${r.phone.masked}${r.phone.suppressed_whatsapp ? ` · ${t('PARAR no WhatsApp')}` : ''}${r.phone.suppressed_sms ? ` · ${t('PARAR no SMS')}` : ''}` : t('não confirmado')],
        [t('E-mail ligado'), sim(r.prefs?.email?.on)],
        [t('WhatsApp ligado'), sim(r.prefs?.whatsapp?.on)],
        [t('SMS ligado'), sim(r.prefs?.sms?.on)],
        [t('Aceita novidades'), sim(r.prefs?.marketing)],
        [t('Remetentes bloqueados'), String(r.prefs?.blocked_senders?.length || 0)],
      ]}
      />
      <div className="space-y-2">
        <p className="text-sm font-bold text-ink">{t('Últimos avisos e a decisão de cada canal')}</p>
        {r.decisions?.length ? (
          <ul className="space-y-2">
            {r.decisions.map((d) => (
              <li key={d.id} className="space-y-2 rounded-2xl border border-gray-100 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="min-w-0 text-sm font-semibold text-ink">{d.title || t('(sem título)')}</p>
                  <span className="text-xs text-gray-500">{t(noticeAreaMeta(d.area).curto)} · {quando(d.created_at_ms)}{d.read ? ` · ${t('lido')}` : ''}</span>
                </div>
                <ul className="grid gap-2 sm:grid-cols-2">
                  {CHANNELS.map((ch) => {
                    const dec = d.channels?.[ch] || {};
                    const acao = ch === 'push' ? (dec.allowed ? 'send' : 'skip') : dec.action;
                    const meta = DECISION_ACTION_META[acao] || DECISION_ACTION_META.skip;
                    return (
                      <li key={ch} className="rounded-xl bg-paper p-2 text-xs leading-5">
                        <span className="font-bold text-ink">{t(CHANNEL_META[ch].label)}</span>{' '}
                        <V2Badge tone={meta.tone} className="px-2 py-0.5">{t(meta.label)}</V2Badge>
                        <span className="mt-1 block text-gray-600">{motivo(dec.reason)}</span>
                      </li>
                    );
                  })}
                </ul>
              </li>
            ))}
          </ul>
        ) : <p className="text-sm text-gray-500">{t('Esta conta não tem avisos.')}</p>}
      </div>
      <div className="space-y-2">
        <p className="text-sm font-bold text-ink">{t('O que saiu para esta conta')}</p>
        {r.outbox?.length ? <OutboxList items={r.outbox} /> : <p className="text-sm text-gray-500">{t('Nada saiu por e-mail, WhatsApp ou SMS para esta conta nos últimos 90 dias.')}</p>}
      </div>
    </div>
  );
}

/* ------------------------------------------------- registro de envios ---- */

function OutboxList({ items }) {
  return (
    <ul className="divide-y divide-gray-100 rounded-2xl border border-gray-100">
      {items.map((o) => (
        <li key={o.id} className="flex flex-wrap items-start justify-between gap-2 p-3 text-sm">
          <div className="min-w-0">
            <p className="font-semibold text-ink">
              {t(CHANNEL_META[o.channel]?.label || o.channel)} · {OUTBOX_KIND_META[o.kind] ? t(OUTBOX_KIND_META[o.kind]) : o.kind}
              {o.area ? ` · ${t(noticeAreaMeta(o.area).curto)}` : ''}
            </p>
            <p className="text-xs text-gray-500">{quando(o.created_at_ms)}{o.to ? ` · ${o.to}` : ''}{o.provider ? ` · ${o.provider}` : ''}{o.cost_brl ? ` · ${fmtMoeda(o.cost_brl)}` : ''}</p>
            {(o.reason || o.error) && <p className="mt-0.5 text-xs text-gray-600">{o.error ? t('Erro: {erro}', { erro: o.error }) : motivo(o.reason)}</p>}
          </div>
          {statusBadge(o.status)}
        </li>
      ))}
    </ul>
  );
}

const STATUS_FILTRO = ['', 'sent', 'delivered', 'skipped', 'capped', 'suppressed', 'bounced', 'complained', 'failed', 'queued', 'digest_daily', 'digest_weekly'];

function OutboxBlock() {
  const [canal, setCanal] = useState('');
  const [estado, setEstado] = useState('');
  const q = useMessagingAdminList('outbox_list', { channel: canal, status: estado });
  return (
    <Block title={t('Registro de envios')} description={t('Os últimos envios (e decisões de não enviar) de toda a plataforma. Cada linha some sozinha depois de 90 dias.')}>
      <div className="grid gap-3 sm:grid-cols-2">
        <V2Field htmlFor="reg-canal" label={t('Canal')}>
          <V2Select id="reg-canal" value={canal} onChange={(e) => setCanal(e.target.value)} options={[{ value: '', label: t('Todos') }, ...EXTERNAL_CHANNELS.map((c) => ({ value: c, label: t(CHANNEL_META[c].label) }))]} />
        </V2Field>
        <V2Field htmlFor="reg-estado" label={t('Situação')}>
          <V2Select id="reg-estado" value={estado} onChange={(e) => setEstado(e.target.value)} options={STATUS_FILTRO.map((s) => ({ value: s, label: s ? t(OUTBOX_STATUS_META[s].label) : t('Todas') }))} />
        </V2Field>
      </div>
      {q.isError && <V2ErrorState inline onRetry={() => q.refetch()} description={q.error?.message} />}
      {q.isLoading && <V2Skeleton lines={4} />}
      {q.isSuccess && (q.data?.items?.length
        ? <OutboxList items={q.data.items} />
        : <V2EmptyState title={t('Nenhum envio com estes filtros')} description={t('Quando os canais estiverem ligados, cada aviso que sair (ou não) aparece aqui.')} />)}
    </Block>
  );
}

/* ---------------------------------------------------- lista de bloqueio -- */

function SuppressionsBlock() {
  const q = useMessagingAdminList('suppression_list', {});
  const acao = useMessagingAdminAction();
  const tirar = async (id) => {
    try {
      await acao.mutateAsync({ action: 'suppression_remove', id });
      toast.success(t('Tirado da lista. Volta a receber.'));
    } catch (err) { toast.error(err?.message || t('Não foi possível tirar.')); }
  };
  return (
    <Block
      title={t('Lista de bloqueio')}
      description={t('Endereços e números que não recebem mais: e-mail que não existe, quem marcou como spam e quem respondeu PARAR. Entram sozinhos. Só tire alguém daqui a pedido da própria pessoa: mandar de novo para quem reclamou derruba a reputação do domínio.')}
    >
      {q.isError && <V2ErrorState inline onRetry={() => q.refetch()} description={q.error?.message} />}
      {q.isLoading && <V2Skeleton lines={3} />}
      {q.isSuccess && (q.data?.items?.length ? (
        <ul className="divide-y divide-gray-100 rounded-2xl border border-gray-100">
          {q.data.items.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
              <div className="min-w-0">
                <p className="font-semibold text-ink">{s.masked || t('(endereço apagado com a conta)')}</p>
                <p className="text-xs text-gray-500">{t(CHANNEL_META[s.channel]?.label || s.channel)} · {SUPPRESSION_REASON_META[s.reason] ? t(SUPPRESSION_REASON_META[s.reason]) : s.reason} · {quando(s.created_at_ms)}</p>
              </div>
              <V2Button type="button" size="sm" variant="ghost" disabled={acao.isPending} onClick={() => tirar(s.id)}>{t('Tirar da lista')}</V2Button>
            </li>
          ))}
        </ul>
      ) : <V2EmptyState title={t('Ninguém bloqueado')} description={t('Quando um e-mail voltar ou alguém pedir para parar, aparece aqui.')} />)}
    </Block>
  );
}

/* --------------------------------------------------------- denúncias ----- */

function ReportsBlock() {
  const q = useMessagingAdminList('reports_list', {});
  const acao = useMessagingAdminAction();
  const resolver = async (id, status) => {
    try {
      await acao.mutateAsync({ action: 'report_resolve', id, status });
      toast.success(status === 'resolved' ? t('Denúncia marcada como resolvida.') : t('Denúncia descartada.'));
    } catch (err) { toast.error(err?.message || t('Não foi possível salvar.')); }
  };
  return (
    <Block
      title={t('Denúncias de e-mail')}
      description={t('Quem recebe um aviso escrito por outra pessoa pode tocar em "Denunciar" no e-mail. Quem foi denunciado não recebe nenhum aviso disso. Para agir sobre a conta (suspender, bloquear), use Pessoas → Cadastros.')}
    >
      {q.isError && <V2ErrorState inline onRetry={() => q.refetch()} description={q.error?.message} />}
      {q.isLoading && <V2Skeleton lines={3} />}
      {q.isSuccess && (q.data?.items?.length ? (
        <ul className="divide-y divide-gray-100 rounded-2xl border border-gray-100">
          {q.data.items.map((r) => (
            <li key={r.id} className="space-y-2 p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="min-w-0 text-ink">
                  {t('{quem} denunciou um aviso de {remetente}', { quem: r.reporter_name || r.reporter_uid, remetente: r.sender_name || r.sender_uid })}
                </p>
                <V2Badge tone={r.status === 'open' ? 'amber' : 'neutral'}>{r.status === 'open' ? t('Aberta') : r.status === 'resolved' ? t('Resolvida') : t('Descartada')}</V2Badge>
              </div>
              <p className="text-xs text-gray-500">
                {quando(r.created_at_ms)} · {t('{n} denúncia(s) contra este remetente', { n: r.sender_reports })}
              </p>
              {r.status === 'open' && (
                <div className="flex flex-wrap gap-2">
                  <V2Button type="button" size="sm" variant="ghost" disabled={acao.isPending} onClick={() => resolver(r.id, 'resolved')}>{t('Marcar como resolvida')}</V2Button>
                  <V2Button type="button" size="sm" variant="subtle" disabled={acao.isPending} onClick={() => resolver(r.id, 'dismissed')}>{t('Descartar')}</V2Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      ) : <V2EmptyState title={t('Nenhuma denúncia')} description={t('As denúncias feitas pelo botão do e-mail aparecem aqui.')} />)}
    </Block>
  );
}
