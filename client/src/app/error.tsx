'use client';

import { useEffect } from 'react';
import { AlertCircle, RefreshCcw, Home } from 'lucide-react';
import Link from 'next/link';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error('Global Application Error:', error);
  }, [error]);

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center px-4 text-center">
      <div className="w-16 h-16 bg-destructive/20 text-destructive rounded-full flex items-center justify-center mb-6">
        <AlertCircle className="w-8 h-8" />
      </div>
      
      <h1 className="text-3xl font-bold mb-3 tracking-tight">Something went wrong!</h1>
      <p className="text-muted-foreground max-w-md mx-auto mb-8 leading-relaxed">
        We encountered an unexpected issue while loading this page. Our team has been notified.
      </p>

      <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
        <button
          onClick={() => reset()}
          className="flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground font-semibold rounded-xl hover:bg-primary/90 transition-colors w-full sm:w-auto justify-center shadow-[0_0_20px_rgba(124,58,237,0.3)]"
        >
          <RefreshCcw className="w-4 h-4" /> Try Again
        </button>
        <Link
          href="/"
          className="flex items-center gap-2 px-6 py-3 bg-white/5 border border-white/10 text-foreground font-semibold rounded-xl hover:bg-white/10 transition-colors w-full sm:w-auto justify-center"
        >
          <Home className="w-4 h-4" /> View Homepage
        </Link>
      </div>
      
      {/* Optional: Show technically helpful error details in development, hidden in prod */}
      {process.env.NODE_ENV === 'development' && (
        <div className="mt-12 text-left bg-white/5 border border-white/10 p-4 rounded-xl max-w-2xl w-full overflow-x-auto">
          <p className="text-xs font-mono text-destructive mb-2 font-bold">DEVELOPMENT ERROR DETAILS:</p>
          <p className="text-xs font-mono text-muted-foreground whitespace-pre-wrap">{error.message}</p>
          {error.stack && (
            <pre className="text-[10px] font-mono text-muted-foreground/70 mt-4 leading-relaxed whitespace-pre-wrap">
              {error.stack}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
