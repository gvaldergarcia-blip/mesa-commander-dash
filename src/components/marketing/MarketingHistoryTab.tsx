import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Download, Copy, Trash2, Image as ImageIcon } from 'lucide-react';
import { useMarketingPosts, MarketingPost } from '@/hooks/useMarketingPosts';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const TYPE_LABELS: Record<string, string> = {
  fila: 'Fila aberta',
  reserva: 'Reserva',
  promo: 'Promoção',
  destaque: 'Destaque',
  evento: 'Evento',
};

const FORMAT_LABELS: Record<string, string> = {
  square: '1080×1080',
  story: '1080×1920',
};

export function MarketingHistoryTab() {
  const { posts, isLoading, deletePost } = useMarketingPosts();

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardContent className="p-4 space-y-3">
              <Skeleton className="w-full aspect-square rounded-lg" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <ImageIcon className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
          <p className="text-muted-foreground">Nenhum post gerado ainda</p>
          <p className="text-sm text-muted-foreground">Vá para a aba "Gerar Post" para criar seu primeiro post</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {posts.map((post) => (
        <PostCard key={post.id} post={post} onDelete={deletePost} />
      ))}
    </div>
  );
}

function PostCard({ post, onDelete }: { post: MarketingPost; onDelete: (id: string) => void }) {
  return (
    <Card className="overflow-hidden group">
      {/* Thumbnail */}
      <div className={`relative bg-muted ${post.format === 'story' ? 'aspect-[9/16] max-h-[300px]' : 'aspect-square'} overflow-hidden`}>
        {post.image_url ? (
          <img
            src={post.image_url}
            alt={post.headline}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <ImageIcon className="h-8 w-8 text-muted-foreground/30" />
          </div>
        )}
        {/* Badge */}
        <div className="absolute top-2 left-2 flex gap-1">
          <span className="bg-primary/90 text-primary-foreground text-[10px] font-medium px-2 py-0.5 rounded-full">
            {TYPE_LABELS[post.type] || post.type}
          </span>
          <span className="bg-background/80 text-foreground text-[10px] font-medium px-2 py-0.5 rounded-full backdrop-blur-sm">
            {FORMAT_LABELS[post.format] || post.format}
          </span>
        </div>
      </div>

      <CardContent className="p-3 space-y-2">
        <p className="font-medium text-sm text-foreground truncate">{post.headline}</p>
        {post.subtext && (
          <p className="text-xs text-muted-foreground truncate">{post.subtext}</p>
        )}
        <p className="text-[10px] text-muted-foreground">
          {format(new Date(post.created_at), "dd MMM yyyy 'às' HH:mm", { locale: ptBR })}
        </p>

        <div className="flex gap-1.5 pt-1">
          {post.image_url && (
            <>
              <Button
                variant="outline"
                size="sm"
                className="flex-1 h-7 text-xs gap-1"
                onClick={() => {
                  const a = document.createElement('a');
                  a.href = post.image_url!;
                  a.download = `post_${post.type}_${post.format}.png`;
                  a.target = '_blank';
                  a.click();
                }}
              >
                <Download className="h-3 w-3" /> Baixar
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs gap-1"
                onClick={() => {
                  navigator.clipboard.writeText(post.image_url!);
                  toast.success('Link copiado!');
                }}
              >
                <Copy className="h-3 w-3" />
              </Button>
            </>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={() => onDelete(post.id)}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
