export const CURRENCIES = [
  { code: 'PHP', label: 'PHP · Philippine Peso' },
  { code: 'USD', label: 'USD · US Dollar' },
  { code: 'EUR', label: 'EUR · Euro' },
  { code: 'GBP', label: 'GBP · British Pound' },
  { code: 'JPY', label: 'JPY · Japanese Yen' },
  { code: 'SGD', label: 'SGD · Singapore Dollar' },
  { code: 'AUD', label: 'AUD · Australian Dollar' },
  { code: 'CAD', label: 'CAD · Canadian Dollar' },
  { code: 'KRW', label: 'KRW · South Korean Won' },
  { code: 'VND', label: 'VND · Vietnamese Dong' },
];

export function formatCurrency(value, currency = 'PHP') {
  const code = CURRENCIES.some((option) => option.code === currency) ? currency : 'PHP';
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: code,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value) || 0);
}
