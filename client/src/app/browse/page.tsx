'use client';

import { Suspense } from 'react';
import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { AuctionCard } from '@/components/AuctionCard';
import { Search, ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

const CONDITIONS = ['new', 'like_new', 'good', 'fair', 'poor'];
const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest' },
  { value: 'price_asc', label: 'Price: Low → High' },
  { value: 'price_desc', label: 'Price: High → Low' },
];

function BrowseContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [search, setSearch] = useState(searchParams.get('q') || '');
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  const [condition, setCondition] = useState(searchParams.get('condition') || '');
  const [sort, setSort] = useState(searchParams.get('sort') || 'newest');
  const [expandedCat, setExpandedCat] = useState<number | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  const { data: catData } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const { data } = await api.get('/browse/categories');
      return data.categories;
    },
    staleTime: Infinity,
  });

  const categoryId = searchParams.get('category_id') || '';

  const { data, isLoading } = useQuery({
    queryKey: ['browse', debouncedSearch, condition, sort, categoryId],
    queryFn: async () => {
      const params: any = { sort };
      if (debouncedSearch) params.q = debouncedSearch;
      if (condition) params.condition = condition;
      if (categoryId) params.category_id = categoryId;
      const { data } = await api.get('/browse', { params });
      return data.items;
    },
  });

  const setFilter = useCallback((key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    router.replace(`/browse?${params.toString()}`, { scroll: false });
  }, [searchParams, router]);

  return (
    <div className="flex gap-8">
      {/* Sidebar */}
      <aside className="hidden lg:block w-64 flex-shrink-0">
        <div className="glass-card rounded-2xl p-5 sticky top-24">
          <h2 className="font-semibold mb-4 text-sm">Categories</h2>
          <div className="space-y-1">
            <button
              onClick={() => setFilter('category_id', '')}
              className={cn('w-full text-left px-3 py-2 rounded-lg text-sm transition-colors', !categoryId ? 'bg-primary/10 text-primary' : 'hover:bg-white/5 text-muted-foreground')}
            >
              All Categories
            </button>
            {catData?.map((cat: any) => (
              <div key={cat.id}>
                <button
                  onClick={() => { setExpandedCat(expandedCat === cat.id ? null : cat.id); setFilter('category_id', cat.id); }}
                  className={cn('w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center justify-between', String(categoryId) === String(cat.id) ? 'bg-primary/10 text-primary' : 'hover:bg-white/5 text-muted-foreground')}
                >
                  <span>{cat.icon_url} {cat.name}</span>
                  {cat.children?.length > 0 && (
                    expandedCat === cat.id ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />
                  )}
                </button>
                {expandedCat === cat.id && cat.children?.map((child: any) => (
                  <button
                    key={child.id}
                    onClick={() => setFilter('category_id', child.id)}
                    className={cn('w-full text-left pl-8 pr-3 py-1.5 rounded-lg text-xs transition-colors', String(categoryId) === String(child.id) ? 'text-primary' : 'text-muted-foreground hover:text-foreground')}
                  >
                    {child.name}
                  </button>
                ))}
              </div>
            ))}
          </div>

          <div className="mt-6">
            <h3 className="font-semibold mb-3 text-sm">Condition</h3>
            <div className="space-y-1">
              <button onClick={() => setFilter('condition', '')} className={cn('w-full text-left px-3 py-1.5 rounded-lg text-sm transition-colors', !condition ? 'text-primary' : 'text-muted-foreground hover:text-foreground')}>Any</button>
              {CONDITIONS.map(c => (
                <button key={c} onClick={() => setFilter('condition', c)} className={cn('w-full text-left px-3 py-1.5 rounded-lg text-sm capitalize transition-colors', condition === c ? 'text-primary' : 'text-muted-foreground hover:text-foreground')}>
                  {c.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1">
        <div className="flex gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search auctions..."
              className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm focus:outline-none focus:border-primary/50 transition-all"
            />
          </div>
          <select
            value={sort}
            onChange={(e) => { setSort(e.target.value); setFilter('sort', e.target.value); }}
            className="px-4 py-2.5 glass-card border border-white/10 rounded-xl text-sm bg-transparent focus:outline-none"
          >
            {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="glass-card rounded-2xl overflow-hidden animate-pulse">
                <div className="aspect-[4/3] bg-white/5" />
                <div className="p-4 space-y-2">
                  <div className="h-4 bg-white/5 rounded w-3/4" />
                  <div className="h-6 bg-white/5 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : data?.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <p className="text-lg">No auctions found</p>
            <p className="text-sm mt-1">Try adjusting your filters</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
            {data?.map((item: any) => <AuctionCard key={item.auction_id || item.id} auction={{ ...item, id: item.auction_id }} />)}
          </div>
        )}
      </div>
    </div>
  );
}

export default function BrowsePage() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Suspense fallback={
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="glass-card rounded-2xl overflow-hidden animate-pulse">
              <div className="aspect-[4/3] bg-white/5" />
              <div className="p-4 space-y-2">
                <div className="h-4 bg-white/5 rounded w-3/4" />
                <div className="h-6 bg-white/5 rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      }>
        <BrowseContent />
      </Suspense>
    </div>
  );
}
