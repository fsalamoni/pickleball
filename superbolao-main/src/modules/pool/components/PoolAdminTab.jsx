import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '@/core/config/firebase';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { AuditLogTable } from '@/components/AuditLogTable';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { updatePool, softDeletePool, confirmMemberPayment } from '@/modules/pool/services/poolsService';
import { importOfficialCompetitionToPool, OFFICIAL_COMPETITION_PROVIDERS } from '@/modules/pool/services/competitionImportService';
import { createPoolCompetitor, createPoolMatch, deletePoolCompetitor, deletePoolMatch, updatePoolMatchResult } from '@/modules/pool/services/customPoolService';
import { usePoolCompetitors, usePoolMatchesByStage } from '@/modules/tournament/hooks/useTournament';
import {
  CUSTOM_STAGE_TYPES,
  STAGE_ORDER,
  getPoolStage,
  getPoolStages,
  getSportParameterRows,
  normalizePoolSettings,
  normalizeScoreValue,
  POOL_TEMPLATE_CODES,
  SPORT_PRESETS,
  stageAllowsTiebreaker,
  validateSportScorePair,
} from '@/modules/pool/domain/poolSettings';
import { getPenaltyWinner, MAX_PENALTY_SCORE, normalizePenaltyScore } from '@/modules/pool/domain/penaltyShootout';
import { normalizePaymentStatus, paymentStatusLabel } from '@/modules/pool/domain/paymentStatus';

const SCORING_FIELDS = [
  ['exact_score', 'Bucha'],
  ['winner_plus_diff', 'Vencedor + diferença'],
  ['winner_plus_team_goals', 'Vencedor + nº gols'],
  ['winner_only', 'Apenas vencedor'],
  ['team_goals_only', 'Apenas nº gols'],
  ['penalty_winner', 'Pênaltis: apenas vencedor'],
];
const MAX_QR_CODE_SIZE_BYTES = 700 * 1024;
const MIN_ZEBRA_MULTIPLIER = 2;
const MAX_ZEBRA_MULTIPLIER = 4;

export function PoolAdminTab({ pool }) {
  const { user } = useAuth();
  const [name, setName] = useState(pool?.name || '');
  const [description, setDescription] = useState(pool?.description || '');
  const [entryFee, setEntryFee] = useState(String(pool?.entry_fee ?? 0));
  const [participationInfoText, setParticipationInfoText] = useState(pool?.participation_info_text || '');
  const [participationQrCode, setParticipationQrCode] = useState(pool?.participation_qr_code_data_url || '');
  const [settings, setSettings] = useState(() => normalizePoolSettings(pool?.settings));
  const adminStages = pool?.template_code === POOL_TEMPLATE_CODES.custom ? getPoolStages({ ...pool, settings }) : STAGE_ORDER.map((code) => ({ code, label: settings.scoring_overrides[code]?.label || code }));
  const [busy, setBusy] = useState(false);
  const poolVersion = `${pool?.id || ''}:${pool?.updated_at?.seconds ?? pool?.updated_at?.toMillis?.() ?? ''}`;

  useEffect(() => {
    setName(pool?.name || '');
    setDescription(pool?.description || '');
    setEntryFee(String(pool?.entry_fee ?? 0));
    setParticipationInfoText(pool?.participation_info_text || '');
    setParticipationQrCode(pool?.participation_qr_code_data_url || '');
    setSettings(normalizePoolSettings(pool?.settings));
  }, [poolVersion]);

  const onSave = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await updatePool(pool.id, {
        name,
        description,
        entry_fee: Number(entryFee) || 0,
        participation_info_text: participationInfoText.trim(),
        participation_qr_code_data_url: participationQrCode,
        settings: normalizePoolSettings(settings),
      }, user);
      toast.success('Bolão atualizado.');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden">
        <CardHeader className="border-b border-emerald-950/10 bg-white/45 p-4 sm:p-5">
          <CardTitle className="text-base text-slate-950">Configurações do bolão</CardTitle>
          <CardDescription>Apenas você (admin) vê esta aba.</CardDescription>
        </CardHeader>
        <CardContent className="p-4 sm:p-5">
          <form onSubmit={onSave} className="space-y-3">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome" required />
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Descrição" />
            <Input
              type="number"
              min="0"
              step="1"
              value={entryFee}
              onChange={(e) => setEntryFee(e.target.value)}
              placeholder="Valor sugerido"
            />
            <div className="space-y-2 rounded-md border border-emerald-950/10 bg-white/60 p-3">
              <label className="text-sm font-medium text-slate-800" htmlFor="participation_info_text">
                Informações para participação
              </label>
              <textarea
                id="participation_info_text"
                value={participationInfoText}
                onChange={(e) => setParticipationInfoText(e.target.value)}
                className="min-h-32 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                placeholder="Informe dados de pagamento, instruções e observações para os participantes."
                maxLength={3000}
              />
              <p className="text-xs text-slate-500">Este texto aparecerá no dashboard do bolão.</p>
            </div>
            <div className="space-y-2 rounded-md border border-emerald-950/10 bg-white/60 p-3">
              <label className="text-sm font-medium text-slate-800" htmlFor="participation_qr_code">
                QR code de pagamento
              </label>
              <Input id="participation_qr_code" type="file" accept="image/*" onChange={(e) => readQrCodeFile(e, setParticipationQrCode)} />
              {participationQrCode && (
                <div className="flex items-center gap-3">
                  <img src={participationQrCode} alt="Prévia do QR code" className="h-32 w-32 rounded border border-emerald-950/10 object-contain" />
                  <Button type="button" variant="outline" onClick={() => setParticipationQrCode('')}>
                    Remover QR code
                  </Button>
                </div>
              )}
              <p className="text-xs text-slate-500">Use imagem legível e preferencialmente quadrada. Tamanho máximo: 700 KB.</p>
            </div>
            <label className="flex items-center gap-2 rounded-md border border-emerald-950/10 bg-white/65 p-3 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={settings.zebras_enabled}
                onChange={(e) => setSettings((prev) => ({ ...prev, zebras_enabled: e.target.checked }))}
              />
              Habilitar multiplicadores de zebra
            </label>
            <RulesEditor settings={settings} setSettings={setSettings} />
            <Button type="submit" disabled={busy} className="bg-emerald-700 hover:bg-emerald-800">{busy ? 'Salvando…' : 'Salvar'}</Button>
          </form>
        </CardContent>
      </Card>

      {pool.template_code === POOL_TEMPLATE_CODES.custom && (
        <CustomPoolAdminSection pool={pool} settings={settings} setSettings={setSettings} />
      )}

      <Card className="overflow-hidden">
        <CardHeader className="border-b border-emerald-950/10 bg-white/45 p-4 sm:p-5">
          <CardTitle className="text-base text-slate-950">Prazos de palpites</CardTitle>
          <CardDescription>Altere o encerramento do cartão por fase deste bolão.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 p-4 sm:grid-cols-2 sm:p-5">
          {adminStages.map((stage) => (
            <label key={stage.code} className="space-y-1 rounded-md border border-emerald-950/10 bg-white/60 p-3 text-sm">
              <span className="font-medium">{settings.scoring_overrides[stage.code]?.label || stage.label}</span>
              <Input
                type="datetime-local"
                value={toDateTimeLocal(settings.deadline_overrides[stage.code])}
                onChange={(e) => updateDeadline(stage.code, e.target.value, setSettings)}
              />
            </label>
          ))}
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader className="border-b border-emerald-950/10 bg-white/45 p-4 sm:p-5">
          <CardTitle className="text-base text-slate-950">Regras de pontuação</CardTitle>
          <CardDescription>Os valores abaixo serão usados no cálculo deste bolão.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 p-4 sm:p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1 rounded-md border border-emerald-950/10 bg-white/60 p-3 text-sm">
              <span className="font-medium">Campeão</span>
              <Input
                type="number"
                min="0"
                value={settings.special_bet_points.champion}
                onChange={(e) => updateSpecialPoints('champion', e.target.value, setSettings)}
              />
            </label>
            <label className="space-y-1 rounded-md border border-emerald-950/10 bg-white/60 p-3 text-sm">
              <span className="font-medium">Artilheiro</span>
              <Input
                type="number"
                min="0"
                value={settings.special_bet_points.top_scorer}
                onChange={(e) => updateSpecialPoints('top_scorer', e.target.value, setSettings)}
              />
            </label>
          </div>
          <div className="arena-table-wrap">
            <table className="min-w-[860px] w-full text-sm">
              <thead>
                <tr className="border-b border-emerald-900/40 bg-emerald-950 text-left text-emerald-50">
                  <th className="py-3 pl-4 pr-3 font-semibold">Fase</th>
                  {SCORING_FIELDS.map(([key, label]) => (
                    <th key={key} className="py-3 px-2 font-semibold">{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-emerald-950/10 bg-white/65">
                {adminStages.map((stage) => (
                  <tr key={stage.code} className="transition-colors hover:bg-emerald-50/70">
                    <td className="py-2 pl-4 pr-3 font-medium text-slate-800">{settings.scoring_overrides[stage.code]?.label || stage.label}</td>
                    {SCORING_FIELDS.map(([key]) => (
                      <td key={key} className="py-2 px-2">
                        <Input
                          type="number"
                          min="0"
                          value={settings.scoring_overrides[stage.code]?.[key] ?? 0}
                          onChange={(e) => updateScoring(stage.code, key, e.target.value, setSettings)}
                          className="w-20"
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader className="border-b border-emerald-950/10 bg-white/45 p-4 sm:p-5">
          <CardTitle className="text-base text-slate-950">Membros</CardTitle>
          <CardDescription>Compartilhe o código <code className="font-mono">{pool.invite_code}</code> para convidar.</CardDescription>
        </CardHeader>
        <CardContent className="p-4 sm:p-5">
          <PoolMembers pool={pool} />
        </CardContent>
      </Card>

      <AuditLogTable
        title="Log geral do bolão"
        description="Registros de pagamentos, configurações, palpites e alterações deste bolão."
        poolId={pool.id}
      />

      <DeletePoolSection pool={pool} />
    </div>
  );
}

function RulesEditor({ settings, setSettings }) {
  const fields = [
    ['general_text', 'Regras gerais'],
    ['scoring_text', 'Regras de pontuação'],
    ['tiebreaker_text', 'Critérios de desempate'],
    ['default_bet_text', 'Palpite ausente'],
    ['result_text', 'Resultados oficiais'],
  ];
  return (
    <div className="space-y-3 rounded-md border border-emerald-950/10 bg-white/60 p-3">
      <div>
        <div className="text-sm font-medium text-slate-800">Texto integral das regras</div>
        <p className="text-xs text-slate-500">Estes textos aparecem na aba Regras deste bolão.</p>
      </div>
      {fields.map(([key, label]) => (
        <label key={key} className="space-y-1 text-sm">
          <span className="font-medium">{label}</span>
          <textarea
            value={settings.rules[key] || ''}
            onChange={(e) => updateRuleText(key, e.target.value, setSettings)}
            className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            maxLength={1200}
          />
        </label>
      ))}
    </div>
  );
}

function CustomPoolAdminSection({ pool, settings, setSettings }) {
  const stages = getPoolStages({ ...pool, settings });
  const { competitors, isLoading } = usePoolCompetitors(pool.id);
  const [activeStage, setActiveStage] = useState(stages[0]?.code || 'regular');
  const [competitorName, setCompetitorName] = useState('');
  const [competitorCode, setCompetitorCode] = useState('');
  const [importProvider, setImportProvider] = useState('fifa');
  const [competitionId, setCompetitionId] = useState(OFFICIAL_COMPETITION_PROVIDERS.fifa.default_competition_id);
  const [dateFrom, setDateFrom] = useState(OFFICIAL_COMPETITION_PROVIDERS.fifa.default_from);
  const [dateTo, setDateTo] = useState(OFFICIAL_COMPETITION_PROVIDERS.fifa.default_to);
  const [importBusy, setImportBusy] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    if (!stages.some((stage) => stage.code === activeStage)) {
      setActiveStage(stages[0]?.code || 'regular');
    }
  }, [activeStage, stages]);

  useEffect(() => {
    const provider = OFFICIAL_COMPETITION_PROVIDERS[importProvider];
    if (!provider) return;
    setCompetitionId((current) => current || provider.default_competition_id);
    setDateFrom((current) => current || provider.default_from);
    setDateTo((current) => current || provider.default_to);
  }, [importProvider]);

  const selectedProvider = OFFICIAL_COMPETITION_PROVIDERS[importProvider] || OFFICIAL_COMPETITION_PROVIDERS.fifa;

  const addCompetitor = async () => {
    try {
      await createPoolCompetitor(pool.id, { name: competitorName, code: competitorCode }, user);
      setCompetitorName('');
      setCompetitorCode('');
      toast.success('Competidor cadastrado.');
    } catch (err) {
      toast.error(err.message);
    }
  };

  const runImport = async (dryRun = false) => {
    setImportBusy(true);
    try {
      const summary = await importOfficialCompetitionToPool({
        pool_id: pool.id,
        provider: importProvider,
        competition_id: competitionId.trim(),
        from: dateFrom || null,
        to: dateTo || null,
        dry_run: dryRun,
      });
      if (dryRun) {
        toast.success(`Prévia pronta: ${summary.matches || 0} jogos, ${summary.competitors || 0} competidores e ${summary.stages || 0} fases.`);
      } else {
        toast.success(`Importação concluída: ${summary.matches_created || 0} jogos novos, ${summary.matches_updated || 0} atualizados.`);
      }
    } catch (err) {
      toast.error(err.message || 'Não foi possível importar a competição oficial.');
    } finally {
      setImportBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden">
        <CardHeader className="border-b border-emerald-950/10 bg-white/45 p-4 sm:p-5">
          <CardTitle className="text-base text-slate-950">Formato da competição e importação oficial</CardTitle>
          <CardDescription>
            Monte fases livres, com grupo único, múltiplas fases de grupos, mata-mata ou combinação entre formatos.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 p-4 sm:p-5">
          <div className="space-y-3 rounded-md border border-emerald-950/10 bg-white/60 p-3">
            {stages.map((stage, index) => (
              <div key={stage.code} className="grid gap-2 rounded-md border border-emerald-950/10 bg-white/80 p-3 md:grid-cols-[1.1fr_1fr_10rem_10rem_auto]">
                <Input
                  value={stage.label}
                  onChange={(e) => updateCustomStage(stage.code, 'label', e.target.value, setSettings)}
                  placeholder="Nome da fase"
                />
                <Input
                  value={stage.code}
                  onChange={(e) => updateCustomStageCode(stage.code, e.target.value, setSettings)}
                  placeholder="codigo_da_fase"
                />
                <select
                  value={stage.phase_type}
                  onChange={(e) => updateCustomStage(stage.code, 'phase_type', e.target.value, setSettings)}
                  className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value={CUSTOM_STAGE_TYPES.league}>Pontos corridos</option>
                  <option value={CUSTOM_STAGE_TYPES.groups}>Fase de grupos</option>
                  <option value={CUSTOM_STAGE_TYPES.knockout}>Mata-mata</option>
                  <option value={CUSTOM_STAGE_TYPES.custom}>Formato livre</option>
                </select>
                <Input
                  value={stage.section_label || ''}
                  onChange={(e) => updateCustomStage(stage.code, 'section_label', e.target.value, setSettings)}
                  placeholder="Grupo/Rodada/Chave"
                />
                <div className="flex items-center gap-1">
                  <Button type="button" size="sm" variant="outline" onClick={() => moveCustomStage(stage.code, -1, setSettings)} disabled={index === 0}>↑</Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => moveCustomStage(stage.code, 1, setSettings)} disabled={index === stages.length - 1}>↓</Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => removeCustomStage(stage.code, setSettings)} disabled={stages.length <= 1}>Excluir</Button>
                </div>
                <label className="md:col-span-5 flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={stage.allows_tiebreaker}
                    onChange={(e) => updateCustomStage(stage.code, 'allows_tiebreaker', e.target.checked, setSettings)}
                  />
                  Permitir desempate/pênaltis nesta fase
                </label>
              </div>
            ))}
            <Button type="button" variant="outline" onClick={() => addCustomStage(setSettings)}>
              Adicionar fase
            </Button>
          </div>

          <div className="space-y-3 rounded-md border border-emerald-950/10 bg-white/60 p-3">
            <div>
              <div className="text-sm font-medium text-slate-800">Importar de site oficial</div>
              <p className="text-xs text-slate-500">{selectedProvider.helper_text}</p>
            </div>
            <div className="grid gap-3 md:grid-cols-4">
              <label className="space-y-1 text-sm">
                <span className="font-medium">Provedor</span>
                <select
                  value={importProvider}
                  onChange={(e) => setImportProvider(e.target.value)}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  {Object.values(OFFICIAL_COMPETITION_PROVIDERS).map((provider) => (
                    <option key={provider.code} value={provider.code}>{provider.label}</option>
                  ))}
                </select>
              </label>
              <label className="space-y-1 text-sm">
                <span className="font-medium">ID oficial da competição</span>
                <Input value={competitionId} onChange={(e) => setCompetitionId(e.target.value)} placeholder="Ex: 17" />
              </label>
              <label className="space-y-1 text-sm">
                <span className="font-medium">Data inicial</span>
                <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
              </label>
              <label className="space-y-1 text-sm">
                <span className="font-medium">Data final</span>
                <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
              </label>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" disabled={importBusy || !competitionId.trim()} onClick={() => runImport(true)}>
                {importBusy ? 'Consultando…' : 'Validar importação'}
              </Button>
              <Button type="button" disabled={importBusy || !competitionId.trim()} onClick={() => runImport(false)}>
                {importBusy ? 'Importando…' : 'Importar / sincronizar'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader className="border-b border-emerald-950/10 bg-white/45 p-4 sm:p-5">
          <CardTitle className="text-base text-slate-950">Esporte e competidores</CardTitle>
          <CardDescription>Configure modalidades livres sem alterar a Copa 2026.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 p-4 sm:p-5">
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="space-y-1 text-sm">
              <span className="font-medium">Esporte</span>
              <select
                value={settings.sport_config.code}
                onChange={(e) => updateSportPreset(e.target.value, setSettings)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                {Object.values(SPORT_PRESETS).map((preset) => <option key={preset.code} value={preset.code}>{preset.label}</option>)}
              </select>
            </label>
            <label className="space-y-1 text-sm">
              <span className="font-medium">Nome exibido</span>
              <Input value={settings.sport_config.label} onChange={(e) => updateSportField('label', e.target.value, setSettings)} />
            </label>
            <label className="space-y-1 text-sm">
              <span className="font-medium">Unidade do placar</span>
              <Input value={settings.sport_config.score_label} onChange={(e) => updateSportField('score_label', e.target.value, setSettings)} />
            </label>
            <label className="space-y-1 text-sm">
              <span className="font-medium">Placar máximo por lado</span>
              <Input type="number" min="1" value={settings.sport_config.max_score} onChange={(e) => updateSportField('max_score', Number(e.target.value) || 1, setSettings)} />
            </label>
            <label className="space-y-1 text-sm">
              <span className="font-medium">Incremento do placar</span>
              <Input type="number" min="0.01" step="0.01" value={settings.sport_config.score_step} onChange={(e) => updateSportField('score_step', Number(e.target.value) || 1, setSettings)} />
            </label>
            <label className="space-y-1 text-sm">
              <span className="font-medium">Nome do desempate</span>
              <Input value={settings.sport_config.tie_break_label} onChange={(e) => updateSportField('tie_break_label', e.target.value, setSettings)} />
            </label>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex items-center gap-2 rounded-md border border-emerald-950/10 bg-white/65 p-3 text-sm text-slate-700">
              <input type="checkbox" checked={settings.sport_config.supports_draw} onChange={(e) => updateSportField('supports_draw', e.target.checked, setSettings)} />
              Permitir empate no placar
            </label>
            <label className="flex items-center gap-2 rounded-md border border-emerald-950/10 bg-white/65 p-3 text-sm text-slate-700">
              <input type="checkbox" checked={settings.sport_config.supports_penalties} onChange={(e) => updateSportField('supports_penalties', e.target.checked, setSettings)} />
              Permitir seleção de desempate/pênaltis
            </label>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {getSportParameterRows(settings).map(([label, value]) => (
              <div key={label} className="rounded-md border border-emerald-950/10 bg-white/65 p-3">
                <div className="text-xs text-slate-500">{label}</div>
                <div className="mt-1 text-sm font-semibold text-emerald-800">{value}</div>
              </div>
            ))}
          </div>
          <div className="grid gap-2 sm:grid-cols-[1fr_8rem_auto]">
            <Input value={competitorName} onChange={(e) => setCompetitorName(e.target.value)} placeholder={settings.sport_config.competitor_label} />
            <Input aria-label="Sigla do competidor" value={competitorCode} onChange={(e) => setCompetitorCode(e.target.value)} placeholder="Sigla" maxLength={8} />
            <Button type="button" onClick={addCompetitor} disabled={!competitorName.trim()}>Adicionar</Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {isLoading ? <span className="text-sm text-slate-500">Carregando…</span> : competitors.map((competitor) => (
              <Badge key={competitor.id} variant="outline" className="gap-2 bg-white/80">
                {competitor.code ? `${competitor.code} · ` : ''}{competitor.name}
                <button
                  type="button"
                  className="text-red-600"
                  aria-label={`Excluir ${competitor.name}`}
                  onClick={() => deletePoolCompetitor(pool.id, competitor.id, user)}
                >
                  ×
                </button>
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader className="border-b border-emerald-950/10 bg-white/45 p-4 sm:p-5">
          <CardTitle className="text-base text-slate-950">Jogos e resultados do bolão</CardTitle>
          <CardDescription>Cadastre partidas, prazos e resultados oficiais que alimentam pontuação e ranking.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 p-4 sm:p-5">
          <div className="flex flex-wrap gap-2">
            {stages.map((stage) => (
              <Button key={stage.code} type="button" size="sm" variant={activeStage === stage.code ? 'default' : 'outline'} onClick={() => setActiveStage(stage.code)}>
                {stage.label}
              </Button>
            ))}
          </div>
          <CustomStageMatches pool={pool} stage={getPoolStage({ ...pool, settings }, activeStage) || stages[0]} competitors={competitors} />
        </CardContent>
      </Card>
    </div>
  );
}

function CustomStageMatches({ pool, stage, competitors }) {
  const { user } = useAuth();
  const { matches, isLoading } = usePoolMatchesByStage(pool.id, stage?.code);
  const competitorsById = Object.fromEntries(competitors.map((c) => [c.id, c]));
  const [draft, setDraft] = useState({ home_team_id: '', away_team_id: '', kickoff_at: '', bet_lock_at: '', group_code: '' });

  const addMatch = async () => {
    try {
      await createPoolMatch(pool.id, { ...draft, stage_code: stage.code, stage_label: stage.label }, user);
      setDraft({ home_team_id: '', away_team_id: '', kickoff_at: '', bet_lock_at: '', group_code: '' });
      toast.success('Jogo cadastrado.');
    } catch (err) {
      toast.error(err.message);
    }
  };

  if (!stage) return null;

  return (
    <div className="space-y-3">
      <div className="grid gap-2 md:grid-cols-6">
        <select value={draft.home_team_id} onChange={(e) => setDraft((p) => ({ ...p, home_team_id: e.target.value }))} className="h-10 rounded-md border px-2 text-sm">
          <option value="">Mandante</option>
          {competitors.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={draft.away_team_id} onChange={(e) => setDraft((p) => ({ ...p, away_team_id: e.target.value }))} className="h-10 rounded-md border px-2 text-sm">
          <option value="">Visitante</option>
          {competitors.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <Input aria-label="Data e horário de início do jogo" type="datetime-local" value={draft.kickoff_at} onChange={(e) => setDraft((p) => ({ ...p, kickoff_at: e.target.value }))} />
        <Input aria-label="Prazo final para palpites do jogo" type="datetime-local" value={draft.bet_lock_at} onChange={(e) => setDraft((p) => ({ ...p, bet_lock_at: e.target.value }))} title="Prazo de palpites" />
        <Input
          aria-label={`${stage.section_label || 'Grupo/rodada/chave'} do jogo`}
          value={draft.group_code}
          onChange={(e) => setDraft((p) => ({ ...p, group_code: e.target.value }))}
          placeholder={stage.section_label || 'Grupo/rodada/chave'}
        />
        <Button type="button" onClick={addMatch} disabled={competitors.length < 2}>Adicionar jogo</Button>
      </div>
      {isLoading ? <p className="text-sm text-slate-500">Carregando jogos…</p> : matches.map((match) => (
        <CustomMatchAdminRow key={match.id} pool={pool} match={match} competitorsById={competitorsById} competitors={competitors} />
      ))}
    </div>
  );
}

function CustomMatchAdminRow({ pool, match, competitorsById, competitors }) {
  const { user } = useAuth();
  const [hs, setHs] = useState(match.official_home_score ?? '');
  const [as, setAs] = useState(match.official_away_score ?? '');
  const [phs, setPhs] = useState(match.official_home_penalties ?? '');
  const [pas, setPas] = useState(match.official_away_penalties ?? '');
  const [zebra, setZebra] = useState(match.zebra_team_id ?? '');
  const [multiplier, setMultiplier] = useState(match.zebra_multiplier ? String(match.zebra_multiplier) : '2');
  const home = competitorsById[match.home_team_id]?.name || '—';
  const away = competitorsById[match.away_team_id]?.name || '—';
  const hasScore = hs !== '' && as !== '';
  const sportConfig = normalizePoolSettings(pool?.settings).sport_config;
  const normalizedHome = normalizeScoreValue(hs, sportConfig);
  const normalizedAway = normalizeScoreValue(as, sportConfig);
  const tied = hasScore && normalizedHome === normalizedAway;
  const stage = getPoolStage(pool, match.stage_code);
  const supportsPenalties = stageAllowsTiebreaker(stage, sportConfig);
  const hasAnyPenaltyScore = phs !== '' || pas !== '';
  const hasCompletePenaltyScore = phs !== '' && pas !== '';

  const saveResult = async () => {
    try {
      if (hasScore) {
        const validation = validateSportScorePair(hs, as, sportConfig);
        if (!validation.ok) {
          toast.error(validation.message);
          return;
        }
      }
      if (supportsPenalties && tied && !hasCompletePenaltyScore) {
        toast.error('Informe o placar do desempate.');
        return;
      }
      if (supportsPenalties && tied && Number(phs) === Number(pas)) {
        toast.error('O placar do desempate não pode terminar empatado.');
        return;
      }
      const penaltyWinnerTeamId = supportsPenalties && tied && hasAnyPenaltyScore ? getPenaltyWinner(match.home_team_id, match.away_team_id, phs, pas) : null;
      await updatePoolMatchResult(pool.id, match.id, {
        official_home_score: hs === '' ? null : normalizedHome,
        official_away_score: as === '' ? null : normalizedAway,
        official_home_penalties: supportsPenalties && tied && hasAnyPenaltyScore ? normalizePenaltyScore(phs) : null,
        official_away_penalties: supportsPenalties && tied && hasAnyPenaltyScore ? normalizePenaltyScore(pas) : null,
        penalty_winner_team_id: penaltyWinnerTeamId,
        zebra_team_id: zebra || null,
        zebra_multiplier: zebra ? clampZebraMultiplier(multiplier) : null,
        status: hasScore ? 'finished' : 'scheduled',
      }, user);
      toast.success('Resultado salvo.');
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <div className="match-surface grid gap-2 p-3 lg:grid-cols-[1fr_auto_1fr_auto_auto_auto] lg:items-center">
      <div className="text-sm font-medium lg:text-right">{home}</div>
      <div className="flex items-center gap-1">
        <Input type="number" min="0" max={sportConfig.max_score} step={sportConfig.score_step} value={hs} onChange={(e) => setHs(e.target.value)} className="w-16 text-center" />
        <span>×</span>
        <Input type="number" min="0" max={sportConfig.max_score} step={sportConfig.score_step} value={as} onChange={(e) => setAs(e.target.value)} className="w-16 text-center" />
      </div>
      <div className="text-sm font-medium">{away}</div>
      <div className="flex items-center gap-1 text-xs">
        <span className="text-slate-500">Des.</span>
        <Input type="number" min="0" max={MAX_PENALTY_SCORE} value={supportsPenalties && tied ? phs : ''} onChange={(e) => setPhs(e.target.value)} disabled={!supportsPenalties || !tied} className="w-14 text-center text-xs" />
        <span>×</span>
        <Input type="number" min="0" max={MAX_PENALTY_SCORE} value={supportsPenalties && tied ? pas : ''} onChange={(e) => setPas(e.target.value)} disabled={!supportsPenalties || !tied} className="w-14 text-center text-xs" />
      </div>
      <div className="flex gap-1">
        <select value={zebra} onChange={(e) => setZebra(e.target.value)} className="h-8 rounded border px-1 text-xs">
          <option value="">Sem zebra</option>
          {competitors.map((c) => <option key={c.id} value={c.id}>Zebra: {c.name}</option>)}
        </select>
        <Input type="number" min="2" max="4" value={multiplier} onChange={(e) => setMultiplier(e.target.value)} disabled={!zebra} className="w-14 text-center text-xs" />
      </div>
      <div className="flex gap-1">
        <Button type="button" size="sm" onClick={saveResult}>Salvar</Button>
        <Button type="button" size="sm" variant="outline" onClick={() => deletePoolMatch(pool.id, match.id, user)}>Excluir</Button>
      </div>
    </div>
  );
}

function clampZebraMultiplier(value) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return MIN_ZEBRA_MULTIPLIER;
  return Math.max(MIN_ZEBRA_MULTIPLIER, Math.min(MAX_ZEBRA_MULTIPLIER, numericValue));
}

function DeletePoolSection({ pool }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);

  const handleDelete = async () => {
    setBusy(true);
    try {
      await softDeletePool(pool.id, user);
      toast.success('Bolão excluído com sucesso.');
      setOpen(false);
      navigate('/boloes', { replace: true });
    } catch (err) {
      toast.error(err.message || 'Erro ao excluir bolão.');
    } finally {
      setBusy(false);
    }
  };

  if (pool.deleted) {
    return (
      <Card className="border-red-300/70 bg-red-50/90">
        <CardHeader>
          <CardTitle className="text-red-700">Bolão excluído</CardTitle>
          <CardDescription className="text-red-600">
            Este bolão foi removido. Os participantes não conseguem mais acessá-lo.
            Apenas um administrador da plataforma pode restaurar ou excluir permanentemente.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden border-red-300/70 bg-gradient-to-br from-white/95 to-red-50/80">
      <CardHeader className="border-b border-red-200/70 bg-red-50/80 p-4 sm:p-5">
        <CardTitle className="text-red-700 flex items-center gap-2">
          Zona de Perigo
        </CardTitle>
        <CardDescription>
          Ações irreversíveis para este bolão. Pense bem antes de prosseguir.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-4 sm:p-5">
        <AlertDialog open={open} onOpenChange={setOpen}>
          <AlertDialogTrigger asChild>
            <Button variant="destructive">
              Excluir Bolão
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Tem certeza que deseja excluir este bolão?</AlertDialogTitle>
              <AlertDialogDescription>
                O bolão <strong>{pool.name}</strong> será removido para <strong>todos</strong> os participantes.
                <br /><br />
                Os dados permanecerão no banco de dados da plataforma, e um administrador geral
                poderá restaurá-lo posteriormente. Para exclusão definitiva, entre em contato
                com o admin da plataforma.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                disabled={busy}
                className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
              >
                {busy ? 'Excluindo…' : 'Sim, excluir bolão'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}

function addCustomStage(setSettings) {
  setSettings((prev) => {
    const nextIndex = (prev.custom_stages?.length || 0) + 1;
    const code = `fase_${nextIndex}`;
    return {
      ...prev,
      custom_stages: [
        ...(prev.custom_stages || []),
        {
          code,
          label: `Fase ${nextIndex}`,
          phase_type: CUSTOM_STAGE_TYPES.custom,
          section_label: 'Seção',
          allows_tiebreaker: false,
          source_stage_key: null,
        },
      ],
      scoring_overrides: {
        ...prev.scoring_overrides,
        [code]: {
          label: `Fase ${nextIndex}`,
          exact_score: 10,
          winner_plus_diff: 7,
          winner_plus_team_goals: 5,
          winner_only: 4,
          team_goals_only: 2,
          penalty_winner: 0,
        },
      },
      deadline_overrides: {
        ...prev.deadline_overrides,
        [code]: null,
      },
    };
  });
}

function updateCustomStage(stageCode, field, value, setSettings) {
  setSettings((prev) => ({
    ...prev,
    custom_stages: (prev.custom_stages || []).map((stage) => (
      stage.code === stageCode
        ? {
            ...stage,
            [field]: value,
          }
        : stage
    )),
    scoring_overrides: field === 'label'
      ? {
          ...prev.scoring_overrides,
          [stageCode]: {
            ...prev.scoring_overrides[stageCode],
            label: value,
          },
        }
      : prev.scoring_overrides,
  }));
}

function updateCustomStageCode(stageCode, nextCodeInput, setSettings) {
  const nextCode = String(nextCodeInput || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_');
  if (!nextCode) return;
  setSettings((prev) => {
    if ((prev.custom_stages || []).some((stage) => stage.code === nextCode && stage.code !== stageCode)) {
      return prev;
    }
    const customStages = (prev.custom_stages || []).map((stage) => (
      stage.code === stageCode ? { ...stage, code: nextCode } : stage
    ));
    const scoringEntry = prev.scoring_overrides?.[stageCode];
    const deadlineEntry = prev.deadline_overrides?.[stageCode] ?? null;
    const scoringOverrides = { ...prev.scoring_overrides };
    const deadlineOverrides = { ...prev.deadline_overrides };
    delete scoringOverrides[stageCode];
    delete deadlineOverrides[stageCode];
    if (scoringEntry) scoringOverrides[nextCode] = { ...scoringEntry };
    deadlineOverrides[nextCode] = deadlineEntry;
    return {
      ...prev,
      custom_stages: customStages,
      scoring_overrides: scoringOverrides,
      deadline_overrides: deadlineOverrides,
    };
  });
}

function moveCustomStage(stageCode, direction, setSettings) {
  setSettings((prev) => {
    const stages = [...(prev.custom_stages || [])];
    const currentIndex = stages.findIndex((stage) => stage.code === stageCode);
    const targetIndex = currentIndex + direction;
    if (currentIndex < 0 || targetIndex < 0 || targetIndex >= stages.length) return prev;
    const [stage] = stages.splice(currentIndex, 1);
    stages.splice(targetIndex, 0, stage);
    return {
      ...prev,
      custom_stages: stages,
    };
  });
}

function removeCustomStage(stageCode, setSettings) {
  setSettings((prev) => {
    const nextStages = (prev.custom_stages || []).filter((stage) => stage.code !== stageCode);
    const scoringOverrides = { ...prev.scoring_overrides };
    const deadlineOverrides = { ...prev.deadline_overrides };
    delete scoringOverrides[stageCode];
    delete deadlineOverrides[stageCode];
    return {
      ...prev,
      custom_stages: nextStages.length ? nextStages : prev.custom_stages,
      scoring_overrides: scoringOverrides,
      deadline_overrides: deadlineOverrides,
    };
  });
}

function updateDeadline(stageCode, inputValue, setSettings) {
  setSettings((prev) => ({
    ...prev,
    deadline_overrides: {
      ...prev.deadline_overrides,
      [stageCode]: inputValue ? new Date(inputValue) : null,
    },
  }));
}

function updateRuleText(key, value, setSettings) {
  setSettings((prev) => ({
    ...prev,
    rules: {
      ...prev.rules,
      [key]: value,
    },
  }));
}

function updateSportPreset(code, setSettings) {
  const preset = SPORT_PRESETS[code] || SPORT_PRESETS.custom;
  setSettings((prev) => ({
    ...prev,
    sport_config: {
      ...prev.sport_config,
      ...preset,
    },
  }));
}

function updateSportField(key, value, setSettings) {
  setSettings((prev) => ({
    ...prev,
    sport_config: {
      ...prev.sport_config,
      [key]: value,
      ...(key === 'score_label' ? { result_unit: value } : {}),
    },
  }));
}

function updateSpecialPoints(key, value, setSettings) {
  setSettings((prev) => ({
    ...prev,
    special_bet_points: {
      ...prev.special_bet_points,
      [key]: Number(value) || 0,
    },
  }));
}

function updateScoring(stageCode, key, value, setSettings) {
  setSettings((prev) => ({
    ...prev,
    scoring_overrides: {
      ...prev.scoring_overrides,
      [stageCode]: {
        ...prev.scoring_overrides[stageCode],
        [key]: Number(value) || 0,
      },
    },
  }));
}

function toDateTimeLocal(value) {
  const date = toDate(value);
  if (!date) return '';
  const offsetMs = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function toDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value.seconds === 'number') return new Date(value.seconds * 1000);
  if (typeof value.toDate === 'function') return value.toDate();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function PoolMembers({ pool }) {
  const { user } = useAuth();
  const [members, setMembers] = useState([]);
  const [busyMemberId, setBusyMemberId] = useState(null);
  const [logMember, setLogMember] = useState(null);

  useEffect(() => {
    const q = query(collection(db, 'pool_memberships'), where('pool_id', '==', pool.id));
    const unsub = onSnapshot(q, (snap) => {
      setMembers(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [pool.id]);

  const onConfirmPayment = async (member) => {
    setBusyMemberId(member.id);
    try {
      await confirmMemberPayment(pool, member, user);
      toast.success('Pagamento confirmado.');
    } catch (err) {
      toast.error(err.message || 'Erro ao confirmar pagamento.');
    } finally {
      setBusyMemberId(null);
    }
  };

  return (
    <>
      <div className="arena-table-wrap">
        <table className="min-w-[900px] w-full text-sm">
          <thead>
            <tr className="border-b border-emerald-900/40 bg-emerald-950 text-left text-emerald-50">
              <th className="py-3 pl-4 pr-3 font-semibold">Membro</th>
              <th className="py-3 px-3 font-semibold">Função</th>
              <th className="py-3 px-3 font-semibold">Pagamento</th>
              <th className="py-3 px-3 font-semibold">Informou em</th>
              <th className="py-3 px-3 font-semibold">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-emerald-950/10 bg-white/65">
            {members.map((m) => (
              <tr key={m.id} className="transition-colors hover:bg-emerald-50/70">
                <td className="py-3 pl-4 pr-3">
                  <div className="font-medium">{m.user_name_snapshot}</div>
                  <div className="text-xs text-slate-500">{m.user_email_snapshot}</div>
                </td>
                <td className="py-3 px-3">
                  <div className="flex flex-wrap gap-2">
                    {m.user_id === pool.owner_user_id && <Badge variant="success" className="text-[10px]">Owner</Badge>}
                    <Badge variant="outline" className="text-[10px] capitalize">{m.role}</Badge>
                  </div>
                </td>
                <td className="py-3 px-3">
                  <Badge variant={m.payment_status === 'confirmed' ? 'success' : m.payment_status === 'reported' ? 'warning' : 'outline'} className="text-[10px]">
                    {paymentStatusLabel(m.payment_status)}
                  </Badge>
                </td>
                <td className="py-3 px-3 text-slate-600">{formatDate(m.payment_reported_at)}</td>
                <td className="py-3 px-3">
                  <div className="flex flex-wrap gap-2">
                    {normalizePaymentStatus(m.payment_status) !== 'confirmed' && (
                      <Button type="button" size="sm" disabled={busyMemberId === m.id} onClick={() => onConfirmPayment(m)} className="bg-emerald-700 hover:bg-emerald-800">
                        {busyMemberId === m.id ? 'Confirmando…' : 'Confirmar Pagamento'}
                      </Button>
                    )}
                    <Button type="button" size="sm" variant="outline" onClick={() => setLogMember(m)}>
                      Ver log
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Dialog open={Boolean(logMember)} onOpenChange={(open) => !open && setLogMember(null)}>
        <DialogContent className="max-h-[90vh] max-w-6xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Log do membro</DialogTitle>
            <DialogDescription>{logMember?.user_name_snapshot} · {logMember?.user_email_snapshot}</DialogDescription>
          </DialogHeader>
          {logMember && (
            <AuditLogTable
              title="Registros do membro neste bolão"
              poolId={pool.id}
              userId={logMember.user_id}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function readQrCodeFile(event, setParticipationQrCode) {
  const file = event.target.files?.[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) {
    toast.error('Selecione uma imagem válida.');
    return;
  }
  if (file.size > MAX_QR_CODE_SIZE_BYTES) {
    toast.error('A imagem do QR code deve ter no máximo 700 KB.');
    return;
  }

  const reader = new FileReader();
  reader.onload = () => setParticipationQrCode(String(reader.result || ''));
  reader.onerror = () => toast.error('Não foi possível ler a imagem.');
  reader.readAsDataURL(file);
}

function formatDate(value) {
  const date = toDate(value);
  if (!date) return '—';
  return date.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
}
