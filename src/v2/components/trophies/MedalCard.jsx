/**
 * O CARTÃO de campeões — a arte. Recebe o modelo de `buildMedalCard` e só
 * desenha: nada aqui decide nome, frase ou degrau.
 *
 * É arte da marca, não tela: fundo ink com o campo de pickleball riscado em
 * acid, o degrau em Outfit preto, as pessoas com foto (ou iniciais) num anel
 * de metal, o evento, a data, quem sediou, o logo e o QR. Texto em `cqw`
 * (escala pela largura do PRÓPRIO cartão, como o banner da arena), para a
 * mesma arte servir à prévia no celular, ao PNG em 3× e à folha A4.
 *
 * `tema-claro` no elemento capturado: a imagem é a mesma no modo escuro.
 */
import React, { forwardRef } from 'react';
import { LogoImg } from '@/v2/ui/BrandMark';
import { initialsFor } from '@/components/ui/user-avatar';
import { cn } from '@/core/lib/utils';

/** As cores dos metais sobre ink. Ouro é o acid da marca: o título é a casa. */
export const METAL = Object.freeze({
  1: { cor: '#D4F82E', nome: 'Ouro' },
  2: { cor: '#D5DBE5', nome: 'Prata' },
  3: { cor: '#E0A469', nome: 'Bronze' },
});

const F = {
  kicker: 'clamp(9px, 3cqw, 16px)',
  degrau: 'clamp(26px, 13cqw, 76px)',
  nome: 'clamp(13px, 5.2cqw, 30px)',
  nomePodio: 'clamp(11px, 4.2cqw, 24px)',
  evento: 'clamp(13px, 5cqw, 30px)',
  sub: 'clamp(10px, 3.4cqw, 19px)',
  frase: 'clamp(9px, 3.2cqw, 18px)',
  micro: 'clamp(8px, 2.6cqw, 14px)',
};

/** O campo riscado: as linhas de uma quadra de pickleball, de canto, em acid. */
function Quadra({ cor }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 440 200" className="absolute -right-[18%] -top-[6%] w-[120%] opacity-[0.14]" style={{ color: cor }}>
      <g fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
        <rect x="20" y="20" width="400" height="160" rx="2" />
        <line x1="220" y1="20" x2="220" y2="180" strokeWidth="4" strokeDasharray="6 8" />
        <line x1="150" y1="20" x2="150" y2="180" />
        <line x1="290" y1="20" x2="290" y2="180" />
        <line x1="20" y1="100" x2="150" y2="100" />
        <line x1="290" y1="100" x2="420" y2="100" />
      </g>
    </svg>
  );
}

function Pessoa({ pessoa, cor, size = 'lg', comFoto }) {
  const dim = size === 'lg' ? 'clamp(36px, 15cqw, 92px)' : 'clamp(24px, 9cqw, 56px)';
  return (
    <div className="flex min-w-0 items-center" style={{ gap: '0.9em', fontSize: size === 'lg' ? F.nome : F.nomePodio }}>
      <div
        className="flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-ink-light font-display font-black text-white"
        style={{ width: dim, height: dim, boxShadow: `0 0 0 3px #0B0F19, 0 0 0 5.5px ${cor}`, fontSize: '0.75em' }}
      >
        {comFoto && pessoa.photo_url
          ? <img src={pessoa.photo_url} alt="" crossOrigin="anonymous" className="h-full w-full object-cover object-top" />
          : <span style={{ color: cor }}>{initialsFor(pessoa.name)}</span>}
      </div>
      <span className="min-w-0 truncate font-display font-bold leading-tight text-white">{pessoa.name}</span>
    </div>
  );
}

/**
 * @param {{ card: ReturnType<import('@/modules/trophies/domain/medalCard.js').buildMedalCard>, qrDataUrl?: string, className?: string }} props
 */
const MedalCard = forwardRef(function MedalCard({ card, qrDataUrl = '', className }, ref) {
  if (!card) return null;
  const podio = card.mode === 'podio';
  const cor = METAL[card.position || 1].cor;
  const kicker = card.event.kind === 'dia_de_jogo' ? 'Dia de jogo' : 'Torneio';

  return (
    <div
      ref={ref}
      data-testid="medal-card"
      className={cn('tema-claro cartao-imprimivel relative isolate w-full overflow-hidden bg-ink text-white', className)}
      style={{ containerType: 'inline-size', aspectRatio: '3 / 4', fontFamily: 'Outfit, Inter, system-ui, sans-serif' }}
    >
      {/* Luz do canto e o campo riscado */}
      <div aria-hidden="true" className="absolute inset-0" style={{ background: `radial-gradient(90% 60% at 100% 0%, ${cor}2E 0%, transparent 60%), radial-gradient(70% 50% at 0% 100%, #1A223580 0%, transparent 70%)` }} />
      <Quadra cor={cor} />

      <div className="relative flex h-full flex-col" style={{ padding: '6cqw 7cqw 6cqw' }}>
        {/* Cabeçalho: a marca e quem sediou */}
        <header className="flex items-center justify-between" style={{ gap: '1em', fontSize: F.kicker }}>
          <div className="flex items-center" style={{ gap: '0.6em' }}>
            <LogoImg versao="escuro" className="h-[2.4em] shrink-0" />
            <span className="font-display font-bold tracking-wide text-white">PickleRush</span>
          </div>
          {card.host ? (
            <div className="flex min-w-0 items-center" style={{ gap: '0.5em' }}>
              {card.host.logo && <img src={card.host.logo} alt="" crossOrigin="anonymous" className="shrink-0 rounded-md bg-white object-contain" style={{ height: '2.2em', width: '2.2em', padding: '0.15em' }} />}
              <span className="truncate font-semibold text-white/80">{card.host.name}</span>
            </div>
          ) : (
            <span className="rounded-full font-bold uppercase tracking-widest" style={{ color: cor, border: `1px solid ${cor}66`, padding: '0.25em 0.8em' }}>{kicker}</span>
          )}
        </header>

        {/* O degrau */}
        <div style={{ marginTop: '6cqw' }}>
          <p className="font-bold uppercase tracking-[0.22em]" style={{ fontSize: F.kicker, color: cor }}>
            {podio ? 'Pódio' : METAL[card.position].nome}
          </p>
          <h2 className="cartao-titulo font-display font-black leading-[0.95] tracking-tight text-white" style={{ fontSize: podio ? 'clamp(22px, 10cqw, 60px)' : F.degrau, marginTop: '0.1em' }}>
            {podio ? card.event.subtitle || card.event.title : card.headline}
          </h2>
          <div className="cartao-brilho" style={{ height: '3px', width: '22cqw', marginTop: '3cqw', background: `linear-gradient(90deg, ${cor}, transparent)` }} />
        </div>

        {/* As pessoas */}
        <div className="flex-1" style={{ marginTop: '5cqw' }}>
          {podio ? (
            <ol className="flex flex-col" style={{ gap: '3cqw' }}>
              {card.lines.map((l) => (
                <li key={l.position} className="flex items-start" style={{ gap: '3cqw' }}>
                  <span className="font-display font-black tabular-nums leading-none" style={{ fontSize: 'clamp(16px, 7cqw, 40px)', color: METAL[l.position].cor, width: '2ch' }}>{l.position}º</span>
                  <div className="flex min-w-0 flex-1 flex-col" style={{ gap: '1.4cqw' }}>
                    {l.people.length > 0
                      ? l.people.map((p, i) => <Pessoa key={`${p.user_id || p.name}-${i}`} pessoa={p} cor={METAL[l.position].cor} size="sm" comFoto={card.showPhotos} />)
                      : l.names.map((n) => <span key={n} className="font-display font-bold text-white" style={{ fontSize: F.nomePodio }}>{n}</span>)}
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <div className="flex flex-col" style={{ gap: '3.5cqw' }}>
              {card.people.map((p, i) => <Pessoa key={`${p.user_id || p.name}-${i}`} pessoa={p} cor={cor} comFoto={card.showPhotos} />)}
            </div>
          )}
        </div>

        {/* O evento */}
        <div style={{ marginTop: '5cqw' }}>
          <p className="font-display font-bold leading-tight text-white" style={{ fontSize: F.evento }}>{card.event.title}</p>
          {!podio && card.event.subtitle && <p className="font-semibold" style={{ fontSize: F.sub, color: cor, marginTop: '0.2em' }}>{card.event.subtitle}</p>}
          <p className="text-white/70" style={{ fontSize: F.micro, marginTop: '0.5em' }}>
            {[card.dateLabel, card.where, card.hostLine].filter(Boolean).join('  ·  ')}
          </p>
        </div>

        {/* Rodapé: a frase e o QR */}
        <footer className="flex items-end justify-between border-t border-white/15" style={{ marginTop: '5cqw', paddingTop: '4cqw', gap: '4cqw' }}>
          <p className="italic leading-snug text-white/85" style={{ fontSize: F.frase, maxWidth: qrDataUrl ? '68%' : '100%' }}>“{card.saying}”</p>
          {qrDataUrl && (
            <div className="flex shrink-0 flex-col items-center" style={{ gap: '0.4em', fontSize: F.micro }}>
              <img src={qrDataUrl} alt="QR Code" className="rounded-md bg-white" style={{ width: '17cqw', height: '17cqw', padding: '0.3em' }} />
              <span className="text-white/60">picklerush.web.app</span>
            </div>
          )}
        </footer>
      </div>
    </div>
  );
});

export default MedalCard;
