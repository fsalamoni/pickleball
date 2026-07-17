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
import InstallAppButton from '@/components/InstallAppButton';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { V2Button } from '@/v2/ui/primitives';

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
    <div className="v2-root min-h-screen bg-paper font-inter text-ink">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-gray-100 bg-paper/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <Link to="/" className="flex items-center gap-3">
            <img src="/logo-claro.png" alt="PickleRush" className="h-9 w-9 object-contain" />
            <span className="font-display text-2xl font-bold tracking-tight text-ink">PickleRush</span>
          </Link>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <nav className="hidden items-center gap-1 md:flex">
              <V2Button asChild variant="ghost" size="sm"><Link to="/regras">Regras</Link></V2Button>
              <V2Button asChild variant="ghost" size="sm"><Link to="/nivelamento">Nivelamento</Link></V2Button>
              <V2Button asChild variant="ghost" size="sm"><Link to="/conduta">Fair Play</Link></V2Button>
            </nav>
            <V2Button asChild size="sm">
              <Link to={isAuthenticated ? '/' : '/login'}>
                {isAuthenticated ? 'Abrir painel' : 'Entrar com Google'}
              </Link>
            </V2Button>
          </div>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="mx-auto grid max-w-7xl gap-12 px-6 pb-16 pt-14 lg:grid-cols-[1.1fr,0.9fr] lg:items-center lg:pt-20">
          <div className="max-w-3xl">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-paper-pure px-3 py-1 text-xs font-bold text-ink shadow-sm">
              <Sparkles className="h-3.5 w-3.5 text-acid-dark" /> Plataforma completa para torneios de pickleball no Brasil
            </span>
            <h1 className="mt-6 font-display text-4xl font-bold leading-[1.02] tracking-tight text-ink sm:text-5xl md:text-6xl xl:text-7xl">
              O pickleball ganha uma plataforma para evento, comunidade e continuidade.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-gray-500 md:text-xl">
              Crie torneios com estrutura profissional, publique modalidades e regras, acompanhe jogos e ranking, conecte atletas, clubes e arenas e mantenha o esporte ativo para além do fim de semana do evento.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <V2Button asChild size="lg">
                <Link to={primaryHref}>
                  {isAuthenticated ? 'Criar novo torneio' : 'Começar com Google'}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </V2Button>
              <V2Button asChild variant="ghost" size="lg">
                <Link to={secondaryHref}>
                  {isAuthenticated ? 'Ingressar com código' : 'Explorar como funciona'}
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </V2Button>
              <V2Button asChild variant="ghost" size="lg">
                <Link to="/torneios/publicos">
                  Ver torneios públicos
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </V2Button>
              <InstallAppButton size="lg" variant="outline" label="Baixar o app" />
            </div>

            <div className="mt-10 grid gap-3 sm:grid-cols-3">
              {HERO_STATS.map((item) => (
                <div key={item.value} className="rounded-3xl border border-gray-100 bg-paper-pure p-4 shadow-organic-sm">
                  <div className="font-display text-2xl font-bold text-ink">{item.value}</div>
                  <p className="mt-1 text-sm leading-6 text-gray-500">{item.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Hero dark panel */}
          <div className="relative lg:pt-6">
            <div className="relative overflow-hidden rounded-4xl bg-mesh p-8 shadow-organic lg:p-10">
              <div className="absolute -right-10 -top-10 h-56 w-56 rounded-full bg-acid opacity-20 blur-[80px]" />
              <div className="relative z-10">
                <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-widest text-acid">
                  <CalendarDays className="h-3.5 w-3.5" /> Pronto para abrir inscrições
                </span>
                <h2 className="mt-5 font-display text-2xl font-bold leading-tight text-white sm:text-3xl lg:text-4xl">
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

        {/* Feature cards */}
        <section className="mx-auto max-w-7xl px-6 pb-16">
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {FEATURE_CARDS.map((feature) => (
              <FeatureCard key={feature.title} icon={feature.icon} title={feature.title} desc={feature.desc} />
            ))}
          </div>
        </section>

        {/* Journey */}
        <section className="mx-auto max-w-7xl px-6 pb-20">
          <div className="grid gap-6 lg:grid-cols-[1fr,0.92fr]">
            <div className="rounded-4xl border border-gray-100 bg-paper-pure p-8 shadow-organic-sm lg:p-10">
              <span className="inline-flex items-center rounded-full border border-gray-200 bg-paper px-3 py-1 text-xs font-bold uppercase tracking-widest text-gray-500">Jornada do evento</span>
              <h2 className="mt-5 font-display text-2xl font-bold leading-tight text-ink sm:text-3xl lg:text-4xl">
                Como a plataforma acompanha cada etapa do torneio.
              </h2>

              <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {JOURNEY_STEPS.map((item) => (
                  <div key={item.step} className="rounded-3xl border border-gray-100 bg-paper p-5">
                    <div className="font-display text-sm font-bold uppercase tracking-widest text-acid-dark">{item.step}</div>
                    <h3 className="mt-3 font-display text-lg font-bold text-ink">{item.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-gray-500">{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-4xl border border-gray-100 bg-paper-pure p-8 shadow-organic-sm lg:p-10">
              <div className="flex h-full flex-col justify-center rounded-3xl border border-acid/30 bg-acid/10 p-6">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-ink text-acid">
                  <BookOpen className="h-7 w-7" />
                </div>
                <h3 className="mt-5 font-display text-2xl font-bold text-ink">Entre pelo conteúdo, continue pela participação</h3>
                <p className="mt-3 text-sm leading-7 text-gray-600">
                  Conheça as <Link to="/regras" className="font-bold text-ink underline-offset-4 hover:underline">regras oficiais</Link>, descubra seu nível com o <Link to="/nivelamento" className="font-bold text-ink underline-offset-4 hover:underline">formulário de nivelamento</Link> e depois encontre torneios, clubes e arenas para transformar interesse em presença real na comunidade.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="mx-auto max-w-7xl px-6 pb-24">
          <div className="relative flex flex-col gap-8 overflow-hidden rounded-4xl bg-mesh px-8 py-10 shadow-organic lg:flex-row lg:items-center lg:justify-between lg:px-12">
            <div className="absolute -right-10 -top-10 h-56 w-56 rounded-full bg-acid opacity-20 blur-[80px]" />
            <div className="relative z-10 max-w-3xl">
              <div className="font-display text-xs font-bold uppercase tracking-widest text-acid">Público, organizadores e atletas</div>
              <h2 className="mt-3 font-display text-2xl font-bold leading-tight text-white sm:text-3xl lg:text-4xl">
                Traga sua operação, sua comunidade e sua presença digital para o mesmo lugar.
              </h2>
            </div>
            <div className="relative z-10 flex flex-wrap gap-3">
              <V2Button asChild size="lg">
                <Link to={primaryHref}>{isAuthenticated ? 'Abrir meu torneio' : 'Entrar na plataforma'}</Link>
              </V2Button>
              <V2Button asChild variant="ghost" size="lg" className="border-white/20 bg-white/10 text-white hover:border-white/40 hover:bg-white/15">
                <Link to="/torneios/publicos">Explorar torneios públicos</Link>
              </V2Button>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-100 bg-paper-pure py-6">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 text-sm text-gray-500">
          <div className="flex items-center gap-2">
            <img src="/logo-claro.png" alt="PickleRush" className="h-6 w-6 object-contain" />
            <span>© {new Date().getFullYear()} PickleRush</span>
          </div>
          <div className="flex flex-wrap gap-4">
            <Link to="/regras" className="transition-colors hover:text-ink">Regras</Link>
            <Link to="/nivelamento" className="transition-colors hover:text-ink">Nivelamento</Link>
            <Link to="/politica-uso" className="transition-colors hover:text-ink">Política de Uso</Link>
            <Link to="/conduta" className="transition-colors hover:text-ink">Conduta &amp; Fair Play</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ icon: Icon, title, desc }) {
  return (
    <div className="h-full rounded-4xl border border-gray-100 bg-paper-pure p-7 shadow-organic-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-organic">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-ink text-acid">
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="font-display text-xl font-bold text-ink">{title}</h3>
      <p className="mt-2 text-sm leading-7 text-gray-500">{desc}</p>
    </div>
  );
}

function HighlightBox({ title, desc }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
      <div className="text-sm font-bold text-white">{title}</div>
      <p className="mt-1 text-xs leading-6 text-white/60">{desc}</p>
    </div>
  );
}
