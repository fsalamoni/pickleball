import React from 'react';
import { Link } from 'react-router-dom';
import { Trophy, ArrowRight, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/core/lib/FirebaseAuthContext';

export default function Landing() {
  const { isAuthenticated } = useAuth();
  const primaryHref = isAuthenticated ? '/torneios/criar' : '/login';
  const secondaryHref = isAuthenticated ? '/torneios/ingressar' : '/login';

  return (
    <div className="relative overflow-hidden arena-page">
      <div className="absolute inset-x-0 top-0 h-[34rem] bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.16),transparent_55%)]" />
      <div className="absolute left-1/2 top-28 hidden h-[32rem] w-[32rem] -translate-x-1/2 rounded-full bg-lime-300/15 blur-3xl lg:block" />

      <header className="sticky top-0 z-40 border-b border-white/60 bg-white/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6 sm:py-4">
          <Link to="/" className="flex items-center gap-3 text-slate-950">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-emerald-200/80 bg-white/80 shadow-[0_12px_30px_-20px_rgba(15,23,42,0.45)]">
              <Trophy className="h-5 w-5 text-emerald-700" />
            </div>
            <span className="text-sm font-semibold uppercase tracking-[0.24em] text-emerald-700/80">Pickleball</span>
          </Link>

          <div className="flex items-center gap-2">
            <nav className="hidden items-center gap-1 md:flex">
              <Button asChild variant="ghost" size="sm">
                <Link to="/regras">Regras</Link>
              </Button>
              <Button asChild variant="ghost" size="sm">
                <Link to="/nivelamento">Nivelamento</Link>
              </Button>
              <Button asChild variant="ghost" size="sm">
                <Link to="/conduta">Fair Play</Link>
              </Button>
            </nav>
            <Button asChild size="sm">
              <Link to={isAuthenticated ? '/inicio' : '/login'}>
                {isAuthenticated ? (
                  <>
                    <span className="sm:hidden">Painel</span>
                    <span className="hidden sm:inline">Abrir painel</span>
                  </>
                ) : (
                  <>
                    <span className="sm:hidden">Entrar</span>
                    <span className="hidden sm:inline">Entrar com Google</span>
                  </>
                )}
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="relative">
        <section className="mx-auto flex max-w-3xl flex-col items-center px-6 py-24 text-center lg:py-32">
          <h1 className="text-5xl font-semibold leading-[0.95] text-slate-950 md:text-6xl">
            Pickleball
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-slate-600">
            Plataforma para criação e operação de torneios de pickleball.
          </p>

          <div className="mt-10 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg">
              <Link to={primaryHref}>
                {isAuthenticated ? 'Criar novo torneio' : 'Começar com Google'}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link to={secondaryHref}>
                {isAuthenticated ? 'Ingressar com código' : 'Ver fluxo de inscrição'}
                <ChevronRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/60 bg-white/50 py-6 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 text-sm text-slate-600">
          <span>© {new Date().getFullYear()} Pickleball</span>
          <div className="flex flex-wrap gap-4">
            <Link to="/regras" className="transition-colors hover:text-slate-950">Regras</Link>
            <Link to="/nivelamento" className="transition-colors hover:text-slate-950">Nivelamento</Link>
            <Link to="/politica-uso" className="transition-colors hover:text-slate-950">Política de Uso</Link>
            <Link to="/conduta" className="transition-colors hover:text-slate-950">Conduta &amp; Fair Play</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
