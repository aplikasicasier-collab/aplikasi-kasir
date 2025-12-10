import { useRef } from 'react';
import { X, Printer } from 'lucide-react';
import { Transaction, TransactionItem, Product } from '@/types';
import { formatReceipt, ReceiptData, transactionItemsToReceiptItems } from '@/lib/receipt';
import { Button } from '@/components/ui/Button';

interface ReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  transaction: Transaction;
  items: TransactionItem[];
  products: Map<string, Product>;
  storeName?: string;
  storeAddress?: string;
  storePhone?: string;
}

export function ReceiptModal({
  isOpen,
  onClose,
  transaction,
  items,
  products,
  storeName = 'Toko Anda',
  storeAddress,
  storePhone,
}: ReceiptModalProps) {
  const receiptRef = useRef<HTMLPreElement>(null);

  if (!isOpen) return null;

  const receiptItems = transactionItemsToReceiptItems(items, products);
  // Calculate subtotal from original prices if available, otherwise use total_price
  // Requirements: 4.5 - Show total discount amount
  const subtotal = items.reduce((sum, item) => {
    const originalTotal = item.original_price 
      ? item.original_price * item.quantity 
      : item.total_price + (item.discount_amount || 0);
    return sum + originalTotal;
  }, 0);

  const receiptData: ReceiptData = {
    storeName,
    storeAddress,
    storePhone,
    transaction,
    items: receiptItems,
    subtotal,
  };

  const receiptText = formatReceipt(receiptData);

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Struk - ${transaction.transaction_number}</title>
          <style>
            body {
              font-family: 'Courier New', monospace;
              font-size: 12px;
              padding: 10px;
              max-width: 300px;
              margin: 0 auto;
            }
            pre {
              white-space: pre-wrap;
              word-wrap: break-word;
              margin: 0;
            }
            @media print {
              body { padding: 0; }
            }
          </style>
        </head>
        <body>
          <pre>${receiptText}</pre>
        </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Struk Transaksi
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Receipt Content */}
        <div className="flex-1 overflow-auto p-4">
          <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
            <pre
              ref={receiptRef}
              className="font-mono text-xs text-gray-800 dark:text-gray-200 whitespace-pre-wrap"
            >
              {receiptText}
            </pre>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-4 border-t dark:border-gray-700">
          <Button
            variant="outline"
            className="flex-1"
            onClick={onClose}
          >
            Tutup
          </Button>
          <Button
            variant="primary"
            className="flex-1 flex items-center justify-center gap-2"
            onClick={handlePrint}
          >
            <Printer className="w-4 h-4" />
            Cetak
          </Button>
        </div>
      </div>
    </div>
  );
}

export default ReceiptModal;
