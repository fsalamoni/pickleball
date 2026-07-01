import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

/**
 * Campos do perfil da arena (controlados). Reutilizado em criar e editar.
 * @param {{ form: object, setField: (key:string)=>(e)=>void, errors?: object }} props
 */
export default function ProfileFields({ form, setField, errors = {} }) {
  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="arena-name">Nome da arena *</Label>
        <Input id="arena-name" value={form.name} onChange={setField('name')} maxLength={120} />
        {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name}</p>}
      </div>

      <div>
        <Label htmlFor="arena-desc">Descrição</Label>
        <textarea
          id="arena-desc"
          value={form.description}
          onChange={setField('description')}
          rows={3}
          maxLength={2000}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          placeholder="Estrutura, quadras, iluminação, estacionamento, etc."
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="arena-address">Endereço</Label>
          <Input id="arena-address" value={form.address} onChange={setField('address')} maxLength={240} />
        </div>
        <div>
          <Label htmlFor="arena-neighborhood">Bairro</Label>
          <Input id="arena-neighborhood" value={form.neighborhood} onChange={setField('neighborhood')} maxLength={120} />
        </div>
        <div>
          <Label htmlFor="arena-city">Cidade</Label>
          <Input id="arena-city" value={form.city} onChange={setField('city')} maxLength={80} />
        </div>
        <div>
          <Label htmlFor="arena-state">Estado (UF)</Label>
          <Input id="arena-state" value={form.state} onChange={setField('state')} maxLength={2} placeholder="SP" />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="arena-phone">Telefone</Label>
          <Input id="arena-phone" value={form.contact_phone} onChange={setField('contact_phone')} maxLength={40} />
        </div>
        <div>
          <Label htmlFor="arena-whatsapp">WhatsApp</Label>
          <Input id="arena-whatsapp" value={form.contact_whatsapp} onChange={setField('contact_whatsapp')} maxLength={40} placeholder="(11) 90000-0000" />
        </div>
        <div>
          <Label htmlFor="arena-email">E-mail</Label>
          <Input id="arena-email" type="email" value={form.contact_email} onChange={setField('contact_email')} maxLength={160} />
          {errors.contact_email && <p className="mt-1 text-xs text-red-600">{errors.contact_email}</p>}
        </div>
        <div>
          <Label htmlFor="arena-instagram">Instagram</Label>
          <Input id="arena-instagram" value={form.instagram} onChange={setField('instagram')} placeholder="@suaarena" />
        </div>
        <div>
          <Label htmlFor="arena-website">Site</Label>
          <Input id="arena-website" value={form.website} onChange={setField('website')} placeholder="https://..." />
        </div>
        <div>
          <Label htmlFor="arena-courts">Nº de quadras</Label>
          <Input id="arena-courts" type="number" min="0" value={form.court_count} onChange={setField('court_count')} />
        </div>
      </div>

      <div>
        <Label htmlFor="arena-hours">Horário de funcionamento</Label>
        <Input id="arena-hours" value={form.hours} onChange={setField('hours')} maxLength={400} placeholder="Seg–Sex 6h–23h · Sáb–Dom 7h–20h" />
      </div>
    </div>
  );
}
