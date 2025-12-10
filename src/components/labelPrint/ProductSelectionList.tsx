/**
 * Product Selection List Component
 * Multi-select products for label printing with quantity per product
 * 
 * Requirements: 6.4 - Batch printing with quantity per product
 */

import React, { useState, useEffect } from 'react';
import { Search, Package, Check, Minus, Plus } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Product } from '../../types';
import { listActiveProducts, searchProducts } from '../../api/products';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';

export interface SelectedProduct {
  product: Product;
  quantity: number;
}

export interface ProductSelectionListProps {
  selectedProducts: SelectedProduct[];
  onSelectionChange: (products: SelectedProduct[]) => void;
}

export const ProductSelectionList: React.FC<ProductSelectionListProps> = ({
  selectedProducts,
  onSelectionChange,
}) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebouncedValue(searchTerm, 300);

  useEffect(() => {
    loadProducts();
  }, []);

  useEffect(() => {
    if (debouncedSearch) {
      handleSearch(debouncedSearch);
    } else {
      loadProducts();
    }
  }, [debouncedSearch]);

  const loadProducts = async () => {
    setIsLoading(true);
    try {
      const data = await listActiveProducts();
      // Filter only products with barcodes
      setProducts(data.filter(p => p.barcode));
    } catch (error) {
      console.error('Failed to load products:', error);
    } finally {
      setIsLoading(false);
    }
  };


  const handleSearch = async (term: string) => {
    setIsLoading(true);
    try {
      const data = await searchProducts(term);
      // Filter only products with barcodes
      setProducts(data.filter(p => p.barcode));
    } catch (error) {
      console.error('Failed to search products:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const isSelected = (productId: string): boolean => {
    return selectedProducts.some(sp => sp.product.id === productId);
  };

  const getSelectedQuantity = (productId: string): number => {
    const selected = selectedProducts.find(sp => sp.product.id === productId);
    return selected?.quantity || 0;
  };

  const toggleProduct = (product: Product) => {
    if (isSelected(product.id)) {
      // Remove from selection
      onSelectionChange(selectedProducts.filter(sp => sp.product.id !== product.id));
    } else {
      // Add to selection with default quantity 1
      onSelectionChange([...selectedProducts, { product, quantity: 1 }]);
    }
  };

  const updateQuantity = (productId: string, delta: number) => {
    const updated = selectedProducts.map(sp => {
      if (sp.product.id === productId) {
        const newQty = Math.max(1, sp.quantity + delta);
        return { ...sp, quantity: newQty };
      }
      return sp;
    });
    onSelectionChange(updated);
  };

  const setQuantity = (productId: string, quantity: number) => {
    const updated = selectedProducts.map(sp => {
      if (sp.product.id === productId) {
        return { ...sp, quantity: Math.max(1, quantity) };
      }
      return sp;
    });
    onSelectionChange(updated);
  };

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
        <input
          type="text"
          placeholder="Cari produk dengan barcode..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        />
      </div>

      {/* Product List */}
      <div className="max-h-96 overflow-y-auto space-y-2">
        {isLoading ? (
          <div className="text-center py-8 text-gray-500">Memuat produk...</div>
        ) : products.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            {searchTerm ? 'Tidak ada produk ditemukan' : 'Tidak ada produk dengan barcode'}
          </div>
        ) : (
          <AnimatePresence>
            {products.map((product) => {
              const selected = isSelected(product.id);
              const quantity = getSelectedQuantity(product.id);

              return (
                <motion.div
                  key={product.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className={`p-3 rounded-lg border-2 transition-all cursor-pointer ${
                    selected
                      ? 'border-primary-500 bg-primary-50'
                      : 'border-gray-200 hover:border-gray-300 bg-white'
                  }`}
                  onClick={() => !selected && toggleProduct(product)}
                >
                  <div className="flex items-center gap-3">
                    {/* Checkbox */}
                    <div
                      className={`w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 ${
                        selected
                          ? 'bg-primary-500 text-white'
                          : 'border-2 border-gray-300'
                      }`}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleProduct(product);
                      }}
                    >
                      {selected && <Check className="w-4 h-4" />}
                    </div>

                    {/* Product Image */}
                    <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0">
                      {product.image_url ? (
                        <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
                      ) : (
                        <Package className="w-6 h-6 text-gray-400" />
                      )}
                    </div>

                    {/* Product Info */}
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-gray-900 truncate">{product.name}</h4>
                      <p className="text-sm text-gray-500">{product.barcode}</p>
                      <p className="text-sm font-medium text-primary-600">
                        Rp {product.price.toLocaleString()}
                      </p>
                    </div>

                    {/* Quantity Controls */}
                    {selected && (
                      <div 
                        className="flex items-center gap-2"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          onClick={() => updateQuantity(product.id, -1)}
                          className="w-8 h-8 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center"
                          disabled={quantity <= 1}
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                        <input
                          type="number"
                          min="1"
                          value={quantity}
                          onChange={(e) => setQuantity(product.id, parseInt(e.target.value) || 1)}
                          className="w-16 text-center border rounded-lg py-1"
                        />
                        <button
                          type="button"
                          onClick={() => updateQuantity(product.id, 1)}
                          className="w-8 h-8 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>

      {/* Selection Summary */}
      {selectedProducts.length > 0 && (
        <div className="p-3 bg-primary-50 rounded-lg border border-primary-200">
          <p className="text-sm text-primary-700">
            <span className="font-medium">{selectedProducts.length}</span> produk dipilih, 
            total <span className="font-medium">{selectedProducts.reduce((sum, sp) => sum + sp.quantity, 0)}</span> label
          </p>
        </div>
      )}
    </div>
  );
};
