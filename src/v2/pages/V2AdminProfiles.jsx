import React, { useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { ArrowRight, RotateCcw, ShieldCheck, UserCog, Wand2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { restoreAthleteProfileFromUserDoc, listAllAthleteProfiles } from '@/modules/athletes/services/athleteService';
import { migrateProvisionalData } from '@/modules/tournament/services/registrationService';
import { useRecomputeRatings } from '@/modules/rating/hooks/useRating';
import {
  V2Button,
  V2EmptyState,
  V2PageIntro,
  V2Skeleton,
  V2Surface,
} from '@/v2/ui/primitives';

export default function V2AdminProfiles({ embedded = false }) {
  const { user, isPlatformAdmin } = useAuth();
  const [profiles, setProfiles] = useState(null);
  const [error, setError] = useState(null);
  const [uid, setUid] = useState('');
  const [busy, setBusy] = useState(false);

  // Migração de dados provisórios (migrateProvisionalData)
  const [migUid, setMigUid] = useState('');
  const [migAliases, setMigAliases] = useState('');
  const [migNote, setMigNote] = useState('');
  const [migBusy, setMigBusy] = useState(false);
  const [migLastResult, setMigLastResult] = useState(null);
  const recomputeRatings = useRecomputeRatings();

  async function load() {
    try {
      setError(null);
      setProfiles(await listAllAthleteProfiles());
    } catch (err) {
      setError(err.message || 'Não foi possível carregar os perfis.');
      toast.error(err.message);
    }
  }

  React.useEffect(() => { void load(); }, []);

  const targetProfile = useMemo(() => {
    if (!uid) return null;
    const list = profiles || [];
    return list.find((p) => p.id === uid || p.uid === uid) || null;
  }, [uid, profiles]);

  async function handleRestore() {
    if (!uid) return;
    setBusy(true);
    try {
      const result = await restoreAthleteProfileFromUserDoc(uid, user);
      if (result.ok) {
        toast.success(`Perfil restaurado (${result.fieldsWritten} campos).`);
        void load();
      } else {
        toast.error(result.reason);
      }
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  function parseAliasEmails() {
    return migAliases
      .split(/[,\n;]+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }

  async function runMigration(dryRun) {
    if (!migUid.trim()) {
      toast.error('Informe o UID do atleta definitivo.');
      return;
    }
    const aliases = parseAliasEmails();
    if (aliases.length === 0) {
      toast.error('Informe ao menos um email de origem.');
      return;
    }
    setMigBusy(true);
    try {
      const res = await migrateProvisionalData(
        {
          targetUid: migUid.trim(),
          fromEmails: aliases,
          dryRun,
          resyncProfile: !dryRun,
          note: migNote.trim() || null,
        },
        user,
      );
      setMigLastResult({ ...res, mode: dryRun ? 'dry-run' : 'apply' });
      if (dryRun) {
        toast.success(
          `Dry-run: ${res.scanned} encontrados, ${res.claimed} seriam migrados.`,
        );
      } else {
        toast.success(
          `${res.claimed} inscrição(ões) migrada(s) em ${res.tournamentsAffected.length} torneio(s).`,
        );
      }
    } catch (err) {
      toast.error(err.message || 'Falha na migração.');
    } finally {
      setMigBusy(false);
    }
  }

  async function handleRecomputeAfterMig() {
    try {
      await recomputeRatings.mutateAsync();
      toast.success('Ranking recalculado.');
    } catch (err) {
      toast.error(err.message || 'Falha ao recalcular ranking.');
    }
  }

  if (!isPlatformAdmin) return <Navigate to="/" replace />;

  return (
    <div className={embedded ? 'space-y-6' : 'mx-auto max-w-[1100px]'}>
      {!embedded && (
        <V2PageIntro
          title="Perfis de atletas"
          subtitle="Restaure o athlete_profiles/{uid} a partir do users/{uid} (fonte de verdade operacional)."
        />
      )}
      {embedded && (
        <V2Surface>
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-ink text-acid">
              <UserCog className="h-4.5 w-4.5" />
            </div>
            <div className="flex-1">
              <h2 className="font-display text-xl font-bold text-ink">Perfis de atletas</h2>
              <p className="mt-1 text-sm leading-6 text-gray-500">
                Ferramentas de manutenção do diretório público (<code className="rounded bg-paper px-1.5 py-0.5 text-xs">athlete_profiles/{'{uid}'}</code>)
                e de migração de dados provisórios com emails divergentes.
              </p>
            </div>
          </div>
        </V2Surface>
      )}

      <V2Surface className="mb-6 p-6 sm:p-7">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-ink text-acid">
            <UserCog className="h-4.5 w-4.5" />
          </div>
          <div className="flex-1">
            <h2 className="font-display text-xl font-bold text-ink">Restaurar perfil por UID</h2>
            <p className="mt-1 text-sm leading-6 text-gray-500">
              Útil quando o espelho público foi corrompido (ex.: bug antigo do
              <code className="mx-1 rounded bg-paper px-1.5 py-0.5 text-xs">syncAthleteProfile</code>
              sobrescrevendo a foto do atleta com string vazia). A restauração
              re-lê o <code className="mx-1 rounded bg-paper px-1.5 py-0.5 text-xs">users/{'{uid}'}</code>
              e regrava o <code className="mx-1 rounded bg-paper px-1.5 py-0.5 text-xs">athlete_profiles/{'{uid}'}</code>.
              A operação fica no <code className="mx-1 rounded bg-paper px-1.5 py-0.5 text-xs">audit_logs</code>.
            </p>
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">UID do atleta</label>
            <input
              value={uid}
              onChange={(e) => setUid(e.target.value.trim())}
              placeholder="Kx7CC0NVgogh8cCF4wIRmpOvo7r2"
              className="mt-2 h-11 w-full rounded-[1rem] border border-input bg-background px-3 text-sm"
              autoComplete="off"
              spellCheck={false}
            />
          </div>
          <V2Button onClick={handleRestore} disabled={!uid || busy}>
            <RotateCcw className="h-4 w-4" />
            {busy ? 'Restaurando…' : 'Restaurar perfil'}
          </V2Button>
        </div>

        {targetProfile && (
          <div className="mt-4 rounded-[1.25rem] border border-blue-200 bg-blue-50 p-4 text-sm leading-6 text-blue-900">
            <div className="flex items-center gap-2 font-bold">
              <ShieldCheck className="h-4 w-4" />
              Perfil atual no diretório
            </div>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <div><span className="text-gray-500">Nome:</span> {targetProfile.platform_name || '—'}</div>
              <div><span className="text-gray-500">Email:</span> {targetProfile.email || '—'}</div>
              <div><span className="text-gray-500">Cidade/UF:</span> {targetProfile.city || '—'}/{targetProfile.state || '—'}</div>
              <div><span className="text-gray-500">Listado:</span> {targetProfile.directory_listed ? 'sim' : 'não'}</div>
              <div className="sm:col-span-2 truncate">
                <span className="text-gray-500">Foto:</span>{' '}
                {targetProfile.photo_url ? (
                  <a href={targetProfile.photo_url} target="_blank" rel="noreferrer" className="text-ink underline">
                    {targetProfile.photo_url.slice(0, 80)}…
                  </a>
                ) : '— (vazia — alvo típico de restauração)'}
              </div>
            </div>
            {targetProfile.photo_url === '' && (
              <div className="mt-2 flex items-center gap-1.5 text-amber-800">
                <ArrowRight className="h-3.5 w-3.5" />
                Foto vazia detectada — a restauração deve corrigir.
              </div>
            )}
          </div>
        )}

        {error && (
          <div className="mt-4 rounded-[1.25rem] border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {error}
          </div>
        )}
      </V2Surface>

      <V2Surface className="mb-6 p-6 sm:p-7">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-100 text-amber-900">
            <Wand2 className="h-4.5 w-4.5" />
          </div>
          <div className="flex-1">
            <h2 className="font-display text-xl font-bold text-ink">Migração de dados provisórios</h2>
            <p className="mt-1 text-sm leading-6 text-gray-500">
              Use quando um atleta foi inscrito provisoriamente pelo admin com um
              email diferente do email que ele usa para entrar na plataforma
              (ex.: <code className="mx-1 rounded bg-paper px-1.5 py-0.5 text-xs">vicente@google.com</code>
              em vez de <code className="mx-1 rounded bg-paper px-1.5 py-0.5 text-xs">vicente.bcosta@icloud.com</code>).
              A migração re-escreve os campos <code className="mx-1 rounded bg-paper px-1.5 py-0.5 text-xs">player_a_*</code> /
              <code className="mx-1 rounded bg-paper px-1.5 py-0.5 text-xs">player_b_*</code> das
              <code className="mx-1 rounded bg-paper px-1.5 py-0.5 text-xs">tournament_registrations</code>
              com o UID, nome, nível e foto da conta definitiva. Os jogos e o
              ranking passam a contar para o atleta real na próxima recomputação.
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">UID do atleta definitivo</label>
            <input
              value={migUid}
              onChange={(e) => setMigUid(e.target.value.trim())}
              placeholder="q4tFakmMjzMS3CWgqqC43TZ0Cbz1"
              className="mt-2 h-11 w-full rounded-[1rem] border border-input bg-background px-3 text-sm font-mono"
              autoComplete="off"
              spellCheck={false}
            />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">
              Emails de origem <span className="font-normal normal-case text-gray-400">(separar por vírgula)</span>
            </label>
            <input
              value={migAliases}
              onChange={(e) => setMigAliases(e.target.value)}
              placeholder="vicente.b.costa@icloud.com, vicente@google.com"
              className="mt-2 h-11 w-full rounded-[1rem] border border-input bg-background px-3 text-sm font-mono"
              autoComplete="off"
              spellCheck={false}
            />
          </div>
        </div>

        <div className="mt-4">
          <label className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">
            Nota (opcional) <span className="font-normal normal-case text-gray-400">— vai para o audit log</span>
          </label>
          <input
            value={migNote}
            onChange={(e) => setMigNote(e.target.value)}
            placeholder="Ex.: migração do Vicente, 3 torneios com email provisório errado"
            className="mt-2 h-11 w-full rounded-[1rem] border border-input bg-background px-3 text-sm"
            autoComplete="off"
          />
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <V2Button
            variant="secondary"
            onClick={() => runMigration(true)}
            disabled={migBusy}
          >
            <AlertTriangle className="h-4 w-4" />
            {migBusy ? 'Simulando…' : 'Simular (dry-run)'}
          </V2Button>
          <V2Button onClick={() => runMigration(false)} disabled={migBusy}>
            <Wand2 className="h-4 w-4" />
            {migBusy ? 'Migrando…' : 'Executar migração'}
          </V2Button>
          {migLastResult && migLastResult.mode === 'apply' && migLastResult.claimed > 0 && (
            <V2Button
              variant="secondary"
              onClick={handleRecomputeAfterMig}
              disabled={recomputeRatings.isPending}
            >
              <CheckCircle2 className="h-4 w-4" />
              {recomputeRatings.isPending ? 'Recalculando…' : 'Recalcular ranking agora'}
            </V2Button>
          )}
        </div>

        {migLastResult && (
          <div className="mt-5 rounded-[1.25rem] border border-gray-200 bg-gray-50 p-4 text-sm">
            <div className="font-bold text-ink">
              {migLastResult.mode === 'dry-run' ? 'Simulação' : 'Resultado'} — UID {migLastResult.targetUid}
            </div>
            <div className="mt-2 grid gap-2 sm:grid-cols-4">
              <div><span className="text-gray-500">Encontrados:</span> {migLastResult.scanned}</div>
              <div><span className="text-gray-500">Migrados:</span> {migLastResult.claimed}</div>
              <div><span className="text-gray-500">Já OK:</span> {migLastResult.skipped}</div>
              <div><span className="text-gray-500">Torneios:</span> {migLastResult.tournamentsAffected.length}</div>
            </div>
            <div className="mt-2 text-xs text-gray-500">
              Emails: {migLastResult.aliasEmails.join(', ')}
            </div>
            {migLastResult.details.length > 0 && (
              <details className="mt-3">
                <summary className="cursor-pointer text-xs font-semibold text-gray-500 hover:text-ink">
                  Ver {migLastResult.details.length} inscrição(ões) afetada(s)
                </summary>
                <ul className="mt-2 space-y-1 font-mono text-xs text-gray-600">
                  {migLastResult.details.map((d) => (
                    <li key={d.registrationId}>
                      <span className="text-gray-400">{d.registrationId.slice(0, 8)}…</span>{' '}
                      <span className="text-ink">{d.slot}</span>{' '}
                      <span className="text-gray-400">torneio {d.tournamentId} / modalidade {d.modalityId}</span>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        )}
      </V2Surface>

      <V2Surface>
        <h3 className="font-display text-lg font-bold text-ink">Atletas cadastrados na plataforma</h3>
        <p className="mt-1 text-sm text-gray-500">
          Lista inclui quem optou por não aparecer no diretório público.
        </p>

        {profiles === null ? (
          <V2Skeleton className="mt-4 h-32 rounded-2xl" />
        ) : profiles.length === 0 ? (
          <V2EmptyState
            icon={UserCog}
            title="Nenhum perfil cadastrado"
            description="Quando alguém fizer login, o perfil de atleta é sincronizado automaticamente."
          />
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-paper text-left text-gray-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">Nome</th>
                  <th className="px-4 py-3 font-semibold">UID</th>
                  <th className="px-4 py-3 font-semibold">Email</th>
                  <th className="px-4 py-3 font-semibold">Cidade</th>
                  <th className="px-4 py-3 font-semibold text-right">Foto</th>
                </tr>
              </thead>
              <tbody>
                {profiles.map((p) => (
                  <tr key={p.id || p.uid} className="border-t border-gray-100">
                    <td className="px-4 py-3 font-semibold text-ink">
                      {p.platform_name || '—'}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{p.id || p.uid}</td>
                    <td className="px-4 py-3 text-gray-500">{p.email || '—'}</td>
                    <td className="px-4 py-3 text-gray-500">
                      {p.city ? `${p.city}${p.state ? `/${p.state}` : ''}` : '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {p.photo_url ? (
                        <span className="text-green-700">✓</span>
                      ) : (
                        <span className="text-amber-700">vazia</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </V2Surface>
    </div>
  );
}
