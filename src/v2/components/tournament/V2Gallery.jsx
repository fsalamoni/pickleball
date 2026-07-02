import React, { useState } from 'react';
import { toast } from 'sonner';
import { Images, Trash2 } from 'lucide-react';
import { ImageUpload } from '@/components/ui/image-upload';
import { PhotoLightbox } from '@/components/ui/photo-lightbox';
import ConfirmDialog from '@/components/ConfirmDialog';
import { useFeatureFlag } from '@/core/lib/FeatureFlagsContext';
import { FEATURE_FLAG } from '@/core/featureFlags';
import {
  useTournamentPhotos,
  useAddTournamentPhoto,
  useDeleteTournamentPhoto,
  useModalityPhotos,
  useAddModalityPhoto,
} from '@/modules/tournament/hooks/useTournamentPhotos';
import { V2Surface } from '@/v2/ui/primitives';

function PhotoGrid({ photos, canManage, onRemove, alt, emptyText, removeText }) {
  if (photos.length === 0) return <p className="text-sm text-gray-500">{emptyText}</p>;
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
      {photos.map((p) => (
        <div key={p.id} className="group relative overflow-hidden rounded-2xl">
          <PhotoLightbox src={p.url} alt={alt} trigger={<img src={p.url} alt="" className="h-28 w-full cursor-zoom-in object-cover" />} />
          {canManage && (
            <ConfirmDialog
              title="Remover foto?"
              description={removeText}
              confirmLabel="Remover"
              onConfirm={() => onRemove(p.id)}
              trigger={(
                <button
                  type="button"
                  aria-label="Remover foto"
                  className="absolute right-1 top-1 rounded-full bg-ink/70 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            />
          )}
        </div>
      ))}
    </div>
  );
}

export function V2TournamentGallery({ tournamentId, canManage = false }) {
  const enabled = useFeatureFlag(FEATURE_FLAG.TOURNAMENT_GALLERY);
  const { data: photos = [] } = useTournamentPhotos(tournamentId, enabled);
  const add = useAddTournamentPhoto(tournamentId);
  const remove = useDeleteTournamentPhoto(tournamentId);
  const [pending, setPending] = useState('');

  if (!enabled) return null;
  if (photos.length === 0 && !canManage) return null;

  function handleUpload(url) {
    if (url) {
      add.mutate(url, {
        onSuccess: () => toast.success('Foto adicionada à galeria.'),
        onError: (err) => toast.error(err?.message || 'Falha ao adicionar foto.'),
      });
    }
    setPending('');
  }

  return (
    <V2Surface>
      <h2 className="mb-2 flex items-center gap-2 font-display text-base font-bold text-ink">
        <Images className="h-4 w-4 text-ink" /> Galeria de fotos
      </h2>
      <p className="mb-4 text-sm leading-6 text-gray-500">
        Esta visão reúne as fotos enviadas na galeria geral do torneio e nas galerias das modalidades.
      </p>
      {canManage && (
        <div className="mb-4">
          <ImageUpload
            value={pending}
            onChange={handleUpload}
            folder={`tournaments/${tournamentId}`}
            label="Enviar foto"
            hint="As fotos aparecem na página do torneio e na visão pública."
          />
        </div>
      )}
      <PhotoGrid
        photos={photos}
        canManage={canManage}
        onRemove={(id) => remove.mutate(id)}
        alt="Foto do torneio"
        emptyText="Nenhuma foto do torneio ou das modalidades ainda."
        removeText="A foto será removida da galeria."
      />
    </V2Surface>
  );
}

export function V2ModalityGallery({ tournamentId, modalityId, canManage = false }) {
  const { data: photos = [] } = useModalityPhotos(modalityId);
  const add = useAddModalityPhoto(tournamentId, modalityId);
  const remove = useDeleteTournamentPhoto(tournamentId, modalityId);
  const [pending, setPending] = useState('');

  function handleUpload(url) {
    if (url) {
      add.mutate(url, {
        onSuccess: () => toast.success('Foto adicionada à modalidade.'),
        onError: (err) => toast.error(err?.message || 'Falha ao adicionar foto.'),
      });
    }
    setPending('');
  }

  return (
    <V2Surface>
      <h2 className="mb-3 flex items-center gap-2 font-display text-base font-bold text-ink">
        <Images className="h-4 w-4 text-ink" /> Fotos da modalidade
      </h2>
      {canManage && (
        <div className="mb-4">
          <ImageUpload
            value={pending}
            onChange={handleUpload}
            folder={`tournaments/${tournamentId}/modalidades/${modalityId}`}
            label="Enviar foto"
            hint="As fotos aparecem nesta modalidade, para atletas e público."
          />
        </div>
      )}
      <PhotoGrid
        photos={photos}
        canManage={canManage}
        onRemove={(id) => remove.mutate(id)}
        alt="Foto da modalidade"
        emptyText="Nenhuma foto desta modalidade ainda."
        removeText="A foto será removida desta modalidade."
      />
    </V2Surface>
  );
}
