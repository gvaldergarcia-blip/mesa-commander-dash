import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useRestaurant } from '@/contexts/RestaurantContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Label } from '@/components/ui/label';
import { Loader2, UserPlus, Users, KeyRound, Power, Copy, Check } from 'lucide-react';

interface TeamMember {
  user_id: string;
  email: string;
  name: string;
  role: string;
  is_active: boolean;
  created_at: string;
}

export function TeamSettings() {
  const { restaurantId } = useRestaurant();
  const { toast } = useToast();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const invokeTeamFunction = useCallback(async (body: any) => {
    const { data, error } = await supabase.functions.invoke('manage-team', {
      body,
    });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return data;
  }, []);

  const fetchMembers = useCallback(async () => {
    try {
      setLoading(true);
      const data = await invokeTeamFunction({ action: 'list' });
      setMembers(data.members || []);
    } catch (err: any) {
      console.error('[TeamSettings] Error loading team:', err);
      toast({
        title: 'Erro ao carregar equipe',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [invokeTeamFunction, toast]);

  useEffect(() => {
    if (restaurantId) fetchMembers();
  }, [restaurantId, fetchMembers]);

  const handleCreate = async () => {
    if (!newName.trim() || !newEmail.trim()) return;
    try {
      setCreating(true);
      const data = await invokeTeamFunction({
        action: 'create',
        name: newName.trim(),
        email: newEmail.trim().toLowerCase(),
      });
      setTempPassword(data.temp_password);
      toast({
        title: 'Operador criado com sucesso',
        description: `${newName} foi adicionado à equipe.`,
      });
      fetchMembers();
    } catch (err: any) {
      toast({
        title: 'Erro ao criar operador',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setCreating(false);
    }
  };

  const handleToggleActive = async (userId: string, currentActive: boolean) => {
    try {
      setActionLoading(userId);
      await invokeTeamFunction({
        action: 'toggle_active',
        target_user_id: userId,
        is_active: !currentActive,
      });
      toast({
        title: currentActive ? 'Usuário desativado' : 'Usuário reativado',
      });
      fetchMembers();
    } catch (err: any) {
      toast({
        title: 'Erro',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleResetPassword = async (userId: string) => {
    try {
      setActionLoading(userId);
      const data = await invokeTeamFunction({
        action: 'reset_password',
        target_user_id: userId,
      });
      setTempPassword(data.temp_password);
      toast({ title: 'Senha resetada com sucesso' });
    } catch (err: any) {
      toast({
        title: 'Erro ao resetar senha',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setActionLoading(null);
    }
  };

  const copyPassword = () => {
    if (tempPassword) {
      navigator.clipboard.writeText(tempPassword);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setNewName('');
    setNewEmail('');
    setTempPassword(null);
    setCopied(false);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Equipe
            </CardTitle>
            <CardDescription>
              Gerencie os usuários do painel do seu restaurante
            </CardDescription>
          </div>

          <Dialog open={dialogOpen} onOpenChange={(open) => {
            if (!open) closeDialog();
            else setDialogOpen(true);
          }}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2">
                <UserPlus className="h-4 w-4" />
                Adicionar Operador
              </Button>
            </DialogTrigger>
            <DialogContent>
              {tempPassword ? (
                <>
                  <DialogHeader>
                    <DialogTitle>Senha Temporária</DialogTitle>
                    <DialogDescription>
                      Compartilhe esta senha com o operador. Ela será exibida apenas uma vez.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="flex items-center gap-2 p-4 bg-muted rounded-lg border border-border">
                    <code className="text-lg font-mono flex-1 text-center">
                      {tempPassword}
                    </code>
                    <Button variant="ghost" size="icon" onClick={copyPassword}>
                      {copied ? (
                        <Check className="h-4 w-4 text-primary" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  <DialogFooter>
                    <Button onClick={closeDialog}>Fechar</Button>
                  </DialogFooter>
                </>
              ) : (
                <>
                  <DialogHeader>
                    <DialogTitle>Adicionar Operador</DialogTitle>
                    <DialogDescription>
                      O operador poderá gerenciar Fila e Reservas, mas não terá acesso a Clientes, Relatórios ou Configurações.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Nome</Label>
                      <Input
                        id="name"
                        placeholder="Ex: Maria Silva"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="operador@email.com"
                        value={newEmail}
                        onChange={(e) => setNewEmail(e.target.value)}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={closeDialog}>
                      Cancelar
                    </Button>
                    <Button
                      onClick={handleCreate}
                      disabled={creating || !newName.trim() || !newEmail.trim()}
                    >
                      {creating ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : null}
                      Criar Operador
                    </Button>
                  </DialogFooter>
                </>
              )}
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Perfil</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map((member) => {
              const isAdmin = member.role === 'admin' || member.role === 'owner';
              return (
                <TableRow key={member.user_id}>
                  <TableCell className="font-medium">{member.name}</TableCell>
                  <TableCell className="text-muted-foreground">{member.email}</TableCell>
                  <TableCell>
                    <Badge variant={isAdmin ? 'default' : 'secondary'}>
                      {isAdmin ? 'Admin' : 'Operador'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={member.is_active ? 'outline' : 'destructive'}>
                      {member.is_active ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {!isAdmin && (
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Resetar senha"
                          disabled={actionLoading === member.user_id}
                          onClick={() => handleResetPassword(member.user_id)}
                        >
                          {actionLoading === member.user_id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <KeyRound className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          title={member.is_active ? 'Desativar' : 'Reativar'}
                          disabled={actionLoading === member.user_id}
                          onClick={() =>
                            handleToggleActive(member.user_id, member.is_active)
                          }
                        >
                          <Power
                            className={`h-4 w-4 ${
                              member.is_active
                                ? 'text-destructive'
                                : 'text-primary'
                            }`}
                          />
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
            {members.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  Nenhum membro na equipe ainda.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        {/* Temp password dialog for reset */}
        {tempPassword && !dialogOpen && (
          <Dialog open onOpenChange={() => setTempPassword(null)}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nova Senha Temporária</DialogTitle>
                <DialogDescription>
                  Compartilhe esta senha com o operador. Ela será exibida apenas uma vez.
                </DialogDescription>
              </DialogHeader>
              <div className="flex items-center gap-2 p-4 bg-muted rounded-lg border border-border">
                    <code className="text-lg font-mono flex-1 text-center">
                      {tempPassword}
                    </code>
                    <Button variant="ghost" size="icon" onClick={copyPassword}>
                      {copied ? (
                        <Check className="h-4 w-4 text-primary" />
                      ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <DialogFooter>
                <Button onClick={() => setTempPassword(null)}>Fechar</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </CardContent>
    </Card>
  );
}
