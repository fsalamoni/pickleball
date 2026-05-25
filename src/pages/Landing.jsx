import React from 'react';
import { Link } from 'react-router-dom';
import { Trophy, Users, Target, Award, BookOpen, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '@/core/lib/FirebaseAuthContext';

export default function Landing() {
  const { isAuthenticated } = useAuth();

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-lime-50">
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 font-bold">
            <Trophy className="w-6 h-6 text-emerald-600" />
            <span className="bg-gradient-to-r from-emerald-600 to-lime-500 bg-clip-text text-transparent">
              Pickleball
            </span>
          </Link>
          <nav className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link to="/regras">Regras</Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link to="/nivelamento">Nivelamento</Link>
            </Button>
            {isAuthenticated ? (
              <Button asChild size="sm">
                <Link to="/inicio">Meu painel</Link>
              </Button>
            ) : (
              <Button asChild size="sm">
                <Link to="/login">Entrar com Google</Link>
              </Button>
            )}
          </nav>
        </div>
      </header>

      <section className="max-w-6xl mx-auto px-6 py-20 text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-800">
          <Sparkles className="w-3.5 h-3.5" /> Plataforma completa para torneios de pickleball no Brasil
        </span>
        <h1 className="mt-6 text-4xl md:text-6xl font-bold text-slate-900 leading-tight">
          Crie e administre{' '}
          <span className="bg-gradient-to-r from-emerald-600 to-lime-500 bg-clip-text text-transparent">
            torneios de pickleball
          </span>{' '}
          em minutos.
        </h1>
        <p className="mt-6 text-lg text-slate-600 max-w-2xl mx-auto">
          Simples, duplas e americana. Grupos, chaves, pontos corridos ou fases combinadas. Regras brasileiras
          (CBP) ou americanas (USAP). Sorteio automatizado, ranking ao vivo e até 500 inscritos por modalidade.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Button asChild size="lg">
            <Link to={isAuthenticated ? '/torneios/criar' : '/login'}>
              {isAuthenticated ? 'Criar torneio' : 'Começar com Google'}
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link to={isAuthenticated ? '/torneios/ingressar' : '/login'}>Tenho um código de inscrição</Link>
          </Button>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 pb-16 grid md:grid-cols-3 gap-6">
        <FeatureCard
          icon={Users}
          title="Inscrições flexíveis"
          desc="Singles, duplas (masculinas, femininas, mistas) e americanas. Até 500 inscritos por nível, com taxa de inscrição opcional e lista de espera."
        />
        <FeatureCard
          icon={Target}
          title="Pontuação configurável"
          desc="Jogos de 11, 15 ou 21 pontos, 1+ sets, regras CBP ou USAP. Defina quanto vale vitória, set vencido e até saldo de games."
        />
        <FeatureCard
          icon={Trophy}
          title="Formatos completos"
          desc="Pontos corridos, grupos, mata-mata, americana ou várias fases combinadas. Sorteio automático com seeds reproduzíveis."
        />
        <FeatureCard
          icon={Award}
          title="Ranking ao vivo"
          desc="Lance os resultados, a plataforma atualiza ranking e fases seguintes automaticamente. Desempate por confronto direto e saldos."
        />
        <FeatureCard
          icon={BookOpen}
          title="Nivelamento CBPE/USAP"
          desc="Formulário de auto-avaliação validado para encontrar seu nível (Iniciante, Intermediário, Plus, PRO, Open) com mitigação de vieses."
        />
        <FeatureCard
          icon={Users}
          title="Admins compartilhados"
          desc="O criador divide as funções com outros admins do torneio sem afetar o admin geral da plataforma."
        />
      </section>

      <section className="max-w-6xl mx-auto px-6 pb-24">
        <Card className="bg-emerald-50/60 border-emerald-200">
          <CardContent className="p-8 grid md:grid-cols-[auto_1fr] gap-6 items-center">
            <BookOpen className="w-16 h-16 text-emerald-600" />
            <div>
              <h3 className="text-xl font-semibold text-slate-900">Comece pelas regras</h3>
              <p className="mt-2 text-slate-600 text-sm">
                Conheça as <Link to="/regras" className="text-emerald-700 underline">regras oficiais do pickleball</Link> (brasileiras e
                americanas) e descubra seu nível com nosso{' '}
                <Link to="/nivelamento" className="text-emerald-700 underline">formulário de nivelamento</Link>.
              </p>
            </div>
          </CardContent>
        </Card>
      </section>

      <footer className="border-t bg-white/60 py-6">
        <div className="max-w-6xl mx-auto px-6 flex flex-wrap items-center justify-between gap-4 text-sm text-slate-500">
          <span>© {new Date().getFullYear()} Pickleball</span>
          <div className="flex gap-4">
            <Link to="/regras" className="hover:text-slate-900">Regras</Link>
            <Link to="/nivelamento" className="hover:text-slate-900">Nivelamento</Link>
            <Link to="/politica-uso" className="hover:text-slate-900">Política de Uso</Link>
            <Link to="/conduta" className="hover:text-slate-900">Conduta &amp; Fair Play</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ icon: Icon, title, desc }) {
  return (
    <Card className="border-slate-200">
      <CardContent className="p-6">
        <div className="w-10 h-10 rounded-md bg-emerald-100 flex items-center justify-center mb-3">
          <Icon className="w-5 h-5 text-emerald-700" />
        </div>
        <h3 className="font-semibold text-slate-900">{title}</h3>
        <p className="mt-1 text-sm text-slate-600">{desc}</p>
      </CardContent>
    </Card>
  );
}
