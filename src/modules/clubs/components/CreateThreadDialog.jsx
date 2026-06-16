import React, { useState } from 'react';
import { toast } from 'sonner';
import { MessagesSquare } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { MarkdownEditor } from '@/components/ui/markdown-editor';
import {
  AttachmentAddButton,
  PendingAttachmentList,
  useAttachmentUploader,
} from '@/components/ui/attachments';
import { FORUM_LIMITS } from '@/modules/clubs/domain/constants';
import { useCreateThread } from '@/modules/clubs/hooks/useClubForum';
import PollBuilder from './PollBuilder';

const EMPTY_POLL = { question: '', options: ['', ''], multiple: false, closesAt: '' };

export default function CreateThreadDialog({ clubId, open, onOpenChange, onCreated }) {
  const createThread = useCreateThread(clubId);
  const attachments = useAttachmentUploader({ folder: 'forum', max: FORUM_LIMITS.MAX_ATTACHMENTS });
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [pollEnabled, setPollEnabled] = useState(false);
  const [poll, setPoll] = useState(EMPTY_POLL);
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setTitle('');
    setBody('');
    setPollEnabled(false);
    setPoll(EMPTY_POLL);
    attachments.reset();
  };

  const handleOpenChange = (value) => {
    if (!value && !submitting) reset();
    onOpenChange?.(value);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error('Informe um título para o tópico.');
      return;
    }
    setSubmitting(true);
    try {
      const id = await createThread.mutateAsync({
        title,
        body,
        attachments: attachments.items,
        poll: pollEnabled ? poll : null,
      });
      toast.success('Tópico criado.');
      reset();
      onOpenChange?.(false);
      onCreated?.(id);
    } catch (err) {
      toast.error(err.message || 'Não foi possível criar o tópico.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessagesSquare className="h-5 w-5 text-emerald-700" /> Novo tópico
          </DialogTitle>
          <DialogDescription>
            Abra uma discussão para o clube. Use formatação rica, anexos e, se quiser, uma enquete.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="thread-title">Título *</Label>
            <Input
              id="thread-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={FORUM_LIMITS.TITLE_MAX}
              placeholder="Sobre o que é a discussão?"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label>Descrição</Label>
            <MarkdownEditor
              value={body}
              onChange={setBody}
              rows={6}
              maxLength={FORUM_LIMITS.BODY_MAX}
              placeholder="Detalhe o assunto. Use títulos, listas, tabelas, links…"
            />
          </div>

          <div className="space-y-2">
            <PendingAttachmentList items={attachments.items} onRemove={attachments.remove} />
            <AttachmentAddButton onFiles={attachments.pick} uploading={attachments.uploading} label="Anexar imagens ou arquivos" />
          </div>

          <div className="flex items-center justify-between gap-3 rounded-lg border border-emerald-950/10 bg-secondary/20 px-3 py-2">
            <div>
              <div className="text-sm font-medium text-slate-800">Adicionar enquete</div>
              <div className="text-xs text-slate-500">Colete a opinião do clube com uma votação.</div>
            </div>
            <Switch checked={pollEnabled} onCheckedChange={setPollEnabled} />
          </div>

          {pollEnabled && <PollBuilder value={poll} onChange={setPoll} />}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={submitting}>
              Cancelar
            </Button>
            <Button type="submit" disabled={submitting || attachments.uploading}>
              {submitting ? 'Publicando…' : 'Publicar tópico'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
