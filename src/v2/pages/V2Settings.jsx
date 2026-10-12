/**
 * V2Settings — Configurações da conta. Rota /configuracoes.
 *
 * Desde 2026-10-11 a tela é feita de GRUPOS com nome (Conta e privacidade ·
 * Tela e navegação · Região e avisos · Jogo e treino) e cada cartão é
 * COLAPSÁVEL (`SettingsSection`): nasce recolhido, e o cabeçalho diz como está
 * ("Automático", "3 cards: …", "2 categorias silenciadas") — abrir é para
 * mudar. Antes eram onze cartões abertos em sequência, cada um com o próprio
 * texto, e a tela lia como um paredão.
 *
 * Os links diretos continuam valendo e ABREM o cartão: `#notificacoes` (o
 * sino), `#pagina-inicial` (o "Personalizar" do início), `#menu-lateral`,
 * `#minha-regiao`, `#balanco-do-jogo`. Toda âncora
 * `data-dica` ficou no cartão.
 */

import React, { useState } from 'react';
import { Navigate, Link } from 'react-router-dom';
import { toast } from 'sonner';
import { User, Download, ShieldCheck, Bell, ChevronRight } from 'lucide-react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
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

import V2PushCard from '@/v2/components/settings/V2PushCard';
import SettingsSection, { SettingsGroup } from '@/v2/components/settings/SettingsSection';
import { ThemeSettingsCard } from '@/v2/components/theme/ThemeSwitcher';
import HomeCardsSettingsCard from '@/v2/components/home/cards/HomeCardsSettingsCard';
import SidebarSettingsCard from '@/v2/components/settings/SidebarSettingsCard';
import GamificationSettingsCard from '@/v2/components/gamification/GamificationSettingsCard';
import DebriefSettingsCard from '@/v2/components/training/debrief/DebriefSettingsCard';
import RegionSettingsCard from '@/v2/components/region/RegionSettingsCard';
import { useHashScroll } from '@/v2/ui/useHashScroll';
import DicasSettingsCard from '@/v2/components/dicas/DicasSettingsCard';

export default function V2Settings() {
  const enabled = true;
  const notifPrefsOn = true;
  const pushOn = true;
  const centralAvisosOn = true;
  const gamificacaoOn = true;
  const treinoOn = true;
  // `/configuracoes#pagina-inicial` (o link do "Personalizar" do início) e
  // `/configuracoes#minha-regiao` caem no cartão certo.
  useHashScroll();
  const { user, userProfile, updateUserProfile } = useAuth();
  const inscricoes = useMyRegistrations();
  const reservas = useMyBookings();
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

  async function exportData() {
    setBusy(true);
    try {
      // O treino e as metas são lidos só agora (e o código, baixado só agora):
      // ninguém paga por isso ao abrir as configurações. Com a flag desligada,
      // a exportação é a de sempre. Se o pedaço de código não baixar (aba
      // antiga depois de um deploy), o resto sai e o treino vai como faltando.
      let extra = { incomplete: [] };
      if (treinoOn) {
        try {
          const { collectTrainingExport } = await import('@/modules/training/services/trainingExportService');
          extra = await collectTrainingExport(user?.uid);
        } catch (_) {
          extra = { incomplete: ['Centro de Treino e metas'] };
        }
      }
      // Falha não é vazio: o que não carregou vai escrito no arquivo e no aviso.
      const incomplete = [
        ...(inscricoes.isSuccess ? [] : ['Inscrições em torneio']),
        ...(reservas.isSuccess ? [] : ['Reservas de quadra']),
        ...extra.incomplete,
      ];
      const pkg = buildDataExport({
        uid: user?.uid,
        profile: userProfile || {},
        registrations: inscricoes.data || [],
        bookings: reservas.data || [],
        goals: extra.goals,
        training: extra.training,
        incomplete,
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
      if (incomplete.length > 0) {
        toast.warning(`Exportado, mas ficou de fora: ${incomplete.join(', ')}. Tente de novo mais tarde para ter tudo.`);
      } else {
        toast.success('Seus dados foram exportados.');
      }
    } catch (err) {
      toast.error('Não foi possível exportar os dados.');
    } finally {
      setBusy(false);
    }
  }

  const silenciadas = NOTIFICATION_CATEGORIES
    .filter((cat) => cat.id !== 'training' || treinoOn)
    .filter((cat) => prefs[cat.id] === false).length;
  const resumoAvisos = silenciadas === 0
    ? 'Todas as categorias ligadas'
    : `${silenciadas} ${silenciadas === 1 ? 'categoria silenciada' : 'categorias silenciadas'}`;

  return (
    <div className="mx-auto max-w-[720px]">
      <V2PageIntro
        title="Configurações"
        subtitle="Cada cartão diz como está. Abra só o que você quer mudar."
      />

      <div className="space-y-8">
        <SettingsGroup title="Conta e privacidade" description="Quem você é na plataforma e o que ela guarda de você.">
          <V2Surface variant="compacto">
            <Link to="/perfil/editar" className="flex items-center gap-3">
              <User className="h-5 w-5 shrink-0 text-ink" aria-hidden="true" />
              <span className="min-w-0 flex-1">
                <span className="block text-base font-semibold text-ink">Conta</span>
                <span className="block text-xs text-gray-500">Perfil, foto, contato, nível e privacidade do contato.</span>
              </span>
              <ChevronRight className="h-5 w-5 shrink-0 text-gray-400" aria-hidden="true" />
            </Link>
          </V2Surface>

          <SettingsSection id="privacidade-e-dados" dica="config-dados" icon={ShieldCheck} title="Privacidade e dados (LGPD)" summary="Baixe uma cópia de tudo o que é seu">
            <p className="text-sm text-gray-500">
              {treinoOn
                ? 'Baixe uma cópia dos seus dados na plataforma (perfil, inscrições, reservas, metas e o seu treino: itens, diário, planos, envios, dúvidas e balanços dos jogos) em formato JSON.'
                : 'Baixe uma cópia dos seus dados na plataforma (perfil, inscrições e reservas) em formato JSON.'}
            </p>
            <div className="mt-3">
              <V2Button size="sm" onClick={exportData} disabled={busy}>
                <Download className="h-4 w-4" /> {busy ? 'Gerando…' : 'Baixar meus dados'}
              </V2Button>
            </div>
          </SettingsSection>
        </SettingsGroup>

        <SettingsGroup title="Tela e navegação" description="Como o PickleRush aparece para você. Fica salvo neste aparelho, na sua conta.">
          {/* Aparência: Claro, Escuro ou Automático. */}
          <ThemeSettingsCard />
          {/* Página inicial: os cards do início e a ordem. */}
          <HomeCardsSettingsCard />
          {/* Menu: os hubs da barra lateral e a ordem — padrão por papel, editável. */}
          <SidebarSettingsCard />
          {/* Dicas: ligar, desligar e abrir os guias. */}
          <DicasSettingsCard />
        </SettingsGroup>

        <SettingsGroup title="Região e avisos" description="De onde vem o que você vê, e por onde a plataforma fala com você.">
          {/* Minha região: de onde a plataforma mostra o que acontece. */}
          <RegionSettingsCard />

          {/* `/configuracoes#notificacoes`: o sino e a central levam direto para cá. */}
          <SettingsSection id="notificacoes" dica="config-notificacoes" icon={Bell} title="Notificações" summary={notifPrefsOn ? resumoAvisos : undefined}>
            {notifPrefsOn ? (
              <>
                <p className="text-sm text-gray-500">
                  Escolha quais categorias de notificação você quer ver. As silenciadas não aparecem no sino
                  {centralAvisosOn ? ' nem na central de notificações' : ''}, e não contam no número de não lidas.
                </p>
                <div className="mt-4 space-y-3">
                  {NOTIFICATION_CATEGORIES.filter((cat) => cat.id !== 'training' || treinoOn).map((cat) => (
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
                {savingPrefs && <p className="mt-3 text-xs text-gray-500">Salvando…</p>}
                {centralAvisosOn && (
                  <div className="mt-4">
                    <V2Button asChild variant="secondary" size="sm">
                      <Link to="/notificacoes">Ver todas as notificações</Link>
                    </V2Button>
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm text-gray-500">
                As notificações da plataforma aparecem no sino do topo. Preferências por canal chegam em breve.
              </p>
            )}
          </SettingsSection>

          {pushOn && <V2PushCard />}
        </SettingsGroup>

        <SettingsGroup title="Jogo e treino">
          {/* Gamificação: privacidade, interação e avisos, numa página própria. */}
          {gamificacaoOn && <GamificationSettingsCard />}
          {/* Balanço do jogo: cada pessoa liga para si. */}
          <DebriefSettingsCard />
        </SettingsGroup>
      </div>
    </div>
  );
}
