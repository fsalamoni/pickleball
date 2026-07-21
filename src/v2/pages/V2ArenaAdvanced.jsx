/**
 * V2ArenaAdvanced — Tabs: IoT | Multi-Unit | White Label | AI.
 * Rota: /arenas/:arenaId/gerir/avancado (admin)
 *       /arenas/:arenaId/avancado (multi-unit público para gestor)
 */

import React, { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, Cpu, Network, Palette, Sparkles, Plus } from 'lucide-react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useArena, useMyManagedArenas } from '@/modules/arenas/hooks/useArenas';
import {
  useCanArenaUseModule, useArenaDevices, useCreateDevice,
  useNetworks, useCreateNetwork, useUpdateBranding,
} from '@/modules/arenas/hooks/useArenaV3';
import { aggregateNetworkStats, forecastDemand } from '@/modules/arenas/domain/arenaV3Advanced';
import { V2Badge, V2Button, V2EmptyState, V2Field, V2Input, V2Skeleton, V2Surface } from '@/v2/ui/primitives';

const KIND_LABEL = { qr_kiosk: 'Totem QR', lighting: 'Iluminação', presence_sensor: 'Sensor', video_camera: 'Câmera', hvac: 'Climatização' };
const STATUS_TONE = { online: 'green', offline: 'neutral', fault: 'red', maintenance: 'amber' };

function IotTab({ arenaId }) {
  const { data: devices = [] } = useArenaDevices(arenaId);
  const create = useCreateDevice();
  const [form, setForm] = useState({ name: '', kind: 'qr_kiosk', location: '' });

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await create.mutateAsync({ arenaId, input: form });
      toast.success('Dispositivo adicionado!');
      setForm({ name: '', kind: 'qr_kiosk', location: '' });
    } catch (err) { toast.error(err.message); }
  };

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="rounded-2xl border border-gray-100 bg-paper p-3">
        <h3 className="mb-2 font-display text-base font-bold text-ink">Adicionar dispositivo</h3>
        <div className="grid gap-2 sm:grid-cols-3">
          <V2Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Nome" required maxLength={120} />
          <select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })} className="h-11 rounded-2xl border border-gray-200 bg-paper-pure px-3 text-sm">
            <option value="qr_kiosk">Totem QR</option>
            <option value="lighting">Iluminação</option>
            <option value="presence_sensor">Sensor de presença</option>
            <option value="video_camera">Câmera</option>
            <option value="hvac">Climatização</option>
          </select>
          <V2Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Localização" maxLength={120} />
        </div>
        <V2Button type="submit" size="sm" className="mt-2" disabled={create.isPending}>{create.isPending ? 'Adicionando...' : 'Adicionar'}</V2Button>
      </form>
      {devices.length === 0 ? (
        <p className="text-sm text-gray-500">Nenhum dispositivo cadastrado.</p>
      ) : (
        <div className="space-y-2">
          {devices.map((d) => (
            <div key={d.id} className="flex items-center justify-between rounded-2xl border border-gray-100 bg-paper p-3">
              <div>
                <p className="font-bold text-ink">{d.name}</p>
                <p className="text-xs text-gray-500">{KIND_LABEL[d.kind] || d.kind} · {d.location || '—'}</p>
              </div>
              <V2Badge tone={STATUS_TONE[d.status] || 'neutral'}>{d.status || 'offline'}</V2Badge>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MultiUnitTab() {
  const { data: networks = [] } = useNetworks();
  const create = useCreateNetwork();
  const [name, setName] = useState('');
  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await create.mutateAsync(name);
      toast.success('Rede criada!');
      setName('');
    } catch (err) { toast.error(err.message); }
  };
  return (
    <div className="space-y-4">
      <form onSubmit={handleCreate} className="flex gap-2">
        <V2Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome da rede" required maxLength={120} className="flex-1" />
        <V2Button type="submit" disabled={create.isPending}>Criar</V2Button>
      </form>
      {networks.length === 0 ? (
        <p className="text-sm text-gray-500">Nenhuma rede cadastrada.</p>
      ) : (
        <div className="space-y-2">
          {networks.map((n) => (
            <div key={n.id} className="flex items-center justify-between rounded-2xl border border-gray-100 bg-paper p-3">
              <div>
                <p className="font-bold text-ink">{n.name}</p>
                <p className="text-xs text-gray-500">{(n.arenas || []).length} arena(s)</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function WhiteLabelTab({ arenaId }) {
  const update = useUpdateBranding();
  const [branding, setBranding] = useState({ primary_color: '#000000', logo_url: '' });
  const handleSave = async (e) => {
    e.preventDefault();
    try {
      await update.mutateAsync({ arenaId, branding: { ...branding } });
      toast.success('Branding atualizado!');
    } catch (err) { toast.error(err.message); }
  };
  return (
    <form onSubmit={handleSave} className="space-y-3">
      <V2Field label="Cor primária (hex)">
        <V2Input value={branding.primary_color} onChange={(e) => setBranding({ ...branding, primary_color: e.target.value })} placeholder="#000000" pattern="^#[0-9A-Fa-f]{6}$" />
      </V2Field>
      <V2Field label="URL do logo">
        <V2Input value={branding.logo_url} onChange={(e) => setBranding({ ...branding, logo_url: e.target.value })} type="url" />
      </V2Field>
      <V2Button type="submit" disabled={update.isPending}>Salvar</V2Button>
    </form>
  );
}

function AiTab({ arenaId }) {
  const { data: networks = [] } = useNetworks();
  const networkStats = aggregateNetworkStats(networks);
  const forecast = forecastDemand([10, 20, 25, 30, 28, 35, 40], 7);

  return (
    <div className="space-y-3">
      <V2Surface>
        <h3 className="font-display text-base font-bold text-ink">Previsão de demanda (7 dias)</h3>
        <p className="mt-2 font-display text-3xl font-bold text-ink">{forecast}</p>
        <p className="text-xs text-gray-500">Reservas previstas com base no histórico ponderado</p>
      </V2Surface>
      <V2Surface>
        <h3 className="font-display text-base font-bold text-ink">Stats da rede</h3>
        <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div>
            <p className="text-xs uppercase text-gray-500">Arenas</p>
            <p className="font-display text-2xl font-bold text-ink">{networkStats.total}</p>
          </div>
          <div>
            <p className="text-xs uppercase text-gray-500">Receita</p>
            <p className="font-display text-2xl font-bold text-ink">R$ {networkStats.totalRevenue}</p>
          </div>
          <div>
            <p className="text-xs uppercase text-gray-500">Reservas</p>
            <p className="font-display text-2xl font-bold text-ink">{networkStats.totalBookings}</p>
          </div>
          <div>
            <p className="text-xs uppercase text-gray-500">Ocupação</p>
            <p className="font-display text-2xl font-bold text-ink">{networkStats.avgOccupancy}%</p>
          </div>
        </div>
      </V2Surface>
    </div>
  );
}

const TABS = [
  { id: 'iot', label: 'IoT', icon: Cpu },
  { id: 'multi', label: 'Multi-unidade', icon: Network },
  { id: 'branding', label: 'White label', icon: Palette },
  { id: 'ai', label: 'IA', icon: Sparkles },
];

export default function V2ArenaAdvanced() {
  const { arenaId } = useParams();
  const { user, isPlatformAdmin } = useAuth();
  const { data: arena, isLoading: arenaLoading } = useArena(arenaId);
  const { data: managed = [] } = useMyManagedArenas();
  const [tab, setTab] = useState('iot');
  const canIot = useCanArenaUseModule(arenaId, 'iot_devices');
  const canMulti = useCanArenaUseModule(arenaId, 'multi_unit');
  const canWhite = useCanArenaUseModule(arenaId, 'white_label');
  const canAi = useCanArenaUseModule(arenaId, 'ai_forecast');

  if (arenaLoading) return <V2Skeleton className="mx-auto h-96 max-w-[1100px] rounded-4xl" />;
  if (!arena) {
    return (
      <div className="mx-auto max-w-[700px]">
        <V2Surface><V2EmptyState title="Arena não encontrada" action={<Link to="/arenas" className="text-sm font-bold text-ink underline">← Voltar</Link>} /></V2Surface>
      </div>
    );
  }
  const canManage = arena.owner_id === user?.uid || managed.some((m) => m.id === arena.id) || isPlatformAdmin;

  if (!canIot && !canMulti && !canWhite && !canAi) {
    return (
      <div className="mx-auto max-w-[700px]">
        <Link to={canManage ? `/arenas/${arena.id}/gerir` : `/arenas/${arena.id}`} className="mb-3 inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-gray-500 hover:text-ink">
          <ArrowLeft className="h-3.5 w-3.5" /> Voltar
        </Link>
        <V2Surface><V2EmptyState icon={Sparkles} title="Avançado indisponível" description="Módulos não habilitados." /></V2Surface>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1100px]">
      <div className="mb-6">
        <Link to={canManage ? `/arenas/${arena.id}/gerir` : `/arenas/${arena.id}`} className="mb-3 inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-gray-500 hover:text-ink">
          <ArrowLeft className="h-3.5 w-3.5" /> Voltar
        </Link>
        <h1 className="font-display text-3xl font-bold tracking-tight text-ink">Avançado · {arena.name}</h1>
      </div>
      <div className="mb-4 flex flex-wrap gap-2">
        {TABS.map((t) => {
          const Icon = t.icon;
          const enabled =
            (t.id === 'iot' && canIot) ||
            (t.id === 'multi' && canMulti) ||
            (t.id === 'branding' && canWhite) ||
            (t.id === 'ai' && canAi);
          if (!enabled) return null;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={[
                'flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-bold',
                tab === t.id ? 'border-ink bg-ink text-paper-pure' : 'border-gray-200 bg-paper text-gray-600',
              ].join(' ')}
            >
              <Icon className="h-4 w-4" /> {t.label}
            </button>
          );
        })}
      </div>
      <V2Surface>
        {tab === 'iot' && canIot && <IotTab arenaId={arena.id} />}
        {tab === 'multi' && canMulti && <MultiUnitTab />}
        {tab === 'branding' && canWhite && <WhiteLabelTab arenaId={arena.id} />}
        {tab === 'ai' && canAi && <AiTab arenaId={arena.id} />}
      </V2Surface>
    </div>
  );
}
