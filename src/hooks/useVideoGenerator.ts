import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";
import { useRestaurant } from "@/contexts/RestaurantContext";
import { toast } from "sonner";

export interface VideoJob {
  id: string;
  restaurant_id: string;
  status: "queued" | "rendering" | "done" | "failed";
  template: "A" | "B" | "C";
  duration: 7 | 15 | 30;
  restaurant_name: string;
  location: string | null;
  promo_text: string | null;
  cta_type: string | null;
  cta_custom: string | null;
  image_urls: string[];
  logo_url: string | null;
  video_url: string | null;
  thumbnail_url: string | null;
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
  restaurant_name: string;
  location?: string;
  promo_text?: string;
  template: "A" | "B" | "C";
  duration: 7 | 15 | 30;
  cta_type?: "reserve" | "queue" | "whatsapp" | "custom" | null;
  cta_custom?: string;
  image_urls: string[];
  logo_url?: string;
}

export function useVideoGenerator() {
  const { restaurantId } = useRestaurant();
  const queryClient = useQueryClient();
  const [uploadProgress, setUploadProgress] = useState(0);

  const {
    data: videoJobs,
    isLoading: isLoadingJobs,
    refetch: refetchJobs,
  } = useQuery({
    queryKey: ["video-jobs", restaurantId],
    queryFn: async () => {
      if (!restaurantId) return [];
      const { data, error } = await supabase
        .from("video_jobs")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as VideoJob[];
    },
    enabled: !!restaurantId,
  });

  const { data: usageData } = useQuery({
    queryKey: ["video-usage", restaurantId],
    queryFn: async () => {
      if (!restaurantId) return { videos_generated: 0, limit: 10 } as VideoUsage;
      const currentMonth = new Date().toISOString().slice(0, 7);
      const { data, error } = await supabase
        .from("video_usage")
        .select("videos_generated")
        .eq("restaurant_id", restaurantId)
        .eq("month_year", currentMonth)
        .single();
      if (error && error.code !== "PGRST116") throw error;
      return { videos_generated: data?.videos_generated || 0, limit: 10 } as VideoUsage;
    },
    enabled: !!restaurantId,
  });

  const uploadImage = async (file: File): Promise<string> => {
    const fileExt = file.name.split(".").pop();
    const fileName = `${restaurantId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
    const { data, error } = await supabase.storage.from("videos").upload(fileName, file, { cacheControl: "3600", upsert: false });
    if (error) throw error;
    const { data: publicUrl } = supabase.storage.from("videos").getPublicUrl(data.path);
    return publicUrl.publicUrl;
  };

  const uploadImages = async (files: File[]): Promise<string[]> => {
    const urls: string[] = [];
    for (let i = 0; i < files.length; i++) {
      const url = await uploadImage(files[i]);
      urls.push(url);
      setUploadProgress(((i + 1) / files.length) * 100);
    }
    setUploadProgress(0);
    return urls;
  };

  const createVideoMutation = useMutation({
    mutationFn: async (params: CreateVideoParams) => {
      const { data, error } = await supabase.functions.invoke("render-video", {
        body: { restaurant_id: restaurantId, ...params },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["video-jobs", restaurantId] });
      queryClient.invalidateQueries({ queryKey: ["video-usage", restaurantId] });
      toast.success("Vídeo adicionado à fila de geração!");
    },
    onError: (error: Error) => {
      console.error("Error creating video:", error);
      toast.error(error.message || "Erro ao criar vídeo");
    },
  });

  const deleteVideoMutation = useMutation({
    mutationFn: async (jobId: string) => {
      const { error } = await supabase.from("video_jobs").delete().eq("id", jobId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["video-jobs", restaurantId] });
      toast.success("Vídeo removido");
    },
    onError: (error: Error) => {
      console.error("Error deleting video:", error);
      toast.error("Erro ao remover vídeo");
    },
  });

  const updateVideoUrl = async (jobId: string, videoUrl: string, thumbnailUrl?: string) => {
    const { error } = await supabase
      .from("video_jobs")
      .update({ video_url: videoUrl, thumbnail_url: thumbnailUrl || null, status: "done", completed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", jobId);
    if (error) throw error;
    queryClient.invalidateQueries({ queryKey: ["video-jobs", restaurantId] });
  };

  return {
    videoJobs,
    isLoadingJobs,
    refetchJobs,
    usage: usageData,
    uploadProgress,
    uploadImages,
    createVideo: createVideoMutation.mutate,
    isCreating: createVideoMutation.isPending,
    deleteVideo: deleteVideoMutation.mutate,
    isDeleting: deleteVideoMutation.isPending,
    updateVideoUrl,
  };
}