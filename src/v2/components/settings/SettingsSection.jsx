/**
 * As peças da tela de Configurações (2026-10-11), a pedido do dono: a tela
 * estava "cheia de informações e tudo um pouco misturado".
 *
 * `SettingsGroup` é um grupo com nome (Conta e privacidade, Tela e
 * navegação…). `SettingsSection` é um cartão COLAPSÁVEL dentro do grupo:
 * nasce recolhido, e o cabeçalho diz COMO ESTÁ ("Automático", "3 cards: …",
 * "2 categorias silenciadas") — abrir é para mudar. A preferência de aberto/
 * recolhido é por pessoa, no navegador (`v2:collapse:<uid>:config:<id>`).
 *
 * Duas coisas que não podem regredir:
 *  1. **o link direto abre o cartão.** `/configuracoes#notificacoes` (o sino),
 *     `#pagina-inicial` (o "Personalizar" do início), `#menu-lateral`,
 *     `#minha-regiao`, `#balanco-do-jogo`: a âncora da
 *     URL força o cartão aberto por cima da preferência — cair num cabeçalho
 *     fechado é cair em lugar nenhum;
 *  2. **`id` e `data-dica` ficam no cartão**, sempre montado: os links e os
 *     guias/pontos de dica (`config-aparencia`, `config-menu`…) acham o
 *     cartão recolhido ou aberto.
 *
 * Fora de um Router (testes de um cartão só) a âncora vem de `window.location`.
 */
import React, { useEffect, useState } from 'react';
import { useInRouterContext, useLocation } from 'react-router-dom';
import V2CollapsibleCard from '@/v2/ui/V2CollapsibleCard';

const alvoDoHash = (hash, id) => Boolean(id) && hash === `#${id}`;

function Secao({ id, dica, icon, title, summary, actions, defaultCollapsed = true, forceOpen = false, children }) {
  return (
    <V2CollapsibleCard
      id={id}
      dica={dica}
      icon={icon}
      iconClassName="text-ink"
      title={title}
      summary={summary}
      actions={actions}
      sectionId={`config:${id}`}
      defaultCollapsed={defaultCollapsed}
      forceOpen={forceOpen}
      className="scroll-mt-4"
    >
      {children}
    </V2CollapsibleCard>
  );
}

function ComRota(props) {
  const { hash } = useLocation();
  return <Secao {...props} forceOpen={alvoDoHash(hash, props.id)} />;
}

function SemRota(props) {
  const [hash, setHash] = useState(() => (typeof window === 'undefined' ? '' : window.location.hash));
  useEffect(() => {
    const ler = () => setHash(window.location.hash);
    window.addEventListener('hashchange', ler);
    return () => window.removeEventListener('hashchange', ler);
  }, []);
  return <Secao {...props} forceOpen={alvoDoHash(hash, props.id)} />;
}

/**
 * @param {object} props
 * @param {string} props.id âncora do cartão (`/configuracoes#<id>`) e chave da preferência
 * @param {string} [props.dica] âncora `data-dica`
 * @param {React.ElementType} [props.icon]
 * @param {React.ReactNode} props.title
 * @param {React.ReactNode} [props.summary] como está — visível só recolhido
 * @param {React.ReactNode} [props.actions] ação do cabeçalho (um link, por exemplo)
 * @param {boolean} [props.defaultCollapsed=true]
 */
export default function SettingsSection(props) {
  const emRouter = useInRouterContext();
  return emRouter ? <ComRota {...props} /> : <SemRota {...props} />;
}

/** Um grupo de cartões com nome e, se quiser, uma linha dizendo do que ele trata. */
export function SettingsGroup({ title, description, children }) {
  return (
    <section aria-label={title} className="space-y-3">
      <div className="px-1">
        <h2 className="font-display text-base font-bold text-ink">{title}</h2>
        {description && <p className="mt-0.5 text-xs text-gray-500">{description}</p>}
      </div>
      {children}
    </section>
  );
}
