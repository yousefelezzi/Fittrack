import { useState } from 'react';
import { Dumbbell } from 'lucide-react';

/**
 * Photo of an exercise. `images` are the start and end positions; with
 * `both`, they're shown side by side (start → end), otherwise just the start.
 * Falls back to an icon when there's no photo (e.g. custom exercises).
 */
export default function ExerciseImage({ images = [], name = '', both = false, className = '' }) {
  const [failed, setFailed] = useState(false);
  const list = (both ? images.slice(0, 2) : images.slice(0, 1)).filter(Boolean);

  if (!list.length || failed) {
    return (
      <div className={`flex items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-300 dark:text-gray-600 ${className}`}>
        <Dumbbell size={18} />
      </div>
    );
  }
  return (
    <div className={`flex gap-1.5 ${both ? '' : ''} ${className}`}>
      {list.map((src, i) => (
        <img key={src} src={src} loading="lazy" onError={() => setFailed(true)}
          alt={`${name}${both ? (i === 0 ? ' — start' : ' — end') : ''}`}
          className="flex-1 min-w-0 h-full w-full object-cover rounded-lg bg-gray-100 dark:bg-gray-800" />
      ))}
    </div>
  );
}
