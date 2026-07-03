import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Loader2, MessageCircle } from 'lucide-react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useChatActions } from '@/modules/chat/hooks/useChat';
import { V2Button } from '@/v2/ui/primitives';

const VARIANT_MAP = {
  default: 'primary',
  primary: 'primary',
  secondary: 'secondary',
  outline: 'ghost',
  ghost: 'ghost',
};

/**
 * Botão v2 que inicia (ou reabre) uma conversa direta e navega para o chat v2.
 */
export default function V2ChatLauncherButton({
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
    <V2Button
      variant={VARIANT_MAP[variant] || 'primary'}
      size={iconOnly ? 'icon' : size}
      className={className}
      onClick={handleClick}
      disabled={busy}
      title={label}
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageCircle className="h-4 w-4" />}
      {!iconOnly && label}
    </V2Button>
  );
}
