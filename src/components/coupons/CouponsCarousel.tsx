import React from 'react';
import { useActiveCoupons } from '@/hooks/useActiveCoupons';
import { CouponCard } from './CouponCard';
import { Button } from '@/components/ui/button';
import { ChevronRight, Tag } from 'lucide-react';
import { Link } from 'react-router-dom';

export function CouponsCarousel() {
  const { coupons, loading, registerInteraction } = useActiveCoupons();
  const scrollRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    console.log('CouponsCarousel - Cupons carregados:', coupons.length, coupons);
  }, [coupons]);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = direction === 'left' ? -300 : 300;
      scrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="h-8 w-48 bg-muted animate-pulse rounded" />
        </div>
        <div className="flex gap-4 overflow-hidden">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="min-w-[280px] h-80 bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (coupons.length === 0) {
    return null;
  }

  return (
    <section className="space-y-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Tag className="w-6 h-6 text-primary" />
          <h2 className="text-2xl font-bold">Ofertas e Cupons MesaClik 💸</h2>
        </div>
        <Link to="/cupons">
          <Button variant="ghost" className="gap-2">
            Ver todos
            <ChevronRight className="w-4 h-4" />
          </Button>
        </Link>
      </div>

      {/* Carousel */}
      <div className="relative group">
        {/* Navigation Buttons */}
        {coupons.length > 3 && (
          <>
            <Button
              variant="outline"
              size="icon"
              className="absolute left-0 top-1/2 -translate-y-1/2 z-10 h-12 w-12 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={() => scroll('left')}
            >
              <ChevronRight className="w-5 h-5 rotate-180" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="absolute right-0 top-1/2 -translate-y-1/2 z-10 h-12 w-12 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={() => scroll('right')}
            >
              <ChevronRight className="w-5 h-5" />
            </Button>
          </>
        )}

        {/* Cards Container */}
        <div
          ref={scrollRef}
          className="flex gap-4 overflow-x-auto scrollbar-hide snap-x snap-mandatory"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {coupons.map((coupon) => (
            <div key={coupon.id} className="snap-start">
              <CouponCard
                coupon={coupon}
                variant="carousel"
                onView={() => registerInteraction(coupon.id, 'view')}
                onClick={() => registerInteraction(coupon.id, 'click')}
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
