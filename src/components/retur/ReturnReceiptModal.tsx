/**
 * Return Receipt Modal Component
 * 
 * Display return receipt format with print functionality
 * 
 * Requirements: 6.1, 6.4
 */

import { useRef } from 'react';
import { X, Printer, Mail } from 'lucide-react';
import { Transaction } from '@/types';
import { Return } from '@/api/returns';
import { generateReturnReceipt, ReturnReceiptData } from '@/lib/returnReceipt';
import { Button } from '@/components/ui/Button';

interface ReturnReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  returnData: Return;
  originalTransaction: Transaction;
  kasirName: string;
  storeName?: string;
  storeAddress?: string;
  storePhone?: string;
}

export function ReturnReceiptModal({
  isOpen,
  onClose,
  returnData,
  originalTransaction,
  kasirName,
  storeName = 'Toko Anda',
  storeAddress,
  storePhone,
}: ReturnReceiptModalProps) {
  const receiptRef = useRef<HTMLPreElement>(null);

  if (!isOpen) return null;

  const receiptData: ReturnReceiptData = {
    storeName,
    storeAddress,
    storePhone,
    returnData,
    originalTransaction,
    kasirName,
  };

  const receiptText = generateReturnReceipt(receiptData);

  // Requirements: 6.4 - Print functionality
  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Struk Retur - ${returnData.return_number}</title>
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

  // Requirements: 6.4 - Email functionality (placeholder)
  const handleEmail = () => {
    // Create mailto link with receipt content
    const subject = encodeURIComponent(`Bukti Retur - ${returnData.return_number}`);
    const body = encodeURIComponent(receiptText);
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
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
            Struk Retur
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
            variant="outline"
            className="flex-1 flex items-center justify-center gap-2"
            onClick={handleEmail}
          >
            <Mail className="w-4 h-4" />
            Email
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

export default ReturnReceiptModal;
