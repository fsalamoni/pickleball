import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Plus, ShieldCheck, Trophy } from 'lucide-react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { usePoolCreatorAuthorization } from '@/modules/admin/hooks/usePoolCreatorAuthorization';
import { useTournamentStaticData } from '@/modules/tournament/hooks/useTournament';
import { CREATOR_REQUEST_STATUS, requestPoolCreatorAuthorization } from '@/modules/admin/services/adminService';
import { createPool } from '@/modules/pool/services/poolsService';
import { POOL_TEMPLATE_CODES, SPORT_PRESETS } from '@/modules/pool/domain/poolSettings';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

export default function CreatePool() {
  const { user } = useAuth();
  const { canCreatePools, request, isLoading } = usePoolCreatorAuthorization();
  const { tournament, isLoading: tournamentLoading } = useTournamentStaticData();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [entryFee, setEntryFee] = useState('50');
  const [templateCode, setTemplateCode] = useState(POOL_TEMPLATE_CODES.worldCup2026);
  const [sportCode, setSportCode] = useState('soccer');
  const [sportName, setSportName] = useState('');
  const [requestMessage, setRequestMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    try {
      const poolId = await createPool(
        {
          name: name.trim(),
          description: description.trim(),
          entry_fee: Number(entryFee) || 0,
          template_code: templateCode,
          tournament_id: templateCode === POOL_TEMPLATE_CODES.worldCup2026 ? tournament?.id || null : null,
          sport_code: sportCode,
          sport_name: sportName.trim(),
        },
        user,
      );
      toast.success('Bolão criado!');
      navigate(`/boloes/${poolId}`);
    } catch (err) {
      toast.error(err.message || 'Erro ao criar bolão.');
    } finally {
      setBusy(false);
    }
  };

  const onRequestAuthorization = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await requestPoolCreatorAuthorization(user, requestMessage);
      toast.success('Solicitação enviada para o admin geral.');
    } catch (err) {
      toast.error(err.message || 'Erro ao solicitar autorização.');
    } finally {
      setBusy(false);
    }
  };

  if (isLoading) {
    return (
      <div className="mx-auto max-w-2xl">
        <Skeleton className="h-80" />
      </div>
    );
  }

  if (!canCreatePools) {
    const isPending = request?.status === CREATOR_REQUEST_STATUS.pending;
    const wasDenied = request?.status === CREATOR_REQUEST_STATUS.denied;

    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <section className="arena-panel-strong rounded-lg p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-amber-300 text-slate-950">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div className="max-w-2xl space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-emerald-200">Permissão necessária</p>
              <h1 className="text-2xl font-bold text-white sm:text-3xl">Solicitar autorização</h1>
              <p className="text-sm leading-6 text-emerald-50/85">Para criar bolões, solicite liberação ao Admin Geral.</p>
            </div>
          </div>
        </section>

        <Card className="overflow-hidden">
          <CardHeader className="border-b border-emerald-950/10 bg-white/45 p-4 sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-base text-slate-950">Fila de autorização</CardTitle>
              {request?.status && (
                <Badge variant={isPending ? 'warning' : wasDenied ? 'destructive' : 'success'}>
                  {isPending ? 'Pendente' : wasDenied ? 'Recusada' : 'Aprovada'}
                </Badge>
              )}
            </div>
            <CardDescription>
              Para criar bolões, solicite liberação ao admin geral da plataforma. A resposta aparecerá nas notificações e nesta tela.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 p-4 sm:p-5">
            {request?.admin_response && (
              <div className="rounded-md border border-emerald-950/10 bg-white/65 p-3 text-sm text-slate-700">
                <strong>Resposta do admin:</strong> {request.admin_response}
              </div>
            )}
            {isPending || wasDenied ? (
              <p className="text-sm text-slate-600">
                {isPending
                  ? 'Sua solicitação está em análise. Você poderá criar bolões assim que for aprovada.'
                  : 'Sua solicitação foi analisada e não está liberada para reenvio neste momento.'}
              </p>
            ) : (
              <form onSubmit={onRequestAuthorization} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="request_message">Mensagem para o admin (opcional)</Label>
                  <Input
                    id="request_message"
                    value={requestMessage}
                    onChange={(e) => setRequestMessage(e.target.value)}
                    maxLength={200}
                    placeholder="Explique por que deseja criar um bolão."
                  />
                </div>
                <Button type="submit" disabled={busy} className="w-full bg-emerald-700 hover:bg-emerald-800">
                  {busy ? 'Enviando…' : 'Solicitar autorização'}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <section className="arena-panel-strong rounded-lg p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-amber-300 text-slate-950">
            <Trophy className="h-5 w-5" />
          </div>
          <div className="max-w-2xl space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-emerald-200">Novo bolão</p>
            <h1 className="text-2xl font-bold text-white sm:text-3xl">Criar um novo bolão</h1>
            <p className="text-sm leading-6 text-emerald-50/85">Você será o admin deste bolão. Após a criação, um código de convite único será gerado.</p>
          </div>
        </div>
      </section>

      <Card className="overflow-hidden">
        <CardHeader className="border-b border-emerald-950/10 bg-white/45 p-4 sm:p-5">
          <CardTitle className="text-base text-slate-950">Configuração inicial</CardTitle>
          <CardDescription>Defina modelo, nome, descrição e valor informativo.</CardDescription>
        </CardHeader>
        <CardContent className="p-4 sm:p-5">
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="template_code">Modelo do bolão</Label>
              <select
                id="template_code"
                value={templateCode}
                onChange={(e) => setTemplateCode(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                disabled={tournamentLoading}
              >
                <option value={POOL_TEMPLATE_CODES.worldCup2026}>Copa do Mundo 2026 completa</option>
                <option value={POOL_TEMPLATE_CODES.custom}>Criação livre</option>
              </select>
              <p className="text-xs text-slate-500">
                A opção Copa 2026 usa os 104 jogos, fases, prazos e pontuações do torneio. A criação livre fica sem
                calendário até o admin configurar as regras.
              </p>
            </div>
            {templateCode === POOL_TEMPLATE_CODES.custom && (
              <div className="space-y-2">
                <Label htmlFor="sport_code">Esporte/modalidade</Label>
                <select
                  id="sport_code"
                  value={sportCode}
                  onChange={(e) => setSportCode(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {Object.values(SPORT_PRESETS).map((preset) => (
                    <option key={preset.code} value={preset.code}>{preset.label}</option>
                  ))}
                </select>
                {sportCode === 'custom' && (
                  <Input
                    value={sportName}
                    onChange={(e) => setSportName(e.target.value)}
                    placeholder="Nome do esporte/modalidade"
                    maxLength={60}
                  />
                )}
                <p className="text-xs text-slate-500">
                  O admin poderá ajustar regras, fases, competidores, jogos, prazos e resultados depois da criação.
                </p>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="name">Nome do bolão</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Bolão da firma 2026"
                required
                maxLength={80}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Descrição (opcional)</Label>
              <Input
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Ex: Bolão entre amigos, prêmio para os 3 primeiros."
                maxLength={200}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="entry_fee">Contribuição sugerida (R$)</Label>
              <Input
                id="entry_fee"
                type="number"
                min="0"
                step="1"
                value={entryFee}
                onChange={(e) => setEntryFee(e.target.value)}
                placeholder="50"
              />
              <p className="text-xs text-slate-500">Apenas informativo. A plataforma não processa pagamentos.</p>
            </div>
            <Button type="submit" disabled={busy} className="w-full bg-emerald-700 hover:bg-emerald-800">
              <Plus className="h-4 w-4" />
              {busy ? 'Criando…' : 'Criar bolão'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
