import React from 'react';
import { toast } from 'sonner';
import { V2Button, V2ErrorState, V2Select, V2Skeleton, V2Surface, V2Toggle } from '@/v2/ui/primitives';
import { useGamificationPrefs } from '@/modules/progression/hooks/useGamificationPrefs';
import { useUserAchievementsV2 } from '@/modules/achievements/hooks/useUserAchievementsV2';
import { getAchievementV2ById } from '@/modules/achievements/domain/achievementsV2';
import TermHint from './TermHint';

function Secao({ id, titulo, descricao, term, dica, children }) {
  return (
    <V2Surface id={id} data-dica={dica} className="scroll-mt-6 space-y-4">
      <div>
        <h2 className="flex items-center gap-1 font-display text-lg font-bold text-ink">{titulo}{term && <TermHint term={term} />}</h2>
        {descricao && <p className="mt-0.5 text-sm text-gray-500">{descricao}</p>}
      </div>
      <div className="space-y-4">{children}</div>
    </V2Surface>
  );
}

/**
 * As preferências da gamificação da pessoa. Cada interruptor responde na hora
 * (otimista) e grava no banco — o servidor também respeita: a função da
 * temporada não põe no placar quem pediu para ficar de fora.
 *
 * @param {{ uid: string }} props
 */
export default function GamificationPreferences({ uid, isModuleOn = () => true }) {
  const { prefs, loaded, error, update } = useGamificationPrefs(uid, !!uid);
  const { unlocked } = useUserAchievementsV2(uid, !!uid);

  if (!loaded) return <V2Skeleton className="h-72 rounded-4xl" />;
  if (error && !prefs) return <V2ErrorState title="Não deu para carregar suas preferências" />;

  const set = (secao, campo) => async (valor) => {
    const r = await update({ [secao]: { [campo]: valor } });
    if (!r) toast.error('Não foi possível salvar agora. Tente de novo.');
  };

  const titulos = unlocked
    .map((u) => getAchievementV2ById(u.achievementId))
    .filter(Boolean)
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));

  return (
    <div className="space-y-5" data-testid="gamification-preferences">
      <Secao id="privacidade" dica="prefs-privacidade" titulo="Privacidade" term="privacidade" descricao="Você decide o que os outros veem. A regra vale no servidor, não só na tela.">
        {isModuleOn('hall_of_fame') && (
          <V2Toggle
            id="pref-hall" checked={prefs.privacy.showInHallOfFame} onChange={set('privacy', 'showInHallOfFame')}
            label="Aparecer no placar público"
            hint="Seu nome e foto entram na temporada e no Hall da Fama. Desligado: você continua ranqueando e recebendo os prêmios, mas ninguém vê."
          />
        )}
        <V2Toggle
          id="pref-profile" checked={prefs.privacy.showOnPublicProfile} onChange={set('privacy', 'showOnPublicProfile')}
          label="Mostrar tier e conquistas no meu perfil"
          hint="Quem abrir o seu perfil vê o tier e as conquistas. Desligado, a página de conquistas públicas fica indisponível."
        />
      </Secao>

      <Secao dica="prefs-interacao" titulo="Interação com outros atletas" descricao="Tudo isto tem saída em um toque, sem explicação.">
        {isModuleOn('duels') && <V2Toggle id="pref-duels" checked={prefs.social.acceptDuels} onChange={set('social', 'acceptDuels')} label="Participar do duelo da semana" hint="O servidor só emparelha quem aceita." />}
        {isModuleOn('match_reviews') && <V2Toggle id="pref-reviews" checked={prefs.social.acceptReviews} onChange={set('social', 'acceptReviews')} label="Receber avaliações de quem jogou comigo" hint="Você vê só a média e os elogios; nunca quem deu qual nota." />}
        {isModuleOn('partner_letters') && <V2Toggle id="pref-letters" checked={prefs.social.acceptLetters} onChange={set('social', 'acceptLetters')} label="Receber cartas de parceiros" hint="Mensagens curtas de gratidão, anônimas por padrão. Você pode denunciar ou apagar." />}
      </Secao>

      <Secao dica="prefs-avisos" titulo="Avisos" descricao="Só o que você quer receber no sino.">
        {isModuleOn('weekly_review') && <V2Toggle id="pref-weekly" checked={prefs.notifications.weeklyReview} onChange={set('notifications', 'weeklyReview')} label="Resumo da semana (segunda-feira)" />}
        {isModuleOn('duels') && <V2Toggle id="pref-nduels" checked={prefs.notifications.duels} onChange={set('notifications', 'duels')} label="Duelo da semana" hint="Quando você for emparelhado e quando o duelo acabar." />}
        {isModuleOn('challenges') && <V2Toggle id="pref-nchal" checked={prefs.notifications.challengeResults} onChange={set('notifications', 'challengeResults')} label="Resultado dos desafios" />}
      </Secao>

      <Secao dica="prefs-aparencia" titulo="Como aparece para mim">
        {isModuleOn('celebrations') && <V2Toggle id="pref-cele" checked={prefs.display.celebrations} onChange={set('display', 'celebrations')} label="Comemorar marcos" hint="Aviso curto quando você sobe de tier, completa 100 jogos, emenda semanas…" />}
        <div>
          <label htmlFor="pref-title" className="mb-1 block text-sm font-semibold text-ink">Título ao lado do meu nome</label>
          <V2Select id="pref-title" value={prefs.display.title || ''} onChange={(e) => set('display', 'title')(e.target.value || null)}>
            <option value="">O meu tier (padrão)</option>
            {titulos.map((a) => <option key={a.id} value={a.id}>{a.icon} {a.name}</option>)}
          </V2Select>
          {titulos.length === 0 && <p className="mt-1 text-xs text-gray-400">Quando você desbloquear conquistas, poderá escolher uma como título.</p>}
        </div>
        {isModuleOn('onboarding') && prefs.onboarding.dismissed && (
          <V2Button variant="secondary" size="sm" onClick={() => set('onboarding', 'dismissed')(false)}>Mostrar os primeiros passos de novo</V2Button>
        )}
      </Secao>
    </div>
  );
}
