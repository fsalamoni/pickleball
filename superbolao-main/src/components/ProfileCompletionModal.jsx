import { useEffect, useMemo, useState } from 'react';
import { Timestamp } from 'firebase/firestore';
import { AlertTriangle, Save } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { birthDateToBrtDate, isRequiredProfileComplete, validateRequiredProfile } from '@/core/lib/profileValidation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  const isComplete = useMemo(() => isRequiredProfileComplete(userProfile), [userProfile]);
  const shouldOpen = Boolean(userProfile && !isComplete);

  useEffect(() => {
    setPlatformName(userProfile?.platform_name || userProfile?.full_name || '');
    setBirthDate(userProfile?.birth_date || '');
    setPhone(userProfile?.phone || '');
    setErrors({});
  }, [userProfile?.uid]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const validation = validateRequiredProfile({ platformName, birthDate, phone });
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
      });
      toast.success('Perfil completo. Agora voce pode participar dos boloes.');
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
            Data de nascimento e telefone sao obrigatorios para participar dos boloes. Nao e permitida a participacao de menores.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <span>Ao continuar, confirme dados verdadeiros. Participantes menores de 18 anos nao podem entrar nos boloes.</span>
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