import React, { createContext, useState, useContext, useEffect } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail as fbSendPasswordResetEmail,
  updateProfile as fbUpdateProfile,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, googleProvider, appleProvider, db, firebaseDisabledReason } from '@/core/config/firebase';
import { logger } from '@/core/lib/logger';
import { createAuditLog } from '@/core/services/auditService';
import { claimProvisionalRegistrationsForUser } from '@/modules/tournament/services/registrationService';
import { syncAthleteProfile } from '@/modules/athletes/services/athleteService';
import { isOwnerEmail } from '@/core/config/owners';

const AuthContext = createContext(null);

// Mantido como alias para compat com código legado.
const isPlatformOwnerEmail = isOwnerEmail;

/** Traduz os códigos de erro do Firebase Auth em mensagens claras (pt-BR). */
function mapAuthError(error, fallback = 'Não foi possível entrar. Tente novamente.') {
  switch (error?.code) {
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return 'Login cancelado. Tente novamente.';
    case 'auth/popup-blocked':
      return 'Pop-up bloqueado pelo navegador. Libere os pop-ups e tente de novo.';
    case 'auth/network-request-failed':
      return 'Erro de conexão. Verifique sua internet.';
    case 'auth/operation-not-supported-in-this-environment':
      return 'Seu navegador não suporta este login. Tente abrir em outro navegador.';
    case 'auth/web-storage-unsupported':
      return 'Seu navegador bloqueou o armazenamento necessário para entrar.';
    case 'auth/unauthorized-domain':
      return 'Domínio não autorizado para login.';
    case 'auth/invalid-email':
      return 'E-mail inválido.';
    case 'auth/user-disabled':
      return 'Esta conta foi desativada.';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
    case 'auth/invalid-login-credentials':
      return 'E-mail ou senha incorretos.';
    case 'auth/missing-password':
      return 'Informe a senha.';
    case 'auth/email-already-in-use':
      return 'Já existe uma conta com este e-mail. Faça login em vez de criar uma nova.';
    case 'auth/weak-password':
      return 'A senha precisa ter ao menos 6 caracteres.';
    case 'auth/too-many-requests':
      return 'Muitas tentativas. Aguarde alguns minutos e tente novamente.';
    case 'auth/account-exists-with-different-credential':
      return 'Este e-mail já está vinculado a outro método de login. Entre pelo método usado originalmente.';
    case 'auth/operation-not-allowed':
      return 'Este método de login não está habilitado. Contate o organizador.';
    case 'auth/configuration-missing':
      return firebaseDisabledReason || 'Login indisponível neste ambiente.';
    default:
      return fallback;
  }
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [authError, setAuthError] = useState(null);

  useEffect(() => {
    if (!auth || !db) {
      setUser(null);
      setUserProfile(null);
      setIsAuthenticated(false);
      setIsLoadingAuth(false);
      return undefined;
    }

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      try {
        if (firebaseUser) {
          setUser(firebaseUser);
          setIsAuthenticated(true);

          const userDocRef = doc(db, 'users', firebaseUser.uid);
          const userDoc = await getDoc(userDocRef);

          if (userDoc.exists()) {
            const existingProfile = userDoc.data();
            const autoAdminUpdates = isPlatformOwnerEmail(firebaseUser.email)
              ? { role: 'platform_admin', can_create_pools: true }
              : {};
            await setDoc(
              userDocRef,
              { ...autoAdminUpdates, last_login: serverTimestamp(), updated_at: serverTimestamp() },
              { merge: true },
            );
            const mergedProfile = { uid: firebaseUser.uid, ...existingProfile, ...autoAdminUpdates };
            await claimProvisionalRegistrationsForUser(firebaseUser, mergedProfile, { aliasEmails: mergedProfile.claim_alias_emails });
            setUserProfile(mergedProfile);
            // Mantém o diretório público de atletas atualizado (best-effort,
            // não bloqueia o login; respeita as preferências de privacidade).
            syncAthleteProfile(firebaseUser, mergedProfile);
          } else {
            const isOwner = isPlatformOwnerEmail(firebaseUser.email);
            const newProfile = {
              uid: firebaseUser.uid,
              email: firebaseUser.email,
              full_name: firebaseUser.displayName || '',
              platform_name: firebaseUser.displayName || '',
              birth_date: '',
              birth_date_at: null,
              phone: '',
              pickleball_experience: '',
              photo_url: firebaseUser.photoURL || '',
              // Campos da comunidade (diretório de atletas / clubes).
              gender: '',
              city: '',
              state: '',
              address: '',
              // Preferências de privacidade (padrão: contatos privados).
              phone_public: false,
              email_public: false,
              address_public: false,
              // Aparece no diretório de atletas por padrão.
              directory_listed: true,
              role: isOwner ? 'platform_admin' : 'user',
              can_create_pools: isOwner,
              created_at: serverTimestamp(),
              updated_at: serverTimestamp(),
              last_login: serverTimestamp(),
            };
            await setDoc(userDocRef, newProfile);
            await claimProvisionalRegistrationsForUser(firebaseUser, newProfile, { aliasEmails: newProfile.claim_alias_emails });
            setUserProfile(newProfile);
            syncAthleteProfile(firebaseUser, newProfile);
            logger.info('New user profile created:', firebaseUser.uid);
          }
        } else {
          setUser(null);
          setUserProfile(null);
          setIsAuthenticated(false);
        }
      } catch (error) {
        logger.error('Error in auth state change:', error);
        setAuthError({ type: 'profile_error', message: error.message, code: error.code });
      } finally {
        setIsLoadingAuth(false);
      }
    });
    return () => unsubscribe();
  }, []);

  const requireAuthReady = (provider) => {
    if (!auth || (provider && !provider.ok)) {
      const error = {
        type: 'signin_error',
        message: firebaseDisabledReason || 'Login indisponível neste ambiente.',
        code: 'auth/configuration-missing',
      };
      setAuthError(error);
      throw new Error(error.message);
    }
  };

  const runSignIn = async (fn) => {
    try {
      setAuthError(null);
      return await fn();
    } catch (error) {
      setAuthError({ type: 'signin_error', message: mapAuthError(error), code: error.code });
      throw error;
    }
  };

  const signInWithGoogle = async () => {
    requireAuthReady({ ok: Boolean(googleProvider) });
    return runSignIn(() => signInWithPopup(auth, googleProvider));
  };

  const signInWithApple = async () => {
    requireAuthReady({ ok: Boolean(appleProvider) });
    return runSignIn(() => signInWithPopup(auth, appleProvider));
  };

  const signInWithEmailPassword = async (email, password) => {
    requireAuthReady();
    return runSignIn(() =>
      signInWithEmailAndPassword(auth, String(email || '').trim(), password));
  };

  const registerWithEmailPassword = async (email, password, name = '') => {
    requireAuthReady();
    return runSignIn(async () => {
      const cred = await createUserWithEmailAndPassword(auth, String(email || '').trim(), password);
      const displayName = String(name || '').trim();
      if (displayName) {
        // Best-effort: nome de exibição na conta de auth. O perfil no Firestore
        // é criado pelo onAuthStateChanged; a vinculação por e-mail das
        // inscrições provisórias acontece lá, igual aos demais provedores.
        try {
          await fbUpdateProfile(cred.user, { displayName });
          await setDoc(
            doc(db, 'users', cred.user.uid),
            { full_name: displayName, platform_name: displayName, updated_at: serverTimestamp() },
            { merge: true },
          );
        } catch {
          // não bloqueia o cadastro se o nome não puder ser salvo agora
        }
      }
      return cred;
    });
  };

  const sendPasswordReset = async (email) => {
    requireAuthReady();
    return runSignIn(() => fbSendPasswordResetEmail(auth, String(email || '').trim()));
  };

  const signOut = async () => {
    await firebaseSignOut(auth);
    setUser(null);
    setUserProfile(null);
    setIsAuthenticated(false);
  };

  const updateUserProfile = async (updates) => {
    if (!user) throw new Error('No user logged in');
    const userDocRef = doc(db, 'users', user.uid);
    await setDoc(
      userDocRef,
      { ...updates, updated_at: serverTimestamp() },
      { merge: true },
    );
    await createAuditLog({
      action: 'user_profile_updated',
      actor: user,
      userId: user.uid,
      userName: updates.platform_name || userProfile?.platform_name || user.displayName || user.email,
      userEmail: user.email,
      details: { changed_fields: Object.keys(updates) },
    });
    await claimProvisionalRegistrationsForUser(user, { ...userProfile, ...updates }, { aliasEmails: updates.claim_alias_emails || userProfile?.claim_alias_emails });
    const nextProfile = { ...userProfile, ...updates };
    setUserProfile(nextProfile);
    // Reflete imediatamente as mudanças (inclusive privacidade) no diretório.
    await syncAthleteProfile(user, nextProfile);
  };

  const value = {
    user,
    userProfile,
    isAuthenticated,
    isLoadingAuth,
    authError,
    // Auth disponível quando o Firebase está configurado: e-mail/senha funciona
    // sem provedor OAuth; Google/Apple têm flags próprias para exibir os botões.
    isAuthAvailable: Boolean(auth && db),
    isGoogleAvailable: Boolean(auth && googleProvider && db),
    isAppleAvailable: Boolean(auth && appleProvider && db),
    authUnavailableReason: firebaseDisabledReason,
    signInWithGoogle,
    signInWithApple,
    signInWithEmailPassword,
    registerWithEmailPassword,
    sendPasswordReset,
    signOut,
    updateUserProfile,
    isPlatformAdmin: userProfile?.role === 'platform_admin',
    canCreatePools: userProfile?.role === 'platform_admin' || userProfile?.can_create_pools === true,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
