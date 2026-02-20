import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useRestaurant } from "@/contexts/RestaurantContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Save, Image as ImageIcon, Building2, Clock, Users, Calendar, CreditCard, Shield, Info, UsersRound } from "lucide-react";
import { CUISINE_TYPES } from "@/config/cuisines";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { ProtectedRoute } from "@/components/layout/ProtectedRoute";
import { useModules } from "@/contexts/ModulesContext";

import { HoursSettings } from "@/components/settings/HoursSettings";
import { QueueSettings } from "@/components/settings/QueueSettings";
import { ReservationSettings } from "@/components/settings/ReservationSettings";
import { RestaurantLogo } from "@/components/common/RestaurantLogo";
import { TeamSettings } from "@/components/settings/TeamSettings";

const cuisineTypes = [...CUISINE_TYPES];

const settingsSchema = z.object({
  name: z.string().min(3, "Nome deve ter no mínimo 3 caracteres").max(100),
  address_line: z.string().min(5, "Endereço deve ter no mínimo 5 caracteres").max(200),
  city: z.string().min(2, "Cidade deve ter no mínimo 2 caracteres").max(100),
  cuisine: z.string(),
  about: z.string().max(400, "Descrição deve ter no máximo 400 caracteres").optional(),
  image_url: z.string().url("URL inválida").or(z.literal("")).optional(),
  menu_url: z.string().url("URL inválida").or(z.literal("")).optional(),
  menu_image_url: z.string().url("URL inválida").or(z.literal("")).optional(),
  logo_url: z.string().url("URL inválida").or(z.literal("")).optional(),
});

type SettingsFormValues = z.infer<typeof settingsSchema>;

function SettingsContent() {
  // DEV: Auth desabilitado para desenvolvimento
  // const { loading: authLoading, isAuthenticated } = useRequireAuth({ requireAdmin: true });
  const authLoading = false;
  const isAuthenticated = true;
  const { restaurantId } = useRestaurant();
  const { toast } = useToast();
  const { hasModule } = useModules();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadingMenuImage, setUploadingMenuImage] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  const form = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      name: "",
      address_line: "",
      city: "",
      cuisine: "Outros",
      about: "",
      image_url: "",
      menu_url: "",
      menu_image_url: "",
      logo_url: "",
    },
  });

  useEffect(() => {
    if (restaurantId) {
      fetchRestaurantData();
    } else {
      setLoading(false);
    }
    
    // Realtime subscription
    const channel = supabase
      .channel('restaurant-settings')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'restaurants',
          filter: `id=eq.${restaurantId}`
        },
        (payload) => {
          console.log('[Realtime] Restaurant updated:', payload.new);
          if (payload.new) {
            const data = payload.new as any;
            form.reset({
              name: data.name || "",
              address_line: data.address_line || "",
              city: data.city || "",
              cuisine: data.cuisine || "Outros",
              about: data.about || "",
              image_url: data.image_url || "",
              menu_url: data.menu_url || "",
              menu_image_url: data.menu_image_url || "",
              logo_url: data.logo_url || "",
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [restaurantId]);

  const fetchRestaurantData = async () => {
    try {
      setLoading(true);
      console.log('[Settings] Fetching restaurant data for ID:', restaurantId);
      
      const { data, error } = await (supabase as any)
        .schema('mesaclik')
        .from('restaurants')
        .select('name, address_line, city, cuisine, about, image_url, menu_url, menu_image_url, logo_url')
        .eq('id', restaurantId)
        .maybeSingle();

      console.log('[Settings] Query result:', { data, error });

      if (error) throw error;

      if (data) {
        console.log('[Settings] Resetting form with data:', data);
        form.reset({
          name: data.name || "",
          address_line: data.address_line || "",
          city: data.city || "",
          cuisine: data.cuisine || "Outros",
          about: data.about || "",
          image_url: data.image_url || "",
          menu_url: data.menu_url || "",
          menu_image_url: data.menu_image_url || "",
          logo_url: data.logo_url || "",
        });
      } else {
        console.warn('[Settings] No data found for restaurant ID:', restaurantId);
      }
    } catch (error) {
      console.error('[Settings] Error fetching restaurant:', error);
      toast({
        title: "Erro ao carregar dados",
        description: "Não foi possível carregar as informações do restaurante.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = async (file: File) => {
    try {
      setUploadingImage(true);

      const fileExt = file.name.split('.').pop();
      const fileName = `${restaurantId}-image-${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('restaurants')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('restaurants')
        .getPublicUrl(filePath);

      form.setValue('image_url', publicUrl);

      toast({
        title: "Imagem enviada",
        description: "A imagem foi carregada com sucesso.",
      });
    } catch (error) {
      console.error('Error uploading image:', error);
      toast({
        title: "Erro ao enviar imagem",
        description: "Não foi possível fazer upload da imagem. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setUploadingImage(false);
    }
  };

  const handleMenuImageUpload = async (file: File) => {
    try {
      setUploadingMenuImage(true);

      const fileExt = file.name.split('.').pop();
      const fileName = `${restaurantId}-menu-${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('restaurants')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('restaurants')
        .getPublicUrl(filePath);

      form.setValue('menu_image_url', publicUrl);

      toast({
        title: "Imagem do cardápio enviada",
        description: "A imagem do cardápio foi carregada com sucesso.",
      });
    } catch (error) {
      console.error('Error uploading menu image:', error);
      toast({
        title: "Erro ao enviar imagem do cardápio",
        description: "Não foi possível fazer upload da imagem. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setUploadingMenuImage(false);
    }
  };

  const handleLogoUpload = async (file: File) => {
    try {
      setUploadingLogo(true);

      const fileExt = file.name.split('.').pop();
      const fileName = `${restaurantId}-logo-${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('restaurants')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('restaurants')
        .getPublicUrl(filePath);

      form.setValue('logo_url', publicUrl);

      toast({
        title: "Logo enviada",
        description: "A logo do restaurante foi carregada com sucesso.",
      });
    } catch (error) {
      console.error('Error uploading logo:', error);
      toast({
        title: "Erro ao enviar logo",
        description: "Não foi possível fazer upload da logo. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleRemoveLogo = () => {
    form.setValue('logo_url', '');
    toast({
      title: "Logo removida",
      description: "A logo será removida ao salvar.",
    });
  };

  const onSubmit = async (values: SettingsFormValues) => {
    try {
      setSaving(true);
      console.log('[Settings] Updating restaurant with values:', values);

      const { error } = await (supabase as any)
        .schema('mesaclik')
        .from('restaurants')
        .update({
          name: values.name,
          address_line: values.address_line,
          city: values.city,
          cuisine: values.cuisine as any,
          about: values.about || null,
          image_url: values.image_url || null,
          menu_url: values.menu_url || null,
          menu_image_url: values.menu_image_url || null,
          logo_url: values.logo_url || null,
        })
        .eq('id', restaurantId);

      console.log('[Settings] Update result:', { error });

      if (error) throw error;

      toast({
        title: "Dados atualizados com sucesso",
        description: "As alterações já estão visíveis no app.",
      });
    } catch (error) {
      console.error('[Settings] Error updating restaurant:', error);
      toast({
        title: "Erro ao salvar",
        description: "Não foi possível salvar as alterações. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">Configurações</h1>
        <p className="text-muted-foreground mt-2">
          Gerencie todas as configurações do seu restaurante no MesaClik
        </p>
      </div>

      <Tabs defaultValue="restaurant" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 lg:grid-cols-7 h-auto gap-2 bg-muted/50 p-2">
          <TabsTrigger value="restaurant" className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            <span className="hidden sm:inline">Restaurante</span>
          </TabsTrigger>
          <TabsTrigger value="hours" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            <span className="hidden sm:inline">Horários</span>
          </TabsTrigger>
          {hasModule('fila') && (
            <TabsTrigger value="queue" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Fila</span>
            </TabsTrigger>
          )}
          {hasModule('reserva') && (
            <TabsTrigger value="reservation" className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              <span className="hidden sm:inline">Reservas</span>
            </TabsTrigger>
          )}
          <TabsTrigger value="team" className="flex items-center gap-2">
            <UsersRound className="h-4 w-4" />
            <span className="hidden sm:inline">Equipe</span>
          </TabsTrigger>
          <TabsTrigger value="billing" className="flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            <span className="hidden sm:inline">Plano</span>
          </TabsTrigger>
          <TabsTrigger value="privacy" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            <span className="hidden sm:inline">Privacidade</span>
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Informações do Restaurante */}
        <TabsContent value="restaurant">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Building2 className="h-5 w-5 text-primary" />
                    Informações do Restaurante
                  </CardTitle>
                  <CardDescription>
                    Dados principais que aparecem no app MesaClik. As alterações são aplicadas em tempo real.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nome do Restaurante *</FormLabel>
                        <FormControl>
                          <Input placeholder="Ex: Restaurante Sabor & Arte" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="address_line"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Endereço Completo *</FormLabel>
                        <FormControl>
                          <Input placeholder="Ex: Rua das Flores, 123 - Centro" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
                      name="city"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Cidade *</FormLabel>
                          <FormControl>
                            <Input placeholder="Ex: São Paulo" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="cuisine"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Tipo de Culinária *</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione o tipo" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent className="bg-popover z-50">
                              {cuisineTypes.map((type) => (
                                <SelectItem key={type} value={type}>
                                  {type}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <Separator />

                  <FormField
                    control={form.control}
                    name="about"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Descrição do Restaurante</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Conte um pouco sobre a história, especialidades e diferenciais do seu restaurante..."
                            className="min-h-[120px]"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          {field.value?.length || 0} / 400 caracteres
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Separator />

                  {/* Seção de Logo do Restaurante */}
                  <FormField
                    control={form.control}
                    name="logo_url"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          <ImageIcon className="h-4 w-4" />
                          Logo do Restaurante
                        </FormLabel>
                        <FormDescription className="mb-4">
                          A logo aparece à esquerda do nome em listagens e detalhes. Recomendamos imagem quadrada (ex: 512x512).
                        </FormDescription>
                        <div className="flex items-center gap-6">
                          {/* Preview da Logo */}
                          <div className="flex-shrink-0">
                            <RestaurantLogo
                              logoUrl={field.value || null}
                              name={form.watch('name') || 'R'}
                              size="xl"
                            />
                          </div>
                          
                          {/* Ações */}
                          <div className="flex flex-col gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={uploadingLogo}
                              onClick={() => {
                                const input = document.createElement('input');
                                input.type = 'file';
                                input.accept = 'image/png,image/jpeg,image/jpg';
                                input.onchange = (e) => {
                                  const file = (e.target as HTMLInputElement).files?.[0];
                                  if (file) handleLogoUpload(file);
                                };
                                input.click();
                              }}
                            >
                              {uploadingLogo ? (
                                <>
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  Enviando...
                                </>
                              ) : (
                                <>
                                  <ImageIcon className="mr-2 h-4 w-4" />
                                  {field.value ? 'Substituir Logo' : 'Enviar Logo'}
                                </>
                              )}
                            </Button>
                            
                            {field.value && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="text-destructive hover:text-destructive"
                                onClick={handleRemoveLogo}
                              >
                                Remover Logo
                              </Button>
                            )}
                          </div>
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Separator />

                  <FormField
                    control={form.control}
                    name="image_url"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Imagem Principal do Restaurante</FormLabel>
                        <div className="space-y-4">
                          <FormControl>
                            <Input
                              placeholder="https://exemplo.com/imagem-restaurante.jpg"
                              {...field}
                            />
                          </FormControl>
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground">ou</span>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={uploadingImage}
                              onClick={() => {
                                const input = document.createElement('input');
                                input.type = 'file';
                                input.accept = 'image/*';
                                input.onchange = (e) => {
                                  const file = (e.target as HTMLInputElement).files?.[0];
                                  if (file) handleImageUpload(file);
                                };
                                input.click();
                              }}
                            >
                              {uploadingImage ? (
                                <>
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  Enviando...
                                </>
                              ) : (
                                <>
                                  <ImageIcon className="mr-2 h-4 w-4" />
                                  Anexar Imagem
                                </>
                              )}
                            </Button>
                          </div>
                        </div>
                        <FormDescription>
                          Esta imagem aparece no bloco do restaurante na Home Page e nas listagens
                        </FormDescription>
                        {field.value && (
                          <div className="mt-4 relative rounded-lg overflow-hidden border border-border">
                            <img
                              src={field.value}
                              alt="Preview"
                              className="w-full h-48 object-cover"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                              }}
                            />
                          </div>
                        )}
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Separator />

                  <div className="space-y-6">
                    <FormField
                      control={form.control}
                      name="menu_url"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Link do Cardápio</FormLabel>
                          <div className="flex gap-2">
                            <FormControl>
                              <Input
                                placeholder="https://exemplo.com/cardapio.pdf"
                                {...field}
                              />
                            </FormControl>
                            <Button
                              type="button"
                              variant="outline"
                              disabled={uploadingMenuImage}
                              onClick={() => {
                                const input = document.createElement('input');
                                input.type = 'file';
                                input.accept = 'image/*';
                                input.onchange = (e) => {
                                  const file = (e.target as HTMLInputElement).files?.[0];
                                  if (file) handleMenuImageUpload(file);
                                };
                                input.click();
                              }}
                            >
                              {uploadingMenuImage ? (
                                <>
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  Enviando...
                                </>
                              ) : (
                                <>
                                  <ImageIcon className="mr-2 h-4 w-4" />
                                  Anexar Imagem
                                </>
                              )}
                            </Button>
                          </div>
                          <FormDescription>
                            Cole o link do cardápio ou anexe uma imagem
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="menu_image_url"
                      render={({ field }) => (
                        <FormItem>
                          {field.value && (
                            <div className="relative rounded-lg overflow-hidden border border-border">
                              <img
                                src={field.value}
                                alt="Preview do Cardápio"
                                className="w-full h-48 object-cover"
                                onError={(e) => {
                                  e.currentTarget.style.display = 'none';
                                }}
                              />
                            </div>
                          )}
                        </FormItem>
                      )}
                    />
                  </div>
                </CardContent>
              </Card>

              <div className="flex justify-end sticky bottom-4 z-10">
                <Button
                  type="submit"
                  size="lg"
                  disabled={saving}
                  className="min-w-[200px] shadow-lg"
                >
                  {saving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Salvar Alterações
                    </>
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </TabsContent>

        {/* Tab 2: Horários & Funcionamento */}
        <TabsContent value="hours">
          <HoursSettings restaurantId={restaurantId || ''} />
        </TabsContent>

        {/* Tab 3: Fila de Espera */}
        <TabsContent value="queue">
          <QueueSettings restaurantId={restaurantId || ''} />
        </TabsContent>

        {/* Tab 4: Reservas */}
        <TabsContent value="reservation">
          <ReservationSettings restaurantId={restaurantId || ''} />
        </TabsContent>

        {/* Tab 5: Equipe */}
        <TabsContent value="team">
          <TeamSettings />
        </TabsContent>

        {/* Tab 6: Plano & Pagamento */}
        <TabsContent value="billing">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-primary" />
                Plano & Pagamento
              </CardTitle>
              <CardDescription>
                Gerencie sua assinatura e método de pagamento
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between p-4 border border-border rounded-lg bg-muted/30">
                <div className="flex items-center gap-3">
                  <Info className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">Em desenvolvimento</p>
                    <p className="text-sm text-muted-foreground">
                      Esta funcionalidade estará disponível em breve
                    </p>
                  </div>
                </div>
                <Badge variant="secondary">Em breve</Badge>
              </div>

              <div className="p-6 border rounded-lg bg-gradient-to-br from-primary/5 to-primary/10 opacity-50">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-semibold text-lg">Plano Profissional</h3>
                    <p className="text-sm text-muted-foreground">Ativo desde 01/01/2025</p>
                  </div>
                  <Badge className="bg-primary">Ativo</Badge>
                </div>
                <Separator className="my-4" />
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Valor mensal</span>
                    <span className="font-medium">R$ 99,90</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Próxima renovação</span>
                    <span className="font-medium">01/02/2025</span>
                  </div>
                </div>
                <Button variant="outline" className="w-full mt-4" disabled>
                  Alterar Plano
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 9: Privacidade & Segurança */}
        <TabsContent value="privacy">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                Privacidade, LGPD e Segurança
              </CardTitle>
              <CardDescription>
                Configurações de privacidade e proteção de dados
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between p-4 border border-border rounded-lg bg-muted/30">
                <div className="flex items-center gap-3">
                  <Info className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">Em desenvolvimento</p>
                    <p className="text-sm text-muted-foreground">
                      Esta funcionalidade estará disponível em breve
                    </p>
                  </div>
                </div>
                <Badge variant="secondary">Em breve</Badge>
              </div>

              <div className="space-y-4 opacity-50">
                <div className="p-4 border rounded-lg bg-background">
                  <h4 className="font-medium mb-2">Proteção de Dados (LGPD)</h4>
                  <p className="text-sm text-muted-foreground mb-3">
                    Todos os dados dos seus clientes são protegidos conforme a Lei Geral de Proteção de Dados.
                  </p>
                  <Button variant="link" className="p-0 h-auto" disabled>
                    Ver política de privacidade →
                  </Button>
                </div>

                <div className="p-4 border rounded-lg bg-background">
                  <h4 className="font-medium mb-2">Segurança</h4>
                  <p className="text-sm text-muted-foreground mb-3">
                    Suas informações são criptografadas e armazenadas com segurança.
                  </p>
                  <Button variant="link" className="p-0 h-auto" disabled>
                    Ver documentação de segurança →
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function Settings() {
  return (
    <ProtectedRoute requireAdmin>
      <SettingsContent />
    </ProtectedRoute>
  );
}
