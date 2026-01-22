/**
 * Página de Política de Privacidade do MesaClik
 * Placeholder v1 - Conformidade LGPD
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function PoliticaPrivacidade() {
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
            <CardTitle className="text-2xl">Política de Privacidade</CardTitle>
            <p className="text-white/80 text-sm">Versão v1 (rascunho) - Última atualização: Janeiro 2026</p>
          </CardHeader>

          <CardContent className="prose prose-sm max-w-none p-6 space-y-6">
            <section>
              <h2 className="text-lg font-semibold text-foreground">1. Introdução</h2>
              <p className="text-muted-foreground">
                Esta Política de Privacidade descreve como o MesaClik coleta, usa e protege seus dados pessoais,
                em conformidade com a Lei Geral de Proteção de Dados (LGPD - Lei nº 13.709/2018).
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground">2. Dados que Coletamos</h2>
              <p className="text-muted-foreground">
                Ao utilizar nosso serviço de fila, coletamos:
              </p>
              <ul className="list-disc list-inside text-muted-foreground ml-4">
                <li><strong>E-mail:</strong> Para envio de notificações sobre sua posição na fila</li>
                <li><strong>Nome (opcional):</strong> Para identificação no restaurante</li>
                <li><strong>Tamanho do grupo:</strong> Para organização da fila</li>
                <li><strong>Data e hora de entrada:</strong> Para cálculo de posição</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground">3. Finalidade do Tratamento</h2>
              <p className="text-muted-foreground">
                Seus dados são utilizados para:
              </p>
              <ul className="list-disc list-inside text-muted-foreground ml-4">
                <li>Gerenciar sua posição na fila do restaurante</li>
                <li>Enviar notificações transacionais (confirmação, chamada, etc.)</li>
                <li>Enviar ofertas e promoções (apenas com seu consentimento expresso)</li>
                <li>Melhorar nossos serviços através de análises agregadas</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground">4. Base Legal (LGPD)</h2>
              <p className="text-muted-foreground">
                O tratamento de seus dados é realizado com base em:
              </p>
              <ul className="list-disc list-inside text-muted-foreground ml-4">
                <li><strong>Execução de contrato:</strong> Para prestação do serviço de fila</li>
                <li><strong>Consentimento:</strong> Para envio de comunicações de marketing</li>
                <li><strong>Legítimo interesse:</strong> Para melhorias no serviço e prevenção de fraudes</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground">5. Compartilhamento de Dados</h2>
              <p className="text-muted-foreground">
                Seus dados podem ser compartilhados com:
              </p>
              <ul className="list-disc list-inside text-muted-foreground ml-4">
                <li><strong>Restaurante parceiro:</strong> Para operação da fila</li>
                <li><strong>Provedores de serviço:</strong> Hospedagem (Supabase), E-mail (Resend)</li>
              </ul>
              <p className="text-muted-foreground mt-2">
                Não vendemos seus dados pessoais a terceiros.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground">6. Seus Direitos (LGPD)</h2>
              <p className="text-muted-foreground">
                Você tem direito a:
              </p>
              <ul className="list-disc list-inside text-muted-foreground ml-4">
                <li>Confirmar a existência de tratamento de seus dados</li>
                <li>Acessar seus dados pessoais</li>
                <li>Corrigir dados incompletos ou desatualizados</li>
                <li>Solicitar anonimização ou exclusão de dados desnecessários</li>
                <li>Revogar consentimento para marketing a qualquer momento</li>
                <li>Solicitar portabilidade dos dados</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground">7. Retenção de Dados</h2>
              <p className="text-muted-foreground">
                Mantemos seus dados pelo período necessário para:
              </p>
              <ul className="list-disc list-inside text-muted-foreground ml-4">
                <li>Dados de fila: Até 24 horas após finalização</li>
                <li>Histórico de visitas: Até 2 anos para estatísticas</li>
                <li>Dados de marketing: Até revogação do consentimento</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground">8. Segurança</h2>
              <p className="text-muted-foreground">
                Adotamos medidas técnicas e organizacionais para proteger seus dados, incluindo:
              </p>
              <ul className="list-disc list-inside text-muted-foreground ml-4">
                <li>Criptografia de dados em trânsito (HTTPS/TLS)</li>
                <li>Controle de acesso baseado em funções</li>
                <li>Monitoramento de segurança contínuo</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground">9. Contato do Encarregado (DPO)</h2>
              <p className="text-muted-foreground">
                Para exercer seus direitos ou esclarecer dúvidas sobre privacidade:
              </p>
              <p className="text-muted-foreground">
                <strong>E-mail:</strong> privacidade@mesaclik.com.br
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground">10. Alterações nesta Política</h2>
              <p className="text-muted-foreground">
                Esta política pode ser atualizada periodicamente. Notificaremos alterações significativas
                por e-mail ou através de aviso em nosso site.
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
