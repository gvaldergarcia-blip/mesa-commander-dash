import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search, MessageCircle, ExternalLink, Bot, User2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useRestaurant } from "@/contexts/RestaurantContext";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Msg = {
  id: string;
  restaurant_id: string;
  customer_id: string | null;
  phone: string;
  direction: "inbound" | "outbound";
  body: string | null;
  media_url: string | null;
  created_at: string;
};

type ConvHead = {
  phone: string;
  customer_id: string | null;
  customer_name: string;
  last_body: string;
  last_at: string;
  unread: number;
};

export function WhatsAppConversationsTab() {
  const { restaurantId } = useRestaurant();
  const [loading, setLoading] = useState(true);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [customers, setCustomers] = useState<Record<string, string>>({});
  const [active, setActive] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const load = async () => {
    if (!restaurantId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("whatsapp_messages")
      .select("*")
      .eq("restaurant_id", restaurantId)
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) console.error(error);
    setMsgs((data ?? []) as Msg[]);
    // Carrega nomes de clientes referenciados
    const ids = Array.from(new Set((data ?? []).map((m: any) => m.customer_id).filter(Boolean)));
    if (ids.length) {
      const { data: cs } = await supabase
        .from("restaurant_customers")
        .select("id, customer_name")
        .in("id", ids as string[]);
      const map: Record<string, string> = {};
      (cs ?? []).forEach((c: any) => { map[c.id] = c.customer_name; });
      setCustomers(map);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [restaurantId]);

  useEffect(() => {
    if (!restaurantId) return;
    const ch = supabase
      .channel(`wa-msgs-${restaurantId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "whatsapp_messages", filter: `restaurant_id=eq.${restaurantId}` },
        () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [restaurantId]);

  const conversations: ConvHead[] = useMemo(() => {
    const byPhone = new Map<string, Msg[]>();
    for (const m of msgs) {
      const arr = byPhone.get(m.phone) ?? [];
      arr.push(m);
      byPhone.set(m.phone, arr);
    }
    const list: ConvHead[] = [];
    for (const [phone, arr] of byPhone) {
      const sorted = [...arr].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
      const last = sorted[0];
      const name = (last.customer_id && customers[last.customer_id]) || phone;
      list.push({
        phone,
        customer_id: last.customer_id,
        customer_name: name,
        last_body: last.body ?? (last.media_url ? "[imagem]" : ""),
        last_at: last.created_at,
        unread: 0,
      });
    }
    list.sort((a, b) => +new Date(b.last_at) - +new Date(a.last_at));
    return list.filter((c) =>
      !search ||
      c.phone.toLowerCase().includes(search.toLowerCase()) ||
      c.customer_name.toLowerCase().includes(search.toLowerCase())
    );
  }, [msgs, customers, search]);

  const activeMsgs = useMemo(() => {
    if (!active) return [];
    return msgs
      .filter((m) => m.phone === active)
      .sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at));
  }, [msgs, active]);

  const activeConv = conversations.find((c) => c.phone === active);

  if (loading) {
    return (
      <Card><CardContent className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </CardContent></Card>
    );
  }

  if (conversations.length === 0) {
    return (
      <Card>
        <CardContent className="py-16 text-center text-muted-foreground space-y-3">
          <MessageCircle className="h-10 w-10 mx-auto opacity-40" />
          <p className="font-medium">Nenhuma conversa ainda</p>
          <p className="text-sm">Conecte o WhatsApp em Configurações para o bot começar a responder.</p>
          <Button variant="outline" asChild>
            <Link to="/settings"><ExternalLink className="h-4 w-4 mr-2" /> Configurar Bot</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-0">
        <div className="grid grid-cols-1 md:grid-cols-[320px_1fr] h-[70vh]">
          {/* Lista */}
          <div className="border-r flex flex-col">
            <div className="p-3 border-b">
              <div className="relative">
                <Search className="h-4 w-4 absolute left-2.5 top-2.5 text-muted-foreground" />
                <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar conversa" className="pl-8" />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {conversations.map((c) => (
                <button
                  key={c.phone}
                  onClick={() => setActive(c.phone)}
                  className={cn(
                    "w-full text-left p-3 border-b hover:bg-muted/40 transition-colors",
                    active === c.phone && "bg-muted/60"
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium truncate">{c.customer_name}</p>
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                      {new Date(c.last_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">{c.last_body}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5 font-mono">{c.phone}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Conversa */}
          <div className="flex flex-col">
            {!activeConv ? (
              <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
                Selecione uma conversa
              </div>
            ) : (
              <>
                <div className="p-3 border-b flex items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold">{activeConv.customer_name}</p>
                    <p className="text-xs text-muted-foreground font-mono">{activeConv.phone}</p>
                  </div>
                  {activeConv.customer_id && (
                    <Button variant="outline" size="sm" asChild>
                      <Link to={`/customers/${activeConv.customer_id}`}>Ver no CRM</Link>
                    </Button>
                  )}
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-muted/20">
                  {activeMsgs.map((m) => {
                    const isBot = m.direction === "outbound";
                    return (
                      <div key={m.id} className={cn("flex", isBot ? "justify-end" : "justify-start")}>
                        <div className={cn(
                          "max-w-[80%] rounded-2xl px-3 py-2 text-sm",
                          isBot ? "bg-primary text-primary-foreground" : "bg-card border"
                        )}>
                          <div className="flex items-center gap-1 text-[10px] opacity-70 mb-1">
                            {isBot ? <Bot className="h-3 w-3" /> : <User2 className="h-3 w-3" />}
                            {isBot ? "IA" : "Cliente"} · {new Date(m.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                          </div>
                          {m.media_url && (
                            <img src={m.media_url} alt="anexo" className="rounded-lg mb-1 max-w-full" />
                          )}
                          {m.body && <p className="whitespace-pre-wrap">{m.body}</p>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}