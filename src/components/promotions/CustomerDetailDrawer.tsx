import { Mail, Send, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface CustomerDetailDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customer: any;
  onToggleOptIn: (customerId: string, optIn: boolean) => Promise<void>;
  onComposeEmail: () => void;
}

export function CustomerDetailDrawer({
  open,
  onOpenChange,
  customer,
  onToggleOptIn,
  onComposeEmail,
}: CustomerDetailDrawerProps) {
  if (!customer) return null;

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <User className="w-5 h-5" />
            Ficha do Cliente
          </SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Dados básicos */}
          <Card>
            <CardHeader>
              <CardTitle>Dados Básicos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label className="text-muted-foreground">Nome</Label>
                <p className="font-medium">{customer.name}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">E-mail</Label>
                <p className="font-medium">{customer.email || '-'}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Telefone</Label>
                <p className="font-medium">{customer.phone || '-'}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Última visita</Label>
                <p className="font-medium">{formatDate(customer.last_visit_date)}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Total de visitas</Label>
                <p className="font-medium">{customer.total_visits}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Status</Label>
                <div className="mt-1">
                  {customer.vip_status && (
                    <Badge className="bg-accent">VIP</Badge>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Opt-in ofertas */}
          <Card>
            <CardHeader>
              <CardTitle>Preferências de Marketing</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label htmlFor="opt-in-toggle">Opt-in ofertas</Label>
                  <p className="text-sm text-muted-foreground">
                    {customer.marketing_opt_in ? 'Ativo' : 'Inativo'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {customer.marketing_opt_in ? (
                    <Badge className="bg-success/10 text-success">Ativo</Badge>
                  ) : (
                    <Badge variant="secondary">Inativo</Badge>
                  )}
                  <Switch
                    id="opt-in-toggle"
                    checked={customer.marketing_opt_in}
                    onCheckedChange={(checked) => onToggleOptIn(customer.id, checked)}
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                ⚠️ Ambiente de teste: este toggle permite simular opt-in/opt-out para testes.
                Todas as alterações são registradas na auditoria.
              </p>
            </CardContent>
          </Card>

          {/* Histórico de envios */}
          <Card>
            <CardHeader>
              <CardTitle>Histórico de Envios</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-6">
                <Mail className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">
                  Nenhum email enviado ainda
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Ações */}
          <Button
            className="w-full"
            onClick={onComposeEmail}
            disabled={!customer.marketing_opt_in || !customer.email}
          >
            <Send className="w-4 h-4 mr-2" />
            Lançar promoção
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
