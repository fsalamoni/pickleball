import { useEffect, useState } from 'react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { watchMyCreatorRequest } from '@/modules/admin/services/adminService';
import { logger } from '@/core/lib/logger';

export function usePoolCreatorAuthorization() {
  const { user, canCreatePools, isPlatformAdmin } = useAuth();
  const [request, setRequest] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!user || canCreatePools || isPlatformAdmin) {
      setRequest(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    const unsubscribe = watchMyCreatorRequest(
      user.uid,
      (next) => {
        setRequest(next);
        setIsLoading(false);
      },
      (e) => {
        logger.error('usePoolCreatorAuthorization error:', e);
        setError(e.message);
        setIsLoading(false);
      },
    );

    return () => unsubscribe();
  }, [user, canCreatePools, isPlatformAdmin]);

  return { canCreatePools, isPlatformAdmin, request, isLoading, error };
}
