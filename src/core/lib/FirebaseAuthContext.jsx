import React, { createContext, useState, useContext, useEffect } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, googleProvider, db, firebaseDisabledReason } from '@/core/config/firebase';
import { logger } from '@/core/lib/logger';
import { createAuditLog } from '@/core/services/auditService';
import { claimProvisionalRegistrationsForUser } from '@/modules/tournament/services/registrationService';
import { syncAthleteProfile } from '@/modules/athletes/services/athleteService';

const AuthContext = createContext(null);
const PLATFORM_OWNER_EMAIL = 'fsalamoni@gmail.com';

function isPlatformOwnerEmail(email) {
  return String(email || '').toLowerCase() === PLATFORM_OWNER_EMAIL;
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
            await claimProvisionalRegistrationsForUser(firebaseUser, mergedProfile);
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
            await claimProvisionalRegistrationsForUser(firebaseUser, newProfile);
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

  const signInWithGoogle = async () => {
    if (!auth || !googleProvider) {
      const error = {
        type: 'signin_error',
        message: firebaseDisabledReason || 'Login indisponível neste ambiente.',
        code: 'auth/configuration-missing',
      };
      setAuthError(error);
      throw new Error(error.message);
    }

    try {
      setAuthError(null);
      const result = await signInWithPopup(auth, googleProvider);
      return result;
    } catch (error) {
      let userMessage = 'Erro ao fazer login com Google.';
      if (error.code === 'auth/popup-closed-by-user') userMessage = 'Login cancelado. Tente novamente.';
      else if (error.code === 'auth/popup-blocked') userMessage = 'Pop-up bloqueado pelo navegador.';
      else if (error.code === 'auth/network-request-failed') userMessage = 'Erro de conexão. Verifique sua internet.';
      else if (error.code === 'auth/operation-not-supported-in-this-environment') userMessage = 'Seu navegador não suporta este login. Tente abrir em outro navegador.';
      else if (error.code === 'auth/web-storage-unsupported') userMessage = 'Seu navegador bloqueou o armazenamento necessário para entrar.';
      else if (error.code === 'auth/unauthorized-domain') userMessage = 'Domínio não autorizado.';
      setAuthError({ type: 'signin_error', message: userMessage, code: error.code });
      throw error;
    }
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
    await claimProvisionalRegistrationsForUser(user, { ...userProfile, ...updates });
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
    isAuthAvailable: Boolean(auth && googleProvider && db),
    authUnavailableReason: firebaseDisabledReason,
    signInWithGoogle,
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
