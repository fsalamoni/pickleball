import React, { useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { ArrowRight, RotateCcw, RefreshCw, ShieldCheck, UserCog, Wand2, AlertTriangle, Eye, EyeOff, Search } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { restoreAthleteProfileFromUserDoc, resyncAllAthleteProfilesFromUsers, listAllAthleteProfiles, setAthleteHidden } from '@/modules/athletes/services/athleteService';
import { migrateProvisionalData } from '@/modules/tournament/services/registrationService';
import {
  V2Button,
  V2EmptyState,
  V2PageIntro,
  V2Skeleton,
  V2Surface,
  PAGE_FRAME,
} from '@/v2/ui/primitives';
import { t, tn } from '@/core/i18n';

export default function V2AdminProfiles({ embedded = false }) {
  const { user, isPlatformAdmin } = useAuth();
  const moderationOn = true;
  const [profiles, setProfiles] = useState(null);
  const [error, setError] = useState(null);
  const [uid, setUid] = useState('');
  const [busy, setBusy] = useState(false);
  // Re-sincronização em lote do diretório (espelho ← users).
  const [resyncMode, setResyncMode] = useState(null); // null | 'dry-run' | 'apply'
  const [resyncResult, setResyncResult] = useState(null);
  const resyncBusy = resyncMode !== null;
  // Moderação de atletas (flag athlete_moderation): busca + ocultar/reexibir.
  const [athleteSearch, setAthleteSearch] = useState('');
  const [togglingUid, setTogglingUid] = useState(null);

  // Migração de dados provisórios (migrateProvisionalData)
  const [migUid, setMigUid] = useState('');
  const [migAliases, setMigAliases] = useState('');
  const [migNote, setMigNote] = useState('');
  const [migBusy, setMigBusy] = useState(false);
  const [migLastResult, setMigLastResult] = useState(null);

  async function load() {
    try {
      setError(null);
      setProfiles(await listAllAthleteProfiles());
    } catch (err) {
      setError(err.message || t('Não foi possível carregar os perfis.'));
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
        toast.success(t('Perfil restaurado ({fieldsWritten} campos).', { fieldsWritten: result.fieldsWritten }));
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

  async function runResync(dryRun) {
    setResyncMode(dryRun ? 'dry-run' : 'apply');
    try {
      const res = await resyncAllAthleteProfilesFromUsers(user, { dryRun });
      if (!res.ok) {
        toast.error(res.reason || t('Falha na re-sincronização.'));
        return;
      }
      setResyncResult({ ...res, mode: dryRun ? 'dry-run' : 'apply' });
      if (dryRun) {
        toast.success(tn(res.summary.eligible, 'Simulação: {n} espelho seria atualizado.', 'Simulação: {n} espelhos seriam atualizados.'));
      } else {
        toast.success(tn(res.written, '{n} espelho re-sincronizado a partir do users/{uid}.', '{n} espelhos re-sincronizados a partir do users/{uid}.', { uid: '{uid}' }));
        void load();
      }
    } catch (err) {
      toast.error(err.message || t('Falha na re-sincronização.'));
    } finally {
      setResyncMode(null);
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
      toast.error(t('Informe o UID do atleta definitivo.'));
      return;
    }
    const aliases = parseAliasEmails();
    if (aliases.length === 0) {
      toast.error(t('Informe ao menos um email de origem.'));
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
          t('Dry-run: {scanned} encontrados, {claimed} seriam migrados.', { scanned: res.scanned, claimed: res.claimed }),
        );
      } else {
        toast.success(
          t('{claimed} inscrições migradas em {torneios} torneios.', { claimed: res.claimed, torneios: res.tournamentsAffected.length }),
        );
      }
    } catch (err) {
      toast.error(err.message || t('Falha na migração.'));
    } finally {
      setMigBusy(false);
    }
  }


  async function handleToggleHidden(profile) {
    const target = profile.id || profile.uid;
    if (!target) return;
    const nextHidden = !(profile.hidden === true);
    setTogglingUid(target);
    try {
      await setAthleteHidden(target, nextHidden, user);
      toast.success(nextHidden ? t('Atleta ocultado das listas.') : t('Atleta reexibido.'));
      // Atualização otimista local (evita recarregar a lista inteira).
      setProfiles((list) => (list || []).map((p) => (
        (p.id || p.uid) === target ? { ...p, hidden: nextHidden } : p
      )));
    } catch (err) {
      toast.error(err.message || t('Falha ao atualizar a visibilidade do atleta.'));
    } finally {
      setTogglingUid(null);
    }
  }

  const filteredProfiles = useMemo(() => {
    const list = profiles || [];
    const term = athleteSearch.trim().toLowerCase();
    if (!term) return list;
    return list.filter((p) => (
      `${p.platform_name || ''} ${p.email || ''} ${p.id || p.uid || ''}`.toLowerCase().includes(term)
    ));
  }, [profiles, athleteSearch]);

  if (!isPlatformAdmin) return <Navigate to="/" replace />;

  return (
    <div className={embedded ? 'space-y-6' : PAGE_FRAME}>
      {!embedded && (
        <V2PageIntro
          title={t('Perfis de atletas')}
          subtitle={t('Restaure o athlete_profiles/{uid} a partir do users/{uid} (fonte de verdade operacional).')}
        />
      )}
      {embedded && (
        <V2Surface>
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-ink text-acid">
              <UserCog className="h-4.5 w-4.5" />
            </div>
            <div className="flex-1">
              <h2 className="font-display text-xl font-bold text-ink">{t('Perfis de atletas')}</h2>
              <p className="mt-1 text-sm leading-6 text-gray-500">
                {t('Ferramentas de manutenção do diretório público (')}<code className="rounded bg-paper px-1.5 py-0.5 text-xs">athlete_profiles/{'{uid}'}</code>{t(') e de migração de dados provisórios com emails divergentes.')}
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
            <h2 className="font-display text-xl font-bold text-ink">{t('Restaurar perfil por UID')}</h2>
            <p className="mt-1 text-sm leading-6 text-gray-500">
              {t('Útil quando o espelho público foi corrompido (ex.: bug antigo do')}
              <code className="mx-1 rounded bg-paper px-1.5 py-0.5 text-xs">syncAthleteProfile</code>
              {t('sobrescrevendo a foto do atleta com string vazia). A restauração re-lê o')} <code className="mx-1 rounded bg-paper px-1.5 py-0.5 text-xs">users/{'{uid}'}</code>
              {t('e regrava o')} <code className="mx-1 rounded bg-paper px-1.5 py-0.5 text-xs">athlete_profiles/{'{uid}'}</code>{t('. A operação fica no')} <code className="mx-1 rounded bg-paper px-1.5 py-0.5 text-xs">audit_logs</code>.
            </p>
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">{t('UID do atleta')}</label>
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
            {busy ? t('Restaurando…') : t('Restaurar perfil')}
          </V2Button>
        </div>

        {targetProfile && (
          <div className="mt-4 rounded-[1.25rem] border border-blue-200 bg-blue-50 p-4 text-sm leading-6 text-blue-900">
            <div className="flex items-center gap-2 font-bold">
              <ShieldCheck className="h-4 w-4" />
              {t('Perfil atual no diretório')}
            </div>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <div><span className="text-gray-500">{t('Nome:')}</span> {targetProfile.platform_name || '—'}</div>
              <div><span className="text-gray-500">{t('Email:')}</span> {targetProfile.email || '—'}</div>
              <div><span className="text-gray-500">{t('Cidade/UF:')}</span> {targetProfile.city || '—'}/{targetProfile.state || '—'}</div>
              <div><span className="text-gray-500">{t('Listado:')}</span> {targetProfile.directory_listed ? 'sim' : t('não')}</div>
              <div className="sm:col-span-2 truncate">
                <span className="text-gray-500">{t('Foto:')}</span>{' '}
                {targetProfile.photo_url ? (
                  <a href={targetProfile.photo_url} target="_blank" rel="noopener noreferrer" className="text-ink underline">
                    {targetProfile.photo_url.slice(0, 80)}…
                  </a>
                ) : t('— (vazia — alvo típico de restauração)')}
              </div>
            </div>
            {targetProfile.photo_url === '' && (
              <div className="mt-2 flex items-center gap-1.5 text-amber-800">
                <ArrowRight className="h-3.5 w-3.5" />
                {t('Foto vazia detectada — a restauração deve corrigir.')}
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
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-ink text-acid">
            <RefreshCw className="h-4.5 w-4.5" />
          </div>
          <div className="flex-1">
            <h2 className="font-display text-xl font-bold text-ink">{t('Re-sincronizar diretório (em lote)')}</h2>
            <p className="mt-1 text-sm leading-6 text-gray-500">
              {t('Propaga para o espelho público')}
              <code className="mx-1 rounded bg-paper px-1.5 py-0.5 text-xs">athlete_profiles/{'{uid}'}</code>
              {t('os dados inseridos manualmente no')}
              <code className="mx-1 rounded bg-paper px-1.5 py-0.5 text-xs">users/{'{uid}'}</code>
              {t('(ex.:')} <strong>{t('ID DUPR')}</strong>{t(', gênero, gênero de jogo e lado da quadra) que ainda não passaram pelo')} <code className="mx-1 rounded bg-paper px-1.5 py-0.5 text-xs">syncAthleteProfile</code>.
              {t('Atualiza')} <strong>{t('apenas espelhos que já existem')}</strong> {t('(nunca cria entradas novas no diretório) e preserva flags de moderação. A operação fica no')}
              <code className="mx-1 rounded bg-paper px-1.5 py-0.5 text-xs">audit_logs</code>.
            </p>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <V2Button variant="secondary" onClick={() => runResync(true)} disabled={resyncBusy}>
            <AlertTriangle className="h-4 w-4" />
            {resyncMode === 'dry-run' ? t('Processando…') : t('Simular (dry-run)')}
          </V2Button>
          <V2Button onClick={() => runResync(false)} disabled={resyncBusy}>
            <RefreshCw className="h-4 w-4" />
            {resyncMode === 'apply' ? t('Re-sincronizando…') : t('Re-sincronizar agora')}
          </V2Button>
        </div>

        {resyncResult && (
          <div className="mt-5 rounded-[1.25rem] border border-gray-200 bg-gray-50 p-4 text-sm">
            <div className="font-bold text-ink">
              {resyncResult.mode === 'dry-run' ? t('Simulação') : t('Resultado')} {t('— diretório de atletas')}
            </div>
            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              <div><span className="text-gray-500">{t('Usuários:')}</span> {resyncResult.scanned}</div>
              <div><span className="text-gray-500">{t('Espelhos existentes:')}</span> {resyncResult.mirrors}</div>
              <div>
                <span className="text-gray-500">{resyncResult.mode === 'dry-run' ? t('A atualizar:') : t('Atualizados:')}</span>{' '}
                {resyncResult.mode === 'dry-run' ? resyncResult.summary.eligible : resyncResult.written}
              </div>
            </div>
            <div className="mt-2 grid gap-2 text-xs text-gray-500 sm:grid-cols-4">
              <div>{t('Com DUPR:')} <span className="font-semibold text-ink">{resyncResult.summary.withDupr}</span></div>
              <div>{t('Com gênero:')} <span className="font-semibold text-ink">{resyncResult.summary.withGender}</span></div>
              <div>{t('Com gênero de jogo:')} <span className="font-semibold text-ink">{resyncResult.summary.withCompetitionGender}</span></div>
              <div>{t('Com lado da quadra:')} <span className="font-semibold text-ink">{resyncResult.summary.withCourtSide}</span></div>
            </div>
            {resyncResult.mode === 'dry-run' && (
              <div className="mt-3 flex items-center gap-1.5 text-amber-800">
                <ArrowRight className="h-3.5 w-3.5" />
                {t('Simulação: nenhum dado foi gravado. Clique em “Re-sincronizar agora” para aplicar.')}
              </div>
            )}
          </div>
        )}
      </V2Surface>

      <V2Surface className="mb-6 p-6 sm:p-7">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-100 text-amber-900">
            <Wand2 className="h-4.5 w-4.5" />
          </div>
          <div className="flex-1">
            <h2 className="font-display text-xl font-bold text-ink">{t('Migração de dados provisórios')}</h2>
            <p className="mt-1 text-sm leading-6 text-gray-500">
              {t('Use quando um atleta foi inscrito provisoriamente pelo admin com um email diferente do email que ele usa para entrar na plataforma (ex.:')} <code className="mx-1 rounded bg-paper px-1.5 py-0.5 text-xs">vicente@google.com</code>
              {t('em vez de')} <code className="mx-1 rounded bg-paper px-1.5 py-0.5 text-xs">vicente.bcosta@icloud.com</code>{t('). A migração re-escreve os campos')} <code className="mx-1 rounded bg-paper px-1.5 py-0.5 text-xs">player_a_*</code> /
              <code className="mx-1 rounded bg-paper px-1.5 py-0.5 text-xs">player_b_*</code> {t('das')}
              <code className="mx-1 rounded bg-paper px-1.5 py-0.5 text-xs">tournament_registrations</code>
              {t('com o UID, nome, nível e foto da conta definitiva. Os jogos e o ranking passam a contar para o atleta real na próxima recomputação.')}
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">{t('UID do atleta definitivo')}</label>
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
              {t('Emails de origem')} <span className="font-normal normal-case text-gray-400">{t('(separar por vírgula)')}</span>
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
            {t('Nota (opcional)')} <span className="font-normal normal-case text-gray-400">— vai para o audit log</span>
          </label>
          <input
            value={migNote}
            onChange={(e) => setMigNote(e.target.value)}
            placeholder={t('Ex.: migração do Vicente, 3 torneios com email provisório errado')}
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
            {migBusy ? t('Simulando…') : t('Simular (dry-run)')}
          </V2Button>
          <V2Button onClick={() => runMigration(false)} disabled={migBusy}>
            <Wand2 className="h-4 w-4" />
            {migBusy ? t('Migrando…') : t('Executar migração')}
          </V2Button>
          {/* Não há "Recalcular ranking agora": a própria migração reescreve
              o uid da inscrição, e o gatilho `recomputeRankingOnTournamentRegistration`
              refaz os rankings na hora. O botão existia porque esse gatilho
              não existia. */}
        </div>

        {migLastResult && (
          <div className="mt-5 rounded-[1.25rem] border border-gray-200 bg-gray-50 p-4 text-sm">
            <div className="font-bold text-ink">
              {migLastResult.mode === 'dry-run' ? t('Simulação') : t('Resultado')} — UID {migLastResult.targetUid}
            </div>
            <div className="mt-2 grid gap-2 sm:grid-cols-4">
              <div><span className="text-gray-500">{t('Encontrados:')}</span> {migLastResult.scanned}</div>
              <div><span className="text-gray-500">{t('Migrados:')}</span> {migLastResult.claimed}</div>
              <div><span className="text-gray-500">{t('Já OK:')}</span> {migLastResult.skipped}</div>
              <div><span className="text-gray-500">{t('Torneios:')}</span> {migLastResult.tournamentsAffected.length}</div>
            </div>
            <div className="mt-2 text-xs text-gray-500">
              {t('Emails:')} {migLastResult.aliasEmails.join(', ')}
            </div>
            {migLastResult.details.length > 0 && (
              <details className="mt-3">
                <summary className="cursor-pointer text-xs font-semibold text-gray-500 hover:text-ink">
                  {tn(migLastResult.details.length, 'Ver {n} inscrição afetada', 'Ver {n} inscrições afetadas')}
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
        <h3 className="font-display text-lg font-bold text-ink">{t('Atletas cadastrados na plataforma')}</h3>
        <p className="mt-1 text-sm text-gray-500">
          {t('Lista inclui quem optou por não aparecer no diretório público.')}
          {moderationOn && t(' Use “Ocultar” para esconder contas de teste/falsas das listas de inscrição e do diretório — é reversível e não apaga o cadastro.')}
        </p>
        {moderationOn && (
          <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
            <strong>{t('Ocultar não remove poder.')}</strong> {t('É moderação de exibição: tira o atleta das listagens e não mexe no')} <code>role</code>. {t('Uma conta oculta que seja administrador continua com acesso total. Para ver e revogar quem tem poder, use')}
            <strong> {t('Painel admin → Governança → Acessos')}</strong>.
          </p>
        )}

        {profiles !== null && profiles.length > 0 && (
          <div className="relative mt-4 max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              value={athleteSearch}
              onChange={(e) => setAthleteSearch(e.target.value)}
              placeholder={t('Buscar por nome, email ou UID…')}
              className="h-10 w-full rounded-[1rem] border border-input bg-background pl-9 pr-3 text-sm"
              autoComplete="off"
              spellCheck={false}
            />
          </div>
        )}

        {profiles === null ? (
          <V2Skeleton className="mt-4 h-32 rounded-2xl" />
        ) : profiles.length === 0 ? (
          <V2EmptyState
            icon={UserCog}
            title={t('Nenhum perfil cadastrado')}
            description={t('Quando alguém fizer login, o perfil de atleta é sincronizado automaticamente.')}
          />
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-paper text-left text-gray-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">{t('Nome')}</th>
                  <th className="px-4 py-3 font-semibold">{t('UID')}</th>
                  <th className="px-4 py-3 font-semibold">{t('Email')}</th>
                  <th className="px-4 py-3 font-semibold">{t('Cidade')}</th>
                  <th className="px-4 py-3 font-semibold text-center">{t('Foto')}</th>
                  {moderationOn && <th className="px-4 py-3 font-semibold text-right">{t('Visibilidade')}</th>}
                </tr>
              </thead>
              <tbody>
                {filteredProfiles.map((p) => {
                  const target = p.id || p.uid;
                  const isHidden = p.hidden === true;
                  return (
                    <tr key={target} className={`border-t border-gray-100 ${isHidden ? 'bg-gray-50/60' : ''}`}>
                      <td className="px-4 py-3 font-semibold text-ink">
                        <span className={isHidden ? 'text-gray-400 line-through' : ''}>{p.platform_name || '—'}</span>
                        {isHidden && (
                          <span className="ml-2 rounded-full bg-gray-200 px-2 py-0.5 align-middle text-2xs font-semibold text-gray-600">{t('Oculto')}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-500">{target}</td>
                      <td className="px-4 py-3 text-gray-500">{p.email || '—'}</td>
                      <td className="px-4 py-3 text-gray-500">
                        {p.city ? `${p.city}${p.state ? `/${p.state}` : ''}` : '—'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {p.photo_url ? (
                          <span className="text-green-700">✓</span>
                        ) : (
                          <span className="text-amber-700">{t('vazia')}</span>
                        )}
                      </td>
                      {moderationOn && (
                        <td className="px-4 py-3 text-right">
                          <V2Button
                            size="sm"
                            variant={isHidden ? 'secondary' : 'ghost'}
                            onClick={() => handleToggleHidden(p)}
                            disabled={togglingUid === target}
                          >
                            {isHidden ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                            {togglingUid === target ? '…' : isHidden ? t('Reexibir') : t('Ocultar')}
                          </V2Button>
                        </td>
                      )}
                    </tr>
                  );
                })}
                {filteredProfiles.length === 0 && (
                  <tr>
                    <td colSpan={moderationOn ? 6 : 5} className="px-4 py-6 text-center text-sm text-gray-500">
                      {t('Nenhum atleta encontrado para “{busca}”.', { busca: athleteSearch })}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </V2Surface>
    </div>
  );
}
