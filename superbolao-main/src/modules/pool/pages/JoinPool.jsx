import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Hash, Ticket } from 'lucide-react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { joinPoolByInvite } from '@/modules/pool/services/poolsService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export default function JoinPool() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!code.trim()) return;
    setBusy(true);
    try {
      const poolId = await joinPoolByInvite(code, user);
      toast.success('Você entrou no bolão!');
      navigate(`/boloes/${poolId}`);
    } catch (err) {
      toast.error(err.message || 'Não foi possível ingressar.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-md space-y-4">
      <section className="arena-panel-strong rounded-lg p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-amber-300 text-slate-950">
            <Ticket className="h-5 w-5" />
          </div>
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-emerald-200">Convite privado</p>
            <h1 className="text-2xl font-bold text-white sm:text-3xl">Ingressar em um bolão</h1>
            <p className="text-sm leading-6 text-emerald-50/85">Cole o código recebido pelo administrador.</p>
          </div>
        </div>
      </section>

      <Card className="overflow-hidden">
        <CardHeader className="border-b border-emerald-950/10 bg-white/45 p-4 sm:p-5">
          <CardTitle className="text-base text-slate-950">Código de convite</CardTitle>
          <CardDescription>Cole o código de convite recebido pelo administrador.</CardDescription>
        </CardHeader>
        <CardContent className="p-4 sm:p-5">
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="code">Código de convite</Label>
              <Input
                id="code"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 8))}
                placeholder="ABCDEFGH"
                className="h-12 text-center font-mono text-lg uppercase tracking-widest"
                maxLength={8}
                required
              />
            </div>
            <Button type="submit" disabled={busy} className="w-full bg-emerald-700 hover:bg-emerald-800">
              <Hash className="h-4 w-4" />
              {busy ? 'Conectando…' : 'Ingressar'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
