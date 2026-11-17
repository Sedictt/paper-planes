export interface CountryOption {
  code: string;
  name: string;
}

const COMMON_COUNTRY_CODES = [
  'AR', 'AU', 'AT', 'BE', 'BR', 'CA', 'CL', 'CN', 'CO', 'CZ',
  'DE', 'DK', 'EG', 'ES', 'FI', 'FR', 'GB', 'GR', 'HK', 'ID',
  'IE', 'IL', 'IN', 'IT', 'JP', 'KR', 'MX', 'MY', 'NL', 'NO',
  'NZ', 'PE', 'PH', 'PL', 'PT', 'RO', 'RU', 'SA', 'SE', 'SG',
  'TH', 'TR', 'TW', 'UA', 'US', 'VN', 'ZA',
];

const regionFormatter =
  typeof Intl !== 'undefined' && typeof Intl.DisplayNames === 'function'
    ? new Intl.DisplayNames(['en'], { type: 'region' })
    : null;

export function getCountryName(code: string): string {
  const normalized = code.trim().toUpperCase();
  return regionFormatter?.of(normalized) || normalized;
}

export function getCountryOptions(extraCode?: string | null): CountryOption[] {
  const codes = new Set(COMMON_COUNTRY_CODES);
  if (extraCode && /^[A-Z]{2}$/.test(extraCode)) {
    codes.add(extraCode);
  }

  return Array.from(codes)
    .map((code) => ({ code, name: getCountryName(code) }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
