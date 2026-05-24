import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useRestaurant } from "@/contexts/RestaurantContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Upload, Trash2, Image as ImageIcon, Building2, Loader2 } from "lucide-react";

interface AmbientPhoto {
  id: string;
  photo_url: string;
  source: "google" | "manual";
  position: number;
  created_at: string;
}

export function AmbientPhotosManager() {
  const { restaurantId } = useRestaurant();
  const [photos, setPhotos] = useState<AmbientPhoto[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  const fetchPhotos = async () => {
    if (!restaurantId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("restaurant_ambient_photos" as any)
      .select("*")
      .eq("restaurant_id", restaurantId)
      .order("position", { ascending: true });
    if (error) {
      console.error(error);
    } else {
      setPhotos((data as any[]) as AmbientPhoto[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchPhotos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantId]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length || !restaurantId) return;
    setUploading(true);
    try {
      let position = photos.length;
      for (const file of files) {
        if (file.size > 5 * 1024 * 1024) {
          toast.error(`${file.name}: máximo 5MB`);
          continue;
        }
        const ext = file.name.split(".").pop() || "jpg";
        const path = `${restaurantId}/manual_${Date.now()}_${position}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("ambient-photos")
          .upload(path, file, { contentType: file.type, upsert: false });
        if (upErr) {
          toast.error(upErr.message);
          continue;
        }
        const { data: urlData } = supabase.storage.from("ambient-photos").getPublicUrl(path);
        const { error: insErr } = await supabase
          .from("restaurant_ambient_photos" as any)
          .insert({
            restaurant_id: restaurantId,
            photo_url: urlData.publicUrl,
            source: "manual",
            position: position++,
          });
        if (insErr) toast.error(insErr.message);
      }
      toast.success("Fotos enviadas!");
      await fetchPhotos();
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleDelete = async (photo: AmbientPhoto) => {
    if (!confirm("Remover esta foto?")) return;
    const idx = photo.photo_url.indexOf("/ambient-photos/");
    if (idx >= 0) {
      const path = photo.photo_url.slice(idx + "/ambient-photos/".length);
      await supabase.storage.from("ambient-photos").remove([path]);
    }
    const { error } = await supabase
      .from("restaurant_ambient_photos" as any)
      .delete()
      .eq("id", photo.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Foto removida");
    fetchPhotos();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="h-5 w-5 text-primary" />
          Fotos do Ambiente
        </CardTitle>
        <CardDescription>
          Estas fotos serão usadas no MesaClik Studio para compor imagens dos seus pratos dentro do
          ambiente real do restaurante. Envie 2–3 fotos do interior.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex flex-wrap gap-2">
          <label className="inline-flex">
            <Button type="button" variant="outline" className="gap-2" disabled={uploading} asChild>
              <span>
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                {uploading ? "Enviando..." : "Enviar foto manualmente"}
              </span>
            </Button>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              className="hidden"
              onChange={handleUpload}
              disabled={uploading}
            />
          </label>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-10 text-muted-foreground text-sm">
            <Loader2 className="w-4 h-4 animate-spin mr-2" /> Carregando...
          </div>
        ) : photos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center border-2 border-dashed rounded-lg">
            <ImageIcon className="w-10 h-10 text-muted-foreground/40 mb-2" />
            <p className="text-sm text-muted-foreground">
              Nenhuma foto do ambiente cadastrada ainda.
            </p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              Sincronize com o Google ou envie 2–3 fotos do interior.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {photos.map((p) => (
              <div key={p.id} className="relative group rounded-lg overflow-hidden border bg-muted/30">
                <img src={p.photo_url} alt="Ambiente" className="w-full h-32 object-cover" loading="lazy" />
                <div className="absolute top-2 left-2 text-[10px] uppercase tracking-wider bg-background/80 backdrop-blur px-1.5 py-0.5 rounded">
                  {p.source === "google" ? "Google" : "Manual"}
                </div>
                <button
                  type="button"
                  onClick={() => handleDelete(p)}
                  className="absolute top-2 right-2 p-1.5 rounded-full bg-background/80 hover:bg-destructive hover:text-destructive-foreground transition opacity-0 group-hover:opacity-100"
                  aria-label="Remover"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}