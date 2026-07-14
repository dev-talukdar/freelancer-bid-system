import type { AllowedCountry, FreelancerCurrency } from './types.js';

export const ALLOWED_CURRENCIES = [
  { id: 1, code: 'USD', sign: '$', name: 'US Dollar', exchange_rate: 1.0, country: 'US' },
  {
    id: 2,
    code: 'NZD',
    sign: '$',
    name: 'New Zealand Dollar',
    exchange_rate: 0.579278,
    country: 'NZ',
  },
  {
    id: 3,
    code: 'AUD',
    sign: '$',
    name: 'Australian Dollar',
    exchange_rate: 0.69305,
    country: 'AU',
  },
  { id: 4, code: 'GBP', sign: '£', name: 'British Pounds', exchange_rate: 1.336133, country: 'UK' },
  {
    id: 5,
    code: 'HKD',
    sign: '$',
    name: 'Hong Kong Dollar',
    exchange_rate: 0.127576,
    country: 'HK',
  },
  {
    id: 6,
    code: 'SGD',
    sign: '$',
    name: 'Singapore Dollar',
    exchange_rate: 0.773094,
    country: 'SG',
  },
  { id: 8, code: 'EUR', sign: '€', name: 'Euro', exchange_rate: 1.139417, country: 'EU' },
  {
    id: 9,
    code: 'CAD',
    sign: '$',
    name: 'Canadian Dollar',
    exchange_rate: 0.707629,
    country: 'CA',
  },
] as const satisfies readonly FreelancerCurrency[];

export const ALLOWED_COUNTRIES = [
  { name: 'Australia', code: 'AU' },
  { name: 'Austria', code: 'AT' },
  { name: 'Bahrain', code: 'BH' },
  { name: 'Belgium', code: 'BE' },
  { name: 'Brazil', code: 'BR' },
  { name: 'Brunei Darussalam', code: 'BN' },
  { name: 'Canada', code: 'CA' },
  { name: 'Croatia', code: 'HR' },
  { name: 'Estonia', code: 'EE' },
  { name: 'Finland', code: 'FI' },
  { name: 'France', code: 'FR' },
  { name: 'Germany', code: 'DE' },
  { name: 'Greece', code: 'GR' },
  { name: 'Hong Kong', code: 'HK' },
  { name: 'Hungary', code: 'HU' },
  { name: 'Ireland', code: 'IE' },
  { name: 'Israel', code: 'IL' },
  { name: 'Italy', code: 'IT' },
  { name: 'Japan', code: 'JP' },
  { name: 'Jordan', code: 'JO' },
  { name: 'Kuwait', code: 'KW' },
  { name: 'Lithuania', code: 'LT' },
  { name: 'Luxembourg', code: 'LU' },
  { name: 'Macau', code: 'MO' },
  { name: 'Mexico', code: 'MX' },
  { name: 'Netherlands', code: 'NL' },
  { name: 'New Zealand', code: 'NZ' },
  { name: 'Norway', code: 'NO' },
  { name: 'Oman', code: 'OM' },
  { name: 'Paraguay', code: 'PY' },
  { name: 'Peru', code: 'PE' },
  { name: 'Portugal', code: 'PT' },
  { name: 'Qatar', code: 'QA' },
  { name: 'Romania', code: 'RO' },
  { name: 'Saudi Arabia', code: 'SA' },
  { name: 'Singapore', code: 'SG' },
  { name: 'South Africa', code: 'ZA' },
  { name: 'Spain', code: 'ES' },
  { name: 'Sweden', code: 'SE' },
  { name: 'Switzerland', code: 'CH' },
  { name: 'Taiwan', code: 'TW' },
  { name: 'Thailand', code: 'TH' },
  { name: 'United Arab Emirates', code: 'AE' },
  { name: 'United Kingdom', code: 'GB' },
  { name: 'United States', code: 'US' },
] as const satisfies readonly AllowedCountry[];

export const normalizeCountryCode = (value: string | null | undefined): string | undefined => {
  const normalized = value?.trim().toUpperCase();
  return normalized === undefined || normalized.length === 0 ? undefined : normalized;
};

export const normalizeCurrencyCode = (value: string | null | undefined): string | undefined => {
  const normalized = value?.trim().toUpperCase();
  return normalized === undefined || normalized.length === 0 ? undefined : normalized;
};

export const ALLOWED_CURRENCY_CODES: ReadonlySet<string> = new Set(
  ALLOWED_CURRENCIES.map((currency) => currency.code),
);
export const ALLOWED_CURRENCY_IDS: ReadonlySet<number | undefined> = new Set(
  ALLOWED_CURRENCIES.map((currency) => currency.id),
);
export const ALLOWED_COUNTRY_CODES: ReadonlySet<string> = new Set(
  ALLOWED_COUNTRIES.map((country) => country.code),
);

export function validateFreelancerAllowlists(): void {
  const currencyCodes = new Set<string>();
  const currencyIds = new Set<number>();
  const countryCodes = new Set<string>();
  for (const currency of ALLOWED_CURRENCIES) {
    if (!/^[A-Z]{3}$/.test(currency.code))
      throw new Error(`Malformed currency code: ${currency.code}`);
    if (currencyCodes.has(currency.code))
      throw new Error(`Duplicate currency code: ${currency.code}`);
    if (currencyIds.has(currency.id)) throw new Error(`Duplicate currency id: ${currency.id}`);
    currencyCodes.add(currency.code);
    currencyIds.add(currency.id);
  }
  for (const country of ALLOWED_COUNTRIES) {
    if (!/^[A-Z]{2}$/.test(country.code))
      throw new Error(`Malformed country code: ${country.code}`);
    if (countryCodes.has(country.code)) throw new Error(`Duplicate country code: ${country.code}`);
    countryCodes.add(country.code);
  }
}
