/**
 * V2Settings — Configurações da conta (flag settings_page).
 *
 * Reúne atalhos de conta e a exportação de dados pessoais (LGPD) em JSON.
 * Rota /configuracoes. Aditivo — desligada a flag, redireciona ao perfil.
 */

import React, { useState } from 'react';
import { Navigate, Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Settings, User, Download, ShieldCheck, Bell } from 'lucide-react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useFeatureFlag } from '@/core/lib/FeatureFlagsContext';
import { FEATURE_FLAG } from '@/core/featureFlags';
import { useMyRegistrations } from '@/modules/tournament/hooks/useTournament';
import { useMyBookings } from '@/modules/arenas/hooks/useBookings';
import { buildDataExport, dataExportFilename } from '@/modules/athletes/domain/dataExport';
import {
  NOTIFICATION_CATEGORIES,
  normalizeNotificationPrefs,
} from '@/modules/notifications/domain/preferences';
import {
  V2Button, V2PageIntro, V2Surface, V2Toggle,
} from '@/v2/ui/primitives';

export default function V2Settings() {
  const enabled = useFeatureFlag(FEATURE_FLAG.SETTINGS_PAGE);
  const notifPrefsOn = useFeatureFlag(FEATURE_FLAG.NOTIFICATION_PREFS);
  const { user, userProfile, updateUserProfile } = useAuth();
  const { data: registrations = [] } = useMyRegistrations();
  const { data: bookings = [] } = useMyBookings();
  const [busy, setBusy] = useState(false);
  const [savingPrefs, setSavingPrefs] = useState(false);

  const prefs = normalizeNotificationPrefs(userProfile?.notification_prefs);

  if (!enabled) return <Navigate to="/perfil" replace />;

  async function toggleCategory(categoryId, next) {
    setSavingPrefs(true);
    const updated = { ...prefs, [categoryId]: next };
    try {
      await updateUserProfile({ notification_prefs: updated });
      toast.success('Preferências salvas.');
    } catch (err) {
      toast.error('Não foi possível salvar as preferências.');
    } finally {
      setSavingPrefs(false);
    }
  }

  function exportData() {
    setBusy(true);
    try {
      const pkg = buildDataExport({
        uid: user?.uid,
        profile: userProfile || {},
        registrations,
        bookings,
      });
      const blob = new Blob([JSON.stringify(pkg, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = dataExportFilename(userProfile?.platform_name || userProfile?.full_name);
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Seus dados foram exportados.');
    } catch (err) {
      toast.error('Não foi possível exportar os dados.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-[720px]">
      <V2PageIntro title="Configurações" subtitle="Conta, privacidade e seus dados." />

      <div className="space-y-4">
        <V2Surface>
          <div className="flex items-center gap-2">
            <User className="h-5 w-5 text-ink" />
            <h2 className="font-display text-lg font-bold text-ink">Conta</h2>
          </div>
          <p className="mt-1 text-sm text-gray-500">Edite seu perfil, foto e informações de contato.</p>
          <div className="mt-3">
            <V2Button asChild variant="secondary" size="sm"><Link to="/perfil/editar">Editar perfil</Link></V2Button>
          </div>
        </V2Surface>

        <V2Surface>
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-ink" />
            <h2 className="font-display text-lg font-bold text-ink">Notificações</h2>
          </div>
          {notifPrefsOn ? (
            <>
              <p className="mt-1 text-sm text-gray-500">
                Escolha quais categorias de notificação aparecem no sino do topo.
              </p>
              <div className="mt-4 space-y-3">
                {NOTIFICATION_CATEGORIES.map((cat) => (
                  <div key={cat.id} className="rounded-3xl border border-gray-100 bg-paper-pure p-4 shadow-organic-sm">
                    <V2Toggle
                      id={`notif-${cat.id}`}
                      checked={prefs[cat.id] !== false}
                      onChange={(next) => toggleCategory(cat.id, next)}
                      label={cat.label}
                      hint={cat.description}
                    />
                  </div>
                ))}
              </div>
              {savingPrefs && <p className="mt-3 text-xs text-gray-400">Salvando…</p>}
            </>
          ) : (
            <p className="mt-1 text-sm text-gray-500">
              As notificações da plataforma aparecem no sino do topo. Preferências por canal chegam em breve.
            </p>
          )}
        </V2Surface>

        <V2Surface>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-ink" />
            <h2 className="font-display text-lg font-bold text-ink">Privacidade e dados (LGPD)</h2>
          </div>
          <p className="mt-1 text-sm text-gray-500">
            Baixe uma cópia dos seus dados na plataforma (perfil, inscrições e reservas) em formato JSON.
          </p>
          <div className="mt-3">
            <V2Button size="sm" onClick={exportData} disabled={busy}>
              <Download className="h-4 w-4" /> {busy ? 'Gerando…' : 'Baixar meus dados'}
            </V2Button>
          </div>
        </V2Surface>
      </div>
    </div>
  );
}
