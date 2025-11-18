import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ActiveCoupon } from '@/hooks/useActiveCoupons';
import { ExternalLink, Calendar, MapPin, Utensils } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';

type CouponCardProps = {
  coupon: ActiveCoupon;
  onView: () => void;
  onClick: () => void;
  variant?: 'carousel' | 'grid';
};

export function CouponCard({ coupon, onView, onClick, variant = 'grid' }: CouponCardProps) {
  const daysUntilExpiry = differenceInDays(new Date(coupon.end_date), new Date());
  const isNew = differenceInDays(new Date(), new Date(coupon.created_at)) <= 1;
  const isUrgent = daysUntilExpiry <= 3;

  React.useEffect(() => {
    onView();
  }, []);

  const handleClick = () => {
    onClick();
    
    if (coupon.coupon_type === 'link' && coupon.coupon_link) {
      window.open(coupon.coupon_link, '_blank');
    } else if (coupon.file_url) {
      window.open(coupon.file_url, '_blank');
    }
  };

  return (
    <Card 
      className={`
        overflow-hidden transition-all duration-300 hover:shadow-xl hover:scale-[1.02] cursor-pointer
        ${variant === 'carousel' ? 'min-w-[280px] max-w-[280px]' : ''}
        ${isUrgent ? 'ring-2 ring-warning' : ''}
      `}
      onClick={handleClick}
    >
      {/* Imagem do Restaurante */}
      <div className="relative h-40 bg-gradient-to-br from-primary/10 to-primary/5 overflow-hidden">
        {coupon.restaurant?.image_url ? (
          <img 
            src={coupon.restaurant.image_url} 
            alt={coupon.restaurant.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Utensils className="w-16 h-16 text-muted-foreground/20" />
          </div>
        )}
        
        {/* Badges */}
        <div className="absolute top-2 left-2 flex gap-2">
          {isNew && (
            <Badge className="bg-success text-white shadow-lg">
              🔥 NOVO
            </Badge>
          )}
          {isUrgent && (
            <Badge className="bg-warning text-white shadow-lg animate-pulse">
              ⏰ Expira em {daysUntilExpiry}d
            </Badge>
          )}
        </div>
      </div>

      {/* Conteúdo */}
      <div className="p-4 space-y-3">
        {/* Nome do Restaurante */}
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden flex-shrink-0">
            {coupon.restaurant?.image_url ? (
              <img 
                src={coupon.restaurant.image_url} 
                alt=""
                className="w-full h-full object-cover"
              />
            ) : (
              <Utensils className="w-5 h-5 text-primary" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm truncate">
              {coupon.restaurant?.name || 'Restaurante'}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {coupon.restaurant?.cuisine || 'Gastronomia'}
            </p>
          </div>
        </div>

        {/* Título do Cupom */}
        <div>
          <h3 className="font-bold text-lg leading-tight line-clamp-2">
            {coupon.title}
          </h3>
          {coupon.description && (
            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
              {coupon.description}
            </p>
          )}
        </div>

        {/* Informações Adicionais */}
        <div className="space-y-1 text-xs text-muted-foreground">
          {coupon.restaurant?.city && (
            <div className="flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              <span className="truncate">{coupon.restaurant.city}</span>
            </div>
          )}
          <div className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            <span>
              Válido até {format(new Date(coupon.end_date), "dd/MM/yyyy", { locale: ptBR })}
            </span>
          </div>
        </div>

        {/* Botão */}
        <Button 
          className="w-full h-11 text-base font-bold"
          onClick={(e) => {
            e.stopPropagation();
            handleClick();
          }}
        >
          <ExternalLink className="w-4 h-4 mr-2" />
          Usar Cupom
        </Button>
      </div>
    </Card>
  );
}
