import React, { useRef, useState } from 'react';
import { toast } from 'sonner';
import { Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  AttachmentAddButton,
  PendingAttachmentList,
  useAttachmentUploader,
} from '@/components/ui/attachments';
import { CHAT_LIMITS } from '@/modules/chat/domain/constants';

/**
 * Caixa de composição de mensagens: texto + anexos (imagens e documentos).
 * Enter envia; Shift+Enter quebra linha.
 */
export default function ChatComposer({ onSend, disabled = false }) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const { items, uploading, pick, remove, reset } = useAttachmentUploader({ folder: 'chat', max: CHAT_LIMITS.MAX_ATTACHMENTS });
  const textareaRef = useRef(null);

  const canSend = (text.trim() || items.length > 0) && !sending && !uploading && !disabled;

  const submit = async () => {
    if (!canSend) return;
    setSending(true);
    try {
      await onSend({ text, attachments: items });
      setText('');
      reset();
      requestAnimationFrame(() => textareaRef.current?.focus());
    } catch (err) {
      toast.error(err.message || 'Não foi possível enviar a mensagem.');
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div className="border-t border-emerald-950/10 bg-white/80 p-3">
      <PendingAttachmentList items={items} onRemove={remove} className="mb-2" />
      <div className="flex items-end gap-2">
        <AttachmentAddButton onFiles={pick} uploading={uploading} disabled={disabled} iconOnly label="Anexar arquivo ou imagem" />
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, CHAT_LIMITS.MESSAGE_MAX_CHARS))}
          onKeyDown={handleKeyDown}
          rows={1}
          disabled={disabled}
          placeholder="Escreva uma mensagem…"
          className="max-h-40 min-h-[2.5rem] flex-1 resize-none rounded-2xl border border-input bg-background px-4 py-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <Button type="button" size="icon" className="h-10 w-10 shrink-0 rounded-full" onClick={submit} disabled={!canSend} aria-label="Enviar">
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
