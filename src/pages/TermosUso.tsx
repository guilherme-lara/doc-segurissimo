import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export default function Terms() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 relative overflow-hidden selection:bg-indigo-500/30">
      {/* Efeito Glow de fundo */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-indigo-500/10 dark:bg-indigo-500/20 blur-[120px] rounded-full pointer-events-none" />

      <div className="max-w-3xl mx-auto px-6 py-16 relative z-10">
        <Link 
          to="/" 
          className="inline-flex items-center text-sm font-medium text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 transition-colors mb-8"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Voltar para o início
        </Link>

        <header className="mb-12">
          <h1 className="text-3xl md:text-4xl font-bold text-zinc-900 dark:text-white mb-4 tracking-tight">
            Termos de Uso
          </h1>
          <span className="inline-block px-3 py-1 rounded-full bg-zinc-200/50 dark:bg-zinc-800/50 text-xs font-medium text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-800">
            Última atualização: Março de 2026
          </span>
        </header>

        <div className="space-y-8 text-zinc-600 dark:text-zinc-400 leading-relaxed">
          <p>
            Bem-vindo(a) ao Doc Seguríssimo, uma solução desenvolvida pela Tech Bauru. Ao utilizar nossa plataforma, seja como Profissional (Contratante) ou como Cliente Final (Remetente de arquivos), você concorda com os termos descritos abaixo.
          </p>

          <section>
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-3">1. O Papel da Plataforma</h2>
            <p>O Doc Seguríssimo é uma ferramenta de Software as a Service (SaaS) que fornece infraestrutura tecnológica para o recebimento, organização e armazenamento temporário ou definitivo de arquivos e documentos. Nós não prestamos serviços jurídicos, contábeis ou de despachante.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-3">2. Responsabilidades do Profissional (Controlador dos Dados)</h2>
            <p className="mb-2">O Profissional que utiliza nossa plataforma para solicitar documentos aos seus clientes é o único responsável por:</p>
            <ul className="list-disc pl-5 space-y-2">
              <li>Solicitar apenas documentos estritamente necessários para a prestação do seu serviço.</li>
              <li>Garantir que possui o consentimento do Cliente Final para o tratamento daqueles dados.</li>
              <li>Gerenciar a exclusão dos documentos quando estes não forem mais necessários.</li>
            </ul>
            <p className="mt-2">O Doc Seguríssimo atua estritamente como Operador dos dados, processando os arquivos conforme os comandos executados pelo Profissional em seu painel.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-3">3. Responsabilidades do Cliente Final (Remetente)</h2>
            <p className="mb-2">Ao enviar documentos através de um link seguro gerado pelo Doc Seguríssimo, você atesta que:</p>
            <ul className="list-disc pl-5 space-y-2">
              <li>Os documentos e informações enviadas são autênticos e verdadeiros.</li>
              <li>Você possui autorização legal para compartilhar os referidos arquivos com o Profissional solicitante.</li>
              <li>Você compreende que o upload é feito de forma voluntária para atender a uma solicitação do Profissional.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-3">4. Disponibilidade e Limitação de Responsabilidade</h2>
            <p>A Tech Bauru emprega os melhores esforços em segurança da informação e criptografia para manter a plataforma online e segura. No entanto, não garantimos disponibilidade ininterrupta. Não nos responsabilizamos por perdas de dados decorrentes de exclusões acidentais feitas pelo Profissional, expiração de links configurados ou falhas de conexão do usuário.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-3">5. Uso Aceitável</h2>
            <p className="mb-2">É terminantemente proibido utilizar o Doc Seguríssimo para o envio, armazenamento ou distribuição de:</p>
            <ul className="list-disc pl-5 space-y-2">
              <li>Arquivos contendo malwares, vírus ou códigos maliciosos.</li>
              <li>Conteúdo ilegal, difamatório, pornográfico ou que viole direitos autorais de terceiros.</li>
            </ul>
            <p className="mt-2 text-rose-600 dark:text-rose-400 font-medium">O descumprimento desta regra resultará no banimento imediato da conta do Profissional e exclusão dos links ativos.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
