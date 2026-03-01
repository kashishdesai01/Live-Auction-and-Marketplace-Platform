'use client';

import { useEffect, useState, useCallback, useTransition, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { AuctionCard } from '@/components/AuctionCard';
import { Search, SlidersHorizontal, X, ChevronDown, Loader2 } from 'lucide-react';

const CONDITIONS = ['new', 'like_new', 'good', 'fair', 'poor'];
const SORTS = [
  { value: 'ending_soon', label: 'Ending Soon' },
  { value: 'newest', label: 'Newest First' },
  { value: 'price_asc', label: 'Price: Low to High' },
  { value: 'price_desc', label: 'Price: High to Low' },
  { value: 'most_bids', label: 'Most Bids' },
];

function SearchPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  // Read from URL
  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [debouncedQuery, setDebouncedQuery] = useState(query);
  const [categoryId, setCategoryId] = useState(searchParams.get('category_id') || '');
  const [condition, setCondition] = useState(searchParams.get('condition') || '');
  const [priceMin, setPriceMin] = useState(searchParams.get('price_min') || '');
  const [priceMax, setPriceMax] = useState(searchParams.get('price_max') || '');
  const [sort, setSort] = useState(searchParams.get('sort') || 'ending_soon');
  const [page, setPage] = useState(parseInt(searchParams.get('page') || '1'));

  // Debounce the search query
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 400);
    return () => clearTimeout(timer);
  }, [query]);

  // Sync state → URL
  useEffect(() => {
    startTransition(() => {
      const params = new URLSearchParams();
      if (debouncedQuery) params.set('q', debouncedQuery);
      if (categoryId) params.set('category_id', categoryId);
      if (condition) params.set('condition', condition);
      if (priceMin) params.set('price_min', priceMin);
      if (priceMax) params.set('price_max', priceMax);
      if (sort && sort !== 'ending_soon') params.set('sort', sort);
      if (page > 1) params.set('page', String(page));
      router.replace(`/search?${params.toString()}`, { scroll: false });
    });
  }, [debouncedQuery, categoryId, condition, priceMin, priceMax, sort, page]);

  // Fetch categories for filter sidebar
  const { data: categoriesData } = useQuery({
    queryKey: ['categories-tree'],
    queryFn: async () => {
      const { data } = await api.get('/categories');
      return data.categories;
    },
    staleTime: Infinity,
  });

  // Fetch search results
  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['search', debouncedQuery, categoryId, condition, priceMin, priceMax, sort, page],
    queryFn: async () => {
      const params: Record<string, string> = { page: String(page), sort };
      if (debouncedQuery) params.q = debouncedQuery;
      if (categoryId) params.category_id = categoryId;
      if (condition) params.condition = condition;
      if (priceMin) params.price_min = priceMin;
      if (priceMax) params.price_max = priceMax;
      const { data } = await api.get('/browse', { params });
      return data;
    },
    placeholderData: (prev) => prev,
  });

  const results = data?.items || [];
  const totalPages = data?.total_pages || 1;
  const totalCount = data?.total || results.length;

  const clearFilters = () => {
    setCategoryId('');
    setCondition('');
    setPriceMin('');
    setPriceMax('');
    setSort('ending_soon');
    setPage(1);
  };
  const hasActiveFilters = !!(categoryId || condition || priceMin || priceMax || sort !== 'ending_soon');

  const Filters = () => (
    <div className="space-y-6">
      {/* Sort */}
      <div>
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Sort By</h3>
        <div className="space-y-1.5">
          {SORTS.map(s => (
            <button
              key={s.value}
              onClick={() => { setSort(s.value); setPage(1); }}
              className={`w-full text-left text-sm px-3 py-2 rounded-lg transition-colors ${
                sort === s.value 
                  ? 'bg-primary/10 text-primary font-medium' 
                  : 'hover:bg-white/5 text-muted-foreground hover:text-foreground'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Category */}
      <div>
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Category</h3>
        <div className="space-y-1.5">
          <button
            onClick={() => { setCategoryId(''); setPage(1); }}
            className={`w-full text-left text-sm px-3 py-2 rounded-lg transition-colors ${
              !categoryId ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-white/5 text-muted-foreground hover:text-foreground'
            }`}
          >
            All Categories
          </button>
          {(categoriesData || []).map((cat: any) => (
            <button
              key={cat.id}
              onClick={() => { setCategoryId(cat.id); setPage(1); }}
              className={`w-full text-left text-sm px-3 py-2 rounded-lg transition-colors flex items-center gap-2 ${
                categoryId === cat.id 
                  ? 'bg-primary/10 text-primary font-medium' 
                  : 'hover:bg-white/5 text-muted-foreground hover:text-foreground'
              }`}
            >
              <span>{cat.icon_url}</span>
              <span>{cat.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Condition */}
      <div>
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Condition</h3>
        <div className="space-y-1.5">
          {CONDITIONS.map(c => (
            <button
              key={c}
              onClick={() => { setCondition(condition === c ? '' : c); setPage(1); }}
              className={`w-full text-left text-sm px-3 py-2 rounded-lg capitalize transition-colors ${
                condition === c 
                  ? 'bg-primary/10 text-primary font-medium' 
                  : 'hover:bg-white/5 text-muted-foreground hover:text-foreground'
              }`}
            >
              {c.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Price Range */}
      <div>
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Price Range</h3>
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">$</span>
            <input
              type="number"
              value={priceMin}
              onChange={e => { setPriceMin(e.target.value); setPage(1); }}
              placeholder="Min"
              className="w-full pl-6 pr-2 py-2 bg-white/5 border border-white/10 rounded-lg text-sm focus:outline-none focus:border-primary/50 transition-all"
            />
          </div>
          <span className="text-muted-foreground text-xs">to</span>
          <div className="relative flex-1">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">$</span>
            <input
              type="number"
              value={priceMax}
              onChange={e => { setPriceMax(e.target.value); setPage(1); }}
              placeholder="Max"
              className="w-full pl-6 pr-2 py-2 bg-white/5 border border-white/10 rounded-lg text-sm focus:outline-none focus:border-primary/50 transition-all"
            />
          </div>
        </div>
      </div>

      {hasActiveFilters && (
        <button
          onClick={clearFilters}
          className="w-full text-sm text-destructive hover:text-destructive/80 flex items-center justify-center gap-1.5 py-2 rounded-lg hover:bg-destructive/10 transition-colors border border-destructive/20"
        >
          <X className="w-3.5 h-3.5" /> Clear All Filters
        </button>
      )}
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Search Header */}
      <div className="mb-8">
        <div className="relative max-w-2xl">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <input
            type="text"
            value={query}
            onChange={e => { setQuery(e.target.value); setPage(1); }}
            placeholder="Search auctions, collectibles, electronics..."
            autoFocus
            className="w-full pl-12 pr-12 py-4 bg-white/5 border border-white/10 rounded-2xl text-base focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-muted-foreground/60"
          />
          {(query || isFetching) && (
            <div className="absolute right-4 top-1/2 -translate-y-1/2">
              {isFetching ? (
                <Loader2 className="w-4 h-4 text-primary animate-spin" />
              ) : (
                <button onClick={() => setQuery('')} className="text-muted-foreground hover:text-foreground transition-colors">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center justify-between mt-3">
          <p className="text-sm text-muted-foreground">
            {isLoading ? 'Searching...' : (
              debouncedQuery
                ? <><span className="font-medium text-foreground">{totalCount}</span> results for "<span className="text-primary">{debouncedQuery}</span>"</>
                : <><span className="font-medium text-foreground">{totalCount}</span> active auctions</>
            )}
          </p>
          <button
            onClick={() => setMobileFiltersOpen(!mobileFiltersOpen)}
            className="md:hidden flex items-center gap-2 text-sm font-medium px-3 py-1.5 glass-card rounded-lg border border-white/10"
          >
            <SlidersHorizontal className="w-4 h-4" />
            Filters {hasActiveFilters && <span className="w-1.5 h-1.5 rounded-full bg-primary" />}
          </button>
        </div>
      </div>

      <div className="flex gap-8">
        {/* Desktop Sidebar */}
        <aside className="hidden md:block w-56 flex-shrink-0">
          <div className="glass-card rounded-2xl border border-white/5 p-5 sticky top-24">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-semibold text-sm flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-primary" /> Filters
              </h2>
              {hasActiveFilters && (
                <button onClick={clearFilters} className="text-xs text-primary hover:underline">Clear</button>
              )}
            </div>
            <Filters />
          </div>
        </aside>

        {/* Mobile Filters Drawer */}
        {mobileFiltersOpen && (
          <div className="fixed inset-0 z-50 md:hidden">
            <div className="absolute inset-0 bg-black/60" onClick={() => setMobileFiltersOpen(false)} />
            <div className="absolute right-0 top-0 bottom-0 w-72 glass-card border-l border-white/10 p-6 overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <h2 className="font-semibold">Filters</h2>
                <button onClick={() => setMobileFiltersOpen(false)}>
                  <X className="w-5 h-5" />
                </button>
              </div>
              <Filters />
            </div>
          </div>
        )}

        {/* Results Grid */}
        <div className="flex-1 min-w-0">
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="glass-card rounded-2xl animate-pulse overflow-hidden border border-white/5">
                  <div className="w-full h-48 bg-white/5" />
                  <div className="p-4 space-y-3">
                    <div className="h-4 bg-white/5 rounded w-3/4" />
                    <div className="h-4 bg-white/5 rounded w-1/2" />
                    <div className="h-6 bg-white/5 rounded w-1/3" />
                  </div>
                </div>
              ))}
            </div>
          ) : results.length === 0 ? (
            <div className="glass-card rounded-2xl border border-white/5 py-20 text-center">
              <Search className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No results found</h3>
              <p className="text-muted-foreground text-sm max-w-sm mx-auto">
                {debouncedQuery
                  ? `We couldn't find anything matching "${debouncedQuery}". Try different keywords or remove some filters.`
                  : 'No auctions match these filters. Try adjusting your search.'}
              </p>
              {hasActiveFilters && (
                <button onClick={clearFilters} className="mt-4 text-sm text-primary hover:underline">
                  Clear all filters
                </button>
              )}
            </div>
          ) : (
            <>
              <div className={`grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5 transition-opacity ${isFetching ? 'opacity-60' : 'opacity-100'}`}>
                {results.map((auction: any) => (
                  <AuctionCard key={auction.id} auction={auction} />
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-10">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-4 py-2 glass-card rounded-lg text-sm hover:bg-white/5 disabled:opacity-40 transition-all"
                  >
                    ← Prev
                  </button>
                  {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => i + 1).map(p => (
                    <button
                      key={p}
                      onClick={() => setPage(p)}
                      className={`w-9 h-9 rounded-lg text-sm transition-all ${
                        p === page
                          ? 'bg-primary text-primary-foreground shadow-[0_0_15px_rgba(124,58,237,0.4)]'
                          : 'glass-card hover:bg-white/10'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="px-4 py-2 glass-card rounded-lg text-sm hover:bg-white/5 disabled:opacity-40 transition-all"
                  >
                    Next →
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense>
      <SearchPageContent />
    </Suspense>
  );
}
