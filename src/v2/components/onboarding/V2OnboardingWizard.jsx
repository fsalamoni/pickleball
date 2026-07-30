import React, { useEffect, useMemo, useState } from 'react';
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
import {
  birthDateToBrtDate, isRegistrationComplete, validateRequiredProfile,
} from '@/core/lib/profileValidation';
import { PICKLEBALL_EXPERIENCE_LABELS } from '@/modules/tournament/domain/constants';
import { ATHLETE_GENDER_LABELS } from '@/modules/athletes/domain/constants';
import {
  COURT_SIDE_OPTIONS, PLATFORM_INTEREST_META, sanitizeInterests,
} from '@/modules/athletes/domain/profileMeta';
import { interestIcon } from '@/v2/components/profile/profileMetaIcons';
import { V2Button, V2Field, V2Input, V2Select } from '@/v2/ui/primitives';
import { cn } from '@/core/lib/utils';

// Mantido por compatibilidade de import (agora derivado dos metadados ricos).
export const ONBOARDING_INTERESTS = PLATFORM_INTEREST_META;

const STEP_COUNT = 4;

/**
 * Cadastro completo OBRIGATÓRIO no primeiro acesso — e para quem já está dentro,
 * na próxima entrada, até completar (flag onboarding_wizard). Não pode ser
 * adiado nem fechado; o preenchimento é permanente (uma vez) e tudo é editável
 * depois no perfil.
 *
 * Passos:
 *  0. Dados pessoais (nome, nascimento, telefone, gênero, cidade/UF);
 *  1. Preferências de jogo (experiência, lado da quadra);
 *  2. Interesses na plataforma (ao menos um);
 *  3. Convite ao nivelamento (opcional).
 */
export default function V2OnboardingWizard() {
  const { userProfile, updateUserProfile } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState({});
  const [form, setForm] = useState({
    platformName: '', birthDate: '', phone: '', gender: '', city: '', state: '',
    pickleballExperience: '', courtSide: '',
  });
  const [interests, setInterests] = useState([]);

  // Trava latcheada por usuário: decidimos UMA vez (ao carregar o perfil) se o
  // cadastro está incompleto. Assim salvar um passo não fecha o assistente no
  // meio; em sessões futuras, com o cadastro completo, ele não reabre.
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
    });
    setInterests(sanitizeInterests(userProfile?.interests));
    setErrors({});
    setOpenLatch(Boolean(userProfile && !isRegistrationComplete(userProfile)));
  }, [userProfile?.uid]); // eslint-disable-line react-hooks/exhaustive-deps

  const hasLeveling = useMemo(
    () => Boolean(userProfile?.leveling_level || userProfile?.leveling?.result?.level),
    [userProfile],
  );

  if (!openLatch) return null;

  function set(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handlePersonal() {
    const validation = validateRequiredProfile(form);
    const next = { ...validation.errors };
    if (!form.gender) next.gender = 'Informe seu gênero.';
    if (!form.city.trim()) next.city = 'Informe sua cidade.';
    if (!form.state.trim()) next.state = 'Informe a UF.';
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
      setErrors({});
      setStep(1);
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
    if (Object.keys(next).length > 0) { setErrors(next); return; }
    setBusy(true);
    try {
      await updateUserProfile({
        pickleball_experience: form.pickleballExperience,
        court_side: form.courtSide,
      });
      setErrors({});
      setStep(2);
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
      setStep(3);
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
      toast.success('Cadastro completo. Bom jogo!');
      if (goToLeveling) navigate('/nivelamento');
    } catch (err) {
      toast.error(err?.message || 'Não foi possível concluir. Tente novamente.');
    } finally {
      setBusy(false);
    }
  }

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
          <DialogTitle>
            {step === 0 && 'Bem-vindo(a) à PickleRush!'}
            {step === 1 && 'Suas preferências de jogo'}
            {step === 2 && 'O que você quer fazer por aqui?'}
            {step === 3 && 'Qual é o seu nível de jogo?'}
          </DialogTitle>
          <DialogDescription>
            {step === 0 && 'Complete seu cadastro para usar a plataforma. Leva 1 minuto e você só faz uma vez.'}
            {step === 1 && 'Isso ajuda a encontrar parcerias e jogos compatíveis com você.'}
            {step === 2 && 'Escolha ao menos uma opção. Usamos isso para destacar o que importa para você.'}
            {step === 3 && 'O nivelamento é opcional e leva cerca de 3 minutos.'}
          </DialogDescription>
        </DialogHeader>

        <div className="mb-1 flex items-center gap-1.5">
          {Array.from({ length: STEP_COUNT }).map((_, i) => (
            <span key={i} className={cn('h-1.5 flex-1 rounded-full', i <= step ? 'bg-acid' : 'bg-gray-100')} />
          ))}
        </div>

        {step === 0 && (
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
                <V2Input id="onb_uf" value={form.state} maxLength={2} placeholder="SP" onChange={(e) => set('state', e.target.value)} />
              </V2Field>
            </div>
            <div className="flex items-center justify-end pt-2">
              <V2Button onClick={handlePersonal} disabled={busy}>
                {busy ? 'Salvando…' : 'Continuar'} <ChevronRight className="h-4 w-4" />
              </V2Button>
            </div>
          </div>
        )}

        {step === 1 && (
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
            <div className="flex items-center justify-between pt-2">
              <button type="button" onClick={() => setStep(0)} className="inline-flex items-center gap-1 text-sm font-semibold text-gray-400 hover:text-ink">
                <ChevronLeft className="h-4 w-4" /> Voltar
              </button>
              <V2Button onClick={handlePreferences} disabled={busy}>
                {busy ? 'Salvando…' : 'Continuar'} <ChevronRight className="h-4 w-4" />
              </V2Button>
            </div>
          </div>
        )}

        {step === 2 && (
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
              <button type="button" onClick={() => setStep(1)} className="inline-flex items-center gap-1 text-sm font-semibold text-gray-400 hover:text-ink">
                <ChevronLeft className="h-4 w-4" /> Voltar
              </button>
              <V2Button onClick={handleInterests} disabled={busy || interests.length === 0}>
                {busy ? 'Salvando…' : 'Continuar'} <ChevronRight className="h-4 w-4" />
              </V2Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-2xl border border-gray-100 bg-paper p-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-ink text-acid">
                <Award className="h-5 w-5" />
              </div>
              <p className="text-sm leading-6 text-gray-600">
                {hasLeveling
                  ? 'Você já tem um nível registrado. Se quiser, refaça o questionário a qualquer momento.'
                  : 'Responda o questionário de nivelamento para receber sugestões de torneios e parceiros compatíveis com o seu jogo.'}
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <button type="button" onClick={() => finish()} disabled={busy} className="text-sm font-semibold text-gray-400 hover:text-ink">
                Concluir sem nivelamento
              </button>
              <V2Button onClick={() => finish({ goToLeveling: true })} disabled={busy}>
                {busy ? 'Concluindo…' : 'Fazer nivelamento agora'}
              </V2Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
