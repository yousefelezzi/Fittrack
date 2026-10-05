import { Inbox } from 'lucide-react';
/**
 * Generic empty-state placeholder used across list views.
 *
 * Props:
 *   icon     — React node (e.g. a lucide icon)
 *   title    — main message (required)
 *   subtitle — secondary text or JSX (optional)
 *   action   — JSX for a CTA button (optional)
 */
export default function EmptyState({ icon = <Inbox size={36} strokeWidth={1.5} />, title, subtitle, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="mb-3 text-gray-300 dark:text-gray-600">{icon}</div>
      <p className="text-gray-700 font-medium mb-1">{title}</p>
      {subtitle && <p className="text-sm text-gray-400 mb-4">{subtitle}</p>}
      {action}
    </div>
  );
}