import { useState } from "react";
import { Plus, Megaphone, Mail, Users, Calendar, TrendingUp, Eye, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusBadge } from "@/components/ui/status-badge";

// Mock data - will be replaced with Supabase queries
const mockPromotions = [
  {
    id: 1,
    title: "Happy Hour Especial",
    description: "30% de desconto em bebidas das 17h às 19h",
    starts_at: new Date(),
    ends_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    audience_filter: "all",
    status: "active",
    emails_sent: 156,
    emails_opened: 87,
    emails_clicked: 23
  },
  {
    id: 2,
    title: "Jantar Romântico",
    description: "Menu especial para casais + sobremesa gratuita",
    starts_at: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
    ends_at: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
    audience_filter: "couples",
    status: "scheduled",
    emails_sent: 0,
    emails_opened: 0,
    emails_clicked: 0
  },
  {
    id: 3,
    title: "Volta dos VIPs",
    description: "20% de desconto para clientes com 10+ visitas",
    starts_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    ends_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    audience_filter: "vip",
    status: "completed",
    emails_sent: 45,
    emails_opened: 32,
    emails_clicked: 18
  }
];

const mockEmailLogs = [
  {
    id: 1,
    customer_name: "Maria Silva",
    promotion_title: "Happy Hour Especial",
    status: "opened",
    sent_at: new Date(Date.now() - 2 * 60 * 60 * 1000),
    opened_at: new Date(Date.now() - 30 * 60 * 1000)
  },
  {
    id: 2,
    customer_name: "João Santos",
    promotion_title: "Happy Hour Especial",
    status: "sent",
    sent_at: new Date(Date.now() - 1 * 60 * 60 * 1000),
    opened_at: null
  },
  {
    id: 3,
    customer_name: "Ana Costa",
    promotion_title: "Volta dos VIPs",
    status: "clicked",
    sent_at: new Date(Date.now() - 24 * 60 * 60 * 1000),
    opened_at: new Date(Date.now() - 23 * 60 * 60 * 1000)
  }
];

export default function Promotions() {
  const [selectedPromotion, setSelectedPromotion] = useState<typeof mockPromotions[0] | null>(null);

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const formatDateTime = (date: Date) => {
    return date.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getPromotionStatus = (promotion: typeof mockPromotions[0]) => {
    const now = new Date();
    if (now < promotion.starts_at) return "scheduled";
    if (now > promotion.ends_at) return "completed";
    return "active";
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-success/10 text-success">Ativa</Badge>;
      case "scheduled":
        return <Badge className="bg-warning/10 text-warning">Agendada</Badge>;
      case "completed":
        return <Badge className="bg-muted">Finalizada</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getEmailStatusBadge = (status: string) => {
    switch (status) {
      case "sent":
        return <Badge className="bg-warning/10 text-warning">Enviado</Badge>;
      case "opened":
        return <Badge className="bg-accent/10 text-accent">Aberto</Badge>;
      case "clicked":
        return <Badge className="bg-success/10 text-success">Clicado</Badge>;
      case "failed":
        return <Badge className="bg-destructive/10 text-destructive">Falhou</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const totalPromotions = mockPromotions.length;
  const activePromotions = mockPromotions.filter(p => getPromotionStatus(p) === "active").length;
  const totalEmailsSent = mockPromotions.reduce((sum, p) => sum + p.emails_sent, 0);
  const totalEmailsOpened = mockPromotions.reduce((sum, p) => sum + p.emails_opened, 0);
  const openRate = totalEmailsSent > 0 ? (totalEmailsOpened / totalEmailsSent * 100).toFixed(1) : 0;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Promoções & Marketing</h1>
          <p className="text-muted-foreground">Gerencie campanhas e engaje seus clientes</p>
        </div>
        <Dialog>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Nova Promoção
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Criar Nova Promoção</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <Input placeholder="Título da promoção" />
              <Textarea 
                placeholder="Descrição detalhada da oferta"
                rows={3}
              />
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Data de início</label>
                  <Input type="datetime-local" />
                </div>
                <div>
                  <label className="text-sm font-medium">Data de fim</label>
                  <Input type="datetime-local" />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Público-alvo</label>
                <select className="w-full mt-1 p-2 border rounded-md">
                  <option value="all">Todos os clientes</option>
                  <option value="vip">Clientes VIP (10+ visitas)</option>
                  <option value="new">Novos clientes</option>
                  <option value="inactive">Clientes inativos</option>
                </select>
              </div>
              <Button className="w-full">Criar Promoção</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <Megaphone className="h-5 w-5 text-primary" />
              <div>
                <p className="text-2xl font-bold">{totalPromotions}</p>
                <p className="text-sm text-muted-foreground">Total promoções</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <Calendar className="h-5 w-5 text-success" />
              <div>
                <p className="text-2xl font-bold">{activePromotions}</p>
                <p className="text-sm text-muted-foreground">Promoções ativas</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <Mail className="h-5 w-5 text-accent" />
              <div>
                <p className="text-2xl font-bold">{totalEmailsSent}</p>
                <p className="text-sm text-muted-foreground">Emails enviados</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <TrendingUp className="h-5 w-5 text-warning" />
              <div>
                <p className="text-2xl font-bold">{openRate}%</p>
                <p className="text-sm text-muted-foreground">Taxa abertura</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="promotions" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="promotions">Promoções</TabsTrigger>
          <TabsTrigger value="logs">Logs de Email</TabsTrigger>
        </TabsList>

        <TabsContent value="promotions" className="space-y-4">
          {/* Promotions List */}
          <Card>
            <CardHeader>
              <CardTitle>Lista de Promoções</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Promoção</TableHead>
                    <TableHead>Período</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Emails</TableHead>
                    <TableHead>Engajamento</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mockPromotions.map((promotion) => (
                    <TableRow key={promotion.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{promotion.title}</div>
                          <div className="text-sm text-muted-foreground">
                            {promotion.description}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div>{formatDate(promotion.starts_at)}</div>
                          <div className="text-muted-foreground">
                            até {formatDate(promotion.ends_at)}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(getPromotionStatus(promotion))}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div className="font-medium">{promotion.emails_sent}</div>
                          <div className="text-muted-foreground">enviados</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {promotion.emails_sent > 0 ? (
                          <div className="text-sm">
                            <div>{promotion.emails_opened} abertos</div>
                            <div className="text-muted-foreground">
                              {promotion.emails_clicked} cliques
                            </div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => setSelectedPromotion(promotion)}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          {getPromotionStatus(promotion) === "active" && (
                            <Button size="sm" className="bg-accent hover:bg-accent/90">
                              <Send className="w-4 h-4 mr-1" />
                              Enviar
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logs">
          {/* Email Logs */}
          <Card>
            <CardHeader>
              <CardTitle>Logs de Email</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Promoção</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Enviado</TableHead>
                    <TableHead>Aberto</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mockEmailLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="font-medium">
                        {log.customer_name}
                      </TableCell>
                      <TableCell>{log.promotion_title}</TableCell>
                      <TableCell>
                        {getEmailStatusBadge(log.status)}
                      </TableCell>
                      <TableCell className="text-sm">
                        {formatDateTime(log.sent_at)}
                      </TableCell>
                      <TableCell className="text-sm">
                        {log.opened_at ? formatDateTime(log.opened_at) : "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Promotion Detail Dialog */}
      <Dialog open={!!selectedPromotion} onOpenChange={() => setSelectedPromotion(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detalhes da Promoção</DialogTitle>
          </DialogHeader>
          {selectedPromotion && (
            <div className="space-y-4">
              <div>
                <h3 className="text-xl font-semibold">{selectedPromotion.title}</h3>
                <p className="text-muted-foreground">{selectedPromotion.description}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="font-semibold mb-2">Período</h4>
                  <p>Início: {formatDate(selectedPromotion.starts_at)}</p>
                  <p>Fim: {formatDate(selectedPromotion.ends_at)}</p>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">Status</h4>
                  {getStatusBadge(getPromotionStatus(selectedPromotion))}
                </div>
              </div>

              <div>
                <h4 className="font-semibold mb-2">Métricas de Email</h4>
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center p-4 bg-muted/50 rounded-lg">
                    <div className="text-2xl font-bold">{selectedPromotion.emails_sent}</div>
                    <div className="text-sm text-muted-foreground">Enviados</div>
                  </div>
                  <div className="text-center p-4 bg-accent/10 rounded-lg">
                    <div className="text-2xl font-bold">{selectedPromotion.emails_opened}</div>
                    <div className="text-sm text-muted-foreground">Abertos</div>
                  </div>
                  <div className="text-center p-4 bg-success/10 rounded-lg">
                    <div className="text-2xl font-bold">{selectedPromotion.emails_clicked}</div>
                    <div className="text-sm text-muted-foreground">Cliques</div>
                  </div>
                </div>
              </div>

              {getPromotionStatus(selectedPromotion) === "active" && (
                <Button className="w-full bg-accent hover:bg-accent/90">
                  <Send className="w-4 h-4 mr-2" />
                  Enviar Campanha por Email
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}