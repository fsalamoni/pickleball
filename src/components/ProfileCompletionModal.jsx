import { useEffect, useMemo, useState } from 'react';
import { Timestamp } from 'firebase/firestore';
import { AlertTriangle, Save } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { birthDateToBrtDate, isRequiredProfileComplete, validateRequiredProfile } from '@/core/lib/profileValidation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PICKLEBALL_EXPERIENCE_LABELS } from '@/modules/tournament/domain/constants';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export default function ProfileCompletionModal() {
  const { userProfile, updateUserProfile } = useAuth();
  const [platformName, setPlatformName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [phone, setPhone] = useState('');
  const [pickleballExperience, setPickleballExperience] = useState('');
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  const isComplete = useMemo(() => isRequiredProfileComplete(userProfile), [userProfile]);
  const shouldOpen = Boolean(userProfile && !isComplete);

  useEffect(() => {
    setPlatformName(userProfile?.platform_name || userProfile?.full_name || '');
    setBirthDate(userProfile?.birth_date || '');
    setPhone(userProfile?.phone || '');
    setPickleballExperience(userProfile?.pickleball_experience || '');
    setErrors({});
  }, [userProfile?.uid]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const validation = validateRequiredProfile({ platformName, birthDate, phone, pickleballExperience });
    if (!validation.isValid) {
      setErrors(validation.errors);
      return;
    }

    setBusy(true);
    try {
      await updateUserProfile({
        platform_name: platformName.trim(),
        birth_date: birthDate,
        birth_date_at: Timestamp.fromDate(birthDateToBrtDate(birthDate)),
        phone: phone.trim(),
        pickleball_experience: pickleballExperience,
      });
      toast.success('Perfil completo. Agora você pode participar dos torneios.');
    } catch (error) {
      toast.error(error.message || 'Erro ao salvar o perfil.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AlertDialog open={shouldOpen}>
      <AlertDialogContent className="max-w-xl">
        <AlertDialogHeader>
          <AlertDialogTitle>Complete seu perfil</AlertDialogTitle>
          <AlertDialogDescription>
            Data de nascimento, telefone e tempo de experiência são obrigatórios para participar dos torneios. Todas as idades são bem-vindas.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="rounded-md border border-gray-200 bg-acid/10 p-3 text-sm text-ink flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-ink" />
            <span>Ao continuar, confirme dados verdadeiros. A plataforma é aberta a participantes de todas as idades.</span>
          </div>

          <div className="space-y-2">
            <Label htmlFor="modal_platform_name">Nome de exibicao</Label>
            <Input
              id="modal_platform_name"
              value={platformName}
              onChange={(event) => setPlatformName(event.target.value)}
              maxLength={60}
              required
            />
            {errors.platformName && <p className="text-xs text-red-600">{errors.platformName}</p>}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="modal_birth_date">Data de nascimento</Label>
              <Input
                id="modal_birth_date"
                type="date"
                value={birthDate}
                onChange={(event) => setBirthDate(event.target.value)}
                required
              />
              {errors.birthDate && <p className="text-xs text-red-600">{errors.birthDate}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="modal_phone">Telefone</Label>
              <Input
                id="modal_phone"
                type="tel"
                inputMode="tel"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="(11) 99999-9999"
                required
              />
              {errors.phone && <p className="text-xs text-red-600">{errors.phone}</p>}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="modal_pickleball_experience">Tempo de experiência em pickleball</Label>
            <select
              id="modal_pickleball_experience"
              value={pickleballExperience}
              onChange={(event) => setPickleballExperience(event.target.value)}
              required
              className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <option value="">Selecione uma opção</option>
              {Object.entries(PICKLEBALL_EXPERIENCE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
            {errors.pickleballExperience && <p className="text-xs text-red-600">{errors.pickleballExperience}</p>}
          </div>

          <AlertDialogFooter>
            <Button type="submit" disabled={busy} className="w-full sm:w-auto">
              <Save className="h-4 w-4" />
              {busy ? 'Salvando...' : 'Salvar e continuar'}
            </Button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}