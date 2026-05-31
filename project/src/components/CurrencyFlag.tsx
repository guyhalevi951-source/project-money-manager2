import { useCallback, useEffect, useState } from 'react';
import { Globe } from 'lucide-react';

export type CurrencyFlagSize = 'xs' | 'sm' | 'md' | 'lg';

const SIZE_CLASSES: Record<CurrencyFlagSize, string> = {
  xs: 'w-4 h-3 rounded-[2px]',
  sm: 'w-5 h-[15px] rounded-[3px]',
  md: 'w-6 h-[18px] rounded',
  lg: 'w-8 h-6 rounded',
};

const FALLBACK_ICON: Record<CurrencyFlagSize, string> = {
  xs: 'w-3 h-3',
  sm: 'w-3.5 h-3.5',
  md: 'w-4 h-4',
  lg: 'w-5 h-5',
};

export function getFlagCdnSrc(countryCode: string, width: 40 | 80 = 40): string {
  const code = countryCode.trim().toLowerCase();
  return `https://flagcdn.com/w${width}/${code}.png`;
}

export function getFlagCdnSrcSet(countryCode: string): string {
  const code = countryCode.trim().toLowerCase();
  return `${getFlagCdnSrc(code, 40)} 1x, ${getFlagCdnSrc(code, 80)} 2x`;
}

interface CurrencyFlagProps {
  countryCode: string;
  size?: CurrencyFlagSize;
  className?: string;
  /** Accessible label; omit when parent text already names the currency. */
  alt?: string;
}

export default function CurrencyFlag({
  countryCode,
  size = 'sm',
  className = '',
  alt = '',
}: CurrencyFlagProps) {
  const [failed, setFailed] = useState(false);
  const code = countryCode.trim().toLowerCase();

  useEffect(() => {
    setFailed(false);
  }, [code]);

  const handleError = useCallback(() => {
    setFailed(true);
  }, []);

  if (!code || failed) {
    return (
      <span
        className={`inline-flex shrink-0 items-center justify-center bg-gray-700/80 text-gray-400 ${SIZE_CLASSES[size]} ${className}`}
        aria-hidden={!alt}
        title={alt || undefined}
      >
        <Globe className={FALLBACK_ICON[size]} strokeWidth={2} aria-hidden />
      </span>
    );
  }

  return (
    <img
      src={getFlagCdnSrc(code, 40)}
      srcSet={getFlagCdnSrcSet(code)}
      alt={alt}
      width={size === 'lg' ? 32 : size === 'md' ? 24 : size === 'sm' ? 20 : 16}
      height={size === 'lg' ? 24 : size === 'md' ? 18 : size === 'sm' ? 15 : 12}
      loading="lazy"
      decoding="async"
      onError={handleError}
      className={`inline-block shrink-0 object-cover ${SIZE_CLASSES[size]} ${className}`}
    />
  );
}
