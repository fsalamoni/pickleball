import { useEffect, useState } from 'react';
import { Timestamp } from 'firebase/firestore';
import { toast } from 'sonner';
import { ShieldCheck, UserCheck } from 'lucide-react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { birthDateToBrtDate, validateRequiredProfile } from '@/core/lib/profileValidation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export default function Profile() {
  const { user, userProfile, updateUserProfile } = useAuth();
  const [platformName, setPlatformName] = useState(userProfile?.platform_name || userProfile?.full_name || '');
  const [birthDate, setBirthDate] = useState(userProfile?.birth_date || '');
  const [phone, setPhone] = useState(userProfile?.phone || '');
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setPlatformName(userProfile?.platform_name || userProfile?.full_name || '');
    setBirthDate(userProfile?.birth_date || '');
    setPhone(userProfile?.phone || '');
    setErrors({});
  }, [userProfile?.uid]);

  const onSave = async (e) => {
    e.preventDefault();
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
      toast.success('Perfil atualizado.');
    } catch (err) {
      toast.error(err.message || 'Erro ao salvar.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <section className="arena-panel-strong rounded-lg p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-amber-300 text-slate-950">
            <UserCheck className="h-5 w-5" />
          </div>
          <div className="max-w-2xl space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-emerald-200">Conta e elegibilidade</p>
            <h1 className="text-2xl font-bold text-white sm:text-3xl">Meu Perfil</h1>
            <p className="text-sm leading-6 text-emerald-50/85">Como você aparece para os outros membros dos bolões.</p>
          </div>
        </div>
      </section>

      <Card className="overflow-hidden">
        <CardHeader className="border-b border-emerald-950/10 bg-white/45 p-4 sm:p-5">
          <CardTitle className="text-base text-slate-950">Dados do participante</CardTitle>
          <CardDescription>Atualize nome público, data de nascimento e telefone de contato.</CardDescription>
        </CardHeader>
        <CardContent className="p-4 sm:p-5">
          <div className="mb-6 flex items-center gap-4 rounded-md border border-emerald-950/10 bg-gradient-to-br from-white/85 to-emerald-50/70 p-3">
            {user?.photoURL ? (
              <img src={user.photoURL} alt="" className="h-16 w-16 rounded-full border border-emerald-900/10" />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-900 text-2xl font-semibold text-emerald-50">
                {(platformName || user?.email)?.[0]?.toUpperCase()}
              </div>
            )}
            <div>
              <div className="font-medium">{user?.email}</div>
              <div className="text-xs text-slate-500">Login via Google</div>
            </div>
          </div>

          <form onSubmit={onSave} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="platform_name">Nome de exibição</Label>
              <Input
                id="platform_name"
                value={platformName}
                onChange={(e) => setPlatformName(e.target.value)}
                maxLength={60}
                required
              />
              {errors.platformName && <p className="text-xs text-red-600">{errors.platformName}</p>}
              <p className="text-xs text-slate-500">Esse é o nome que aparece nos rankings.</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="birth_date">Data de nascimento</Label>
                <Input
                  id="birth_date"
                  type="date"
                  value={birthDate}
                  onChange={(e) => setBirthDate(e.target.value)}
                  required
                />
                {errors.birthDate && <p className="text-xs text-red-600">{errors.birthDate}</p>}
                <p className="text-xs text-slate-500">Obrigatória para validar participação.</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Telefone</Label>
                <Input
                  id="phone"
                  type="tel"
                  inputMode="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="(11) 99999-9999"
                  required
                />
                {errors.phone && <p className="text-xs text-red-600">{errors.phone}</p>}
                <p className="text-xs text-slate-500">Use DDD e numero para contato.</p>
              </div>
            </div>
            <div className="flex items-start gap-2 rounded-md border border-amber-300/60 bg-amber-100/80 p-3 text-sm text-amber-950">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
              <span>Nao e permitida a participacao de menores em boloes.</span>
            </div>
            <Button type="submit" disabled={busy} className="bg-emerald-700 hover:bg-emerald-800">
              {busy ? 'Salvando...' : 'Salvar alterações'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
