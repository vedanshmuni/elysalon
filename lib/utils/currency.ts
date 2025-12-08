/**
 * Format currency for display (Indian Rupee by default)
 */
export function formatCurrency(
  amount: number | string,
  currency: string = 'INR',
  locale: string = 'en-IN'
): string {
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;

  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numAmount);
}

/**
 * Format currency without symbol
 */
export function formatAmount(amount: number | string, decimals: number = 2): string {
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;

  return new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(numAmount);
}

/**
 * Parse currency string to number
 */
export function parseCurrency(value: string): number {
  return parseFloat(value.replace(/[^0-9.-]+/g, ''));
}

/**
 * Calculate percentage
 */
export function calculatePercentage(value: number, total: number): number {
  if (total === 0) return 0;
  return (value / total) * 100;
}

/**
 * Calculate discount amount
 */
export function calculateDiscount(
  amount: number,
  discountType: 'PERCENT' | 'FIXED',
  discountValue: number
): number {
  if (discountType === 'PERCENT') {
    return (amount * discountValue) / 100;
  }
  return Math.min(discountValue, amount);
}

/**
 * Calculate tax amount
 */
export function calculateTax(amount: number, taxRate: number): number {
  return (amount * taxRate) / 100;
}

/**
 * Calculate total with tax and discount
 */
export function calculateTotal(
  subtotal: number,
  taxRate: number,
  discountAmount: number = 0
): {
  subtotal: number;
  discount: number;
  taxableAmount: number;
  tax: number;
  total: number;
} {
  const discount = Math.min(discountAmount, subtotal);
  const taxableAmount = subtotal - discount;
  const tax = calculateTax(taxableAmount, taxRate);
  const total = taxableAmount + tax;

  return {
    subtotal,
    discount,
    taxableAmount,
    tax,
    total,
  };
}
