import { useState } from 'react';
import { Brain, RefreshCw, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useRestaurant } from '@/contexts/RestaurantContext';
import { 
  useAIPalpites, 
  AIPalpite,
  PalpiteStatusFilter,
  PalpitePriorityFilter,
  PalpiteTypeFilter,
} from '@/hooks/useAIPalpites';
import { PalpitesStats } from '@/components/intelligence/PalpitesStats';
import { PalpitesFilters } from '@/components/intelligence/PalpitesFilters';
import { PalpiteCard } from '@/components/intelligence/PalpiteCard';
import { SendPalpitePromotionDialog } from '@/components/intelligence/SendPalpitePromotionDialog';
import { ProtectedRoute } from '@/components/layout/ProtectedRoute';

function IntelligenceContent() {
  const { restaurantId } = useRestaurant();
  const {
    palpites,
    stats,
    loading,
    generatePalpites,
    updatePalpiteStatus,
    filterPalpites,
  } = useAIPalpites(restaurantId || '');

  const [statusFilter, setStatusFilter] = useState<PalpiteStatusFilter>('all');
  const [priorityFilter, setPriorityFilter] = useState<PalpitePriorityFilter>('all');
  const [typeFilter, setTypeFilter] = useState<PalpiteTypeFilter>('all');
  
  const [selectedPalpite, setSelectedPalpite] = useState<AIPalpite | null>(null);
  const [isPromotionDialogOpen, setIsPromotionDialogOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const filteredPalpites = filterPalpites(statusFilter, priorityFilter, typeFilter);

  const handleGeneratePalpites = async () => {
    setIsGenerating(true);
    await generatePalpites();
    setIsGenerating(false);
  };

  const handleMarkSeen = async (id: string) => {
    return updatePalpiteStatus(id, 'seen');
  };

  const handleDismiss = async (id: string) => {
    return updatePalpiteStatus(id, 'dismissed');
  };

  const handleSendPromotion = (palpite: AIPalpite) => {
    setSelectedPalpite(palpite);
    setIsPromotionDialogOpen(true);
  };

  const handlePromotionSent = async (palpiteId: string) => {
    return updatePalpiteStatus(palpiteId, 'sent');
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Brain className="h-7 w-7 text-primary" />
            Palpites
          </h1>
          <p className="text-muted-foreground">
            Sugestões inteligentes para retenção e recuperação de clientes
          </p>
        </div>

        <Button 
          onClick={handleGeneratePalpites}
          disabled={isGenerating}
          className="gap-2"
        >
          {isGenerating ? (
            <RefreshCw className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          Gerar Palpites
        </Button>
      </div>

      {/* Stats cards */}
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : (
        <PalpitesStats stats={stats} />
      )}

      {/* Filters */}
      <PalpitesFilters
        statusFilter={statusFilter}
        onStatusChange={setStatusFilter}
        priorityFilter={priorityFilter}
        onPriorityChange={setPriorityFilter}
        typeFilter={typeFilter}
        onTypeChange={setTypeFilter}
      />

      {/* Palpites feed */}
      <div className="space-y-4">
        {loading ? (
          <>
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-48" />
            ))}
          </>
        ) : filteredPalpites.length === 0 ? (
          <div className="text-center py-12 bg-muted/30 rounded-lg">
            <Sparkles className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">Nenhum palpite encontrado</h3>
            <p className="text-muted-foreground mb-4">
              {palpites.length === 0
                ? 'Clique em "Gerar Palpites" para analisar seus clientes.'
                : 'Nenhum palpite corresponde aos filtros selecionados.'}
            </p>
            {palpites.length === 0 && (
              <Button onClick={handleGeneratePalpites} disabled={isGenerating}>
                <Sparkles className="h-4 w-4 mr-2" />
                Gerar Palpites
              </Button>
            )}
          </div>
        ) : (
          filteredPalpites.map((palpite) => (
            <PalpiteCard
              key={palpite.id}
              palpite={palpite}
              onMarkSeen={handleMarkSeen}
              onDismiss={handleDismiss}
              onSendPromotion={handleSendPromotion}
            />
          ))
        )}
      </div>

      {/* Send promotion dialog */}
      <SendPalpitePromotionDialog
        open={isPromotionDialogOpen}
        onOpenChange={setIsPromotionDialogOpen}
        palpite={selectedPalpite}
        onSent={handlePromotionSent}
      />
    </div>
  );
}

export default function Intelligence() {
  return (
    <ProtectedRoute>
      <IntelligenceContent />
    </ProtectedRoute>
  );
}
