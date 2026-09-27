/**
 * "Personalizar" no próprio início (com o início sob medida ligado): o mesmo
 * seletor de Configurações, num diálogo. Muda na hora — a tela atrás já
 * mostra —, e por isso o botão é "Pronto", não "Salvar".
 */
import React from 'react';
import { Link } from 'react-router-dom';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { V2Button } from '@/v2/ui/primitives';
import HomeCardsPicker from './HomeCardsPicker';

export default function HomeCardsDialog({ open, onOpenChange, foci = [] }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl rounded-4xl bg-paper-pure p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl font-bold text-ink">O que aparece no seu início</DialogTitle>
          <DialogDescription className="text-gray-500">
            Ligue, desligue e ordene os cards. Muda na hora — a tela atrás já mostra.
          </DialogDescription>
        </DialogHeader>
        <HomeCardsPicker foci={foci} />
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Link
            to="/configuracoes#pagina-inicial"
            onClick={() => onOpenChange(false)}
            className="text-sm font-semibold text-gray-500 hover:text-ink"
          >
            Também em Configurações → Página inicial
          </Link>
          <V2Button size="sm" onClick={() => onOpenChange(false)}>Pronto</V2Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
