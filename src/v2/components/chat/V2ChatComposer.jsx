import React, { useRef, useState } from 'react';
import { toast } from 'sonner';
import { Send } from 'lucide-react';
import {
  AttachmentAddButton,
  PendingAttachmentList,
  useAttachmentUploader,
} from '@/components/ui/attachments';
import { CHAT_LIMITS } from '@/modules/chat/domain/constants';
import { V2Button } from '@/v2/ui/primitives';

export default function V2ChatComposer({ onSend, disabled = false }) {
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
    <div className="border-t border-gray-100 bg-paper-pure p-3">
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
          className="max-h-40 min-h-[2.5rem] flex-1 resize-none rounded-2xl border border-gray-200 bg-paper px-4 py-2.5 text-sm text-ink outline-none placeholder:text-gray-400 focus-visible:ring-4 focus-visible:ring-acid/30"
        />
        <V2Button type="button" size="icon" className="shrink-0" onClick={submit} disabled={!canSend} aria-label="Enviar">
          <Send className="h-4 w-4" />
        </V2Button>
      </div>
    </div>
  );
}
