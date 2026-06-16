import React, { useState } from 'react';
import { Download, Share, Plus, Smartphone, MoreVertical, MonitorDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { usePwaInstall } from '@core/pwa/usePwaInstall';

/**
 * Botão "Baixar o app" (PWA). Renderiza sempre que o PWA está habilitado por
 * flag e o app ainda não foi instalado. O clique decide o caminho:
 *  - prompt nativo (Android/Chrome/Edge), quando disponível;
 *  - instruções para iOS/Safari (sem prompt nativo);
 *  - instruções genéricas (desktop ou navegador sem prompt nativo ainda).
 * Quando a flag está desligada, retorna null — nada muda na página.
 */
export default function InstallAppButton({
  className,
  variant = 'default',
  size = 'default',
  label = 'Baixar o app',
}) {
  const { available, canPrompt, isIOS, promptInstall } = usePwaInstall();
  const [showIOS, setShowIOS] = useState(false);
  const [showGeneric, setShowGeneric] = useState(false);

  if (!available) return null;

  const handleClick = async () => {
    if (canPrompt) {
      const outcome = await promptInstall();
      // Se o navegador não abriu o prompt por algum motivo, cai no guia.
      if (!outcome) setShowGeneric(true);
      return;
    }
    if (isIOS) {
      setShowIOS(true);
      return;
    }
    setShowGeneric(true);
  };

  return (
    <>
      <Button type="button" variant={variant} size={size} className={className} onClick={handleClick}>
        <Download className="mr-2 h-4 w-4" />
        {label}
      </Button>

      <Dialog open={showIOS} onOpenChange={setShowIOS}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Smartphone className="h-5 w-5 text-emerald-600" />
              Instalar no iPhone / iPad
            </DialogTitle>
            <DialogDescription>
              No iOS, o app é instalado direto pelo Safari, sem App Store. Siga os passos:
            </DialogDescription>
          </DialogHeader>
          <ol className="mt-2 space-y-3 text-sm text-slate-700">
            <li className="flex items-start gap-3">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-semibold text-emerald-700">1</span>
              <span className="flex items-center gap-1">
                Toque no botão <Share className="inline h-4 w-4" /> <strong>Compartilhar</strong> na barra do Safari.
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-semibold text-emerald-700">2</span>
              <span className="flex items-center gap-1">
                Escolha <Plus className="inline h-4 w-4" /> <strong>Adicionar à Tela de Início</strong>.
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-semibold text-emerald-700">3</span>
              <span>Confirme em <strong>Adicionar</strong>. O ícone do Pickleball aparece na tela inicial.</span>
            </li>
          </ol>
        </DialogContent>
      </Dialog>

      <Dialog open={showGeneric} onOpenChange={setShowGeneric}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MonitorDown className="h-5 w-5 text-emerald-600" />
              Instalar o app
            </DialogTitle>
            <DialogDescription>
              Você pode instalar o Pickleball direto do navegador, sem loja de apps:
            </DialogDescription>
          </DialogHeader>
          <ul className="mt-2 space-y-3 text-sm text-slate-700">
            <li className="flex items-start gap-3">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                <MonitorDown className="h-3.5 w-3.5" />
              </span>
              <span>
                <strong>No computador (Chrome/Edge):</strong> clique no ícone de instalar na barra de endereço, ou no menu
                <MoreVertical className="mx-1 inline h-4 w-4" /> e em <strong>“Instalar app”</strong>.
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                <Smartphone className="h-3.5 w-3.5" />
              </span>
              <span>
                <strong>No Android:</strong> abra o menu
                <MoreVertical className="mx-1 inline h-4 w-4" /> do navegador e toque em
                <strong> “Instalar app”</strong> ou <strong>“Adicionar à tela inicial”</strong>.
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                <Share className="h-3.5 w-3.5" />
              </span>
              <span>
                <strong>No iPhone/iPad:</strong> use o Safari, toque em <strong>Compartilhar</strong> e em
                <strong> “Adicionar à Tela de Início”</strong>.
              </span>
            </li>
          </ul>
        </DialogContent>
      </Dialog>
    </>
  );
}
