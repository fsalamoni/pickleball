import React, { lazy, Suspense, useMemo, useState } from 'react';
import {
  UserCog, Search, AlertCircle, CheckCircle2, Pencil, ArrowRight, Trash2, FlaskConical,
} from 'lucide-react';
import { toast } from 'sonner';

import {
  V2Surface, V2Button, V2Badge, V2Skeleton, V2Input, V2Select, V2FilterChip,
} from '@/v2/ui/primitives';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import {
  useAllPlatformUsers, useUpdateUserRecordAsAdmin,
} from '@/modules/admin/hooks/usePlatformUsers';
import {
  ADMIN_EDITABLE_FIELDS, ADMIN_FORBIDDEN_FIELDS, userRecordStatus,
  diffAdminUserPatch, sanitizeAdminUserPatch, validateAdminEdit,
  fieldOptions, isValidOptionValue,
} from '@/modules/admin/domain/adminUserEdit';
import {
  deletionBlockedReason, testAccountSignals, DELETION_BATCH_MAX,
} from '@/modules/admin/domain/accountDeletion';
import { PLATFORM_OWNER_EMAILS } from '@/core/config/owners';

// O diálogo de exclusão só baixa quando alguém vai excluir.
const AdminAccountDeletionDialog = lazy(() => import('./AdminAccountDeletionDialog'));

const GRUPOS = [
  { id: 'identidade', label: 'Identidade' },
  { id: 'local', label: 'Localização' },
  { id: 'jogo', label: 'Jogo' },
];

/**
 * "Cadastros" — onde o admin corrige, complementa e ajusta o cadastro de
 * qualquer usuário.
 *
 * O que a tela resolve, além de permitir editar: mostrar O QUE FALTA. Antes,
 * descobrir que um atleta está sem data de nascimento exigia abrir o banco.
 *
 * O limite é explícito na própria tela: o admin corrige dado ERRADO; não
 * decide quem VÊ o dado (privacidade é do titular) e não concede poder.
 *
 * E EXCLUI cadastro — principalmente contas de exemplo. O filtro "Parecem de
 * teste" existe porque o pedido foi "há MUITOS cadastros de exemplo": achar
 * um a um numa lista de centenas é a tarefa que não acontece. Ele SUGERE e
 * mostra o porquê; quem decide é o admin, que ainda vê a prévia do servidor
 * antes de confirmar.
 */
export default function AdminUserRecordsTab() {
  const { isPlatformAdmin, user } = useAuth();
  const { data: users = [], isLoading } = useAllPlatformUsers({ enabled: isPlatformAdmin });
  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState('todos'); // todos | incompletos | pendentes | teste
  const [alvo, setAlvo] = useState(null);
  const [selecionados, setSelecionados] = useState(() => new Set());
  const [paraExcluir, setParaExcluir] = useState(null);

  const ctxExclusao = useMemo(
    () => ({ actorUid: user?.uid || null, ownerEmails: PLATFORM_OWNER_EMAILS }),
    [user?.uid],
  );

  const comStatus = useMemo(() => (users || []).map((u) => ({
    ...u,
    _status: userRecordStatus(u),
    _teste: testAccountSignals(u),
    _bloqueio: deletionBlockedReason(u, ctxExclusao),
  })), [users, ctxExclusao]);

  const listados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return comStatus
      .filter((u) => {
        if (filtro === 'incompletos' && u._status.missingCount === 0) return false;
        if (filtro === 'pendentes' && u._status.complete) return false;
        if (filtro === 'teste' && u._teste.length === 0) return false;
        if (!q) return true;
        return [u.platform_name, u.full_name, u.email, u.uid, u.city]
          .some((v) => String(v || '').toLowerCase().includes(q));
      })
      // Quem tem obrigatório faltando aparece primeiro — é o que precisa de ação.
      .sort((a, b) => {
        if (a._status.complete !== b._status.complete) return a._status.complete ? 1 : -1;
        return b._status.missingCount - a._status.missingCount;
      });
  }, [comStatus, busca, filtro]);

  const totais = useMemo(() => ({
    total: comStatus.length,
    incompletos: comStatus.filter((u) => u._status.missingCount > 0).length,
    pendentes: comStatus.filter((u) => !u._status.complete).length,
    teste: comStatus.filter((u) => u._teste.length > 0).length,
  }), [comStatus]);

  const alternar = (u) => {
    setSelecionados((atual) => {
      const novo = new Set(atual);
      if (novo.has(u.uid)) novo.delete(u.uid);
      else if (novo.size < DELETION_BATCH_MAX) novo.add(u.uid);
      return novo;
    });
  };

  // "Selecionar os que aparecem": só os que PODEM ser excluídos, e até o
  // limite — selecionar 300 para depois descobrir que só 25 cabem é frustrante.
  const selecionarVisiveis = () => {
    const podem = listados.filter((u) => u._bloqueio.ok).slice(0, DELETION_BATCH_MAX);
    setSelecionados(new Set(podem.map((u) => u.uid)));
  };

  const abrirExclusao = (lista) => setParaExcluir(lista);

  if (isLoading) return <V2Skeleton lines={6} />;

  return (
    <div className="space-y-6">
      <V2Surface>
        <div className="flex items-center gap-2">
          <UserCog className="h-5 w-5 text-ink" />
          <h2 className="font-display text-lg font-bold text-ink">Cadastros dos usuários</h2>
        </div>
        <p className="mt-1 text-xs leading-5 text-gray-500">
          Corrija erros e preencha o que falta no cadastro de qualquer usuário. Toda alteração
          exige um motivo e fica registrada na Auditoria, com o antes e o depois de cada campo.
        </p>
        <p className="mt-2 rounded-lg bg-gray-50 px-3 py-2 text-[11px] leading-5 text-gray-600">
          <strong className="text-ink">O que esta tela NÃO faz, de propósito:</strong> não mexe em
          poder (<code>role</code>), não altera as preferências de privacidade do titular
          (quem vê o e-mail, o telefone, o endereço) e não troca o e-mail de login — esse mora
          no Firebase Authentication.
        </p>
      </V2Surface>

      <V2Surface>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[220px] flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <V2Input
              className="pl-9"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por nome, e-mail, cidade ou uid…"
            />
          </div>
          <V2FilterChip active={filtro === 'todos'} onClick={() => setFiltro('todos')}>
            Todos ({totais.total})
          </V2FilterChip>
          <V2FilterChip active={filtro === 'pendentes'} onClick={() => setFiltro('pendentes')}>
            Falta obrigatório ({totais.pendentes})
          </V2FilterChip>
          <V2FilterChip active={filtro === 'incompletos'} onClick={() => setFiltro('incompletos')}>
            Algo a preencher ({totais.incompletos})
          </V2FilterChip>
          <V2FilterChip active={filtro === 'teste'} onClick={() => setFiltro('teste')}>
            <FlaskConical className="mr-1 inline h-3.5 w-3.5" />
            Parecem de teste ({totais.teste})
          </V2FilterChip>
        </div>

        {filtro === 'teste' && (
          <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-[11px] leading-5 text-amber-900">
            A suspeita vem de sinais simples — conta oculta na moderação, e-mail de domínio de
            exemplo, nome ou e-mail com &ldquo;teste&rdquo;, &ldquo;mock&rdquo;, &ldquo;demo&rdquo;. Cada linha
            mostra o que levantou a suspeita. <strong>Confira antes de excluir</strong>: é sugestão,
            não certeza.
          </p>
        )}

        {selecionados.size > 0 ? (
          <div className="sticky top-2 z-10 mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2">
            <span className="text-sm font-semibold text-red-900">
              {selecionados.size} selecionado{selecionados.size > 1 ? 's' : ''}
              {selecionados.size >= DELETION_BATCH_MAX && ` (limite de ${DELETION_BATCH_MAX} por vez)`}
            </span>
            <div className="flex gap-2">
              <V2Button size="sm" variant="ghost" onClick={() => setSelecionados(new Set())}>Limpar</V2Button>
              <V2Button
                size="sm"
                className="bg-red-600 text-white hover:bg-red-700"
                onClick={() => abrirExclusao(comStatus.filter((u) => selecionados.has(u.uid)))}
              >
                <Trash2 className="h-3.5 w-3.5" /> Excluir selecionados
              </V2Button>
            </div>
          </div>
        ) : listados.some((u) => u._bloqueio.ok) && (
          <div className="mt-3 text-right">
            <button type="button" className="text-[11px] font-semibold text-gray-500 underline hover:text-ink" onClick={selecionarVisiveis}>
              Selecionar os que aparecem (até {DELETION_BATCH_MAX})
            </button>
          </div>
        )}

        <div className="mt-4 space-y-2">
          {listados.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-400">Nenhum cadastro encontrado.</p>
          ) : listados.slice(0, 100).map((u) => (
            <UserRow
              key={u.uid}
              user={u}
              onEdit={() => setAlvo(u)}
              selected={selecionados.has(u.uid)}
              onToggle={() => alternar(u)}
              onDelete={() => abrirExclusao([u])}
            />
          ))}
          {listados.length > 100 && (
            <p className="pt-2 text-center text-[11px] text-gray-400">
              Mostrando 100 de {listados.length}. Refine a busca.
            </p>
          )}
        </div>
      </V2Surface>

      {alvo && (
        <RecordEditDialog user={alvo} onClose={() => setAlvo(null)} />
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

function UserRow({ user: u, onEdit, selected, onToggle, onDelete }) {
  const s = u._status;
  const bloqueio = u._bloqueio;
  return (
    <div className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3 ${
      selected ? 'border-red-300 bg-red-50/40' : s.complete ? 'border-gray-100' : 'border-amber-200 bg-amber-50/40'
    }`}>
      <input
        type="checkbox"
        className="h-4 w-4 shrink-0 rounded border-gray-300"
        checked={selected}
        disabled={!bloqueio.ok}
        onChange={onToggle}
        aria-label={`Selecionar ${u.platform_name || u.full_name || u.uid} para excluir`}
        title={bloqueio.ok ? 'Selecionar para excluir' : bloqueio.reason}
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="font-semibold text-ink">
            {u.platform_name || u.full_name || '(sem nome)'}
          </span>
          {s.complete ? (
            <V2Badge tone="green">
              <CheckCircle2 className="h-3 w-3" /> completo
            </V2Badge>
          ) : (
            <V2Badge tone="amber">
              <AlertCircle className="h-3 w-3" /> falta {s.missingRequired.length} obrigatório(s)
            </V2Badge>
          )}
        </div>
        <div className="mt-0.5 truncate text-xs text-gray-500">{u.email || '(sem e-mail)'}</div>
        {s.missingCount > 0 && (
          <div className="mt-1 text-[11px] text-gray-500">
            Falta preencher: {s.missing.map((f) => f.label).join(', ')}
          </div>
        )}
        <div className="mt-1 text-[10px] text-gray-400">
          {s.filledCount}/{s.totalCount} campos preenchidos
        </div>
        {u._teste.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {u._teste.map((m) => (
              <span key={m} className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-900">
                {m}
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="flex gap-2">
        <V2Button size="sm" variant="secondary" onClick={onEdit}>
          <Pencil className="mr-1 h-3.5 w-3.5" /> Editar cadastro
        </V2Button>
        {bloqueio.ok ? (
          <V2Button size="sm" variant="ghost" className="text-red-600 hover:bg-red-50" onClick={onDelete} aria-label={`Excluir ${u.platform_name || u.full_name || u.uid}`}>
            <Trash2 className="h-3.5 w-3.5" /> Excluir
          </V2Button>
        ) : (
          <span className="self-center text-[10px] text-gray-400" title={bloqueio.reason}>não excluível</span>
        )}
      </div>
    </div>
  );
}

function RecordEditDialog({ user, onClose }) {
  const salvar = useUpdateUserRecordAsAdmin();
  const [form, setForm] = useState(() => Object.fromEntries(
    ADMIN_EDITABLE_FIELDS.map((f) => [f.key, user[f.key] ?? '']),
  ));
  const [motivo, setMotivo] = useState('');

  const { patch } = sanitizeAdminUserPatch(form);
  const changes = diffAdminUserPatch(user, patch);
  const validacao = validateAdminEdit({ changes, reason: motivo });
  const faltando = new Set(user._status?.missing?.map((f) => f.key) || []);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSave = async () => {
    try {
      const r = await salvar.mutateAsync({ uid: user.uid, patch, reason: motivo });
      toast.success(`${r.changes.length} campo(s) corrigido(s).`);
      onClose();
    } catch (e) {
      toast.error(e?.message || 'Não foi possível salvar.');
    }
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[90dvh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{user.platform_name || user.full_name || 'Cadastro'}</DialogTitle>
          <DialogDescription>
            {user.email || '(sem e-mail)'} · <span className="font-mono text-[10px]">{user.uid}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {GRUPOS.map((g) => (
            <div key={g.id}>
              <h4 className="text-xs font-bold uppercase tracking-wide text-gray-400">{g.label}</h4>
              <div className="mt-2 grid gap-3 sm:grid-cols-2">
                {ADMIN_EDITABLE_FIELDS.filter((f) => f.group === g.id).map((f) => (
                  <label key={f.key} className="block text-xs font-semibold text-ink">
                    <span className="flex items-center gap-1.5">
                      {f.label}
                      {f.required && <span className="text-red-500">*</span>}
                      {faltando.has(f.key) && (
                        <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold text-amber-700">
                          vazio
                        </span>
                      )}
                    </span>
                    <CampoDeEdicao field={f} value={form[f.key] ?? ''} onChange={(v) => set(f.key, v)} />
                  </label>
                ))}
              </div>
            </div>
          ))}

          {changes.length > 0 && (
            <div className="rounded-xl border border-gray-200 bg-paper p-3">
              <h4 className="text-xs font-bold text-ink">
                O que vai mudar ({changes.length})
              </h4>
              <ul className="mt-2 space-y-1 text-[11px]">
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
            Motivo da correção <span className="text-red-500">*</span>
            <V2Input
              className="mt-1"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ex.: o atleta pediu a correção do telefone por WhatsApp"
            />
            <span className="mt-1 block text-[10px] font-normal text-gray-500">
              Fica na Auditoria junto com o antes e o depois de cada campo.
            </span>
          </label>
        </div>

        <DialogFooter>
          <V2Button variant="ghost" onClick={onClose}>Cancelar</V2Button>
          <V2Button
            disabled={!validacao.isValid || salvar.isPending}
            onClick={handleSave}
          >
            {salvar.isPending ? 'Salvando…' : `Salvar ${changes.length} alteração(ões)`}
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
        <option value="">— não informado —</option>
        {opcoes.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        {foraDaLista && <option value={value}>{value} (valor antigo, fora da lista)</option>}
      </V2Select>
      {foraDaLista && (
        <span className="mt-1 block text-[10px] font-normal text-amber-700">
          O valor gravado não está na lista atual. Escolha um da lista para corrigir.
        </span>
      )}
    </>
  );
}

/** Exportado só para o teste conferir que a lista de proibidos não regrediu. */
export const CAMPOS_PROIBIDOS = ADMIN_FORBIDDEN_FIELDS;
