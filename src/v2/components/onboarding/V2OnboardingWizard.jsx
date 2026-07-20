import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Timestamp } from 'firebase/firestore';
import { toast } from 'sonner';
import { Award, Building2, ChevronRight, Eye, GraduationCap, Trophy, Users } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { birthDateToBrtDate, validateRequiredProfile } from '@/core/lib/profileValidation';
import { PICKLEBALL_EXPERIENCE_LABELS } from '@/modules/tournament/domain/constants';
import { V2Button, V2Field, V2Input, V2Select } from '@/v2/ui/primitives';
import { cn } from '@/core/lib/utils';

const DEFER_KEY = 'onboarding_wizard_deferred';

/** Interesses/persona capturados no passo 2 (gravados em users.interests). */
export const ONBOARDING_INTERESTS = [
  { value: 'jogar', label: 'Jogar torneios', icon: Trophy },
  { value: 'organizar', label: 'Organizar torneios', icon: Users },
  { value: 'arena', label: 'Tenho arena/quadras', icon: Building2 },
  { value: 'ensinar', label: 'Dou aulas', icon: GraduationCap },
  { value: 'acompanhar', label: 'Só acompanhar', icon: Eye },
];

function readDeferred() {
  try {
    return sessionStorage.getItem(DEFER_KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * Onboarding em 3 passos no primeiro acesso (flag onboarding_wizard):
 * 1. dados essenciais (os mesmos exigidos para participar de torneios);
 * 2. interesses/persona ("o que você quer fazer na plataforma?");
 * 3. convite ao nivelamento.
 * Fechar adia pela sessão; concluir grava `onboarding_completed_at` e
 * `interests` no perfil.
 */
export default function V2OnboardingWizard() {
  const { userProfile, updateUserProfile } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [deferred, setDeferred] = useState(readDeferred);
  const [errors, setErrors] = useState({});
  const [form, setForm] = useState({ platformName: '', birthDate: '', phone: '', pickleballExperience: '' });
  const [interests, setInterests] = useState([]);

  useEffect(() => {
    setForm({
      platformName: userProfile?.platform_name || userProfile?.full_name || '',
      birthDate: userProfile?.birth_date || '',
      phone: userProfile?.phone || '',
      pickleballExperience: userProfile?.pickleball_experience || '',
    });
    setInterests(Array.isArray(userProfile?.interests) ? userProfile.interests : []);
    setErrors({});
  }, [userProfile?.uid]);

  const shouldOpen = Boolean(userProfile && !userProfile.onboarding_completed_at && !deferred);

  const hasLeveling = useMemo(
    () => Boolean(userProfile?.leveling_level || userProfile?.leveling?.result?.level),
    [userProfile],
  );

  if (!shouldOpen) return null;

  function handleDefer() {
    try {
      sessionStorage.setItem(DEFER_KEY, '1');
    } catch {
      // sessionStorage indisponível: adia apenas em memória.
    }
    setDeferred(true);
  }

  function set(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleStepOne() {
    const validation = validateRequiredProfile(form);
    if (!validation.isValid) {
      setErrors(validation.errors);
      return;
    }
    setBusy(true);
    try {
      await updateUserProfile({
        platform_name: form.platformName.trim(),
        birth_date: form.birthDate,
        birth_date_at: Timestamp.fromDate(birthDateToBrtDate(form.birthDate)),
        phone: form.phone.trim(),
        pickleball_experience: form.pickleballExperience,
      });
      setErrors({});
      setStep(1);
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

  async function handleStepTwo() {
    setBusy(true);
    try {
      await updateUserProfile({ interests });
      setStep(2);
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
      toast.success('Tudo pronto. Bom jogo!');
      if (goToLeveling) navigate('/nivelamento');
    } catch (err) {
      toast.error(err?.message || 'Não foi possível concluir. Tente novamente.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && handleDefer()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {step === 0 && 'Bem-vindo(a) à PickleRush!'}
            {step === 1 && 'O que você quer fazer por aqui?'}
            {step === 2 && 'Qual é o seu nível de jogo?'}
          </DialogTitle>
          <DialogDescription>
            {step === 0 && 'Complete os dados essenciais — são os mesmos exigidos para participar de torneios.'}
            {step === 1 && 'Escolha quantas opções quiser. Isso nos ajuda a destacar o que importa para você.'}
            {step === 2 && 'O nivelamento leva cerca de 3 minutos e ajuda a encontrar torneios e jogos do seu nível.'}
          </DialogDescription>
        </DialogHeader>

        <div className="mb-1 flex items-center gap-1.5">
          {[0, 1, 2].map((i) => (
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
            <V2Field label="Tempo de experiência em pickleball" htmlFor="onb_exp" error={errors.pickleballExperience} required>
              <V2Select id="onb_exp" value={form.pickleballExperience} onChange={(e) => set('pickleballExperience', e.target.value)}>
                <option value="">Selecione uma opção</option>
                {Object.entries(PICKLEBALL_EXPERIENCE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </V2Select>
            </V2Field>
            <div className="flex items-center justify-between pt-2">
              <button type="button" onClick={handleDefer} className="text-sm font-semibold text-gray-400 hover:text-ink">
                Deixar para depois
              </button>
              <V2Button onClick={handleStepOne} disabled={busy}>
                {busy ? 'Salvando…' : 'Continuar'} <ChevronRight className="h-4 w-4" />
              </V2Button>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-3">
            <div className="grid gap-2 sm:grid-cols-2">
              {ONBOARDING_INTERESTS.map(({ value, label, icon: Icon }) => {
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
              <button type="button" onClick={() => setStep(0)} className="text-sm font-semibold text-gray-400 hover:text-ink">
                Voltar
              </button>
              <V2Button onClick={handleStepTwo} disabled={busy}>
                {busy ? 'Salvando…' : 'Continuar'} <ChevronRight className="h-4 w-4" />
              </V2Button>
            </div>
          </div>
        )}

        {step === 2 && (
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
