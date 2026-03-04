import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function TermosDeUso() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-10">
        <Button variant="ghost" asChild className="mb-6">
          <Link to="/"><ArrowLeft className="h-4 w-4 mr-2" />Voltar ao site</Link>
        </Button>

        <article className="prose prose-neutral dark:prose-invert max-w-none">
          <h1>MESACLIK – Termos de Uso</h1>
          <p className="text-muted-foreground text-sm">Última atualização: 04/03/2026</p>
          <p>
            Este documento consolida Termos de Uso, Contrato de Prestação de Serviços SaaS, Política de Privacidade (LGPD),
            Política de Cookies, cláusulas de limitação de responsabilidade, SLA básico e regras operacionais da plataforma MESACLIK.
          </p>

          <h2>1. Definições</h2>
          <ul>
            <li><strong>MESACLIK:</strong> plataforma tecnológica SaaS destinada a restaurantes.</li>
            <li><strong>Plataforma:</strong> conjunto de softwares, aplicativos, APIs e painel web.</li>
            <li><strong>Restaurante:</strong> estabelecimento que contrata a plataforma.</li>
            <li><strong>Usuário Final:</strong> cliente que utiliza filas ou reservas.</li>
            <li><strong>Conta:</strong> credenciais de acesso ao sistema.</li>
            <li><strong>Serviços:</strong> funcionalidades fornecidas pelo MESACLIK.</li>
          </ul>

          <h2>2. Objeto do Contrato</h2>
          <p>O MESACLIK fornece infraestrutura tecnológica para gestão de filas, reservas, cadastro de clientes, relatórios operacionais e ferramentas de comunicação. O MESACLIK não atua como operador de restaurante nem garante fluxo de clientes.</p>

          <h2>3. Cadastro do Restaurante</h2>
          <p>O restaurante deve fornecer informações verdadeiras e atualizadas. O restaurante é responsável por proteger suas credenciais de acesso. O MESACLIK pode suspender contas com informações falsas ou uso indevido.</p>

          <h2>4. Estrutura de Unidades</h2>
          <p>Restaurantes podem cadastrar múltiplas unidades dentro da plataforma. Cada unidade poderá possuir suas próprias filas, reservas e relatórios.</p>

          <h2>5. Funcionamento da Plataforma</h2>
          <p>A plataforma permite:</p>
          <ul>
            <li>Organização de filas</li>
            <li>Gerenciamento de reservas</li>
            <li>Cadastro de clientes</li>
            <li>Envio de comunicações autorizadas</li>
            <li>Relatórios operacionais</li>
          </ul>

          <h2>6. Exibição no Aplicativo</h2>
          <p>A presença do restaurante no aplicativo depende de assinatura ativa. Sem plano ativo o restaurante poderá deixar de aparecer no aplicativo.</p>

          <h2>7. Cancelamento e Reativação</h2>
          <p>O restaurante pode cancelar a assinatura a qualquer momento. Após cancelamento o acesso ao painel poderá ser suspenso. Caso o restaurante reative a assinatura, os dados poderão ser restaurados quando disponíveis.</p>

          <h2>8. Planos e Pagamentos</h2>
          <p>O MESACLIK poderá oferecer planos mensais ou anuais. A inadimplência poderá resultar em suspensão do acesso.</p>

          <h2>9. Responsabilidade do Restaurante</h2>
          <p>O restaurante é responsável por manter seus dados atualizados, proteger suas credenciais e garantir o uso adequado da plataforma.</p>

          <h2>10. Comunicações com Clientes</h2>
          <p>O restaurante deve enviar promoções apenas a clientes que autorizaram comunicações. O MESACLIK fornece apenas a infraestrutura tecnológica.</p>

          <h2>11. LGPD e Tratamento de Dados</h2>
          <p>O tratamento de dados segue a Lei Geral de Proteção de Dados (LGPD). Controlador: restaurante. Operador: MESACLIK.</p>

          <h2>12. Tipos de Dados Coletados</h2>
          <p>Podem ser coletados:</p>
          <ul>
            <li>Nome</li>
            <li>E-mail</li>
            <li>Telefone</li>
            <li>Histórico de reservas</li>
            <li>Dados de interação com a plataforma</li>
          </ul>

          <h2>13. Finalidade dos Dados</h2>
          <p>Os dados podem ser utilizados para:</p>
          <ul>
            <li>Funcionamento do sistema</li>
            <li>Gestão de reservas e filas</li>
          </ul>

          <h2>14. Segurança da Informação</h2>
          <p>O MESACLIK adota medidas técnicas de segurança. Contudo, nenhum sistema é totalmente imune a ataques cibernéticos.</p>

          <h2>15. Incidentes de Segurança</h2>
          <p>Em caso de incidente de segurança, medidas razoáveis serão adotadas para investigação e mitigação.</p>

          <h2>16. SLA e Disponibilidade</h2>
          <p>O MESACLIK busca manter alta disponibilidade do sistema. Entretanto, não garante funcionamento ininterrupto. Interrupções podem ocorrer por manutenção, atualizações ou eventos externos.</p>

          <h2>17. Limitação de Responsabilidade</h2>
          <p>O MESACLIK não se responsabiliza por:</p>
          <ul>
            <li>Lucros cessantes</li>
            <li>Perda de faturamento</li>
            <li>Perda de clientes</li>
            <li>Danos indiretos</li>
          </ul>
          <p>A responsabilidade total será limitada ao valor pago nos últimos 12 meses.</p>

          <h2>18. Uso Indevido</h2>
          <p>É proibido utilizar a plataforma para spam, atividades ilegais ou violação de direitos.</p>

          <h2>19. Propriedade Intelectual</h2>
          <p>Todo o software, design, algoritmos e banco de dados pertencem ao MESACLIK.</p>

          <h2>20. Cookies</h2>
          <p>Cookies podem ser utilizados para autenticação, análise e melhoria da experiência.</p>

          <h2>21. Alterações dos Termos</h2>
          <p>O MESACLIK poderá atualizar estes termos periodicamente.</p>

          <h2>22. Rescisão</h2>
          <p>Contas podem ser encerradas por violação dos termos ou inadimplência.</p>

          <h2>23. Foro e Legislação</h2>
          <p>Este documento é regido pelas leis da República Federativa do Brasil.</p>

          <h2>24. Disposições Finais</h2>
          <p>Ao utilizar a plataforma, o restaurante declara concordar com todas as condições estabelecidas neste documento.</p>
        </article>

        <footer className="mt-12 pt-6 border-t border-border text-center text-sm text-muted-foreground space-y-1">
          <p>© 2026 MESACLIK</p>
          <p>
            <Link to="/legal/termos-de-uso" className="underline hover:text-foreground">Termos de Uso</Link>
            {' | '}
            <Link to="/legal/politica-de-privacidade" className="underline hover:text-foreground">Política de Privacidade</Link>
          </p>
        </footer>
      </div>
    </div>
  );
}
