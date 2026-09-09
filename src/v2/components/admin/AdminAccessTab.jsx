import React, { useMemo, useState } from 'react';
import {
  ShieldCheck, ShieldAlert, EyeOff, KeyRound, Terminal, UserMinus, Info,
} from 'lucide-react';
import { toast } from 'sonner';

import { V2Surface, V2Button, V2Badge, V2Skeleton, V2Input } from '@/v2/ui/primitives';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { isOwnerEmail, PLATFORM_OWNER_EMAILS } from '@/core/config/owners';
import {
  useAllPlatformUsers, useRevokeAccountPowers,
} from '@/modules/admin/hooks/usePlatformUsers';
import {
  buildAccessRoster, canRevokeAccount, revokeBlockedReason, ALERT_LEVEL,
} from '@/modules/admin/domain/accessRoster';

/**
 * "Acessos e poderes" — quem manda na plataforma, e o que fazer a respeito.
 *
 * Esta aba existe por causa de um achado real: havia quatro contas com
 * `platform_admin` em produção e nenhum lugar, dentro do produto, onde isso
 * aparecesse. Descobrir exigia consultar o banco à mão.
 *
 * Duas coisas que a tela diz em voz alta, porque as duas já enganaram:
 *  - ocultar um atleta NÃO remove o poder dele;
 *  - conta com e-mail de dono é re-promovida em todo login, então revogá-la
 *    não adianta.
 *
 * A revogação só REMOVE poder. Promover não existe aqui, de propósito — é
 * console do Firebase, e a regra do Firestore recusa qualquer promoção vinda
 * do cliente.
 */
export default function AdminAccessTab() {
  const { user, isPlatformAdmin } = useAuth();
  const { data: users = [], isLoading } = useAllPlatformUsers({ enabled: isPlatformAdmin });
  const revoke = useRevokeAccountPowers();
  const [alvo, setAlvo] = useState(null);

  const souDono = isOwnerEmail(user?.email);
  const roster = useMemo(() => buildAccessRoster(users, {
    ownerEmails: PLATFORM_OWNER_EMAILS,
    currentUid: user?.uid || null,
  }), [users, user?.uid]);

  if (isLoading) return <V2Skeleton lines={6} />;

  return (
    <div className="space-y-6">
      <V2Surface>
        <div className="flex items-center gap-2">
          <KeyRound className="h-5 w-5 text-ink" />
          <h2 className="font-display text-lg font-bold text-ink">Acessos e poderes</h2>
        </div>
        <p className="mt-1 text-xs leading-5 text-gray-500">
          Quem tem poder de administrador na plataforma, e por quê. Administrador lê o
          documento de qualquer usuário, apaga registros e muda as funcionalidades — não
          existe poder maior aqui dentro.
        </p>
      </V2Surface>

      {roster.alerts.map((a) => <AlertCard key={a.code} alert={a} />)}

      <V2Surface>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-display text-base font-bold text-ink">
            Administradores ({roster.counts.admins})
          </h3>
          <span className="text-[11px] text-gray-400">
            {roster.counts.total} conta(s) na plataforma
          </span>
        </div>

        <div className="mt-3 space-y-2">
          {roster.admins.length === 0 ? (
            <p className="py-4 text-sm text-gray-400">Nenhuma conta com poder de administrador.</p>
          ) : roster.admins.map((c) => (
            <AccountRow
              key={c.uid}
              account={c}
              souDono={souDono}
              onRevoke={() => setAlvo(c)}
            />
          ))}
        </div>
      </V2Surface>

      {roster.poolCreators.length > 0 && (
        <V2Surface>
          <h3 className="font-display text-base font-bold text-ink">
            Podem criar pools, sem ser administradores ({roster.poolCreators.length})
          </h3>
          <p className="mt-1 text-[11px] text-gray-500">
            Poder menor, mas ainda é poder: vale conferir se cada um faz sentido.
          </p>
          <div className="mt-3 space-y-2">
            {roster.poolCreators.map((c) => (
              <AccountRow key={c.uid} account={c} souDono={souDono} onRevoke={() => setAlvo(c)} />
            ))}
          </div>
        </V2Surface>
      )}

      <EmergencyToolsCard />

      <ConsoleOnlyCard />

      <RevokeDialog
        account={alvo}
        onClose={() => setAlvo(null)}
        pending={revoke.isPending}
        onConfirm={async (reason) => {
          const c = alvo;
          if (!c) return;
          try {
            await revoke.mutateAsync({ uid: c.uid, previousRole: c.role, reason });
            toast.success(`Poder revogado de ${c.name || c.uid}.`);
            setAlvo(null);
          } catch (e) {
            toast.error(e?.message || 'Não foi possível revogar.');
          }
        }}
      />
    </div>
  );
}

/* --------------------------------------------------------------------------- */

const TOM_ALERTA = {
  [ALERT_LEVEL.CRITICAL]: {
    caixa: 'border-red-200 bg-red-50', icone: 'text-red-500', titulo: 'text-red-800',
    Icon: ShieldAlert,
  },
  [ALERT_LEVEL.WARNING]: {
    caixa: 'border-amber-200 bg-amber-50', icone: 'text-amber-500', titulo: 'text-amber-800',
    Icon: ShieldAlert,
  },
  [ALERT_LEVEL.INFO]: {
    caixa: 'border-emerald-200 bg-emerald-50', icone: 'text-emerald-500', titulo: 'text-emerald-800',
    Icon: ShieldCheck,
  },
};

function AlertCard({ alert }) {
  const t = TOM_ALERTA[alert.level] || TOM_ALERTA[ALERT_LEVEL.INFO];
  const { Icon } = t;
  return (
    <div className={`flex items-start gap-3 rounded-2xl border p-4 ${t.caixa}`}>
      <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${t.icone}`} />
      <div className="min-w-0">
        <p className={`text-sm font-semibold ${t.titulo}`}>{alert.title}</p>
        <p className="mt-0.5 text-xs leading-5 text-gray-600">{alert.detail}</p>
      </div>
    </div>
  );
}

function AccountRow({ account: c, souDono, onRevoke }) {
  const pode = canRevokeAccount(c, { isOwner: souDono });
  const motivo = revokeBlockedReason(c, { isOwner: souDono });
  return (
    <div className={`rounded-xl border p-3 ${c.unexpectedAdmin ? 'border-red-200 bg-red-50/40' : 'border-gray-100'}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-semibold text-ink">{c.name || '(sem nome)'}</span>
            {c.isSelf && <V2Badge tone="acid">você</V2Badge>}
            {c.isOwnerEmail && <V2Badge tone="neutral">e-mail de dono</V2Badge>}
            {c.unexpectedAdmin && <V2Badge tone="red">inesperado</V2Badge>}
            {c.hidden && (
              <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-600">
                <EyeOff className="h-3 w-3" /> oculto
              </span>
            )}
          </div>
          <div className="mt-0.5 truncate text-xs text-gray-500">
            {c.email || <span className="text-amber-600">sem e-mail no documento</span>}
          </div>
          <div className="mt-1 font-mono text-[10px] text-gray-400">{c.uid}</div>
          <div className="mt-1 flex flex-wrap gap-1.5 text-[10px] text-gray-500">
            <span className="rounded bg-gray-100 px-1.5 py-0.5">role: {c.role}</span>
            {c.canCreatePools && <span className="rounded bg-gray-100 px-1.5 py-0.5">cria pools</span>}
            <span className="rounded bg-gray-100 px-1.5 py-0.5">
              último acesso: {formatarData(c.lastLogin)}
            </span>
          </div>
          {c.hiddenButPowerful && (
            <p className="mt-2 rounded-lg bg-red-100 px-2 py-1 text-[11px] leading-4 text-red-800">
              Esta conta está oculta, mas <strong>continua com poder</strong>. Ocultar
              afeta só a exibição nas listagens.
            </p>
          )}
        </div>

        <div className="shrink-0 text-right">
          {pode ? (
            <V2Button size="sm" variant="ghost" className="text-red-600 hover:text-red-700" onClick={onRevoke}>
              <UserMinus className="mr-1 h-3.5 w-3.5" /> Revogar poder
            </V2Button>
          ) : (
            <span className="block max-w-[190px] text-[11px] leading-4 text-gray-400">{motivo}</span>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * As duas ferramentas de emergência que já existiam mas viviam escondidas na
 * aba "Avançado". O lugar de procurá-las é aqui, quando o acesso quebrou.
 */
function EmergencyToolsCard() {
  return (
    <V2Surface>
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-5 w-5 text-ink" />
        <h3 className="font-display text-base font-bold text-ink">Se você perder o acesso</h3>
      </div>
      <p className="mt-1 text-xs text-gray-500">
        Estas páginas funcionam mesmo com o seu <code>role</code> corrompido — a checagem
        delas é pelo e-mail da conta, não pelo poder gravado no banco.
      </p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <a
          href="/admin/owner-restore"
          className="flex items-center gap-3 rounded-xl border border-gray-100 p-3 transition-colors hover:border-ink"
        >
          <KeyRound className="h-4 w-4 shrink-0 text-gray-400" />
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-ink">Restaurar meu admin</span>
            <span className="block text-[11px] text-gray-500">
              Devolve o seu próprio poder. Foi por aqui que você voltou da última vez.
            </span>
          </span>
        </a>
        <a
          href="/admin/owner-debug"
          className="flex items-center gap-3 rounded-xl border border-gray-100 p-3 transition-colors hover:border-ink"
        >
          <Terminal className="h-4 w-4 shrink-0 text-gray-400" />
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-ink">Diagnóstico da minha conta</span>
            <span className="block text-[11px] text-gray-500">
              Mostra o que o banco tem sobre você e o que cada regra está recusando.
            </span>
          </span>
        </a>
      </div>
    </V2Surface>
  );
}

function ConsoleOnlyCard() {
  return (
    <V2Surface>
      <div className="flex items-center gap-2">
        <Terminal className="h-5 w-5 text-ink" />
        <h3 className="font-display text-base font-bold text-ink">O que só se faz no console</h3>
      </div>
      <p className="mt-1 text-xs text-gray-500">
        Nem tudo deve ser possível daqui. Estas três coisas ficam de fora de propósito:
      </p>
      <ul className="mt-3 space-y-2 text-xs leading-5 text-gray-600">
        <li className="flex gap-2">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gray-400" />
          <span>
            <strong className="text-ink">Promover alguém a administrador.</strong> A regra do
            Firestore recusa qualquer promoção vinda do navegador — inclusive a sua. Isso é o
            que fecha a falha em que qualquer conta se promovia sozinha. Para promover:
            Console → Firestore → <code>users/&#123;uid&#125;</code> → <code>role</code>.
          </span>
        </li>
        <li className="flex gap-2">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gray-400" />
          <span>
            <strong className="text-ink">Encerrar a sessão de quem foi revogado.</strong> Revogar
            tira o poder, mas um token já emitido vale até expirar. Para cortar na hora:
            <code> revokeRefreshTokens(uid)</code> pelo Admin SDK.
          </span>
        </li>
        <li className="flex gap-2">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gray-400" />
          <span>
            <strong className="text-ink">Apagar a conta de verdade.</strong> O documento em
            <code> users</code> é só o perfil; a conta vive no Firebase Authentication. Apagar o
            documento não apaga a conta — e destrói a evidência. Prefira revogar.
          </span>
        </li>
      </ul>
    </V2Surface>
  );
}

function RevokeDialog({ account, onClose, onConfirm, pending }) {
  const [texto, setTexto] = useState('');
  const [motivo, setMotivo] = useState('');
  React.useEffect(() => { setTexto(''); setMotivo(''); }, [account?.uid]);
  if (!account) return null;

  const confirmacao = 'REVOGAR';
  const liberado = texto.trim().toUpperCase() === confirmacao && !pending;

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Revogar o poder desta conta?</DialogTitle>
          <DialogDescription>
            {account.name || account.uid} deixa de ser administrador e passa a ser um usuário
            comum. O documento NÃO é apagado — o histórico fica preservado.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="rounded-lg bg-gray-50 p-3 text-xs text-gray-600">
            <div className="font-mono text-[10px] text-gray-500">{account.uid}</div>
            <div className="mt-1">{account.email || '(sem e-mail)'}</div>
            <div className="mt-1">role atual: <strong>{account.role}</strong></div>
          </div>

          <p className="rounded-lg bg-amber-50 px-3 py-2 text-[11px] leading-5 text-amber-800">
            A sessão que essa pessoa já tem aberta <strong>continua valendo até expirar</strong>.
            Para cortar na hora, use <code>revokeRefreshTokens</code> no Admin SDK.
          </p>

          <label className="block text-xs font-semibold text-ink">
            Motivo (fica na auditoria)
            <V2Input
              className="mt-1"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ex.: conta de teste criada durante um ajuste"
            />
          </label>

          <label className="block text-xs font-semibold text-ink">
            Digite <span className="font-mono text-red-600">{confirmacao}</span> para confirmar
            <V2Input
              className="mt-1"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder={confirmacao}
            />
          </label>
        </div>

        <DialogFooter>
          <V2Button variant="ghost" onClick={onClose}>Cancelar</V2Button>
          <V2Button
            className="bg-red-600 text-white hover:bg-red-700"
            disabled={!liberado}
            onClick={() => onConfirm(motivo)}
          >
            {pending ? 'Revogando…' : 'Revogar poder'}
          </V2Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function formatarData(v) {
  if (!v) return '—';
  const d = typeof v?.toDate === 'function' ? v.toDate() : new Date(v);
  if (Number.isNaN(d?.getTime?.())) return '—';
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
