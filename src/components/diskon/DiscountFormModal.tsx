/**
 * Discount Form Modal Component
 * 
 * Build form for create/edit discount
 * Include product selection, discount type, value
 * Add validation feedback
 * 
 * Requirements: 1.1, 1.2, 1.3, 3.3
 */

import React, { useState, useEffect } from 'react';
import { X, Loader2, AlertCircle, Search, Percent, DollarSign } from 'lucide-react';
import { Button } from '../ui/Button';
import { Discount, DiscountType, Product } from '@/types';
import { validateDiscount } from '@/api/discounts';
import { listActiveProducts, searchProducts } from '@/api/products';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';

interface DiscountFormModalProps {
  isOpen: boolean;
  discount?: Discount | null;
  onSave: (data: DiscountFormData) => Promise<void>;
  onClose: () => void;
}

export interface DiscountFormData {
  product_id: string;
  discount_type: DiscountType;
  discount_value: number;
}

interface FormErrors {
  product_id?: string;
  discount_type?: string;
  discount_value?: string;
}

export const DiscountFormModal: React.FC<DiscountFormModalProps> = ({
  isOpen,
  discount,
  onSave,
  onClose,
}) => {
  const isEditMode = !!discount;

  const [formData, setFormData] = useState<DiscountFormData>({
    product_id: '',
    discount_type: 'percentage',
    discount_value: 0,
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSaving, setIsSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);


  // Product search state
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showProductSearch, setShowProductSearch] = useState(false);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const debouncedSearch = useDebouncedValue(searchTerm, 300);

  // Load products on mount
  useEffect(() => {
    if (isOpen) {
      loadProducts();
    }
  }, [isOpen]);

  // Search products when search term changes
  useEffect(() => {
    if (debouncedSearch) {
      handleSearchProducts(debouncedSearch);
    } else if (isOpen) {
      loadProducts();
    }
  }, [debouncedSearch]);

  // Reset form when modal opens/closes or discount changes
  useEffect(() => {
    if (isOpen) {
      if (discount) {
        setFormData({
          product_id: discount.product_id,
          discount_type: discount.discount_type,
          discount_value: discount.discount_value,
        });
        // Set selected product for display
        setSelectedProduct({
          id: discount.product_id,
          name: discount.product_name || 'Produk',
          price: 0, // Will be loaded
        } as Product);
      } else {
        setFormData({
          product_id: '',
          discount_type: 'percentage',
          discount_value: 0,
        });
        setSelectedProduct(null);
      }
      setErrors({});
      setSubmitError(null);
      setSearchTerm('');
      setShowProductSearch(false);
    }
  }, [isOpen, discount]);

  const loadProducts = async () => {
    setLoadingProducts(true);
    try {
      const data = await listActiveProducts();
      setProducts(data);
    } catch (err) {
      console.error('Failed to load products:', err);
    } finally {
      setLoadingProducts(false);
    }
  };

  const handleSearchProducts = async (term: string) => {
    setLoadingProducts(true);
    try {
      const data = await searchProducts(term);
      setProducts(data);
    } catch (err) {
      console.error('Failed to search products:', err);
    } finally {
      setLoadingProducts(false);
    }
  };

  const handleSelectProduct = (product: Product) => {
    setSelectedProduct(product);
    setFormData(prev => ({ ...prev, product_id: product.id }));
    setShowProductSearch(false);
    setSearchTerm('');
    if (errors.product_id) {
      setErrors(prev => ({ ...prev, product_id: undefined }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    // Product validation
    if (!formData.product_id) {
      newErrors.product_id = 'Pilih produk terlebih dahulu';
    }

    // Discount type validation
    if (!formData.discount_type) {
      newErrors.discount_type = 'Pilih tipe diskon';
    }

    // Discount value validation using API validation
    const productPrice = selectedProduct?.price || 0;
    const validation = validateDiscount(
      formData.discount_type,
      formData.discount_value,
      productPrice
    );
    
    if (!validation.valid) {
      newErrors.discount_value = validation.error;
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
      await onSave(formData);
      onClose();
    } catch (error: any) {
      setSubmitError(error.message || 'Terjadi kesalahan saat menyimpan');
    } finally {
      setIsSaving(false);
    }
  };

  const handleChange = (field: keyof DiscountFormData, value: string | number) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field as keyof FormErrors]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  if (!isOpen) return null;


  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4 p-6 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            {isEditMode ? 'Edit Diskon' : 'Tambah Diskon Baru'}
          </h2>
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
            {/* Product Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Produk <span className="text-red-500">*</span>
              </label>
              
              {selectedProduct && !showProductSearch ? (
                <div className="flex items-center justify-between p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700">
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">{selectedProduct.name}</p>
                    {selectedProduct.price > 0 && (
                      <p className="text-sm text-gray-500">Rp {selectedProduct.price.toLocaleString()}</p>
                    )}
                  </div>
                  {!isEditMode && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => setShowProductSearch(true)}
                    >
                      Ganti
                    </Button>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Cari produk..."
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      autoFocus
                    />
                  </div>
                  
                  <div className="max-h-48 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg">
                    {loadingProducts ? (
                      <div className="flex items-center justify-center py-4">
                        <Loader2 className="w-5 h-5 animate-spin text-primary-600" />
                      </div>
                    ) : products.length === 0 ? (
                      <p className="text-sm text-gray-500 text-center py-4">Tidak ada produk</p>
                    ) : (
                      products.map((product) => (
                        <div
                          key={product.id}
                          onClick={() => handleSelectProduct(product)}
                          className="flex justify-between items-center p-3 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer border-b last:border-b-0 border-gray-100 dark:border-gray-700"
                        >
                          <div>
                            <p className="font-medium text-gray-900 dark:text-white">{product.name}</p>
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
              
              {errors.product_id && (
                <p className="mt-1 text-sm text-red-500">{errors.product_id}</p>
              )}
            </div>

            {/* Discount Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Tipe Diskon <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleChange('discount_type', 'percentage')}
                  className={`flex items-center justify-center gap-2 p-3 border rounded-lg transition-colors ${
                    formData.discount_type === 'percentage'
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400'
                      : 'border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  <Percent className="w-4 h-4" />
                  <span>Persentase</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleChange('discount_type', 'nominal')}
                  className={`flex items-center justify-center gap-2 p-3 border rounded-lg transition-colors ${
                    formData.discount_type === 'nominal'
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400'
                      : 'border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  <DollarSign className="w-4 h-4" />
                  <span>Nominal</span>
                </button>
              </div>
              {errors.discount_type && (
                <p className="mt-1 text-sm text-red-500">{errors.discount_type}</p>
              )}
            </div>

            {/* Discount Value */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Nilai Diskon <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  step={formData.discount_type === 'percentage' ? '1' : '1000'}
                  value={formData.discount_value || ''}
                  onChange={(e) => handleChange('discount_value', parseFloat(e.target.value) || 0)}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white ${
                    errors.discount_value
                      ? 'border-red-500 dark:border-red-500'
                      : 'border-gray-300 dark:border-gray-600'
                  }`}
                  placeholder={formData.discount_type === 'percentage' ? 'Contoh: 10' : 'Contoh: 5000'}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                  {formData.discount_type === 'percentage' ? '%' : 'Rp'}
                </span>
              </div>
              {errors.discount_value && (
                <p className="mt-1 text-sm text-red-500">{errors.discount_value}</p>
              )}
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {formData.discount_type === 'percentage'
                  ? 'Masukkan nilai antara 1-100'
                  : 'Masukkan nilai lebih dari 0 dan kurang dari harga produk'}
              </p>
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
              disabled={isSaving}
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Menyimpan...
                </>
              ) : (
                'Simpan'
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default DiscountFormModal;
