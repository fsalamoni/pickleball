import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { Search } from 'lucide-react';
import { db } from '@/core/config/firebase';
import { AUDIT_ACTION_LABELS, formatAuditDate } from '@/core/services/auditService';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

const PAGE_SIZES = [10, 50, 100];

export function AuditLogTable({ title, description, tournamentId, userId, className = '' }) {
  const [logs, setLogs] = useState([]);
  const [filters, setFilters] = useState({
    log_number: '',
    user_name: '',
    created_at: '',
    action_label: '',
    details: '',
  });
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);
  const [error, setError] = useState(null);

  useEffect(() => {
    const constraints = [];
    if (tournamentId) constraints.push(where('tournament_id', '==', tournamentId));
    if (userId) constraints.push(where('user_id', '==', userId));
    const q = query(collection(db, 'audit_logs'), ...constraints);

    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        setLogs(
          snap.docs
            .map((d) => ({ id: d.id, ...d.data() }))
            .sort((a, b) => (b.created_at_ms || 0) - (a.created_at_ms || 0)),
        );
        setError(null);
      },
      (err) => setError(err.message),
    );

    return () => unsubscribe();
  }, [tournamentId, userId]);

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      const values = {
        log_number: String(log.log_number || ''),
        user_name: `${log.user_name || ''} ${log.user_email || ''}`,
        created_at: formatAuditDate(log.created_at, log.created_at_ms),
        action_label: `${log.action_label || AUDIT_ACTION_LABELS[log.action] || log.action || ''}`,
        details: stringifyDetails(log.details),
      };
      return Object.entries(filters).every(([key, filter]) => (
        !filter || values[key].toLowerCase().includes(filter.toLowerCase())
      ));
    });
  }, [logs, filters]);

  const pageCount = Math.max(1, Math.ceil(filteredLogs.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const visibleLogs = filteredLogs.slice((safePage - 1) * pageSize, safePage * pageSize);

  useEffect(() => {
    setPage(1);
  }, [filters, pageSize]);

  return (
    <Card className={`overflow-hidden ${className}`}>
      <CardHeader className="border-b border-emerald-950/10 bg-white/45 p-4 sm:p-5">
        <CardTitle className="text-base text-slate-950">{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="space-y-4 p-4 sm:p-5">
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          <FilterInput label="Nº" value={filters.log_number} onChange={(value) => updateFilter(setFilters, 'log_number', value)} />
          <FilterInput label="Usuário" value={filters.user_name} onChange={(value) => updateFilter(setFilters, 'user_name', value)} />
          <FilterInput label="Data/hora" value={filters.created_at} onChange={(value) => updateFilter(setFilters, 'created_at', value)} />
          <FilterInput label="Ação" value={filters.action_label} onChange={(value) => updateFilter(setFilters, 'action_label', value)} />
          <FilterInput label="Detalhes" value={filters.details} onChange={(value) => updateFilter(setFilters, 'details', value)} />
        </div>

        <div className="arena-table-wrap">
          <table className="min-w-[980px] w-full text-sm">
            <thead>
              <tr className="border-b border-emerald-900/40 bg-emerald-950 text-left text-emerald-50">
                <th className="py-3 pl-4 pr-3 font-semibold">Nº</th>
                <th className="py-3 px-3 font-semibold">Usuário</th>
                <th className="py-3 px-3 font-semibold">Data e horário</th>
                <th className="py-3 px-3 font-semibold">Ação realizada</th>
                <th className="py-3 px-3 font-semibold">Informações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-emerald-950/10 bg-white/65">
              {visibleLogs.map((log) => (
                <tr key={log.id} className="transition-colors hover:bg-emerald-50/70">
                  <td className="py-3 pl-4 pr-3 font-mono text-xs text-slate-600">{log.log_number || '—'}</td>
                  <td className="py-3 px-3">
                    <div className="font-medium text-slate-900">{log.user_name || log.actor_name || '—'}</div>
                    <div className="text-xs text-slate-500">{log.user_email || log.actor_email || ''}</div>
                  </td>
                  <td className="py-3 px-3 text-slate-700">{formatAuditDate(log.created_at, log.created_at_ms)}</td>
                  <td className="py-3 px-3 font-medium text-slate-900">
                    {log.action_label || AUDIT_ACTION_LABELS[log.action] || log.action}
                  </td>
                  <td className="py-3 px-3 text-xs text-slate-600">{stringifyDetails(log.details)}</td>
                </tr>
              ))}
              {!visibleLogs.length && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-500">Nenhum log encontrado.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <span>Registros por página</span>
            <select
              className="h-9 rounded-md border border-input bg-background px-2 text-sm"
              aria-label="Registros por página"
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
            >
              {PAGE_SIZES.map((size) => <option key={size} value={size}>{size}</option>)}
            </select>
            <span>{filteredLogs.length} registro(s)</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="sm" disabled={safePage <= 1} onClick={() => setPage((p) => p - 1)}>
              Anterior
            </Button>
            <span className="text-sm text-slate-600">Página</span>
            <Input
              type="number"
              min="1"
              max={pageCount}
              aria-label="Número da página"
              value={safePage}
              onChange={(e) => setPage(Math.max(1, Math.min(pageCount, Number(e.target.value) || 1)))}
              className="h-9 w-20"
            />
            <span className="text-sm text-slate-600">de {pageCount}</span>
            <Button type="button" variant="outline" size="sm" disabled={safePage >= pageCount} onClick={() => setPage((p) => p + 1)}>
              Próxima
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function FilterInput({ label, value, onChange }) {
  return (
    <label className="space-y-1 text-xs font-medium text-slate-600">
      <span>{label}</span>
      <div className="relative">
        <Search className="pointer-events-none absolute left-2 top-2.5 h-4 w-4 text-slate-400" />
        <Input value={value} onChange={(e) => onChange(e.target.value)} className="pl-8" />
      </div>
    </label>
  );
}

function updateFilter(setFilters, key, value) {
  setFilters((prev) => ({ ...prev, [key]: value }));
}

function stringifyDetails(details) {
  if (!details) return '';
  if (typeof details === 'string') return details;
  return Object.entries(details)
    .map(([key, value]) => `${key}: ${formatDetailValue(value)}`)
    .join(' · ');
}

function formatDetailValue(value) {
  if (value === null || value === undefined) return '—';
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}
