import type { CategoryBreakdownSlice } from '../categories';
import CategoryIconBadge from './CategoryIconBadge';

interface CategoryBreakdownLegendProps {
  items: CategoryBreakdownSlice[];
  layout?: 'grid' | 'list';
  maxItems?: number;
  percentageDecimals?: number;
}

function LegendLine({
  item,
  percentageDecimals,
}: {
  item: CategoryBreakdownSlice;
  percentageDecimals: number;
}) {
  return (
    <p className="min-w-0 leading-snug">
      <span className="text-neutral-300 font-medium">{item.label}</span>
      <span className="text-neutral-500">: </span>
      <span className="text-neutral-100 font-semibold tabular-nums whitespace-nowrap">
        ₪{item.amount.toLocaleString()}
      </span>
      <span className="text-neutral-500 tabular-nums whitespace-nowrap">
        {' '}
        ({item.percentage.toFixed(percentageDecimals)}%)
      </span>
    </p>
  );
}

export default function CategoryBreakdownLegend({
  items,
  layout = 'grid',
  maxItems,
  percentageDecimals = 0,
}: CategoryBreakdownLegendProps) {
  const visible = maxItems != null ? items.slice(0, maxItems) : items;

  if (layout === 'grid') {
    return (
      <div
        dir="rtl"
        className="flex-1 w-full min-w-0 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4"
      >
        {visible.map((item) => (
          <div key={item.value} className="flex items-start gap-2 text-sm text-right min-w-0">
            <CategoryIconBadge icon={item.icon} colorClass={item.color} size="compact" />
            <LegendLine item={item} percentageDecimals={percentageDecimals} />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex-1 min-w-0 space-y-3">
      {visible.map((item) => (
        <div key={item.value} className="flex items-center gap-2.5 text-sm">
          <CategoryIconBadge icon={item.icon} colorClass={item.color} size="compact" />
          <span className="text-neutral-300 truncate flex-1">{item.label}</span>
          <span className="text-neutral-400 font-medium shrink-0 tabular-nums">
            {percentageDecimals > 0
              ? `${item.percentage.toFixed(percentageDecimals)}%`
              : `₪${item.amount.toLocaleString()}`}
          </span>
        </div>
      ))}
    </div>
  );
}
