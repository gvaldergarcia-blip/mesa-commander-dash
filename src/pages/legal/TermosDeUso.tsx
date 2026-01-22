/**
 * Página de Termos de Uso do MesaClik
 * Placeholder v1
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function TermosDeUso() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-50 to-background p-4">
      <div className="max-w-3xl mx-auto">
        <Button
          variant="ghost"
          onClick={() => navigate(-1)}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>

        <Card className="shadow-lg">
          <CardHeader className="bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-t-lg">
            <CardTitle className="text-2xl">Termos de Uso</CardTitle>
            <p className="text-white/80 text-sm">Versão v1 (rascunho) - Última atualização: Janeiro 2026</p>
          </CardHeader>

          <CardContent className="prose prose-sm max-w-none p-6 space-y-6">
            <section>
              <h2 className="text-lg font-semibold text-foreground">1. Aceitação dos Termos</h2>
              <p className="text-muted-foreground">
                Ao utilizar o sistema de fila do MesaClik, você concorda com estes Termos de Uso. 
                Se você não concordar com qualquer parte destes termos, não utilize nosso serviço.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground">2. Descrição do Serviço</h2>
              <p className="text-muted-foreground">
                O MesaClik é uma plataforma que conecta restaurantes e seus clientes, oferecendo:
              </p>
              <ul className="list-disc list-inside text-muted-foreground ml-4">
                <li>Sistema de fila virtual com acompanhamento em tempo real</li>
                <li>Notificações por e-mail sobre sua posição na fila</li>
                <li>Sistema de reservas (quando disponível)</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground">3. Uso do Serviço</h2>
              <p className="text-muted-foreground">
                Ao entrar na fila de um restaurante, você se compromete a:
              </p>
              <ul className="list-disc list-inside text-muted-foreground ml-4">
                <li>Fornecer informações verdadeiras e atualizadas</li>
                <li>Comparecer ao restaurante quando chamado</li>
                <li>Cancelar sua entrada na fila caso não possa comparecer</li>
                <li>Não usar o serviço para fins fraudulentos ou abusivos</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground">4. Comunicações</h2>
              <p className="text-muted-foreground">
                Ao entrar na fila, você receberá e-mails transacionais sobre:
              </p>
              <ul className="list-disc list-inside text-muted-foreground ml-4">
                <li>Confirmação de entrada na fila</li>
                <li>Atualizações de posição</li>
                <li>Notificação quando for sua vez</li>
              </ul>
              <p className="text-muted-foreground mt-2">
                Comunicações de marketing são opcionais e requerem consentimento separado.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground">5. Limitação de Responsabilidade</h2>
              <p className="text-muted-foreground">
                O MesaClik não garante disponibilidade de mesas nos restaurantes parceiros. 
                O tempo de espera é estimativa e pode variar de acordo com a operação de cada estabelecimento.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground">6. Alterações nos Termos</h2>
              <p className="text-muted-foreground">
                Reservamo-nos o direito de modificar estes termos a qualquer momento. 
                Alterações significativas serão comunicadas por e-mail aos usuários cadastrados.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground">7. Contato</h2>
              <p className="text-muted-foreground">
                Para dúvidas sobre estes termos, entre em contato conosco através do e-mail: 
                contato@mesaclik.com.br
              </p>
            </section>

            <div className="pt-4 border-t text-center text-muted-foreground text-sm">
              © 2026 MesaClik. Todos os direitos reservados.
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
