import { supabase } from "@/integrations/supabase/client";

import img01 from "@/assets/pizzatto-pack/01-marguerita.jpg.asset.json";
import img02 from "@/assets/pizzatto-pack/02-calabresa.jpg.asset.json";
import img03 from "@/assets/pizzatto-pack/03-pepperoni.jpg.asset.json";
import img04 from "@/assets/pizzatto-pack/04-portuguesa.jpg.asset.json";
import img05 from "@/assets/pizzatto-pack/05-burrata.jpg.asset.json";
import img06 from "@/assets/pizzatto-pack/06-do-chef.jpg.asset.json";
import img07 from "@/assets/pizzatto-pack/07-nonna-pizzatto.jpg.asset.json";
import img08 from "@/assets/pizzatto-pack/08-frango-catupiry.jpg.asset.json";
import img09 from "@/assets/pizzatto-pack/09-trio-pizzatto.jpg.asset.json";
import img10 from "@/assets/pizzatto-pack/10-pao-calabresa.jpg.asset.json";

export interface DemoPackItem {
  dish_name: string;
  url: string;
  goal: string;
  audience: string;
}

export const PIZZATTO_PACK: DemoPackItem[] = [
  { dish_name: "Marguerita", url: img01.url, goal: "divulgar novidade", audience: "casal" },
  { dish_name: "Calabresa", url: img02.url, goal: "atrair clientes em dia fraco", audience: "amigos" },
  { dish_name: "Pepperoni", url: img03.url, goal: "aumentar ticket médio", audience: "amigos" },
  { dish_name: "Portuguesa Tradicional", url: img04.url, goal: "atrair clientes em dia fraco", audience: "família" },
  { dish_name: "Burrata", url: img05.url, goal: "aumentar ticket médio", audience: "casal" },
  { dish_name: "Do Chef", url: img06.url, goal: "campanha institucional", audience: "casal" },
  { dish_name: "Nonna Pizzatto", url: img07.url, goal: "divulgar novidade", audience: "família" },
  { dish_name: "Frango com Catupiry", url: img08.url, goal: "atrair clientes em dia fraco", audience: "família" },
  { dish_name: "Trio Pizzatto", url: img09.url, goal: "divulgar novidade", audience: "happy hour" },
  { dish_name: "Pão de Calabresa", url: img10.url, goal: "divulgar novidade", audience: "happy hour" },
];

/**
 * Copia as imagens do pack para o bucket `promotion-images` do restaurante
 * atual e cria as linhas correspondentes em `promotions_assets`, para elas
 * aparecerem na Galeria do Creator como campanhas prontas.
 */
export async function importPizzattoPack(restaurantId: string) {
  let inserted = 0;
  const errors: string[] = [];

  for (const item of PIZZATTO_PACK) {
    try {
      const res = await fetch(item.url);
      if (!res.ok) throw new Error(`fetch ${res.status}`);
      const blob = await res.blob();
      const path = `${restaurantId}/demo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;

      const up = await supabase.storage
        .from("promotion-images")
        .upload(path, blob, { contentType: "image/jpeg", upsert: false });
      if (up.error) throw up.error;

      const { data: pub } = supabase.storage.from("promotion-images").getPublicUrl(path);

      const { error: insErr } = await supabase.from("promotions_assets" as any).insert({
        restaurant_id: restaurantId,
        campaign_type: "sem_desconto",
        dish_name: item.dish_name,
        campaign_goal: item.goal,
        target_audience: item.audience,
        brand_tone: "acolhedor",
        include_logo: true,
        include_address: true,
        image_url: pub.publicUrl,
        reference_image_used: false,
        status: "success",
      });
      if (insErr) throw insErr;
      inserted++;
    } catch (e: any) {
      errors.push(`${item.dish_name}: ${e?.message ?? "erro"}`);
    }
  }

  return { inserted, errors };
}