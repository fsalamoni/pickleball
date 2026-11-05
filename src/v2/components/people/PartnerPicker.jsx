/**
 * Seletor de DUPLA — o MESMO na inscrição de torneio (convite de parceiro) e na
 * Carreira. Busca no diretório público de atletas, tira a própria pessoa
 * e quem estiver em `excludedUids`. Com `past`, mostra antes da busca as
 * pessoas "Com quem você já jogou" — um toque escolhe.
 *
 * Lista que FALHOU não vira "Nenhum atleta encontrado": não saberíamos se a
 * pessoa já tem conta (e a tela convidaria a preencher à mão quem já tem).
 */
import React, { useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { UserAvatar } from '@/components/ui/user-avatar';
import { filterPartnerCandidates } from '@/modules/tournament/domain/partnerInvite';
import { t, tn } from '@/core/i18n';

/**
 * @param {{
 *   athletes: object[], falhou?: boolean, carregando?: boolean, selfUid?: string|null, excludedUids?: string[],
 *   selectedUserId?: string|null, selectedName?: string, selectedPhoto?: string|null,
 *   onSelect: (profile: object) => void, onClear: () => void,
 *   label?: string, selectedHint?: string, footHint?: string|null,
 *   past?: Array<{ uid: string, name: string, photo_url?: string|null, together: number }>,
 *   id?: string,
 * }} props
 */
export default function PartnerPicker({
  athletes = [], falhou = false, carregando = false, selfUid = null, excludedUids = [],
  selectedUserId = null, selectedName = '', selectedPhoto = null, onSelect, onClear,
  label, selectedHint, footHint, past = [], id = 'dupla-busca',
}) {
  const [term, setTerm] = useState('');
  const results = useMemo(
    () => filterPartnerCandidates(athletes, { term, selfUid, excludedUids }).slice(0, 30),
    [athletes, term, selfUid, excludedUids],
  );
  const recentes = useMemo(
    () => (past || []).filter((p) => p.uid !== selfUid && !excludedUids.includes(p.uid)).slice(0, 6),
    [past, selfUid, excludedUids],
  );
  const pe = footHint === undefined ? t('Sem conta na plataforma? Preencha os dados manualmente abaixo.') : footHint;

  return (
    <div className="rounded-md border border-input bg-paper/40 p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={id} className="text-xs uppercase tracking-wide text-gray-500">{label || t('Convidar parceiro(a) da plataforma')}</Label>
        {selectedUserId && (
          <button type="button" onClick={onClear} className="flex items-center gap-1 text-xs text-gray-500 hover:text-ink">
            <X className="w-3 h-3" /> {t('limpar seleção')}
          </button>
        )}
      </div>
      {selectedUserId ? (
        <div className="flex items-center gap-2 rounded-md border border-acid/40 bg-acid/10 p-2">
          <UserAvatar name={selectedName} photoUrl={selectedPhoto} size="sm" />
          <div className="min-w-0">
            <div className="text-sm font-medium truncate">{selectedName}</div>
            <div className="text-xs text-gray-500 truncate">{selectedHint || t('Receberá um convite para confirmar a dupla')}</div>
          </div>
        </div>
      ) : (
        <>
          {recentes.length > 0 && !term.trim() && (
            <div className="space-y-1">
              <p className="text-xs font-semibold text-gray-600">{t('Com quem você já jogou')}</p>
              <div className="flex flex-wrap gap-2">
                {recentes.map((p) => (
                  <button type="button"
                    key={p.uid}
                    onClick={() => onSelect({ uid: p.uid, platform_name: p.name, photo_url: p.photo_url || null })}
                    className="flex items-center gap-2 rounded-full border border-gray-100 bg-white px-2 py-1 text-left text-sm hover:border-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-ink"
                  >
                    <UserAvatar name={p.name} photoUrl={p.photo_url} size="sm" />
                    <span className="truncate">{p.name}</span>
                    <span className="text-xs text-gray-500">{tn(p.together, '{n} vez', '{n} vezes')}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" aria-hidden="true" />
            <Input id={id} className="pl-8" placeholder={t('Buscar por nome ou cidade…')} value={term} onChange={(e) => setTerm(e.target.value)} />
          </div>
          {term.trim() && (
            <div className="max-h-48 overflow-y-auto rounded-md border border-gray-100 divide-y">
              {falhou ? (
                <div className="p-3 text-xs text-amber-700 text-center">
                  {t('A lista de atletas não carregou — não dá para saber se essa pessoa já tem conta. Tente de novo antes de preencher à mão.')}
                </div>
              ) : carregando ? (
                <div className="p-3 text-xs text-gray-500 text-center">{t('Carregando a lista de atletas…')}</div>
              ) : results.length === 0 ? (
                <div className="p-3 text-xs text-gray-500 text-center">
                  {pe ? t('Nenhum atleta encontrado. Você pode preencher os dados manualmente abaixo.') : t('Nenhum atleta encontrado com esse nome.')}
                </div>
              ) : (
                results.map((profile) => {
                  const uid = profile.uid || profile.id;
                  return (
                    <button key={uid} type="button" onClick={() => onSelect(profile)} className="flex w-full items-center gap-2 p-2 text-left hover:bg-paper">
                      <UserAvatar name={profile.platform_name} photoUrl={profile.photo_url} size="sm" />
                      <div className="min-w-0">
                        <div className="text-sm truncate">{profile.platform_name}</div>
                        <div className="text-xs text-gray-500 truncate">{[profile.city, profile.state].filter(Boolean).join(' · ') || '—'}</div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          )}
          {pe && <p className="text-xs leading-4 text-gray-500">{pe}</p>}
        </>
      )}
    </div>
  );
}
