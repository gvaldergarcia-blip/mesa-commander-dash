import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useLoyaltyProgram } from '@/hooks/useLoyaltyProgram';
import { Badge } from '@/components/ui/badge';
import { Award, Trophy, Target } from 'lucide-react';
import { useRestaurant } from '@/contexts/RestaurantContext';

export function TenCliksTab() {
  const { restaurantId } = useRestaurant();
  const { program, points, loading, saveProgram, resetPoints } = useLoyaltyProgram(restaurantId || '');
  
  const [formData, setFormData] = useState({
    enabled: false,
    reward_description: '',
    expires_at: '',
    rules: '',
  });

  useEffect(() => {
    if (program) {
      setFormData({
        enabled: program.enabled,
        reward_description: program.reward_description || '',
        expires_at: program.expires_at || '',
        rules: program.rules || '',
      });
    }
  }, [program]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await saveProgram(formData);
  };

  const getStatusBadge = (pts: number) => {
    if (pts >= 10) {
      return <Badge className="bg-green-500"><Award className="w-3 h-3 mr-1" />Recompensa disponível</Badge>;
    }
    if (pts >= 8) {
      return <Badge className="bg-orange-500"><Trophy className="w-3 h-3 mr-1" />Próximo da meta</Badge>;
    }
    return <Badge variant="outline"><Target className="w-3 h-3 mr-1" />Em progresso</Badge>;
  };

  const formatDate = (date: string | null) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  if (loading) {
    return <div className="text-center py-8">Carregando...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-3 bg-primary/10 rounded-lg">
            <Trophy className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">Programa 10 Cliks</h2>
            <p className="text-muted-foreground">Recompense clientes fiéis automaticamente</p>
          </div>
        </div>
      </Card>

      {/* Configuração */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Configurações do Programa</h3>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="enabled">Ativar Programa 10 Cliks</Label>
              <p className="text-sm text-muted-foreground">
                Quando ativo, clientes acumulam pontos automaticamente
              </p>
            </div>
            <Switch
              id="enabled"
              checked={formData.enabled}
              onCheckedChange={(checked) => setFormData({ ...formData, enabled: checked })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="reward_description">Descrição da Recompensa *</Label>
            <Input
              id="reward_description"
              placeholder="Ex: Sobremesa grátis, 10% de desconto"
              value={formData.reward_description}
              onChange={(e) => setFormData({ ...formData, reward_description: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="expires_at">Data de Expiração (opcional)</Label>
            <Input
              id="expires_at"
              type="date"
              value={formData.expires_at}
              onChange={(e) => setFormData({ ...formData, expires_at: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="rules">Regras Adicionais (opcional)</Label>
            <Textarea
              id="rules"
              placeholder="Ex: Válido apenas no jantar, não acumulável com outras promoções"
              value={formData.rules}
              onChange={(e) => setFormData({ ...formData, rules: e.target.value })}
              rows={3}
            />
          </div>

          <Button type="submit" className="w-full">
            Salvar Configurações
          </Button>
        </form>
      </Card>

      {/* Tabela de Clientes */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Clientes e Pontos</h3>
        {points.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            Nenhum cliente com pontos ainda
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Cliks Atuais</TableHead>
                  <TableHead>Última Atualização</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {points.map((point) => (
                  <TableRow key={point.customer_id}>
                    <TableCell className="font-medium">
                      {point.customer_name}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {point.customer_email}
                    </TableCell>
                    <TableCell>
                      <span className="font-semibold text-lg">{point.points}</span> / 10
                    </TableCell>
                    <TableCell>{formatDate(point.last_earned_at)}</TableCell>
                    <TableCell>
                      {getStatusBadge(point.points)}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => resetPoints(point.customer_id)}
                        disabled={point.points === 0}
                      >
                        Resetar Pontos
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>
    </div>
  );
}
