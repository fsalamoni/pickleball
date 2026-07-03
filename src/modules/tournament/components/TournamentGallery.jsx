import React, { useState } from 'react';
import { toast } from 'sonner';
import { Images, Trash2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { ImageUpload } from '@/components/ui/image-upload';
import { PhotoLightbox } from '@/components/ui/photo-lightbox';
import ConfirmDialog from '@/components/ConfirmDialog';
import { useFeatureFlag } from '@/core/lib/FeatureFlagsContext';
import { FEATURE_FLAG } from '@/core/featureFlags';
import {
  useTournamentPhotos,
  useAddTournamentPhoto,
  useDeleteTournamentPhoto,
} from '../hooks/useTournamentPhotos.js';

/**
 * Galeria de fotos do torneio. Fechada pela flag `tournament_gallery`. Quando
 * `canManage` (admin do torneio) é verdadeiro, permite enviar e remover fotos.
 *
 * @param {{ tournamentId: string, canManage?: boolean }} props
 */
export default function TournamentGallery({ tournamentId, canManage = false }) {
  const enabled = useFeatureFlag(FEATURE_FLAG.TOURNAMENT_GALLERY);
  const { data: photos = [] } = useTournamentPhotos(tournamentId, enabled);
  const add = useAddTournamentPhoto(tournamentId);
  const remove = useDeleteTournamentPhoto(tournamentId);
  const [pending, setPending] = useState('');

  if (!enabled) return null;
  // Sem fotos e sem permissão de gerir: não ocupa espaço.
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
    <Card className="rounded-[1.75rem] border-white/80 bg-white/82">
      <CardContent className="p-5 sm:p-6">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink">
          <Images className="h-4 w-4 text-green-600" /> Galeria de fotos
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

        {photos.length === 0 ? (
          <p className="text-sm text-gray-500">Nenhuma foto do torneio ou das modalidades ainda.</p>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
            {photos.map((p) => (
              <div key={p.id} className="group relative overflow-hidden rounded-lg">
                <PhotoLightbox
                  src={p.url}
                  alt="Foto do torneio"
                  trigger={<img src={p.url} alt="" className="h-28 w-full cursor-zoom-in object-cover" />}
                />
                {canManage && (
                  <ConfirmDialog
                    title="Remover foto?"
                    description="A foto será removida da galeria."
                    confirmLabel="Remover"
                    onConfirm={() => remove.mutate(p.id)}
                    trigger={(
                      <button
                        type="button"
                        aria-label="Remover foto"
                        className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  />
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
