import { useState } from 'react';
import { Star } from 'lucide-react';

/** "★ 4.3 (12)" for an exercise's ratings, or "No ratings yet". */
export function RatingSummary({ rating, className = '' }) {
  if (!rating?.count) return <span className={`text-xs text-gray-400 dark:text-gray-500 ${className}`}>No ratings yet</span>;
  return (
    <span className={`inline-flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 ${className}`}>
      <Star size={12} className="fill-amber-400 text-amber-400" />
      <span className="font-semibold text-gray-700 dark:text-gray-300">{rating.avg.toFixed(1)}</span>
      <span>({rating.count})</span>
    </span>
  );
}

/** Five stars to rate with; clicking your current rating again takes it back (onChange(0)). */
export default function StarRating({ value = 0, onChange, size = 20, disabled }) {
  const [hover, setHover] = useState(0);
  const shown = hover || value || 0;
  return (
    <div className="inline-flex items-center gap-0.5" onMouseLeave={() => setHover(0)}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" disabled={disabled} onMouseEnter={() => setHover(n)}
          onClick={(e) => { e.stopPropagation(); onChange(n === value ? 0 : n); }}
          aria-label={n === value ? `Remove your ${n}-star rating` : `Rate ${n} star${n > 1 ? 's' : ''}`}
          className="p-0.5 disabled:opacity-50">
          <Star size={size} className={n <= shown ? 'fill-amber-400 text-amber-400' : 'text-gray-300 dark:text-gray-600'} />
        </button>
      ))}
    </div>
  );
}
