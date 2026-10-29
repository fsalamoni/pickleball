/**
 * "Pedir para completar o cadastro" — para um recorte da lista ou uma pessoa.
 *
 * Mostra ANTES de enviar quantas pessoas recebem e por que as outras ficaram
 * de fora (cadastro em dia, conta fechada, pedido recente). O aviso leva à
 * edição do perfil; quem recebeu e quando fica na Auditoria.
 *
 * Se a lista de pedidos anteriores não carregou, a tela DIZ que não deu para
 * conferir — tratar a falha como "ninguém recebeu" faria o mesmo aviso chegar
 * duas vezes no mesmo dia.
 */
import React, { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Send } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { V2Button, V2Field, V2FilterChip, V2Input, V2Textarea } from '@/v2/ui/primitives';
import { useFeatureFlag } from '@/core/lib/FeatureFlagsContext';
import { FEATURE_FLAG } from '@/core/featureFlags';
import { useSendProfileReminder } from '@/modules/admin/hooks/usePlatformUsers';
import { reminderAudience, REMINDER_COOLDOWN_DAYS } from '@/modules/admin/domain/userRecordsView';
import { BROADCAST_MESSAGE_MAX, BROADCAST_TITLE_MAX, validateBroadcast } from '@/modules/admin/domain/broadcast';
import { t, tk, tn, fmtNumero } from '@/core/i18n';

const CANAIS_EXTRAS = [
  { id: 'email', label: tk('E-mail') },
  { id: 'whatsapp', label: tk('WhatsApp') },
  { id: 'sms', label: tk('SMS') },
];

/**
 * @param {object} props
 * @param {Array<object>} props.rows linhas enriquecidas (o recorte ou uma pessoa)
 * @param {Map<string, number>|null} props.lastReminder null = não deu para saber
 * @param {object} [props.context] o recorte, para a Auditoria
 * @param {() => void} props.onClose
 */
export default function ProfileReminderDialog({ rows, lastReminder, context, onClose }) {
  const enviar = useSendProfileReminder();
  const externo = useFeatureFlag(FEATURE_FLAG.EXTERNAL_MESSAGING);
  const [incluirRecentes, setIncluirRecentes] = useState(false);
  const [canais, setCanais] = useState([]);
  const [titulo, setTitulo] = useState(() => t('Complete seu cadastro'));
  const [mensagem, setMensagem] = useState(() => t('Faltam algumas informações no seu cadastro. Leva um minuto: toque aqui para completar e aproveitar tudo na plataforma.'));

  const umaPessoa = rows.length === 1;
  const base = useMemo(() => reminderAudience(rows, { lastReminder }), [rows, lastReminder]);
  const publico = useMemo(
    () => (incluirRecentes ? reminderAudience(rows) : base),
    [incluirRecentes, rows, base],
  );
  const n = publico.uids.length;
  const { isValid, errors } = validateBroadcast({ title: titulo, message: mensagem, recipients: n });

  const alternarCanal = (c) => setCanais((a) => (a.includes(c) ? a.filter((x) => x !== c) : [...a, c]));

  const confirmar = async () => {
    try {
      const r = await enviar.mutateAsync({
        title: titulo.trim(), message: mensagem.trim(), uids: publico.uids,
        broadcast: { channels: externo ? canais : [] }, context,
      });
      if (r.sent < r.requested) {
        toast.error(t('Só {sent} de {n} avisos foram gravados. Tente de novo para os que faltaram.', { sent: r.sent, n: r.requested }));
      } else {
        toast.success(tn(r.sent, 'Pedido enviado para {n} pessoa.', 'Pedido enviado para {n} pessoas.'));
      }
      onClose();
    } catch (e) {
      toast.error(e?.message || t('Não foi possível enviar.'));
    }
  };

  const nome = umaPessoa ? (rows[0].platform_name || rows[0].full_name || t('esta pessoa')) : '';

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !enviar.isPending) onClose(); }}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('Pedir para completar o cadastro')}</DialogTitle>
          <DialogDescription>
            {t('Um aviso no sino que leva direto à edição do perfil. Quem recebeu e quando fica na Auditoria.')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-xl bg-gray-50 px-3 py-2.5 text-sm">
            <p className="font-semibold text-ink">
              {umaPessoa
                ? (n === 1 ? t('Vai para {nome}.', { nome }) : t('{nome} não vai receber:', { nome }))
                : tn(n, 'Vai para {n} pessoa.', 'Vai para {n} pessoas.', { n: fmtNumero(n) })}
            </p>
            <ul className="mt-1 space-y-0.5 text-xs text-gray-600">
              {publico.emDia > 0 && (
                <li>{umaPessoa ? t('o cadastro já está em dia no que é obrigatório.') : tn(publico.emDia, '{n} já está com o cadastro em dia e fica de fora.', '{n} já estão com o cadastro em dia e ficam de fora.', { n: fmtNumero(publico.emDia) })}</li>
              )}
              {publico.fechadas > 0 && (
                <li>{umaPessoa ? t('a conta está suspensa, bloqueada ou oculta.') : tn(publico.fechadas, '{n} está com a conta suspensa, bloqueada ou oculta e fica de fora.', '{n} estão com a conta suspensa, bloqueada ou oculta e ficam de fora.', { n: fmtNumero(publico.fechadas) })}</li>
              )}
              {publico.recentes > 0 && (
                <li>{tn(publico.recentes, '{n} recebeu um pedido há menos de {dias} dias e fica de fora.', '{n} receberam um pedido há menos de {dias} dias e ficam de fora.', { n: fmtNumero(publico.recentes), dias: REMINDER_COOLDOWN_DAYS })}</li>
              )}
            </ul>
            {lastReminder && base.recentes > 0 && (
              <label className="mt-2 flex items-start gap-2 text-xs text-ink">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 rounded border-gray-300"
                  checked={incluirRecentes}
                  onChange={(e) => setIncluirRecentes(e.target.checked)}
                />
                <span>{t('Enviar também para quem recebeu um pedido nos últimos {dias} dias', { dias: REMINDER_COOLDOWN_DAYS })}</span>
              </label>
            )}
          </div>

          {!lastReminder && (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">
              {t('Não deu para conferir quem já recebeu um pedido: enviar agora pode repetir o aviso para alguém.')}
            </p>
          )}

          <V2Field label={t('Título')} htmlFor="lembrete-titulo" required error={errors.title} hint={`${titulo.length}/${BROADCAST_TITLE_MAX}`}>
            <V2Input id="lembrete-titulo" maxLength={BROADCAST_TITLE_MAX} value={titulo} onChange={(e) => setTitulo(e.target.value)} />
          </V2Field>
          <V2Field label={t('Mensagem')} htmlFor="lembrete-msg" required error={errors.message} hint={`${mensagem.length}/${BROADCAST_MESSAGE_MAX}`}>
            <V2Textarea id="lembrete-msg" rows={3} maxLength={BROADCAST_MESSAGE_MAX} value={mensagem} onChange={(e) => setMensagem(e.target.value)} />
          </V2Field>

          {externo && (
            <div className="space-y-2 rounded-2xl border border-gray-100 bg-paper p-3">
              <p className="text-xs font-semibold text-ink">{t('Também enviar por')}</p>
              <div className="flex flex-wrap gap-2">
                {CANAIS_EXTRAS.map((c) => (
                  <V2FilterChip key={c.id} active={canais.includes(c.id)} onClick={() => alternarCanal(c.id)}>
                    {t(c.label)}
                  </V2FilterChip>
                ))}
              </div>
              <p className="text-2xs text-gray-500">{t('Só para quem tem e-mail ou celular confirmado, dentro dos tetos e regras de Comunicações.')}</p>
            </div>
          )}
        </div>

        <DialogFooter>
          <V2Button variant="ghost" onClick={onClose} disabled={enviar.isPending}>{t('Cancelar')}</V2Button>
          <V2Button onClick={confirmar} disabled={!isValid || enviar.isPending}>
            <Send className="h-4 w-4" aria-hidden="true" />
            {enviar.isPending ? t('Enviando…') : tn(n, 'Enviar para {n} pessoa', 'Enviar para {n} pessoas', { n: fmtNumero(n) })}
          </V2Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
