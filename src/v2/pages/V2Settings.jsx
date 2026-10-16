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
import { User, Download, ShieldCheck, Bell, ChevronRight, Store } from 'lucide-react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useMyRegistrations } from '@/modules/tournament/hooks/useTournament';
import { useMyBookings } from '@/modules/arenas/hooks/useBookings';
import { buildDataExport, dataExportFilename } from '@/modules/athletes/domain/dataExport';
import {
  NOTIFICATION_CATEGORIES,
  normalizeNotificationPrefs,
} from '@/modules/notifications/domain/preferences';
import {
  V2Button, V2PageIntro, V2Surface, V2Toggle, V2Page,
} from '@/v2/ui/primitives';

import V2PushCard from '@/v2/components/settings/V2PushCard';
import MessagingSettingsCard from '@/v2/components/settings/MessagingSettingsCard';
import SettingsSection, { SettingsGroup } from '@/v2/components/settings/SettingsSection';
import { IdiomaSettingsCard } from '@/v2/components/idioma/LanguageSwitcher';
import { ThemeSettingsCard } from '@/v2/components/theme/ThemeSwitcher';
import HomeCardsSettingsCard from '@/v2/components/home/cards/HomeCardsSettingsCard';
import SidebarSettingsCard from '@/v2/components/settings/SidebarSettingsCard';
import GamificationSettingsCard from '@/v2/components/gamification/GamificationSettingsCard';
import DebriefSettingsCard from '@/v2/components/training/debrief/DebriefSettingsCard';
import RegionSettingsCard from '@/v2/components/region/RegionSettingsCard';
import { useHashScroll } from '@/v2/ui/useHashScroll';
import DicasSettingsCard from '@/v2/components/dicas/DicasSettingsCard';
import { t, tn } from '@/core/i18n';
import { useFeatureFlag } from '@/core/lib/FeatureFlagsContext';
import { FEATURE_FLAG } from '@/core/featureFlags';

export default function V2Settings() {
  const enabled = true;
  const notifPrefsOn = true;
  const pushOn = true;
  const centralAvisosOn = true;
  const gamificacaoOn = true;
  const treinoOn = true;
  const mercadoOn = useFeatureFlag(FEATURE_FLAG.MARKETPLACE);
  // Categoria de aviso de funcionalidade desligada não aparece (nem conta).
  const categoriaVisivel = (cat) => (cat.id !== 'training' || treinoOn) && (cat.id !== 'market' || mercadoOn);
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
      toast.success(t('Preferências salvas.'));
    } catch (err) {
      toast.error(t('Não foi possível salvar as preferências.'));
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
          extra = { incomplete: [t('Centro de Treino e metas')] };
        }
      }
      // O Mercado entra sempre (com a flag desligada, o que já foi vendido ou
      // comprado continua sendo da pessoa).
      let mercado = { market: undefined, incomplete: [] };
      try {
        const { collectMarketExport } = await import('@/modules/marketplace/services/marketExportService');
        mercado = await collectMarketExport(user?.uid);
      } catch (_) {
        mercado = { market: undefined, incomplete: [t('Mercado')] };
      }
      // O que saiu por e-mail, WhatsApp e SMS (registro dos últimos 90 dias).
      let mensagens;
      let mensagensFalhou = false;
      try {
        const { listMyMessageLog } = await import('@/modules/messaging/services/messagingService');
        mensagens = await listMyMessageLog(user?.uid);
      } catch (_) {
        mensagensFalhou = true;
      }
      // Falha não é vazio: o que não carregou vai escrito no arquivo e no aviso.
      const incomplete = [
        ...(mensagensFalhou ? [t('E-mails e mensagens enviados')] : []),
        ...(inscricoes.isSuccess ? [] : [t('Inscrições em torneio')]),
        ...(reservas.isSuccess ? [] : [t('Reservas de quadra')]),
        ...extra.incomplete,
        ...mercado.incomplete,
      ];
      const pkg = buildDataExport({
        uid: user?.uid,
        profile: userProfile || {},
        registrations: inscricoes.data || [],
        bookings: reservas.data || [],
        goals: extra.goals,
        training: extra.training,
        market: mercado.market,
        messages: mensagens,
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
        toast.warning(t('Exportado, mas ficou de fora: {itens}. Tente de novo mais tarde para ter tudo.', { itens: incomplete.join(', ') }));
      } else {
        toast.success(t('Seus dados foram exportados.'));
      }
    } catch (err) {
      toast.error(t('Não foi possível exportar os dados.'));
    } finally {
      setBusy(false);
    }
  }

  const silenciadas = NOTIFICATION_CATEGORIES
    .filter(categoriaVisivel)
    .filter((cat) => prefs[cat.id] === false).length;
  const resumoAvisos = silenciadas === 0
    ? t('Todas as categorias ligadas')
    : tn(silenciadas, '{n} categoria silenciada', '{n} categorias silenciadas');

  return (
    <V2Page>
      <V2PageIntro
        title={t('Configurações')}
        subtitle={t('Cada cartão diz como está. Abra só o que você quer mudar.')}
      />

      <div className="space-y-8">
        <SettingsGroup title={t('Conta e privacidade')} description={t('Quem você é na plataforma e o que ela guarda de você.')}>
          <V2Surface variant="compacto">
            <Link to="/perfil/editar" className="flex items-center gap-3">
              <User className="h-5 w-5 shrink-0 text-ink" aria-hidden="true" />
              <span className="min-w-0 flex-1">
                <span className="block text-base font-semibold text-ink">{t('Conta')}</span>
                <span className="block text-xs text-gray-500">{t('Perfil, foto, contato, nível e privacidade do contato.')}</span>
              </span>
              <ChevronRight className="h-5 w-5 shrink-0 text-gray-400" aria-hidden="true" />
            </Link>
          </V2Surface>

          <SettingsSection id="privacidade-e-dados" dica="config-dados" icon={ShieldCheck} title={t('Privacidade e dados (LGPD)')} summary={t('Baixe uma cópia de tudo o que é seu')}>
            <p className="text-sm text-gray-500">
              {treinoOn
                ? t('Baixe uma cópia dos seus dados na plataforma (perfil, inscrições, reservas, metas e o seu treino: itens, diário, planos, envios, dúvidas e balanços dos jogos) em formato JSON.')
                : t('Baixe uma cópia dos seus dados na plataforma (perfil, inscrições e reservas) em formato JSON.')}
              {mercadoOn && <> {t('Do Mercado: anúncios, pedidos, favoritos e buscas salvas.')}</>}
            </p>
            <div className="mt-3">
              <V2Button size="sm" onClick={exportData} disabled={busy}>
                <Download className="h-4 w-4" /> {busy ? t('Gerando…') : t('Baixar meus dados')}
              </V2Button>
            </div>
          </SettingsSection>
        </SettingsGroup>

        <SettingsGroup title={t('Tela e navegação')} description={t('Como o PickleRush aparece para você. Fica salvo neste aparelho, na sua conta.')}>
          {/* Aparência: Claro, Escuro ou Automático. */}
          <ThemeSettingsCard />
          {/* Idioma: português, inglês, espanhol (flag multi_language). */}
          <IdiomaSettingsCard />
          {/* Página inicial: os cards do início e a ordem. */}
          <HomeCardsSettingsCard />
          {/* Menu: os hubs da barra lateral e a ordem — padrão por papel, editável. */}
          <SidebarSettingsCard />
          {/* Dicas: ligar, desligar e abrir os guias. */}
          <DicasSettingsCard />
        </SettingsGroup>

        <SettingsGroup title={t('Região e avisos')} description={t('De onde vem o que você vê, e por onde a plataforma fala com você.')}>
          {/* Minha região: de onde a plataforma mostra o que acontece. */}
          <RegionSettingsCard />

          {/* `/configuracoes#notificacoes`: o sino e a central levam direto para cá. */}
          <SettingsSection id="notificacoes" dica="config-notificacoes" icon={Bell} title={t('Notificações')} summary={notifPrefsOn ? resumoAvisos : undefined}>
            {notifPrefsOn ? (
              <>
                <p className="text-sm text-gray-500">
                  {centralAvisosOn
                    ? t('Escolha quais categorias de notificação você quer ver. As silenciadas não aparecem no sino nem na central de notificações, e não contam no número de não lidas.')
                    : t('Escolha quais categorias de notificação você quer ver. As silenciadas não aparecem no sino, e não contam no número de não lidas.')}
                </p>
                <div className="mt-4 space-y-3">
                  {NOTIFICATION_CATEGORIES.filter(categoriaVisivel).map((cat) => (
                    <div key={cat.id} className="rounded-3xl border border-gray-100 bg-paper-pure p-4 shadow-organic-sm">
                      <V2Toggle
                        id={`notif-${cat.id}`}
                        checked={prefs[cat.id] !== false}
                        onChange={(next) => toggleCategory(cat.id, next)}
                        label={t(cat.label)}
                        hint={t(cat.description)}
                      />
                    </div>
                  ))}
                </div>
                {savingPrefs && <p className="mt-3 text-xs text-gray-500">{t('Salvando…')}</p>}
                {centralAvisosOn && (
                  <div className="mt-4">
                    <V2Button asChild variant="secondary" size="sm">
                      <Link to="/notificacoes">{t('Ver todas as notificações')}</Link>
                    </V2Button>
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm text-gray-500">
                {t('As notificações da plataforma aparecem no sino do topo. Preferências por canal chegam em breve.')}
              </p>
            )}
          </SettingsSection>

          {pushOn && <V2PushCard />}

          {/* `/configuracoes#email-e-celular` (flag `external_messaging`): os e-mails levam direto para cá. */}
          <MessagingSettingsCard />

          {/* Mercado (flag `marketplace`): os atalhos do que se configura lá. */}
          {mercadoOn && (
            <SettingsSection id="mercado" dica="config-mercado" icon={Store} title={t('Mercado')} summary={t('Compras, vendas e alertas')}>
              <p className="text-sm text-gray-500">
                {t('O que você ajusta no Mercado: os avisos de compras e vendas, a chave Pix para receber, as buscas salvas e os termos.')}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <V2Button asChild variant="secondary" size="sm"><Link to="/configuracoes#notificacoes">{t('Avisos do Mercado')}</Link></V2Button>
                <V2Button asChild variant="secondary" size="sm"><Link to="/mercado/vender?aba=pix">{t('Recebimento (Pix)')}</Link></V2Button>
                <V2Button asChild variant="secondary" size="sm"><Link to="/mercado/buscas">{t('Buscas salvas e alertas')}</Link></V2Button>
                <V2Button asChild variant="ghost" size="sm"><Link to="/legal/termos-mercado">{t('Termos do Mercado')}</Link></V2Button>
              </div>
            </SettingsSection>
          )}
        </SettingsGroup>

        <SettingsGroup title={t('Jogo e treino')}>
          {/* Gamificação: privacidade, interação e avisos, numa página própria. */}
          {gamificacaoOn && <GamificationSettingsCard />}
          {/* Balanço do jogo: cada pessoa liga para si. */}
          <DebriefSettingsCard />
        </SettingsGroup>
      </div>
    </V2Page>
  );
}
