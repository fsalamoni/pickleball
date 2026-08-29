/**
 * MODAL de inscrição/edição de equipe numa modalidade de equipes.
 *
 * É o ponto único de entrada da inscrição de equipes: a página da modalidade
 * e o `ModalityRegistrationDialog` (usado no card do torneio, na aba de
 * inscrições e no painel do organizador) abrem este mesmo modal quando a
 * modalidade tem `team_config`.
 */

import React from 'react';
import { Users } from 'lucide-react';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import TeamRegistrationForm from './TeamRegistrationForm';

export default function TeamRegistrationDialog({
  tournament, modality, editingTeam = null, open, onClose,
}) {
  if (!modality?.team_config) return null;
  const isEditing = !!editingTeam;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose?.()}>
      {/* max-w maior que o padrão: o elenco pode ter muitas vagas. */}
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            {isEditing ? 'Editar equipe' : 'Inscrever equipe'}
          </DialogTitle>
          <DialogDescription>
            {modality.name} — dê um nome à equipe e preencha todas as vagas do elenco
            definidas nesta modalidade.
          </DialogDescription>
        </DialogHeader>
        <TeamRegistrationForm
          tournament={tournament}
          modality={modality}
          editingTeam={editingTeam}
          onDone={onClose}
          onCancel={onClose}
        />
      </DialogContent>
    </Dialog>
  );
}
