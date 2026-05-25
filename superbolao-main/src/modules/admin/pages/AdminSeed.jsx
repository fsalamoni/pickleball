import { useState } from 'react';
import { toast } from 'sonner';
import { Sprout, AlertTriangle } from 'lucide-react';
import { runClientSeed } from '@/modules/tournament/services/clientSeedService';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

/**
 * Tela do Admin Geral para popular as coleções estáticas do torneio.
 * Escreve direto no Firestore via SDK do cliente — as regras só liberam
 * gravação para `isPlatformAdmin()`. Independe da Cloud Function.
 */
export default function AdminSeed() {
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState([]);
  const [result, setResult] = useState(null);

  const onClick = async () => {
    if (
      !confirm(
        'Tem certeza? Isto APAGA o torneio existente (se houver) e cria um novo com 48 seleções, 12 grupos, fases, prazos e 104 partidas. Palpites e ranking dos bolões são preservados, mas placares oficiais e relações com partidas serão zerados.',
      )
    )
      return;

    setBusy(true);
    setProgress([]);
    setResult(null);
    try {
      const r = await runClientSeed({
        onProgress: (msg) => setProgress((prev) => [...prev, msg]),
      });
      setResult(r);
      toast.success('Torneio populado com sucesso!');
    } catch (err) {
      toast.error(err.message || 'Erro ao executar seed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <section className="arena-panel-strong rounded-lg p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-amber-300 text-slate-950">
            <Sprout className="h-5 w-5" />
          </div>
          <div className="max-w-2xl space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-emerald-200">Admin Geral</p>
            <h1 className="text-2xl font-bold text-white sm:text-3xl">Seed inicial do torneio</h1>
            <p className="text-sm leading-6 text-emerald-50/85">
              Popula torneio, fases, grupos, times, pontuação e 104 partidas da Copa 2026.
            </p>
          </div>
        </div>
      </section>

      <Card className="overflow-hidden">
        <CardHeader className="border-b border-emerald-950/10 bg-white/45 p-4 sm:p-5">
          <CardTitle className="text-base text-slate-950">Estrutura oficial do calendário</CardTitle>
          <CardDescription>
            Popula as coleções <code>tournaments</code>, <code>stages</code>, <code>groups</code>,{' '}
            <code>teams</code>, <code>scoring_tiers</code> e <code>matches</code>. Os times e datas devem ser ajustados após o sorteio oficial da FIFA.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 p-4 sm:p-5">
          <div className="flex items-start gap-2 rounded-md border border-amber-300/60 bg-amber-100/80 p-3 text-sm text-amber-950">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              Operação destrutiva: se já houver torneio cadastrado, ele é apagado antes do
              novo seed. Use apenas em testes ou no setup inicial.
            </div>
          </div>

          <Button onClick={onClick} disabled={busy} className="bg-emerald-700 hover:bg-emerald-800">
            <Sprout className="w-4 h-4" />
            {busy ? 'Populando…' : 'Executar seed'}
          </Button>

          {progress.length > 0 && (
            <div className="max-h-60 space-y-1 overflow-auto rounded-md border border-emerald-950/10 bg-slate-950 p-3 text-xs text-emerald-50">
              {progress.map((line, i) => (
                <div key={i} className="font-mono">{line}</div>
              ))}
            </div>
          )}

          {result && (
            <pre className="overflow-auto rounded-md border border-emerald-950/10 bg-emerald-50/80 p-3 text-xs text-slate-800">
              {JSON.stringify(result, null, 2)}
            </pre>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
