import { Link } from 'react-router-dom';
import { Trophy, Lock, Users, Calculator, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '@/core/lib/FirebaseAuthContext';

export default function Landing() {
  const { isAuthenticated } = useAuth();

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-teal-50">
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 font-bold">
            <Trophy className="w-6 h-6 text-emerald-600" />
            <span className="bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">Bolão Copa 2026</span>
          </Link>
          <nav className="flex items-center gap-2">
            {isAuthenticated ? (
              <Button asChild size="sm">
                <Link to="/dashboard">Meu Dashboard</Link>
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
        <h1 className="text-4xl md:text-6xl font-bold text-slate-900 leading-tight">
          O bolão da <span className="bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">Copa do Mundo 2026</span>{' '}
          que você esperava.
        </h1>
        <p className="mt-6 text-lg text-slate-600 max-w-2xl mx-auto">
          Crie seu bolão privado, convide a galera e palpite jogo a jogo. Com pontuação justa, sigilo absoluto dos palpites
          até o fechamento das fases e ranking em tempo real.
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <Button asChild size="lg">
            <Link to={isAuthenticated ? '/boloes/criar' : '/login'}>
              {isAuthenticated ? 'Criar meu bolão' : 'Entrar com Google'}
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link to={isAuthenticated ? '/boloes/criar' : '/login'}>Como funciona</Link>
          </Button>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 pb-20 grid md:grid-cols-3 gap-6">
        <FeatureCard
          icon={Users}
          title="Para sua turma"
          desc="Gere um código único e convide quem quiser. Cada bolão é um silo: seu ranking, suas regras."
        />
        <FeatureCard
          icon={Lock}
          title="Sigilo absoluto"
          desc="Ninguém vê seu palpite antes do prazo final da fase — nem mesmo o admin geral. Garantido por arquitetura."
        />
        <FeatureCard
          icon={Calculator}
          title="Pontuação fiel"
          desc="Bucha, vencedor + saldo, multiplicador de Zebra (2x/3x/4x), pênaltis e quizzes do campeão e artilheiro."
        />
      </section>

      <section className="max-w-6xl mx-auto px-6 pb-24">
        <Card className="bg-emerald-50/60 border-emerald-200">
          <CardContent className="p-8 grid md:grid-cols-[auto_1fr] gap-6 items-center">
            <ShieldCheck className="w-16 h-16 text-emerald-600" />
            <div>
              <h3 className="text-xl font-semibold text-slate-900">Pratique com responsabilidade</h3>
              <p className="mt-2 text-slate-600 text-sm">
                Bolões entre amigos são pra divertir, não pra entrar em dívida. Antes de jogar, conheça nossas{' '}
                <Link to="/aviso-jogos" className="text-emerald-700 underline">
                  Boas Práticas e Avisos sobre Jogos
                </Link>
                .
              </p>
            </div>
          </CardContent>
        </Card>
      </section>

      <footer className="border-t bg-white/60 py-6">
        <div className="max-w-6xl mx-auto px-6 flex flex-wrap items-center justify-between gap-4 text-sm text-slate-500">
          <span>© 2026 Bolão Copa 2026</span>
          <div className="flex gap-4">
            <Link to="/politica-uso" className="hover:text-slate-900">Política de Uso</Link>
            <Link to="/aviso-jogos" className="hover:text-slate-900">Boas Práticas</Link>
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
