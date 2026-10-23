/**
 * RECEBIMENTO AUTOMÁTICO (Bloco 6a): o financeiro liga o Pix com baixa
 * automática colando a chave da CONTA DA FEDERAÇÃO no Mercado Pago ou no
 * Asaas. A chave vai só para o servidor (`federationPayments`): a tela vê
 * "configurada …1234" e nunca a chave. Desligado, vale o Pix da chave acima.
 */
import React, { useState } from 'react';
import { toast } from 'sonner';
import { Zap } from 'lucide-react';
import { federationPayments } from '@/modules/federations/services/federationService';
import { useFederationGateway, useFederationMutation } from '@/modules/federations/hooks/useFederations';
import { V2Badge, V2Button, V2ErrorState, V2Field, V2Input, V2Select, V2Skeleton, V2Surface, V2Toggle } from '@/v2/ui/primitives';
import CopyCodeButton from '@/v2/ui/CopyCodeButton';
import { t, tk } from '@/core/i18n';

const PROVEDORES = {
  mercadopago: { nome: 'Mercado Pago', campo: tk('Access token de produção'), dica: tk('Mercado Pago → Seu negócio → Configurações → Credenciais de produção → Access token.') },
  asaas: { nome: 'Asaas', campo: tk('Chave de API'), dica: tk('Asaas → Integrações → Chave de API. O Asaas exige o CPF de quem paga: ligue "Pedir o CPF na filiação" nas regras.') },
};

export default function FedPaymentGateway({ federation }) {
  const q = useFederationGateway(federation.id);
  const [provider, setProvider] = useState('mercadopago');
  const [key, setKey] = useState('');
  const [sandbox, setSandbox] = useState(false);
  const [erro, setErro] = useState('');
  const salvar = useFederationMutation(() => federationPayments({ action: 'gateway_save', federationId: federation.id, provider, key: key.trim(), sandbox }));
  const desligar = useFederationMutation(() => federationPayments({ action: 'gateway_off', federationId: federation.id }));
  const atual = q.data;

  const enviar = (e) => {
    e.preventDefault();
    if (key.trim().length < 16) { setErro(t('Cole a chave completa do provedor.')); return; }
    salvar.mutate(undefined, {
      onSuccess: () => { setKey(''); setErro(''); toast.success(t('Recebimento automático ligado. As cobranças passam a ser confirmadas sozinhas.')); },
      onError: (er) => setErro(er.message),
    });
  };

  return (
    <section className="space-y-3" aria-label={t('Recebimento automático')} data-dica="federacao-pix-automatico">
      <div>
        <h3 className="flex items-center gap-2 font-display text-lg font-bold text-ink"><Zap className="h-4 w-4" aria-hidden="true" />{t('Confirmação automática (opcional)')}</h3>
        <p className="text-sm text-gray-500">{t('Com a conta da federação no Mercado Pago ou no Asaas, cada cobrança ganha um Pix próprio e fica paga sozinha quando o banco confirma — sem "Já paguei" para conferir. O dinheiro cai na conta da federação; as taxas são as do provedor.')}</p>
      </div>
      <V2Surface className="space-y-4">
        {q.isLoading && <V2Skeleton className="h-16" />}
        {q.isError && <V2ErrorState inline onRetry={q.refetch} />}
        {atual?.enabled && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <V2Badge tone="green">{t('Ligado')}</V2Badge>
              <span className="text-sm font-semibold text-ink">{PROVEDORES[atual.provider]?.nome}</span>
              <span className="text-sm text-gray-500">{t('chave {fim}', { fim: atual.hint })}</span>
              {atual.sandbox && <V2Badge tone="amber">{t('ambiente de teste')}</V2Badge>}
            </div>
            {!atual.webhook_auto && atual.webhook_url && (
              <div className="space-y-1 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
                <p>{t('Falta um passo no Asaas: em Integrações → Webhooks, crie um webhook de cobranças com este endereço (eventos "Cobrança recebida" e "Cobrança confirmada").')}</p>
                <CopyCodeButton code={atual.webhook_url} label={t('Copiar o endereço do webhook')} className="max-w-full truncate" />
              </div>
            )}
            <p className="text-xs text-gray-500">{t('Se o provedor ficar fora do ar, a cobrança mostra o Pix da chave da federação e o financeiro confirma como antes.')}</p>
            <V2Button
              type="button" size="sm" variant="ghost" disabled={desligar.isPending}
              onClick={() => desligar.mutate(undefined, { onSuccess: () => toast.success(t('Recebimento automático desligado. Vale o Pix da chave.')), onError: (er) => toast.error(er.message) })}
            >
              {t('Desligar e apagar a chave')}
            </V2Button>
          </div>
        )}
        {q.isSuccess && (
          <form onSubmit={enviar} noValidate className="space-y-4">
            {atual?.enabled && <p className="text-sm font-semibold text-ink">{t('Trocar a chave ou o provedor')}</p>}
            <div className="grid gap-4 sm:grid-cols-[12rem_1fr]">
              <V2Field label={t('Provedor')} htmlFor="gw-prov">
                <V2Select id="gw-prov" value={provider} onChange={(e) => { setProvider(e.target.value); setErro(''); }}>
                  {Object.entries(PROVEDORES).map(([v, p]) => <option key={v} value={v}>{p.nome}</option>)}
                </V2Select>
              </V2Field>
              <V2Field label={t(PROVEDORES[provider].campo)} htmlFor="gw-chave" hint={t(PROVEDORES[provider].dica)} error={erro} required>
                <V2Input id="gw-chave" type="password" autoComplete="off" maxLength={400} value={key} onChange={(e) => { setKey(e.target.value); setErro(''); }} />
              </V2Field>
            </div>
            {provider === 'asaas' && <V2Toggle id="gw-sandbox" checked={sandbox} onChange={setSandbox} label={t('Conta de teste (sandbox do Asaas)')} />}
            <div className="flex justify-end"><V2Button type="submit" disabled={salvar.isPending}>{salvar.isPending ? t('Conferindo a chave…') : t('Ligar a confirmação automática')}</V2Button></div>
          </form>
        )}
      </V2Surface>
    </section>
  );
}
