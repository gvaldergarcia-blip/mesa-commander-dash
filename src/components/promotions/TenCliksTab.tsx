import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useLoyaltyProgram } from '@/hooks/useLoyaltyProgram';
import { Award, Trophy, Target, Loader2, Gift, Users, RotateCcw } from 'lucide-react';
import { useRestaurant } from '@/contexts/RestaurantContext';

export function TenCliksTab() {
  const { restaurantId } = useRestaurant();
  const { program, statuses, loading, saving, saveProgram, resetCustomer } = useLoyaltyProgram(restaurantId || '');

  const [formData, setFormData] = useState({
    is_active: false,
    program_name: 'Programa Clique',
    required_visits: 10,
    count_queue: true,
    count_reservations: true,
    reward_description: '',
    reward_validity_days: 30,
  });

  useEffect(() => {
    if (program) {
      setFormData({
        is_active: program.is_active,
        program_name: program.program_name,
        required_visits: program.required_visits,
        count_queue: program.count_queue,
        count_reservations: program.count_reservations,
        reward_description: program.reward_description,
        reward_validity_days: program.reward_validity_days,
      });
    }
  }, [program]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.reward_description.trim()) return;
    await saveProgram(formData);
  };

  const getStatusBadge = (status: any) => {
    if (status.reward_unlocked) {
      const expired = status.reward_expires_at && new Date(status.reward_expires_at) < new Date();
      if (expired) return <Badge variant="secondary">Expirado</Badge>;
      return <Badge className="bg-success/15 text-success border-success/30"><Award className="w-3 h-3 mr-1" />Recompensa disponível</Badge>;
    }
    const pct = formData.required_visits > 0 ? (status.current_visits / formData.required_visits) * 100 : 0;
    if (pct >= 80) return <Badge className="bg-warning/15 text-warning border-warning/30"><Trophy className="w-3 h-3 mr-1" />Quase lá</Badge>;
    return <Badge variant="outline"><Target className="w-3 h-3 mr-1" />Em progresso</Badge>;
  };

  const formatDate = (d: string | null) => {
    if (!d) return 'N/A';
    return new Date(d).toLocaleDateString('pt-BR');
  };

  // Stats
  const totalEnrolled = statuses.length;
  const rewardUnlocked = statuses.filter(s => s.reward_unlocked).length;
  const avgProgress = totalEnrolled > 0
    ? Math.round(statuses.reduce((sum, s) => sum + Math.min(s.current_visits, formData.required_visits), 0) / totalEnrolled)
    : 0;

  if (loading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-primary/10 rounded-lg">
              <Trophy className="w-6 h-6 text-primary" />
            </div>
            <div>
              <CardTitle className="text-2xl">Programa de Fidelidade</CardTitle>
              <CardDescription>Recompense clientes fiéis automaticamente com visitas concluídas</CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Stats */}
      {program?.is_active && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-5 flex items-center gap-3">
              <div className="p-2.5 bg-primary/10 rounded-lg"><Users className="w-5 h-5 text-primary" /></div>
              <div>
                <p className="text-2xl font-bold">{totalEnrolled}</p>
                <p className="text-sm text-muted-foreground">Clientes inscritos</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5 flex items-center gap-3">
              <div className="p-2.5 bg-success/10 rounded-lg"><Gift className="w-5 h-5 text-success" /></div>
              <div>
                <p className="text-2xl font-bold">{rewardUnlocked}</p>
                <p className="text-sm text-muted-foreground">Recompensas desbloqueadas</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5 flex items-center gap-3">
              <div className="p-2.5 bg-warning/10 rounded-lg"><Target className="w-5 h-5 text-warning" /></div>
              <div>
                <p className="text-2xl font-bold">{avgProgress}/{formData.required_visits}</p>
                <p className="text-sm text-muted-foreground">Progresso médio</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Config */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Configurações do Programa</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="is_active">Ativar Programa Clique</Label>
                <p className="text-sm text-muted-foreground">Quando ativo, todos os clientes entram automaticamente</p>
              </div>
              <Switch
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="program_name">Nome do programa</Label>
              <Input
                id="program_name"
                placeholder="Ex: Clube MesaClik"
                value={formData.program_name}
                onChange={(e) => setFormData({ ...formData, program_name: e.target.value })}
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="required_visits">Visitas necessárias</Label>
                <Input
                  id="required_visits"
                  type="number"
                  min={2}
                  max={50}
                  value={formData.required_visits}
                  onChange={(e) => setFormData({ ...formData, required_visits: parseInt(e.target.value) || 10 })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reward_validity_days">Validade da recompensa (dias)</Label>
                <Input
                  id="reward_validity_days"
                  type="number"
                  min={1}
                  max={365}
                  value={formData.reward_validity_days}
                  onChange={(e) => setFormData({ ...formData, reward_validity_days: parseInt(e.target.value) || 30 })}
                />
              </div>
            </div>

            <div className="space-y-3">
              <Label>Qual ação conta como clique?</Label>
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="count_queue"
                    checked={formData.count_queue}
                    onCheckedChange={(checked) => setFormData({ ...formData, count_queue: !!checked })}
                  />
                  <Label htmlFor="count_queue" className="font-normal cursor-pointer">Fila concluída</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="count_reservations"
                    checked={formData.count_reservations}
                    onCheckedChange={(checked) => setFormData({ ...formData, count_reservations: !!checked })}
                  />
                  <Label htmlFor="count_reservations" className="font-normal cursor-pointer">Reserva concluída</Label>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="reward_description">Descrição da recompensa *</Label>
              <Textarea
                id="reward_description"
                placeholder="Ex: Sobremesa grátis, 10% de desconto na próxima visita..."
                value={formData.reward_description}
                onChange={(e) => setFormData({ ...formData, reward_description: e.target.value })}
                required
                rows={2}
              />
            </div>

            <Button type="submit" className="w-full" disabled={saving || !formData.reward_description.trim()}>
              {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Salvar e {program ? 'Atualizar' : 'Ativar'} Programa
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Customer Table */}
      {statuses.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Clientes Inscritos</CardTitle>
            <CardDescription>{totalEnrolled} clientes no programa</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Progresso</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Validade</TableHead>
                    <TableHead>Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {statuses.map((s) => {
                    const pct = formData.required_visits > 0 ? Math.min(100, (s.current_visits / formData.required_visits) * 100) : 0;
                    return (
                      <TableRow key={s.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{s.customer_name}</p>
                            <p className="text-xs text-muted-foreground">{s.customer_email}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="w-32 space-y-1">
                            <Progress value={pct} className="h-2" />
                            <p className="text-xs text-muted-foreground">{s.current_visits}/{formData.required_visits} visitas</p>
                          </div>
                        </TableCell>
                        <TableCell>{getStatusBadge(s)}</TableCell>
                        <TableCell className="text-sm">{s.reward_expires_at ? formatDate(s.reward_expires_at) : '—'}</TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => resetCustomer(s.customer_id)}
                            disabled={s.current_visits === 0}
                            className="gap-1"
                          >
                            <RotateCcw className="w-3.5 h-3.5" /> Resetar
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
