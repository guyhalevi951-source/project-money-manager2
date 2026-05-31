interface SubBudgetProgressBarProps {
  allocated: number;
  spent: number;
  usedColor: string;
  remainingColor: string;
  overspent?: boolean;
}

export default function SubBudgetProgressBar({
  allocated,
  spent,
  usedColor,
  remainingColor,
  overspent = false,
}: SubBudgetProgressBarProps) {
  const spentRatio =
    allocated > 0 ? Math.min(100, (spent / allocated) * 100) : spent > 0 ? 100 : 0;
  const spentWidth = overspent ? 100 : Math.max(spent > 0 ? 3 : 0, Math.min(100, spentRatio));
  const remainingWidth = overspent ? 0 : Math.max(0, 100 - spentWidth);

  const showUsed = spentWidth > 0;
  const showRemaining = remainingWidth > 0;

  return (
    <div className="h-2.5 rounded-full bg-neutral-800 overflow-hidden">
      <div className="h-full flex">
        {showUsed && (
          <div
            className="h-full shrink-0"
            style={{ width: `${spentWidth}%`, backgroundColor: usedColor }}
          />
        )}
        {showRemaining && (
          <div className="h-full flex-1" style={{ backgroundColor: remainingColor }} />
        )}
      </div>
    </div>
  );
}
