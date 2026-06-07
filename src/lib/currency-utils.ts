export const getCurrencySymbol = (currencyCode: string): string => {
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

export const formatCurrency = (amount: number, currencyCode: string = 'USD', decimalPlaces: number = 2): string => {
  const symbol = getCurrencySymbol(currencyCode);
  return `${symbol}\u00A0${amount.toLocaleString('en-US', {
    minimumFractionDigits: decimalPlaces,
    maximumFractionDigits: decimalPlaces,
  })}`;
};
