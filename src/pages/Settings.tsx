import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/integrations/supabase/client";
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
  address_line: z.string().min(5, "Endereço deve ter no mínimo 5 caracteres").max(200),
  city: z.string().min(2, "Cidade deve ter no mínimo 2 caracteres").max(100),
  cuisine: z.string(),
  about: z.string().max(400, "Descrição deve ter no máximo 400 caracteres").optional(),
  image_url: z.string().url("URL inválida").or(z.literal("")).optional(),
  menu_url: z.string().url("URL inválida").or(z.literal("")).optional(),
  menu_image_url: z.string().url("URL inválida").or(z.literal("")).optional(),
});

type SettingsFormValues = z.infer<typeof settingsSchema>;

export default function Settings() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadingMenuImage, setUploadingMenuImage] = useState(false);

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
            });
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
      console.log('[Settings] Fetching restaurant data for ID:', RESTAURANT_ID);
      
      const { data, error } = await (supabase as any)
        .schema('mesaclik')
        .from('restaurants')
        .select('name, address_line, city, cuisine, about, image_url, menu_url, menu_image_url')
        .eq('id', RESTAURANT_ID)
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
        });
      } else {
        console.warn('[Settings] No data found for restaurant ID:', RESTAURANT_ID);
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
      const fileName = `${RESTAURANT_ID}-image-${Date.now()}.${fileExt}`;
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
      const fileName = `${RESTAURANT_ID}-menu-${Date.now()}.${fileExt}`;
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
        })
        .eq('id', RESTAURANT_ID);

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
                name="address_line"
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
