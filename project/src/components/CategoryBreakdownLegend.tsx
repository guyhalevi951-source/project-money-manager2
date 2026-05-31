import type { CategoryBreakdownSlice } from '../categories';
import CategoryIconBadge from './CategoryIconBadge';
import DisplayMoney from './DisplayMoney';
import { LocalizedUserText, LtrNumeric, useLanguage } from '../LanguageContext';

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
      <span className="text-neutral-300 font-medium">
        <LocalizedUserText text={item.value} />
      </span>
      <span className="text-neutral-500">: </span>
      <DisplayMoney amount={item.amount} className="text-neutral-100 font-semibold inline-block" />
      <span className="text-neutral-500 whitespace-nowrap">
        {' '}
        (<LtrNumeric>{item.percentage.toFixed(percentageDecimals)}%</LtrNumeric>)
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
  const { dir } = useLanguage();
  const visible = maxItems != null ? items.slice(0, maxItems) : items;

  if (layout === 'grid') {
    return (
      <div
        dir={dir}
        className="flex-1 w-full min-w-0 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4"
      >
        {visible.map((item) => (
          <div key={item.value} className="flex items-start gap-2 text-sm text-right min-w-0">
            <CategoryIconBadge icon={item.icon} hex={item.hex} colorClass={item.color} size="compact" />
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
          <CategoryIconBadge icon={item.icon} hex={item.hex} colorClass={item.color} size="compact" />
          <span className="text-neutral-300 truncate flex-1">
            <LocalizedUserText text={item.value} />
          </span>
          {percentageDecimals > 0 ? (
            <LtrNumeric className="text-neutral-400 font-medium shrink-0">
              {item.percentage.toFixed(percentageDecimals)}%
            </LtrNumeric>
          ) : (
            <DisplayMoney amount={item.amount} className="text-neutral-400 font-medium shrink-0 inline-block" />
          )}
        </div>
      ))}
    </div>
  );
}
