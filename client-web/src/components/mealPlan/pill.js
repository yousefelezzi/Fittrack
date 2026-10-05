/** Classes for a small toggle button, highlighted when active. */
export const pill = (active) => `px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
  active ? 'bg-brand-600 text-white border-brand-600'
    : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-300 dark:border-gray-600 hover:border-brand-400'}`;
