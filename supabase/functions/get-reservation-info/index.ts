import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ReservationInfoRequest {
  reservation_id: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { reservation_id }: ReservationInfoRequest = await req.json();

    if (!reservation_id) {
      return new Response(
        JSON.stringify({ found: false, error: "reservation_id is required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log("Fetching reservation info:", reservation_id);

    // Use service role to bypass RLS
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") || "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "",
      { auth: { persistSession: false } }
    );

    // Fetch reservation with restaurant info
    const { data: reservation, error: reservationError } = await supabaseAdmin
      .from("reservations")
      .select(`
        id,
        restaurant_id,
        customer_name,
        customer_email,
        phone,
        party_size,
        reservation_datetime,
        status,
        notes,
        cancel_reason,
        canceled_at,
        created_at,
        updated_at
      `)
      .eq("id", reservation_id)
      .single();

    if (reservationError || !reservation) {
      console.error("Reservation not found:", reservationError);
      return new Response(
        JSON.stringify({ found: false, error: "Reservation not found" }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Fetch restaurant info
    const { data: restaurant, error: restaurantError } = await supabaseAdmin
      .from("restaurants")
      .select("id, name, address, cuisine")
      .eq("id", reservation.restaurant_id)
      .single();

    if (restaurantError) {
      console.error("Restaurant fetch error:", restaurantError);
    }

    // Fetch reservation settings for tolerance
    const { data: settings } = await supabaseAdmin
      .from("reservation_settings")
      .select("tolerance_minutes, max_party_size")
      .eq("restaurant_id", reservation.restaurant_id)
      .single();

    const response = {
      found: true,
      reservation_id: reservation.id,
      restaurant_id: reservation.restaurant_id,
      restaurant_name: restaurant?.name || "Restaurante",
      restaurant_address: restaurant?.address || null,
      restaurant_cuisine: restaurant?.cuisine || null,
      customer_name: reservation.customer_name,
      customer_email: reservation.customer_email,
      phone: reservation.phone,
      party_size: reservation.party_size,
      reservation_datetime: reservation.reservation_datetime,
      status: reservation.status,
      notes: reservation.notes,
      cancel_reason: reservation.cancel_reason,
      canceled_at: reservation.canceled_at,
      created_at: reservation.created_at,
      updated_at: reservation.updated_at,
      tolerance_minutes: settings?.tolerance_minutes || 15,
    };

    console.log("Reservation info response:", JSON.stringify(response));

    return new Response(
      JSON.stringify(response),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error fetching reservation info:", error);
    return new Response(
      JSON.stringify({ found: false, error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
