/**
 * SEU AVATAR (`/avatar`, flag `avatar_creator`, docs/58).
 *
 * O estúdio desenha; esta página salva: as duas imagens (rosto e corpo
 * inteiro) vão para `uploads/{uid}/avatar/` e o cadastro ganha `avatar`
 * (receita + endereços). "Usar como foto do perfil" troca o `photo_url` — e é
 * isso que leva o avatar a toda a plataforma (ranking, jogos, clubes…) sem
 * mexer em nenhuma outra tela. A foto anterior fica guardada para voltar.
 *
 * Com a flag DESLIGADA quem já tem avatar como foto ainda consegue voltar
 * para a foto de antes (nada fica preso a uma funcionalidade fechada).
 */
import React, { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Check, ImageOff, Loader2, RotateCcw, Trash2 } from 'lucide-react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useFeatureFlags } from '@/core/lib/FeatureFlagsContext';
import { FEATURE_FLAG } from '@/core/featureFlags';
import { t } from '@/core/i18n';
import { V2BackLink, V2Button, V2Page, V2PageIntro, V2Skeleton, V2Surface, V2Toggle } from '@/v2/ui/primitives';
import { useLiveBrandPaddles } from '@/modules/avatar/hooks/useAvatarCatalog';
import { DEFAULT_RECIPE, normalizeRecipe, sameRecipe } from '@/modules/avatar/domain/recipe.js';
import {
  avatarRemoveUpdate, avatarRestorePhotoUpdate, avatarSaveUpdate, avatarUseAsPhotoUpdate, photoIsAvatar,
} from '@/modules/avatar/domain/profileAvatar.js';
import { renderAvatarBlob } from '@/modules/avatar/services/avatarExport.js';
import { releaseSnapshots } from '@/modules/avatar/services/avatarSnapshots.js';
import { uploadAvatarImages } from '@/modules/avatar/services/avatarService.js';

const AvatarStudio = lazy(() => import('@/v2/components/avatar/AvatarStudio'));

function Carregando() {
  return (
    <div className="grid gap-6 lg:grid-cols-[5fr_7fr]">
      <V2Skeleton className="h-[40vh] min-h-[260px] rounded-4xl lg:aspect-[34/52] lg:h-auto lg:max-h-[70vh]" />
      <V2Skeleton className="h-96 rounded-4xl" />
    </div>
  );
}

/** Ações sobre o avatar JÁ salvo (voltar para a foto, usar de novo, apagar). */
function SavedAvatarActions({ profile, busy, run }) {
  const [confirmRemove, setConfirmRemove] = useState(false);
  const a = profile?.avatar;
  if (!a?.url) return null;
  const isPhoto = photoIsAvatar(profile);
  return (
    <div className="flex flex-wrap gap-2">
      {isPhoto ? (
        <V2Button variant="ghost" size="sm" disabled={busy} onClick={() => run(avatarRestorePhotoUpdate(profile), a.photo_backup ? t('A foto de antes voltou.') : t('O avatar saiu da foto do perfil.'))}>
          <RotateCcw className="h-4 w-4" />{a.photo_backup ? t('Voltar para a minha foto') : t('Tirar da foto do perfil')}
        </V2Button>
      ) : (
        <V2Button variant="ghost" size="sm" disabled={busy} onClick={() => run(avatarUseAsPhotoUpdate(profile), t('Avatar salvo como foto do perfil.'))}>
          <Check className="h-4 w-4" />{t('Usar o avatar salvo como foto')}
        </V2Button>
      )}
      <V2Button
        variant={confirmRemove ? 'danger' : 'ghost'}
        size="sm"
        disabled={busy}
        onClick={() => {
          if (!confirmRemove) { setConfirmRemove(true); return; }
          setConfirmRemove(false);
          run(avatarRemoveUpdate(profile), t('Avatar apagado.'));
        }}
        onBlur={() => setConfirmRemove(false)}
      >
        <Trash2 className="h-4 w-4" />{confirmRemove ? t('Toque de novo para apagar') : t('Apagar avatar')}
      </V2Button>
    </div>
  );
}

function Estudio() {
  const { user, userProfile, updateUserProfile } = useAuth();
  const brand = useLiveBrandPaddles();
  const saved = userProfile?.avatar || null;
  const initial = useMemo(() => saved?.recipe || DEFAULT_RECIPE, [saved?.recipe]);
  const [recipe, setRecipe] = useState(initial);
  const hasPhoto = Boolean(userProfile?.photo_url) && !photoIsAvatar(userProfile);
  // Sem foto (ou já usando o avatar), virar a foto é o esperado; com foto de verdade, é escolha.
  const [asPhoto, setAsPhoto] = useState(() => !hasPhoto);
  const [progress, setProgress] = useState(null);
  // Ao sair do estúdio, o palco das miniaturas devolve a memória.
  useEffect(() => () => { releaseSnapshots(); }, []);

  const dirty = !saved || !sameRecipe(normalizeRecipe(saved.recipe), normalizeRecipe(recipe));
  const busy = progress !== null;

  useEffect(() => {
    if (!dirty || !saved) return undefined;
    const warn = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty, saved]);

  const onChange = useCallback((r) => setRecipe(r), []);

  const run = async (update, message) => {
    if (!update) return;
    setProgress(0);
    try {
      await updateUserProfile(update);
      toast.success(message);
    } catch (err) {
      toast.error(err?.message || t('Não deu para salvar agora. Tente de novo.'));
    } finally {
      setProgress(null);
    }
  };

  const save = async () => {
    if (!user?.uid) return;
    setProgress(0);
    try {
      const shot = normalizeRecipe(recipe, { brandIds: brand.items.map((b) => b.id) });
      const bust = await renderAvatarBlob(shot, { view: 'bust', brandItems: brand.items });
      const full = await renderAvatarBlob(shot, { view: 'full', brandItems: brand.items });
      const up = await uploadAvatarImages(user.uid, { bust, full }, setProgress);
      await updateUserProfile(avatarSaveUpdate(userProfile, { recipe, ...up, asPhoto }));
      toast.success(asPhoto ? t('Avatar salvo e já é a sua foto do perfil.') : t('Avatar salvo.'));
    } catch (err) {
      toast.error(err?.message === 'webgl'
        ? t('Este aparelho não desenha o avatar em 3D, então não dá para salvar por aqui. Tente em outro navegador ou aparelho.')
        : err?.message || t('Não deu para salvar o avatar agora. Tente de novo.'));
    } finally {
      setProgress(null);
    }
  };

  if (brand.isLoading) return <Carregando />;

  const footer = (
    <V2Surface variant="compacto" className="mt-4 space-y-4">
      <V2Toggle
        id="av-as-photo"
        checked={asPhoto}
        onChange={setAsPhoto}
        label={t('Usar como foto do perfil')}
        hint={hasPhoto
          ? t('Sua foto atual fica guardada: dá para voltar a ela quando quiser.')
          : t('Aparece no ranking, nos jogos, nos torneios e nos clubes.')}
      />
      <V2Button className="w-full" size="lg" onClick={save} disabled={busy || (!dirty && saved?.as_photo === asPhoto)}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
        {busy ? t('Salvando… {pct}%', { pct: progress || 0 }) : saved ? t('Salvar alterações') : t('Salvar avatar')}
      </V2Button>
      <SavedAvatarActions profile={userProfile} busy={busy} run={run} />
    </V2Surface>
  );

  return (
    <Suspense fallback={<Carregando />}>
      <AvatarStudio
        initialRecipe={initial}
        brandItems={brand.items}
        brandError={brand.isError}
        onChange={onChange}
        savedImage={saved?.full_url || null}
        footer={footer}
      />
    </Suspense>
  );
}

function AvatarDesligado() {
  const { userProfile, updateUserProfile } = useAuth();
  const [busy, setBusy] = useState(false);
  const isPhoto = photoIsAvatar(userProfile);
  const restore = async () => {
    setBusy(true);
    try {
      await updateUserProfile(avatarRestorePhotoUpdate(userProfile));
      toast.success(t('A foto de antes voltou.'));
    } catch (err) {
      toast.error(err?.message || t('Não deu para salvar agora. Tente de novo.'));
    } finally {
      setBusy(false);
    }
  };
  return (
    <V2Surface className="space-y-4 text-center">
      <ImageOff className="mx-auto h-8 w-8 text-gray-500" />
      <p className="font-semibold text-ink">{t('O criador de avatar não está disponível agora.')}</p>
      {isPhoto && (
        <V2Button variant="secondary" onClick={restore} disabled={busy}>
          <RotateCcw className="h-4 w-4" />{t('Voltar para a minha foto')}
        </V2Button>
      )}
    </V2Surface>
  );
}

export default function V2AvatarStudio() {
  const { flags, isLoading } = useFeatureFlags();
  const on = Boolean(flags?.[FEATURE_FLAG.AVATAR_CREATOR]);
  return (
    <V2Page className="space-y-2">
      <V2BackLink to="/perfil">{t('Minha área')}</V2BackLink>
      <V2PageIntro
        title={t('Seu avatar')}
        subtitle={t('Monte o seu jogador: rosto, cabelo, roupa, raquete e pose. Toque nele para ver o movimento.')}
      />
      {isLoading ? <Carregando /> : on ? <Estudio /> : <AvatarDesligado />}
    </V2Page>
  );
}
