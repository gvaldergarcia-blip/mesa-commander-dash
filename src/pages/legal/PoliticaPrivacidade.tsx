import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function PoliticaPrivacidade() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-10">
        <Button variant="ghost" asChild className="mb-6">
          <Link to="/"><ArrowLeft className="h-4 w-4 mr-2" />Voltar ao site</Link>
        </Button>

        <article className="prose prose-neutral dark:prose-invert max-w-none">
          <h1>Política de Privacidade – MESACLIK</h1>
          <p className="text-muted-foreground text-sm">Última atualização: 04/03/2026</p>
          <p>
            A presente Política de Privacidade descreve como o MESACLIK coleta, utiliza, armazena e protege dados pessoais
            de usuários e restaurantes que utilizam a plataforma.
          </p>

          <h2>1. Introdução</h2>
          <p>O MESACLIK é uma plataforma tecnológica que permite a gestão de filas, reservas e relacionamento com clientes para restaurantes. Esta Política de Privacidade foi criada para explicar de forma transparente como os dados pessoais são tratados em conformidade com a Lei Geral de Proteção de Dados (LGPD).</p>

          <h2>2. Dados Coletados</h2>
          <p>Durante a utilização da plataforma, podem ser coletados:</p>
          <ul>
            <li>Nome</li>
            <li>Endereço de e-mail</li>
            <li>Número de telefone</li>
            <li>Informações sobre reservas ou entradas em fila</li>
            <li>Histórico de interações com restaurantes</li>
            <li>Informações técnicas de acesso (como IP e dispositivo)</li>
          </ul>

          <h2>3. Como os Dados São Utilizados</h2>
          <p>Os dados coletados podem ser utilizados para:</p>
          <ul>
            <li>Permitir o funcionamento da plataforma</li>
            <li>Registrar reservas e filas</li>
            <li>Comunicação entre restaurante e cliente</li>
            <li>Envio de comunicações autorizadas</li>
            <li>Melhoria da experiência do usuário</li>
            <li>Análise de uso da plataforma</li>
          </ul>

          <h2>4. Relação entre Restaurante e MESACLIK</h2>
          <p>Para fins da legislação de proteção de dados:</p>
          <ul>
            <li>O restaurante atua como <strong>CONTROLADOR</strong> dos dados de seus clientes.</li>
            <li>O MESACLIK atua como <strong>OPERADOR</strong> da infraestrutura tecnológica.</li>
          </ul>
          <p>Isso significa que o restaurante decide como utilizar os dados de seus clientes, enquanto o MESACLIK fornece a tecnologia que permite essa operação.</p>

          <h2>5. Compartilhamento de Dados</h2>
          <p>Os dados poderão ser compartilhados com:</p>
          <ul>
            <li>Restaurantes participantes da plataforma</li>
            <li>Provedores de infraestrutura tecnológica</li>
            <li>Ferramentas necessárias para funcionamento da plataforma</li>
          </ul>
          <p>O MESACLIK não vende dados pessoais a terceiros.</p>

          <h2>6. Armazenamento de Dados</h2>
          <p>Os dados podem ser armazenados em servidores seguros utilizados pela plataforma. O MESACLIK adota medidas técnicas e organizacionais para proteger as informações contra acesso não autorizado.</p>

          <h2>7. Segurança da Informação</h2>
          <p>O MESACLIK utiliza medidas de segurança para proteger os dados. No entanto, considerando a natureza da internet, nenhum sistema é totalmente imune a riscos de segurança.</p>

          <h2>8. Direitos dos Titulares</h2>
          <p>De acordo com a LGPD, os usuários possuem direitos relacionados aos seus dados pessoais, incluindo:</p>
          <ul>
            <li>Confirmação da existência de tratamento</li>
            <li>Acesso aos dados</li>
            <li>Correção de dados incompletos</li>
            <li>Solicitação de exclusão de dados quando aplicável</li>
          </ul>

          <h2>9. Retenção de Dados</h2>
          <p>Os dados poderão ser armazenados pelo tempo necessário para cumprimento das finalidades da plataforma ou para cumprimento de obrigações legais.</p>

          <h2>10. Cookies</h2>
          <p>O MESACLIK pode utilizar cookies e tecnologias similares para:</p>
          <ul>
            <li>Autenticação de usuários</li>
            <li>Análise de uso da plataforma</li>
            <li>Melhoria da experiência do usuário</li>
          </ul>
          <p>Os cookies podem ser gerenciados pelo próprio usuário nas configurações do navegador.</p>

          <h2>11. Alterações desta Política</h2>
          <p>O MESACLIK poderá atualizar esta Política de Privacidade periodicamente para refletir melhorias na plataforma ou alterações legais.</p>

          <h2>12. Contato</h2>
          <p>Em caso de dúvidas sobre esta Política de Privacidade ou sobre o tratamento de dados pessoais, o usuário poderá entrar em contato com o MESACLIK pelos canais oficiais da plataforma.</p>
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
