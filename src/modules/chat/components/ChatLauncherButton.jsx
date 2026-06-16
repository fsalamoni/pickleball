import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Loader2, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useChatActions } from '@/modules/chat/hooks/useChat';

/**
 * Botão que inicia (ou reabre) uma conversa direta com um atleta e navega para
 * a página de chat. Reutilizável no diretório de atletas.
 */
export default function ChatLauncherButton({
  athlete,
  variant = 'default',
  size = 'sm',
  className,
  label = 'Conversar',
  iconOnly = false,
  onStarted,
}) {
  const { user, isAuthenticated } = useAuth();
  const actions = useChatActions();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  const targetId = athlete?.id || athlete?.uid;
  // Não faz sentido conversar consigo mesmo.
  if (!targetId || targetId === user?.uid) return null;

  const handleClick = async () => {
    if (!isAuthenticated) {
      toast.error('Entre na plataforma para conversar com atletas.');
      return;
    }
    setBusy(true);
    try {
      const id = await actions.startDirect({
        uid: targetId,
        name: athlete.platform_name || athlete.name,
        photo_url: athlete.photo_url || athlete.photoURL,
      });
      onStarted?.(id);
      navigate(`/chat?c=${id}`);
    } catch (err) {
      toast.error(err.message || 'Não foi possível iniciar a conversa.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button variant={variant} size={iconOnly ? 'icon' : size} className={className} onClick={handleClick} disabled={busy} title={label}>
      {busy ? (
        <Loader2 className={iconOnly ? 'h-4 w-4 animate-spin' : 'mr-1.5 h-4 w-4 animate-spin'} />
      ) : (
        <MessageCircle className={iconOnly ? 'h-4 w-4' : 'mr-1.5 h-4 w-4'} />
      )}
      {!iconOnly && label}
    </Button>
  );
}
