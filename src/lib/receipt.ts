import { Transaction, TransactionItem, Product } from '@/types';

// ============================================
// Types
// ============================================

export interface ReceiptData {
  storeName: string;
  storeAddress?: string;
  storePhone?: string;
  transaction: Transaction;
  items: ReceiptItem[];
  subtotal: number;
}

export interface ReceiptItem {
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  discount: number;
  originalPrice?: number;
  discountAmount?: number;
}

// ============================================
// Receipt Formatter
// ============================================

/**
 * Format currency to Indonesian Rupiah
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Format date to Indonesian locale
 */
export function formatDateTime(dateString: string): string {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

/**
 * Generate receipt text content
 */
export function formatReceipt(data: ReceiptData): string {
  const { storeName, storeAddress, storePhone, transaction, items, subtotal } = data;
  const lineWidth = 40;
  const separator = '='.repeat(lineWidth);
  const thinSeparator = '-'.repeat(lineWidth);

  const lines: string[] = [];

  // Header
  lines.push(centerText(storeName, lineWidth));
  if (storeAddress) {
    lines.push(centerText(storeAddress, lineWidth));
  }
  if (storePhone) {
    lines.push(centerText(storePhone, lineWidth));
  }
  lines.push(separator);

  // Transaction info
  lines.push(`No: ${transaction.transaction_number}`);
  lines.push(`Tanggal: ${formatDateTime(transaction.transaction_date)}`);
  lines.push(`Metode: ${formatPaymentMethod(transaction.payment_method)}`);
  lines.push(thinSeparator);

  // Items - Requirements: 4.5 - Show original price, discount, final price
  for (const item of items) {
    lines.push(item.name);
    
    // Show original price if there's a discount
    const hasItemDiscount = (item.discountAmount && item.discountAmount > 0) || item.discount > 0;
    const originalPrice = item.originalPrice || item.unitPrice;
    const discountAmt = item.discountAmount || item.discount || 0;
    const finalUnitPrice = originalPrice - (discountAmt / item.quantity);
    
    if (hasItemDiscount && item.originalPrice) {
      // Show original price crossed out style
      const origLine = `  ${item.quantity} x ${formatCurrency(item.originalPrice)}`;
      lines.push(formatLine(origLine, '', lineWidth));
      // Show discount
      lines.push(formatLine('  Diskon', `-${formatCurrency(discountAmt)}`, lineWidth));
      // Show final price
      const finalLine = `  ${item.quantity} x ${formatCurrency(Math.round(finalUnitPrice))}`;
      const itemTotal = formatCurrency(item.totalPrice);
      lines.push(formatLine(finalLine, itemTotal, lineWidth));
    } else {
      const qtyPrice = `  ${item.quantity} x ${formatCurrency(item.unitPrice)}`;
      const itemTotal = formatCurrency(item.totalPrice);
      lines.push(formatLine(qtyPrice, itemTotal, lineWidth));
      if (item.discount > 0) {
        lines.push(formatLine('  Diskon', `-${formatCurrency(item.discount)}`, lineWidth));
      }
    }
  }
  lines.push(thinSeparator);

  // Totals
  lines.push(formatLine('Subtotal', formatCurrency(subtotal), lineWidth));
  
  // Calculate total discount from items - Requirements: 4.5
  const totalItemDiscount = items.reduce((sum, item) => {
    return sum + (item.discountAmount || item.discount || 0);
  }, 0);
  
  // Show total discount (from items + transaction level)
  const totalDiscount = totalItemDiscount + (transaction.discount_amount || 0);
  if (totalDiscount > 0) {
    lines.push(formatLine('Total Diskon', `-${formatCurrency(totalDiscount)}`, lineWidth));
  }
  
  if (transaction.tax_amount > 0) {
    lines.push(formatLine('Pajak', formatCurrency(transaction.tax_amount), lineWidth));
  }
  
  lines.push(separator);
  lines.push(formatLine('TOTAL', formatCurrency(transaction.total_amount), lineWidth));
  lines.push(separator);

  // Payment info
  if (transaction.payment_method === 'cash') {
    lines.push(formatLine('Tunai', formatCurrency(transaction.cash_received || 0), lineWidth));
    lines.push(formatLine('Kembalian', formatCurrency(transaction.change_amount || 0), lineWidth));
  }

  lines.push('');
  lines.push(centerText('Terima Kasih', lineWidth));
  lines.push(centerText('Selamat Berbelanja Kembali', lineWidth));

  return lines.join('\n');
}

/**
 * Format payment method to Indonesian
 */
export function formatPaymentMethod(method: 'cash' | 'card' | 'e-wallet'): string {
  const methods: Record<string, string> = {
    'cash': 'Tunai',
    'card': 'Kartu',
    'e-wallet': 'E-Wallet',
  };
  return methods[method] || method;
}

/**
 * Center text within a given width
 */
export function centerText(text: string, width: number): string {
  if (text.length >= width) return text;
  const padding = Math.floor((width - text.length) / 2);
  return ' '.repeat(padding) + text;
}

/**
 * Format a line with left and right aligned text
 */
export function formatLine(left: string, right: string, width: number): string {
  const spaces = width - left.length - right.length;
  if (spaces <= 0) return `${left} ${right}`;
  return `${left}${' '.repeat(spaces)}${right}`;
}

/**
 * Convert transaction items with product info to receipt items
 * Requirements: 4.5 - Include original price, discount amount, and final price
 */
export function transactionItemsToReceiptItems(
  items: TransactionItem[],
  products: Map<string, Product>
): ReceiptItem[] {
  return items.map(item => {
    const product = products.get(item.product_id);
    return {
      name: product?.name || 'Unknown Product',
      quantity: item.quantity,
      unitPrice: item.unit_price,
      totalPrice: item.total_price,
      discount: item.discount,
      originalPrice: item.original_price,
      discountAmount: item.discount_amount,
    };
  });
}

/**
 * Check if receipt contains all required fields
 */
export function validateReceiptContent(receipt: string, data: ReceiptData): boolean {
  const { storeName, transaction, items } = data;

  // Check store name
  if (!receipt.includes(storeName)) return false;

  // Check transaction number
  if (!receipt.includes(transaction.transaction_number)) return false;

  // Check all items
  for (const item of items) {
    if (!receipt.includes(item.name)) return false;
  }

  // Check total
  if (!receipt.includes(formatCurrency(transaction.total_amount))) return false;

  // Check payment method
  if (!receipt.includes(formatPaymentMethod(transaction.payment_method))) return false;

  // Check change for cash payments
  if (transaction.payment_method === 'cash' && transaction.change_amount !== undefined) {
    if (!receipt.includes(formatCurrency(transaction.change_amount))) return false;
  }

  return true;
}
