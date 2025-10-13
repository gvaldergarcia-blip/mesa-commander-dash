import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/lib/supabase/client";
import { RESTAURANT_ID } from "@/config/current-restaurant";
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
import { Loader2, Save, Image as ImageIcon } from "lucide-react";

const cuisineTypes = [
  "Brasileira",
  "Japonesa",
  "Italiana",
  "Hamburgueria",
  "Saudável",
  "Árabe",
  "Doceria",
  "Mexicana",
  "Cervejaria",
  "Outros"
] as const;

const settingsSchema = z.object({
  name: z.string().min(3, "Nome deve ter no mínimo 3 caracteres").max(100),
  address: z.string().min(5, "Endereço deve ter no mínimo 5 caracteres").max(200),
  city: z.string().min(2, "Cidade deve ter no mínimo 2 caracteres").max(100),
  cuisine: z.enum(cuisineTypes),
  about: z.string().max(400, "Descrição deve ter no máximo 400 caracteres").optional(),
  image_url: z.string().url("URL inválida").or(z.literal("")).optional(),
  hero_image_url: z.string().url("URL inválida").or(z.literal("")).optional(),
  menu_url: z.string().url("URL inválida").or(z.literal("")).optional(),
});

type SettingsFormValues = z.infer<typeof settingsSchema>;

export default function Settings() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadingHero, setUploadingHero] = useState(false);

  const form = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      name: "",
      address: "",
      city: "",
      cuisine: "Outros",
      about: "",
      image_url: "",
      hero_image_url: "",
      menu_url: "",
    },
  });

  useEffect(() => {
    fetchRestaurantData();
    
    // Realtime subscription
    const channel = supabase
      .channel('restaurant-settings')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'mesaclik',
          table: 'restaurants',
          filter: `id=eq.${RESTAURANT_ID}`
        },
        (payload) => {
          console.log('[Realtime] Restaurant updated:', payload.new);
          if (payload.new) {
            form.reset(payload.new as SettingsFormValues);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchRestaurantData = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('restaurants')
        .select('name, address, city, cuisine, about, image_url, hero_image_url, menu_url')
        .eq('id', RESTAURANT_ID)
        .single();

      if (error) throw error;

      if (data) {
        form.reset({
          name: data.name || "",
          address: data.address || "",
          city: data.city || "",
          cuisine: (data.cuisine as any) || "Outros",
          about: data.about || "",
          image_url: data.image_url || "",
          hero_image_url: data.hero_image_url || "",
          menu_url: data.menu_url || "",
        });
      }
    } catch (error) {
      console.error('Error fetching restaurant:', error);
      toast({
        title: "Erro ao carregar dados",
        description: "Não foi possível carregar as informações do restaurante.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = async (file: File, field: 'image_url' | 'hero_image_url') => {
    try {
      const isHero = field === 'hero_image_url';
      isHero ? setUploadingHero(true) : setUploadingImage(true);

      const fileExt = file.name.split('.').pop();
      const fileName = `${RESTAURANT_ID}-${field}-${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('restaurants')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('restaurants')
        .getPublicUrl(filePath);

      form.setValue(field, publicUrl);

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
      const isHero = field === 'hero_image_url';
      isHero ? setUploadingHero(false) : setUploadingImage(false);
    }
  };

  const onSubmit = async (values: SettingsFormValues) => {
    try {
      setSaving(true);

      const { error } = await supabase
        .from('restaurants')
        .update({
          name: values.name,
          address: values.address,
          city: values.city,
          cuisine: values.cuisine,
          about: values.about || null,
          image_url: values.image_url || null,
          hero_image_url: values.hero_image_url || null,
          menu_url: values.menu_url || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', RESTAURANT_ID);

      if (error) throw error;

      toast({
        title: "Dados atualizados com sucesso",
        description: "As alterações já estão visíveis no app.",
      });
    } catch (error) {
      console.error('Error updating restaurant:', error);
      toast({
        title: "Erro ao salvar",
        description: "Não foi possível salvar as alterações. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">Configurações do Restaurante</h1>
        <p className="text-muted-foreground mt-2">
          Gerencie as informações que aparecem no app MesaClik. As alterações são aplicadas em tempo real.
        </p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          {/* Informações Básicas */}
          <Card>
            <CardHeader>
              <CardTitle>Informações Básicas</CardTitle>
              <CardDescription>
                Dados principais do seu restaurante
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome do Restaurante</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: Restaurante Sabor & Arte" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Endereço Completo</FormLabel>
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
                      <FormLabel>Cidade</FormLabel>
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
                      <FormLabel>Tipo de Culinária</FormLabel>
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
            </CardContent>
          </Card>

          {/* Sobre o Restaurante */}
          <Card>
            <CardHeader>
              <CardTitle>Sobre o Restaurante</CardTitle>
              <CardDescription>
                Descrição que aparecerá na tela de detalhes do app
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FormField
                control={form.control}
                name="about"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Descrição (até 400 caracteres)</FormLabel>
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
            </CardContent>
          </Card>

          {/* Imagens e Cardápio */}
          <Card>
            <CardHeader>
              <CardTitle>Imagens e Cardápio</CardTitle>
              <CardDescription>
                URLs das imagens que aparecem no app e link do cardápio
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <FormField
                control={form.control}
                name="image_url"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Imagem Principal</FormLabel>
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
                              if (file) handleImageUpload(file, 'image_url');
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

              <FormField
                control={form.control}
                name="hero_image_url"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Imagem de Fundo (Tela Final)</FormLabel>
                    <div className="space-y-4">
                      <FormControl>
                        <Input
                          placeholder="https://exemplo.com/imagem-fundo.jpg"
                          {...field}
                        />
                      </FormControl>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">ou</span>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={uploadingHero}
                          onClick={() => {
                            const input = document.createElement('input');
                            input.type = 'file';
                            input.accept = 'image/*';
                            input.onchange = (e) => {
                              const file = (e.target as HTMLInputElement).files?.[0];
                              if (file) handleImageUpload(file, 'hero_image_url');
                            };
                            input.click();
                          }}
                        >
                          {uploadingHero ? (
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
                      Imagem de fundo exibida na tela final quando o cliente entra na fila ou faz reserva
                    </FormDescription>
                    {field.value && (
                      <div className="mt-4 relative rounded-lg overflow-hidden border border-border">
                        <img
                          src={field.value}
                          alt="Preview Hero"
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

              <FormField
                control={form.control}
                name="menu_url"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Link do Cardápio</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="https://exemplo.com/cardapio.pdf"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Link para o cardápio completo (PDF, site, Google Drive, etc.)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Botão Salvar */}
          <div className="flex justify-end">
            <Button
              type="submit"
              size="lg"
              disabled={saving}
              className="min-w-[200px]"
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
    </div>
  );
}
