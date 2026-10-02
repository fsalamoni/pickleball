import React from 'react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import IssuerChallengesManager from '@/v2/components/gamification/issuer/IssuerChallengesManager';
import IssuerRewardsManager from '@/v2/components/gamification/issuer/IssuerRewardsManager';
import AdminGamificationConfig from './AdminGamificationConfig';
import AdminGamificationIntegrity from './AdminGamificationIntegrity';
import AdminGamificationMetrics from './AdminGamificationMetrics';

const PLATAFORMA = { type: 'platform', id: 'platform', name: 'PickleRush' };

/** Uma porta só para as cinco telas do admin da gamificação (a aba decide qual). */
export default function AdminGamificationPanel({ tab }) {
  const { user } = useAuth();
  const actor = { uid: user?.uid, email: user?.email, displayName: user?.displayName };
  if (tab === 'gam-config') return <AdminGamificationConfig />;
  if (tab === 'gam-challenges') return <IssuerChallengesManager issuer={PLATAFORMA} actor={actor} />;
  if (tab === 'gam-rewards') return <IssuerRewardsManager issuer={PLATAFORMA} actor={actor} />;
  if (tab === 'gam-integrity') return <AdminGamificationIntegrity />;
  if (tab === 'gam-metrics') return <AdminGamificationMetrics />;
  return null;
}
