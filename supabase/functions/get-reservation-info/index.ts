import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ReservationInfoRequest {
  reservation_id: string;
  action?: 'cancel';
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { reservation_id, action }: ReservationInfoRequest = await req.json();

    if (!reservation_id) {
      return new Response(
        JSON.stringify({ found: false, error: "reservation_id is required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Use service role to bypass RLS
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") || "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "",
      { 
        auth: { persistSession: false },
        db: { schema: 'mesaclik' }
      }
    );

    // Handle cancel action
    if (action === 'cancel') {
      console.log("Canceling reservation:", reservation_id);
      
      // Verify reservation exists and is cancelable
      const { data: res, error: fetchErr } = await supabaseAdmin
        .from("reservations")
        .select("id, status")
        .eq("id", reservation_id)
        .single();

      if (fetchErr || !res) {
        return new Response(
          JSON.stringify({ success: false, error: "Reserva não encontrada" }),
          { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      if (!['pending', 'confirmed'].includes(res.status)) {
        return new Response(
          JSON.stringify({ success: false, error: "Esta reserva não pode ser cancelada" }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      const { error: updateErr } = await supabaseAdmin
        .from("reservations")
        .update({
          status: 'canceled',
          canceled_at: new Date().toISOString(),
          canceled_by: 'customer',
          cancel_reason: 'Cancelado pelo cliente',
          updated_at: new Date().toISOString(),
        })
        .eq("id", reservation_id);

      if (updateErr) {
        console.error("Cancel error:", updateErr);
        return new Response(
          JSON.stringify({ success: false, error: "Erro ao cancelar reserva" }),
          { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      console.log("Reservation canceled successfully:", reservation_id);
      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log("Fetching reservation info:", reservation_id);

    // Fetch reservation from mesaclik.reservations
    const { data: reservation, error: reservationError } = await supabaseAdmin
      .from("reservations")
      .select(`
        id,
        restaurant_id,
        name,
        customer_email,
        phone,
        party_size,
        reserved_for,
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

    console.log("Found reservation:", reservation.id, "for restaurant:", reservation.restaurant_id);

    // Fetch restaurant info from mesaclik schema (same as reservations)
    const { data: restaurant, error: restaurantError } = await supabaseAdmin
      .from("restaurants")
      .select("id, name, address_line, city, cuisine, logo_url")
      .eq("id", reservation.restaurant_id)
      .single();

    if (restaurantError) {
      console.error("Restaurant fetch error:", restaurantError);
    }

    // Create a new client for public schema to get reservation settings
    const supabasePublic = createClient(
      Deno.env.get("SUPABASE_URL") || "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "",
      { 
        auth: { persistSession: false },
        db: { schema: 'public' }
      }
    );

    // Fetch reservation settings for tolerance from public schema
    const { data: settings } = await supabasePublic
      .from("reservation_settings")
      .select("tolerance_minutes, max_party_size")
      .eq("restaurant_id", reservation.restaurant_id)
      .maybeSingle();


    // Build full address from address_line and city
    let fullAddress = null;
    if (restaurant?.address_line) {
      const addressParts = [];
      addressParts.push(restaurant.address_line);
      if (restaurant.city) addressParts.push(restaurant.city);
      fullAddress = addressParts.join(', ');
    }

    const response = {
      found: true,
      reservation_id: reservation.id,
      restaurant_id: reservation.restaurant_id,
      restaurant_name: restaurant?.name || "Restaurante",
      restaurant_address: fullAddress,
      restaurant_cuisine: restaurant?.cuisine || null,
      restaurant_logo_url: restaurant?.logo_url || null,
      customer_name: reservation.name, // mesaclik uses 'name' instead of 'customer_name'
      customer_email: reservation.customer_email,
      phone: reservation.phone,
      party_size: reservation.party_size,
      reservation_datetime: reservation.reserved_for, // mesaclik uses 'reserved_for' instead of 'reservation_datetime'
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