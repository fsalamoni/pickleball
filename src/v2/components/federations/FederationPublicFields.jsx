/**
 * Os campos PÚBLICOS da federação (nome, sigla, endereço, abrangência, sobre,
 * contato): o mesmo formulário no pedido de abertura e em Configurações →
 * Página. Controlado de fora (`f`, `set`, `setNome`, `erros`).
 */
import React from 'react';
import { BR_UFS } from '@/core/domain/ufs';
import { FEDERATION_LEVEL, FEDERATION_LEVEL_LABELS } from '@/modules/federations/domain/constants';
import { V2Field, V2Input, V2Select, V2Surface, V2Textarea } from '@/v2/ui/primitives';
import { t } from '@/core/i18n';
import { publicHost } from './federationUi';

export default function FederationPublicFields({ f, set, setNome, erros, setSlugManual = () => {} }) {
  const nacional = f.level === FEDERATION_LEVEL.NATIONAL;
  return (
    <>
      <V2Surface className="space-y-4">
        <h2 className="font-display text-lg font-bold text-ink">{t('A federação')}</h2>
        <V2Field label={t('Nome completo')} htmlFor="fd-nome" error={erros.name} hint={t('Ex.: Federação Paulista de Pickleball.')} required>
          <V2Input id="fd-nome" maxLength={120} value={f.name} onChange={(e) => setNome(e.target.value)} />
        </V2Field>
        <div className="grid gap-4 sm:grid-cols-[8rem_1fr]">
          <V2Field label={t('Sigla')} htmlFor="fd-sigla" error={erros.acronym} required>
            <V2Input id="fd-sigla" maxLength={12} value={f.acronym} onChange={(e) => set({ acronym: e.target.value.toUpperCase() })} />
          </V2Field>
          <V2Field label={t('Endereço da página pública')} htmlFor="fd-slug" error={erros.slug} hint={t('{host}/f/{slug}', { host: publicHost(), slug: f.slug || 'sua-sigla' })}>
            <V2Input id="fd-slug" maxLength={60} value={f.slug} onChange={(e) => { setSlugManual(true); set({ slug: e.target.value.toLowerCase() }); }} />
          </V2Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <V2Field label={t('Abrangência')} htmlFor="fd-nivel">
            <V2Select id="fd-nivel" value={f.level} onChange={(e) => set({ level: e.target.value })}>
              {Object.values(FEDERATION_LEVEL).map((l) => <option key={l} value={l}>{t(FEDERATION_LEVEL_LABELS[l])}</option>)}
            </V2Select>
          </V2Field>
          {!nacional && (
            <V2Field label={t('UF')} htmlFor="fd-uf" error={erros.state} required>
              <V2Select id="fd-uf" value={f.state} onChange={(e) => set({ state: e.target.value })}>
                <option value="">{t('Escolha')}</option>
                {BR_UFS.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
              </V2Select>
            </V2Field>
          )}
          <V2Field label={t('Cidade sede')} htmlFor="fd-cidade">
            <V2Input id="fd-cidade" maxLength={80} value={f.city} onChange={(e) => set({ city: e.target.value })} />
          </V2Field>
        </div>
        <V2Field label={t('Sobre a federação')} htmlFor="fd-sobre" hint={t('O que ela faz, desde quando, quem representa. Aparece na página pública. Até 2000 caracteres.')}>
          <V2Textarea id="fd-sobre" rows={5} maxLength={2000} value={f.about} onChange={(e) => set({ about: e.target.value })} />
        </V2Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <V2Field label={t('Site')} htmlFor="fd-site" error={erros.site}>
            <V2Input id="fd-site" type="url" maxLength={200} placeholder="https://" value={f.site} onChange={(e) => set({ site: e.target.value })} />
          </V2Field>
          <V2Field label={t('Instagram')} htmlFor="fd-insta">
            <V2Input id="fd-insta" maxLength={60} placeholder="@" value={f.instagram} onChange={(e) => set({ instagram: e.target.value })} />
          </V2Field>
        </div>
      </V2Surface>

      <V2Surface className="space-y-4">
        <h2 className="font-display text-lg font-bold text-ink">{t('Contato público')}</h2>
        <p className="text-sm text-gray-500">{t('Aparece na página da federação para quem quer se filiar.')}</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <V2Field label={t('E-mail')} htmlFor="fd-email" error={erros.contact_email} required>
            <V2Input id="fd-email" type="email" maxLength={120} value={f.contact_email} onChange={(e) => set({ contact_email: e.target.value })} />
          </V2Field>
          <V2Field label={t('Telefone ou WhatsApp')} htmlFor="fd-fone">
            <V2Input id="fd-fone" type="tel" maxLength={30} value={f.contact_phone} onChange={(e) => set({ contact_phone: e.target.value })} />
          </V2Field>
        </div>
      </V2Surface>
    </>
  );
}
