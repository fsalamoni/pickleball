/**
 * A FICHA do torneio de fora (Minha carreira, docs/54 §4.2), em camadas:
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
  bestPosition, careerCompleteness, careerSeal, entryLabel, matchPlatformTournament, withDerivedStatus,
} from '@/modules/career/domain/careerEvent.js';
import { careerTrophies } from '@/modules/career/domain/timeline.js';
import { partnerSealFor } from '@/modules/career/domain/careerPartner.js';
import { careerDebriefFor, careerDebriefSource } from '@/modules/career/domain/careerDebrief.js';
import { aspectLabel } from '@/modules/training/domain/debrief.js';
import { useMyDebriefs } from '@/modules/training/hooks/useDebriefs';
import { deleteCareerPhoto, uploadCareerPhoto } from '@/modules/career/services/careerService';
import { useDeleteCareerEvent } from '@/modules/career/hooks/useCareer';
import { useQuery } from '@tanstack/react-query';
import { listAthletes } from '@/modules/athletes/services/athleteService';
import PartnerPicker from '@/v2/components/people/PartnerPicker';
import { CareerPartnerLayer } from './CareerPartnerUi';
import { V2Button, V2ErrorState, V2Field, V2Input, V2Select, V2Skeleton, V2Textarea, V2Toggle } from '@/v2/ui/primitives';
import { ChoiceGroup, FORMAT_CHOICES, GENDER_CHOICES_ALL, SealBadge, careerDateLabel } from './careerUi';
import { t } from '@/core/i18n';

const MedalCardDialog = lazy(() => import('@/v2/components/trophies/MedalCardDialog'));
const CareerDebriefDialog = lazy(() => import('./CareerDebriefDialog'));

/** Só imagem, < 3 MB (o `storage.rules` confere o mesmo). */
const LIMITES_FOTO = Object.freeze({ imageMb: 3, videoEnabled: false, videoMb: 0, videoSeconds: 0 });
/** Os "não é este" de cada pessoa (no navegador, por uid). */
const PREF_NAO_E = 'carreira:nao-e';

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

function Participacao({ entry, idx, onChange, onRemove, selfUid, past }) {
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
        <V2Field label={t('Colocação')} htmlFor={`${id}-col`}>
          <V2Select id={`${id}-col`} value={entry.placement || ''} onChange={(e) => set('placement', e.target.value || null)}>
            <option value="">{t('— Não sei / prefiro não dizer —')}</option>
            {Object.values(PLACEMENT).map((p) => <option key={p} value={p}>{t(PLACEMENT_LABEL[p])}</option>)}
          </V2Select>
        </V2Field>
        {entry.placement === PLACEMENT.OTHER && (
          <V2Field label={t('Posição')} htmlFor={`${id}-n`}>
            <V2Input id={`${id}-n`} type="number" min={1} max={999} value={entry.placement_n ?? ''} onChange={(e) => set('placement_n', e.target.value)} />
          </V2Field>
        )}
        <V2Field label={t('Faixa de nível')} htmlFor={`${id}-faixa`}>
          <V2Select id={`${id}-faixa`} value={entry.level_bracket || ''} onChange={(e) => set('level_bracket', e.target.value || null)}>
            <option value="">{t('— Sem faixa —')}</option>
            {LEVEL_BRACKETS.map((b) => <option key={b} value={b}>{b === 'open' ? t('Open') : b === 'other' ? t('Outra') : b}</option>)}
          </V2Select>
        </V2Field>
        {entry.level_bracket === 'other' && (
          <V2Field label={t('Qual faixa?')} htmlFor={`${id}-faixa-l`}>
            <V2Input id={`${id}-faixa-l`} value={entry.level_label || ''} maxLength={CAREER_LIMITS.label} onChange={(e) => set('level_label', e.target.value)} />
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
            <V2Input id={`${id}-idade-l`} value={entry.age_label || ''} maxLength={CAREER_LIMITS.label} placeholder={t('Ex.: 40+')} onChange={(e) => set('age_label', e.target.value)} />
          </V2Field>
        )}
        <V2Field label={t('Pontos no ranking (declarados)')} htmlFor={`${id}-pts`} hint={t('O que a federação diz que você ganhou. Não entra em ranking nenhum daqui.')}>
          <V2Input id={`${id}-pts`} type="number" min={0} max={100000} value={entry.points_declared ?? ''} onChange={(e) => set('points_declared', e.target.value)} />
        </V2Field>
      </div>
      {entry.format !== CAREER_FORMAT.SINGLES && (
        <div className="space-y-2">
          <V2Field label={t('Com quem você jogou')} htmlFor={`${id}-dupla`}>
            <V2Input
              id={`${id}-dupla`}
              value={entry.partner?.name || ''}
              maxLength={CAREER_LIMITS.partner}
              onChange={(e) => set('partner', e.target.value ? { name: e.target.value } : null)}
              placeholder={t('Nome da dupla')}
            />
          </V2Field>
          {entry.partner?.uid && <p className="text-xs text-gray-500">{t('Conta escolhida da lista de usuários.')}</p>}
          <V2Button type="button" size="sm" variant="ghost" onClick={() => setEscolher((v) => !v)}>
            <UserRound className="h-4 w-4" /> {escolher ? t('Fechar a lista') : t('Escolher da lista de usuários')}
          </V2Button>
          {escolher && (
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
  const [busy, setBusy] = useState('');
  const [erro, setErro] = useState('');
  const [apagar, setApagar] = useState(false);
  const [cartao, setCartao] = useState(false);
  const [naoE, setNaoE] = useState(() => readViewPreference(uid, PREF_NAO_E) || '');
  const arquivo = useRef(null);
  const remover = useDeleteCareerEvent();
  const fedOn = useFeatureFlag(FEATURE_FLAG.FEDERATIONS);
  const fedQ = usePublicFederations({ enabled: open && fedOn && Boolean(f?.federated) });

  const [balanco, setBalanco] = useState(false);

  useEffect(() => { if (open) { setF(withDerivedStatus(event)); setErro(''); setApagar(false); } }, [open, event]);

  const match = useMemo(() => (f && !naoE.split(',').includes(f.id) ? matchPlatformTournament(f, myTournaments) : null), [f, myTournaments, naoE]);
  // Camada 4: o balanço — só de torneio JOGADO (a origem sai do documento gravado, não do rascunho da tela).
  const gravado = useMemo(() => withDerivedStatus(event), [event]);
  const fonteBalanco = useMemo(() => careerDebriefSource(gravado), [gravado]);
  const balancos = useMyDebriefs(uid, { enabled: open && Boolean(fonteBalanco) });
  const feito = balancos.isSuccess ? careerDebriefFor(gravado, balancos.data) : null;
  // Só com a origem GRAVADA a camada vale: o rascunho que virou "jogado" ainda não abre o diálogo.
  const completude = f ? careerCompleteness(f, fonteBalanco && balancos.isSuccess ? { debriefDone: Boolean(feito) } : {}) : null;
  // Sem saber do balanço, a conta "3 de 3" diria que a ficha está completa: não mostra.
  const contaConhecida = !fonteBalanco || balancos.isSuccess;
  const trofeus = useMemo(() => (f ? careerTrophies([f], { myTournaments, me: { uid, name: userProfile?.platform_name || user?.displayName || t('Você'), photo_url: userProfile?.photo_url || null } }) : []), [f, myTournaments, uid, userProfile, user]);
  if (!f) return null;

  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const setEntry = (i, e) => setF((x) => ({ ...x, entries: x.entries.map((y, j) => (j === i ? e : y)) }));

  async function gravar(proximo, okMsg = t('Ficha salva.')) {
    setErro('');
    setBusy('salvar');
    try {
      const { saved, event: gravado } = await save(proximo);
      setF({ ...proximo, ...gravado });
      if (saved) toast.success(okMsg);
      else toast.message(t('Guardado neste aparelho. Enviamos quando a conexão voltar.'));
      return true;
    } catch (err) {
      setErro(err?.code === 'permission-denied' ? t('O registro de torneios está desligado agora.') : (err?.message || t('Não foi possível salvar. Tente de novo.')));
      return false;
    } finally {
      setBusy('');
    }
  }

  async function porFoto(file) {
    if (!file || (f.photos || []).length >= CAREER_LIMITS.photos) return;
    setBusy('foto');
    try {
      const pronto = await prepareUpload(file, LIMITES_FOTO);
      if (!pronto.ok || pronto.type !== 'image') { toast.error(pronto.error || t('Só imagem: JPG, PNG ou WebP.')); return; }
      const { path, url } = await uploadCareerPhoto(uid, pronto.file);
      const kind = bestPosition(f) ? 'medal' : 'podium';
      const foto = { path, url, kind, alt: `${t(PHOTO_KIND_LABEL[kind])} — ${f.name}` };
      // Sem o documento que aponta para ela, a foto ficaria órfã no Storage.
      if (!(await gravar({ ...f, photos: [...(f.photos || []), foto] }, t('Foto guardada.')))) deleteCareerPhoto(path);
    } catch (err) {
      toast.error(err?.message || t('Não foi possível enviar a foto. Confira a conexão e tente de novo.'));
    } finally {
      setBusy('');
      if (arquivo.current) arquivo.current.value = '';
    }
  }

  async function tirarFoto(path) {
    if (await gravar({ ...f, photos: (f.photos || []).filter((p) => p.path !== path) }, t('Foto removida.'))) deleteCareerPhoto(path);
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
      onOpenChange(false);
    } catch {
      setErro(t('Não foi possível excluir. Tente de novo.'));
    }
  }

  const fedLista = fedQ.isSuccess ? fedQ.data || [] : [];
  const fedEscolhida = f.federation_id && fedLista.find((x) => x.id === f.federation_id);
  const fotos = f.photos || [];
  const jogado = f.status !== CAREER_STATUS.PLANNED;
  const pos = bestPosition(f);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl" sheet>
        <DialogHeader>
          <DialogTitle>{f.name}</DialogTitle>
          <DialogDescription>
            {[careerDateLabel(f.start_date, f.date_precision), f.city, f.status === CAREER_STATUS.PLANNED ? t('Planejado') : ''].filter(Boolean).join(' · ')}
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
              <V2Button type="button" size="sm" variant="primary" onClick={() => gravar({ ...f, platform_tournament_id: match.id }, t('Ligado ao torneio do PickleRush.'))}>{t('É este')}</V2Button>
              <V2Button type="button" size="sm" variant="ghost" onClick={naoEEste}>{t('Não é')}</V2Button>
            </div>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <V2Field label={t('Nome do torneio')} htmlFor="ficha-nome" required className="sm:col-span-2">
            <V2Input id="ficha-nome" value={f.name} maxLength={CAREER_LIMITS.name} onChange={(e) => set('name', e.target.value)} />
          </V2Field>
          <V2Field label={t('Começou em')} htmlFor="ficha-inicio">
            <V2Input id="ficha-inicio" type="date" value={f.start_date} onChange={(e) => setF((x) => ({ ...x, start_date: e.target.value, date_precision: 'day' }))} />
          </V2Field>
          <V2Field label={t('Terminou em (opcional)')} htmlFor="ficha-fim">
            <V2Input id="ficha-fim" type="date" value={f.end_date || ''} min={f.start_date} onChange={(e) => set('end_date', e.target.value || null)} />
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
        </div>

        <Camada n={1} titulo={t('Resultado')}>
          {f.entries.map((e, i) => (
            <Participacao
              key={i}
              entry={e}
              idx={i}
              onChange={(novo) => setEntry(i, novo)}
              selfUid={uid}
              past={past}
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
                    <V2Input id="ficha-fed-nome" value={f.federation_name || ''} maxLength={CAREER_LIMITS.federation} onChange={(e) => set('federation_name', e.target.value)} />
                  </V2Field>
                  <V2Field label={t('Sigla')} htmlFor="ficha-fed-sigla">
                    <V2Input id="ficha-fed-sigla" value={f.federation_acronym || ''} maxLength={CAREER_LIMITS.acronym} onChange={(e) => set('federation_acronym', e.target.value)} />
                  </V2Field>
                </>
              )}
              <V2Field label={t('Etapa ou categoria do torneio')} htmlFor="ficha-etapa" className="sm:col-span-2">
                <V2Input id="ficha-etapa" value={f.stage_tier || ''} maxLength={CAREER_LIMITS.stage} placeholder={t('Ex.: Etapa 500, Nacional')} onChange={(e) => set('stage_tier', e.target.value)} />
              </V2Field>
            </div>
          )}
          <V2Field label={t('Link do resultado (opcional)')} htmlFor="ficha-link" hint={t('Só https://. Ele fica guardado; o PickleRush não abre o link.')}>
            <V2Input id="ficha-link" type="url" inputMode="url" value={f.link || ''} maxLength={CAREER_LIMITS.link} placeholder="https://" onChange={(e) => set('link', e.target.value)} />
          </V2Field>
        </Camada>

        <Camada n={2} titulo={t('Foto')} dica="carreira-foto">
          <p className="text-xs text-gray-500">{t('A medalha, o pódio ou a chave. Até 6 fotos, só você vê. Evite fotos com o rosto de crianças.')}</p>
          {fotos.length > 0 && (
            <ul className="grid gap-3 sm:grid-cols-2">
              {fotos.map((p) => (
                <li key={p.path} className="space-y-2 rounded-2xl border border-gray-100 p-2">
                  {p.url && <img src={p.url} alt={p.alt || t(PHOTO_KIND_LABEL[p.kind])} className="aspect-video w-full rounded-xl object-cover" loading="lazy" />}
                  <V2Select aria-label={t('Tipo da foto')} value={p.kind} onChange={(e) => setFoto(p.path, 'kind', e.target.value)}>
                    {PHOTO_KIND.map((k) => <option key={k} value={k}>{t(PHOTO_KIND_LABEL[k])}</option>)}
                  </V2Select>
                  <V2Input aria-label={t('Descrição da foto')} value={p.alt || ''} maxLength={CAREER_LIMITS.alt} placeholder={t('O que aparece na foto')} onChange={(e) => setFoto(p.path, 'alt', e.target.value)} />
                  <V2Button type="button" size="sm" variant="ghost" onClick={() => tirarFoto(p.path)} disabled={Boolean(busy)}><Trash2 className="h-4 w-4" /> {t('Tirar a foto')}</V2Button>
                </li>
              ))}
            </ul>
          )}
          {fotos.length < CAREER_LIMITS.photos && (
            <>
              <input ref={arquivo} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" id="ficha-foto" onChange={(e) => porFoto(e.target.files?.[0])} />
              <V2Button type="button" size="sm" variant="secondary" disabled={Boolean(busy)} onClick={() => arquivo.current?.click()}>
                <Camera className="h-4 w-4" /> {busy === 'foto' ? t('Enviando…') : t('Pôr foto')}
              </V2Button>
            </>
          )}
        </Camada>

        <Camada n={3} titulo={t('Dupla')} dica="carreira-dupla">
          <CareerPartnerLayer
            event={gravado}
            saved={saved}
            dirty={JSON.stringify(f) !== JSON.stringify(gravado)}
            partners={partners}
            partnersError={partnersError}
            onRetry={onRetryPartners}
          />
        </Camada>

        {fonteBalanco && (
          <Camada n={4} titulo={t('Balanço')} dica="carreira-balanco">
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

        <V2Field label={t('Anotações (só você vê)')} htmlFor="ficha-notas">
          <V2Textarea id="ficha-notas" rows={3} value={f.notes || ''} maxLength={CAREER_LIMITS.notes} onChange={(e) => set('notes', e.target.value)} />
        </V2Field>

        {erro && <p role="alert" className="text-sm font-medium text-red-600">{erro}</p>}

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-2">
            {apagar ? (
              <>
                <V2Button type="button" size="sm" variant="danger" onClick={excluir} disabled={remover.isPending}>{t('Excluir de vez')}</V2Button>
                <V2Button type="button" size="sm" variant="ghost" onClick={() => setApagar(false)}>{t('Cancelar')}</V2Button>
              </>
            ) : (
              <V2Button type="button" size="sm" variant="ghost" onClick={() => setApagar(true)}><Trash2 className="h-4 w-4" /> {t('Excluir')}</V2Button>
            )}
            {jogado && onRepeat && <V2Button type="button" size="sm" variant="ghost" onClick={() => onRepeat(f)}><Repeat className="h-4 w-4" /> {t('Repetir no próximo ano')}</V2Button>}
            {f.link && <V2Button asChild size="sm" variant="ghost"><a href={f.link} target="_blank" rel="noopener noreferrer nofollow"><Link2 className="h-4 w-4" /> {t('Abrir o link')}</a></V2Button>}
          </div>
          <div className="flex flex-wrap gap-2">
            {pos && trofeus.length > 0 && <V2Button type="button" variant="secondary" onClick={() => setCartao(true)}><Share2 className="h-4 w-4" /> {t('Cartão')}</V2Button>}
            <V2Button type="button" variant="primary" onClick={() => gravar(f)} disabled={Boolean(busy) || !f.name.trim()}>{busy === 'salvar' ? t('Salvando…') : t('Salvar')}</V2Button>
          </div>
        </div>
      </DialogContent>

      {balanco && fonteBalanco && (
        <Suspense fallback={null}>
          <CareerDebriefDialog
            open
            onOpenChange={(v) => { if (!v) setBalanco(false); }}
            source={fonteBalanco}
            history={balancos.data || []}
            initial={feito}
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
