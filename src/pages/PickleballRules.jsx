import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Trophy, BookOpen, Flag } from 'lucide-react';

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

export default function PickleballRules() {
  const [active, setActive] = useState('cbp');
  const data = SECTIONS[active];

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <Card>
        <CardContent className="p-5">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <h1 className="text-2xl font-bold arena-heading flex items-center gap-2">
                <BookOpen className="w-6 h-6 text-emerald-600" /> Regras do Pickleball
              </h1>
              <p className="text-sm text-slate-600 mt-1">
                Resumo das regras oficiais nas duas variações mais comuns. Para o regulamento completo, consulte a{' '}
                <a className="text-emerald-700 underline" target="_blank" rel="noreferrer" href="https://cbpickleball.com.br/">
                  CBP
                </a>{' '}
                ou a{' '}
                <a className="text-emerald-700 underline" target="_blank" rel="noreferrer" href="https://usapickleball.org/">
                  USA Pickleball
                </a>
                .
              </p>
            </div>
            <Badge variant="secondary">
              <Flag className="w-3 h-3 mr-1" /> {active === 'cbp' ? 'Brasil (CBP)' : 'EUA (USAP)'}
            </Badge>
          </div>
          <div className="mt-4 flex gap-2">
            <Button size="sm" variant={active === 'cbp' ? 'default' : 'outline'} onClick={() => setActive('cbp')}>
              Regras brasileiras
            </Button>
            <Button size="sm" variant={active === 'usap' ? 'default' : 'outline'} onClick={() => setActive('usap')}>
              USAP rules
            </Button>
          </div>
        </CardContent>
      </Card>

      {data.map((section) => (
        <Card key={section.title}>
          <CardContent className="p-5">
            <h2 className="font-semibold text-slate-900 flex items-center gap-2">
              <Trophy className="w-4 h-4 text-emerald-600" /> {section.title}
            </h2>
            <ul className="mt-2 space-y-2 text-sm text-slate-700 list-disc pl-5">
              {section.body.map((p, i) => (
                <li key={i}>{p}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ))}

      <div className="text-center text-sm text-slate-500">
        <Link to="/nivelamento" className="text-emerald-700 underline">
          Descubra seu nível com nosso formulário de nivelamento →
        </Link>
      </div>
    </div>
  );
}
