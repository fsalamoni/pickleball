import React, {
  lazy, Suspense, useDeferredValue, useMemo, useRef, useState,
} from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  UserCog, Search, AlertCircle, CheckCircle2, Pencil, ArrowRight, Trash2, FlaskConical, GitMerge,
  Ban, PauseCircle, PlayCircle, Eye, AlertTriangle, BadgeCheck, BellRing, Download,
} from 'lucide-react';
import { toast } from 'sonner';

import {
  V2Surface, V2Button, V2Badge, V2Skeleton, V2Input, V2Select, V2FilterChip, V2ErrorState, V2Field,
} from '@/v2/ui/primitives';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { useAuth } from '@/core/lib/FirebaseAuthContext';

import {
  useAllPlatformUsers, useUpdateUserRecordAsAdmin, useAccountLifecycleLogs, useProfileReminderLogs,
} from '@/modules/admin/hooks/usePlatformUsers';
import { logUserRecordsExport } from '@/modules/admin/services/adminService';
import {
  RECORD_STATUS_FILTERS, RECORD_ACTIVITY_FILTERS, RECORD_ROLE_FILTERS, RECORD_SORTS, NO_UF,
  readRecordFilters, hasActiveRecordFilters, filterRecords, sortRecords, withRecordIndex,
  recordsOverview, recordUfCounts, lastReminderByUid, reminderAudience, recordsCsv,
} from '@/modules/admin/domain/userRecordsView';
import { paginate, normalizePageSize, PAGE_SIZES, DEFAULT_PAGE_SIZE } from '@/core/domain/pagination';
import { readNumericPreference, writeViewPreference } from '@/core/lib/viewPreference';
import V2Pagination from '@/v2/ui/V2Pagination';
import { rolarAte } from '@/v2/ui/rolarAte';
import RecordsOverview from './userRecords/RecordsOverview';
import { deletedAccountsFromAudit } from '@/modules/admin/domain/accountMerge';
import {
  ADMIN_EDITABLE_FIELDS, ADMIN_FORBIDDEN_FIELDS, userRecordStatus,
  diffAdminUserPatch, sanitizeAdminUserPatch, validateAdminEdit,
  fieldOptions, isValidOptionValue, isRequiredField,
} from '@/modules/admin/domain/adminUserEdit';
import {
  deletionBlockedReason, testAccountSignals, DELETION_BATCH_MAX,
} from '@/modules/admin/domain/accountDeletion';
import { PLATFORM_OWNER_EMAILS } from '@/core/config/owners';
import { accountStatusOf, accountStatusActions, STATUS_ACTION_META } from '@/modules/admin/domain/accountStatus';
import { SENSITIVE_FIELDS, maskValue } from '@/modules/admin/domain/supportAccess';
import { duprRecordCheck, DUPR_ISSUE } from '@/modules/admin/domain/duprRecord';
import { duprRatingToInput, formatDuprRating } from '@/core/domain/duprRating';
import { DuprIdInput, DuprRatingInput, duprRatingBlocksSave } from '@/v2/components/rating/DuprFields';
import { t, tk, tn, fmtData, fmtNumero } from '@/core/i18n';

// O diálogo de exclusão só baixa quando alguém vai excluir.
const AdminAccountDeletionDialog = lazy(() => import('./AdminAccountDeletionDialog'));
// Idem para a unificação de uma conta excluída.
const AdminAccountMergeDialog = lazy(() => import('./AdminAccountMergeDialog'));
// Suspender/bloquear/reativar e revelar contato: também sob demanda.
const AdminAccountStatusDialog = lazy(() => import('./AdminAccountStatusDialog'));
const AdminSupportRevealDialog = lazy(() => import('./AdminSupportRevealDialog'));
const ProfileReminderDialog = lazy(() => import('./userRecords/ProfileReminderDialog'));

const ICONE_SITUACAO = { teste: FlaskConical, fechadas: Ban, dupr: AlertTriangle };

const GRUPOS = [
  { id: 'identidade', label: tk('Identidade') },
  { id: 'local', label: tk('Localização') },
  { id: 'jogo', label: tk('Jogo') },
];

/** O tamanho de página escolhido fica com cada admin, no navegador. */
const PREF_POR_PAGINA = 'admin:cadastros:por-pagina';

/** O recorte, sem o que não é filtro — vai para a Auditoria do envio e da planilha. */
const recorteDe = (f) => Object.fromEntries(Object.entries(f).filter(([k, v]) => v && k !== 'ordem' && !(k === 'situacao' && v === 'todos')));

/**
 * "Cadastros" — onde o admin entende em que pé estão os cadastros, corrige,
 * complementa, pede para a pessoa completar e exclui.
 *
 * Feita para MILHARES de contas: o panorama responde "em que estágio estão"
 * antes da lista; filtros, ordem e página moram na URL (recarregar ou mandar o
 * link mostra o mesmo recorte); só a página visível é desenhada. A lista de
 * contas continua vindo inteira de uma consulta (é o que deixa contar e filtrar
 * por "o que falta", que não é campo gravado).
 *
 * O limite é explícito na própria tela: o admin corrige dado ERRADO; não
 * decide quem VÊ o dado (privacidade é do titular) e não concede poder.
 *
 * O filtro "Parecem de teste" SUGERE contas de exemplo e mostra o porquê;
 * quem decide é o admin, que ainda vê a prévia do servidor antes de excluir.
 */
export default function AdminUserRecordsTab() {
  const { isPlatformAdmin, user } = useAuth();
  // ponytail: a lista lê a coleção `users` inteira (uma leitura por conta a
  // cada 5 min de uso). Aguenta dezenas de milhares; acima disso, o caminho é
  // um resumo mantido pelo servidor e a lista paginada por consulta.
  const { data: users = [], isLoading, isError, refetch } = useAllPlatformUsers({ enabled: isPlatformAdmin });
  const lembretes = useProfileReminderLogs({ enabled: isPlatformAdmin });
  const [params, setParams] = useSearchParams();
  const [alvo, setAlvo] = useState(null);
  const [selecionados, setSelecionados] = useState(() => new Set());
  const [paraExcluir, setParaExcluir] = useState(null);
  const [paraStatus, setParaStatus] = useState(null); // { user, action }
  const [paraLembrete, setParaLembrete] = useState(null); // linhas
  const topoDaLista = useRef(null);

  const filtros = useMemo(() => readRecordFilters(params), [params]);
  // Filtrar milhares de linhas a cada tecla: adiado, o campo de busca não trava.
  const buscaAdiada = useDeferredValue(filtros.busca);
  const porPagina = params.get('tam')
    ? normalizePageSize(params.get('tam'))
    : readNumericPreference(user?.uid, PREF_POR_PAGINA, PAGE_SIZES, DEFAULT_PAGE_SIZE);
  const pagina = Math.max(1, Number(params.get('pag')) || 1);

  /** Atualiza a URL (sem encher o "voltar"). Mudar o recorte volta para a página 1. */
  const atualizar = (patch, { manterPagina = false } = {}) => {
    const next = new URLSearchParams(params);
    Object.entries(patch).forEach(([k, v]) => {
      if (v === '' || v == null) next.delete(k);
      else next.set(k, String(v));
    });
    if (!manterPagina) next.delete('pag');
    setParams(next, { replace: true });
  };
  const LIMPAR = { busca: '', situacao: '', falta: '', uf: '', atividade: '', perfil: '' };
  const limparFiltros = () => atualizar(LIMPAR);
  // Atalho do panorama: mostra SÓ aquele recorte; tocar de novo desliga.
  const filtrarPorAtalho = (patch) => {
    const [k, v] = Object.entries(patch)[0];
    atualizar({ ...LIMPAR, [k]: filtros[k] === v ? '' : v });
  };

  const ctxExclusao = useMemo(
    () => ({ actorUid: user?.uid || null, ownerEmails: PLATFORM_OWNER_EMAILS }),
    [user?.uid],
  );

  // "Obrigatório" aqui é a MESMA regra do cadastro — com o cadastro essencial
  // ligado, a categoria e o nível entram na conta.
  const essencial = true;
  const comStatus = useMemo(() => (users || []).map((u) => withRecordIndex({
    ...u,
    _status: userRecordStatus(u, { essencial }),
    _teste: testAccountSignals(u),
    _bloqueio: deletionBlockedReason(u, ctxExclusao),
    _conta: accountStatusOf(u),
    _acoes: accountStatusActions(u, ctxExclusao),
    _dupr: duprRecordCheck(u),
  })), [users, ctxExclusao, essencial]);

  const resumo = useMemo(() => recordsOverview(comStatus, { essencial }), [comStatus, essencial]);
  const ufs = useMemo(() => recordUfCounts(comStatus), [comStatus]);
  const listados = useMemo(
    () => sortRecords(filterRecords(comStatus, { ...filtros, busca: buscaAdiada }), filtros.ordem),
    [comStatus, filtros, buscaAdiada],
  );
  const pag = useMemo(() => paginate(listados, pagina, porPagina), [listados, pagina, porPagina]);
  // Sem a Auditoria carregada, "quem já recebeu" é DESCONHECIDO (null), não "ninguém".
  const lembradoEm = useMemo(
    () => (lembretes.isSuccess ? lastReminderByUid(lembretes.data) : null),
    [lembretes.isSuccess, lembretes.data],
  );
  const alcanceDoLembrete = useMemo(
    () => reminderAudience(listados, { lastReminder: lembradoEm }).uids.length,
    [listados, lembradoEm],
  );
  const comFiltro = hasActiveRecordFilters(filtros);

  const alternar = (u) => {
    setSelecionados((atual) => {
      const novo = new Set(atual);
      if (novo.has(u.uid)) novo.delete(u.uid);
      else if (novo.size < DELETION_BATCH_MAX) novo.add(u.uid);
      return novo;
    });
  };

  // "Selecionar os desta página": só os que PODEM ser excluídos, e até o
  // limite — selecionar 300 para depois descobrir que só 25 cabem é frustrante.
  const selecionarVisiveis = () => {
    const podem = pag.pageItems.filter((u) => u._bloqueio.ok).slice(0, DELETION_BATCH_MAX);
    setSelecionados(new Set(podem.map((u) => u.uid)));
  };

  const irParaPagina = (p) => {
    atualizar({ pag: p === 1 ? '' : p }, { manterPagina: true });
    rolarAte(topoDaLista.current);
  };
  const trocarPorPagina = (s) => {
    writeViewPreference(user?.uid, PREF_POR_PAGINA, s === DEFAULT_PAGE_SIZE ? null : s);
    atualizar({ tam: s === DEFAULT_PAGE_SIZE ? '' : s });
  };

  const baixarPlanilha = () => {
    const url = URL.createObjectURL(new Blob([recordsCsv(listados, t)], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'cadastros.csv';
    a.click();
    URL.revokeObjectURL(url);
    logUserRecordsExport({ actor: user, count: listados.length, context: recorteDe(filtros) });
  };

  if (isLoading) return <V2Skeleton lines={6} />;
  if (isError) {
    return (
      <V2Surface>
        <V2ErrorState
          title={t('Não foi possível carregar os cadastros')}
          description={t('Os cadastros continuam lá — só não conseguimos listá-los agora.')}
          onRetry={() => refetch()}
        />
      </V2Surface>
    );
  }

  return (
    <div className="space-y-6">
      <V2Surface>
        <div className="flex items-center gap-2">
          <UserCog className="h-5 w-5 text-ink" />
          <h2 className="font-display text-lg font-bold text-ink">{t('Cadastros dos usuários')}</h2>
        </div>
        <p className="mt-1 text-xs leading-5 text-gray-500">
          {t('Corrija erros e preencha o que falta no cadastro de qualquer usuário. Toda alteração exige um motivo e fica registrada na Auditoria, com o antes e o depois de cada campo.')}
        </p>
        <p className="mt-2 rounded-lg bg-gray-50 px-3 py-2 text-2xs leading-5 text-gray-600">
          <strong className="text-ink">{t('O que esta tela NÃO faz, de propósito:')}</strong> {t('não mexe em poder (')}<code>role</code>{t('), não altera as preferências de privacidade do titular (quem vê o e-mail, o telefone, o endereço) e não troca o e-mail de login — esse mora no Firebase Authentication.')}
        </p>
      </V2Surface>

      {resumo.total > 0 && <RecordsOverview resumo={resumo} filtros={filtros} onFiltrar={filtrarPorAtalho} />}

      <V2Surface>
        <div ref={topoDaLista} className="scroll-mt-4" />
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" aria-hidden="true" />
          <V2Input
            className="pl-9"
            type="search"
            value={filtros.busca}
            onChange={(e) => atualizar({ busca: e.target.value })}
            placeholder={t('Buscar por nome, e-mail, cidade, UF, ID DUPR ou uid…')}
            aria-label={t('Buscar cadastros')}
          />
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {RECORD_STATUS_FILTERS.map((s) => {
            const Icone = ICONE_SITUACAO[s.id];
            return (
              <V2FilterChip
                key={s.id}
                active={filtros.situacao === s.id}
                onClick={() => atualizar({ situacao: s.id === 'todos' ? '' : s.id })}
              >
                {Icone && <Icone className="h-3.5 w-3.5" aria-hidden="true" />}
                {t(s.label)} ({fmtNumero(resumo[s.id === 'todos' ? 'total' : s.id])})
              </V2FilterChip>
            );
          })}
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <V2Field label={t('Falta preencher')} htmlFor="cad-falta">
            <V2Select id="cad-falta" className="h-10 text-sm" value={filtros.falta} onChange={(e) => atualizar({ falta: e.target.value })}>
              <option value="">{t('Qualquer campo')}</option>
              {ADMIN_EDITABLE_FIELDS.map((f) => <option key={f.key} value={f.key}>{t(f.label)}</option>)}
            </V2Select>
          </V2Field>
          <V2Field label={t('Estado')} htmlFor="cad-uf">
            <V2Select id="cad-uf" className="h-10 text-sm" value={filtros.uf} onChange={(e) => atualizar({ uf: e.target.value })}>
              <option value="">{t('Todos os estados')}</option>
              {ufs.map(({ uf, count }) => (
                <option key={uf} value={uf}>{uf === NO_UF ? t('Sem UF válida') : uf} ({fmtNumero(count)})</option>
              ))}
            </V2Select>
          </V2Field>
          <V2Field label={t('Atividade')} htmlFor="cad-atividade">
            <V2Select id="cad-atividade" className="h-10 text-sm" value={filtros.atividade} onChange={(e) => atualizar({ atividade: e.target.value })}>
              {RECORD_ACTIVITY_FILTERS.map((a) => <option key={a.id} value={a.id}>{t(a.label, { n: a.days })}</option>)}
            </V2Select>
          </V2Field>
          <V2Field label={t('Perfil')} htmlFor="cad-perfil">
            <V2Select id="cad-perfil" className="h-10 text-sm" value={filtros.perfil} onChange={(e) => atualizar({ perfil: e.target.value })}>
              {RECORD_ROLE_FILTERS.map((p) => <option key={p.id} value={p.id}>{t(p.label)}</option>)}
            </V2Select>
          </V2Field>
          <V2Field label={t('Ordenar por')} htmlFor="cad-ordem">
            <V2Select id="cad-ordem" className="h-10 text-sm" value={filtros.ordem} onChange={(e) => atualizar({ ordem: e.target.value === 'prioridade' ? '' : e.target.value })}>
              {RECORD_SORTS.map((o) => <option key={o.id} value={o.id}>{t(o.label)}</option>)}
            </V2Select>
          </V2Field>
        </div>

        {filtros.situacao === 'dupr' && (
          <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-2xs leading-5 text-amber-900">
            {t('O rating DUPR vai de {min} a {max}, com três casas depois da vírgula. Até esta versão, o que fosse digitado fora disso (como “4525” em vez de “4,525”, ou o ID no campo do rating) era gravado como {max} ou {min} — por isso um rating cravado no limite aparece aqui.', { min: formatDuprRating(2), max: formatDuprRating(8) })} <strong>{t('Confira com a pessoa antes de corrigir')}</strong>{t(': nada foi alterado sozinho. O que veio do login oficial do DUPR não entra nesta lista.')}
          </p>
        )}

        {filtros.situacao === 'fechadas' && (
          <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-2xs leading-5 text-amber-900">
            {t('Suspensa tem prazo; bloqueada não.')} <strong>{t('Nada reativa sozinho')}</strong>{t(': quando a suspensão vence, a conta aparece aqui como vencida')}{resumo.vencidas > 0 ? ` (${t('{n} agora', { n: resumo.vencidas })})` : ''} {t('e o admin decide se reativa. Reativar devolve o acesso como era; nada foi apagado.')}
          </p>
        )}

        {filtros.situacao === 'teste' && (
          <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-2xs leading-5 text-amber-900">
            {t('A suspeita vem de sinais simples — conta oculta na moderação, e-mail de domínio de exemplo, nome ou e-mail com “teste”, “mock”, “demo”. Cada linha mostra o que levantou a suspeita.')} <strong>{t('Confira antes de excluir')}</strong>{t(': é sugestão, não certeza.')}
          </p>
        )}

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 pt-3">
          <p className="text-sm text-ink" aria-live="polite">
            <strong className="tabular-nums">{fmtNumero(listados.length)}</strong>{' '}
            {comFiltro
              ? tn(listados.length, 'cadastro neste recorte', 'cadastros neste recorte')
              : tn(listados.length, 'cadastro no total', 'cadastros no total')}
            {comFiltro && (
              <button type="button" onClick={limparFiltros} className="ml-2 text-xs font-semibold text-gray-500 underline hover:text-ink">
                {t('Limpar filtros')}
              </button>
            )}
          </p>
          <div className="flex flex-wrap gap-2">
            <V2Button
              size="sm"
              variant="secondary"
              disabled={alcanceDoLembrete === 0}
              onClick={() => setParaLembrete(listados)}
              title={alcanceDoLembrete === 0 ? t('Ninguém neste recorte está com obrigatório faltando (ou todos receberam um pedido há pouco).') : undefined}
            >
              <BellRing className="h-3.5 w-3.5" aria-hidden="true" /> {t('Pedir para completar ({n})', { n: fmtNumero(alcanceDoLembrete) })}
            </V2Button>
            <V2Button size="sm" variant="ghost" disabled={listados.length === 0} onClick={baixarPlanilha}>
              <Download className="h-3.5 w-3.5" aria-hidden="true" /> {t('Baixar planilha')}
            </V2Button>
          </div>
        </div>

        {selecionados.size > 0 ? (
          <div className="sticky top-2 z-10 mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2">
            <span className="text-sm font-semibold text-red-900">
              {tn(selecionados.size, '{n} selecionado', '{n} selecionados')}
              {selecionados.size >= DELETION_BATCH_MAX && ` (${t('limite de {max} por vez', { max: DELETION_BATCH_MAX })})`}
            </span>
            <div className="flex gap-2">
              <V2Button size="sm" variant="ghost" onClick={() => setSelecionados(new Set())}>{t('Limpar')}</V2Button>
              <V2Button
                size="sm"
                className="bg-red-600 text-white hover:bg-red-700"
                onClick={() => setParaExcluir(comStatus.filter((u) => selecionados.has(u.uid)))}
              >
                <Trash2 className="h-3.5 w-3.5" /> {t('Excluir selecionados')}
              </V2Button>
            </div>
          </div>
        ) : pag.pageItems.some((u) => u._bloqueio.ok) && (
          <div className="mt-3 text-right">
            <button type="button" className="text-2xs font-semibold text-gray-500 underline hover:text-ink" onClick={selecionarVisiveis}>
              {t('Selecionar os desta página para excluir (até {max})', { max: DELETION_BATCH_MAX })}
            </button>
          </div>
        )}

        <div className="mt-3 space-y-2">
          {listados.length === 0 ? (
            <div className="py-6 text-center text-sm text-gray-500">
              {comFiltro ? (
                <>
                  <p>{t('Nenhum cadastro neste recorte.')}</p>
                  <V2Button size="sm" variant="ghost" className="mt-2" onClick={limparFiltros}>{t('Limpar filtros')}</V2Button>
                </>
              ) : <p>{t('Nenhum cadastro encontrado.')}</p>}
            </div>
          ) : pag.pageItems.map((u) => (
            <UserRow
              key={u.uid}
              user={u}
              lembradoEm={lembradoEm?.get(u.uid) || null}
              onEdit={() => setAlvo(u)}
              selected={selecionados.has(u.uid)}
              onToggle={() => alternar(u)}
              onDelete={() => setParaExcluir([u])}
              onStatus={(action) => setParaStatus({ user: u, action })}
              onRemind={() => setParaLembrete([u])}
            />
          ))}
        </div>
        {listados.length > 0 && (
          <div className="mt-3">
            <V2Pagination
              data={pag}
              itemLabel={t('cadastros')}
              idPrefix="cadastros"
              onPage={irParaPagina}
              onPageSize={trocarPorPagina}
            />
          </div>
        )}
      </V2Surface>

      <DeletedAccountsPanel users={users} enabled={isPlatformAdmin} />

      {alvo && (
        <RecordEditDialog user={alvo} onClose={() => setAlvo(null)} />
      )}

      {paraLembrete && (
        <Suspense fallback={null}>
          <ProfileReminderDialog
            rows={paraLembrete}
            lastReminder={lembradoEm}
            context={paraLembrete.length === 1 ? { uid: paraLembrete[0].uid } : recorteDe(filtros)}
            onClose={() => setParaLembrete(null)}
          />
        </Suspense>
      )}

      {paraStatus && (
        <Suspense fallback={null}>
          <AdminAccountStatusDialog user={paraStatus.user} action={paraStatus.action} onClose={() => setParaStatus(null)} />
        </Suspense>
      )}

      {paraExcluir && (
        <Suspense fallback={null}>
          <AdminAccountDeletionDialog
            users={paraExcluir}
            onClose={() => {
              setParaExcluir(null);
              setSelecionados(new Set());
            }}
          />
        </Suspense>
      )}
    </div>
  );
}

/* --------------------------------------------------------------------------- */

const formatarData = (ms) => (ms
  ? fmtData(ms, { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'America/Sao_Paulo' })
  : '');

/**
 * As contas EXCLUÍDAS — e o caminho para devolver o histórico delas à conta
 * que ficou.
 *
 * A exclusão tira a identidade, mas os jogos ficam (são também dos
 * adversários). Quando a conta excluída era o SEGUNDO cadastro de alguém que
 * continua aqui, esses jogos são dele: "Unificar" os devolve. A lista sai da
 * Auditoria — é ela que guarda o nome e o e-mail de quem foi excluído.
 */
function DeletedAccountsPanel({ users, enabled }) {
  const { data: logs = [], isLoading, isError, refetch } = useAccountLifecycleLogs({ enabled });
  const [alvo, setAlvo] = useState(null);
  const excluidas = useMemo(() => deletedAccountsFromAudit(logs), [logs]);
  const nomePorUid = useMemo(() => new Map((users || []).map((u) => [u.uid, u.full_name || u.platform_name || u.email])), [users]);

  if (!enabled) return null;
  return (
    <V2Surface>
      <div className="flex items-center gap-2">
        <GitMerge className="h-5 w-5 text-ink" />
        <h2 className="font-display text-lg font-bold text-ink">{t('Contas excluídas')}</h2>
      </div>
      <p className="mt-1 text-xs leading-5 text-gray-500">
        {t('A exclusão apaga a identidade, mas os jogos ficam no histórico como “Atleta removido” — eles também são dos adversários.')} {t('Se')} a conta excluída era o <strong>{t('segundo cadastro')}</strong> {t('de alguém que continua aqui,')} <strong>{t('Unificar')}</strong> {t('devolve jogos, inscrições e resultados à conta que ficou, e o ranking se refaz sozinho.')}
      </p>
      <div className="mt-3 space-y-2">
        {isLoading ? (
          <V2Skeleton lines={2} />
        ) : isError ? (
          <V2ErrorState
            inline
            title={t('A Auditoria não carregou')}
            description={t('Sem ela não dá para saber quem foi excluído.')}
            onRetry={() => refetch()}
          />
        ) : excluidas.length === 0 ? (
          <p className="py-4 text-center text-sm text-gray-400">{t('Nenhum cadastro foi excluído pelo painel.')}</p>
        ) : excluidas.map((c) => (
          <div key={c.uid} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-gray-100 px-3 py-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-ink">{c.name}</p>
              <p className="truncate text-2xs text-gray-500">
                {[c.email, c.deletedAtMs ? t('excluída em {data}', { data: formatarData(c.deletedAtMs) }) : null].filter(Boolean).join(' · ')}
              </p>
            </div>
            {c.mergedInto ? (
              <V2Badge tone="green">{t('Unificada em')} {nomePorUid.get(c.mergedInto) || t('outra conta')}</V2Badge>
            ) : (
              <V2Button size="sm" variant="subtle" onClick={() => setAlvo(c)}>
                <GitMerge className="h-3.5 w-3.5" /> {t('Unificar com outra conta')}
              </V2Button>
            )}
          </div>
        ))}
      </div>
      {alvo && (
        <Suspense fallback={null}>
          <AdminAccountMergeDialog deleted={alvo} users={users} onClose={() => setAlvo(null)} />
        </Suspense>
      )}
    </V2Surface>
  );
}

const ICONE_ACAO = { suspend: PauseCircle, block: Ban, reactivate: PlayCircle };

const DUPR_ISSUE_TEXT = {
  [DUPR_ISSUE.OUT_OF_RANGE]: tk('Rating gravado fora de {min}–{max} ({valor}): não vale como rating.'),
  [DUPR_ISSUE.AT_LIMIT]: tk('Rating cravado no limite da escala ({valor}): era o que o sistema gravava quando o número vinha errado. Confira com a pessoa.'),
  [DUPR_ISSUE.ID_LOOKS_LIKE_RATING]: tk('O ID parece um rating: os campos podem ter sido trocados.'),
  [DUPR_ISSUE.ID_FORMAT]: tk('O ID tem caracteres que o DUPR não usa (só letras e números).'),
};

/**
 * O DUPR na própria linha do cadastro: ID e rating à vista, e o que parece
 * errado em destaque — o admin vê e corrige antes de o número entrar no sorteio.
 */
function DuprResumo({ dupr, onEdit }) {
  const problema = dupr.issues.length > 0;
  const vars = {
    min: formatDuprRating(2),
    max: formatDuprRating(8),
    valor: dupr.rating !== null ? formatDuprRating(dupr.rating) : dupr.raw,
  };
  return (
    <div className={`mt-2 rounded-lg px-2.5 py-1.5 text-xs ${problema ? 'bg-amber-50 text-amber-900 ring-1 ring-amber-200' : 'bg-gray-50 text-gray-600'}`}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="text-2xs font-bold uppercase tracking-wide">DUPR</span>
        <span>
          {t('ID')}{' '}
          <strong className="font-mono font-semibold text-ink">{dupr.id || '—'}</strong>
        </span>
        <span>
          {t('Rating')}{' '}
          <strong className="font-semibold tabular-nums text-ink">{vars.valor ?? '—'}</strong>
        </span>
        {dupr.verified && (
          <span className="inline-flex items-center gap-1 font-semibold text-green-700">
            <BadgeCheck className="h-3.5 w-3.5" aria-hidden="true" /> {t('verificado pelo DUPR')}
          </span>
        )}
        {!dupr.informed && <span className="text-gray-500">{t('não informado')}</span>}
      </div>
      {problema && (
        <ul className="mt-1 space-y-0.5">
          {dupr.issues.map((code) => (
            <li key={code} className="flex gap-1.5">
              <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
              <span>
                {t(DUPR_ISSUE_TEXT[code], vars)}
                {code === DUPR_ISSUE.OUT_OF_RANGE && dupr.suggestion !== null && (
                  <> {t('Talvez {sugestao}.', { sugestao: formatDuprRating(dupr.suggestion) })}</>
                )}
              </span>
            </li>
          ))}
          <li>
            <button type="button" onClick={onEdit} className="font-semibold underline hover:text-ink">
              {t('Corrigir no cadastro')}
            </button>
          </li>
        </ul>
      )}
    </div>
  );
}

function UserRow({ user: u, lembradoEm, onEdit, selected, onToggle, onDelete, onStatus, onRemind }) {
  const s = u._status;
  const bloqueio = u._bloqueio;
  const conta = u._conta;
  const { createdMs, lastLoginMs } = u._tempo;
  const datas = [
    Number.isFinite(createdMs) ? t('cadastro em {data}', { data: formatarData(createdMs) }) : null,
    Number.isFinite(lastLoginMs) ? t('último acesso em {data}', { data: formatarData(lastLoginMs) }) : t('sem acesso registrado'),
  ].filter(Boolean).join(' · ');
  const podePedir = !s.complete && conta.status === 'active' && u.hidden !== true;
  return (
    // Conteúdo em cima, na largura toda; ações numa faixa embaixo. Lado a lado,
    // a fileira de botões espremia o texto numa coluna de uma palavra.
    <div className={`rounded-xl border p-3 ${
      selected ? 'border-red-300 bg-red-50/40' : s.complete ? 'border-gray-100' : 'border-amber-200 bg-amber-50/40'
    }`}>
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          className="mt-1 h-4 w-4 shrink-0 rounded border-gray-300"
          checked={selected}
          disabled={!bloqueio.ok}
          onChange={onToggle}
          aria-label={t('Selecionar {valor} para excluir', { valor: u.platform_name || u.full_name || u.uid })}
          title={bloqueio.ok ? t('Selecionar para excluir') : bloqueio.reason}
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-semibold text-ink">
              {u.platform_name || u.full_name || t('(sem nome)')}
            </span>
            {conta.status !== 'active' && (
              <V2Badge tone={conta.tone}>
                <Ban className="h-3 w-3" /> {t(conta.label)}{conta.vencida ? ` · ${t('prazo vencido')}` : ''}
              </V2Badge>
            )}
            {s.complete ? (
              <V2Badge tone="green">
                <CheckCircle2 className="h-3 w-3" /> {t('completo')}
              </V2Badge>
            ) : (
              <V2Badge tone="amber">
                <AlertCircle className="h-3 w-3" /> {tn(s.missingRequired.length, 'falta {n} obrigatório', 'faltam {n} obrigatórios')}
              </V2Badge>
            )}
            {u._dupr.issues.length > 0 && (
              <V2Badge tone="amber">
                <AlertTriangle className="h-3 w-3" /> {t('DUPR a conferir')}
              </V2Badge>
            )}
          </div>
          {/* Mascarado: o e-mail inteiro só com registro de leitura (ficha → Revelar). */}
          <div className="mt-0.5 truncate text-xs text-gray-500">{maskValue('email', u.email) || t('(sem e-mail)')}</div>
          <DuprResumo dupr={u._dupr} onEdit={onEdit} />
          {conta.status !== 'active' && conta.reason && (
            <div className="mt-1 text-2xs text-gray-500">{t('Motivo: {reason}', { reason: conta.reason })}</div>
          )}
          {s.missingCount > 0 && (
            <div className="mt-1 text-2xs text-gray-500">
              {t('Falta preencher:')} {s.missing.map((f) => f.label).join(', ')}
            </div>
          )}
          <div className="mt-1 text-2xs text-gray-500">
            {t('{n} de {total} campos preenchidos', { n: s.filledCount, total: s.totalCount })} · {datas}
          </div>
          {lembradoEm && (
            <div className="mt-1 inline-flex items-center gap-1 text-2xs font-medium text-blue-700">
              <BellRing className="h-3 w-3" aria-hidden="true" /> {t('pedido para completar enviado em {data}', { data: formatarData(lembradoEm) })}
            </div>
          )}
          {u._teste.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {u._teste.map((m) => (
                <span key={m} className="rounded-full bg-amber-100 px-2 py-0.5 text-2xs font-medium text-amber-900">
                  {m}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-3">
        <V2Button size="sm" variant="secondary" onClick={onEdit}>
          <Pencil className="mr-1 h-3.5 w-3.5" /> {t('Editar cadastro')}
        </V2Button>
        {podePedir && (
          <V2Button size="sm" variant="ghost" onClick={onRemind}>
            <BellRing className="h-3.5 w-3.5" aria-hidden="true" /> {t('Pedir para completar')}
          </V2Button>
        )}
        {/* Ações sobre a conta à direita, longe do "Editar" (no celular, quebram para a linha de baixo). */}
        <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
          {u._acoes.actions.map((a) => {
            const I = ICONE_ACAO[a];
            return (
              <V2Button key={a} size="sm" variant="ghost" onClick={() => onStatus(a)}
                className={a === 'block' ? 'text-red-600 hover:bg-red-50' : a === 'suspend' ? 'text-amber-700 hover:bg-amber-50' : ''}>
                <I className="h-3.5 w-3.5" /> {STATUS_ACTION_META[a].label}
              </V2Button>
            );
          })}
          {bloqueio.ok ? (
            <V2Button size="sm" variant="ghost" className="text-red-600 hover:bg-red-50" onClick={onDelete} aria-label={t('Excluir {valor}', { valor: u.platform_name || u.full_name || u.uid })}>
              <Trash2 className="h-3.5 w-3.5" /> {t('Excluir')}
            </V2Button>
          ) : (
            <span className="self-center text-2xs text-gray-500" title={bloqueio.reason}>{t('não excluível')}</span>
          )}
        </div>
      </div>
    </div>
  );
}

const SENSIVEL = new Set(SENSITIVE_FIELDS);

function RecordEditDialog({ user, onClose }) {
  const salvar = useUpdateUserRecordAsAdmin();
  // Os campos de contato entram no formulário SÓ depois de revelados (com
  // registro de leitura): fora dele, não mudam e não aparecem.
  const [inicial] = useState(() => Object.fromEntries(
    ADMIN_EDITABLE_FIELDS.filter((f) => !SENSIVEL.has(f.key)).map((f) => [
      f.key, f.type === 'dupr' ? duprRatingToInput(user[f.key]) : (user[f.key] ?? ''),
    ]),
  ));
  const [form, setForm] = useState(inicial);
  const [revelado, setRevelado] = useState(null);
  const [revelando, setRevelando] = useState(false);
  const [motivo, setMotivo] = useState('');

  const { patch, invalid } = sanitizeAdminUserPatch(form);
  const changes = diffAdminUserPatch(user, patch);
  const validacao = validateAdminEdit({ changes, reason: motivo });
  // Rating DUPR mexido e fora da regra trava o salvar (o campo diz por quê).
  // O valor antigo que ninguém tocou não trava a correção dos outros campos.
  const duprTravado = invalid.includes('dupr_rating') && form.dupr_rating !== inicial.dupr_rating;
  const faltando = new Set(user._status?.missing?.map((f) => f.key) || []);
  const essencial = true;

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSave = async () => {
    try {
      const r = await salvar.mutateAsync({ uid: user.uid, patch, reason: motivo });
      toast.success(tn(r.changes.length, '{n} campo corrigido.', '{n} campos corrigidos.'));
      onClose();
    } catch (e) {
      toast.error(e?.message || t('Não foi possível salvar.'));
    }
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[90dvh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{user.platform_name || user.full_name || t('Cadastro')}</DialogTitle>
          <DialogDescription>
            {(revelado ? revelado.email : maskValue('email', user.email)) || t('(sem e-mail)')} · <span className="font-mono text-2xs">{user.uid}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {!revelado && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-gray-200 bg-paper p-3 text-xs text-gray-600">
              <span>{t('E-mail, telefone, nascimento e endereço estão mascarados. Revelar registra o acesso internamente.')}</span>
              <V2Button size="sm" variant="secondary" onClick={() => setRevelando(true)}>
                <Eye className="h-3.5 w-3.5" /> {t('Revelar dados de contato')}
              </V2Button>
            </div>
          )}
          {GRUPOS.map((g) => (
            <div key={g.id}>
              <h4 className="text-xs font-bold uppercase tracking-wide text-gray-500">{g.label}</h4>
              <div className="mt-2 grid gap-3 sm:grid-cols-2">
                {ADMIN_EDITABLE_FIELDS.filter((f) => f.group === g.id).map((f) => (
                  <label key={f.key} className="block text-xs font-semibold text-ink">
                    <span className="flex items-center gap-1.5">
                      {f.label}
                      {isRequiredField(f, { essencial }) && <span className="text-red-500">*</span>}
                      {faltando.has(f.key) && (
                        <span className="rounded bg-amber-100 px-1.5 py-0.5 text-2xs font-bold text-amber-700">
                          vazio
                        </span>
                      )}
                    </span>
                    {SENSIVEL.has(f.key) && !revelado ? (
                      <span className="mt-1 block h-12 rounded-2xl border border-dashed border-gray-200 px-4 py-3 font-mono text-sm font-normal text-gray-500">
                        {maskValue(f.key, user[f.key]) || '(vazio)'}
                      </span>
                    ) : (
                      <CampoDeEdicao field={f} value={form[f.key] ?? ''} onChange={(v) => set(f.key, v)} />
                    )}
                    {f.type === 'dupr' && user._dupr?.issues.includes(DUPR_ISSUE.AT_LIMIT) && form[f.key] === inicial[f.key] && (
                      <span className="mt-1 block text-2xs font-normal leading-5 text-amber-800">
                        {t('Rating cravado no limite da escala: era o que o sistema gravava quando o número vinha errado. Confira com a pessoa o rating que aparece no app do DUPR.')}
                      </span>
                    )}
                  </label>
                ))}
              </div>
            </div>
          ))}

          {changes.length > 0 && (
            <div className="rounded-xl border border-gray-200 bg-paper p-3">
              <h4 className="text-xs font-bold text-ink">
                {t('O que vai mudar ({length})', { length: changes.length })}
              </h4>
              <ul className="mt-2 space-y-1 text-2xs">
                {changes.map((c) => (
                  <li key={c.field} className="flex flex-wrap items-center gap-1.5 text-gray-600">
                    <span className="font-semibold text-ink">{c.label}:</span>
                    <span className="rounded bg-gray-100 px-1.5 py-0.5 line-through">
                      {String(c.from ?? '') || '(vazio)'}
                    </span>
                    <ArrowRight className="h-3 w-3 text-gray-400" />
                    <span className="rounded bg-acid/20 px-1.5 py-0.5 font-semibold text-ink">
                      {String(c.to ?? '') || '(vazio)'}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <label className="block text-xs font-semibold text-ink">
            {t('Motivo da correção')} <span className="text-red-500">*</span>
            <V2Input
              className="mt-1"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder={t('Ex.: o atleta pediu a correção do telefone por WhatsApp')}
            />
            <span className="mt-1 block text-2xs font-normal text-gray-500">
              {t('Fica na Auditoria junto com o antes e o depois de cada campo.')}
            </span>
          </label>
        </div>

        {revelando && (
          <Suspense fallback={null}>
            <AdminSupportRevealDialog
              user={user}
              onClose={() => setRevelando(false)}
              onRevealed={(values) => {
                setRevelado(values);
                setForm((f) => ({ ...f, ...Object.fromEntries(ADMIN_EDITABLE_FIELDS.filter((c) => SENSIVEL.has(c.key)).map((c) => [c.key, values[c.key] ?? user[c.key] ?? ''])) }));
              }}
            />
          </Suspense>
        )}

        <DialogFooter>
          <V2Button variant="ghost" onClick={onClose}>{t('Cancelar')}</V2Button>
          <V2Button
            disabled={!validacao.isValid || duprTravado || salvar.isPending}
            onClick={handleSave}
          >
            {salvar.isPending ? t('Salvando…') : tn(changes.length, 'Salvar {n} alteração', 'Salvar {n} alterações')}
          </V2Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Um campo do formulário do admin. Onde o cadastro normal tem LISTA, aqui tem a
 * MESMA lista — importada da fonte, nunca recopiada. Texto livre num campo que
 * o resto do sistema lê por código (`male`, `right`, `1-2-anos`) gravaria um
 * valor que nenhuma tela entende e que nenhum sorteio consegue usar.
 */
function CampoDeEdicao({ field: f, value, onChange }) {
  const opcoes = fieldOptions(f.key);

  if (f.type === 'dupr') {
    // O valor gravado fora da regra (cadastro antigo) já abre explicado.
    return (
      <DuprRatingInput
        id={`admin_${f.key}`}
        className="mt-1 font-normal"
        value={value}
        showFeedback={duprRatingBlocksSave(value)}
        onChange={onChange}
      />
    );
  }
  if (f.key === 'dupr_id') {
    return <DuprIdInput id={`admin_${f.key}`} className="mt-1 font-normal" value={value} onChange={onChange} />;
  }

  if (!opcoes) {
    return (
      <V2Input
        className="mt-1"
        type={f.type === 'date' ? 'date' : f.type === 'number' ? 'number' : 'text'}
        value={value}
        maxLength={f.maxLength}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }

  // Valor que já está no banco mas não pertence à lista (cadastro antigo, ou
  // digitado à mão em algum momento). Mostrar em vez de sumir com ele: o admin
  // precisa VER o que está lá para decidir se troca.
  const foraDaLista = value !== '' && !isValidOptionValue(f.key, value);

  return (
    <>
      <V2Select className="mt-1" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{t('— não informado —')}</option>
        {opcoes.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        {foraDaLista && <option value={value}>{value} (valor antigo, fora da lista)</option>}
      </V2Select>
      {foraDaLista && (
        <span className="mt-1 block text-2xs font-normal text-amber-700">
          {t('O valor gravado não está na lista atual. Escolha um da lista para corrigir.')}
        </span>
      )}
    </>
  );
}

/** Exportado só para o teste conferir que a lista de proibidos não regrediu. */
export const CAMPOS_PROIBIDOS = ADMIN_FORBIDDEN_FIELDS;
