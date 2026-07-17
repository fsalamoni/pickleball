import React, { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, Loader2, Search } from 'lucide-react';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  limit,
} from 'firebase/firestore';
import { db } from '@/core/config/firebase';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { isOwnerEmail } from '@/core/config/owners';
import { V2Button, V2PageIntro, V2Skeleton, V2Surface } from '@/v2/ui/primitives';

/**
 * Página de DEBUG profundo do estado de um user no Firestore.
 *
 * Aceita qualquer usuário logado, mas só mostra dados sensíveis se o email
 * dele for de owner. Usado pra diagnosticar "user sumiu", "sem torneios",
 * "perfil zerado" sem precisar de role de admin.
 *
 * Mostra (com try/catch individual em cada query):
 *  - Auth: uid, email, emailVerified, providerId
 *  - users/{uid}: campos principais
 *  - athlete_profiles/{uid}: campos principais
 *  - tournament_admins: lista onde user_id == uid
 *  - tournaments: lista onde creator_uid == uid
 *  - tournament_registrations: lista onde player_a_user_id == uid OU
 *    player_b_user_id == uid OU player_a_email_lc == email
 *  - Erros detalhados (permission-denied, not-found, etc)
 */
export default function V2AdminOwnerDebug() {
  const { user, isLoadingAuth, isAuthenticated } = useAuth();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const isOwner = isOwnerEmail(user?.email);

  async function runDiagnostics(targetUid) {
    if (!db) {
      setError('Firestore não inicializado (firebaseServicesEnabled = false).');
      return;
    }
    setLoading(true);
    setError(null);
    const out = {
      target: { uid: targetUid, email: user?.email || null },
      startedAt: new Date().toISOString(),
      sections: {},
    };
    const errors = [];

    // 1) Auth
    out.sections.auth = {
      uid: user?.uid || null,
      email: user?.email || null,
      emailVerified: user?.emailVerified ?? null,
      displayName: user?.displayName || null,
      photoURL: user?.photoURL || null,
      providerId: user?.providerData?.[0]?.providerId || null,
    };

    // 2) users/{uid}
    try {
      const u = await getDoc(doc(db, 'users', targetUid));
      out.sections.users = u.exists()
        ? { exists: true, id: u.id, ...u.data() }
        : { exists: false };
    } catch (err) {
      out.sections.users = { error: err.message, code: err.code };
      errors.push(`users: ${err.message}`);
    }

    // 3) athlete_profiles/{uid}
    try {
      const a = await getDoc(doc(db, 'athlete_profiles', targetUid));
      out.sections.athlete_profiles = a.exists()
        ? { exists: true, id: a.id, ...a.data() }
        : { exists: false };
    } catch (err) {
      out.sections.athlete_profiles = { error: err.message, code: err.code };
      errors.push(`athlete_profiles: ${err.message}`);
    }

    // 4) tournament_admins onde user_id == uid
    try {
      const snap = await getDocs(
        query(collection(db, 'tournament_admins'), where('user_id', '==', targetUid), limit(50)),
      );
      out.sections.tournament_admins = {
        count: snap.size,
        docs: snap.docs.map((d) => ({ id: d.id, ...d.data() })),
      };
    } catch (err) {
      out.sections.tournament_admins = { error: err.message, code: err.code };
      errors.push(`tournament_admins: ${err.message}`);
    }

    // 5) tournaments onde creator_uid == uid
    try {
      const snap = await getDocs(
        query(collection(db, 'tournaments'), where('creator_uid', '==', targetUid), limit(50)),
      );
      out.sections.tournaments_creator = {
        count: snap.size,
        docs: snap.docs.map((d) => ({ id: d.id, ...d.data() })),
      };
    } catch (err) {
      out.sections.tournaments_creator = { error: err.message, code: err.code };
      errors.push(`tournaments_creator: ${err.message}`);
    }

    // 5b) TODOS os tournaments (sem filtro de creator_uid) — para responder
    // 'onde estão os 2 que somem?' quando o owner reporta 6 mas vê 4.
    try {
      const allSnap = await getDocs(collection(db, 'tournaments'));
      const allDocs = allSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const archived = allDocs.filter((t) => t.archived === true);
      const byCreator = allDocs.reduce((acc, t) => {
        const k = t.creator_uid || '(sem creator_uid)';
        acc[k] = (acc[k] || 0) + 1;
        return acc;
      }, {});
      out.sections.tournaments_all = {
        count: allSnap.size,
        count_archived: archived.length,
        archived_ids: archived.map((t) => ({ id: t.id, name: t.name, status: t.status, archived_at: t.archived_at })),
        by_creator: byCreator,
        docs: allDocs.map((d) => ({
          id: d.id,
          name: d.name,
          creator_uid: d.creator_uid,
          status: d.status,
          archived: d.archived,
          created_at: d.created_at,
        })),
      };
    } catch (err) {
      out.sections.tournaments_all = { error: err.message, code: err.code };
      errors.push(`tournaments_all: ${err.message}`);
    }

    // 6) tournament_registrations onde player_a_user_id == uid
    try {
      const [aSnap, bSnap] = await Promise.all([
        getDocs(
          query(collection(db, 'tournament_registrations'),
            where('player_a_user_id', '==', targetUid), limit(50)),
        ),
        getDocs(
          query(collection(db, 'tournament_registrations'),
            where('player_b_user_id', '==', targetUid), limit(50)),
        ),
      ]);
      out.sections.tournament_registrations = {
        count_player_a: aSnap.size,
        count_player_b: bSnap.size,
        docs_player_a: aSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
        docs_player_b: bSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
      };
    } catch (err) {
      out.sections.tournament_registrations = { error: err.message, code: err.code };
      errors.push(`tournament_registrations: ${err.message}`);
    }

    // 7) tournament_registrations onde player_a_email_lc == email (provisórios)
    if (user?.email) {
      try {
        const email = user.email.trim().toLowerCase();
        const [aSnap, bSnap] = await Promise.all([
          getDocs(
            query(collection(db, 'tournament_registrations'),
              where('player_a_email_lc', '==', email), limit(50)),
          ),
          getDocs(
            query(collection(db, 'tournament_registrations'),
              where('player_b_email_lc', '==', email), limit(50)),
          ),
        ]);
        out.sections.tournament_registrations_by_email = {
          count_player_a: aSnap.size,
          count_player_b: bSnap.size,
          docs_player_a: aSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
          docs_player_b: bSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
        };
      } catch (err) {
        out.sections.tournament_registrations_by_email = { error: err.message, code: err.code };
        errors.push(`tournament_registrations_by_email: ${err.message}`);
      }
    }

    out.errors = errors;
    out.finishedAt = new Date().toISOString();
    setReport(out);
    setLoading(false);
  }

  useEffect(() => {
    if (user?.uid) {
      runDiagnostics(user.uid);
    }
  }, [user?.uid]);

  if (isLoadingAuth) {
    return <V2Skeleton className="mx-auto mt-10 h-64 max-w-[1000px] rounded-4xl" />;
  }
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  if (!isOwner) {
    return (
      <div className="mx-auto max-w-[700px]">
        <V2PageIntro title="Acesso restrito" subtitle="Página de debug exclusiva do owner." />
        <V2Surface className="p-6">
          <p>Você não é o owner da plataforma. Esta página só é acessível para o e-mail cadastrado em <code>core/config/owners.js</code>.</p>
          <Link to="/" className="mt-4 inline-block text-sm font-bold text-ink underline">← Voltar ao início</Link>
        </V2Surface>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1100px]">
      <V2PageIntro
        title="Debug profundo do user"
        subtitle="Lê Firestore direto (sem hooks/cache) e mostra contagens + erros. Use quando 'user sumiu' / 'perfil zerado' / 'useMyTournaments retorna []'."
      />

      <V2Surface className="mb-6 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-400">UID alvo</div>
            <code className="mt-1 block break-all font-mono text-sm text-ink">{user?.uid || '—'}</code>
          </div>
          <V2Button onClick={() => runDiagnostics(user.uid)} disabled={loading}>
            <Loader2 className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Rodando…' : 'Re-rodar diagnóstico'}
          </V2Button>
        </div>
        {error && (
          <div className="mt-4 rounded-[1.25rem] border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>
        )}
      </V2Surface>

      {report && (
        <>
          {report.errors?.length > 0 && (
            <V2Surface className="mb-6 border-red-200 bg-red-50 p-6">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-red-100 text-red-700">
                  <AlertTriangle className="h-4.5 w-4.5" />
                </div>
                <div>
                  <h2 className="font-display text-lg font-bold text-red-900">Erros durante o diagnóstico</h2>
                  <ul className="mt-2 space-y-1 text-sm text-red-800">
                    {report.errors.map((e, i) => <li key={i}>• {e}</li>)}
                  </ul>
                </div>
              </div>
            </V2Surface>
          )}

          <div className="space-y-4">
            <Section title="1. Auth (Firebase Auth state)" data={report.sections.auth} />
            <Section title="2. users/{uid}" data={report.sections.users} />
            <Section title="3. athlete_profiles/{uid}" data={report.sections.athlete_profiles} />
            <Section
              title="4. tournament_admins (user_id == uid)"
              data={report.sections.tournament_admins}
              summary="count"
            />
            <Section
              title="5. tournaments (creator_uid == uid)"
              data={report.sections.tournaments_creator}
              summary="count"
            />
            <Section
              title="5b. TODOS os tournaments (sem filtro) — diz onde estão os 2 que somem"
              data={report.sections.tournaments_all}
              summary="count"
            />
            <Section
              title="6. tournament_registrations (player_a / player_b == uid)"
              data={report.sections.tournament_registrations}
              summary="counts"
            />
            <Section
              title="7. tournament_registrations (player_email == email)"
              data={report.sections.tournament_registrations_by_email}
              summary="counts"
            />
          </div>

          <details className="mt-6 rounded-2xl border border-gray-100 bg-paper-pure p-4">
            <summary className="cursor-pointer text-sm font-semibold text-ink">Ver JSON bruto completo</summary>
            <pre className="mt-4 overflow-x-auto rounded-xl bg-ink p-4 text-xs text-acid">
              {JSON.stringify(report, null, 2)}
            </pre>
          </details>
        </>
      )}
    </div>
  );
}

function Section({ title, data, summary }) {
  return (
    <V2Surface className="p-5">
      <h3 className="font-display text-base font-bold text-ink">{title}</h3>
      {summary === 'count' && data && (
        <div className="mt-2">
          <span className="text-2xl font-bold text-ink">{data.count ?? 0}</span>
          <span className="ml-2 text-sm text-gray-500">documentos encontrados</span>
        </div>
      )}
      {summary === 'counts' && data && (
        <div className="mt-2 flex gap-4 text-sm">
          <div>
            <span className="text-2xl font-bold text-ink">{data.count_player_a ?? 0}</span>
            <span className="ml-1 text-gray-500">player_a</span>
          </div>
          <div>
            <span className="text-2xl font-bold text-ink">{data.count_player_b ?? 0}</span>
            <span className="ml-1 text-gray-500">player_b</span>
          </div>
        </div>
      )}
      {data?.error && (
        <div className="mt-2 rounded-[1rem] border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <strong>Erro:</strong> {data.error} <code className="ml-1">({data.code})</code>
        </div>
      )}
      <details className="mt-3">
        <summary className="cursor-pointer text-xs font-semibold uppercase tracking-widest text-gray-400">
          Detalhes
        </summary>
        <pre className="mt-2 overflow-x-auto rounded-xl bg-ink p-3 text-xs text-acid">
          {JSON.stringify(data, null, 2)}
        </pre>
      </details>
    </V2Surface>
  );
}
