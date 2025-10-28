import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { use10Cliks } from '@/hooks/use10Cliks';
import { Badge } from '@/components/ui/badge';
import { Award, Trophy, Target } from 'lucide-react';

export function TenCliksTab() {
  const { program, users, loading, saveProgram, resetUserReward } = use10Cliks();
  
  const [formData, setFormData] = useState({
    is_active: program?.is_active ?? false,
    reward_description: program?.reward_description ?? '',
    validity: program?.validity ?? '',
    rules: program?.rules ?? '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await saveProgram({
      ...formData,
      validity: formData.validity || null,
      rules: formData.rules || null,
    });
  };

  const getStatusBadge = (cliks: number, hasReward: boolean) => {
    if (hasReward) {
      return <Badge className="bg-green-500"><Award className="w-3 h-3 mr-1" />Recompensa disponível</Badge>;
    }
    if (cliks >= 8) {
      return <Badge className="bg-orange-500"><Trophy className="w-3 h-3 mr-1" />Próximo da meta</Badge>;
    }
    return <Badge variant="outline"><Target className="w-3 h-3 mr-1" />Em progresso</Badge>;
  };

  const formatDate = (date: string) => {
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
              <Label htmlFor="is_active">Ativar Programa 10 Cliks</Label>
              <p className="text-sm text-muted-foreground">
                Quando ativo, clientes acumulam pontos automaticamente
              </p>
            </div>
            <Switch
              id="is_active"
              checked={formData.is_active}
              onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
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
            <Label htmlFor="validity">Validade (opcional)</Label>
            <Input
              id="validity"
              type="date"
              value={formData.validity}
              onChange={(e) => setFormData({ ...formData, validity: e.target.value })}
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
        {users.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            Nenhum cliente com pontos ainda
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID Cliente</TableHead>
                  <TableHead>Cliks Atuais</TableHead>
                  <TableHead>Última Atualização</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-mono text-sm">
                      {user.user_id.slice(0, 8)}...
                    </TableCell>
                    <TableCell>
                      <span className="font-semibold text-lg">{user.total_cliks}</span> / 10
                    </TableCell>
                    <TableCell>{formatDate(user.last_updated)}</TableCell>
                    <TableCell>
                      {getStatusBadge(user.total_cliks, user.has_reward)}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => resetUserReward(user.user_id)}
                        disabled={user.total_cliks === 0}
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
