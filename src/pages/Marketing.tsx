import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MarketingGenerateTab } from '@/components/marketing/MarketingGenerateTab';
import { MarketingHistoryTab } from '@/components/marketing/MarketingHistoryTab';
import { Sparkles } from 'lucide-react';

export default function Marketing() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <Sparkles className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">Marketing IA</h1>
        </div>
        <p className="text-muted-foreground mt-1">
          Gere posts profissionais para redes sociais do seu restaurante
        </p>
      </div>

      <Tabs defaultValue="generate" className="space-y-4">
        <TabsList>
          <TabsTrigger value="generate">Gerar Post</TabsTrigger>
          <TabsTrigger value="history">Histórico</TabsTrigger>
        </TabsList>

        <TabsContent value="generate">
          <MarketingGenerateTab />
        </TabsContent>

        <TabsContent value="history">
          <MarketingHistoryTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
