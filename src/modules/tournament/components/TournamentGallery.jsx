import React, { useState } from 'react';
import { toast } from 'sonner';
import { Images, Trash2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { ImageUpload } from '@/components/ui/image-upload';
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
    <Card>
      <CardContent className="p-4">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800">
          <Images className="h-4 w-4 text-emerald-600" /> Galeria de fotos
        </h2>

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
          <p className="text-sm text-slate-500">Nenhuma foto ainda.</p>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
            {photos.map((p) => (
              <div key={p.id} className="group relative overflow-hidden rounded-lg">
                <img src={p.url} alt="" className="h-28 w-full object-cover" />
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
