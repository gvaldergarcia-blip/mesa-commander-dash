import React, { useState } from 'react';
import { useActiveCoupons } from '@/hooks/useActiveCoupons';
import { CouponCard } from '@/components/coupons/CouponCard';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Filter, SlidersHorizontal, Tag } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export default function Coupons() {
  const { coupons, loading, registerInteraction } = useActiveCoupons();
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'expiring' | 'newest' | 'restaurant'>('expiring');
  const [cuisineFilter, setCuisineFilter] = useState<string>('all');

  // Filtrar cupons
  const filteredCoupons = coupons.filter((coupon) => {
    const matchesSearch = 
      coupon.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      coupon.restaurant?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      coupon.description?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesCuisine = 
      cuisineFilter === 'all' || coupon.restaurant?.cuisine === cuisineFilter;

    return matchesSearch && matchesCuisine;
  });

  // Ordenar cupons
  const sortedCoupons = [...filteredCoupons].sort((a, b) => {
    switch (sortBy) {
      case 'expiring':
        return new Date(a.end_date).getTime() - new Date(b.end_date).getTime();
      case 'newest':
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      case 'restaurant':
        return (a.restaurant?.name || '').localeCompare(b.restaurant?.name || '');
      default:
        return 0;
    }
  });

  // Obter tipos de cozinha únicos
  const uniqueCuisines = Array.from(new Set(coupons.map(c => c.restaurant?.cuisine).filter(Boolean)));

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-7xl mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Tag className="w-8 h-8 text-primary" />
            <h1 className="text-3xl md:text-4xl font-bold">Todos os Cupons</h1>
          </div>
          <p className="text-muted-foreground">
            Descubra as melhores ofertas dos restaurantes parceiros
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar cupons ou restaurantes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Sort */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-2">
                <SlidersHorizontal className="w-4 h-4" />
                Ordenar
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Ordenar por</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuRadioGroup value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
                <DropdownMenuRadioItem value="expiring">
                  Expirando primeiro
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="newest">
                  Mais novos
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="restaurant">
                  Nome do restaurante
                </DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Cuisine Filter */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Filter className="w-4 h-4" />
                Cozinha
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Tipo de cozinha</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuRadioGroup value={cuisineFilter} onValueChange={setCuisineFilter}>
                <DropdownMenuRadioItem value="all">
                  Todas
                </DropdownMenuRadioItem>
                {uniqueCuisines.map((cuisine) => (
                  <DropdownMenuRadioItem key={cuisine} value={cuisine || ''}>
                    {cuisine}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Results Count */}
        <div className="text-sm text-muted-foreground">
          {sortedCoupons.length} {sortedCoupons.length === 1 ? 'cupom encontrado' : 'cupons encontrados'}
        </div>

        {/* Coupons Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-96 bg-muted animate-pulse rounded-lg" />
            ))}
          </div>
        ) : sortedCoupons.length === 0 ? (
          <div className="text-center py-20">
            <Tag className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2">Nenhum cupom encontrado</h3>
            <p className="text-muted-foreground">
              {searchTerm || cuisineFilter !== 'all'
                ? 'Tente ajustar os filtros de busca.'
                : 'Novos cupons serão exibidos aqui em breve.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {sortedCoupons.map((coupon) => (
              <CouponCard
                key={coupon.id}
                coupon={coupon}
                variant="grid"
                onView={() => registerInteraction(coupon.id, 'view')}
                onClick={() => registerInteraction(coupon.id, 'click')}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
