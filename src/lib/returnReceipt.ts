import { Return, ReturnItem, ReturnReason } from '@/api/returns';
import { Transaction } from '@/types';
import { formatCurrency, formatDateTime, centerText, formatLine, formatPaymentMethod } from './receipt';

// ============================================
// Types
// Requirements: 6.1, 6.2, 6.3
// ============================================

export interface ReturnReceiptData {
  storeName: string;
  storeAddress?: string;
  storePhone?: string;
  returnData: Return;
  originalTransaction: Transaction;
  kasirName: string;
}

export interface ReturnReceiptItem {
  name: string;
  quantity: number;
  originalPrice: number;
  discountAmount: number;
  refundAmount: number;
  reason: ReturnReason;
}

// ============================================
// Return Reason Formatter
// ============================================

/**
 * Format return reason to Indonesian
 */
export function formatReturnReason(reason: ReturnReason): string {
  const reasons: Record<ReturnReason, string> = {
    'damaged': 'Rusak',
    'wrong_product': 'Salah Produk',
    'not_as_described': 'Tidak Sesuai',
    'changed_mind': 'Berubah Pikiran',
    'other': 'Lainnya',
  };
  return reasons[reason] || reason;
}

/**
 * Format refund method to Indonesian
 */
export function formatRefundMethod(method: string | null): string {
  if (!method) return '-';
  const methods: Record<string, string> = {
    'cash': 'Tunai',
    'card': 'Kartu',
    'e-wallet': 'E-Wallet',
  };
  return methods[method] || method;
}

// ============================================
// Return Receipt Generator
// Requirements: 6.1, 6.2, 6.3
// ============================================

/**
 * Convert return items to receipt items
 */
export function returnItemsToReceiptItems(items: ReturnItem[]): ReturnReceiptItem[] {
  return items.map(item => ({
    name: item.product_name || 'Unknown Product',
    quantity: item.quantity,
    originalPrice: item.original_price,
    discountAmount: item.discount_amount,
    refundAmount: item.refund_amount,
    reason: item.reason,
  }));
}

/**
 * Generate return receipt text content
 * Requirements: 6.1, 6.2, 6.3
 * 
 * **Feature: retur-refund, Property 8: Return Receipt Content**
 * **Validates: Requirements 6.1, 6.2, 6.3**
 */
export function generateReturnReceipt(data: ReturnReceiptData): string {
  const { storeName, storeAddress, storePhone, returnData, originalTransaction, kasirName } = data;
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
  lines.push(centerText('BUKTI RETUR', lineWidth));
  lines.push(separator);

  // Return info - Requirements: 6.2
  lines.push(`No Retur: ${returnData.return_number}`);
  lines.push(`No Transaksi Asal: ${originalTransaction.transaction_number}`);
  lines.push(`Tanggal Retur: ${formatDateTime(returnData.created_at)}`);
  lines.push(`Kasir: ${kasirName}`);
  lines.push(thinSeparator);

  // Items - Requirements: 6.2
  lines.push('ITEM RETUR:');
  const items = returnData.items || [];
  
  for (const item of items) {
    const productName = item.product_name || 'Unknown Product';
    lines.push(productName);
    
    // Show quantity and original price
    const qtyPrice = `  ${item.quantity} x ${formatCurrency(item.original_price)}`;
    lines.push(qtyPrice);
    
    // Show discount if any
    if (item.discount_amount > 0) {
      lines.push(formatLine('  Diskon', `-${formatCurrency(item.discount_amount)}`, lineWidth));
    }
    
    // Show refund amount
    lines.push(formatLine('  Refund', formatCurrency(item.refund_amount), lineWidth));
    
    // Show reason
    lines.push(`  Alasan: ${formatReturnReason(item.reason)}`);
  }
  
  lines.push(thinSeparator);

  // Totals - Requirements: 6.2
  const subtotal = items.reduce((sum, item) => sum + (item.original_price * item.quantity), 0);
  const totalDiscount = items.reduce((sum, item) => sum + (item.discount_amount * item.quantity), 0);
  
  lines.push(formatLine('Subtotal', formatCurrency(subtotal), lineWidth));
  
  if (totalDiscount > 0) {
    lines.push(formatLine('Total Diskon', `-${formatCurrency(totalDiscount)}`, lineWidth));
  }
  
  lines.push(separator);
  lines.push(formatLine('TOTAL REFUND', formatCurrency(returnData.total_refund), lineWidth));
  lines.push(separator);

  // Refund method
  if (returnData.refund_method) {
    lines.push(formatLine('Metode Refund', formatRefundMethod(returnData.refund_method), lineWidth));
  }

  // Status
  lines.push(formatLine('Status', formatReturnStatus(returnData.status), lineWidth));

  lines.push('');
  lines.push(centerText('Terima Kasih', lineWidth));
  lines.push(centerText('Barang yang sudah diretur', lineWidth));
  lines.push(centerText('tidak dapat dikembalikan', lineWidth));

  return lines.join('\n');
}

/**
 * Format return status to Indonesian
 */
export function formatReturnStatus(status: string): string {
  const statuses: Record<string, string> = {
    'pending_approval': 'Menunggu Persetujuan',
    'approved': 'Disetujui',
    'completed': 'Selesai',
    'rejected': 'Ditolak',
    'cancelled': 'Dibatalkan',
  };
  return statuses[status] || status;
}

/**
 * Validate return receipt contains all required fields
 * Requirements: 6.1, 6.2, 6.3
 */
export function validateReturnReceiptContent(receipt: string, data: ReturnReceiptData): boolean {
  const { storeName, returnData, originalTransaction, kasirName } = data;

  // Check store name
  if (!receipt.includes(storeName)) return false;

  // Check return number - Requirements: 6.2
  if (!receipt.includes(returnData.return_number)) return false;

  // Check original transaction number - Requirements: 6.2
  if (!receipt.includes(originalTransaction.transaction_number)) return false;

  // Check all items - Requirements: 6.2
  for (const item of returnData.items || []) {
    const productName = item.product_name || 'Unknown Product';
    if (!receipt.includes(productName)) return false;
  }

  // Check total refund amount - Requirements: 6.2
  if (!receipt.includes(formatCurrency(returnData.total_refund))) return false;

  // Check kasir name - Requirements: 6.3
  if (!receipt.includes(kasirName)) return false;

  return true;
}

/**
 * Check if receipt contains return date
 * Requirements: 6.3
 */
export function receiptContainsReturnDate(receipt: string, returnDate: string): boolean {
  const formattedDate = formatDateTime(returnDate);
  return receipt.includes(formattedDate);
}

/**
 * Extract return number from receipt
 */
export function extractReturnNumberFromReceipt(receipt: string): string | null {
  const match = receipt.match(/No Retur: (RTN-\d{8}-\d{4})/);
  return match ? match[1] : null;
}

/**
 * Extract original transaction number from receipt
 */
export function extractOriginalTransactionFromReceipt(receipt: string): string | null {
  const match = receipt.match(/No Transaksi Asal: (TRX-\d{8}-\d{4})/);
  return match ? match[1] : null;
}
