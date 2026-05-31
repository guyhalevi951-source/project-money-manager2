import type { LucideIcon } from 'lucide-react';
import { hexForColor } from '../categories';

interface CategoryColorChipProps {
  color: string;
  icon?: LucideIcon;
  children: React.ReactNode;
  className?: string;
}

export default function CategoryColorChip({
  color,
  icon: Icon,
  children,
  className = '',
}: CategoryColorChipProps) {
  return (
    <span
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium text-white ${className}`}
      style={{ backgroundColor: hexForColor(color) }}
    >
      {Icon && <Icon className="w-4 h-4 shrink-0" />}
      {children}
    </span>
  );
}
