import React, { useState } from 'react';
import { Download, Share, Plus, Smartphone } from 'lucide-react';
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
 * Botão "Instalar app". Só renderiza quando o PWA está habilitado por flag e
 * a instalação é possível (prompt nativo no Android/desktop, ou instruções no
 * iOS). Quando a flag está desligada, retorna null — nada muda na página.
 */
export default function InstallAppButton({
  className,
  variant = 'default',
  size = 'default',
  label = 'Baixar o app',
}) {
  const { available, canPrompt, isIOS, promptInstall } = usePwaInstall();
  const [showIOS, setShowIOS] = useState(false);

  if (!available) return null;

  const handleClick = async () => {
    if (canPrompt) {
      await promptInstall();
      return;
    }
    if (isIOS) setShowIOS(true);
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
    </>
  );
}
