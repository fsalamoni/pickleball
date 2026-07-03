import React, { useState } from 'react';
import { toast } from 'sonner';
import { Images, Trash2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { ImageUpload } from '@/components/ui/image-upload';
import { PhotoLightbox } from '@/components/ui/photo-lightbox';
import ConfirmDialog from '@/components/ConfirmDialog';
import {
  useModalityPhotos,
  useAddModalityPhoto,
  useDeleteTournamentPhoto,
} from '../hooks/useTournamentPhotos.js';

/**
 * Galeria de fotos de UMA modalidade. Reaproveita a coleção `tournament_photos`
 * com o campo `modality_id`. `canManage` (admin do torneio) libera upload/remoção.
 */
export default function ModalityGallery({ tournamentId, modalityId, canManage = false }) {
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
    <Card className="rounded-[1.75rem] border-white/80 bg-white/82">
      <CardContent className="p-5 sm:p-6">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink">
          <Images className="h-4 w-4 text-green-600" /> Fotos da modalidade
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

        {photos.length === 0 ? (
          <p className="text-sm text-gray-500">Nenhuma foto desta modalidade ainda.</p>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
            {photos.map((p) => (
              <div key={p.id} className="group relative overflow-hidden rounded-lg">
                <PhotoLightbox
                  src={p.url}
                  alt="Foto da modalidade"
                  trigger={<img src={p.url} alt="" className="h-28 w-full cursor-zoom-in object-cover" />}
                />
                {canManage && (
                  <ConfirmDialog
                    title="Remover foto?"
                    description="A foto será removida desta modalidade."
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
