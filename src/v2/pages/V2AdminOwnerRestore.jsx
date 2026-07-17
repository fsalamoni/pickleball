import React, { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { AlertTriangle, KeyRound, ShieldAlert, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { isOwnerEmail } from '@/core/config/owners';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/core/config/firebase';
import { createAuditLog } from '@/core/services/auditService';
import { V2Button, V2PageIntro, V2Skeleton, V2Surface } from '@/v2/ui/primitives';

/**
 * Rota de emergência para o owner da plataforma.
 *
 * Acessível por qualquer usuário logado, mas só EXECUTA a restauração se o
 * e-mail dele estiver na lista de owners (single source of truth em
 * `core/config/owners.js`).
 *
 * Use quando o `users/{uid}.role` for corrompido (bug antigo, edição
 * manual, etc) e o admin master perdeu o acesso. A página mostra diagnóstico
 * + botão "Restaurar meu admin" que força `role: 'platform_admin'` +
 * `can_create_pools: true` e invalida o cache do Firestore via logout/login.
 *
 * IMPORTANTE: esta página é PÚBLICA no roteamento (sem ProtectedRoute
 * adicional) — a checagem é por e-mail, não por role. Isso é proposital:
 * o owner pode estar sem role e ainda assim se auto-restaurar.
 */
export default function V2AdminOwnerRestore() {
  const { user, userProfile, isLoadingAuth, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [usersDoc, setUsersDoc] = useState(null);
  const [athleteProfile, setAthleteProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const isOwner = isOwnerEmail(user?.email);

  useEffect(() => {
    if (!db || !user?.uid) {
      setLoading(false);
      return;
    }
    setLoading(true);
    Promise.all([
      getDoc(doc(db, 'users', user.uid)),
      getDoc(doc(db, 'athlete_profiles', user.uid)),
    ])
      .then(([u, a]) => {
        setUsersDoc(u.exists() ? { id: u.id, ...u.data() } : null);
        setAthleteProfile(a.exists() ? { id: a.id, ...a.data() } : null);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [user?.uid]);

  async function handleRestore() {
    if (!user?.uid) return;
    setBusy(true);
    try {
      const payload = {
        role: 'platform_admin',
        can_create_pools: true,
        updated_at: serverTimestamp(),
        restored_at: serverTimestamp(),
        restored_via: 'V2AdminOwnerRestore',
      };
      await setDoc(doc(db, 'users', user.uid), payload, { merge: true });
      await createAuditLog({
        action: 'platform_owner_self_restored',
        actor: user,
        userId: user.uid,
        userName: userProfile?.platform_name || user?.displayName,
        userEmail: user?.email,
        details: {
          via: 'V2AdminOwnerRestore',
          previous_role: usersDoc?.role || null,
        },
      });
      // Re-busca o doc para mostrar o estado novo.
      const fresh = await getDoc(doc(db, 'users', user.uid));
      setUsersDoc(fresh.exists() ? { id: fresh.id, ...fresh.data() } : null);
      toast.success('Admin restaurado. Faça logout/login para o useAuth() recarregar.');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (isLoadingAuth) {
    return <V2Skeleton className="mx-auto mt-10 h-64 max-w-[800px] rounded-4xl" />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: '/admin/owner-restore' }} />;
  }

  if (!isOwner) {
    return (
      <div className="mx-auto max-w-[700px]">
        <V2PageIntro
          title="Acesso restrito"
          subtitle="Esta rota é exclusiva para o owner da plataforma."
        />
        <V2Surface className="p-6 sm:p-7">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-red-100 text-red-700">
              <ShieldAlert className="h-4.5 w-4.5" />
            </div>
            <div>
              <h2 className="font-display text-xl font-bold text-ink">Você não é o owner</h2>
              <p className="mt-1 text-sm leading-6 text-gray-500">
                Esta página está acessível a qualquer usuário logado, mas a
                ação de restauração só executa se o seu e-mail estiver na
                lista de owners (single source of truth em
                <code className="mx-1 rounded bg-paper px-1.5 py-0.5 text-xs">core/config/owners.js</code>).
                Conta logada: <code className="mx-1 rounded bg-paper px-1.5 py-0.5 text-xs">{user?.email || '—'}</code>.
              </p>
            </div>
          </div>
          <div className="mt-5">
            <Link to="/" className="text-sm font-bold text-ink underline">← Voltar ao início</Link>
          </div>
        </V2Surface>
      </div>
    );
  }

  const currentRole = usersDoc?.role;
  const roleIsBroken = currentRole !== 'platform_admin';
  const athletePhotoIsEmpty = athleteProfile && !athleteProfile.photo_url;
  const userDocPhotoIsEmpty = usersDoc && !usersDoc.photo_url;

  return (
    <div className="mx-auto max-w-[900px]">
      <V2PageIntro
        title="Restaurar admin (emergência)"
        subtitle="Use esta página se você perdeu o acesso admin. Detecta e corrige o role do seu users/{uid}."
      />

      <V2Surface className="mb-6 p-6 sm:p-7">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-ink text-acid">
            <KeyRound className="h-4.5 w-4.5" />
          </div>
          <div className="flex-1">
            <h2 className="font-display text-xl font-bold text-ink">Diagnóstico</h2>
            <p className="mt-1 text-sm leading-6 text-gray-500">
              Verifica o estado do seu <code className="mx-1 rounded bg-paper px-1.5 py-0.5 text-xs">users/{'{uid}'}</code>
              e <code className="mx-1 rounded bg-paper px-1.5 py-0.5 text-xs">athlete_profiles/{'{uid}'}</code> e oferece a restauração quando necessário.
            </p>
          </div>
        </div>

        {loading ? (
          <V2Skeleton className="mt-4 h-32 rounded-2xl" />
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Field label="UID" value={user?.uid} mono />
            <Field label="E-mail" value={user?.email} />
            <Field label="Auth email verificado" value={String(user?.emailVerified)} />
            <Field label="Display name (Google)" value={user?.displayName} />
            <Field label="users.role" value={currentRole || '— (vazio)'} highlight={roleIsBroken ? 'red' : 'green'} />
            <Field label="users.can_create_pools" value={String(usersDoc?.can_create_pools ?? '—')} />
            <Field label="users.photo_url" value={userDocPhotoIsEmpty ? '(vazio)' : usersDoc?.photo_url || '—'} mono={!userDocPhotoIsEmpty} />
            <Field
              label="users.platform_name"
              value={usersDoc?.platform_name || '—'}
            />
            <Field
              label="athlete_profiles.photo_url"
              value={athletePhotoIsEmpty ? '(vazio — bug do sync!)' : athleteProfile?.photo_url || '—'}
              mono={!athletePhotoIsEmpty}
              highlight={athletePhotoIsEmpty ? 'amber' : undefined}
            />
            <Field
              label="athlete_profiles.platform_name"
              value={athleteProfile?.platform_name || '—'}
            />
          </div>
        )}

        {error && (
          <div className="mt-4 rounded-[1.25rem] border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {error}
          </div>
        )}

        {roleIsBroken && (
          <div className="mt-5 rounded-[1.25rem] border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-900">
            <div className="flex items-center gap-2 font-bold">
              <AlertTriangle className="h-4 w-4" />
              Role incorreto detectado
            </div>
            <p className="mt-1">
              O <code className="rounded bg-white px-1.5 py-0.5 text-xs">users/{user?.uid}</code>
              tem <code className="rounded bg-white px-1.5 py-0.5 text-xs">role: &apos;{currentRole || '—'}&apos;</code>
              mas deveria ser <code className="rounded bg-white px-1.5 py-0.5 text-xs">&apos;platform_admin&apos;</code>.
              O FirebaseAuthContext deveria auto-corrigir isso no próximo login, mas em alguns
              casos (sessão stale, bug de merge) o fix não dispara.
            </p>
            <V2Button className="mt-4" onClick={handleRestore} disabled={busy}>
              <ShieldCheck className="h-4 w-4" />
              {busy ? 'Restaurando…' : 'Restaurar meu admin agora'}
            </V2Button>
          </div>
        )}

        {!roleIsBroken && (
          <div className="mt-5 rounded-[1.25rem] border border-green-200 bg-green-50 p-4 text-sm leading-6 text-green-900">
            <div className="flex items-center gap-2 font-bold">
              <ShieldCheck className="h-4 w-4" />
              Role correto
            </div>
            <p className="mt-1">
              Tudo certo com seu admin. Se você ainda não está vendo a página de
              administração, faça logout/login para o
              <code className="mx-1 rounded bg-white px-1.5 py-0.5 text-xs">useAuth()</code>
              recarregar.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <V2Button variant="outline" onClick={() => navigate('/admin/torneios')}>
                Ir para /admin/torneios
              </V2Button>
              <V2Button variant="outline" onClick={() => navigate('/admin/perfis')}>
                Ir para /admin/perfis
              </V2Button>
              <V2Button variant="outline" onClick={() => navigate('/admin/metricas')}>
                Ir para /admin/metricas
              </V2Button>
            </div>
          </div>
        )}

        {athletePhotoIsEmpty && (
          <div className="mt-4 rounded-[1.25rem] border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
            <div className="flex items-center gap-2 font-bold">
              <AlertTriangle className="h-4 w-4" />
              Foto do atleta_profiles está vazia
            </div>
            <p className="mt-1">
              Indica que o bug antigo do <code className="rounded bg-white px-1.5 py-0.5 text-xs">syncAthleteProfile</code> sobrescreveu sua foto com string vazia.
              Vá em <Link to="/admin/perfis" className="font-bold underline">/admin/perfis</Link> e use o botão &quot;Restaurar perfil&quot; pelo UID pra re-ler
              do <code className="rounded bg-white px-1.5 py-0.5 text-xs">users/{'{uid}'}</code>.
            </p>
          </div>
        )}
      </V2Surface>
    </div>
  );
}

function Field({ label, value, mono, highlight }) {
  const base = 'flex flex-col gap-1 rounded-2xl border p-3';
  const tone = highlight === 'red'
    ? 'border-red-200 bg-red-50'
    : highlight === 'amber'
      ? 'border-amber-200 bg-amber-50'
      : highlight === 'green'
        ? 'border-green-200 bg-green-50'
        : 'border-gray-100 bg-paper-pure';
  return (
    <div className={`${base} ${tone}`}>
      <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{label}</span>
      <span className={mono ? 'break-all font-mono text-xs' : 'truncate text-sm font-semibold text-ink'}>
        {value || '—'}
      </span>
    </div>
  );
}
