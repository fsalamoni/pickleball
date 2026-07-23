/**
 * V2ArenaPaymentTab — Aba admin de pagamento PIX (Sprint 5).
 *
 * Permite ao admin configurar:
 * - Tipo de chave PIX (CPF, CNPJ, e-mail, telefone, aleatória)
 * - Chave PIX
 * - QR code (URL da imagem)
 * - Nome do recebedor
 * - Descrição visível ao atleta
 * - Instruções adicionais
 */

import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { CreditCard, Save, Copy, Check, Image as ImageIcon, Lightbulb } from 'lucide-react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useArena, useUpdateArena } from '@/modules/arenas/hooks/useArenas';
import { normalizePixPayment, PIX_KEY_TYPES, PIX_KEY_TYPE_LABELS } from '@/modules/arenas/domain/pix_payment';
import {
  V2Badge, V2Button, V2Field, V2Input, V2Select, V2Surface, V2Textarea, V2Skeleton,
} from '@/v2/ui/primitives';

export default function V2ArenaPaymentTab() {
  const { arenaId } = useParams();
  const { user } = useAuth();
  const { data: arena, isLoading } = useArena(arenaId);
  const update = useUpdateArena();
  const [copied, setCopied] = useState(false);

  const initial = arena?.payment || {};
  const [form, setForm] = useState({
    pix_key: initial.pix_key || '',
    pix_key_type: initial.pix_key_type || PIX_KEY_TYPES.CPF,
    qr_code_url: initial.qr_code_url || '',
    receiver_name: initial.receiver_name || '',
    description: initial.description || '',
    instructions: initial.instructions || '',
    active: initial.active !== false,
  });
  const setField = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const handleSave = async (e) => {
    e.preventDefault();
    const { valid, error, value } = normalizePixPayment(form);
    if (!valid) return toast.error(error);
    try {
      await update.mutateAsync({ id: arenaId, updates: { payment: value } });
      toast.success('Configuração de pagamento salva!');
    } catch (err) {
      toast.error(err.message);
    }
  };

  async function copyPix() {
    if (!form.pix_key) return;
    try {
      await navigator.clipboard.writeText(form.pix_key);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success('Chave PIX copiada!');
    } catch (err) {
      toast.error('Não foi possível copiar.');
    }
  }

  if (isLoading) return <V2Skeleton lines={4} />;
  if (!arena) return null;

  return (
    <div className="space-y-4">
      <V2Surface>
        <h3 className="font-display text-lg font-bold text-ink flex items-center gap-2">
          <CreditCard className="h-5 w-5 text-emerald-700" /> Pagamento via PIX
        </h3>
        <p className="mt-1 text-sm text-gray-500">
          Configure como o atleta pode te pagar via PIX. Os dados aparecerão na página pública da arena.
        </p>

        <form onSubmit={handleSave} className="mt-4 space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <V2Field label="Tipo de chave PIX">
              <V2Select value={form.pix_key_type} onChange={setField('pix_key_type')}>
                {Object.entries(PIX_KEY_TYPE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </V2Select>
            </V2Field>
            <V2Field label="Chave PIX">
              <V2Input
                value={form.pix_key}
                onChange={setField('pix_key')}
                placeholder={
                  form.pix_key_type === 'cpf' ? '000.000.000-00' :
                  form.pix_key_type === 'cnpj' ? '00.000.000/0000-00' :
                  form.pix_key_type === 'email' ? 'seu@email.com' :
                  form.pix_key_type === 'phone' ? '(11) 98765-4321' :
                  'chave-aleatoria-32-chars-min'
                }
              />
            </V2Field>
          </div>

          <V2Field label="Nome do recebedor" hint="Aparece no comprovante do atleta">
            <V2Input
              value={form.receiver_name}
              onChange={setField('receiver_name')}
              maxLength={80}
              placeholder="Ex: Arena XPTO LTDA"
            />
          </V2Field>

          <V2Field label="URL do QR Code (imagem)" hint="Faça upload da imagem do QR em outro lugar e cole a URL aqui">
            <V2Input
              value={form.qr_code_url}
              onChange={setField('qr_code_url')}
              maxLength={500}
              placeholder="https://exemplo.com/meu-qr.png"
            />
          </V2Field>

          {form.qr_code_url && (
            <div className="rounded-2xl border border-gray-200 bg-paper p-3">
              <p className="mb-2 text-xs font-bold uppercase tracking-widest text-gray-500">Pré-visualização do QR</p>
              <img
                src={form.qr_code_url}
                alt="QR Code PIX"
                className="max-w-[200px] rounded-2xl border border-gray-200 bg-white p-2"
                onError={(e) => { e.target.style.display = 'none'; toast.error('URL inválida para imagem.'); }}
              />
            </div>
          )}

          <V2Field label="Descrição (opcional)" hint="Visível ao atleta na página da arena">
            <V2Textarea
              value={form.description}
              onChange={setField('description')}
              rows={2}
              maxLength={500}
              placeholder="Ex: Aceitamos PIX para pagamento de reservas e produtos da loja."
            />
          </V2Field>

          <V2Field label="Instruções (opcional)" hint="Como pagar, prazo, confirmação, etc.">
            <V2Textarea
              value={form.instructions}
              onChange={setField('instructions')}
              rows={3}
              maxLength={800}
              placeholder="1. Abra o app do seu banco&#10;2. Escaneie o QR ou copie a chave&#10;3. Envie o comprovante por aqui"
            />
          </V2Field>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.active} onChange={setField('active')} />
            Pagamento PIX ativo e visível ao público
          </label>

          <div className="flex justify-end pt-2">
            <V2Button type="submit" disabled={update.isPending}>
              <Save className="h-4 w-4" /> {update.isPending ? 'Salvando…' : 'Salvar'}
            </V2Button>
          </div>
        </form>
      </V2Surface>

      <V2Surface className="border-emerald-200 bg-emerald-50/40">
        <h4 className="flex items-center gap-1.5 font-display text-sm font-bold text-ink"><Lightbulb className="h-4 w-4 text-gray-400" /> Como obter seu QR Code</h4>
        <ol className="mt-2 list-decimal pl-5 text-sm text-gray-600 space-y-1">
          <li>Abra o app do seu banco (inter, Nubank, Itaú, Bradesco, etc.)</li>
          <li>Vá em PIX → &quot;Cobrar&quot; ou &quot;Receber&quot;</li>
          <li>Salve o QR Code como imagem (print ou share)</li>
          <li>Faça upload no Drive, Dropbox, ou similar</li>
          <li>Cole a URL pública da imagem acima</li>
        </ol>
      </V2Surface>
    </div>
  );
}
