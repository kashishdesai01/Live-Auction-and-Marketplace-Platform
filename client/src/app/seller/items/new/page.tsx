'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { useQuery } from '@tanstack/react-query';
import { Package, Image as ImageIcon, DollarSign, ArrowRight, ArrowLeft, UploadCloud, X } from 'lucide-react';

export default function NewListItemPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Form State
  const [form, setForm] = useState({
    title: '',
    description: '',
    category_id: '',
    condition: 'new',
    imageUrls: [] as string[],
    starting_price: '',
  });

  // Fetch Categories
  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const { data } = await api.get('/browse/categories');
      return data.categories || [];
    }
  });

  const handleNext = () => {
    setError('');
    if (step === 1 && (!form.title || !form.category_id)) {
      setError('Title and category are required.');
      return;
    }
    if (step === 2 && form.imageUrls.length === 0) {
      setError('At least one image is required.');
      return;
    }
    setStep(s => s + 1);
  };

  const handleBack = () => {
    setError('');
    setStep(s => s - 1);
  };

  const handleSubmit = async () => {
    if (!form.starting_price || isNaN(parseFloat(form.starting_price))) {
      setError('A valid starting price is required.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await api.post('/seller/items', {
        title: form.title,
        description: form.description,
        category_id: parseInt(form.category_id),
        condition: form.condition,
        image_urls: form.imageUrls,
        starting_price: parseFloat(form.starting_price)
      });
      router.push('/seller/items');
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to create listing.');
      setLoading(false);
    }
  };

  // Fake Image Upload (For local dev simulation)
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const file = e.target.files[0];
    if (file) {
      // Create a temporary object URL to preview locally
      const objectUrl = URL.createObjectURL(file);
      setForm(f => ({ ...f, imageUrls: [...f.imageUrls, objectUrl] }));
    }
  };

  const removeImage = (index: number) => {
    setForm(f => ({ ...f, imageUrls: f.imageUrls.filter((_, i) => i !== index) }));
  };

  const currentCategory = categories.find((c: any) => c.id === parseInt(form.category_id));
  const subCategories = currentCategory?.children || [];

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Create New Listing</h1>
        <p className="text-muted-foreground text-sm">Follow the steps below to list your item for auction.</p>
      </div>

      {/* Progress Bar */}
      <div className="flex items-center justify-between mb-8 relative">
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-white/10 rounded-full z-0" />
        <div 
          className="absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-primary rounded-full z-0 transition-all duration-500"
          style={{ width: `${((step - 1) / 2) * 100}%` }}
        />
        
        {[{ num: 1, label: 'Details', icon: Package }, { num: 2, label: 'Images', icon: ImageIcon }, { num: 3, label: 'Pricing', icon: DollarSign }].map(s => (
          <div key={s.num} className={`relative z-10 flex flex-col items-center gap-2 ${step >= s.num ? 'text-primary' : 'text-muted-foreground'}`}>
            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold border-2 transition-colors ${
              step >= s.num ? 'bg-primary text-primary-foreground border-primary' : 'bg-[#0f0f13] border-white/20'
            }`}>
              <s.icon className="w-5 h-5" />
            </div>
            <span className="text-xs font-medium">{s.label}</span>
          </div>
        ))}
      </div>

      <div className="glass-card rounded-2xl p-8 border border-white/10">
        {error && (
          <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 rounded-xl text-destructive text-sm font-medium">
            {error}
          </div>
        )}

        {/* STEP 1: Details */}
        {step === 1 && (
          <div className="space-y-6 animate-slide-up">
            <div>
              <label className="block text-sm font-medium mb-2">Item Title <span className="text-destructive">*</span></label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm(f => ({ ...f, title: e.target.value }))}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/25 transition-all"
                placeholder="e.g., 1st Edition Charizard PSA 10"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Category <span className="text-destructive">*</span></label>
                <select
                  value={form.category_id}
                  onChange={(e) => setForm(f => ({ ...f, category_id: e.target.value }))}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/25 transition-all appearance-none"
                >
                  <option value="">Select Category</option>
                  {categories.map((c: any) => (
                    <option key={c.id} value={c.id}>{c.icon_url} {c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Condition <span className="text-destructive">*</span></label>
                <select
                  value={form.condition}
                  onChange={(e) => setForm(f => ({ ...f, condition: e.target.value }))}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/25 transition-all appearance-none"
                >
                  <option value="new">Brand New</option>
                  <option value="like_new">Like New</option>
                  <option value="good">Good</option>
                  <option value="fair">Fair</option>
                  <option value="poor">Poor</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Description</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
                rows={5}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/25 transition-all resize-none"
                placeholder="Describe flaws, origin, and any important details..."
              />
            </div>
          </div>
        )}

        {/* STEP 2: Images */}
        {step === 2 && (
          <div className="space-y-6 animate-slide-up">
            <div className="border-2 border-dashed border-white/20 rounded-2xl p-8 text-center hover:border-primary/50 transition-colors bg-white/5">
              <UploadCloud className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-sm font-medium mb-1">Click to upload images</p>
              <p className="text-xs text-muted-foreground mb-4">PNG, JPG or WEBP (Max. 5MB)</p>
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
                id="file-upload"
              />
              <label 
                htmlFor="file-upload" 
                className="px-6 py-2.5 bg-primary/20 text-primary hover:bg-primary/30 text-sm font-medium rounded-xl cursor-pointer transition-colors inline-block"
              >
                Choose File
              </label>
            </div>

            {form.imageUrls.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6">
                {form.imageUrls.map((url, i) => (
                  <div key={i} className="relative aspect-square rounded-xl overflow-hidden group bg-muted border border-white/10">
                    <img src={url} alt={`Upload ${i+1}`} className="w-full h-full object-cover" />
                    <button 
                      onClick={() => removeImage(i)}
                      className="absolute top-2 right-2 p-1.5 bg-black/60 hover:bg-destructive text-white rounded-full opacity-0 group-hover:opacity-100 transition-all"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                    {i === 0 && (
                      <div className="absolute bottom-2 left-2 px-2 py-1 bg-black/80 text-[10px] font-bold text-white rounded-md">
                        COVER
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* STEP 3: Pricing */}
        {step === 3 && (
          <div className="space-y-6 animate-slide-up">
            <div>
              <label className="block text-sm font-medium mb-2">Starting Price (USD) <span className="text-destructive">*</span></label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <span className="text-muted-foreground font-medium">$</span>
                </div>
                <input
                  type="number"
                  value={form.starting_price}
                  onChange={(e) => setForm(f => ({ ...f, starting_price: e.target.value }))}
                  className="w-full pl-8 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/25 transition-all text-xl font-semibold"
                  placeholder="0.00"
                  min="0.01"
                  step="0.01"
                />
              </div>
              <p className="text-xs text-muted-foreground mt-2">Bidding will start at this exact price.</p>
            </div>
            
            <div className="bg-primary/10 border border-primary/20 p-5 rounded-xl">
              <h4 className="font-semibold text-primary mb-1">Ready to create item!</h4>
              <p className="text-sm text-primary/80">Once created, it will be added to your inventory as a Draft. You can schedule the live auction from your inventory page.</p>
            </div>
          </div>
        )}

        {/* Controls */}
        <div className="flex items-center justify-between mt-8 pt-6 border-t border-white/10">
          <button
            type="button"
            onClick={handleBack}
            disabled={step === 1 || loading}
            className="px-6 py-2.5 glass-card border flex items-center gap-2 border-white/10 text-sm font-medium rounded-xl hover:bg-white/5 transition-colors disabled:opacity-30"
          >
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
          
          {step < 3 ? (
            <button
              onClick={handleNext}
              className="px-6 py-2.5 bg-primary text-primary-foreground flex items-center gap-2 text-sm font-medium rounded-xl hover:bg-primary/90 transition-colors"
            >
              Continue <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="px-8 py-2.5 bg-primary text-primary-foreground text-sm font-semibold rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create Listing'}
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
