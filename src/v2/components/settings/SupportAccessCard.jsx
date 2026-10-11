/**
 * "Acessos do suporte": quando o admin revelou os dados de contato desta
 * pessoa, e por quê. É a testemunha que separa suporte de vigilância
 * (`docs/20-SEGURANCA-E-PRIVACIDADE/05-ADMIN-SUPORTE.md` §2.5).
 */
import React from 'react';
import { Eye } from 'lucide-react';
import { V2Surface, V2Skeleton, V2ErrorState } from '@/v2/ui/primitives';
import { useMyAccessLogs } from '@/modules/admin/hooks/usePlatformUsers';
import { REVEAL_REASON_META } from '@/modules/admin/domain/supportAccess';

const CAMPO = { email: 'e-mail', phone: 'telefone', birth_date: 'nascimento', address: 'endereço' };
const quando = (ms) => (ms
  ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' }).format(new Date(ms))
  : '');

export default function SupportAccessCard({ uid }) {
  const { data = [], isLoading, isError, refetch, isSuccess } = useMyAccessLogs(uid);
  return (
    <V2Surface id="acessos-do-suporte" className="scroll-mt-4">
      <div className="flex items-center gap-2">
        <Eye className="h-5 w-5 text-ink" />
        <h2 className="font-display text-lg font-bold text-ink">Acessos do suporte</h2>
      </div>
      <p className="mt-1 text-sm text-gray-500">
        Seus dados de contato ficam mascarados para o suporte da plataforma. Cada vez que alguém os revela,
        o acesso é registrado aqui, com o motivo, e você é avisado.
      </p>
      <div className="mt-3">
        {isLoading ? <V2Skeleton lines={2} /> : isError ? (
          <V2ErrorState inline title="Não deu para carregar o registro" onRetry={() => refetch()} />
        ) : isSuccess && data.length === 0 ? (
          <p className="text-sm text-gray-500">Ninguém do suporte revelou seus dados de contato.</p>
        ) : (
          <ul className="space-y-2">
            {data.slice(0, 20).map((l) => (
              <li key={l.id} className="rounded-xl border border-gray-100 px-3 py-2 text-xs">
                <div className="font-semibold text-ink">
                  {quando(l.at_ms)} · {(l.fields || []).map((f) => CAMPO[f] || f).join(', ')}
                </div>
                <div className="mt-0.5 text-gray-500">
                  {REVEAL_REASON_META[l.reason_category] || l.reason_category}{l.reason_text ? ` — ${l.reason_text}` : ''}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </V2Surface>
  );
}
