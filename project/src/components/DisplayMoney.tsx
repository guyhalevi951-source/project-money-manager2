import { useLanguage, LtrNumeric } from '../LanguageContext';

interface DisplayMoneyProps {
  /** Stored ledger amount in ILS. */
  amount: number;
  className?: string;
}

export default function DisplayMoney({ amount, className = '' }: DisplayMoneyProps) {
  const { formatMoney } = useLanguage();

  return (
    <LtrNumeric className={`whitespace-nowrap ${className}`.trim()}>{formatMoney(amount)}</LtrNumeric>
  );
}
