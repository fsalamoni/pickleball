/**
 * SEU AVATAR (`/avatar`, flag `avatar_creator`, docs/58).
 *
 * A pessoa toca nas escolhas (`AvatarStudio`) e pede a imagem: o SERVIDOR
 * escreve o pedido a partir das escolhas e devolve o avatar pronto (callable
 * `avatarAi`). Aqui a página mostra, deixa salvar e decide se ele vira a foto
 * do perfil — é o `photo_url` que leva o avatar a toda a plataforma (ranking,
 * jogos, clubes…) sem mexer em nenhuma outra tela. A foto anterior fica
 * guardada para voltar.
 *
 * Criar é limitado por pessoa (o servidor conta); o que foi criado e ainda não
 * foi salvo dá para recuperar. Com a flag DESLIGADA quem já tem avatar como
 * foto ainda consegue voltar para a foto de antes.
 */
import React, { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Check, Download, ImageOff, Loader2, RotateCcw, Shuffle, Sparkles, Trash2, UserRound } from 'lucide-react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useFeatureFlags } from '@/core/lib/FeatureFlagsContext';
import { FEATURE_FLAG } from '@/core/featureFlags';
import { t } from '@/core/i18n';
import { cn } from '@/core/lib/utils';
import { V2BackLink, V2Button, V2ErrorState, V2Page, V2PageIntro, V2Skeleton, V2Surface, V2Toggle } from '@/v2/ui/primitives';
import { rolarAte } from '@/v2/ui/rolarAte';
import AvatarStudio from '@/v2/components/avatar/AvatarStudio';
import { useLiveBrandPaddles } from '@/modules/avatar/hooks/useAvatarCatalog';
import { useAvatarAiStatus, useGenerateAvatar } from '@/modules/avatar/hooks/useAvatarAi';
import { BACKGROUNDS } from '@/modules/avatar/domain/catalog.js';
import { limitMessage } from '@/modules/avatar/domain/aiConfig.js';
import { normalizeRecipe, randomLook } from '@/modules/avatar/domain/recipe.js';
import {
  avatarRemoveUpdate, avatarRestorePhotoUpdate, avatarSaveUpdate, avatarUseAsPhotoUpdate, photoIsAvatar,
} from '@/modules/avatar/domain/profileAvatar.js';
import { avatarAiAction, avatarFiles, avatarImageFromBase64, thumbCrop } from '@/modules/avatar/services/avatarAiService.js';
import { uploadAvatarImages } from '@/modules/avatar/services/avatarService.js';

function Carregando() {
  return (
    <div className="grid gap-6 lg:grid-cols-[5fr_7fr]">
      <V2Skeleton className="aspect-square rounded-4xl" />
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

/** Quanto tempo a criação já leva, em segundos (para dizer em que pé está). */
function useElapsed(active) {
  const [s, setS] = useState(0);
  useEffect(() => {
    if (!active) { setS(0); return undefined; }
    const id = setInterval(() => setS((x) => x + 1), 1000);
    return () => clearInterval(id);
  }, [active]);
  return s;
}

function creatingText(s) {
  if (s < 8) return t('Preparando o seu avatar…');
  if (s < 25) return t('Desenhando o seu avatar…');
  if (s < 50) return t('Dando os últimos retoques…');
  return t('Está demorando um pouco mais que o normal. Não feche esta tela.');
}

/** O palco: o avatar recém-criado, o salvo, ou o convite para criar — sobre o fundo escolhido. */
function Stage({ image, background, creating, elapsed, stageRef }) {
  const bg = BACKGROUNDS.find((b) => b.id === background) || BACKGROUNDS[0];
  return (
    <div
      ref={stageRef}
      // No celular, sem imagem ainda, o palco é baixo: as escolhas aparecem na primeira tela.
      className={cn('relative scroll-mt-4 overflow-hidden rounded-4xl shadow-sm', image ? 'aspect-square' : 'aspect-[2/1] lg:aspect-square')}
      style={{ background: `linear-gradient(${bg.from}, ${bg.to})` }}
    >
      {image && <img src={image} alt={t('Seu avatar')} className="h-full w-full object-cover" />}
      {!image && !creating && (
          <div className="flex h-full flex-col items-center justify-center gap-3 p-4 text-center lg:p-8">
            <UserRound className="h-12 w-12 text-black/25 lg:h-20 lg:w-20" aria-hidden="true" />
            <p className="max-w-[26ch] rounded-2xl bg-white/80 px-3 py-2 text-sm font-semibold text-gray-900">
              {t('Escolha as partes e toque em Criar avatar.')}
            </p>
          </div>
      )}
      <div aria-live="polite">
        {creating && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/55 p-6 text-center text-white">
            <Loader2 className="h-10 w-10 animate-spin motion-reduce:animate-none" aria-hidden="true" />
            <p className="text-base font-bold">{creatingText(elapsed)}</p>
            <p className="text-xs text-white/80">{t('Leva cerca de meio minuto.')}</p>
          </div>
        )}
      </div>
    </div>
  );
}

/** Como a foto do perfil vai ficar (o mesmo recorte que o salvar usa). */
function PhotoPreview({ url, frame }) {
  const c = thumbCrop(frame);
  const at = (v) => `${(v / (1 - c.size)) * 100}%`;
  return (
    <span
      role="img"
      aria-label={t('Como a foto do perfil vai ficar')}
      className="h-14 w-14 shrink-0 rounded-full border-2 border-white bg-no-repeat shadow"
      style={{ backgroundImage: `url(${url})`, backgroundSize: `${100 / c.size}%`, backgroundPosition: `${at(c.x)} ${at(c.y)}` }}
    />
  );
}

function Estudio() {
  const { user, userProfile, updateUserProfile } = useAuth();
  const uid = user?.uid;
  const brand = useLiveBrandPaddles();
  const status = useAvatarAiStatus(uid);
  const gen = useGenerateAvatar(uid);
  const saved = userProfile?.avatar || null;
  const brandIds = brand.items.map((b) => b.id);
  // Receita antiga (a do boneco 3D) ou marca fora do ar: o que não se reconhece cai no padrão.
  const [recipe, setRecipe] = useState(() => normalizeRecipe(saved?.recipe, { brandIds: saved?.recipe?.paddleBrand ? [saved.recipe.paddleBrand] : [] }));
  /** O avatar criado e ainda NÃO salvo: `{ image: { blob, url }, recipe }`. */
  const [draft, setDraft] = useState(null);
  const [recovering, setRecovering] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const hasPhoto = Boolean(userProfile?.photo_url) && !photoIsAvatar(userProfile);
  // Sem foto (ou já usando o avatar), virar a foto é o esperado; com foto de verdade, é escolha.
  const [asPhoto, setAsPhoto] = useState(() => !hasPhoto);
  const [progress, setProgress] = useState(null);
  const stageRef = useRef(null);
  const elapsed = useElapsed(gen.isPending);
  const busy = progress !== null || gen.isPending || recovering;

  const draftUrl = draft?.image.url;
  useEffect(() => () => { if (draftUrl) URL.revokeObjectURL(draftUrl); }, [draftUrl]);

  useEffect(() => {
    if (!draft && !gen.isPending) return undefined;
    const warn = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [draft, gen.isPending]);

  const showDraft = (data) => {
    setDraft({ image: avatarImageFromBase64(data.image, data.mime), recipe: data.recipe });
    setRecipe(normalizeRecipe(data.recipe, { brandIds: data.recipe?.paddleBrand ? [data.recipe.paddleBrand] : [] }));
  };

  const create = (keep) => {
    rolarAte(stageRef.current);
    gen.mutate({ recipe: normalizeRecipe(recipe, { brandIds }), keep }, {
      onSuccess: showDraft,
      onError: (err) => toast.error(err?.message || t('Não foi possível concluir. Tente de novo.')),
    });
  };

  const recover = async () => {
    setRecovering(true);
    try {
      const data = await avatarAiAction('last');
      if (data?.image) { showDraft(data); rolarAte(stageRef.current); } else setDismissed(true);
    } catch (err) {
      toast.error(err?.message || t('Não foi possível concluir. Tente de novo.'));
    } finally {
      setRecovering(false);
    }
  };

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
    if (!uid || !draft) return;
    setProgress(0);
    try {
      const up = await uploadAvatarImages(uid, await avatarFiles(draft.image, draft.recipe.frame), setProgress);
      // O relógio do aparelho pode estar atrás do servidor: salvo nunca fica "mais velho" que criado.
      const now = Math.max(Date.now(), (status.data?.last_ms || 0) + 1);
      await updateUserProfile(avatarSaveUpdate(userProfile, { recipe: draft.recipe, ...up, asPhoto, now }));
      setDraft(null);
      toast.success(asPhoto ? t('Avatar salvo e já é a sua foto do perfil.') : t('Avatar salvo.'));
    } catch (err) {
      toast.error(err?.message || t('Não deu para salvar o avatar agora. Tente de novo.'));
    } finally {
      setProgress(null);
    }
  };

  if (status.isLoading || brand.isLoading) return <Carregando />;
  // Não saber se dá para criar não é "indisponível": é falha, com tentar de novo.
  if (status.isError) return <V2ErrorState onRetry={() => status.refetch()} />;

  const st = status.data || {};
  const blocked = limitMessage(st);
  const canKeep = Boolean(st.base_recipe);
  const unsaved = !draft && !dismissed && st.last_ms > (saved?.updated_at_ms || 0);
  const image = draft?.image.url || saved?.full_url || saved?.url || null;

  const stage = (
    <div className="space-y-4 lg:sticky lg:top-4 lg:self-start">
      <Stage image={image} background={(draft?.recipe || recipe).background} creating={gen.isPending} elapsed={elapsed} stageRef={stageRef} />
      {unsaved && (
        <V2Surface variant="compacto" className="flex flex-wrap items-center justify-between gap-3">
          <p className="min-w-0 text-sm text-ink">{t('Você criou um avatar e ainda não salvou.')}</p>
          <div className="flex gap-2">
            <V2Button size="sm" onClick={recover} disabled={busy}>
              {recovering && <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />}{t('Ver o avatar')}
            </V2Button>
            <V2Button size="sm" variant="ghost" onClick={() => setDismissed(true)} disabled={busy}>{t('Agora não')}</V2Button>
          </div>
        </V2Surface>
      )}
      {draft ? (
        <V2Surface variant="compacto" className="space-y-4">
          <div className="flex items-center gap-3">
            <PhotoPreview url={draft.image.url} frame={draft.recipe.frame} />
            <V2Toggle
              id="av-as-photo"
              checked={asPhoto}
              onChange={setAsPhoto}
              label={t('Usar como foto do perfil')}
              hint={hasPhoto
                ? t('Sua foto atual fica guardada: dá para voltar a ela quando quiser.')
                : t('Aparece no ranking, nos jogos, nos torneios e nos clubes.')}
            />
          </div>
          <V2Button className="w-full" size="lg" onClick={save} disabled={busy}>
            {progress !== null ? <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" /> : <Check className="h-4 w-4" />}
            {progress !== null ? t('Salvando… {pct}%', { pct: progress || 0 }) : t('Salvar avatar')}
          </V2Button>
          <a
            href={draft.image.url}
            download="avatar-picklerush.jpg"
            className="flex min-h-11 items-center justify-center gap-2 rounded-full text-sm font-semibold text-ink underline-offset-4 hover:underline focus:outline-none focus-visible:ring-4 focus-visible:ring-acid/40"
          >
            <Download className="h-4 w-4" />{t('Baixar imagem')}
          </a>
        </V2Surface>
      ) : (
        <SavedAvatarActions profile={userProfile} busy={busy} run={run} />
      )}
    </div>
  );

  if (!st.available) {
    return (
      <div className="grid gap-6 lg:grid-cols-[5fr_7fr]">
        {stage}
        <V2Surface className="space-y-2 self-start text-center">
          <ImageOff className="mx-auto h-8 w-8 text-gray-500" aria-hidden="true" />
          <p className="font-semibold text-ink">{t('O criador de avatar ainda não está disponível.')}</p>
          <p className="text-sm text-gray-500">{t('Falta pouco: assim que ele for ligado, você cria o seu aqui.')}</p>
        </V2Surface>
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[5fr_7fr]">
      {stage}
      <div className="min-w-0 space-y-5">
        <AvatarStudio
          recipe={recipe}
          onChange={(patch) => setRecipe((r) => ({ ...r, ...patch }))}
          brandItems={brand.items}
          brandError={brand.isError}
        />
        <V2Surface variant="compacto" className="space-y-3">
          {blocked
            ? <p role="status" className="rounded-2xl bg-paper p-3 text-sm font-semibold text-ink">{t(blocked)}</p>
            : <p className="text-sm text-gray-500">{t('Restam {n} de {m} criações hoje.', { n: st.day_left, m: st.per_day })}</p>}
          <div className="flex flex-wrap gap-2">
            <V2Button size="lg" className="grow" onClick={() => create(false)} disabled={busy || Boolean(blocked)}>
              <Sparkles className="h-4 w-4" />{canKeep ? t('Criar um avatar novo') : t('Criar avatar')}
            </V2Button>
            {canKeep && (
              <V2Button size="lg" variant="secondary" className="grow" onClick={() => create(true)} disabled={busy || Boolean(blocked)}>
                {t('Manter o rosto e mudar o resto')}
              </V2Button>
            )}
            <V2Button size="lg" variant="ghost" onClick={() => setRecipe((r) => randomLook(Math.random, r))} disabled={busy}>
              <Shuffle className="h-4 w-4" />{t('Surpreenda-me')}
            </V2Button>
          </div>
          {canKeep && (
            <p className="text-xs text-gray-500">
              {t('"Manter o rosto" usa a pessoa do último avatar que você criou do zero: as abas Pessoa e Cabelo não mudam nada nele.')}
            </p>
          )}
          <p className="text-xs text-gray-500">
            {t('A imagem é criada por inteligência artificial só a partir destas escolhas. Nenhuma foto e nenhum dado seu é enviado.')}
          </p>
        </V2Surface>
      </div>
    </div>
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
        subtitle={t('Monte o seu jogador de pickleball: rosto, cabelo, roupa, raquete e pose. A imagem sai em meio minuto.')}
      />
      {isLoading ? <Carregando /> : on ? <Estudio /> : <AvatarDesligado />}
    </V2Page>
  );
}
