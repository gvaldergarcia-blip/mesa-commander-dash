import { useEffect, useRef, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Send, ChefHat, Wrench } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useRestaurant } from '@/contexts/RestaurantContext';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

type Msg = { role: 'user' | 'assistant'; content: string; tools?: any[] };
const KEY = 'cardapio-chat-history-v1';

export function CardapioChatTab() {
  const { restaurantId } = useRestaurant();
  const [messages, setMessages] = useState<Msg[]>(() => {
    if (typeof window === 'undefined') return [];
    try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; }
  });
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { localStorage.setItem(KEY, JSON.stringify(messages)); }, [messages]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, loading]);
  useEffect(() => { taRef.current?.focus(); }, [loading]);

  const send = async () => {
    const text = input.trim();
    if (!text || !restaurantId || loading) return;
    const next = [...messages, { role: 'user' as const, content: text }];
    setMessages(next);
    setInput('');
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('cardapio-chat', {
        body: {
          restaurantId,
          messages: next.map((m) => ({ role: m.role, content: m.content })),
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setMessages([...next, { role: 'assistant', content: (data as any).reply || '', tools: (data as any).tool_trace }]);
    } catch (e: any) {
      toast.error('Erro no chat', { description: e?.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardContent className="p-0 flex flex-col h-[70vh]">
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && (
            <div className="text-center text-muted-foreground py-12">
              <ChefHat className="h-10 w-10 mx-auto mb-3 text-primary opacity-70" />
              <p className="font-medium">Converse com a IA do Cardápio</p>
              <p className="text-sm mt-1 max-w-md mx-auto">
                Exemplo: <em>"Mande o nhoque pra Maria amanhã 19h"</em> ou <em>"Quem amaria o risoto?"</em>
              </p>
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
              <div className={cn(
                'max-w-[85%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap',
                m.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted',
              )}>
                {m.content || (m.role === 'assistant' ? '...' : '')}
                {m.tools && m.tools.length > 0 && (
                  <details className="mt-2 text-xs opacity-80">
                    <summary className="cursor-pointer flex items-center gap-1"><Wrench className="h-3 w-3" /> {m.tools.length} ação(ões)</summary>
                    <pre className="mt-1 whitespace-pre-wrap break-all bg-background/40 rounded p-2 text-[10px] max-h-48 overflow-auto">
                      {JSON.stringify(m.tools, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-muted rounded-2xl px-4 py-2.5 text-sm flex items-center gap-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Pensando…
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>
        <div className="border-t p-3 flex gap-2">
          <Textarea
            ref={taRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder="Pergunte algo ou peça uma campanha..."
            rows={2}
            className="resize-none"
            disabled={loading}
          />
          <Button onClick={send} disabled={!input.trim() || loading} size="icon" className="self-end">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}