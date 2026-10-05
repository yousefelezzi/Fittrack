/**
 * Full-page and inline spinner variants.
 *
 * Usage:
 *   <Spinner />            — centered in its container
 *   <Spinner inline />     — inline 16px spinner for buttons
 */
export default function Spinner({ inline = false }) {
  if (inline) {
    return (
      <span className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
    );
  }
  return (
    <div className="flex justify-center py-20">
      <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}