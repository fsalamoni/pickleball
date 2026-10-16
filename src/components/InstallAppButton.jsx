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
import { t } from '@/core/i18n';

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
  label = t('Baixar o app'),
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
              <Smartphone className="h-5 w-5 text-green-600" />
              {t('Instalar no iPhone / iPad')}
            </DialogTitle>
            <DialogDescription>
              {t('No iOS, o app é instalado pelo Safari (ou pelo Chrome, a partir do iOS 16.4), sem App Store. Siga os passos:')}
            </DialogDescription>
          </DialogHeader>
          <ol className="mt-2 space-y-3 text-sm text-gray-600">
            <li className="flex items-start gap-3">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-green-100 text-xs font-semibold text-green-700">1</span>
              <span className="flex items-center gap-1">
                {t('Toque no botão')} <Share className="inline h-4 w-4" /> <strong>{t('Compartilhar')}</strong> {t('na barra do Safari.')}
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-green-100 text-xs font-semibold text-green-700">2</span>
              <span className="flex items-center gap-1">
                {t('Escolha')} <Plus className="inline h-4 w-4" /> <strong>{t('Adicionar à Tela de Início')}</strong>.
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-green-100 text-xs font-semibold text-green-700">3</span>
              <span>{t('Confirme em')} <strong>{t('Adicionar')}</strong>. {t('O ícone do PickleRush aparece na tela inicial, na versão clara ou escura conforme o tema do celular.')}</span>
            </li>
          </ol>
        </DialogContent>
      </Dialog>

      <Dialog open={showGeneric} onOpenChange={setShowGeneric}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MonitorDown className="h-5 w-5 text-green-600" />
              {t('Instalar o app')}
            </DialogTitle>
            <DialogDescription>
              {t('Você pode instalar o PickleRush direto do navegador, sem loja de apps:')}
            </DialogDescription>
          </DialogHeader>
          <ul className="mt-2 space-y-3 text-sm text-gray-600">
            <li className="flex items-start gap-3">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-green-100 text-green-700">
                <MonitorDown className="h-3.5 w-3.5" />
              </span>
              <span>
                <strong>{t('No computador (Chrome/Edge):')}</strong> {t('clique no ícone de instalar na barra de endereço, ou no menu')}
                <MoreVertical className="mx-1 inline h-4 w-4" /> {t('e em')} <strong>“{t('Instalar app')}”</strong>.
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-green-100 text-green-700">
                <Smartphone className="h-3.5 w-3.5" />
              </span>
              <span>
                <strong>{t('No Android:')}</strong> {t('abra o menu')}
                <MoreVertical className="mx-1 inline h-4 w-4" /> {t('do navegador e toque em')}
                <strong> “{t('Instalar app')}”</strong> {t('ou')} <strong>“{t('Adicionar à tela inicial')}”</strong>.
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-green-100 text-green-700">
                <Share className="h-3.5 w-3.5" />
              </span>
              <span>
                <strong>{t('No iPhone/iPad:')}</strong> {t('use o Safari, toque em')} <strong>{t('Compartilhar')}</strong> {t('e em')}
                <strong> “{t('Adicionar à Tela de Início')}”</strong>.
              </span>
            </li>
          </ul>
        </DialogContent>
      </Dialog>
    </>
  );
}
