/**
 * Peças da DUPLA na Carreira (docs/54 §PR 3) — as duas pontas do mesmo
 * pedido `career_partner`, que só o servidor grava:
 *
 *  - `CareerPartnerLayer`: a camada 3 da ficha, do lado de quem registrou —
 *    pedir a confirmação, ver a resposta e a visão da dupla, decidir se ela
 *    entra no treino, denunciar, cancelar; e, para a dupla digitada SÓ COM
 *    O NOME (PR 6), "Convidar pelo WhatsApp" com link de uso único;
 *  - `CareerPartnerInbox`: o topo da linha do tempo, do lado da DUPLA — os
 *    pedidos que chegaram ("Confirmo" / "Não foi assim"), deixar a visão e
 *    "Pôr na minha carreira também".
 *
 * A visão da dupla é PRIVADA entre os dois: nada daqui vai para página
 * pública, ranking, rating ou XP.
 */
import React, { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Check, Copy, Flag, Handshake, MessageCircle, UserCheck } from 'lucide-react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useClipboard } from '@/core/lib/useClipboard';
import { todayLocal } from '@/modules/training/domain/dates.js';
import {
  OWNER_DECISION, PARTNER_ASPECT_IDS, PARTNER_LIMITS, PARTNER_REPORT_LABEL, PARTNER_REPORT_REASONS,
  PARTNER_STATUS, PARTNER_STATUS_LABEL, ageOn, awaitsOwner, awaitsPartner, careerInvitePath, declinedNeedsChange,
  eventPartnerUids, inviteStateFor, isAdult, mirrorEventDraft, namedPartners, partnerDocFor, whatsappShareUrl,
} from '@/modules/career/domain/careerPartner.js';
import { CAREER_STATUS, entryLabel, placementText } from '@/modules/career/domain/careerEvent.js';
import { aspectLabel } from '@/modules/training/domain/debrief.js';
import { useCareerPartnerAction, useCareerPartnerInvites } from '@/modules/career/hooks/useCareer';
import { V2Badge, V2Button, V2ErrorState, V2Field, V2Select, V2Skeleton, V2Surface, V2Textarea, V2Toggle } from '@/v2/ui/primitives';
import { careerDateLabel } from './careerUi';
import { fmtData, t } from '@/core/i18n';

const TOM_STATUS = Object.freeze({ invited: 'neutral', reconfirm: 'neutral', confirmed: 'blue', declined: 'red' });

function StatusBadge({ status }) {
  return <V2Badge tone={TOM_STATUS[status] || 'neutral'}>{t(PARTNER_STATUS_LABEL[status] || PARTNER_STATUS_LABEL.invited)}</V2Badge>;
}

/** Até 3 aspectos, botões que ligam e desligam (os mesmos do balanço). */
function AspectChoice({ legenda, value, onChange, dica }) {
  const cheio = value.length >= PARTNER_LIMITS.aspects;
  const marcar = (id) => {
    if (value.includes(id)) onChange(value.filter((x) => x !== id));
    else if (!cheio) onChange([...value, id]);
  };
  return (
    <fieldset className="space-y-2" data-dica={dica}>
      <legend className="text-sm font-semibold text-ink">{legenda}</legend>
      <div className="flex flex-wrap gap-2">
        {PARTNER_ASPECT_IDS.map((id) => {
          const ativo = value.includes(id);
          return (
            <button type="button"
              key={id}
              aria-pressed={ativo}
              disabled={!ativo && cheio}
              onClick={() => marcar(id)}
              className={`min-h-11 rounded-2xl border px-3 py-2 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ink disabled:cursor-not-allowed disabled:opacity-50 ${ativo ? 'border-ink bg-ink text-acid' : 'border-gray-200 bg-paper-pure text-ink hover:border-ink/40'}`}
            >
              {aspectLabel(id)}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

/**
 * Ação sem volta em DOIS toques: o primeiro troca o botão pela consequência +
 * confirmar/cancelar (o mesmo desenho do "Excluir de vez" da ficha). O foco vai
 * para o aviso ao abrir e volta ao botão ao cancelar.
 */
function ConfirmarInline({ rotulo, aviso, confirmar, onConfirm, disabled = false, variant = 'ghost', perigo = true, children, ...rest }) {
  const [aberto, setAberto] = useState(false);
  const caixa = useRef(null);
  const mexeu = useRef(false);
  useEffect(() => {
    if (!mexeu.current) return;
    if (aberto) caixa.current?.focus();
    else caixa.current?.querySelector('button')?.focus();
  }, [aberto]);
  const trocar = (v) => { mexeu.current = true; setAberto(v); };
  if (!aberto) {
    return (
      <span ref={caixa} className="inline-flex">
        <V2Button type="button" size="sm" variant={variant} disabled={disabled} onClick={() => trocar(true)} {...rest}>{children}{rotulo}</V2Button>
      </span>
    );
  }
  return (
    <div ref={caixa} tabIndex={-1} role="group" aria-label={rotulo} className="w-full space-y-2 rounded-2xl border border-gray-200 p-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-ink">
      <p className="text-xs text-gray-600">{aviso}</p>
      <div className="flex flex-wrap gap-2">
        <V2Button type="button" size="sm" variant={perigo ? 'danger' : 'primary'} disabled={disabled} onClick={async () => { await onConfirm(); trocar(false); }}>{confirmar}</V2Button>
        <V2Button type="button" size="sm" variant="ghost" onClick={() => trocar(false)}>{t('Cancelar')}</V2Button>
      </div>
    </div>
  );
}

/** A recusa do servidor, dita ao lado da ação (o aviso flutuante some em segundos). */
function ErroDaAcao({ children }) {
  return children ? <p role="alert" className="text-xs font-semibold text-red-700">{children}</p> : null;
}

/** A visão da dupla, lida (dos dois lados). */
function FeedbackView({ feedback }) {
  if (!feedback) return null;
  const lista = (ids) => (ids || []).map(aspectLabel).join(', ');
  return (
    <dl className="space-y-1 rounded-2xl bg-paper p-3 text-sm">
      {(feedback.strengths || []).length > 0 && (<div><dt className="inline font-semibold text-ink">{t('Pontos fortes:')} </dt><dd className="inline text-gray-600">{lista(feedback.strengths)}</dd></div>)}
      {(feedback.improve || []).length > 0 && (<div><dt className="inline font-semibold text-ink">{t('O que melhorar:')} </dt><dd className="inline text-gray-600">{lista(feedback.improve)}</dd></div>)}
      {feedback.text_strength && <div><dt className="inline font-semibold text-ink">{t('O que funcionou:')} </dt><dd className="inline text-gray-600">{feedback.text_strength}</dd></div>}
      {feedback.text_improve && <div><dt className="inline font-semibold text-ink">{t('O que faltou:')} </dt><dd className="inline text-gray-600">{feedback.text_improve}</dd></div>}
      {feedback.text_drill && <div><dt className="inline font-semibold text-ink">{t('Um treino para você:')} </dt><dd className="inline text-gray-600">{feedback.text_drill}</dd></div>}
    </dl>
  );
}

/**
 * Denunciar o pedido (o outro lado escreveu algo ofensivo, falso ou com dado pessoal).
 * A denúncia não fica no pedido (a outra ponta o lê): o "enviada" é desta tela,
 * e denunciar de novo o mesmo não abre outra (o servidor confere).
 */
function ReportControl({ docId }) {
  const acao = useCareerPartnerAction();
  const [reported, setReported] = useState(false);
  const [aberto, setAberto] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [nota, setNota] = useState('');
  if (reported) return <p className="text-xs text-gray-500">{t('Denúncia enviada. A moderação da plataforma vai olhar.')}</p>;
  if (!aberto) {
    return <V2Button type="button" size="sm" variant="ghost" onClick={() => setAberto(true)}><Flag className="h-4 w-4" /> {t('Denunciar')}</V2Button>;
  }
  async function enviar() {
    try {
      await acao.mutateAsync({ action: 'report', docId, reason: motivo, note: nota });
      toast.success(t('Denúncia enviada.'));
      setAberto(false);
      setReported(true);
    } catch (err) {
      toast.error(err?.message || t('Não foi possível concluir. Tente de novo.'));
    }
  }
  const id = `denuncia-${docId}`;
  return (
    <div className="space-y-2 rounded-2xl border border-gray-100 p-3">
      <V2Field label={t('Motivo da denúncia')} htmlFor={`${id}-motivo`} required>
        <V2Select id={`${id}-motivo`} value={motivo} onChange={(e) => setMotivo(e.target.value)}>
          <option value="">{t('— Escolha —')}</option>
          {PARTNER_REPORT_REASONS.map((r) => <option key={r} value={r}>{t(PARTNER_REPORT_LABEL[r])}</option>)}
        </V2Select>
      </V2Field>
      <V2Field label={t('Conte o que aconteceu (opcional)')} htmlFor={`${id}-nota`}>
        <V2Textarea id={`${id}-nota`} rows={2} maxLength={PARTNER_LIMITS.reason} value={nota} onChange={(e) => setNota(e.target.value)} />
      </V2Field>
      <div className="flex flex-wrap gap-2">
        <V2Button type="button" size="sm" variant="danger" disabled={!motivo || acao.isPending} onClick={enviar}>{t('Enviar denúncia')}</V2Button>
        <V2Button type="button" size="sm" variant="ghost" onClick={() => setAberto(false)}>{t('Cancelar')}</V2Button>
      </div>
    </div>
  );
}

/**
 * Camada 3 da ficha: a dupla de cada categoria com conta.
 * @param {{ event: object, saved: boolean, partners: object[]|undefined, partnersError: boolean, onRetry: Function, dirty: boolean }} props
 */
export function CareerPartnerLayer({ event, saved, partners, partnersError, onRetry, dirty }) {
  const { userProfile } = useAuth();
  const citados = eventPartnerUids(event);
  const jogado = event?.status !== CAREER_STATUS.PLANNED && event?.status !== CAREER_STATUS.CANCELLED;
  const adulto = isAdult(userProfile?.birth_date, todayLocal());
  const semNascimento = ageOn(userProfile?.birth_date, todayLocal()) === null;
  const semConta = namedPartners(event);

  if (!citados.length && !semConta.length) {
    return <p className="text-xs text-gray-500">{t('Escolha a dupla da lista de usuários (na categoria, acima) para pedir que ela confirme o resultado. Dupla sem conta continua valendo: dá para convidá-la pelo WhatsApp.')}</p>;
  }
  return (
    <div className="space-y-3">
      {citados.length > 0 && (
        <CitedPartners event={event} citados={citados} saved={saved} dirty={dirty} partners={partners} partnersError={partnersError}
          onRetry={onRetry} jogado={jogado} adulto={adulto} semNascimento={semNascimento} />
      )}
      {semConta.length > 0 && (
        <NamedPartnerInvites event={event} semConta={semConta} saved={saved} dirty={dirty} jogado={jogado} adulto={adulto} semNascimento={semNascimento} />
      )}
    </div>
  );
}

/**
 * A dupla digitada SÓ COM O NOME (PR 6): "Convidar pelo WhatsApp" gera no
 * servidor um link de uso único; o WhatsApp abre no aparelho, sem número
 * guardado. Quem abrir o link e entrar na conta passa a ser a dupla do
 * registro (só se ela ainda estiver vazia) e confirma pelo caminho de sempre.
 */
function NamedPartnerInvites({ event, semConta, saved, dirty, jogado, adulto, semNascimento }) {
  const convites = useCareerPartnerInvites();
  const acao = useCareerPartnerAction();
  // O link recém-gerado (o token só existe nesta tela: o servidor guarda o hash).
  const [links, setLinks] = useState({});
  const pode = saved && !dirty && jogado && adulto;

  async function convidar(p) {
    try {
      const r = await acao.mutateAsync({ action: 'invite_link', eventId: event.id, partnerName: p.name });
      const url = `${window.location.origin}${careerInvitePath(r.token)}`;
      const msg = t('Oi, {nome}! Registrei o {torneio} na minha carreira do PickleRush com você de dupla. Entra por este link para confirmar (vale até {data}): {link}', {
        nome: p.name, torneio: event.name || t('torneio'), data: fmtData(r.expires_at_ms, { dateStyle: 'short' }), link: url,
      });
      const wa = whatsappShareUrl(msg);
      setLinks((x) => ({ ...x, [p.key]: { wa, url } }));
      // Tentativa: depois de um `await` o iPhone bloqueia a janela — por isso o botão "Abrir o WhatsApp" abaixo.
      window.open(wa, '_blank', 'noopener,noreferrer');
    } catch (err) {
      toast.error(err?.message || t('Não foi possível concluir. Tente de novo.'));
    }
  }
  async function cancelar(p, id) {
    try {
      await acao.mutateAsync({ action: 'invite_cancel', id });
      setLinks((x) => ({ ...x, [p.key]: null }));
      toast.success(t('Convite cancelado. O link parou de valer.'));
    } catch (err) {
      toast.error(err?.message || t('Não foi possível concluir. Tente de novo.'));
    }
  }

  if (convites.isError) {
    return <V2ErrorState inline title={t('Não carregaram os convites às duplas sem conta')} description={t('Sem eles não dá para saber se você já convidou.')} onRetry={() => convites.refetch()} />;
  }
  if (!convites.isSuccess) return <V2Skeleton lines={2} />;

  return (
    <ul className="space-y-3">
      {semConta.map((p) => {
        const { invite, state } = inviteStateFor(convites.data, event.id, p.key);
        const link = links[p.key];
        return (
          <li key={p.key} className="space-y-2 rounded-2xl bg-paper p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="flex items-center gap-2 text-sm font-semibold text-ink"><Handshake className="h-4 w-4" aria-hidden="true" /> {p.name}</p>
              {state === 'pending' && <V2Badge tone="neutral">{t('Link gerado · aguardando a dupla')}</V2Badge>}
              {state === 'expired' && <V2Badge tone="neutral">{t('O convite venceu')}</V2Badge>}
            </div>
            {!state && <p className="text-xs text-gray-500">{t('{nome} ainda não tem conta aqui. Mande um convite: quem entrar pelo link passa a ser a dupla deste torneio e confirma o resultado.', { nome: p.name })}</p>}
            {p.indexes.length > 1 && <p className="text-xs text-gray-500">{t('O mesmo link vale para as {n} categorias com este nome. Se são pessoas diferentes, escreva os nomes de um jeito que as distinga.', { n: p.indexes.length })}</p>}
            {state === 'pending' && <p className="text-xs text-gray-500">{t('O link vale uma vez só, até {data}.', { data: fmtData(invite.expires_at_ms, { dateStyle: 'medium' }) })}</p>}
            {!jogado && <p className="text-xs text-gray-500">{t('Dá para convidar a dupla depois que o torneio acontecer.')}</p>}
            {jogado && !adulto && <p className="text-xs text-gray-500">{semNascimento ? t('Preencha a sua data de nascimento no perfil para convidar a dupla.') : t('O convite à dupla é só para maiores de 18 anos.')}</p>}
            {dirty && <p className="text-xs text-gray-500">{t('Salve a ficha antes de convidar a dupla.')}</p>}
            {pode && (
              <div className="flex flex-wrap gap-2">
                {state === 'pending' ? (
                  <ConfirmarInline variant="secondary" perigo={false} data-dica="carreira-convidar-whatsapp" disabled={acao.isPending}
                    rotulo={t('Mandar um link novo')} confirmar={t('Gerar o link novo')} onConfirm={() => convidar(p)}
                    aviso={t('O link anterior para de valer. Se {nome} já o recebeu, mande o novo.', { nome: p.name })}>
                    <MessageCircle className="h-4 w-4" aria-hidden="true" />
                  </ConfirmarInline>
                ) : (
                  <V2Button type="button" size="sm" variant="secondary" data-dica="carreira-convidar-whatsapp" disabled={acao.isPending} onClick={() => convidar(p)}>
                    <MessageCircle className="h-4 w-4" aria-hidden="true" /> {t('Convidar pelo WhatsApp')}
                  </V2Button>
                )}
                {state === 'pending' && (
                  <V2Button type="button" size="sm" variant="ghost" disabled={acao.isPending} onClick={() => cancelar(p, invite.id)}>{t('Cancelar o convite')}</V2Button>
                )}
              </div>
            )}
            {link && <LinkDoConvite link={link} />}
          </li>
        );
      })}
    </ul>
  );
}

/**
 * O link recém-gerado: abrir o WhatsApp por um toque direto (âncora — nunca
 * bloqueada como a janela aberta depois da chamada) ou copiar para outro app.
 */
function LinkDoConvite({ link }) {
  const { copy, copied } = useClipboard();
  return (
    <div className="space-y-2 rounded-2xl border border-gray-200 p-3" role="status">
      <p className="text-xs text-gray-600">{t('O link só aparece agora: mande ou copie antes de fechar a ficha.')}</p>
      <div className="flex flex-wrap gap-2">
        <V2Button asChild size="sm" variant="primary">
          <a href={link.wa} target="_blank" rel="noopener noreferrer"><MessageCircle className="h-4 w-4" aria-hidden="true" /> {t('Abrir o WhatsApp')}</a>
        </V2Button>
        <V2Button type="button" size="sm" variant="secondary" onClick={() => copy(link.url, t('Link copiado.'))}>
          {copied ? <Check className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />} {t('Copiar link')}
        </V2Button>
      </div>
    </div>
  );
}

/** As duplas com conta: pedir a confirmação, a resposta e a visão (PR 3). */
function CitedPartners({ event, citados, saved, dirty, partners, partnersError, onRetry, jogado, adulto, semNascimento }) {
  const acao = useCareerPartnerAction();
  const [pedidos, setPedidos] = useState(() => new Set());
  const [erros, setErros] = useState({});
  const nomes = new Map((event?.entries || []).filter((e) => e?.partner?.uid).map((e) => [e.partner.uid, e.partner.name]));

  if (partnersError) return <V2ErrorState inline title={t('Não carregaram as confirmações das duplas')} description={t('Sem elas não dá para saber se você já pediu.')} onRetry={onRetry} />;
  if (partners === undefined) return <V2Skeleton lines={2} />;

  // `uid` informado ⇒ a recusa do servidor (teto de pedidos, pedido em análise…) fica dita no item.
  async function rodar(payload, ok, uid) {
    if (uid) setErros((x) => ({ ...x, [uid]: '' }));
    try {
      await acao.mutateAsync(payload);
      if (ok) toast.success(ok);
      return true;
    } catch (err) {
      const msg = err?.message || t('Não foi possível concluir. Tente de novo.');
      if (uid) setErros((x) => ({ ...x, [uid]: msg }));
      else toast.error(msg);
      return false;
    }
  }

  return (
    <ul className="space-y-3">
      {citados.map((uid) => {
        const d = partnerDocFor(partners, event.id, uid);
        const nome = d?.partner_name || nomes.get(uid) || t('Sua dupla');
        const corrigir = declinedNeedsChange(event, d);
        const enviado = !d && pedidos.has(uid);
        const podePedir = saved && !dirty && jogado && adulto && !enviado && (!d || (d.status === PARTNER_STATUS.DECLINED && !corrigir));
        return (
          <li key={uid} className="space-y-2 rounded-2xl bg-paper p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="flex items-center gap-2 text-sm font-semibold text-ink"><Handshake className="h-4 w-4" aria-hidden="true" /> {nome}</p>
              {d && <StatusBadge status={d.status} />}
            </div>
            {d?.status === PARTNER_STATUS.DECLINED && <p className="text-xs text-gray-600">{t('{nome} disse que não foi assim. Corrija a ficha (data, categoria ou colocação) e peça de novo.', { nome })} {t('Foi engano? Apague o pedido e peça de novo.')}</p>}
            {d?.status === PARTNER_STATUS.RECONFIRM && <p className="text-xs text-gray-600">{t('Você mudou a data ou o resultado: {nome} precisa confirmar de novo.', { nome })}</p>}
            {!d && !jogado && <p className="text-xs text-gray-500">{t('Dá para pedir a confirmação depois que o torneio acontecer.')}</p>}
            {!d && jogado && !adulto && <p className="text-xs text-gray-500">{semNascimento ? t('Preencha a sua data de nascimento no perfil para pedir a confirmação da dupla.') : t('A confirmação pela dupla é só para maiores de 18 anos.')}</p>}
            {enviado && <p className="text-xs text-gray-500">{t('Pedido enviado.')}</p>}
            {dirty && !d && <p className="text-xs text-gray-500">{t('Salve a ficha antes de pedir a confirmação.')}</p>}
            {podePedir && (
              <V2Button type="button" size="sm" variant="secondary" data-dica="carreira-pedir-confirmacao" disabled={acao.isPending}
                onClick={async () => { if (await rodar({ action: 'invite', eventId: event.id, partnerUid: uid }, t('Pedido enviado para {nome}.', { nome }), uid)) setPedidos((x) => new Set(x).add(uid)); }}>
                <UserCheck className="h-4 w-4" /> {t('Pedir confirmação a {nome}', { nome })}
              </V2Button>
            )}
            {d?.feedback && (
              <>
                <p className="text-xs font-semibold text-gray-600">{t('A visão de {nome} (só vocês dois veem)', { nome })}</p>
                <FeedbackView feedback={d.feedback} />
                {awaitsOwner(d) ? (
                  <div className="flex flex-wrap gap-2">
                    <V2Button type="button" size="sm" variant="primary" disabled={acao.isPending} onClick={() => rodar({ action: 'decide', docId: d.id, decision: OWNER_DECISION.USE }, t('A visão entra no foco dos seus balanços.'))}>{t('Usar no meu treino')}</V2Button>
                    <V2Button type="button" size="sm" variant="ghost" disabled={acao.isPending} onClick={() => rodar({ action: 'decide', docId: d.id, decision: OWNER_DECISION.KEEP }, t('Guardada só na ficha.'))}>{t('Guardar')}</V2Button>
                  </div>
                ) : (
                  <p className="text-xs text-gray-500">{d.owner_decision === OWNER_DECISION.USE ? t('Entra no foco dos seus balanços.') : t('Guardada só na ficha.')}</p>
                )}
              </>
            )}
            <ErroDaAcao>{erros[uid]}</ErroDaAcao>
            {d && (
              <div className="flex flex-wrap gap-2">
                <ReportControl docId={d.id} />
                <ConfirmarInline disabled={acao.isPending} rotulo={t('Apagar o pedido')} confirmar={t('Apagar de vez')}
                  aviso={d.status === PARTNER_STATUS.CONFIRMED || d.feedback
                    ? t('A confirmação e a visão de {nome} somem e será preciso pedir de novo.', { nome })
                    : t('O pedido a {nome} some. Dá para pedir de novo depois.', { nome })}
                  onConfirm={() => rodar({ action: 'remove', docId: d.id }, t('Pedido apagado.'), uid)} />
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** Formulário da visão da dupla (pontos fortes, o que melhorar, um treino). */
function FeedbackForm({ doc, onDone }) {
  const acao = useCareerPartnerAction();
  const fb = doc.feedback || {};
  const [strengths, setStrengths] = useState(fb.strengths || []);
  const [improve, setImprove] = useState(fb.improve || []);
  const [textStrength, setTextStrength] = useState(fb.text_strength || '');
  const [textImprove, setTextImprove] = useState(fb.text_improve || '');
  const [textDrill, setTextDrill] = useState(fb.text_drill || '');
  const id = `visao-${doc.id}`;
  async function enviar() {
    try {
      await acao.mutateAsync({ action: 'feedback', docId: doc.id, feedback: { strengths, improve, text_strength: textStrength, text_improve: textImprove, text_drill: textDrill } });
      toast.success(t('Visão enviada. Só vocês dois veem.'));
      onDone();
    } catch (err) {
      toast.error(err?.message || t('Não foi possível concluir. Tente de novo.'));
    }
  }
  return (
    <div className="space-y-3 rounded-2xl border border-gray-100 p-3" data-dica="carreira-visao-dupla">
      <p className="text-xs text-gray-500">{t('Até 3 de cada. Só {nome} vê, e decide se entra no treino dela(e).', { nome: doc.owner_name || t('quem registrou') })}</p>
      <AspectChoice legenda={t('Pontos fortes')} value={strengths} onChange={setStrengths} />
      <AspectChoice legenda={t('O que melhorar')} value={improve} onChange={setImprove} />
      <V2Field label={t('O que funcionou (opcional)')} htmlFor={`${id}-forte`}>
        <V2Textarea id={`${id}-forte`} rows={2} maxLength={PARTNER_LIMITS.text} value={textStrength} onChange={(e) => setTextStrength(e.target.value)} />
      </V2Field>
      <V2Field label={t('O que faltou (opcional)')} htmlFor={`${id}-faltou`}>
        <V2Textarea id={`${id}-faltou`} rows={2} maxLength={PARTNER_LIMITS.text} value={textImprove} onChange={(e) => setTextImprove(e.target.value)} />
      </V2Field>
      <V2Field label={t('Um treino que você sugere (opcional)')} htmlFor={`${id}-treino`}>
        <V2Textarea id={`${id}-treino`} rows={2} maxLength={PARTNER_LIMITS.text} value={textDrill} onChange={(e) => setTextDrill(e.target.value)} />
      </V2Field>
      <div className="flex flex-wrap gap-2">
        <V2Button type="button" size="sm" variant="primary" disabled={acao.isPending} onClick={enviar}>{t('Enviar a visão')}</V2Button>
        <V2Button type="button" size="sm" variant="ghost" onClick={onDone}>{t('Cancelar')}</V2Button>
      </div>
    </div>
  );
}

/** Um pedido recebido, do lado da dupla. */
function InboxItem({ doc, focado, onMirror }) {
  const { userProfile } = useAuth();
  const adulto = isAdult(userProfile?.birth_date, todayLocal());
  const acao = useCareerPartnerAction();
  const [visao, setVisao] = useState(false);
  // "Pôr na minha carreira também": um toque só (o vínculo chega pelo servidor depois).
  const [espelho, setEspelho] = useState('');
  const ref = useRef(null);
  useEffect(() => { if (focado) ref.current?.focus?.(); }, [focado]);
  const sm = doc.summary || {};
  const quem = doc.owner_name || t('Alguém');
  const [erro, setErro] = useState('');
  // A recusa fica dita no item ("o registro mudou", "em análise pela moderação"): o
  // hook recarrega os pedidos também no erro, então o resumo acima já é o novo.
  async function rodar(payload, ok) {
    setErro('');
    try {
      await acao.mutateAsync(payload);
      if (ok) toast.success(ok);
    } catch (err) {
      const msg = err?.message || t('Não foi possível concluir. Tente de novo.');
      setErro(msg);
      // O aviso no item pode estar longe do toque (o interruptor da vitrine fica no fim).
      toast.error(msg);
    }
  }
  // A impressão do que a dupla VIU vai junto: se o registro mudou, o servidor recusa em vez de confirmar outra coisa.
  const responder = (answer, ok) => rodar({ action: 'respond', docId: doc.id, answer, fingerprint: doc.fingerprint }, ok);
  const categorias = (sm.entries || []).map((e) => [entryLabel(e), placementText(e)].filter(Boolean).join(' · ')).filter(Boolean);
  const podeVisao = doc.status === PARTNER_STATUS.CONFIRMED && (!doc.feedback || awaitsOwner(doc));
  return (
    <li ref={ref} tabIndex={-1} className={`space-y-2 rounded-2xl border p-3 focus:outline-none ${focado ? 'border-ink' : 'border-gray-100'}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-ink">{sm.name || t('Torneio')}</p>
        <StatusBadge status={doc.status} />
      </div>
      <p className="text-xs text-gray-600">
        {[t('{quem} registrou com você', { quem }), careerDateLabel(sm.start_date, sm.date_precision), [sm.city, sm.state].filter(Boolean).join('/')].filter(Boolean).join(' · ')}
      </p>
      {categorias.length > 0 && <p className="text-xs text-gray-600">{categorias.join(' — ')}</p>}
      {awaitsPartner(doc) && (
        <div className="flex flex-wrap gap-2">
          <V2Button type="button" size="sm" variant="primary" disabled={acao.isPending} onClick={() => responder('confirm', t('Confirmado.'))}>{t('Confirmo')}</V2Button>
          <ConfirmarInline disabled={acao.isPending} rotulo={t('Não foi assim')} confirmar={t('Responder que não foi assim')}
            aviso={t('Não dá para voltar atrás: {quem} vai precisar corrigir o registro e pedir de novo.', { quem })}
            onConfirm={() => responder('decline', t('Resposta enviada.'))} />
        </div>
      )}
      <ErroDaAcao>{erro}</ErroDaAcao>
      {doc.status === PARTNER_STATUS.CONFIRMED && (
        <>
          {doc.feedback && !visao && <FeedbackView feedback={doc.feedback} />}
          {visao ? <FeedbackForm doc={doc} onDone={() => setVisao(false)} /> : (
            <div className="flex flex-wrap gap-2">
              {podeVisao && <V2Button type="button" size="sm" variant="secondary" onClick={() => setVisao(true)}>{doc.feedback ? t('Editar a sua visão') : t('Deixar a sua visão')}</V2Button>}
              {!doc.partner_event_id && espelho !== 'feito' && (
                <V2Button type="button" size="sm" variant="secondary" data-dica="carreira-por-tambem" disabled={espelho === 'enviando'}
                  onClick={async () => { setEspelho('enviando'); setEspelho((await onMirror(mirrorEventDraft(doc))) ? 'feito' : ''); }}>
                  {t('Pôr na minha carreira também')}
                </V2Button>
              )}
              {(doc.partner_event_id || espelho === 'feito') && <V2Badge tone="neutral">{t('Também na sua carreira')}</V2Badge>}
              <ConfirmarInline disabled={acao.isPending}
                rotulo={doc.feedback ? t('Retirar a visão') : t('Desfazer a confirmação')}
                confirmar={doc.feedback ? t('Retirar de vez') : t('Desfazer de vez')}
                aviso={doc.feedback
                  ? t('O que você escreveu para {quem} é apagado. A confirmação continua.', { quem })
                  : t('O selo "Confirmado pela dupla" sai da carreira de {quem}, e o pedido some da sua lista.', { quem })}
                onConfirm={() => rodar({ action: 'remove', docId: doc.id }, doc.feedback ? t('Visão retirada.') : t('Confirmação desfeita.'))} />
              <ReportControl docId={doc.id} />
            </div>
          )}
          {/* PR 7: o NOME (e a foto) da dupla na vitrine de quem registrou só com o "sim" dela; tirar vale sempre. */}
          {(adulto || doc.public_ok_partner === true) && (
            <V2Toggle id={`vitrine-${doc.id}`} checked={doc.public_ok_partner === true} disabled={acao.isPending}
              label={t('Meu nome na vitrine de {quem}', { quem })}
              hint={t('Se {quem} mostrar este torneio no perfil público, o seu nome e a sua foto aparecem junto. Sem isso, aparece só "com dupla". Você muda quando quiser.', { quem })}
              onChange={(v) => rodar({ action: 'public_consent', docId: doc.id, ok: v }, v ? t('Seu nome pode aparecer.') : t('Seu nome não aparece mais.'))} />
          )}
          {!adulto && doc.public_ok_partner !== true && ageOn(userProfile?.birth_date, todayLocal()) === null && (
            <p className="text-xs text-gray-500">{t('Preencha a sua data de nascimento no perfil para decidir se o seu nome aparece na vitrine de {quem}.', { quem })}</p>
          )}
        </>
      )}
    </li>
  );
}

/**
 * O topo da linha do tempo, do lado da dupla. Some quando não há nada; com a
 * lista falhando, diz — nunca "nenhum pedido".
 * @param {{ partners: object[]|undefined, error: boolean, onRetry: Function, focus?: string|null, onMirror: Function }} props
 */
export function CareerPartnerInbox({ partners, error, onRetry, focus = null, onMirror }) {
  const { user } = useAuth();
  const uid = user?.uid;
  if (error) return <V2ErrorState inline title={t('Não carregaram os pedidos das duplas')} description={t('Se alguém pediu para você confirmar um torneio, o pedido aparece aqui quando a conexão voltar.')} onRetry={onRetry} />;
  const recebidos = (partners || []).filter((d) => d.partner_uid === uid && d.status !== PARTNER_STATUS.DECLINED);
  if (!recebidos.length) return null;
  const abertos = recebidos.filter(awaitsPartner);
  return (
    <V2Surface as="section" variant="compacto" aria-labelledby="carreira-duplas-titulo" data-dica="carreira-duplas" className="space-y-3">
      <h2 id="carreira-duplas-titulo" className="font-display text-base font-bold text-ink">{t('Torneios em que você foi a dupla')}</h2>
      {abertos.length > 0 && <p className="text-xs text-gray-600">{t('Confirme só o que aconteceu de verdade. A confirmação vira o selo "Confirmado pela dupla" na carreira de quem registrou.')}</p>}
      <ul className="space-y-3">
        {recebidos.map((d) => <InboxItem key={d.id} doc={d} focado={focus === d.id} onMirror={onMirror} />)}
      </ul>
    </V2Surface>
  );
}
