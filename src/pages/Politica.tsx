import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ShieldCheck } from 'lucide-react';

export default function Privacy() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 relative overflow-hidden selection:bg-indigo-500/30">
      {/* Efeito Glow de fundo verde/segurança */}
      <div className="absolute top-0 right-1/4 w-[600px] h-[600px] bg-emerald-500/10 dark:bg-emerald-500/15 blur-[120px] rounded-full pointer-events-none" />

      <div className="max-w-3xl mx-auto px-6 py-16 relative z-10">
        <Link 
          to="/" 
          className="inline-flex items-center text-sm font-medium text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 transition-colors mb-8"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Voltar para o início
        </Link>

        <header className="mb-12 flex items-start gap-4">
          <div className="p-3 bg-zinc-200/50 dark:bg-zinc-800/50 rounded-2xl hidden sm:block">
            <ShieldCheck className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-zinc-900 dark:text-white mb-4 tracking-tight">
              Política de Privacidade (LGPD)
            </h1>
            <span className="inline-block px-3 py-1 rounded-full bg-zinc-200/50 dark:bg-zinc-800/50 text-xs font-medium text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-800">
              Última atualização: Março de 2026
            </span>
          </div>
        </header>

        <div className="space-y-8 text-zinc-600 dark:text-zinc-400 leading-relaxed">
          <p className="text-lg text-zinc-700 dark:text-zinc-300">
            A privacidade e a segurança dos seus dados são o pilar do Doc Seguríssimo, operado pela Tech Bauru. Esta política explica como lidamos com as informações que transitam em nossa plataforma, em total conformidade com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018 - LGPD).
          </p>

          <section>
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-3">1. Como atuamos (Controlador x Operador)</h2>
            <p>Para fins da LGPD, o Doc Seguríssimo atua predominantemente como <strong>Operador</strong> de dados. Isso significa que nós armazenamos e processamos os documentos estritamente sob as ordens e configurações do Profissional/Empresa que lhe enviou o link de solicitação (este sim, o <strong>Controlador</strong> dos dados).</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-3">2. Dados que Coletamos</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong>Do Profissional (Usuário da Plataforma):</strong> Nome, e-mail, telefone, CNPJ/CPF, dados de cobrança e registros de acesso (IP e logs).</li>
              <li><strong>Do Cliente Final (Remetente):</strong> Registros de acesso (Data, Hora e IP do momento do upload para fins de auditoria) e os arquivos/documentos submetidos na plataforma.</li>
            </ul>
            <p className="mt-3 text-zinc-900 dark:text-zinc-200 font-medium">Não lemos, não analisamos o conteúdo e não utilizamos os documentos trafegados para nenhum outro fim além da pura entrega ao Profissional solicitante.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-3">3. Armazenamento e Segurança</h2>
            <p>Os arquivos enviados são transferidos com criptografia de ponta a ponta (TLS/SSL). Após a aprovação pelo Profissional, os arquivos são armazenados em infraestrutura de nuvem segura ou servidores privados (via protocolo WebDAV/ownCloud) sob controle do Profissional.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-3">4. Compartilhamento de Dados</h2>
            <p className="uppercase font-semibold text-zinc-800 dark:text-zinc-200">Nós nunca vendemos, alugamos ou compartilhamos seus dados ou documentos com terceiros para fins publicitários ou comerciais.</p>
            <p className="mt-2">O compartilhamento ocorre única e exclusivamente entre o Cliente Final (que envia) e o Profissional (que recebe).</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-3">5. Uso de Cookies</h2>
            <p>Utilizamos apenas cookies estritamente necessários para o funcionamento da plataforma (como manutenção da sessão de login do Profissional e controle de segurança do link público). Não utilizamos cookies de rastreamento de marketing de terceiros na área de upload de documentos.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-3">6. Seus Direitos (Titular dos Dados)</h2>
            <p className="mb-2">Você tem o direito de solicitar a confirmação da existência de tratamento, o acesso aos dados, a correção e a exclusão dos mesmos.</p>
            <ul className="list-disc pl-5 space-y-2">
              <li>Como o Doc Seguríssimo é o Operador, solicitações referentes à exclusão de documentos devem ser direcionadas primariamente ao Profissional (Controlador) que solicitou seus arquivos.</li>
              <li>Para dúvidas diretas sobre a plataforma ou para acionar nosso Encarregado de Proteção de Dados (DPO), entre em contato através do e-mail: <strong>admin@techbauru.com.br</strong>.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-3">7. Retenção e Exclusão</h2>
            <p>Os links de solicitação podem ter prazo de validade (autodestruição). Arquivos atrelados a links expirados ou deletados pelo Profissional são permanentemente apagados dos nossos servidores, sem possibilidade de recuperação.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
