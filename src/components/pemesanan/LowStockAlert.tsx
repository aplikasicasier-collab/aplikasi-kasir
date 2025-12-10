import React, { useState, useEffect } from 'react';
import { AlertTriangle, Plus, Loader2, Package } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Button } from '../ui/Button';
import { LowStockProduct, getLowStockProducts } from '../../api/stock';

interface LowStockAlertProps {
  onAddToOrder: (products: LowStockProduct[]) => void;
}

export const LowStockAlert: React.FC<LowStockAlertProps> = ({ onAddToOrder }) => {
  const [products, setProducts] = useState<LowStockProduct[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadLowStockProducts();
  }, []);

  const loadLowStockProducts = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getLowStockProducts();
      setProducts(data);
    } catch (err: any) {
      setError(err.message || 'Gagal memuat data produk');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleSelect = (productId: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(productId)) {
      newSelected.delete(productId);
    } else {
      newSelected.add(productId);
    }
    setSelectedIds(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedIds.size === products.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(products.map(p => p.id)));
    }
  };

  const handleAddToOrder = () => {
    const selectedProducts = products.filter(p => selectedIds.has(p.id));
    if (selectedProducts.length > 0) {
      onAddToOrder(selectedProducts);
      setSelectedIds(new Set());
    }
  };


  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center text-amber-600">
            <AlertTriangle className="w-5 h-5 mr-2" />
            Stok Menipis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center text-amber-600">
            <AlertTriangle className="w-5 h-5 mr-2" />
            Stok Menipis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4 text-red-500">{error}</div>
          <Button variant="outline" onClick={loadLowStockProducts} className="w-full">
            Coba Lagi
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (products.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center text-green-600">
            <Package className="w-5 h-5 mr-2" />
            Stok Aman
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-500 text-sm text-center py-4">
            Semua produk memiliki stok yang cukup.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle className="flex items-center text-amber-600">
            <AlertTriangle className="w-5 h-5 mr-2" />
            Stok Menipis ({products.length})
          </CardTitle>
          {products.length > 0 && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleSelectAll}
            >
              {selectedIds.size === products.length ? 'Batal Pilih' : 'Pilih Semua'}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {products.map((product) => (
            <div
              key={product.id}
              className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                selectedIds.has(product.id)
                  ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                  : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
              }`}
              onClick={() => handleToggleSelect(product.id)}
            >
              <input
                type="checkbox"
                checked={selectedIds.has(product.id)}
                onChange={() => handleToggleSelect(product.id)}
                className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
              />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 dark:text-white truncate">
                  {product.name}
                </p>
                <div className="flex gap-4 text-xs text-gray-500 dark:text-gray-400">
                  <span>Stok: <span className="text-red-600 font-medium">{product.current_stock}</span></span>
                  <span>Min: {product.min_stock}</span>
                  <span className="text-primary-600">Saran: +{product.suggested_order_quantity}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {selectedIds.size > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <Button onClick={handleAddToOrder} className="w-full">
              <Plus className="w-4 h-4 mr-2" />
              Tambah {selectedIds.size} Produk ke PO
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
