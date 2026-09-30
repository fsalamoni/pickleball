import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Timestamp } from 'firebase/firestore';
import { toast } from 'sonner';
import { Award, ChevronRight, ChevronLeft } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useFeatureFlag } from '@/core/lib/FeatureFlagsContext';
import { FEATURE_FLAG } from '@/core/featureFlags';
import {
  birthDateToBrtDate, missingRegistrationFields, parseDuprRating, validateRequiredProfile,
} from '@/core/lib/profileValidation';
import { BR_UFS, isBrazilUF } from '@/core/domain/ufs';
import { PICKLEBALL_EXPERIENCE_LABELS } from '@/modules/tournament/domain/constants';
import { ATHLETE_GENDER_LABELS } from '@/modules/athletes/domain/constants';
import { LEVEL_OPTIONS, getLevelByCode } from '@/modules/leveling/data/levels';
import {
  COURT_SIDE_OPTIONS, PLATFORM_INTEREST_META, sanitizeInterests,
} from '@/modules/athletes/domain/profileMeta';
import { interestIcon } from '@/v2/components/profile/profileMetaIcons';
import { V2Button, V2Field, V2Input, V2Select } from '@/v2/ui/primitives';
import { cn } from '@/core/lib/utils';

// Mantido por compatibilidade de import (agora derivado dos metadados ricos).
export const ONBOARDING_INTERESTS = PLATFORM_INTEREST_META;

/** Os passos do assistente, na ordem, e os campos que cada um preenche. */
const PASSOS = ['pessoal', 'jogo', 'interesses', 'nivel'];
const CAMPOS_DO_PASSO = {
  pessoal: ['platform_name', 'birth_date', 'phone', 'gender', 'city', 'state'],
  jogo: ['pickleball_experience', 'court_side', 'competition_gender'],
  interesses: ['interests'],
  nivel: ['level'],
};

/** A categoria em que se joga — a pergunta que o sorteio faz. */
const CATEGORIAS = [
  { value: 'male', label: 'Masculina' },
  { value: 'female', label: 'Feminina' },
];

/**
 * Os passos que esta pessoa precisa ver.
 *
 * Com o cadastro essencial (flag `essential_profile`), quem já está dentro vê
 * SÓ o passo do que falta — refazer o cadastro inteiro para dizer uma coisa é
 * o motivo de a pessoa fechar o aplicativo. Sem a flag, o assistente segue
 * como sempre: todos os passos, com o nível opcional no fim.
 */
function passosPara(faltando, essencial) {
  if (!essencial) return PASSOS;
  const passos = PASSOS.filter((id) => CAMPOS_DO_PASSO[id].some((c) => faltando.includes(c)));
  return passos.length > 0 ? passos : PASSOS;
}

/**
 * Cadastro completo OBRIGATÓRIO no primeiro acesso — e para quem já está dentro,
 * na próxima entrada, até completar (flag onboarding_wizard). Não pode ser
 * adiado nem fechado; o preenchimento é permanente (uma vez) e tudo é editável
 * depois no perfil.
 *
 * Passos:
 *  pessoal.    Dados pessoais (nome, nascimento, telefone, gênero, cidade/UF);
 *  jogo.       Preferências de jogo (experiência, lado da quadra e — com o
 *              cadastro essencial — a categoria em que joga);
 *  interesses. Interesses na plataforma (ao menos um);
 *  nivel.      Nível: convite opcional ao nivelamento; com o cadastro
 *              essencial, obrigatório (ao menos a autoindicação), com o DUPR
 *              opcional ao lado.
 */
export default function V2OnboardingWizard() {
  const { userProfile, updateUserProfile } = useAuth();
  const essencial = useFeatureFlag(FEATURE_FLAG.ESSENTIAL_PROFILE);
  const navigate = useNavigate();
  const [passos, setPassos] = useState(PASSOS);
  const [indice, setIndice] = useState(0);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState({});
  const [form, setForm] = useState({
    platformName: '', birthDate: '', phone: '', gender: '', city: '', state: '',
    pickleballExperience: '', courtSide: '', competitionGender: '',
  });
  const [interests, setInterests] = useState([]);
  const [levelMode, setLevelMode] = useState(null); // null | 'choose'
  const [levelCode, setLevelCode] = useState('');
  const [duprId, setDuprId] = useState('');
  const [duprRating, setDuprRating] = useState('');
  const [retorno, setRetorno] = useState(false);

  // Trava latcheada por usuário: decidimos UMA vez (ao carregar o perfil — e
  // de novo quando as flags chegam) se o cadastro está incompleto. Assim
  // salvar um passo não fecha o assistente no meio; em sessões futuras, com o
  // cadastro completo, ele não reabre.
  const [openLatch, setOpenLatch] = useState(false);

  useEffect(() => {
    setForm({
      platformName: userProfile?.platform_name || userProfile?.full_name || '',
      birthDate: userProfile?.birth_date || '',
      phone: userProfile?.phone || '',
      gender: userProfile?.gender || '',
      city: userProfile?.city || '',
      state: userProfile?.state || '',
      pickleballExperience: userProfile?.pickleball_experience || '',
      courtSide: userProfile?.court_side || '',
      competitionGender: userProfile?.competition_gender || '',
    });
    setInterests(sanitizeInterests(userProfile?.interests));
    setLevelCode(userProfile?.leveling_level || '');
    setDuprId(userProfile?.dupr_id || '');
    setDuprRating(userProfile?.dupr_rating != null ? String(userProfile.dupr_rating) : '');
    setLevelMode(null);
    setErrors({});
    const faltando = userProfile ? missingRegistrationFields(userProfile, { essencial }) : [];
    setPassos(passosPara(faltando, essencial));
    setIndice(0);
    // Quem já tinha concluído o cadastro e agora vê o assistente de novo precisa
    // saber POR QUÊ — senão parece que o aplicativo perdeu os dados dele.
    setRetorno(Boolean(essencial && userProfile?.onboarding_completed_at));
    setOpenLatch(Boolean(userProfile && faltando.length > 0));
  }, [userProfile?.uid, essencial]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!openLatch) return null;

  const passo = passos[indice] || PASSOS[0];
  const ultimo = indice >= passos.length - 1;

  function set(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function avancar() {
    setErrors({});
    if (!ultimo) setIndice((i) => i + 1);
  }

  async function handlePersonal() {
    const validation = validateRequiredProfile(form);
    // O tempo de experiência é coletado NO PASSO 1 — então o seu erro (campo
    // ainda vazio aqui) NÃO pode bloquear o passo 0. Sem essa exclusão, o
    // assistente nunca avançava do "confirmar os dados" para quem estava
    // completando o cadastro pela primeira vez.
    const { pickleballExperience: _laterStep, ...essentialErrors } = validation.errors;
    const next = { ...essentialErrors };
    if (!form.gender) next.gender = 'Informe seu gênero.';
    if (!form.city.trim()) next.city = 'Informe sua cidade.';
    if (!form.state.trim()) next.state = 'Informe a UF.';
    else if (essencial && !isBrazilUF(form.state)) next.state = 'Escolha a UF na lista.';
    if (Object.keys(next).length > 0) { setErrors(next); return; }
    setBusy(true);
    try {
      await updateUserProfile({
        platform_name: form.platformName.trim(),
        birth_date: form.birthDate,
        birth_date_at: Timestamp.fromDate(birthDateToBrtDate(form.birthDate)),
        phone: form.phone.trim(),
        gender: form.gender,
        city: form.city.trim(),
        state: form.state.trim().toUpperCase(),
      });
      if (ultimo) await finish();
      else avancar();
    } catch (err) {
      toast.error(err?.message || 'Não foi possível salvar. Tente novamente.');
    } finally {
      setBusy(false);
    }
  }

  async function handlePreferences() {
    const next = {};
    if (!form.pickleballExperience) next.pickleballExperience = 'Informe seu tempo de experiência.';
    if (!form.courtSide) next.courtSide = 'Escolha o lado da quadra que prefere.';
    if (essencial && !CATEGORIAS.some((c) => c.value === form.competitionGender)) {
      next.competitionGender = 'Escolha a categoria em que você joga.';
    }
    if (Object.keys(next).length > 0) { setErrors(next); return; }
    setBusy(true);
    try {
      await updateUserProfile({
        pickleball_experience: form.pickleballExperience,
        court_side: form.courtSide,
        ...(essencial ? { competition_gender: form.competitionGender } : {}),
      });
      if (ultimo) await finish();
      else avancar();
    } catch (err) {
      toast.error(err?.message || 'Não foi possível salvar. Tente novamente.');
    } finally {
      setBusy(false);
    }
  }

  function toggleInterest(value) {
    setInterests((current) => (
      current.includes(value) ? current.filter((v) => v !== value) : [...current, value]
    ));
  }

  async function handleInterests() {
    if (interests.length === 0) { toast.error('Escolha ao menos um interesse.'); return; }
    setBusy(true);
    try {
      await updateUserProfile({ interests: sanitizeInterests(interests) });
      if (ultimo) await finish();
      else avancar();
    } catch (err) {
      toast.error(err?.message || 'Não foi possível salvar. Tente novamente.');
    } finally {
      setBusy(false);
    }
  }

  const selectedLevelInfo = getLevelByCode(levelCode);

  async function saveLevelAndFinish() {
    if (!levelCode) { toast.error('Escolha um nível.'); return; }
    const level = getLevelByCode(levelCode);
    setBusy(true);
    try {
      await updateUserProfile({
        level: level ? `${level.name} (USAP ${level.usap})` : levelCode,
        leveling_level: levelCode,
        leveling_method: 'manual',
        leveling_manual_level: levelCode,
        onboarding_completed_at: Timestamp.now(),
      });
      setOpenLatch(false);
      toast.success('Nível salvo. Bom jogo!');
    } catch (err) {
      toast.error(err?.message || 'Não foi possível salvar. Tente novamente.');
    } finally {
      setBusy(false);
    }
  }

  /**
   * Cadastro essencial: o nível é obrigatório — vale a autoindicação da lista
   * ou um rating DUPR (melhor que as duas). O ID DUPR é opcional.
   */
  async function saveEssentialLevel() {
    const rating = parseDuprRating(duprRating);
    const temRatingDigitado = String(duprRating || '').trim() !== '';
    const next = {};
    if (temRatingDigitado && rating === null) next.duprRating = 'Use o formato do DUPR, entre 2.000 e 8.000 (ex.: 3.500).';
    if (!levelCode && rating === null) next.level = 'Escolha o seu nível na lista (ou informe o seu rating DUPR).';
    if (Object.keys(next).length > 0) { setErrors(next); return; }
    const level = getLevelByCode(levelCode);
    setBusy(true);
    try {
      await updateUserProfile({
        ...(levelCode && levelCode !== userProfile?.leveling_level ? {
          level: level ? `${level.name} (USAP ${level.usap})` : levelCode,
          leveling_level: levelCode,
          leveling_method: 'manual',
          leveling_manual_level: levelCode,
        } : {}),
        ...(duprId.trim() ? { dupr_id: duprId.trim() } : {}),
        ...(rating !== null ? { dupr_rating: rating } : {}),
        onboarding_completed_at: Timestamp.now(),
      });
      setOpenLatch(false);
      toast.success(retorno ? 'Cadastro atualizado. Obrigado!' : 'Cadastro completo. Bom jogo!');
    } catch (err) {
      toast.error(err?.message || 'Não foi possível salvar. Tente novamente.');
    } finally {
      setBusy(false);
    }
  }

  async function finish({ goToLeveling = false } = {}) {
    setBusy(true);
    try {
      await updateUserProfile({ onboarding_completed_at: Timestamp.now() });
      setOpenLatch(false);
      toast.success(retorno ? 'Cadastro atualizado. Obrigado!' : 'Cadastro completo. Bom jogo!');
      if (goToLeveling) navigate('/nivelamento');
    } catch (err) {
      toast.error(err?.message || 'Não foi possível concluir. Tente novamente.');
    } finally {
      setBusy(false);
    }
  }

  const titulo = {
    pessoal: retorno ? 'Faltam alguns dados no seu cadastro' : 'Bem-vindo(a) à PickleRush!',
    jogo: 'Suas preferências de jogo',
    interesses: 'O que você quer fazer por aqui?',
    nivel: 'Qual é o seu nível de jogo?',
  }[passo];
  const descricao = {
    pessoal: retorno
      ? 'São os dados que fazem a busca por perto funcionar. Confira e complete.'
      : 'Complete seu cadastro para usar a plataforma. Leva 1 minuto e você só faz uma vez.',
    jogo: 'Isso ajuda a encontrar parcerias e jogos compatíveis com você — e a montar os sorteios.',
    interesses: 'Escolha ao menos uma opção. Usamos isso para destacar o que importa para você.',
    nivel: essencial
      ? 'O sorteio equilibra os jogos pelo nível. Diga o seu — dá para refinar depois com o teste.'
      : 'O nivelamento é opcional e leva cerca de 3 minutos.',
  }[passo];

  const voltar = indice > 0 ? (
    <button type="button" onClick={() => { setErrors({}); setIndice((i) => i - 1); }} className="inline-flex items-center gap-1 text-sm font-semibold text-gray-400 hover:text-ink">
      <ChevronLeft className="h-4 w-4" /> Voltar
    </button>
  ) : <span />;
  const rotuloSeguir = ultimo ? 'Salvar e concluir' : 'Continuar';

  return (
    // Obrigatório: não fecha por clique fora nem por Esc.
    <Dialog open>
      <DialogContent
        className="max-h-[92dvh] max-w-lg overflow-y-auto"
        hideClose
        onEscapeKeyDown={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
          <DialogDescription>{descricao}</DialogDescription>
        </DialogHeader>

        {retorno && indice === 0 && (
          <p className="rounded-2xl border border-acid/40 bg-acid/10 px-4 py-3 text-sm leading-6 text-ink">
            O cadastro passou a pedir <strong>a categoria em que você joga</strong> e <strong>o seu nível</strong> —
            é com eles que o sorteio forma duplas mistas e jogos equilibrados. Só falta o que está aqui; o resto
            você já preencheu.
          </p>
        )}

        {passos.length > 1 && (
          <div className="mb-1 flex items-center gap-1.5" aria-label={`Passo ${indice + 1} de ${passos.length}`}>
            {passos.map((id, i) => (
              <span key={id} className={cn('h-1.5 flex-1 rounded-full', i <= indice ? 'bg-acid' : 'bg-gray-100')} />
            ))}
          </div>
        )}

        {passo === 'pessoal' && (
          <div className="space-y-3">
            <V2Field label="Nome de exibição" htmlFor="onb_name" error={errors.platformName} required>
              <V2Input id="onb_name" value={form.platformName} maxLength={60} onChange={(e) => set('platformName', e.target.value)} />
            </V2Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <V2Field label="Data de nascimento" htmlFor="onb_birth" error={errors.birthDate} required>
                <V2Input id="onb_birth" type="date" value={form.birthDate} onChange={(e) => set('birthDate', e.target.value)} />
              </V2Field>
              <V2Field label="Telefone" htmlFor="onb_phone" error={errors.phone} required>
                <V2Input id="onb_phone" type="tel" inputMode="tel" placeholder="(11) 99999-9999" value={form.phone} onChange={(e) => set('phone', e.target.value)} />
              </V2Field>
            </div>
            <V2Field label="Gênero" htmlFor="onb_gender" error={errors.gender} required>
              <V2Select id="onb_gender" value={form.gender} onChange={(e) => set('gender', e.target.value)}>
                <option value="">Selecione</option>
                {Object.entries(ATHLETE_GENDER_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </V2Select>
            </V2Field>
            <div className="grid gap-3 sm:grid-cols-[1fr_120px]">
              <V2Field label="Cidade" htmlFor="onb_city" error={errors.city} required>
                <V2Input id="onb_city" value={form.city} maxLength={80} onChange={(e) => set('city', e.target.value)} />
              </V2Field>
              <V2Field label="UF" htmlFor="onb_uf" error={errors.state} required>
                {essencial ? (
                  <V2Select id="onb_uf" value={isBrazilUF(form.state) ? form.state.trim().toUpperCase() : ''} onChange={(e) => set('state', e.target.value)}>
                    <option value="">UF</option>
                    {BR_UFS.map((u) => <option key={u} value={u}>{u}</option>)}
                  </V2Select>
                ) : (
                  <V2Input id="onb_uf" value={form.state} maxLength={2} placeholder="SP" onChange={(e) => set('state', e.target.value)} />
                )}
              </V2Field>
            </div>
            <div className="flex items-center justify-between pt-2">
              {voltar}
              <V2Button onClick={handlePersonal} disabled={busy}>
                {busy ? 'Salvando…' : rotuloSeguir} <ChevronRight className="h-4 w-4" />
              </V2Button>
            </div>
          </div>
        )}

        {passo === 'jogo' && (
          <div className="space-y-3">
            <V2Field label="Tempo de experiência em pickleball" htmlFor="onb_exp" error={errors.pickleballExperience} required>
              <V2Select id="onb_exp" value={form.pickleballExperience} onChange={(e) => set('pickleballExperience', e.target.value)}>
                <option value="">Selecione uma opção</option>
                {Object.entries(PICKLEBALL_EXPERIENCE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </V2Select>
            </V2Field>
            <div>
              <p className="mb-1.5 text-sm font-semibold text-ink">Lado da quadra que prefere jogar <span className="text-red-500">*</span></p>
              <div className="grid grid-cols-3 gap-2">
                {COURT_SIDE_OPTIONS.map(({ value, label }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => set('courtSide', value)}
                    aria-pressed={form.courtSide === value}
                    className={cn(
                      'btn-press rounded-2xl border px-3 py-3 text-sm font-semibold transition-colors',
                      form.courtSide === value ? 'border-transparent bg-ink text-white' : 'border-gray-200 bg-paper-pure text-gray-600 hover:border-ink',
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {errors.courtSide && <p className="mt-1 text-xs text-red-600">{errors.courtSide}</p>}
            </div>
            {essencial && (
              <div>
                <p className="mb-0.5 text-sm font-semibold text-ink">Categoria em que você joga <span className="text-red-500">*</span></p>
                <p className="mb-1.5 text-xs leading-5 text-gray-500">
                  Usada nas duplas mistas do dia de jogo e nas categorias dos torneios. É a sua preferência
                  competitiva — não é sobre identidade de gênero.
                </p>
                <div className="grid grid-cols-2 gap-2" role="group" aria-label="Categoria em que você joga">
                  {CATEGORIAS.map(({ value, label }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => set('competitionGender', value)}
                      aria-pressed={form.competitionGender === value}
                      className={cn(
                        'btn-press rounded-2xl border px-3 py-3 text-sm font-semibold transition-colors',
                        form.competitionGender === value ? 'border-transparent bg-ink text-white' : 'border-gray-200 bg-paper-pure text-gray-600 hover:border-ink',
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {errors.competitionGender && <p className="mt-1 text-xs text-red-600">{errors.competitionGender}</p>}
              </div>
            )}
            <div className="flex items-center justify-between pt-2">
              {voltar}
              <V2Button onClick={handlePreferences} disabled={busy}>
                {busy ? 'Salvando…' : rotuloSeguir} <ChevronRight className="h-4 w-4" />
              </V2Button>
            </div>
          </div>
        )}

        {passo === 'interesses' && (
          <div className="space-y-3">
            <div className="grid gap-2 sm:grid-cols-2">
              {PLATFORM_INTEREST_META.map(({ value, label, icon }) => {
                const Icon = interestIcon(icon);
                const active = interests.includes(value);
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => toggleInterest(value)}
                    aria-pressed={active}
                    className={cn(
                      'btn-press flex items-center gap-2.5 rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition-colors',
                      active ? 'border-transparent bg-ink text-white' : 'border-gray-200 bg-paper-pure text-gray-600 hover:border-ink',
                    )}
                  >
                    <Icon className={cn('h-4.5 w-4.5 shrink-0', active ? 'text-acid' : 'text-gray-400')} />
                    {label}
                  </button>
                );
              })}
            </div>
            <div className="flex items-center justify-between pt-2">
              {voltar}
              <V2Button onClick={handleInterests} disabled={busy || interests.length === 0}>
                {busy ? 'Salvando…' : rotuloSeguir} <ChevronRight className="h-4 w-4" />
              </V2Button>
            </div>
          </div>
        )}

        {passo === 'nivel' && essencial && (
          <div className="space-y-4">
            <V2Field label="Seu nível" htmlFor="onb_level" error={errors.level} required>
              <V2Select id="onb_level" value={levelCode} onChange={(e) => setLevelCode(e.target.value)}>
                <option value="">Selecione seu nível…</option>
                {LEVEL_OPTIONS.map(({ code, label }) => (
                  <option key={code} value={code}>{label}</option>
                ))}
              </V2Select>
            </V2Field>
            {selectedLevelInfo ? (
              <div className="rounded-2xl border border-gray-100 bg-paper-pure p-4">
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-ink px-2.5 py-1 text-xs font-bold text-acid">USAP {selectedLevelInfo.usap}</span>
                  <span className="font-display text-base font-bold text-ink">{selectedLevelInfo.name}</span>
                </div>
                {selectedLevelInfo.tagline && <p className="mt-2 text-sm font-semibold text-gray-600">{selectedLevelInfo.tagline}</p>}
                <p className="mt-1 text-sm leading-6 text-gray-500">{selectedLevelInfo.description}</p>
              </div>
            ) : (
              <p className="text-xs text-gray-400">
                Escolha um nível para ver a explicação do que ele significa. Prefere o teste de nivelamento
                (cerca de 3 minutos)? Faça depois em Perfil → Nível — o resultado substitui a escolha daqui.
              </p>
            )}

            <div className="space-y-3 rounded-2xl border border-gray-100 bg-paper p-4">
              <p className="text-sm font-semibold text-ink">
                Tem DUPR? <span className="font-normal text-gray-500">Opcional, mas ajuda muito.</span>
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <V2Field label="ID DUPR" htmlFor="onb_dupr_id">
                  <V2Input id="onb_dupr_id" value={duprId} maxLength={20} placeholder="Ex.: ABC123" onChange={(e) => setDuprId(e.target.value)} />
                </V2Field>
                <V2Field label="Rating DUPR (2.000–8.000)" htmlFor="onb_dupr_rating" error={errors.duprRating}>
                  <V2Input id="onb_dupr_rating" value={duprRating} inputMode="decimal" maxLength={6} placeholder="Ex.: 3.500" onChange={(e) => setDuprRating(e.target.value)} />
                </V2Field>
              </div>
              <p className="text-xs leading-5 text-gray-500">
                Com o rating DUPR, o sorteio usa o seu número de verdade — e ele vale no lugar da escolha acima.
              </p>
            </div>

            <div className="flex items-center justify-between pt-1">
              {voltar}
              <V2Button onClick={saveEssentialLevel} disabled={busy}>
                {busy ? 'Salvando…' : 'Salvar e concluir'}
              </V2Button>
            </div>
          </div>
        )}

        {passo === 'nivel' && !essencial && (
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-2xl border border-gray-100 bg-paper p-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-ink text-acid">
                <Award className="h-5 w-5" />
              </div>
              <p className="text-sm leading-6 text-gray-600">
                Saber seu nível ajuda a encontrar torneios, jogos e parceiros compatíveis. Faça o
                teste de nivelamento (mais preciso) ou escolha seu nível na lista.
              </p>
            </div>

            {levelMode === 'choose' ? (
              <div className="space-y-3">
                <V2Select value={levelCode} onChange={(e) => setLevelCode(e.target.value)} aria-label="Escolha seu nível">
                  <option value="">Selecione seu nível…</option>
                  {LEVEL_OPTIONS.map(({ code, label }) => (
                    <option key={code} value={code}>{label}</option>
                  ))}
                </V2Select>

                {selectedLevelInfo ? (
                  <div className="rounded-2xl border border-gray-100 bg-paper-pure p-4">
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-ink px-2.5 py-1 text-xs font-bold text-acid">USAP {selectedLevelInfo.usap}</span>
                      <span className="font-display text-base font-bold text-ink">{selectedLevelInfo.name}</span>
                    </div>
                    {selectedLevelInfo.tagline && <p className="mt-2 text-sm font-semibold text-gray-600">{selectedLevelInfo.tagline}</p>}
                    <p className="mt-1 text-sm leading-6 text-gray-500">{selectedLevelInfo.description}</p>
                  </div>
                ) : (
                  <p className="text-xs text-gray-400">
                    Escolha um nível para ver a explicação do que ele significa.
                  </p>
                )}

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <button type="button" onClick={() => setLevelMode(null)} className="inline-flex items-center gap-1 text-sm font-semibold text-gray-400 hover:text-ink">
                    <ChevronLeft className="h-4 w-4" /> Voltar
                  </button>
                  <V2Button onClick={saveLevelAndFinish} disabled={busy || !levelCode}>
                    {busy ? 'Salvando…' : 'Salvar nível e concluir'}
                  </V2Button>
                </div>
              </div>
            ) : (
              <>
                <div className="grid gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => finish({ goToLeveling: true })}
                    disabled={busy}
                    className="btn-press rounded-2xl border border-transparent bg-ink px-4 py-4 text-left text-white transition-transform hover:scale-[1.01]"
                  >
                    <span className="block font-display text-base font-bold">Fazer o teste de nivelamento</span>
                    <span className="mt-1 block text-xs text-gray-300">Cerca de 3 minutos · resultado mais preciso</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setLevelMode('choose')}
                    disabled={busy}
                    className="btn-press rounded-2xl border border-gray-200 bg-paper-pure px-4 py-4 text-left text-ink transition-colors hover:border-ink"
                  >
                    <span className="block font-display text-base font-bold">Escolher meu nível na lista</span>
                    <span className="mt-1 block text-xs text-gray-500">Com explicação de cada nível</span>
                  </button>
                </div>
                <div className="flex justify-center pt-1">
                  <button type="button" onClick={() => finish()} disabled={busy} className="text-sm font-semibold text-gray-400 hover:text-ink">
                    {busy ? 'Concluindo…' : 'Concluir sem informar nível'}
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
