/**
 * Aviso em massa — a voz do admin no sino de todo mundo (ou de um recorte).
 * O público é o MESMO das campanhas da plataforma (`platformRecipients`):
 * todos, por interesse, estado, cidade ou professores — contado antes de
 * enviar. Conta oculta, suspensa ou bloqueada não recebe.
 */
import React, { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Megaphone, Send } from 'lucide-react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useAllPlatformUsers } from '@/modules/admin/hooks/usePlatformUsers';
import { PLATFORM_INTEREST_META } from '@/modules/athletes/domain/profileMeta';
import {
  BR_UFS, PROMO_AUDIENCE, PROMO_AUDIENCES_BY_ISSUER, PROMO_AUDIENCE_META, PROMO_ISSUER, platformRecipients,
} from '@/modules/promo/domain/promo';
import { BROADCAST_MESSAGE_MAX, BROADCAST_TITLE_MAX, validateBroadcast } from '@/modules/admin/domain/broadcast';
import { sendAdminBroadcast } from '@/modules/admin/services/broadcastService';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  V2Button, V2ErrorState, V2Field, V2FilterChip, V2Input, V2Select, V2Skeleton, V2Surface, V2Textarea,
} from '@/v2/ui/primitives';
import { t, tn } from '@/core/i18n';

const AUDIENCIAS = PROMO_AUDIENCES_BY_ISSUER[PROMO_ISSUER.PLATFORM];

export default function AdminBroadcastTab() {
  const { user, isPlatformAdmin } = useAuth();
  const usuarios = useAllPlatformUsers({ enabled: isPlatformAdmin });
  const [f, setF] = useState({ title: '', message: '', link: '', audience: PROMO_AUDIENCE.ALL, detail: { interest: '', state: '', city: '' } });
  const [confirmar, setConfirmar] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const set = (patch) => setF((a) => ({ ...a, ...patch }));
  const setDetail = (patch) => setF((a) => ({ ...a, detail: { ...a.detail, ...patch } }));

  const destinatarios = useMemo(
    () => (usuarios.isSuccess ? platformRecipients(f.audience, { users: usuarios.data, ...f.detail }) : []),
    [usuarios.isSuccess, usuarios.data, f.audience, f.detail],
  );
  const { isValid, errors } = validateBroadcast({ ...f, recipients: destinatarios.length });
  const precisa = PROMO_AUDIENCE_META[f.audience]?.needs;

  const enviar = async () => {
    setEnviando(true);
    try {
      const r = await sendAdminBroadcast({
        title: f.title.trim(), message: f.message.trim(), link: f.link.trim(), audience: f.audience,
        detail: precisa ? f.detail : null, recipients: destinatarios, actor: user,
      });
      toast.success(tn(r.requested, 'Aviso gravado para {sent} de {n} pessoa.', 'Aviso gravado para {sent} de {n} pessoas.', { sent: r.sent }));
      set({ title: '', message: '', link: '' });
    } catch (e) {
      toast.error(e?.message || t('Não foi possível enviar.'));
    } finally {
      setEnviando(false);
      setConfirmar(false);
    }
  };

  return (
    <V2Surface>
      <div className="flex items-center gap-2">
        <Megaphone className="h-5 w-5 text-ink" />
        <h2 className="font-display text-lg font-bold text-ink">{t('Aviso em massa')}</h2>
      </div>
      <p className="mt-1 max-w-3xl text-sm text-gray-500">
        {t('Um aviso no sino (e no celular de quem ligou as notificações) para todas as contas ou um recorte. Para cupom, banner ou campanha com arte, use')} <strong>{t('Cupons e campanhas')}</strong>. {t('Fica na Auditoria.')}
      </p>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="space-y-3">
          <V2Field label={t('Título')} htmlFor="bc-titulo" required error={f.title && errors.title} hint={`${f.title.length}/${BROADCAST_TITLE_MAX}`}>
            <V2Input id="bc-titulo" maxLength={BROADCAST_TITLE_MAX} value={f.title} onChange={(e) => set({ title: e.target.value })} placeholder={t('Ex.: Manutenção programada hoje às 23h')} />
          </V2Field>
          <V2Field label={t('Mensagem')} htmlFor="bc-msg" required error={f.message && errors.message} hint={`${f.message.length}/${BROADCAST_MESSAGE_MAX}`}>
            <V2Textarea id="bc-msg" rows={4} maxLength={BROADCAST_MESSAGE_MAX} value={f.message} onChange={(e) => set({ message: e.target.value })} />
          </V2Field>
          <V2Field label={t('Link (opcional)')} htmlFor="bc-link" error={f.link && errors.link} hint={t('Caminho interno, ex.: /torneios ou /ajuda.')}>
            <V2Input id="bc-link" maxLength={200} value={f.link} onChange={(e) => set({ link: e.target.value })} placeholder="/ajuda" />
          </V2Field>
        </div>

        <div className="space-y-3">
          <p className="text-xs font-semibold text-ink">{t('Quem recebe')}</p>
          {usuarios.isLoading ? <V2Skeleton lines={3} /> : usuarios.isError ? (
            <V2ErrorState inline title={t('A lista de contas não carregou')} description={t('Sem ela não dá para contar o público.')} onRetry={() => usuarios.refetch()} />
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                {AUDIENCIAS.map((a) => {
                  const n = platformRecipients(a, { users: usuarios.data, ...(a === f.audience ? f.detail : {}) }).length;
                  return (
                    <V2FilterChip key={a} active={f.audience === a} onClick={() => set({ audience: a })} title={t(PROMO_AUDIENCE_META[a].hint)}>
                      {t(PROMO_AUDIENCE_META[a].label)}{PROMO_AUDIENCE_META[a].needs ? '' : ` (${n})`}
                    </V2FilterChip>
                  );
                })}
              </div>
              {precisa === 'interest' && (
                <V2Field label={t('Interesse')} htmlFor="bc-interesse">
                  <V2Select id="bc-interesse" value={f.detail.interest} onChange={(e) => setDetail({ interest: e.target.value })}>
                    <option value="">{t('Escolha…')}</option>
                    {PLATFORM_INTEREST_META.map((m) => <option key={m.value} value={m.value}>{t(m.label)}</option>)}
                  </V2Select>
                </V2Field>
              )}
              {(precisa === 'state' || precisa === 'city') && (
                <div className="grid gap-2 sm:grid-cols-[8rem_minmax(0,1fr)]">
                  <V2Field label={t('Estado')} htmlFor="bc-uf">
                    <V2Select id="bc-uf" value={f.detail.state} onChange={(e) => setDetail({ state: e.target.value })}>
                      <option value="">{t('UF…')}</option>
                      {BR_UFS.map((u) => <option key={u} value={u}>{u}</option>)}
                    </V2Select>
                  </V2Field>
                  {precisa === 'city' && (
                    <V2Field label={t('Cidade')} htmlFor="bc-cidade">
                      <V2Input id="bc-cidade" maxLength={80} value={f.detail.city} onChange={(e) => setDetail({ city: e.target.value })} placeholder="Porto Alegre" />
                    </V2Field>
                  )}
                </div>
              )}
              <p className={`text-sm font-semibold ${destinatarios.length > 0 ? 'text-ink' : 'text-amber-700'}`}>
                {destinatarios.length > 0 ? tn(destinatarios.length, '{n} pessoa vai receber.', '{n} pessoas vão receber.') : t('Ninguém neste público ainda.')}
              </p>
            </>
          )}
        </div>
      </div>

      <div className="mt-4 flex justify-end">
        <V2Button disabled={!isValid || enviando} onClick={() => setConfirmar(true)}>
          <Send className="h-4 w-4" /> {t('Enviar para {n}', { n: destinatarios.length })}
        </V2Button>
      </div>

      <ConfirmDialog
        open={confirmar}
        onOpenChange={setConfirmar}
        title={tn(destinatarios.length, 'Enviar o aviso para {n} pessoa?', 'Enviar o aviso para {n} pessoas?')}
        description={t('Não dá para desfazer: o aviso entra no sino de cada uma agora.')}
        confirmLabel={t('Enviar')}
        loading={enviando}
        onConfirm={enviar}
      />
    </V2Surface>
  );
}
