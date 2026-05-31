import type { LucideIcon } from 'lucide-react';
import { hexForColor } from '../categories';

type BadgeSize = 'compact' | 'default' | 'large';

const SIZE_CLASSES: Record<BadgeSize, { box: string; icon: string; rounded: string }> = {
  compact: { box: 'w-8 h-8', icon: 'w-4 h-4', rounded: 'rounded-lg' },
  default: { box: 'w-11 h-11', icon: 'w-5 h-5', rounded: 'rounded-xl' },
  large: { box: 'w-12 h-12', icon: 'w-6 h-6', rounded: 'rounded-full' },
};

interface CategoryIconBadgeProps {
  icon: LucideIcon;
  colorClass?: string;
  /** Resolved slice hex (e.g. collision-adjusted); takes precedence over colorClass. */
  hex?: string;
  size?: BadgeSize;
  className?: string;
}

/** Colored icon badge matching expense history list styling. */
export default function CategoryIconBadge({
  icon: Icon,
  colorClass = 'bg-gray-500',
  hex,
  size = 'default',
  className = '',
}: CategoryIconBadgeProps) {
  const s = SIZE_CLASSES[size];
  const backgroundColor = hex ?? hexForColor(colorClass);

  return (
    <div
      className={`shrink-0 flex items-center justify-center text-white ${s.box} ${s.rounded} ${className}`}
      style={{ backgroundColor }}
      aria-hidden
    >
      <Icon className={s.icon} />
    </div>
  );
}
