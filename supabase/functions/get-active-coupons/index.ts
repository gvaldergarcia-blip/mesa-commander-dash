import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      db: { schema: 'mesaclik' }
    });

    // Get optional restaurant_id filter from query params
    const url = new URL(req.url);
    const restaurantId = url.searchParams.get("restaurant_id");

    const now = new Date().toISOString();

    // Build query with correct filters
    let query = supabase
      .from("coupons")
      .select(`
        id,
        restaurant_id,
        title,
        description,
        coupon_type,
        redeem_link,
        file_url,
        image_url,
        start_date,
        end_date,
        duration_days,
        price,
        status,
        payment_status,
        created_at,
        views_count,
        clicks_count,
        uses_count,
        restaurants!coupons_restaurant_id_fkey (
          name,
          image_url,
          cuisine,
          address_line,
          city
        )
      `)
      .eq("status", "active")
      .eq("payment_status", "completed")
      .lte("start_date", now)
      .gte("end_date", now)
      .order("end_date", { ascending: true });

    // Add restaurant filter if provided
    if (restaurantId) {
      query = query.eq("restaurant_id", restaurantId);
    }

    const { data, error } = await query;

    if (error) {
      console.error("[get-active-coupons] Error:", error);
      return new Response(
        JSON.stringify({ error: error.message }),
        { 
          status: 500, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    // Map restaurants to restaurant for consistency
    const mappedData = data?.map((coupon: any) => ({
      ...coupon,
      restaurant: coupon.restaurants
    })) || [];

    console.log(`[get-active-coupons] Returning ${mappedData.length} active coupons`);

    return new Response(
      JSON.stringify({ coupons: mappedData, count: mappedData.length }),
      { 
        status: 200, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );

  } catch (error) {
    console.error("[get-active-coupons] Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});
