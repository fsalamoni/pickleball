/**
 * ArenaModuleShortcuts — as portas dos módulos ativos, num lugar só.
 *
 * ## O problema que ele resolve
 *
 * Cada módulo entregue ganha uma tela, e cada tela precisava de um link
 * escrito à mão em dois lugares (a página da arena e o console de gestão).
 * Isso já tinha custado uma funcionalidade inteira: o console de marketing
 * existia, tinha rota, e **nada na plataforma levava até ele** — o módulo podia
 * estar ligado que ninguém achava a tela.
 *
 * Aqui o link vem do CATÁLOGO (`manage` / `public` de `ARENA_MODULE_DETAIL`),
 * que é a mesma fonte que descreve o módulo para a plataforma e para a arena.
 * Módulo novo com rota preenchida aparece sozinho; módulo desligado some.
 *
 * ## Uma consulta, não cinquenta
 *
 * `useArenaModules` responde pelos 50 módulos em memória a partir de duas
 * consultas. Um `useCanArenaUseModule` por item — que era o padrão antigo —
 * multiplicaria isso pela quantidade de módulos, dentro de um `map`.
 *
 * @param {{ arenaId: string, audience?: 'manage'|'public', variant?: string,
 *           size?: string, className?: string }} props
 */

import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useArenaModules } from '@/modules/arenas/hooks/useArenaModules';
import { arenaModuleRoute, getArenaModule, listArenaModuleIds } from '@/modules/arenas/domain/moduleCatalog';
import { moduleIcon } from '@/v2/components/arenas/moduleIcons';
import { V2Button } from '@/v2/ui/primitives';

/**
 * Os módulos ligados que têm tela para este público, sem repetir destino.
 *
 * Dois módulos podem apontar para a MESMA rota (a família toda cai em
 * `/gerir/avancado`, por exemplo) — mostrar o mesmo botão quatro vezes seria
 * ruído. Fica o primeiro, que é o mais alto na família.
 *
 * Módulo `native` (integrado à arena: tem aba na Central e seção na página
 * pública) não vira atalho — um botão levando para fora de algo que já está
 * na tela é exatamente o "separado do resto da arena" que a integração
 * desfaz.
 *
 * @param {(id: string) => boolean} isOn
 * @param {string} arenaId
 * @param {'manage'|'public'} audience
 * @returns {Array<{ id: string, label: string, icon: string|null, to: string }>}
 */
export function shortcutsFor(isOn, arenaId, audience = 'manage') {
  const vistos = new Set();
  return listArenaModuleIds()
    .filter((id) => isOn(id))
    .map((id) => {
      const mod = getArenaModule(id);
      if (mod?.native) return null;
      const to = arenaModuleRoute(id, arenaId, audience);
      if (!to || vistos.has(to)) return null;
      vistos.add(to);
      return { id, label: mod?.label || id, icon: mod?.icon || null, to };
    })
    .filter(Boolean);
}

export default function ArenaModuleShortcuts({
  arenaId, audience = 'manage', variant = 'secondary', size = 'sm', className,
}) {
  const { isOn, isLoading } = useArenaModules(arenaId);

  const atalhos = useMemo(
    () => (isLoading ? [] : shortcutsFor(isOn, arenaId, audience)),
    [isOn, isLoading, arenaId, audience],
  );

  // Nada ligado não é estado de erro nem vazio a explicar: é ausência. Uma
  // caixa dizendo "nenhum módulo ativo" ocuparia espaço em toda arena que não
  // usa módulo nenhum, que é a maioria.
  if (atalhos.length === 0) return null;

  const botoes = atalhos.map((a) => {
    const Icon = moduleIcon(a.icon);
    return (
      <V2Button key={a.id} asChild variant={variant} size={size}>
        <Link to={a.to}><Icon className="h-4 w-4" /> {a.label}</Link>
      </V2Button>
    );
  });

  // Sem `className` o componente entra como IRMÃO dos botões que já estão na
  // linha — encaixar uma caixa própria ali quebraria o espaçamento da barra.
  if (!className) return <>{botoes}</>;

  return <div className={`flex flex-wrap gap-2 ${className}`}>{botoes}</div>;
}
