/**
 * User avatar: shows the photo when available, falls back to an initial badge.
 *
 * Props:
 *   user   — object with { name, avatar }
 *   size   — 'xs' | 'sm' | 'md' | 'lg' | 'xl'   (default 'sm')
 *   className — extra classes merged onto the root element
 */
const SIZE = {
  xs: 'w-6  h-6  text-[10px]',
  sm: 'w-8  h-8  text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-16 h-16 text-xl',
  xl: 'w-24 h-24 text-3xl',
};

export default function Avatar({ user, size = 'sm', className = '' }) {
  const dim = SIZE[size] ?? SIZE.sm;
  const initial = user?.name?.[0]?.toUpperCase() ?? '?';

  if (user?.avatar) {
    return (
      <img
        src={user.avatar}
        alt=""
        className={`${dim} rounded-full object-cover shrink-0 ${className}`}
      />
    );
  }

  return (
    <div
      className={`${dim} rounded-full bg-brand-100 flex items-center justify-center text-brand-700 font-bold shrink-0 ${className}`}
    >
      {initial}
    </div>
  );
}