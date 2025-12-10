import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Loader2, Search } from 'lucide-react';
import { Button } from '../ui/Button';
import { Supplier, Product } from '../../types';
import { listSuppliers } from '../../api/suppliers';
import { listActiveProducts, searchProducts } from '../../api/products';
import { createPurchaseOrder, CreatePOItemInput, calculatePOTotal } from '../../api/purchaseOrders';
import { LowStockProduct } from '../../api/stock';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';

interface POFormItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
}

interface POFormProps {
  onSave: () => void;
  onCancel: () => void;
  initialItems?: LowStockProduct[];
}

export const POForm: React.FC<POFormProps> = ({ onSave, onCancel, initialItems }) => {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [supplierId, setSupplierId] = useState('');
  const [expectedDate, setExpectedDate] = useState('');
  const [items, setItems] = useState<POFormItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebouncedValue(searchTerm, 300);
  const [showProductSearch, setShowProductSearch] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (initialItems && initialItems.length > 0) {
      const newItems: POFormItem[] = initialItems.map(p => ({
        productId: p.id,
        productName: p.name,
        quantity: p.suggested_order_quantity,
        unitPrice: 0,
      }));
      setItems(prev => [...prev, ...newItems]);
    }
  }, [initialItems]);

  useEffect(() => {
    if (debouncedSearch) {
      handleSearchProducts(debouncedSearch);
    } else {
      loadProducts();
    }
  }, [debouncedSearch]);


  const loadInitialData = async () => {
    setLoadingData(true);
    try {
      const [suppliersData, productsData] = await Promise.all([
        listSuppliers(),
        listActiveProducts(),
      ]);
      setSuppliers(suppliersData);
      setProducts(productsData);
    } catch (err: any) {
      setError(err.message || 'Gagal memuat data');
    } finally {
      setLoadingData(false);
    }
  };

  const loadProducts = async () => {
    try {
      const data = await listActiveProducts();
      setProducts(data);
    } catch (err) {
      console.error('Failed to load products:', err);
    }
  };

  const handleSearchProducts = async (term: string) => {
    try {
      const data = await searchProducts(term);
      setProducts(data);
    } catch (err) {
      console.error('Failed to search products:', err);
    }
  };

  const handleAddItem = (product: Product) => {
    // Check if product already exists
    if (items.some(item => item.productId === product.id)) {
      setError('Produk sudah ada dalam daftar');
      return;
    }

    setItems([
      ...items,
      {
        productId: product.id,
        productName: product.name,
        quantity: 1,
        unitPrice: product.price,
      },
    ]);
    setShowProductSearch(false);
    setSearchTerm('');
    setError(null);
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: 'quantity' | 'unitPrice', value: number) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const totalAmount = calculatePOTotal(
    items.map(item => ({
      productId: item.productId,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
    }))
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!supplierId) {
      setError('Pilih supplier terlebih dahulu');
      return;
    }

    if (items.length === 0) {
      setError('Tambahkan minimal satu produk');
      return;
    }

    // Validate items
    for (let i = 0; i < items.length; i++) {
      if (items[i].quantity <= 0) {
        setError(`Quantity produk "${items[i].productName}" harus lebih dari 0`);
        return;
      }
      if (items[i].unitPrice < 0) {
        setError(`Harga produk "${items[i].productName}" tidak boleh negatif`);
        return;
      }
    }

    setLoading(true);
    try {
      const poItems: CreatePOItemInput[] = items.map(item => ({
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
      }));

      await createPurchaseOrder({
        supplierId,
        expectedDate: expectedDate || undefined,
        items: poItems,
      });

      onSave();
    } catch (err: any) {
      setError(err.message || 'Gagal membuat purchase order');
    } finally {
      setLoading(false);
    }
  };


  if (loadingData) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div className="absolute inset-0 bg-black/50" />
        <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8">
          <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onCancel} />
      <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex justify-between items-center p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold dark:text-white">Buat Purchase Order</h2>
          <button
            onClick={onCancel}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Supplier <span className="text-red-500">*</span>
              </label>
              <select
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="">-- Pilih Supplier --</option>
                {suppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Tanggal Diharapkan
              </label>
              <input
                type="date"
                value={expectedDate}
                onChange={(e) => setExpectedDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
          </div>

          <div className="mb-4">
            <div className="flex justify-between items-center mb-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Daftar Produk <span className="text-red-500">*</span>
              </label>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setShowProductSearch(!showProductSearch)}
              >
                <Plus className="w-4 h-4 mr-1" />
                Tambah Produk
              </Button>
            </div>

            {showProductSearch && (
              <div className="mb-4 p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900">
                <div className="relative mb-3">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Cari produk..."
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                  />
                </div>
                <div className="max-h-48 overflow-y-auto space-y-1">
                  {products.length === 0 ? (
                    <p className="text-sm text-gray-500 text-center py-2">Tidak ada produk</p>
                  ) : (
                    products.map((product) => (
                      <div
                        key={product.id}
                        onClick={() => handleAddItem(product)}
                        className="flex justify-between items-center p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded cursor-pointer"
                      >
                        <div>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">{product.name}</p>
                          <p className="text-xs text-gray-500">Stok: {product.stock_quantity}</p>
                        </div>
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                          Rp {product.price.toLocaleString()}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}


            {items.length === 0 ? (
              <div className="text-center py-8 text-gray-500 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg">
                Belum ada produk. Klik "Tambah Produk" untuk menambahkan.
              </div>
            ) : (
              <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-gray-900">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Produk</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase w-24">Qty</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase w-32">Harga</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase w-32">Subtotal</th>
                      <th className="px-4 py-3 w-12"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {items.map((item, index) => (
                      <tr key={index}>
                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                          {item.productName}
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) => handleItemChange(index, 'quantity', parseInt(e.target.value) || 0)}
                            className="w-full px-2 py-1 text-center border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="number"
                            min="0"
                            value={item.unitPrice}
                            onChange={(e) => handleItemChange(index, 'unitPrice', parseInt(e.target.value) || 0)}
                            className="w-full px-2 py-1 text-right border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                          />
                        </td>
                        <td className="px-4 py-3 text-right text-sm text-gray-900 dark:text-white">
                          Rp {(item.quantity * item.unitPrice).toLocaleString()}
                        </td>
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(index)}
                            className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50 dark:bg-gray-900">
                    <tr>
                      <td colSpan={3} className="px-4 py-3 text-right font-medium text-gray-900 dark:text-white">
                        Total
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-primary-600">
                        Rp {totalAmount.toLocaleString()}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        </form>

        <div className="flex gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
          <Button type="button" variant="outline" onClick={onCancel} className="flex-1">
            Batal
          </Button>
          <Button onClick={handleSubmit} disabled={loading} className="flex-1">
            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Buat PO
          </Button>
        </div>
      </div>
    </div>
  );
};
