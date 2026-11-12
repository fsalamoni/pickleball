/**
 * A FICHA do torneio de fora (Carreira, docs/54 §4.2), em camadas:
 *  1. Resultado — colocação, faixa, pontuação declarada, federação, link;
 *  2. Foto — medalha, pódio, chave (destrava o cartão para compartilhar);
 *  3. Dupla — o nome (e a conta, quando escolhida da lista de usuários). O
 *     convite à dupla é do PR 3;
 *  4. Balanço — o balanço do jogo com a origem `externo` (só torneio JOGADO),
 *     que dá a semana de drills sugerida. Nada entra nos treinos sem "Adicionar".
 * O cabeçalho diz "3 de 4" e o ÚNICO próximo passo. Com os balanços sem
 * carregar, a conta não aparece (não afirma o que falta sem saber).
 *
 * "É este?": o torneio parece um da plataforma em que a pessoa jogou? Ela
 * confirma (o registro passa a apontar para o oficial) ou diz "não é".
 */
import React, { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Camera, Link2, Plus, Repeat, Share2, Trash2, UserRound } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useFeatureFlag } from '@/core/lib/FeatureFlagsContext';
import { FEATURE_FLAG } from '@/core/featureFlags';
import { readViewPreference, writeViewPreference } from '@/core/lib/viewPreference';
import { BR_UFS } from '@/core/domain/ufs.js';
import { AGE_CATEGORY_LABELS } from '@/modules/tournament/domain/constants.js';
import { usePublicFederations } from '@/modules/federations/hooks/useFederations';
import { prepareUpload } from '@/modules/training/services/mediaUploadService';
import {
  CAREER_AGES, CAREER_FORMAT, CAREER_LAYER, CAREER_LIMITS, CAREER_STATUS, LEVEL_BRACKETS, PHOTO_KIND, PHOTO_KIND_LABEL, PLACEMENT, PLACEMENT_LABEL,
  bestPosition, careerCompleteness, careerSeal, entryLabel, formatHasPartner, levelBracketText, matchPlatformTournament, normalizeCareerLink, withDerivedStatus,
} from '@/modules/career/domain/careerEvent.js';
import { SEAL, careerTrophies } from '@/modules/career/domain/timeline.js';
import { todayLocal } from '@/modules/training/domain/dates.js';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { partnerSealFor } from '@/modules/career/domain/careerPartner.js';
import { careerDebriefFor, careerDebriefSource } from '@/modules/career/domain/careerDebrief.js';
import { aspectLabel } from '@/modules/training/domain/debrief.js';
import { useMyDebriefs } from '@/modules/training/hooks/useDebriefs';
import { deleteCareerPhoto, uploadCareerPhoto } from '@/modules/career/services/careerService';
import { useDeleteCareerEvent } from '@/modules/career/hooks/useCareer';
import { useTrainingIdentity } from '@/modules/training/hooks/useTrainingIdentity';
import { useQuery } from '@tanstack/react-query';
import { listAthletes } from '@/modules/athletes/services/athleteService';
import PartnerPicker from '@/v2/components/people/PartnerPicker';
import { CareerPartnerLayer } from './CareerPartnerUi';
import CareerShowcaseLayer from './CareerShowcaseLayer';
import { CareerCoachShare, CareerHowItWent, CareerPlanFields, careerDateBounds, howItWentAnswer } from './CareerPlanFields';
import { V2Button, V2ErrorState, V2Field, V2Input, V2Select, V2Skeleton, V2Textarea, V2Toggle } from '@/v2/ui/primitives';
import { ChoiceGroup, FORMAT_CHOICES, GENDER_CHOICES_ALL, SealBadge, careerDateLabel } from './careerUi';
import { t } from '@/core/i18n';

const MedalCardDialog = lazy(() => import('@/v2/components/trophies/MedalCardDialog'));
const CareerDebriefDialog = lazy(() => import('./CareerDebriefDialog'));

/** Só imagem, < 3 MB (o `storage.rules` confere o mesmo). */
const LIMITES_FOTO = Object.freeze({ imageMb: 3, videoEnabled: false, videoMb: 0, videoSeconds: 0 });
/** Os "não é este" de cada pessoa (no navegador, por uid). */
const PREF_NAO_E = 'carreira:nao-e';
/** O formulário da ficha: os campos fora dele se ligam por `form=` (Enter e o "Ir" do teclado salvam). */
const FORM = 'ficha-form';

function Camada({ n, titulo, dica, children }) {
  return (
    <section data-dica={dica} className="space-y-3 rounded-3xl border border-gray-100 p-4">
      <h3 className="flex items-center gap-2 font-display text-base font-bold text-ink">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-ink text-xs text-acid" aria-hidden="true">{n}</span>
        {titulo}
      </h3>
      {children}
    </section>
  );
}

/** Erro de um campo: o texto com id, para o `aria-describedby` do campo. */
const erroDe = (id, msg) => (msg ? <span id={`${id}-erro`}>{msg}</span> : null);
const ariaErro = (id, msg) => (msg ? { 'aria-invalid': true, 'aria-describedby': `${id}-erro` } : {});

/**
 * Confere o que o normalizador descartaria CALADO (a tela diria "Ficha salva."
 * sem o link, a data final ou os pontos). `{ erros, valor }`: `erros` por id de
 * campo; `valor` com o link já completado com `https://` quando só faltava isso.
 */
export function conferirFicha(f, { semColocacao = false } = {}) {
  const erros = {};
  let valor = f;
  if (!String(f.name || '').trim()) erros['ficha-nome'] = t('Dê um nome ao torneio.');
  if (f.end_date && f.start_date && f.end_date < f.start_date) erros['ficha-fim'] = t('O último dia não pode ser antes do começo.');
  const link = String(f.link || '').trim();
  if (link && !normalizeCareerLink(link)) {
    const comEsquema = /^[a-z][a-z0-9+.-]*:/i.test(link) ? '' : normalizeCareerLink(`https://${link}`);
    if (comEsquema) valor = { ...f, link: comEsquema };
    else erros['ficha-link'] = t('O link precisa começar com https:// e ser um endereço completo.');
  }
  const fora = (v, min, max) => v !== null && v !== undefined && v !== '' && !(Number(v) >= min && Number(v) <= max);
  if (!semColocacao) {
    (f.entries || []).forEach((e, i) => {
      if (e.placement === PLACEMENT.OTHER && fora(e.placement_n, 1, 999)) erros[`carreira-cat-${i}-n`] = t('Posição entre 1 e 999.');
      if (fora(e.points_declared, 0, 100000)) erros[`carreira-cat-${i}-pts`] = t('Pontos entre 0 e 100.000.');
    });
  }
  return { erros, valor };
}

function Participacao({ entry, idx, onChange, onRemove, selfUid, past, formId, semColocacao = false, erros = {} }) {
  const [escolher, setEscolher] = useState(false);
  // O MESMO diretório (e cache) do convite de parceiro da inscrição de torneio.
  const diretorio = useQuery({ queryKey: ['athletes'], queryFn: listAthletes, enabled: escolher });
  const set = (k, v) => onChange({ ...entry, [k]: v });
  const id = `carreira-cat-${idx}`;
  return (
    <div className="space-y-3 rounded-2xl bg-paper p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-ink">{entryLabel(entry)}</p>
        {onRemove && <V2Button type="button" size="sm" variant="ghost" onClick={onRemove} aria-label={t('Tirar esta categoria')}><Trash2 className="h-4 w-4" /></V2Button>}
      </div>
      <ChoiceGroup label={t('Formato')} options={FORMAT_CHOICES} value={entry.format} onChange={(v) => set('format', v || CAREER_FORMAT.DOUBLES)} />
      <ChoiceGroup label={t('Categoria')} options={GENDER_CHOICES_ALL} value={entry.gender} onChange={(v) => set('gender', v)} allowNone />
      <div className="grid gap-3 sm:grid-cols-2">
        {/* Torneio que ainda não começou (ou "Não fui"): não há colocação a contar. */}
        {!semColocacao && (
          <V2Field label={t('Colocação')} htmlFor={`${id}-col`}>
            <V2Select id={`${id}-col`} value={entry.placement || ''} onChange={(e) => set('placement', e.target.value || null)}>
              <option value="">{t('— Não sei / prefiro não dizer —')}</option>
              {Object.values(PLACEMENT).map((p) => <option key={p} value={p}>{t(PLACEMENT_LABEL[p])}</option>)}
            </V2Select>
          </V2Field>
        )}
        {!semColocacao && entry.placement === PLACEMENT.OTHER && (
          <V2Field label={t('Posição')} htmlFor={`${id}-n`} error={erroDe(`${id}-n`, erros[`${id}-n`])}>
            <V2Input id={`${id}-n`} form={formId} type="number" min={1} max={999} value={entry.placement_n ?? ''} onChange={(e) => set('placement_n', e.target.value)} {...ariaErro(`${id}-n`, erros[`${id}-n`])} />
          </V2Field>
        )}
        <V2Field label={t('Faixa de nível')} htmlFor={`${id}-faixa`}>
          <V2Select id={`${id}-faixa`} value={entry.level_bracket || ''} onChange={(e) => set('level_bracket', e.target.value || null)}>
            <option value="">{t('— Sem faixa —')}</option>
            {LEVEL_BRACKETS.map((b) => <option key={b} value={b}>{levelBracketText(b)}</option>)}
            {/* Faixa da lista antiga, já gravada: continua escolhida, como foi gravada. */}
            {entry.level_bracket && !LEVEL_BRACKETS.includes(entry.level_bracket) && <option value={entry.level_bracket}>{entry.level_bracket}</option>}
          </V2Select>
        </V2Field>
        {entry.level_bracket === 'other' && (
          <V2Field label={t('Qual faixa?')} htmlFor={`${id}-faixa-l`}>
            <V2Input id={`${id}-faixa-l`} form={formId} value={entry.level_label || ''} maxLength={CAREER_LIMITS.label} onChange={(e) => set('level_label', e.target.value)} />
          </V2Field>
        )}
        <V2Field label={t('Idade')} htmlFor={`${id}-idade`}>
          <V2Select id={`${id}-idade`} value={entry.age || ''} onChange={(e) => set('age', e.target.value || null)}>
            <option value="">{t('— Sem idade —')}</option>
            {CAREER_AGES.map((a) => <option key={a} value={a}>{a === 'other' ? t('Outra') : AGE_CATEGORY_LABELS[a]}</option>)}
          </V2Select>
        </V2Field>
        {entry.age === 'other' && (
          <V2Field label={t('Qual idade?')} htmlFor={`${id}-idade-l`}>
            <V2Input id={`${id}-idade-l`} form={formId} value={entry.age_label || ''} maxLength={CAREER_LIMITS.label} placeholder={t('Ex.: 40+')} onChange={(e) => set('age_label', e.target.value)} />
          </V2Field>
        )}
        {!semColocacao && (
          <V2Field label={t('Pontos no ranking (declarados)')} htmlFor={`${id}-pts`} hint={t('O que a federação diz que você ganhou. Não entra em ranking nenhum daqui.')} error={erroDe(`${id}-pts`, erros[`${id}-pts`])}>
            <V2Input id={`${id}-pts`} form={formId} type="number" min={0} max={100000} value={entry.points_declared ?? ''} onChange={(e) => set('points_declared', e.target.value)} {...ariaErro(`${id}-pts`, erros[`${id}-pts`])} />
          </V2Field>
        )}
      </div>
      {formatHasPartner(entry.format) && (
        <div className="space-y-2">
          <V2Field label={semColocacao ? t('Com quem você vai jogar') : t('Com quem você jogou')} htmlFor={`${id}-dupla`}>
            {/* Conta escolhida da lista: o nome é o da conta. Editá-lo trocaria a dupla por um nome solto (sem conta), calado. */}
            <V2Input
              id={`${id}-dupla`}
              form={formId}
              value={entry.partner?.name || ''}
              maxLength={CAREER_LIMITS.partner}
              readOnly={Boolean(entry.partner?.uid)}
              aria-describedby={entry.partner?.uid ? `${id}-dupla-conta` : undefined}
              onChange={(e) => set('partner', e.target.value ? { name: e.target.value } : null)}
              placeholder={t('Nome da dupla')}
            />
          </V2Field>
          {entry.partner?.uid && <p id={`${id}-dupla-conta`} className="text-xs text-gray-500">{t('Conta escolhida da lista de usuários: o nome é o da conta. Para mudar, troque ou tire a dupla.')}</p>}
          <div className="flex flex-wrap gap-2">
            <V2Button type="button" size="sm" variant="ghost" aria-expanded={escolher} onClick={() => setEscolher((v) => !v)}>
              <UserRound className="h-4 w-4" /> {escolher ? t('Fechar a lista') : entry.partner?.uid ? t('Trocar a dupla') : t('Escolher da lista de usuários')}
            </V2Button>
            {entry.partner?.uid && (
              <V2Button type="button" size="sm" variant="ghost" onClick={() => set('partner', null)}>{t('Tirar a dupla')}</V2Button>
            )}
          </div>
          {escolher && (
            // Enter na busca da lista não envia o formulário da ficha.
            <div onKeyDown={(e) => { if (e.key === 'Enter' && e.target.tagName === 'INPUT') e.preventDefault(); }}>
            <PartnerPicker
              id={`${id}-pessoa`}
              athletes={diretorio.data || []}
              falhou={diretorio.isError}
              carregando={diretorio.isPending}
              selfUid={selfUid}
              past={past}
              label={t('Escolher a dupla da lista de usuários')}
              selectedHint={t('Ela pode confirmar o resultado depois.')}
              footHint={null}
              onClear={() => set('partner', null)}
              onSelect={(a) => {
                set('partner', { uid: a.uid || a.id, name: a.platform_name || '' });
                setEscolher(false);
              }}
            />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * @param {{ event: object|null, open: boolean, onOpenChange: Function, save: Function,
 *   myTournaments?: object[], onRepeat?: (ev: object) => void, saved?: boolean,
 *   partners?: object[], partnersError?: boolean, onRetryPartners?: Function, past?: object[] }} props
 */
export default function CareerEventSheet({
  event, open, onOpenChange, save, myTournaments, onRepeat,
  saved = false, partners, partnersError = false, onRetryPartners, past = [],
}) {
  const { user, userProfile } = useAuth();
  const uid = user?.uid || null;
  const [f, setF] = useState(() => withDerivedStatus(event));
  // A linha de base do rascunho, por REFERÊNCIA: "há alteração não salva" é `f !== base`.
  // Comparar o conteúdo com o evento relido mentia (ordem das chaves, `updated_at_ms`,
  // `planned_passed`): a ficha ficava "não salva" para sempre e dupla e vitrine travavam.
  const [base, setBase] = useState(f);
  const fAtual = useRef(f);
  fAtual.current = f;
  const [busy, setBusy] = useState('');
  const [erro, setErro] = useState('');
  const [erros, setErros] = useState({});
  // "Joguei" no "Como foi?" (o "Não fui" mora no status do rascunho).
  const [foi, setFoi] = useState(false);
  // A pergunta de confirmação em aberto: fechar/repetir com alteração, excluir, tirar foto.
  const [pergunta, setPergunta] = useState(null);
  const [cartao, setCartao] = useState(false);
  const [naoE, setNaoE] = useState(() => readViewPreference(uid, PREF_NAO_E) || '');
  const arquivo = useRef(null);
  const remover = useDeleteCareerEvent();
  const fedOn = useFeatureFlag(FEATURE_FLAG.FEDERATIONS);
  const fedQ = usePublicFederations({ enabled: open && fedOn && Boolean(f?.federated) });

  const [balanco, setBalanco] = useState(false);

  // O rascunho recomeça ao ABRIR ou ao trocar de torneio — nunca a cada recarga da
  // lista (mandar ao professor recarrega, e o que estava sendo editado sumiria).
  useEffect(() => {
    if (!open) return;
    const novo = withDerivedStatus(event);
    setF(novo); setBase(novo); setErro(''); setErros({}); setFoi(false); setPergunta(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, event?.id]);
  // O balanço só leva o professor com o vínculo ATIVO: com ele encerrado, a regra
  // recusaria a CRIAÇÃO do balanço (`coachOk` confere `hasActiveStudent`).
  const identity = useTrainingIdentity();
  const professorDoBalanco = f?.shared_coach_id && (identity.coachLinks || []).some((l) => l.coach_id === f.shared_coach_id)
    ? f.shared_coach_id : null;

  const match = useMemo(() => (f && !naoE.split(',').includes(f.id) ? matchPlatformTournament(f, myTournaments) : null), [f, myTournaments, naoE]);
  // Camada 4: o balanço — só de torneio JOGADO (a origem sai do documento gravado, não do rascunho da tela).
  const gravado = useMemo(() => withDerivedStatus(event), [event]);
  const fonteBalanco = useMemo(() => careerDebriefSource(gravado), [gravado]);
  // Os balanços servem à camada 4 (jogado) e ao foco SUGERIDO do planejado.
  const balancos = useMyDebriefs(uid, { enabled: open && (Boolean(fonteBalanco) || gravado?.status === CAREER_STATUS.PLANNED) });
  const feito = balancos.isSuccess ? careerDebriefFor(gravado, balancos.data) : null;
  // Só com a origem GRAVADA a camada vale: o rascunho que virou "jogado" ainda não abre o diálogo.
  const completude = f ? careerCompleteness(f, fonteBalanco && balancos.isSuccess ? { debriefDone: Boolean(feito) } : {}) : null;
  // Sem saber do balanço, a conta "3 de 3" diria que a ficha está completa: não mostra.
  const contaConhecida = !fonteBalanco || balancos.isSuccess;
  const trofeus = useMemo(() => (f ? careerTrophies([f], { myTournaments, me: { uid, name: userProfile?.platform_name || user?.displayName || t('Você'), photo_url: userProfile?.photo_url || null } }) : []), [f, myTournaments, uid, userProfile, user]);
  if (!f) return null;

  const hoje = todayLocal();
  const sujo = f !== base;
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const setEntry = (i, e) => setF((x) => ({ ...x, entries: x.entries.map((y, j) => (j === i ? e : y)) }));
  // Mudar a data refaz o status NA HORA (o plano cuja data passou pergunta "Como foi?";
  // o jogado que foi para o futuro vira plano) — antes isso só acontecia, calado, ao salvar.
  const setDatas = (patch) => setF((x) => {
    const novo = { ...x, ...patch };
    // Data pela metade (o teclado passa por 0002, 0020…): guarda o que foi digitado e não mexe no status.
    if (!(String(novo.start_date) >= datas.min && String(novo.start_date) <= datas.max)) return novo;
    const eraPlano = x.planned_passed || x.status === CAREER_STATUS.PLANNED;
    delete novo.planned_passed;
    if (x.status !== CAREER_STATUS.CANCELLED && eraPlano) novo.status = CAREER_STATUS.PLANNED;
    const derivado = withDerivedStatus(novo, hoje);
    // O que já estava gravado como JOGADO e só passeou pelo futuro não volta perguntando "Como foi?".
    if (derivado.planned_passed && base.status === CAREER_STATUS.PLAYED && !base.planned_passed) {
      const semPergunta = { ...derivado };
      delete semPergunta.planned_passed;
      return semPergunta;
    }
    return derivado;
  });
  // Ainda não começou, ou "Não fui": não há colocação, pontos nem foto a contar.
  const semColocacaoDe = (x) => x.status === CAREER_STATUS.CANCELLED || (x.status === CAREER_STATUS.PLANNED && String(x.start_date) > hoje);
  const semColocacao = semColocacaoDe(f);
  const resposta = howItWentAnswer(f, foi);
  const responder = (v) => {
    if (!v) return;
    setFoi(v === 'sim');
    setF((x) => ({ ...x, status: v === 'nao' ? CAREER_STATUS.CANCELLED : CAREER_STATUS.PLAYED }));
  };

  /**
   * Grava o rascunho ATUAL (com `montar` por cima: a foto nova, o "É este").
   * Devolve `{ saved }` (`false` = ficou na fila deste aparelho) ou `null` se não gravou.
   */
  async function gravar(montar = (x) => x, okMsg = t('Ficha salva.'), { avisar = false } = {}) {
    const inicio = fAtual.current;
    const falhou = (msg) => { setErro(msg); if (avisar) toast.error(msg); return null; };
    const { erros: novos, valor } = conferirFicha(montar(inicio), { semColocacao: semColocacaoDe(inicio) });
    setErros(novos);
    const campos = Object.keys(novos);
    if (campos.length) {
      document.getElementById(campos[0])?.focus();
      return falhou(t('Confira os campos marcados antes de salvar.'));
    }
    // O plano que passou não vira "jogado" calado: a pessoa diz se foi.
    if (valor.planned_passed && !howItWentAnswer(valor, foi)) {
      document.querySelector('[data-dica="carreira-como-foi"] button')?.focus();
      return falhou(t('Antes de salvar, conte como foi: "Joguei" ou "Não fui".'));
    }
    setErro('');
    setBusy('salvar');
    try {
      const { saved: enviado, event: gravadoAgora } = await save(valor);
      const novo = { ...valor, ...gravadoAgora };
      delete novo.planned_passed; // respondido
      if (fAtual.current === inicio) { setF(novo); setBase(novo); }
      // Mexeu na ficha durante o envio: o que foi digitado fica (e segue "não salvo").
      else setF((x) => ({ ...montar(x), id: novo.id, updated_at_ms: novo.updated_at_ms }));
      if (enviado) toast.success(okMsg);
      else toast.message(t('Guardado neste aparelho. Enviamos quando a conexão voltar.'));
      return { saved: enviado === true };
    } catch (err) {
      // O envio pode seguir vivo: guardar o id faz a nova tentativa regravar o MESMO registro.
      if (err?.event?.id) setF((x) => (x && !x.id ? { ...x, id: err.event.id } : x));
      return falhou(err?.code === 'permission-denied' ? t('O registro de torneios está desligado agora.') : (err?.message || t('Não foi possível salvar. Tente de novo.')));
    } finally {
      // A foto em envio segue marcada: só o próprio salvar se desmarca.
      setBusy((b) => (b === 'salvar' ? '' : b));
    }
  }

  async function porFoto(file) {
    if (!file || (fAtual.current.photos || []).length >= CAREER_LIMITS.photos) return;
    setBusy('foto');
    try {
      const pronto = await prepareUpload(file, LIMITES_FOTO);
      if (!pronto.ok || pronto.type !== 'image') { toast.error(pronto.error || t('Só imagem: JPG, PNG ou WebP.')); return; }
      const { path, url } = await uploadCareerPhoto(uid, pronto.file);
      // Sobre o rascunho de AGORA: o envio leva segundos e a pessoa pode ter seguido editando.
      const comFoto = (x) => {
        const kind = bestPosition(x) ? 'medal' : 'podium';
        return { ...x, photos: [...(x.photos || []).filter((p) => p.path !== path), { path, url, kind, alt: `${t(PHOTO_KIND_LABEL[kind])} — ${x.name}` }] };
      };
      // Sem o documento que aponta para ela, a foto ficaria órfã no Storage.
      if (!(await gravar(comFoto, t('Foto guardada.'), { avisar: true }))) deleteCareerPhoto(path);
    } catch (err) {
      toast.error(err?.message || t('Não foi possível enviar a foto. Confira a conexão e tente de novo.'));
    } finally {
      setBusy('');
      if (arquivo.current) arquivo.current.value = '';
    }
  }

  async function tirarFoto(path) {
    const r = await gravar((x) => ({ ...x, photos: (x.photos || []).filter((p) => p.path !== path) }), t('Foto removida.'), { avisar: true });
    // Só com o servidor confirmando: na fila, o documento do servidor ainda aponta para o arquivo.
    if (r?.saved === true) deleteCareerPhoto(path);
  }

  function setFoto(path, k, v) {
    setF((x) => ({ ...x, photos: x.photos.map((p) => (p.path === path ? { ...p, [k]: v } : p)) }));
  }

  function naoEEste() {
    const lista = [...naoE.split(',').filter(Boolean), f.id].slice(-50).join(',');
    writeViewPreference(uid, PREF_NAO_E, lista);
    setNaoE(lista);
  }

  async function excluir() {
    try {
      await remover.mutateAsync(f);
      toast.success(t('Torneio excluído.'));
      setPergunta(null);
      onOpenChange(false);
    } catch (err) {
      const msg = err?.message || t('Não foi possível excluir. Tente de novo.');
      setPergunta(null);
      setErro(msg);
      toast.error(msg);
    }
  }

  // Fechar (X, Esc, Voltar do diálogo) com alteração não salva pergunta antes.
  const pedirFechar = (v) => { if (!v && sujo) setPergunta({ tipo: 'fechar' }); else onOpenChange(v); };
  const marcarProfessor = (coachId) => {
    const novo = { ...fAtual.current, shared_coach_id: coachId || undefined };
    // Ato já gravado pelo servidor: não conta como alteração pendente da ficha.
    if (fAtual.current === base) setBase(novo);
    setF(novo);
  };
  const PERGUNTAS = {
    fechar: { title: t('Descartar as alterações?'), description: t('O que você mudou nesta ficha e ainda não salvou será perdido.'), confirmLabel: t('Descartar'), cancelLabel: t('Continuar editando'), onConfirm: () => { setPergunta(null); onOpenChange(false); } },
    repetir: { title: t('Descartar as alterações?'), description: t('O que você mudou nesta ficha e ainda não salvou será perdido.'), confirmLabel: t('Descartar'), cancelLabel: t('Continuar editando'), onConfirm: () => { setPergunta(null); onRepeat?.(base); } },
    excluir: { title: t('Excluir este torneio?'), description: t('"{nome}" sai da sua carreira, com as fotos e o balanço. Não dá para desfazer.', { nome: f.name }), confirmLabel: t('Excluir de vez'), destructive: true, loading: remover.isPending, onConfirm: excluir },
    foto: { title: t('Tirar esta foto?'), description: t('A foto é apagada e a ficha é salva como está. Não dá para desfazer.'), confirmLabel: t('Tirar a foto'), destructive: true, onConfirm: () => { const { path } = pergunta; setPergunta(null); tirarFoto(path); } },
  };
  const perguntaAtual = pergunta ? PERGUNTAS[pergunta.tipo] : null;

  const fedLista = fedQ.isSuccess ? fedQ.data || [] : [];
  const fedEscolhida = f.federation_id && fedLista.find((x) => x.id === f.federation_id);
  const fotos = f.photos || [];
  const jogado = f.status !== CAREER_STATUS.PLANNED;
  const pos = bestPosition(f);
  const datas = careerDateBounds(hoje);
  // Mandado ao professor: a regra entrega o registro inteiro a ele — a tela não promete "só você".
  const comProfessor = Boolean(f.shared_coach_id);
  // Plano que já começou e ainda não tem resultado salvo: dupla e vitrine esperam.
  const emAndamento = gravado?.status === CAREER_STATUS.PLANNED && String(gravado.start_date) <= hoje;
  const oficial = careerSeal(f, myTournaments) === SEAL.OFFICIAL;
  let camada = 0;

  return (
    <Dialog open={open} onOpenChange={pedirFechar}>
      <DialogContent className="max-w-2xl" sheet onInteractOutside={(e) => { if (sujo || pergunta) e.preventDefault(); }}>
        <DialogHeader>
          <DialogTitle>{f.name || t('Torneio')}</DialogTitle>
          <DialogDescription>
            {[careerDateLabel(f.start_date, f.date_precision), f.city, f.status === CAREER_STATUS.PLANNED ? t('Planejado') : '', f.status === CAREER_STATUS.CANCELLED ? t('Não fui') : ''].filter(Boolean).join(' · ')}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2">
          <SealBadge seal={careerSeal(f, myTournaments, partnerSealFor(f, partners))} awaiting={partnerSealFor(f, partners) === 'awaiting'} />
          {completude && contaConhecida && (
            <span className="text-sm font-semibold text-ink">
              {t('{feito} de {total}', { feito: completude.done, total: completude.total })}
              {completude.next && (
                <span className="font-normal text-gray-500">
                  {' · '}
                  {completude.next.id === CAREER_LAYER.DEBRIEF ? (
                    // O próximo passo que é o balanço já o oferece: um toque abre o diálogo.
                    <button type="button" className="font-semibold text-ink underline underline-offset-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-ink" onClick={() => setBalanco(true)}>
                      {t('Próximo passo: {passo}', { passo: completude.next.label })}
                    </button>
                  ) : t('Próximo passo: {passo}', { passo: completude.next.label })}
                </span>
              )}
            </span>
          )}
        </div>

        {match && (
          <div className="rounded-2xl border border-acid/40 bg-acid/10 p-4">
            <p className="text-sm font-semibold text-ink">{t('É este torneio do PickleRush?')}</p>
            <p className="mt-1 text-sm text-gray-600">{[match.name, careerDateLabel(match.starts_at || match.start_date), match.city].filter(Boolean).join(' · ')}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <V2Button type="button" size="sm" variant="primary" onClick={() => gravar((x) => ({ ...x, platform_tournament_id: match.id }), t('Ligado ao torneio do PickleRush.'))}>{t('É este')}</V2Button>
              <V2Button type="button" size="sm" variant="ghost" onClick={naoEEste}>{t('Não é')}</V2Button>
            </div>
          </div>
        )}

        {(f.planned_passed || f.status === CAREER_STATUS.CANCELLED || base.status === CAREER_STATUS.CANCELLED) && <CareerHowItWent value={f} onChange={setF} answer={resposta} onAnswer={responder} />}

        {/* `noValidate`: quem confere (e diz o erro no campo) é `conferirFicha`. */}
        <form id={FORM} noValidate className="grid gap-3 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); gravar(); }}>
          <V2Field label={t('Nome do torneio')} htmlFor="ficha-nome" required className="sm:col-span-2" error={erroDe('ficha-nome', erros['ficha-nome'])}>
            <V2Input id="ficha-nome" value={f.name} maxLength={CAREER_LIMITS.name} required onChange={(e) => set('name', e.target.value)} {...ariaErro('ficha-nome', erros['ficha-nome'])} />
          </V2Field>
          <V2Field label={jogado ? t('Começou em') : t('Começa em')} htmlFor="ficha-inicio">
            <V2Input id="ficha-inicio" type="date" value={f.start_date} min={datas.min} max={datas.max} onChange={(e) => setDatas({ start_date: e.target.value, date_precision: 'day' })} />
          </V2Field>
          <V2Field label={jogado ? t('Terminou em (opcional)') : t('Termina em (opcional)')} htmlFor="ficha-fim" error={erroDe('ficha-fim', erros['ficha-fim'])}>
            <V2Input id="ficha-fim" type="date" value={f.end_date || ''} min={f.start_date || datas.min} max={datas.max} onChange={(e) => setDatas({ end_date: e.target.value || null })} {...ariaErro('ficha-fim', erros['ficha-fim'])} />
          </V2Field>
          <V2Field label={t('Organizador')} htmlFor="ficha-org">
            <V2Input id="ficha-org" value={f.organizer || ''} maxLength={CAREER_LIMITS.organizer} onChange={(e) => set('organizer', e.target.value)} />
          </V2Field>
          <div className="grid grid-cols-[1fr_6rem] gap-3">
            <V2Field label={t('Cidade')} htmlFor="ficha-cidade">
              <V2Input id="ficha-cidade" value={f.city || ''} maxLength={CAREER_LIMITS.city} onChange={(e) => set('city', e.target.value)} />
            </V2Field>
            <V2Field label={t('UF')} htmlFor="ficha-uf">
              <V2Select id="ficha-uf" value={f.state || ''} onChange={(e) => set('state', e.target.value)}>
                <option value="">—</option>
                {BR_UFS.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
              </V2Select>
            </V2Field>
          </div>
        </form>

        {!jogado && <CareerPlanFields value={f} onChange={setF} debriefs={balancos.isSuccess ? balancos.data : []} formId={FORM} />}

        <Camada n={++camada} titulo={semColocacao ? t('Categorias') : t('Resultado')}>
          {f.entries.map((e, i) => (
            <Participacao
              key={i}
              entry={e}
              idx={i}
              onChange={(novo) => setEntry(i, novo)}
              selfUid={uid}
              past={past}
              formId={FORM}
              semColocacao={semColocacao}
              erros={erros}
              onRemove={f.entries.length > 1 ? () => setF((x) => ({ ...x, entries: x.entries.filter((_, j) => j !== i) })) : null}
            />
          ))}
          {f.entries.length < CAREER_LIMITS.entries && (
            <V2Button type="button" size="sm" variant="secondary" onClick={() => setF((x) => ({ ...x, entries: [...x.entries, { format: CAREER_FORMAT.DOUBLES, gender: null, placement: null }] }))}>
              <Plus className="h-4 w-4" /> {t('Outra categoria')}
            </V2Button>
          )}
          <V2Toggle id="ficha-federado" checked={Boolean(f.federated)} onChange={(v) => setF((x) => ({ ...x, federated: v, ...(v ? {} : { federation_id: null, federation_name: '', federation_acronym: '' }) }))} label={t('Torneio federado')} hint={t('Valeu para o ranking de uma federação.')} />
          {f.federated && (
            <div className="grid gap-3 sm:grid-cols-2">
              {fedOn && fedQ.isError && (
                <V2ErrorState inline className="sm:col-span-2" title={t('Não carregou o diretório das federações')} description={t('Digite o nome da federação.')} onRetry={() => fedQ.refetch()} />
              )}
              {fedOn && fedLista.length > 0 && (
                <V2Field label={t('Federação')} htmlFor="ficha-fed" className="sm:col-span-2">
                  <V2Select
                    id="ficha-fed"
                    value={fedEscolhida ? f.federation_id : ''}
                    onChange={(e) => {
                      const fx = fedLista.find((x) => x.id === e.target.value);
                      setF((x) => ({ ...x, federation_id: fx?.id || null, federation_name: fx?.name || '', federation_acronym: fx?.acronym || '' }));
                    }}
                  >
                    <option value="">{t('Outra (digitar)')}</option>
                    {fedLista.map((x) => <option key={x.id} value={x.id}>{[x.acronym, x.name].filter(Boolean).join(' — ')}</option>)}
                  </V2Select>
                </V2Field>
              )}
              {!fedEscolhida && (
                <>
                  <V2Field label={t('Nome da federação')} htmlFor="ficha-fed-nome">
                    <V2Input id="ficha-fed-nome" form={FORM} value={f.federation_name || ''} maxLength={CAREER_LIMITS.federation} onChange={(e) => set('federation_name', e.target.value)} />
                  </V2Field>
                  <V2Field label={t('Sigla')} htmlFor="ficha-fed-sigla">
                    <V2Input id="ficha-fed-sigla" form={FORM} value={f.federation_acronym || ''} maxLength={CAREER_LIMITS.acronym} onChange={(e) => set('federation_acronym', e.target.value)} />
                  </V2Field>
                </>
              )}
              <V2Field label={t('Etapa ou categoria do torneio')} htmlFor="ficha-etapa" className="sm:col-span-2">
                <V2Input id="ficha-etapa" form={FORM} value={f.stage_tier || ''} maxLength={CAREER_LIMITS.stage} placeholder={t('Ex.: Etapa 500, Nacional')} onChange={(e) => set('stage_tier', e.target.value)} />
              </V2Field>
            </div>
          )}
          <V2Field label={semColocacao ? t('Link do torneio (opcional)') : t('Link do resultado (opcional)')} htmlFor="ficha-link" hint={t('Só https://. Ele fica guardado; o PickleRush não abre o link.')} error={erroDe('ficha-link', erros['ficha-link'])}>
            <V2Input id="ficha-link" form={FORM} type="url" inputMode="url" value={f.link || ''} maxLength={CAREER_LIMITS.link} placeholder="https://" onChange={(e) => set('link', e.target.value)} {...ariaErro('ficha-link', erros['ficha-link'])} />
          </V2Field>
        </Camada>

        {/* Antes de o torneio começar não há foto a pôr (as que já existem seguem à vista). */}
        {(!semColocacao || fotos.length > 0) && (
        <Camada n={++camada} titulo={t('Foto')} dica="carreira-foto">
          <p className="text-xs text-gray-500">
            {comProfessor
              ? t('A medalha, o pódio ou a chave. Até 6 fotos. Você mandou este torneio ao seu professor: as fotos ficam ao alcance dele também. Evite fotos com o rosto de crianças.')
              : t('A medalha, o pódio ou a chave. Até 6 fotos, só você vê. Evite fotos com o rosto de crianças.')}
          </p>
          {fotos.length > 0 && (
            <ul className="grid gap-3 sm:grid-cols-2">
              {fotos.map((p) => (
                <li key={p.path} className="space-y-2 rounded-2xl border border-gray-100 p-2">
                  {p.url && <img src={p.url} alt={p.alt || t(PHOTO_KIND_LABEL[p.kind])} className="aspect-video w-full rounded-xl object-cover" loading="lazy" />}
                  <V2Select aria-label={t('Tipo da foto')} value={p.kind} onChange={(e) => setFoto(p.path, 'kind', e.target.value)}>
                    {PHOTO_KIND.map((k) => <option key={k} value={k}>{t(PHOTO_KIND_LABEL[k])}</option>)}
                  </V2Select>
                  <V2Input aria-label={t('Descrição da foto')} value={p.alt || ''} maxLength={CAREER_LIMITS.alt} placeholder={t('O que aparece na foto')} onChange={(e) => setFoto(p.path, 'alt', e.target.value)} />
                  <V2Button type="button" size="sm" variant="ghost" onClick={() => setPergunta({ tipo: 'foto', path: p.path })} disabled={Boolean(busy)}><Trash2 className="h-4 w-4" /> {t('Tirar a foto')}</V2Button>
                </li>
              ))}
            </ul>
          )}
          {fotos.length < CAREER_LIMITS.photos && (
            <>
              {/* `hidden`: fora do Tab e do leitor de tela — o botão "Pôr foto" é o único controle. */}
              <input ref={arquivo} type="file" accept="image/jpeg,image/png,image/webp" hidden tabIndex={-1} id="ficha-foto" onChange={(e) => porFoto(e.target.files?.[0])} />
              <V2Button type="button" size="sm" variant="secondary" disabled={Boolean(busy)} onClick={() => arquivo.current?.click()}>
                <Camera className="h-4 w-4" /> {busy === 'foto' ? t('Enviando…') : t('Pôr foto')}
              </V2Button>
            </>
          )}
        </Camada>
        )}

        <Camada n={++camada} titulo={t('Dupla')} dica="carreira-dupla">
          {emAndamento && (
            <p className="text-xs text-gray-500">{t('Este torneio ainda está em andamento. Salve a colocação em Resultado — ou espere o último dia passar — para pedir a confirmação da dupla.')}</p>
          )}
          <CareerPartnerLayer
            event={gravado}
            saved={saved}
            dirty={sujo}
            partners={partners}
            partnersError={partnersError}
            onRetry={onRetryPartners}
          />
        </Camada>

        {fonteBalanco && (
          <Camada n={++camada} titulo={t('Balanço')} dica="carreira-balanco">
            {balancos.isPending ? (
              <V2Skeleton lines={2} />
            ) : balancos.isError ? (
              <V2ErrorState inline title={t('Não carregaram os seus balanços')} description={t('Sem eles não dá para saber se este torneio já tem balanço.')} onRetry={() => balancos.refetch()} />
            ) : feito ? (
              <>
                <p className="text-sm text-gray-600">
                  {[
                    t('Balanço feito.'),
                    feito.suggestion?.focus?.length ? t('Foco sugerido: {focos}.', { focos: feito.suggestion.focus.map((a) => aspectLabel(a).toLowerCase()).join(', ') }) : '',
                    feito.applied ? t('A semana entrou nos seus treinos.') : '',
                  ].filter(Boolean).join(' ')}
                </p>
                <V2Button type="button" size="sm" variant="secondary" onClick={() => setBalanco(true)}>{t('Refazer o balanço')}</V2Button>
              </>
            ) : (
              <>
                <p className="text-xs text-gray-500">{t('Como foi, o que funcionou e o que faltou — até 3 de cada. Daí sai a semana de drills sugerida, que só entra nos seus treinos se você tocar em “Adicionar”.')}</p>
                <V2Button type="button" size="sm" variant="secondary" onClick={() => setBalanco(true)}>{t('Fazer o balanço')}</V2Button>
              </>
            )}
          </Camada>
        )}

        <section data-dica="carreira-vitrine" className="space-y-3 rounded-3xl border border-gray-100 p-4">
          <h3 className="font-display text-base font-bold text-ink">{t('Perfil público')}</h3>
          <CareerShowcaseLayer event={{ ...gravado, shared_coach_id: f.shared_coach_id }} saved={saved} dirty={sujo} />
        </section>

        <CareerCoachShare event={{ ...gravado, shared_coach_id: f.shared_coach_id }} saved={saved} onShared={marcarProfessor} />

        <V2Field
          label={comProfessor ? t('Anotações') : t('Anotações (só você vê)')}
          htmlFor="ficha-notas"
          hint={comProfessor ? t('Você mandou este torneio ao seu professor: as anotações ficam ao alcance dele também.') : null}
        >
          <V2Textarea id="ficha-notas" rows={3} value={f.notes || ''} maxLength={CAREER_LIMITS.notes} onChange={(e) => set('notes', e.target.value)} />
        </V2Field>

        <div className="flex flex-wrap gap-2">
          {/* Excluir pergunta num diálogo próprio: o toque duplo não cai mais em "Excluir de vez". */}
          <V2Button type="button" size="sm" variant="ghost" onClick={() => setPergunta({ tipo: 'excluir' })}><Trash2 className="h-4 w-4" /> {t('Excluir')}</V2Button>
          {jogado && onRepeat && (
            <V2Button type="button" size="sm" variant="ghost" onClick={() => (sujo ? setPergunta({ tipo: 'repetir' }) : onRepeat(f))}><Repeat className="h-4 w-4" /> {t('Repetir no próximo ano')}</V2Button>
          )}
          {normalizeCareerLink(f.link) && <V2Button asChild size="sm" variant="ghost"><a href={f.link} target="_blank" rel="noopener noreferrer nofollow"><Link2 className="h-4 w-4" /> {t('Abrir o link')}</a></V2Button>}
        </div>
        {/* Ligado a um torneio daqui com o selo Oficial: o troféu e o cartão são os do resultado oficial. */}
        {pos && oficial && trofeus.length === 0 && (
          <p className="text-xs text-gray-500">{t('Este torneio está ligado ao do PickleRush: o troféu e o cartão são os do resultado oficial, em Troféus.')}</p>
        )}

        {/* Preso embaixo: a ficha tem várias telas e as camadas do meio pedem "salve antes". */}
        <div className="sticky bottom-0 z-10 -mx-6 -mb-6 space-y-2 border-t border-gray-100 bg-background px-6 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
          {erro && <p role="alert" className="text-sm font-medium text-red-600">{erro}</p>}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold text-gray-600" aria-live="polite">{sujo ? t('Alterações não salvas') : ''}</p>
            <div className="ml-auto flex flex-wrap gap-2">
              {pos && trofeus.length > 0 && <V2Button type="button" variant="secondary" onClick={() => setCartao(true)}><Share2 className="h-4 w-4" /> {t('Cartão')}</V2Button>}
              <V2Button type="submit" form={FORM} variant="primary" disabled={Boolean(busy)}>{busy === 'salvar' ? t('Salvando…') : t('Salvar')}</V2Button>
            </div>
          </div>
        </div>
      </DialogContent>

      {perguntaAtual && (
        <ConfirmDialog open onOpenChange={(v) => { if (!v) setPergunta(null); }} {...perguntaAtual} />
      )}

      {balanco && fonteBalanco && (
        <Suspense fallback={null}>
          <CareerDebriefDialog
            open
            onOpenChange={(v) => { if (!v) setBalanco(false); }}
            source={fonteBalanco}
            history={balancos.data || []}
            initial={feito}
            sharedCoachId={professorDoBalanco}
          />
        </Suspense>
      )}

      {cartao && trofeus.length > 0 && (
        <Suspense fallback={null}>
          <MedalCardDialog
            open
            onOpenChange={(v) => { if (!v) setCartao(false); }}
            places={[1, 2, 3].map((p) => trofeus.find((tr) => tr.position === p)).filter(Boolean)
              .map((tr) => ({ position: tr.position, label: tr.placeLabel, entries: [{ label: tr.people.map((x) => x.name).join(' / '), people: tr.people }] }))}
            event={{ title: f.name, subtitle: trofeus[0].subtitle, date: trofeus[0].date, dateLabel: trofeus[0].dateLabel, city: f.city, state: f.state, kind: 'fora', declared: trofeus[0].declared }}
            link={null}
            initialPosition={trofeus[0].position}
          />
        </Suspense>
      )}
    </Dialog>
  );
}
