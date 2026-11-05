/**
 * Seletor de DUPLA — o MESMO na inscrição de torneio (convite de parceiro) e na
 * Carreira. É o seletor padrão da plataforma (`PersonPicker`): a lista do
 * diretório já aberta, a busca só estreita, e com `past` as pessoas "Com quem
 * você já jogou" vêm antes — um toque escolhe. Tira a própria pessoa e quem
 * estiver em `excludedUids`.
 *
 * Lista que FALHOU não vira "Nenhum atleta encontrado": não saberíamos se a
 * pessoa já tem conta (e a tela convidaria a preencher à mão quem já tem).
 */
import React from 'react';
import { X } from 'lucide-react';
import { Label } from '@/components/ui/label';
import PersonPicker from './PersonPicker';
import { t } from '@/core/i18n';

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
  const pe = footHint === undefined ? t('Sem conta na plataforma? Preencha os dados manualmente abaixo.') : footHint;
  const escolhido = selectedUserId ? [{ uid: selectedUserId, platform_name: selectedName, photo_url: selectedPhoto }] : [];
  const sugestoes = (past || []).map((p) => ({ uid: p.uid, platform_name: p.name, photo_url: p.photo_url || null, together: p.together }));

  return (
    <div className="space-y-2 rounded-2xl border border-gray-100 bg-paper/40 p-3">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={id} className="text-xs uppercase tracking-wide text-gray-500">{label || t('Convidar parceiro(a) da plataforma')}</Label>
        {selectedUserId && (
          <button type="button" onClick={onClear} className="flex items-center gap-1 text-xs text-gray-500 hover:text-ink">
            <X className="h-3 w-3" /> {t('limpar seleção')}
          </button>
        )}
      </div>
      <PersonPicker
        id={id}
        pessoas={athletes}
        carregando={carregando}
        falhou={falhou}
        ocultar={[selfUid, ...excludedUids]}
        selecionados={escolhido}
        onChange={(lista) => (lista[0] ? onSelect(lista[0]) : onClear())}
        sugestoes={sugestoes}
        dicaEscolhido={selectedHint || t('Receberá um convite para confirmar a dupla')}
        vazio={pe ? t('Nenhum atleta encontrado. Você pode preencher os dados manualmente abaixo.') : t('Nenhum atleta encontrado com esse nome.')}
        rotulo={label || t('Convidar parceiro(a) da plataforma')}
      />
      {!selectedUserId && pe && <p className="text-xs leading-4 text-gray-500">{pe}</p>}
    </div>
  );
}
