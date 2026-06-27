import React, { useRef, useState } from 'react';
import { toPng } from 'html-to-image';
import { toast } from 'sonner';
import { Trophy, Download, Medal } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const TYPES = [
  { value: 'participation', label: 'Participação', heading: 'Certificado de Participação' },
  { value: 'champion', label: 'Campeão', heading: 'Certificado de Campeão' },
];

/**
 * Gera um certificado/diploma do torneio (imagem para download) reusando
 * `html-to-image`. Client-side, sem dados novos.
 */
export default function CertificateDialog({ tournament, open, onOpenChange }) {
  const ref = useRef(null);
  const [name, setName] = useState('');
  const [type, setType] = useState('participation');
  const [busy, setBusy] = useState(false);
  const heading = TYPES.find((t) => t.value === type)?.heading || TYPES[0].heading;
  const place = [tournament?.city, tournament?.state].filter(Boolean).join(' / ');

  async function handleDownload() {
    if (!ref.current) return;
    setBusy(true);
    try {
      const dataUrl = await toPng(ref.current, { pixelRatio: 2, cacheBust: true });
      const link = document.createElement('a');
      const safe = String(name || 'certificado').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      link.download = `certificado-${safe || 'pickleholics'}.png`;
      link.href = dataUrl;
      link.click();
      toast.success('Certificado gerado!');
    } catch {
      toast.error('Não foi possível gerar o certificado.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Gerar certificado</DialogTitle>
          <DialogDescription>Preencha seu nome e baixe o diploma do torneio.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="cert_name">Seu nome</Label>
            <Input id="cert_name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome completo" maxLength={60} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cert_type">Tipo</Label>
            <select
              id="cert_type"
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
        </div>

        {/* Certificado capturável */}
        <div
          ref={ref}
          className="relative overflow-hidden rounded-lg border-4 border-emerald-700 bg-gradient-to-br from-white to-emerald-50 p-6 text-center"
        >
          <div className="flex items-center justify-center gap-2 text-emerald-700">
            {type === 'champion' ? <Medal className="h-6 w-6" /> : <Trophy className="h-6 w-6" />}
            <span className="text-sm font-semibold uppercase tracking-[0.2em]">Pickleholics</span>
          </div>
          <h3 className="mt-3 text-lg font-bold text-emerald-800">{heading}</h3>
          <p className="mt-3 text-sm text-slate-600">Certificamos que</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{name || 'Seu nome'}</p>
          <p className="mt-2 text-sm text-slate-600">
            {type === 'champion' ? 'foi campeão(ã) do torneio' : 'participou do torneio'}
          </p>
          <p className="mt-1 text-lg font-semibold text-emerald-800">{tournament?.name || 'Torneio de Pickleball'}</p>
          {place && <p className="mt-1 text-xs text-slate-500">{place}</p>}
        </div>

        <Button onClick={handleDownload} disabled={busy} className="w-full">
          <Download className="h-4 w-4" /> <span className="ml-1">{busy ? 'Gerando…' : 'Baixar certificado'}</span>
        </Button>
      </DialogContent>
    </Dialog>
  );
}
