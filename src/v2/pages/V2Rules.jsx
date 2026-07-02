import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Flag, Trophy } from 'lucide-react';
import { V2Badge, V2Button, V2ContentHero, V2Surface } from '@/v2/ui/primitives';
import { cn } from '@/core/lib/utils';

const SECTIONS = {
  cbp: [
    {
      title: 'Quadra e equipamentos',
      body: [
        'Quadra de 13,41 m × 6,10 m (igual ao badminton de duplas), com rede central a 91,4 cm nas laterais e 86,3 cm no meio.',
        'A Non-Volley Zone (NVZ, ou "cozinha") é a área de 2,13 m adjacente à rede de cada lado.',
        'Raquete sólida (sem cordas), bola perfurada (40 furos em geral). A CBP recomenda bolas homologadas USAP/IFP.',
      ],
    },
    {
      title: 'Saque',
      body: [
        'Saque por baixo, com o contato abaixo da cintura. O saque "drop serve" (deixar a bola quicar) também é permitido.',
        'O saque é cruzado e deve cair além da NVZ, dentro do quadrado oposto.',
        'Em duplas, ambos os jogadores sacam (exceto a primeira jogada de cada parcial, em que apenas um saca).',
      ],
    },
    {
      title: 'Regra do duplo quique (two-bounce rule)',
      body: [
        'A bola deve quicar uma vez no recebedor e uma vez no sacador antes de voleios serem permitidos. Isso favorece ralis mais longos.',
      ],
    },
    {
      title: 'Pontuação',
      body: [
        'Tradicionalmente, jogos a 11 com diferença de 2 (em torneios pode-se adotar 15 ou 21).',
        'Em formato side-out, só pontua quem está sacando. Em formato rally scoring (alternativa adotada pela CBP em algumas competições), todo rali gera ponto.',
        'O placar é cantado em três números no formato (saque): sacador, recebedor, servidor 1 ou 2 (em duplas).',
      ],
    },
    {
      title: 'Faltas comuns',
      body: [
        'Volear (bater na bola sem deixar quicar) com qualquer parte do corpo dentro da NVZ.',
        'Saque acima da cintura ou com o braço se movimentando para cima de forma não-natural.',
        'Bola na rede que não cai no campo adversário; bola fora; dois ressaltos antes do retorno.',
      ],
    },
  ],
  usap: [
    {
      title: 'Court and equipment',
      body: [
        'Court 44 ft × 20 ft. Net 36" at sidelines, 34" at center.',
        '7 ft Non-Volley Zone ("kitchen") on each side of the net.',
        'Solid paddle; outdoor ball typically 40 holes; indoor ball 26 holes (varies). USAP-approved equipment for sanctioned play.',
      ],
    },
    {
      title: 'Serve',
      body: [
        'Underhand serve with contact below the navel, paddle head below wrist. Drop serve allowed (no upward motion requirement when the ball is dropped).',
        'Cross-court serve must land beyond the NVZ inside the diagonal service court.',
        'In doubles, each side has both partners serve before the side-out (except the very first service sequence of the game).',
      ],
    },
    {
      title: 'Two-Bounce Rule',
      body: [
        'Ball must bounce once on the return and once on the serving side before either team may volley.',
      ],
    },
    {
      title: 'Scoring (side-out)',
      body: [
        'Games to 11, win by 2 (tournaments often play 15 or 21).',
        'Only the serving side scores points.',
        'Score is called as three numbers in doubles: serving score, receiving score, server number (1 or 2).',
      ],
    },
    {
      title: 'Common faults',
      body: [
        'Volleying while any part of the body is in the NVZ (or touching the line / due to momentum from a volley).',
        'Illegal serve motion (above waist, paddle head above wrist).',
        'Ball out, ball into the net, double bounce on return.',
      ],
    },
  ],
};

export default function V2Rules() {
  const [active, setActive] = useState('cbp');
  const data = SECTIONS[active];

  return (
    <div className="mx-auto max-w-[900px]">
      <V2ContentHero
        eyebrow="Sobre o esporte"
        title="Regras do Pickleball"
        description="Resumo das regras oficiais nas duas variações mais comuns (CBP e USAP)."
        action={<V2Badge tone="acid"><Flag className="h-3 w-3" /> {active === 'cbp' ? 'Brasil (CBP)' : 'EUA (USAP)'}</V2Badge>}
      />

      <div className="mb-6 inline-flex rounded-full border border-gray-100 bg-paper-pure p-1.5 shadow-sm">
        <TabButton active={active === 'cbp'} onClick={() => setActive('cbp')}>Regras brasileiras</TabButton>
        <TabButton active={active === 'usap'} onClick={() => setActive('usap')}>USAP rules</TabButton>
      </div>

      <div className="space-y-4">
        {data.map((section) => (
          <V2Surface key={section.title} contentClassName="p-5 sm:p-6">
            <h2 className="flex items-center gap-2 font-display text-lg font-bold text-ink">
              <Trophy className="h-4.5 w-4.5 text-ink" /> {section.title}
            </h2>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-7 text-gray-600">
              {section.body.map((p, i) => <li key={i}>{p}</li>)}
            </ul>
          </V2Surface>
        ))}
      </div>

      <div className="mt-6 text-center text-sm text-gray-500">
        <Link to="/v2/nivelamento" className="font-bold text-ink underline">Descubra seu nível com nosso formulário de nivelamento →</Link>
      </div>
    </div>
  );
}

function TabButton({ active, onClick, children }) {
  return (
    <button type="button" onClick={onClick}
      className={cn('rounded-full px-5 py-2.5 text-sm font-semibold transition-colors', active ? 'bg-ink text-white shadow-md' : 'text-gray-500 hover:text-ink')}>
      {children}
    </button>
  );
}
