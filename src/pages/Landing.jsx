import React from 'react';
import { Link } from 'react-router-dom';
import {
  Trophy,
  Users,
  Target,
  Award,
  BookOpen,
  Sparkles,
  ArrowRight,
  ChevronRight,
  CalendarDays,
  ShieldCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import InstallAppButton from '@/components/InstallAppButton';
import { useAuth } from '@/core/lib/FirebaseAuthContext';

const HERO_STATS = [
  { value: '500+', label: 'inscritos por modalidade com lista de espera e fluxo claro' },
  { value: 'CBP + USAP', label: 'regras brasileiras e americanas prontas para usar' },
  { value: 'Ao vivo', label: 'rankings, partidas e atualizações que acompanham o evento' },
];

const FEATURE_CARDS = [
  {
    icon: Users,
    title: 'Inscrições que não travam',
    desc: 'Simples, duplas e americana com códigos de convite, limite por nível, fila de espera e leitura fácil para atletas.',
  },
  {
    icon: Target,
    title: 'Pontuação oficial, sem improviso',
    desc: 'Jogos de 11, 15 ou 21 pontos, sets, regras CBP ou USAP e desempates consistentes para evitar ruído no torneio.',
  },
  {
    icon: Trophy,
    title: 'Formatos prontos para lotar a quadra',
    desc: 'Pontos corridos, grupos, mata-mata, americana e fases combinadas com sorteio automatizado e seeds reproduzíveis.',
  },
  {
    icon: Award,
    title: 'Ranking que acompanha o ritmo',
    desc: 'O staff lança resultado e a plataforma atualiza classificação, saldo e leitura da modalidade sem depender de planilha paralela.',
  },
  {
    icon: BookOpen,
    title: 'Nivelamento conectado ao esporte',
    desc: 'Autoavaliação com base CBPE e USAP para encaixar melhor os jogadores e melhorar a percepção de justiça do evento.',
  },
  {
    icon: ShieldCheck,
    title: 'Administração compartilhada',
    desc: 'Organização distribuída entre admins do torneio, sem abrir mão do controle geral da plataforma e do histórico de ações.',
  },
  {
    icon: CalendarDays,
    title: 'Arenas e reservas no mesmo ecossistema',
    desc: 'A plataforma também conecta arenas, agenda, preços, fotos e pedidos de reserva para manter o atleta ativo entre um torneio e outro.',
  },
];

const JOURNEY_STEPS = [
  {
    step: '01',
    title: 'Monte uma vitrine confiável',
    desc: 'Nome, cidade, regras, modalidades e chamadas à ação aparecem com mais clareza para atrair jogadores e reduzir dúvidas repetidas.',
  },
  {
    step: '02',
    title: 'Conduza o torneio com menos atrito',
    desc: 'Menu lateral, atalhos de criação e hierarquia de conteúdo ajudam o staff a encontrar rápido o que precisa no meio do evento.',
  },
  {
    step: '03',
    title: 'Entregue uma experiência mais premium',
    desc: 'Resultados, ranking e páginas auxiliares ficam mais leves, legíveis e agradáveis para atletas, espectadores e organizadores.',
  },
  {
    step: '04',
    title: 'Continue o relacionamento fora do evento',
    desc: 'Clubes, arenas, fóruns, reservas e chat mantêm a comunidade viva entre um campeonato e outro.',
  },
];

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
            <div className="min-w-0">
              <span className="block text-sm font-semibold uppercase tracking-[0.24em] text-emerald-700/80">Pickleball</span>
              <span className="hidden text-sm font-medium text-slate-700 sm:block">Torneios com presença de evento</span>
            </div>
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
        <section className="mx-auto grid max-w-7xl gap-14 px-6 pb-16 pt-16 lg:grid-cols-[1.15fr,0.85fr] lg:items-center lg:pt-24">
          <div className="max-w-3xl">
            <span className="arena-chip">
              <Sparkles className="h-3.5 w-3.5 text-emerald-700" /> Plataforma completa para torneios de pickleball no Brasil
            </span>
            <h1 className="mt-6 text-[2rem] font-semibold leading-[1.05] text-slate-950 sm:text-4xl sm:leading-[0.95] md:text-6xl md:leading-[0.92] xl:text-[5.2rem]">
              O pickleball ganha uma plataforma para evento, comunidade e continuidade.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600 md:text-xl">
              Crie torneios com estrutura profissional, publique modalidades e regras, acompanhe jogos e ranking, conecte atletas, clubes e arenas e mantenha o esporte ativo para além do fim de semana do evento.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link to={primaryHref}>
                  {isAuthenticated ? 'Criar novo torneio' : 'Começar com Google'}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link to={secondaryHref}>
                  {isAuthenticated ? 'Ingressar com código' : 'Explorar como funciona'}
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link to="/torneios/publicos">
                  Ver torneios públicos
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </Button>
              <InstallAppButton size="lg" variant="outline" label="Baixar o app" />
            </div>

            <div className="mt-10 grid gap-3 sm:grid-cols-3">
              {HERO_STATS.map((item) => (
                <div key={item.value} className="arena-panel rounded-[1.5rem] p-4">
                  <div className="text-2xl font-semibold text-slate-950">{item.value}</div>
                  <p className="mt-1 text-sm leading-6 text-slate-600">{item.label}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="relative lg:pt-10">
            <div className="absolute inset-0 rounded-[2.25rem] bg-gradient-to-br from-emerald-300/25 via-lime-200/10 to-transparent blur-3xl" />
            <div className="relative overflow-hidden rounded-[2.25rem] arena-panel-strong p-8 lg:p-10">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(253,224,71,0.18),transparent_30%),linear-gradient(180deg,transparent,rgba(15,23,42,0.12))]" />
              <div className="relative">
                <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-50/80">
                  <CalendarDays className="h-3.5 w-3.5" /> Pronto para abrir inscrições
                </span>
                <h2 className="mt-5 text-2xl font-semibold leading-tight text-white sm:text-3xl lg:text-4xl">
                  Do cadastro ao pódio, com presença contínua dentro do esporte.
                </h2>

                <div className="mt-8 grid gap-3 sm:grid-cols-2">
                  <HighlightBox title="Sorteio inteligente" desc="Estruturas de chave e grupos com mais contexto visual para o staff." />
                  <HighlightBox title="Ranking ao vivo" desc="Atualizações mais fáceis de interpretar entre partidas e rodadas." />
                  <HighlightBox title="Regras prontas" desc="CBP e USAP acessíveis sem quebrar o fluxo principal do usuário." />
                  <HighlightBox title="Equipe sincronizada" desc="Admins, convites e ações essenciais mais próximos de quem organiza." />
                  <HighlightBox title="Arenas conectadas" desc="Preços, agenda e reservas prolongam a utilidade da plataforma fora do torneio." />
                  <HighlightBox title="Comunidade ativa" desc="Clubes, chat e fóruns mantêm o relacionamento vivo entre um evento e outro." />
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-6 pb-16">
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {FEATURE_CARDS.map((feature) => (
              <FeatureCard key={feature.title} icon={feature.icon} title={feature.title} desc={feature.desc} />
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-6 pb-20">
          <div className="grid gap-6 lg:grid-cols-[1fr,0.92fr]">
            <div className="arena-panel rounded-[2rem] p-8 lg:p-10">
              <span className="arena-chip">Jornada do evento</span>
              <h2 className="mt-5 text-2xl font-semibold leading-tight text-slate-950 sm:text-3xl lg:text-4xl">
                Como a plataforma acompanha cada etapa do torneio.
              </h2>

              <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {JOURNEY_STEPS.map((item) => (
                  <div key={item.step} className="rounded-[1.5rem] border border-emerald-950/10 bg-secondary/40 p-5">
                    <div className="text-sm font-semibold uppercase tracking-[0.24em] text-emerald-700/75">{item.step}</div>
                    <h3 className="mt-3 text-xl font-semibold text-slate-950">{item.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="arena-panel rounded-[2rem] p-8 lg:p-10">
              <div className="rounded-[1.75rem] border border-emerald-300/30 bg-gradient-to-br from-emerald-50 to-lime-50 p-6">
                <BookOpen className="h-10 w-10 text-emerald-700" />
                <h3 className="mt-4 text-2xl font-semibold text-slate-950">Entre pelo conteúdo, continue pela participação</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Conheça as <Link to="/regras" className="font-semibold text-emerald-800 underline-offset-4 hover:underline">regras oficiais</Link>, descubra seu nível com o <Link to="/nivelamento" className="font-semibold text-emerald-800 underline-offset-4 hover:underline">formulário de nivelamento</Link> e depois encontre torneios, clubes e arenas para transformar interesse em presença real na comunidade.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-6 pb-24">
          <div className="arena-panel-strong flex flex-col gap-8 rounded-[2rem] px-8 py-10 lg:flex-row lg:items-center lg:justify-between lg:px-10">
            <div className="max-w-3xl">
              <div className="text-sm font-semibold uppercase tracking-[0.24em] text-emerald-50/80">Público, organizadores e atletas</div>
              <h2 className="mt-3 text-2xl font-semibold leading-tight text-white sm:text-3xl lg:text-4xl">
                Traga sua operação, sua comunidade e sua presença digital para o mesmo lugar.
              </h2>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button asChild size="lg" className="bg-white text-slate-950 hover:bg-emerald-50">
                <Link to={primaryHref}>{isAuthenticated ? 'Abrir meu torneio' : 'Entrar na plataforma'}</Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="border-white/20 bg-white/10 text-white hover:bg-white/15 hover:text-white">
                <Link to="/torneios/publicos">Explorar torneios públicos</Link>
              </Button>
            </div>
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

function FeatureCard({ icon: Icon, title, desc }) {
  return (
    <Card className="h-full rounded-[1.75rem] border-white/80 bg-white/80 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_24px_50px_-30px_rgba(15,23,42,0.38)]">
      <CardContent className="p-7">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-800">
          <Icon className="h-5 w-5" />
        </div>
        <h3 className="text-xl font-semibold text-slate-950">{title}</h3>
        <p className="mt-2 text-sm leading-7 text-slate-600">{desc}</p>
      </CardContent>
    </Card>
  );
}

function HighlightBox({ title, desc }) {
  return (
    <div className="rounded-[1.35rem] border border-white/10 bg-white/10 p-4 backdrop-blur-sm">
      <div className="text-sm font-semibold text-white">{title}</div>
      <p className="mt-1 text-xs leading-6 text-emerald-50/75">{desc}</p>
    </div>
  );
}
