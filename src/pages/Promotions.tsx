import { useState } from "react";
import { Plus, Megaphone, Mail, Calendar, TrendingUp, Eye, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { usePromotions } from "@/hooks/usePromotions";
import { RESTAURANT_ID } from "@/config/current-restaurant";
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

export default function Promotions() {
  const { promotions, loading, createPromotion } = usePromotions();
  const [selectedPromotion, setSelectedPromotion] = useState<typeof promotions[0] | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [audienceFilter, setAudienceFilter] = useState("all");

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const formatDateTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getPromotionStatus = (promotion: typeof promotions[0]) => {
    const now = new Date();
    const starts = new Date(promotion.starts_at);
    const ends = new Date(promotion.ends_at);
    
    if (now < starts) return "scheduled";
    if (now > ends) return "completed";
    if (promotion.status === 'active') return "active";
    return promotion.status;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-success/10 text-success">Ativa</Badge>;
      case "scheduled":
        return <Badge className="bg-warning/10 text-warning">Agendada</Badge>;
      case "completed":
        return <Badge className="bg-muted">Finalizada</Badge>;
      case "draft":
        return <Badge variant="secondary">Rascunho</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const handleCreatePromotion = async () => {
    if (!title || !startsAt || !endsAt) {
      return;
    }

    setIsCreating(true);
    try {
      await createPromotion({
        restaurant_id: RESTAURANT_ID,
        title,
        description: description || undefined,
        starts_at: startsAt,
        ends_at: endsAt,
        audience_filter: audienceFilter,
        status: 'draft',
      });

      // Reset form
      setTitle("");
      setDescription("");
      setStartsAt("");
      setEndsAt("");
      setAudienceFilter("all");
    } finally {
      setIsCreating(false);
    }
  };

  const totalPromotions = promotions.length;
  const activePromotions = promotions.filter(p => getPromotionStatus(p) === "active").length;

  if (loading) {
    return (
      <div className="p-6">
        <p>Carregando promoções...</p>
      </div>
    );
  }

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
              <Input 
                placeholder="Título da promoção" 
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
              <Textarea 
                placeholder="Descrição detalhada da oferta"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Data de início</label>
                  <Input 
                    type="datetime-local" 
                    value={startsAt}
                    onChange={(e) => setStartsAt(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Data de fim</label>
                  <Input 
                    type="datetime-local" 
                    value={endsAt}
                    onChange={(e) => setEndsAt(e.target.value)}
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Público-alvo</label>
                <select 
                  className="w-full mt-1 p-2 border rounded-md"
                  value={audienceFilter}
                  onChange={(e) => setAudienceFilter(e.target.value)}
                >
                  <option value="all">Todos os clientes</option>
                  <option value="vip">Clientes VIP (10+ visitas)</option>
                  <option value="new">Novos clientes</option>
                  <option value="inactive">Clientes inativos</option>
                </select>
              </div>
              <Button 
                className="w-full" 
                onClick={handleCreatePromotion}
                disabled={isCreating || !title || !startsAt || !endsAt}
              >
                {isCreating ? "Criando..." : "Criar Promoção"}
              </Button>
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
                <p className="text-2xl font-bold">-</p>
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
                <p className="text-2xl font-bold">-</p>
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
              {promotions.length === 0 ? (
                <div className="text-center py-12">
                  <Megaphone className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="font-semibold mb-2">Nenhuma promoção criada</h3>
                  <p className="text-muted-foreground mb-4">
                    Comece criando sua primeira campanha de marketing.
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Promoção</TableHead>
                      <TableHead>Período</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Público</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {promotions.map((promotion) => (
                      <TableRow key={promotion.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{promotion.title}</div>
                            {promotion.description && (
                              <div className="text-sm text-muted-foreground">
                                {promotion.description}
                              </div>
                            )}
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
                          <Badge variant="outline">{promotion.audience_filter}</Badge>
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
              )}
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
              <div className="text-center py-12">
                <Mail className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="font-semibold mb-2">Nenhum email enviado</h3>
                <p className="text-muted-foreground">
                  Os logs de envio aparecerão aqui quando você enviar campanhas.
                </p>
              </div>
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
                {selectedPromotion.description && (
                  <p className="text-muted-foreground">{selectedPromotion.description}</p>
                )}
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
                <h4 className="font-semibold mb-2">Público-alvo</h4>
                <Badge variant="outline">{selectedPromotion.audience_filter}</Badge>
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
