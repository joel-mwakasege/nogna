import { useTenant } from '../contexts/TenantContext';

export interface Currency {
  id: string;
  code: string;
  name: string;
  symbol: string;
  is_active: boolean;
  display_order: number;
}

// 1. Pure function updated to accept dynamic database currencies
export const getCurrencySymbol = (currencyCode: string, dynamicCurrencies: Currency[] = []): string => {
  // Try to find the symbol from the active database currencies first
  if (dynamicCurrencies && dynamicCurrencies.length > 0) {
    const dbCurrency = dynamicCurrencies.find((c) => c.code === currencyCode);
    if (dbCurrency && dbCurrency.symbol) {
      return dbCurrency.symbol;
    }
  }

  // Fallback to the standard hardcoded list
  const currencySymbols: Record<string, string> = {
    'USD': '$',
    'GBP': '£',
    'EUR': '€',
    'TZS': 'TSh',
    'JPY': '¥',
    'CNY': '¥',
    'INR': '₹',
    'AUD': 'A$',
    'CAD': 'C$',
    'CHF': 'CHF',
    'KES': 'KSh',
    'UGX': 'USh',
    'ZAR': 'R',
  };

  return currencySymbols[currencyCode] || currencyCode;
};

// 2. Pure formatting function updated to accept dynamic database currencies
export const formatCurrency = (
  amount: number, 
  currencyCode: string = 'USD', 
  decimalPlaces: number = 2,
  dynamicCurrencies: Currency[] = []
): string => {
  const symbol = getCurrencySymbol(currencyCode, dynamicCurrencies);
  return `${symbol}\u00A0${amount.toLocaleString('en-US', {
    minimumFractionDigits: decimalPlaces,
    maximumFractionDigits: decimalPlaces,
  })}`;
};

// 3. NEW: A React Hook for your components to use the dynamic currencies automatically!
export const useCurrencyFormatter = () => {
  const { currencies } = useTenant();

  const format = (amount: number, currencyCode: string = 'USD', decimalPlaces: number = 2) => {
    return formatCurrency(amount, currencyCode, decimalPlaces, currencies);
  };

  const getSymbol = (currencyCode: string) => {
    return getCurrencySymbol(currencyCode, currencies);
  };

  // We also return the activeCurrencies array so you can use it to map options in your Currency Switcher dropdown!
  return { format, getSymbol, activeCurrencies: currencies };
};
