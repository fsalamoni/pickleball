import React from 'react';
import { UserPlus, UserCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useFollow } from '../hooks/useFollow.js';

/**
 * Botão Seguir/Seguindo para um atleta. Renderiza `null` se for o próprio
 * usuário. O gating pela flag `follow_athletes` é feito pelo componente pai.
 *
 * @param {{ targetUid: string, size?: string, className?: string }} props
 */
export default function FollowButton({ targetUid, size = 'sm', className }) {
  const { isFollowing, isSelf, toggle, isPending } = useFollow(targetUid);
  if (isSelf || !targetUid) return null;

  return (
    <Button
      size={size}
      variant={isFollowing ? 'outline' : 'default'}
      className={className}
      onClick={toggle}
      disabled={isPending}
    >
      {isFollowing ? <UserCheck className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
      <span className="ml-1">{isFollowing ? 'Seguindo' : 'Seguir'}</span>
    </Button>
  );
}
