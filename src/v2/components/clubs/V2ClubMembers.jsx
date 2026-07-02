import React, { useState } from 'react';
import { toast } from 'sonner';
import { Mail, MoreVertical, Shield, ShieldCheck, UserMinus, Users } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { UserAvatar } from '@/components/ui/user-avatar';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useClubMembers, useSetMemberRole, useRemoveMember } from '@/modules/clubs/hooks/useClubs';
import { CLUB_ROLE, CLUB_ROLE_LABELS } from '@/modules/clubs/domain/constants';
import { V2Badge, V2EmptyState, V2Skeleton } from '@/v2/ui/primitives';

export default function V2ClubMembers({ clubId, isAdmin }) {
  const { user } = useAuth();
  const { data: members = [], isLoading } = useClubMembers(clubId);
  const setRole = useSetMemberRole(clubId);
  const removeMember = useRemoveMember(clubId);
  const [confirmRemove, setConfirmRemove] = useState(null);

  const sorted = [...members].sort((a, b) => {
    if (a.role !== b.role) return a.role === CLUB_ROLE.ADMIN ? -1 : 1;
    return String(a.user_name || '').localeCompare(String(b.user_name || ''), 'pt-BR');
  });

  const handleRole = async (member, role) => {
    try {
      await setRole.mutateAsync({ member, role });
      toast.success(role === CLUB_ROLE.ADMIN ? 'Membro promovido a administrador.' : 'Administrador rebaixado a membro.');
    } catch (err) {
      toast.error(err.message || 'Não foi possível alterar a função.');
    }
  };

  const handleRemove = async () => {
    if (!confirmRemove) return;
    try {
      await removeMember.mutateAsync(confirmRemove);
      toast.success('Membro removido do clube.');
      setConfirmRemove(null);
    } catch (err) {
      toast.error(err.message || 'Não foi possível remover o membro.');
    }
  };

  if (isLoading) {
    return <div className="space-y-3">{[1, 2, 3].map((i) => <V2Skeleton key={i} className="h-16 rounded-3xl" />)}</div>;
  }

  if (members.length === 0) {
    return <V2EmptyState icon={Users} title="Sem membros" description="Convide atletas com o código do clube." />;
  }

  return (
    <div className="space-y-3">
      {sorted.map((member) => {
        const isSelf = member.user_id === user?.uid;
        return (
          <div key={member.id} className="flex items-center gap-3 rounded-3xl border border-gray-100 bg-paper-pure p-3 shadow-organic-sm sm:p-4">
            <UserAvatar name={member.user_name} photoUrl={member.photo_url} size="md" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate font-bold text-ink">{member.user_name}</span>
                {isSelf && <span className="text-xs text-gray-400">(você)</span>}
              </div>
              {member.user_email && (
                <div className="mt-0.5 inline-flex items-center gap-1 text-xs text-gray-500">
                  <Mail className="h-3 w-3" /> {member.user_email}
                </div>
              )}
            </div>
            <V2Badge tone={member.role === CLUB_ROLE.ADMIN ? 'amber' : 'neutral'}>
              {CLUB_ROLE_LABELS[member.role] || member.role}
            </V2Badge>

            {isAdmin && !isSelf && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-paper hover:text-ink">
                    <MoreVertical className="h-4 w-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {member.role === CLUB_ROLE.ADMIN ? (
                    <DropdownMenuItem onClick={() => handleRole(member, CLUB_ROLE.MEMBER)}>
                      <Shield className="mr-2 h-4 w-4" /> Rebaixar a membro
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem onClick={() => handleRole(member, CLUB_ROLE.ADMIN)}>
                      <ShieldCheck className="mr-2 h-4 w-4" /> Tornar administrador
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem className="text-red-600 focus:text-red-600" onClick={() => setConfirmRemove(member)}>
                    <UserMinus className="mr-2 h-4 w-4" /> Remover do clube
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        );
      })}

      <ConfirmDialog
        open={!!confirmRemove}
        onOpenChange={(v) => !v && setConfirmRemove(null)}
        title="Remover membro"
        description={confirmRemove ? `Tem certeza que deseja remover ${confirmRemove.user_name} do clube?` : ''}
        confirmLabel="Remover"
        destructive
        loading={removeMember.isPending}
        onConfirm={handleRemove}
      />
    </div>
  );
}
