/**
 * "Associação do clube": liga o modo associação, abre ao público e define a
 * apresentação (texto e cor). Ligar não publica nada: o clube prepara planos e
 * Pix antes e só então abre — publicado, a página pública passa a mostrar os
 * planos. Tirar do ar volta a ocultar sem apagar nada.
 */
import React, { useState } from 'react';
import { toast } from 'sonner';
import { ExternalLink } from 'lucide-react';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { normalizeAssociation } from '@/modules/clubs/domain/association';
import { useSaveAssociationSettings } from '@/modules/clubs/hooks/useClubAssociation';
import { normalizeHex } from '@/modules/arenas/domain/whiteLabel';
import { V2Button, V2Field, V2Input, V2Surface, V2Textarea, V2Toggle } from '@/v2/ui/primitives';
import { t } from '@/core/i18n';

export default function ClubSettingsPanel({ club }) {
  const cfg = normalizeAssociation(club);
  const salvar = useSaveAssociationSettings(club.id);
  const [intro, setIntro] = useState(cfg.intro);
  const [cor, setCor] = useState(cfg.color);
  const [tirar, setTirar] = useState(false);
  const corValida = !cor || Boolean(normalizeHex(cor));

  const aplicar = (patch, ok) => salvar.mutate(patch, { onSuccess: () => toast.success(ok), onError: (er) => toast.error(er.message) });

  return (
    <section className="space-y-5" aria-label={t('Associação do clube')} data-dica="clube-config">
      <V2Surface className="space-y-4">
        <V2Toggle
          id="assoc-enabled"
          checked={cfg.enabled}
          disabled={salvar.isPending}
          onChange={(v) => aplicar({ enabled: v, ...(v ? {} : { published: false }) }, v ? t('Associação ligada. Prepare os planos e o Pix antes de abrir ao público.') : t('Associação desligada.'))}
          label={t('Este clube é uma associação')}
          hint={t('Liga planos de filiação, carteirinha, cobrança Pix e a gestão de associados. Os membros e tudo o que o clube já tem continuam como estão.')}
        />
        <div className="border-t border-gray-100 pt-4">
          <V2Toggle
            id="assoc-published"
            checked={cfg.published}
            disabled={!cfg.enabled || salvar.isPending}
            onChange={(v) => (v ? aplicar({ published: true }, t('A associação está aberta ao público.')) : setTirar(true))}
            label={t('Aberta ao público')}
            hint={cfg.enabled ? t('Aberta, qualquer pessoa vê os planos na página do clube e pode pedir associação. Também deixa a página pública do clube no ar.') : t('Ligue a associação primeiro.')}
          />
        </div>
        {cfg.published && (
          <V2Button asChild size="sm" variant="ghost">
            <a href={`/c/${club.id}`} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4" />{t('Ver a página pública')}</a>
          </V2Button>
        )}
      </V2Surface>

      <V2Surface>
        <form
          className="space-y-4"
          onSubmit={(e) => { e.preventDefault(); if (corValida) aplicar({ intro, color: cor }, t('Apresentação salva.')); }}
        >
          <V2Field label={t('Apresentação do clube')} htmlFor="assoc-intro" hint={t('Aparece acima dos planos. Conte o que o associado ganha e como funciona.')}>
            <V2Textarea id="assoc-intro" rows={4} maxLength={600} value={intro} onChange={(e) => setIntro(e.target.value)} disabled={!cfg.enabled} />
          </V2Field>
          <V2Field label={t('Cor do clube')} htmlFor="assoc-cor" error={corValida ? '' : t('Use uma cor no formato #RRGGBB.')} hint={t('Pinta o topo da carteirinha e o filete dos planos.')}>
            <div className="flex items-center gap-3">
              <V2Input id="assoc-cor" className="max-w-[10rem]" value={cor} placeholder="#0F766E" onChange={(e) => setCor(e.target.value)} disabled={!cfg.enabled} />
              {corValida && cor && <span className="h-9 w-9 rounded-full border border-gray-200" style={{ backgroundColor: normalizeHex(cor) }} aria-hidden="true" />}
            </div>
          </V2Field>
          <div className="flex justify-end"><V2Button type="submit" disabled={!cfg.enabled || salvar.isPending || !corValida}>{salvar.isPending ? t('Salvando…') : t('Salvar apresentação')}</V2Button></div>
        </form>
      </V2Surface>

      <ConfirmDialog
        open={tirar}
        onOpenChange={setTirar}
        title={t('Tirar a associação do ar?')}
        description={t('Os planos somem da página do clube e ninguém novo consegue pedir associação. Quem já é associado continua, com carteirinha e cobranças. Você pode abrir de novo quando quiser.')}
        confirmLabel={t('Tirar do ar')}
        onConfirm={() => { setTirar(false); aplicar({ published: false }, t('A associação saiu do ar.')); }}
      />
    </section>
  );
}
