'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import api from '@/lib/api';
import { CheckCircle2, ArrowRight, Sparkles } from 'lucide-react';

const CATEGORY_COLORS = [
  'from-violet-500/20 to-purple-500/10 border-violet-500/30 hover:border-violet-400/60',
  'from-blue-500/20 to-cyan-500/10 border-blue-500/30 hover:border-blue-400/60',
  'from-emerald-500/20 to-teal-500/10 border-emerald-500/30 hover:border-emerald-400/60',
  'from-amber-500/20 to-orange-500/10 border-amber-500/30 hover:border-amber-400/60',
  'from-pink-500/20 to-rose-500/10 border-pink-500/30 hover:border-pink-400/60',
  'from-indigo-500/20 to-blue-500/10 border-indigo-500/30 hover:border-indigo-400/60',
  'from-teal-500/20 to-cyan-500/10 border-teal-500/30 hover:border-teal-400/60',
  'from-orange-500/20 to-red-500/10 border-orange-500/30 hover:border-orange-400/60',
];

export default function BuyerOnboardingPage() {
  const router = useRouter();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const { data: categories = [], isLoading } = useQuery({
    queryKey: ['categories-tree'],
    queryFn: async () => {
      const { data } = await api.get('/categories');
      return data.categories;
    },
  });

  const { mutate: saveInterests, isPending } = useMutation({
    mutationFn: async (ids: string[]) => {
      await api.patch('/buyer/interests', { category_ids: ids });
    },
    onSuccess: () => {
      router.push('/feed');
    },
  });

  const toggle = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-start px-4 py-12 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/10 via-background to-background">
      {/* Header */}
      <div className="text-center max-w-xl mb-12">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium mb-6">
          <Sparkles className="w-4 h-4" /> Personalize your feed
        </div>
        <h1 className="text-4xl font-bold mb-4 tracking-tight">
          What are you into?
        </h1>
        <p className="text-muted-foreground text-lg">
          Pick the categories you love and we'll surface the best auctions for you. You can change this anytime.
        </p>
      </div>

      {/* Categories Grid */}
      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 w-full max-w-4xl">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-32 rounded-2xl bg-white/5 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 w-full max-w-4xl">
          {categories.map((cat: any, i: number) => {
            const isSelected = selectedIds.includes(cat.id);
            const colorClass = CATEGORY_COLORS[i % CATEGORY_COLORS.length];
            return (
              <button
                key={cat.id}
                onClick={() => toggle(cat.id)}
                className={`relative group text-left p-5 rounded-2xl border bg-gradient-to-br transition-all duration-200 cursor-pointer ${colorClass} ${
                  isSelected
                    ? 'ring-2 ring-primary ring-offset-2 ring-offset-background scale-[1.02]'
                    : 'hover:scale-[1.01]'
                }`}
              >
                <div className="text-3xl mb-3">{cat.icon_url}</div>
                <h3 className="font-semibold text-foreground text-sm leading-tight">{cat.name}</h3>
                {cat.children && (
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                    {cat.children.slice(0, 3).map((c: any) => c.name).join(', ')}
                  </p>
                )}
                {isSelected && (
                  <div className="absolute top-3 right-3">
                    <CheckCircle2 className="w-5 h-5 text-primary fill-primary/20" />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* CTA */}
      <div className="mt-12 flex flex-col items-center gap-3">
        <button
          onClick={() => saveInterests(selectedIds)}
          disabled={isPending}
          className="flex items-center gap-2 px-8 py-3.5 bg-primary text-primary-foreground font-semibold rounded-2xl hover:bg-primary/90 transition-all disabled:opacity-60 shadow-[0_0_30px_rgba(124,58,237,0.4)] hover:shadow-[0_0_40px_rgba(124,58,237,0.6)] text-base"
        >
          {isPending ? 'Saving...' : selectedIds.length === 0 ? 'Skip for now' : `Explore ${selectedIds.length} categor${selectedIds.length === 1 ? 'y' : 'ies'}`}
          <ArrowRight className="w-5 h-5" />
        </button>
        {selectedIds.length > 0 && (
          <button
            onClick={() => saveInterests([])}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Skip for now
          </button>
        )}
      </div>
    </div>
  );
}
