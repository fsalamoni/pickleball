/**
 * "Personalizar o início" — escolher, ali mesmo, o que a tela inicial mostra.
 *
 * São os MESMOS interesses do perfil (`users.interests`), salvos pelo MESMO
 * caminho do editor de perfil (`updateUserProfile`): nada novo no banco, e o
 * que se escolhe aqui aparece lá, e vice-versa. A regra também é a mesma: ao
 * menos um interesse.
 *
 * O que a pessoa FAZ (gerir arena, dar aula, organizar torneio) não depende
 * desta escolha — a tela diz isso, para ninguém desmarcar "arena" e estranhar
 * a arena continuar lá.
 */
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Check } from 'lucide-react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { PLATFORM_INTEREST_META, sanitizeInterests } from '@/modules/athletes/domain/profileMeta';
import { interestIcon } from '@/v2/components/profile/profileMetaIcons';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { V2Button } from '@/v2/ui/primitives';
import { cn } from '@/core/lib/utils';

export default function PersonalizeHomeDialog({ open, onOpenChange }) {
  const { userProfile, updateUserProfile } = useAuth();
  const [escolhidos, setEscolhidos] = useState(() => sanitizeInterests(userProfile?.interests));
  const [salvando, setSalvando] = useState(false);

  // Reabrir o diálogo parte do que está salvo (não do rascunho abandonado).
  useEffect(() => {
    if (open) setEscolhidos(sanitizeInterests(userProfile?.interests));
  }, [open, userProfile?.interests]);

  const alternar = (valor) => setEscolhidos((atual) => (
    atual.includes(valor) ? atual.filter((v) => v !== valor) : [...atual, valor]
  ));

  const salvar = async () => {
    if (escolhidos.length === 0) {
      toast.error('Escolha ao menos um interesse.');
      return;
    }
    setSalvando(true);
    try {
      await updateUserProfile({ interests: sanitizeInterests(escolhidos) });
      toast.success('Pronto — o seu início foi atualizado.');
      onOpenChange(false);
    } catch (err) {
      toast.error(err?.message || 'Não foi possível salvar os interesses.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl rounded-4xl bg-paper-pure">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl font-bold text-ink">O que você quer ver no início?</DialogTitle>
          <DialogDescription className="text-gray-500">
            Marque o que você faz ou quer fazer por aqui. A tela inicial passa a mostrar isso primeiro.
            O que você já faz — gerir uma arena, dar aulas, organizar um torneio — aparece de qualquer jeito.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2 sm:grid-cols-2" role="group" aria-label="Interesses">
          {PLATFORM_INTEREST_META.map(({ value, label, hint, icon }) => {
            const Icon = interestIcon(icon);
            const ativo = escolhidos.includes(value);
            return (
              <button
                key={value}
                type="button"
                onClick={() => alternar(value)}
                aria-pressed={ativo}
                className={cn(
                  'btn-press flex items-start gap-2.5 rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-acid/30',
                  ativo ? 'border-transparent bg-ink text-white' : 'border-gray-200 bg-paper-pure text-gray-600 hover:border-ink',
                )}
              >
                <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', ativo ? 'text-acid' : 'text-gray-400')} aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  {label}
                  {hint && <span className={cn('mt-0.5 block text-xs font-normal', ativo ? 'text-white/70' : 'text-gray-400')}>{hint}</span>}
                </span>
                {ativo && <Check className="h-4 w-4 shrink-0 text-acid" aria-hidden="true" />}
              </button>
            );
          })}
        </div>
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Link to="/perfil/editar" className="text-sm font-semibold text-gray-500 hover:text-ink" onClick={() => onOpenChange(false)}>
            Editar o perfil completo
          </Link>
          <div className="flex gap-2">
            <V2Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>Cancelar</V2Button>
            <V2Button size="sm" onClick={salvar} disabled={salvando || escolhidos.length === 0}>
              {salvando ? 'Salvando…' : 'Salvar'}
            </V2Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
