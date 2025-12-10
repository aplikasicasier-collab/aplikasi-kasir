/**
 * Stock Transfer Form Component
 * 
 * Select source and destination outlets
 * Add products with quantities
 * Show available stock at source
 * 
 * Requirements: 4.1, 4.2
 */

import React, { useState, useEffect, useCallback } from 'react';
import { X, Loader2, AlertCircle, ArrowRightLeft, Plus, Trash2, Search, Package } from 'lucide-react';
import { Button } from '../ui/Button';
import { Outlet, Product } from '@/types';
import { getOutlets } from '@/api/outlets';
import { getOutletStock, OutletStockItem } from '@/api/outletStock';
import { CreateTransferInput } from '@/api/stockTransfers';

interface StockTransferFormProps {
  isOpen: boolean;
  onSubmit: (input: CreateTransferInput) => Promise<void>;
  onClose: () => void;
  currentOutletId?: string;
}

interface TransferItem {
  product_id: string;
  product_name: string;
  quantity: number;
  available_stock: number;
}

interface FormErrors {
  source_outlet?: string;
  destination_outlet?: string;
  items?: string;
}

export const StockTransferForm: React.FC<StockTransferFormProps> = ({
  isOpen,
  onSubmit,
  onClose,
  currentOutletId,
}) => {
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [sourceOutletId, setSourceOutletId] = useState<string>('');
  const [destinationOutletId, setDestinationOutletId] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [items, setItems] = useState<TransferItem[]>([]);
  const [errors, setErrors] = useState<FormErrors>({});

  const [isSaving, setIsSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [loadingOutlets, setLoadingOutlets] = useState(false);
  const [loadingStock, setLoadingStock] = useState(false);
  const [sourceStock, setSourceStock] = useState<OutletStockItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showProductSearch, setShowProductSearch] = useState(false);

  // Load outlets on mount
  useEffect(() => {
    if (isOpen) {
      loadOutlets();
    }
  }, [isOpen]);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setSourceOutletId(currentOutletId || '');
      setDestinationOutletId('');
      setNotes('');
      setItems([]);
      setErrors({});
      setSubmitError(null);
      setSearchQuery('');
      setShowProductSearch(false);
    }
  }, [isOpen, currentOutletId]);

  // Load source outlet stock when source changes
  useEffect(() => {
    if (sourceOutletId) {
      loadSourceStock(sourceOutletId);
    } else {
      setSourceStock([]);
    }
  }, [sourceOutletId]);

  const loadOutlets = async () => {
    setLoadingOutlets(true);
    try {
      const data = await getOutlets(false);
      setOutlets(data);
    } catch (error) {
      console.error('Failed to load outlets:', error);
    } finally {
      setLoadingOutlets(false);
    }
  };

  const loadSourceStock = async (outletId: string) => {
    setLoadingStock(true);
    try {
      const data = await getOutletStock(outletId);
      // Filter only products with stock > 0
      setSourceStock(data.filter(item => item.quantity > 0));
    } catch (error) {
      console.error('Failed to load source stock:', error);
      setSourceStock([]);
    } finally {
      setLoadingStock(false);
    }
  };

  const filteredProducts = useCallback(() => {
    if (!searchQuery.trim()) return sourceStock;
    const query = searchQuery.toLowerCase();
    return sourceStock.filter(item => 
      item.product?.name?.toLowerCase().includes(query) ||
      item.product?.barcode?.toLowerCase().includes(query)
    );
  }, [sourceStock, searchQuery]);

  const addItem = (stockItem: OutletStockItem) => {
    // Check if already added
    if (items.some(item => item.product_id === stockItem.product_id)) {
      return;
    }

    setItems(prev => [...prev, {
      product_id: stockItem.product_id,
      product_name: stockItem.product?.name || 'Unknown Product',
      quantity: 1,
      available_stock: stockItem.quantity,
    }]);
    setSearchQuery('');
    setShowProductSearch(false);
  };

  const removeItem = (productId: string) => {
    setItems(prev => prev.filter(item => item.product_id !== productId));
  };

  const updateItemQuantity = (productId: string, quantity: number) => {
    setItems(prev => prev.map(item => 
      item.product_id === productId 
        ? { ...item, quantity: Math.max(1, Math.min(quantity, item.available_stock)) }
        : item
    ));
  };


  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!sourceOutletId) {
      newErrors.source_outlet = 'Pilih outlet asal';
    }

    if (!destinationOutletId) {
      newErrors.destination_outlet = 'Pilih outlet tujuan';
    }

    if (sourceOutletId && destinationOutletId && sourceOutletId === destinationOutletId) {
      newErrors.destination_outlet = 'Outlet tujuan harus berbeda dari outlet asal';
    }

    if (items.length === 0) {
      newErrors.items = 'Tambahkan minimal satu produk untuk ditransfer';
    }

    // Check quantities
    for (const item of items) {
      if (item.quantity > item.available_stock) {
        newErrors.items = `Stok tidak mencukupi untuk ${item.product_name}`;
        break;
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (!validateForm()) {
      return;
    }

    setIsSaving(true);
    try {
      await onSubmit({
        source_outlet_id: sourceOutletId,
        destination_outlet_id: destinationOutletId,
        items: items.map(item => ({
          product_id: item.product_id,
          quantity: item.quantity,
        })),
        notes: notes.trim() || undefined,
      });
      onClose();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Terjadi kesalahan saat membuat transfer';
      setSubmitError(message);
    } finally {
      setIsSaving(false);
    }
  };

  const getSourceOutletName = () => {
    return outlets.find(o => o.id === sourceOutletId)?.name || '';
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full mx-4 p-6 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <ArrowRightLeft className="w-5 h-5 text-primary-600" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Transfer Stok Baru
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Submit Error */}
        {submitError && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
            <span className="text-sm text-red-700 dark:text-red-400">{submitError}</span>
          </div>
        )}


        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            {/* Outlet Selection Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Source Outlet */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Outlet Asal <span className="text-red-500">*</span>
                </label>
                <select
                  value={sourceOutletId}
                  onChange={(e) => {
                    setSourceOutletId(e.target.value);
                    setItems([]); // Clear items when source changes
                  }}
                  disabled={loadingOutlets}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white ${
                    errors.source_outlet
                      ? 'border-red-500 dark:border-red-500'
                      : 'border-gray-300 dark:border-gray-600'
                  }`}
                >
                  <option value="">Pilih outlet asal</option>
                  {outlets.map(outlet => (
                    <option key={outlet.id} value={outlet.id}>
                      {outlet.name} ({outlet.code})
                    </option>
                  ))}
                </select>
                {errors.source_outlet && (
                  <p className="mt-1 text-sm text-red-500">{errors.source_outlet}</p>
                )}
              </div>

              {/* Destination Outlet */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Outlet Tujuan <span className="text-red-500">*</span>
                </label>
                <select
                  value={destinationOutletId}
                  onChange={(e) => setDestinationOutletId(e.target.value)}
                  disabled={loadingOutlets}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white ${
                    errors.destination_outlet
                      ? 'border-red-500 dark:border-red-500'
                      : 'border-gray-300 dark:border-gray-600'
                  }`}
                >
                  <option value="">Pilih outlet tujuan</option>
                  {outlets
                    .filter(outlet => outlet.id !== sourceOutletId)
                    .map(outlet => (
                      <option key={outlet.id} value={outlet.id}>
                        {outlet.name} ({outlet.code})
                      </option>
                    ))}
                </select>
                {errors.destination_outlet && (
                  <p className="mt-1 text-sm text-red-500">{errors.destination_outlet}</p>
                )}
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Catatan
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
                placeholder="Catatan transfer (opsional)"
              />
            </div>


            {/* Product Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Produk <span className="text-red-500">*</span>
              </label>
              
              {!sourceOutletId ? (
                <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg text-center text-gray-500 dark:text-gray-400">
                  Pilih outlet asal terlebih dahulu
                </div>
              ) : loadingStock ? (
                <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg text-center">
                  <Loader2 className="w-5 h-5 animate-spin mx-auto text-primary-600" />
                  <span className="text-sm text-gray-500 dark:text-gray-400 mt-2 block">
                    Memuat stok...
                  </span>
                </div>
              ) : sourceStock.length === 0 ? (
                <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg text-center text-gray-500 dark:text-gray-400">
                  <Package className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  Tidak ada stok tersedia di {getSourceOutletName()}
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Add Product Button */}
                  <div className="relative">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowProductSearch(!showProductSearch)}
                      className="w-full flex items-center justify-center gap-2"
                    >
                      <Plus className="w-4 h-4" />
                      Tambah Produk
                    </Button>

                    {/* Product Search Dropdown */}
                    {showProductSearch && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg z-10 max-h-64 overflow-y-auto">
                        <div className="p-2 border-b dark:border-gray-600">
                          <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                              type="text"
                              placeholder="Cari produk..."
                              value={searchQuery}
                              onChange={(e) => setSearchQuery(e.target.value)}
                              className="w-full pl-9 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
                              autoFocus
                            />
                          </div>
                        </div>
                        <div className="max-h-48 overflow-y-auto">
                          {filteredProducts().length === 0 ? (
                            <div className="p-3 text-center text-gray-500 dark:text-gray-400 text-sm">
                              Tidak ada produk ditemukan
                            </div>
                          ) : (
                            filteredProducts()
                              .filter(item => !items.some(i => i.product_id === item.product_id))
                              .map(item => (
                                <button
                                  key={item.product_id}
                                  type="button"
                                  onClick={() => addItem(item)}
                                  className="w-full px-3 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-600 flex justify-between items-center"
                                >
                                  <div>
                                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                                      {item.product?.name}
                                    </div>
                                    {item.product?.barcode && (
                                      <div className="text-xs text-gray-500 dark:text-gray-400">
                                        {item.product.barcode}
                                      </div>
                                    )}
                                  </div>
                                  <span className="text-sm text-gray-500 dark:text-gray-400">
                                    Stok: {item.quantity}
                                  </span>
                                </button>
                              ))
                          )}
                        </div>
                      </div>
                    )}
                  </div>


                  {/* Selected Items */}
                  {items.length > 0 && (
                    <div className="border dark:border-gray-600 rounded-lg overflow-hidden">
                      <table className="w-full">
                        <thead className="bg-gray-50 dark:bg-gray-700">
                          <tr>
                            <th className="text-left py-2 px-3 text-sm font-medium text-gray-700 dark:text-gray-300">
                              Produk
                            </th>
                            <th className="text-center py-2 px-3 text-sm font-medium text-gray-700 dark:text-gray-300">
                              Stok
                            </th>
                            <th className="text-center py-2 px-3 text-sm font-medium text-gray-700 dark:text-gray-300">
                              Qty Transfer
                            </th>
                            <th className="text-right py-2 px-3 text-sm font-medium text-gray-700 dark:text-gray-300">
                              Aksi
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {items.map(item => (
                            <tr key={item.product_id} className="border-t dark:border-gray-600">
                              <td className="py-2 px-3 text-sm text-gray-900 dark:text-white">
                                {item.product_name}
                              </td>
                              <td className="py-2 px-3 text-center text-sm text-gray-500 dark:text-gray-400">
                                {item.available_stock}
                              </td>
                              <td className="py-2 px-3 text-center">
                                <input
                                  type="number"
                                  min={1}
                                  max={item.available_stock}
                                  value={item.quantity}
                                  onChange={(e) => updateItemQuantity(item.product_id, parseInt(e.target.value) || 1)}
                                  className="w-20 px-2 py-1 text-center border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                                />
                              </td>
                              <td className="py-2 px-3 text-right">
                                <button
                                  type="button"
                                  onClick={() => removeItem(item.product_id)}
                                  className="text-red-500 hover:text-red-700"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {errors.items && (
                    <p className="text-sm text-red-500">{errors.items}</p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 mt-6">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1"
              disabled={isSaving}
            >
              Batal
            </Button>
            <Button
              type="submit"
              className="flex-1"
              disabled={isSaving || items.length === 0}
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Menyimpan...
                </>
              ) : (
                'Buat Transfer'
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default StockTransferForm;
