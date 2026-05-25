import { Link } from 'react-router-dom';
import { Trophy, AlertTriangle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

export default function ResponsibleGaming() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-slate-100">
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-30">
        <div className="max-w-3xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 font-bold">
            <Trophy className="w-5 h-5 text-emerald-600" /> Bolão Copa 2026
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-10 space-y-6">
        <Card className="border-amber-300 bg-amber-50">
          <CardContent className="p-6 flex items-start gap-4">
            <AlertTriangle className="w-8 h-8 text-amber-600 shrink-0 mt-1" />
            <div>
              <h1 className="text-2xl font-bold text-amber-900">Aviso sobre Uso Responsável</h1>
              <p className="mt-2 text-amber-800">
                A plataforma Bolão Copa 2026 é uma ferramenta de <strong>entretenimento social</strong> para bolões entre amigos,
                colegas ou familiares. Não somos uma operadora de jogos de azar e não processamos pagamentos.
              </p>
            </div>
          </CardContent>
        </Card>

        <section className="prose prose-slate max-w-none">
          <h2>Boas práticas</h2>
          <ul>
            <li>Estabeleça com seu bolão uma contribuição simbólica acessível para todos os participantes — divirta-se sem comprometer despesas essenciais.</li>
            <li>Não permita que a competição prejudique o relacionamento com a turma. É um jogo.</li>
            <li>Se notar comportamento compulsivo em plataformas pagas de jogos em busca de &quot;compensação&quot;, pause.</li>
          </ul>

          <h2>Sinais de alerta</h2>
          <ul>
            <li>Sentir-se ansioso ou irritado quando não está participando de jogos pagos</li>
            <li>Gastar valores acima do que pode perder</li>
            <li>Esconder das pessoas próximas o quanto está gastando ou perdendo</li>
            <li>Tentar recuperar perdas com novas participações pagas</li>
            <li>Buscar empréstimos para jogar</li>
          </ul>

          <h2>Onde buscar ajuda</h2>
          <p>
            Se você ou alguém próximo apresenta sinais de jogo compulsivo, procure apoio:
          </p>
          <ul>
            <li><strong>Jogadores Anônimos Brasil</strong> — grupos de ajuda mútua gratuitos.</li>
            <li><strong>CAPS (Centro de Atenção Psicossocial)</strong> — atendimento público pelo SUS.</li>
            <li><strong>CVV — Centro de Valorização da Vida</strong>: ligue 188, gratuito 24h.</li>
          </ul>

          <p className="text-sm text-slate-500">
            A plataforma reserva-se o direito de suspender contas que demonstrem uso abusivo ou que estejam sendo usadas para
            atividades comerciais não autorizadas.
          </p>
        </section>
      </main>
    </div>
  );
}
