/**
 * "Alterar" a região a partir de qualquer tela: o mesmo seletor de
 * Configurações, num diálogo. Muda na hora — a tela atrás já obedece —, e por
 * isso o botão é "Pronto", não "Salvar".
 */
import React from 'react';
import { Link } from 'react-router-dom';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { V2Button } from '@/v2/ui/primitives';
import RegionPicker from './RegionPicker';

export default function RegionDialog({ open, onOpenChange }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl rounded-4xl bg-paper-pure p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl font-bold text-ink">Minha região</DialogTitle>
          <DialogDescription className="text-gray-500">
            Dias de jogo, torneios, arenas, professores, clubes e promoções aparecem a partir daqui. Muda na hora.
          </DialogDescription>
        </DialogHeader>
        <RegionPicker />
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Link
            to="/configuracoes#minha-regiao"
            onClick={() => onOpenChange(false)}
            className="text-sm font-semibold text-gray-500 hover:text-ink"
          >
            Também em Configurações → Minha região
          </Link>
          <V2Button size="sm" onClick={() => onOpenChange(false)}>Pronto</V2Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
