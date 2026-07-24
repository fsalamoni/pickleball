/**
 * PublicClub — vitrine pública do clube (flag club_public_page).
 *
 * Página sem login para clubes marcados como públicos: nome, local, descrição e
 * CTA "quero participar". Rota /c/:clubId. Se o clube não é público (ou a flag
 * está desligada), orienta a entrar na plataforma.
 */

import React from 'react';
import { useParams, Link, Navigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Building2, MapPin, Mail, Phone, Users } from 'lucide-react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useFeatureFlag } from '@/core/lib/FeatureFlagsContext';
import { FEATURE_FLAG } from '@/core/featureFlags';
import { getClub } from '@/modules/clubs/services/clubService';
import { useDocumentMeta } from '@/core/seo/useDocumentMeta';

export default function PublicClub() {
  const { clubId } = useParams();
  const publicOn = useFeatureFlag(FEATURE_FLAG.CLUB_PUBLIC_PAGE);
  const { isAuthenticated } = useAuth();
  const { data: club, isLoading } = useQuery({
    queryKey: ['public-club', clubId],
    queryFn: () => getClub(clubId),
    enabled: publicOn && !!clubId,
  });

  useDocumentMeta({
    title: club?.name,
    description: club?.description || (club ? `Clube de pickleball${club.city ? ` em ${club.city}` : ''}.` : ''),
  }, publicOn && !!club);

  if (!publicOn) return <Navigate to="/login" replace />;

  const location = club ? [club.city, club.state].filter(Boolean).join(' / ') : '';
  const isPublic = club && club.is_public === true;

  return (
    <div className="min-h-screen bg-paper">
      <div className="mx-auto max-w-[720px] px-4 py-10">
        {isLoading ? (
          <p className="py-20 text-center text-gray-400">Carregando…</p>
        ) : !isPublic ? (
          <div className="rounded-4xl border border-gray-100 bg-paper-pure p-8 text-center">
            <h1 className="font-display text-2xl font-bold text-ink">Clube não disponível publicamente</h1>
            <p className="mt-2 text-sm text-gray-500">Entre na plataforma para ver os clubes.</p>
            <Link to="/login" className="mt-4 inline-flex rounded-full bg-ink px-6 py-3 text-sm font-bold text-white">Entrar</Link>
          </div>
        ) : (
          <div className="overflow-hidden rounded-4xl bg-mesh p-8 shadow-organic">
            <div className="flex items-start gap-4">
              {club.logo_url
                ? <img src={club.logo_url} alt={club.name} className="h-16 w-16 rounded-2xl object-cover" />
                : <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 text-white"><Building2 className="h-7 w-7" /></span>}
              <div className="min-w-0">
                <h1 className="font-display text-3xl font-bold text-white">{club.name}</h1>
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-300">
                  {location && <span className="inline-flex items-center gap-1"><MapPin className="h-4 w-4" /> {location}</span>}
                  <span className="inline-flex items-center gap-1"><Users className="h-4 w-4" /> {club.member_count || 0} membro(s)</span>
                </div>
              </div>
            </div>
            {club.description && <p className="mt-5 whitespace-pre-wrap text-sm leading-7 text-gray-200">{club.description}</p>}
            <div className="mt-5 flex flex-wrap gap-2 text-xs text-gray-300">
              {club.home_venue && <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1"><Building2 className="h-3.5 w-3.5" /> {club.home_venue}</span>}
              {club.contact_email && <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1"><Mail className="h-3.5 w-3.5" /> {club.contact_email}</span>}
              {club.contact_phone && <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1"><Phone className="h-3.5 w-3.5" /> {club.contact_phone}</span>}
            </div>
            <div className="mt-6">
              <Link to={isAuthenticated ? `/clubes/${club.id}` : '/login'}
                className="inline-flex rounded-full bg-acid px-6 py-3 text-sm font-bold text-ink">
                {isAuthenticated ? 'Ver clube e participar' : 'Entrar para participar'}
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
