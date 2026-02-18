import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRestaurant } from "@/contexts/RestaurantContext";
import { toast } from "sonner";
import { renderVideo, generateThumbnail, type RenderOptions } from "@/lib/video/videoRenderer";
import type { MusicTheme } from "@/lib/video/audioGenerator";
import type { NarrationScript } from "@/lib/video/ttsNarrator";

export interface VideoJob {
  id: string;
  restaurant_id: string;
  user_id: string | null;
  format: "vertical" | "square";
  duration_seconds: number;
  template_id: string;
  headline: string;
  subtext: string | null;
  cta: string | null;
  music_id: string | null;
  status: "queued" | "processing" | "done" | "failed";
  progress: number;
  video_url: string | null;
  thumbnail_url: string | null;
  image_urls: string[];
  logo_url: string | null;
  restaurant_name: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export interface VideoUsage {
  videos_generated: number;
  limit: number;
}

export interface CreateVideoParams {
  headline: string;
  subtext?: string;
  cta?: string;
  format: "vertical" | "square";
  duration: 7 | 15 | 30;
  templateId: string;
  musicTheme?: Exclude<MusicTheme, 'auto'>;
  musicId?: string;
  imageFiles: File[];
  logoFile?: File;
  restaurantName: string;
  narrationScript?: NarrationScript;
  enableNarration?: boolean;
  customMusicFile?: File;
}

const MONTHLY_LIMIT = Infinity;

export function useVideoGenerator() {
  const { restaurantId, restaurant } = useRestaurant();
  const queryClient = useQueryClient();
  const [renderProgress, setRenderProgress] = useState(0);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isRendering, setIsRendering] = useState(false);

  // Fetch video jobs
  const {
    data: videoJobs,
    isLoading: isLoadingJobs,
    refetch: refetchJobs,
  } = useQuery({
    queryKey: ["video-jobs", restaurantId],
    queryFn: async () => {
      if (!restaurantId) return [];
      const { data, error } = await (supabase as any)
        .from("video_jobs")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as VideoJob[];
    },
    enabled: !!restaurantId,
  });

  // Fetch monthly usage
  const { data: usageData } = useQuery({
    queryKey: ["video-usage", restaurantId],
    queryFn: async () => {
      if (!restaurantId) return { videos_generated: 0, limit: MONTHLY_LIMIT } as VideoUsage;
      const currentMonth = new Date().toISOString().slice(0, 7);
      const { data, error } = await (supabase as any)
        .from("video_usage")
        .select("videos_generated")
        .eq("restaurant_id", restaurantId)
        .eq("month_year", currentMonth)
        .single();
      if (error && error.code !== "PGRST116") throw error;
      return { videos_generated: data?.videos_generated || 0, limit: MONTHLY_LIMIT } as VideoUsage;
    },
    enabled: !!restaurantId,
  });

  // Upload a single image to storage
  const uploadImage = async (file: File): Promise<string> => {
    const fileExt = file.name.split(".").pop();
    const fileName = `${restaurantId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
    const { data, error } = await supabase.storage
      .from("marketing-videos")
      .upload(fileName, file, { cacheControl: "3600", upsert: false });
    if (error) throw error;
    const { data: publicUrl } = supabase.storage.from("marketing-videos").getPublicUrl(data.path);
    return publicUrl.publicUrl;
  };

  // Full create flow: upload → create record → render client-side → save
  const createVideoMutation = useMutation({
    mutationFn: async (params: CreateVideoParams) => {
      if (!restaurantId) throw new Error("Restaurant não encontrado");


      // 1. Upload images
      setUploadProgress(0);
      const imageUrls: string[] = [];
      for (let i = 0; i < params.imageFiles.length; i++) {
        const url = await uploadImage(params.imageFiles[i]);
        imageUrls.push(url);
        setUploadProgress(((i + 1) / params.imageFiles.length) * 100);
      }

      let logoUrl: string | undefined;
      if (params.logoFile) {
        logoUrl = await uploadImage(params.logoFile);
      }

      let customMusicUrl: string | undefined;
      if (params.customMusicFile) {
        customMusicUrl = await uploadImage(params.customMusicFile);
      }

      // 2. Create DB record
      const { data: job, error: insertError } = await (supabase as any)
        .from("video_jobs")
        .insert({
          restaurant_id: restaurantId,
          format: params.format,
          duration_seconds: params.duration,
          template_id: params.templateId,
          headline: params.headline,
          subtext: params.subtext || null,
          cta: params.cta || null,
          music_id: params.musicId || null,
          status: "processing",
          image_urls: imageUrls,
          logo_url: logoUrl || null,
          restaurant_name: params.restaurantName,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // 3. Render video client-side
      setIsRendering(true);
      setRenderProgress(0);

      const renderOpts: RenderOptions = {
        images: imageUrls,
        format: params.format,
        duration: params.duration,
        templateId: params.templateId,
        headline: params.headline,
        subtext: params.subtext,
        cta: params.cta,
        restaurantName: params.restaurantName,
        logoUrl,
        musicTheme: params.musicTheme,
        customMusicUrl,
        narrationScript: params.narrationScript,
        enableNarration: params.enableNarration,
        onProgress: (p) => setRenderProgress(p),
      };

      try {
        const videoBlob = await renderVideo(renderOpts);

        // 4. Upload video to storage
        const videoFileName = `${restaurantId}/videos/${Date.now()}_${params.format}_${params.duration}s.webm`;
        const { data: videoData, error: uploadError } = await supabase.storage
          .from("marketing-videos")
          .upload(videoFileName, videoBlob, {
            contentType: "video/webm",
            cacheControl: "3600",
          });

        if (uploadError) throw uploadError;

        const { data: videoPublicUrl } = supabase.storage
          .from("marketing-videos")
          .getPublicUrl(videoData.path);

        // 5. Generate thumbnail
        let thumbnailUrl: string | null = null;
        try {
          const thumbDataUrl = await generateThumbnail(renderOpts);
          const thumbBlob = await fetch(thumbDataUrl).then((r) => r.blob());
          const thumbFileName = `${restaurantId}/thumbnails/${Date.now()}.jpg`;
          const { data: thumbData } = await supabase.storage
            .from("marketing-videos")
            .upload(thumbFileName, thumbBlob, {
              contentType: "image/jpeg",
              cacheControl: "3600",
            });
          if (thumbData) {
            const { data: thumbUrl } = supabase.storage
              .from("marketing-videos")
              .getPublicUrl(thumbData.path);
            thumbnailUrl = thumbUrl.publicUrl;
          }
        } catch {
          // Thumbnail is optional
        }

        // 6. Update record
        await (supabase as any)
          .from("video_jobs")
          .update({
            status: "done",
            progress: 100,
            video_url: videoPublicUrl.publicUrl,
            thumbnail_url: thumbnailUrl,
            completed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", job.id);

        // 7. Update usage
        const currentMonth = new Date().toISOString().slice(0, 7);
        const { data: existingUsage } = await (supabase as any)
          .from("video_usage")
          .select("id, videos_generated")
          .eq("restaurant_id", restaurantId)
          .eq("month_year", currentMonth)
          .single();

        if (existingUsage) {
          await (supabase as any)
            .from("video_usage")
            .update({
              videos_generated: existingUsage.videos_generated + 1,
              updated_at: new Date().toISOString(),
            })
            .eq("id", existingUsage.id);
        } else {
          await (supabase as any)
            .from("video_usage")
            .insert({
              restaurant_id: restaurantId,
              month_year: currentMonth,
              videos_generated: 1,
            });
        }

        return job;
      } catch (renderError) {
        // Update record as failed
        await (supabase as any)
          .from("video_jobs")
          .update({
            status: "failed",
            error_message: renderError instanceof Error ? renderError.message : "Erro na renderização",
            updated_at: new Date().toISOString(),
          })
          .eq("id", job.id);
        throw renderError;
      } finally {
        setIsRendering(false);
        setRenderProgress(0);
        setUploadProgress(0);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["video-jobs", restaurantId] });
      queryClient.invalidateQueries({ queryKey: ["video-usage", restaurantId] });
      toast.success("Vídeo gerado com sucesso!");
    },
    onError: (error: Error) => {
      console.error("Error creating video:", error);
      toast.error(error.message || "Erro ao gerar vídeo");
    },
  });

  // Delete video job
  const deleteVideoMutation = useMutation({
    mutationFn: async (jobId: string) => {
      const { error } = await (supabase as any).from("video_jobs").delete().eq("id", jobId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["video-jobs", restaurantId] });
      toast.success("Vídeo removido");
    },
    onError: () => {
      toast.error("Erro ao remover vídeo");
    },
  });

  return {
    videoJobs,
    isLoadingJobs,
    refetchJobs,
    usage: usageData,
    uploadProgress,
    renderProgress,
    isRendering,
    createVideo: createVideoMutation.mutate,
    isCreating: createVideoMutation.isPending,
    deleteVideo: deleteVideoMutation.mutate,
    isDeleting: deleteVideoMutation.isPending,
    restaurantName: restaurant?.name || "",
  };
}
