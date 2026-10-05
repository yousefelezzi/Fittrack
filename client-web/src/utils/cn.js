/**
 * Minimal className joiner — no dependency on clsx or tailwind-merge.
 * Filters out falsy values so conditional classes stay clean.
 *
 * Usage:
 *   cn('btn', isActive && 'btn-primary', className)
 */
export function cn(...classes) {
  return classes.filter(Boolean).join(' ');
}