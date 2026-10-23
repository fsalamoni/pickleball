/**
 * A vitrine do perfil (o cartão com foto, nome, chips e os números do
 * ranking). É a MESMA peça no perfil de sempre e na seção "Perfil" da Minha
 * área — quem muda é só de onde vem `me` (a linha do ranking nacional).
 *
 * `editDica`: a âncora das dicas fica num botão só por tela. Na Minha área ela
 * mora no cabeçalho, que aparece em toda seção; aqui fica sem.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { Award, Hash, MapPin, Medal, Pencil, User } from 'lucide-react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { genderLabel } from '@/modules/athletes/domain/constants';
import { V2Avatar, V2Button, V2Surface, PAGE_TITLE } from '@/v2/ui/primitives';
import V2DuprRatingBadge from '@/v2/components/rating/V2DuprRatingBadge';
import { useDuprMode } from '@/modules/rating/hooks/useDuprMode';
import { memberSince } from '@/modules/athletes/domain/userArea';
import { t } from '@/core/i18n';

export function MiniStat({ label, value }) {
  return (
    <V2Surface variant="compacto" className="p-5 text-center">
      <p className="font-display text-3xl font-bold text-ink">{value}</p>
      <p className="mt-1 text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>
    </V2Surface>
  );
}

export default function ProfileShowcase({ me: meRanking, editDica }) {
  const { user, userProfile } = useAuth();
  // Com o DUPR oficial valendo, os números do rating próprio saem; o selo
  // (`V2DuprRatingBadge`) passa a mostrar o rating do DUPR.
  const { ownRatingOff } = useDuprMode();
  const me = ownRatingOff ? null : meRanking;

  const name = userProfile?.platform_name || user?.displayName || 'Atleta';
  const photo = userProfile?.photo_url || user?.photoURL || '';
  const location = [userProfile?.city, userProfile?.state].filter(Boolean).join(', ');
  const year = memberSince(userProfile);

  // Rating fica por ÚLTIMO para ficar lado a lado com o selo "Nível 2.0–8.0"
  // (renderizado logo após os chips).
  const chips = [
    genderLabel(userProfile?.gender) ? { icon: User, label: genderLabel(userProfile.gender) } : null,
    location ? { icon: MapPin, label: location } : null,
    userProfile?.dupr_id ? { icon: Hash, label: `DUPR ${userProfile.dupr_id}` } : null,
    me ? { icon: Medal, label: t('Rating {n}', { n: me.rating }), tone: 'acid' } : (userProfile?.level ? { icon: Award, label: userProfile.level } : null),
  ].filter(Boolean);

  return (
    <>
      <V2Surface className="overflow-hidden">
        <div className="relative h-56 bg-mesh">
          <div className="absolute inset-0 bg-gradient-to-t from-paper-pure to-transparent" />
        </div>

        <div className="relative px-6 pb-8 sm:px-8">
          <div className="-mt-16 mb-6 flex flex-col items-center gap-6 sm:flex-row sm:items-end sm:justify-between">
            <div className="rounded-full border-8 border-paper-pure bg-paper-pure shadow-md">
              <V2Avatar name={name} photoUrl={photo} size="xl" className="h-32 w-32 text-4xl" />
            </div>
            <div className="flex w-full gap-3 sm:w-auto">
              <V2Button asChild variant="subtle" className="flex-1 sm:flex-none">
                <Link to="/perfil/editar" data-dica={editDica}><Pencil className="h-4 w-4" /> {t('Editar perfil')}</Link>
              </V2Button>
              {me && (
                <V2Button asChild className="flex-1 sm:flex-none">
                  <Link to="/ranking">{t('Ver no ranking')}</Link>
                </V2Button>
              )}
            </div>
          </div>

          <div className="text-center sm:text-left">
            <h1 className={PAGE_TITLE}>{name}</h1>
            <p className="mt-1 font-medium text-gray-500">
              {[location, year ? t('Membro desde {ano}', { ano: year }) : null].filter(Boolean).join(' • ') || t('Complete seu perfil para aparecer no diretório')}
            </p>

            {chips.length > 0 && (
              <div className="mt-6 flex flex-wrap justify-center gap-3 sm:justify-start">
                {chips.map((chip, i) => {
                  const Icon = chip.icon;
                  return (
                    <div
                      key={i}
                      className={`flex items-center gap-2 rounded-2xl border px-4 py-2 text-sm font-semibold ${
                        chip.tone === 'acid' ? 'border-acid/40 bg-acid/15 text-ink' : 'border-gray-100 bg-paper text-gray-600'
                      }`}
                    >
                      <Icon className="h-4 w-4" /> {chip.label}
                    </div>
                  );
                })}
                {/* Nível 2.0–8.0 (ranking estilo DUPR) — auto-oculto se a flag
                    estiver off ou o atleta ainda não tiver rating calculado. */}
                <V2DuprRatingBadge uid={user?.uid} />
              </div>
            )}
          </div>
        </div>
      </V2Surface>

      {me && (
        <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <MiniStat label={t('Posição')} value={`${me.position}º`} />
          <MiniStat label={t('Rating')} value={me.rating} />
          <MiniStat label={t('Vitórias')} value={me.wins} />
          <MiniStat label={t('Jogos')} value={me.games} />
        </div>
      )}
    </>
  );
}
