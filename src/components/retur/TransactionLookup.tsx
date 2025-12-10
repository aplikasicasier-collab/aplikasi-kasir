/**
 * Transaction Lookup Component
 * 
 * Input for transaction number
 * Display transaction details when found
 * 
 * Requirements: 1.1, 1.2
 */

import React, { useState, useCallback } from 'react';
import { Search, Loader2, AlertCircle, Receipt, Calendar, CreditCard, Package } from 'lucide-react';
import { Button } from '../ui/Button';
import { Card, CardContent } from '../ui/Card';
import { Transaction, TransactionItem } from '@/types';
import { getTransactionByNumber, TransactionWithItems } from '@/api/returns';

interface TransactionLookupProps {
  onTransactionFound: (transaction: TransactionWithItems) => void;
  disabled?: boolean;
}

export const TransactionLookup: React.FC<TransactionLookupProps> = ({
  onTransactionFound,
  disabled = false,
}) => {
  const [transactionNumber, setTransactionNumber] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [foundTransaction, setFoundTransaction] = useState<TransactionWithItems | null>(null);

  const handleSearch = useCallback(async () => {
    if (!transactionNumber.trim()) {
      setError('Masukkan nomor transaksi');
      return;
    }

    setIsSearching(true);
    setError(null);
    setFoundTransaction(null);

    try {
      const transaction = await getTransactionByNumber(transactionNumber.trim());
      
      if (!transaction) {
        setError('Transaksi tidak ditemukan');
        return;
      }

      if (transaction.status === 'cancelled') {
        setError('Transaksi ini sudah dibatalkan');
        return;
      }

      setFoundTransaction(transaction);
      onTransactionFound(transaction);
    } catch (err: any) {
      setError(err.message || 'Gagal mencari transaksi');
    } finally {
      setIsSearching(false);
    }
  }, [transactionNumber, onTransactionFound]);

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !disabled && !isSearching) {
      handleSearch();
    }
  };

  const handleClear = () => {
    setTransactionNumber('');
    setFoundTransaction(null);
    setError(null);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getPaymentMethodLabel = (method: string) => {
    switch (method) {
      case 'cash': return 'Tunai';
      case 'card': return 'Kartu';
      case 'e-wallet': return 'E-Wallet';
      default: return method;
    }
  };

  return (
    <div className="space-y-4">
      {/* Search Input */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            value={transactionNumber}
            onChange={(e) => setTransactionNumber(e.target.value.toUpperCase())}
            onKeyPress={handleKeyPress}
            placeholder="Masukkan nomor transaksi (TRX-XXXXXXXX-XXXX)"
            disabled={disabled || isSearching}
            className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed"
          />
        </div>
        <Button
          onClick={handleSearch}
          disabled={disabled || isSearching || !transactionNumber.trim()}
          className="px-6"
        >
          {isSearching ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            'Cari'
          )}
        </Button>
        {foundTransaction && (
          <Button
            variant="outline"
            onClick={handleClear}
            disabled={disabled}
          >
            Reset
          </Button>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
          <span className="text-sm text-red-700 dark:text-red-400">{error}</span>
        </div>
      )}

      {/* Transaction Details */}
      {foundTransaction && (
        <Card className="border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-900/10">
          <CardContent className="p-4">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-green-600" />
                <h3 className="font-semibold text-gray-900 dark:text-white">
                  {foundTransaction.transaction_number}
                </h3>
              </div>
              <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded-full">
                Ditemukan
              </span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-gray-400" />
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Tanggal</p>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {formatDate(foundTransaction.transaction_date)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-gray-400" />
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Pembayaran</p>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {getPaymentMethodLabel(foundTransaction.payment_method)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-gray-400" />
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Jumlah Item</p>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {foundTransaction.items.length} produk
                  </p>
                </div>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Total</p>
                <p className="text-sm font-bold text-primary-600">
                  Rp {foundTransaction.total_amount.toLocaleString()}
                </p>
              </div>
            </div>

            {/* Items Preview */}
            <div className="border-t dark:border-gray-700 pt-3">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Item Transaksi:</p>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {foundTransaction.items.map((item: TransactionItem & { products?: { name: string } }) => (
                  <div key={item.id} className="flex justify-between text-sm">
                    <span className="text-gray-700 dark:text-gray-300">
                      {(item as any).products?.name || `Product ${item.product_id.slice(0, 8)}`} × {item.quantity}
                    </span>
                    <span className="text-gray-900 dark:text-white font-medium">
                      Rp {item.total_price.toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default TransactionLookup;
