/**
 * Promo Form Modal Component
 * 
 * Build form for create/edit promo
 * Include name, description, dates, discount details
 * Include product multi-select
 * Include optional minimum purchase
 * 
 * Requirements: 2.1, 2.2, 2.3, 6.1
 */

import React, { useState, useEffect } from 'react';
import { X, Loader2, AlertCircle, Search, Percent, DollarSign, Plus, Trash2, Calendar } from 'lucide-react';
import { Button } from '../ui/Button';
import { DiscountType, Product } from '@/types';
import { Promo, validatePromoDateRange, PromoProduct } from '@/api/promos';
import { validateDiscount } from '@/api/discounts';
import { listActiveProducts, searchProducts } from '@/api/products';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';

interface PromoFormModalProps {
  isOpen: boolean;
  promo?: Promo | null;
  onSave: (data: PromoFormData) => Promise<void>;
  onClose: () => void;
}

export interface PromoFormData {
  name: string;
  description?: string;
  start_date: string;
  end_date: string;
  discount_type: DiscountType;
  discount_value: number;
  min_purchase?: number;
  product_ids: string[];
}

interface FormErrors {
  name?: string;
  start_date?: string;
  end_date?: string;
  discount_type?: string;
  discount_value?: string;
  min_purchase?: string;
  product_ids?: string;
}

interface SelectedProduct {
  id: string;
  name: string;
}


export const PromoFormModal: React.FC<PromoFormModalProps> = ({
  isOpen,
  promo,
  onSave,
  onClose,
}) => {
  const isEditMode = !!promo;

  const [formData, setFormData] = useState<PromoFormData>({
    name: '',
    description: '',
    start_date: '',
    end_date: '',
    discount_type: 'percentage',
    discount_value: 0,
    min_purchase: undefined,
    product_ids: [],
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSaving, setIsSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Product search state
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<SelectedProduct[]>([]);
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

  // Reset form when modal opens/closes or promo changes
  useEffect(() => {
    if (isOpen) {
      if (promo) {
        const promoProducts = promo.products as PromoProduct[] | undefined;
        setFormData({
          name: promo.name,
          description: promo.description || '',
          start_date: promo.start_date.split('T')[0],
          end_date: promo.end_date.split('T')[0],
          discount_type: promo.discount_type,
          discount_value: promo.discount_value,
          min_purchase: promo.min_purchase || undefined,
          product_ids: promoProducts?.map(p => p.product_id) || [],
        });
        // Set selected products for display
        setSelectedProducts(
          promoProducts?.map(p => ({
            id: p.product_id,
            name: p.product_name || 'Produk',
          })) || []
        );
      } else {
        const today = new Date().toISOString().split('T')[0];
        setFormData({
          name: '',
          description: '',
          start_date: today,
          end_date: '',
          discount_type: 'percentage',
          discount_value: 0,
          min_purchase: undefined,
          product_ids: [],
        });
        setSelectedProducts([]);
      }
      setErrors({});
      setSubmitError(null);
      setSearchTerm('');
      setShowProductSearch(false);
    }
  }, [isOpen, promo]);

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

  const handleAddProduct = (product: Product) => {
    if (selectedProducts.some(p => p.id === product.id)) {
      return; // Already selected
    }
    
    const newSelected = [...selectedProducts, { id: product.id, name: product.name }];
    setSelectedProducts(newSelected);
    setFormData(prev => ({
      ...prev,
      product_ids: newSelected.map(p => p.id),
    }));
    
    if (errors.product_ids) {
      setErrors(prev => ({ ...prev, product_ids: undefined }));
    }
  };

  const handleRemoveProduct = (productId: string) => {
    const newSelected = selectedProducts.filter(p => p.id !== productId);
    setSelectedProducts(newSelected);
    setFormData(prev => ({
      ...prev,
      product_ids: newSelected.map(p => p.id),
    }));
  };


  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    // Name validation
    if (!formData.name.trim()) {
      newErrors.name = 'Nama promo wajib diisi';
    }

    // Date validation
    if (!formData.start_date) {
      newErrors.start_date = 'Tanggal mulai wajib diisi';
    }
    if (!formData.end_date) {
      newErrors.end_date = 'Tanggal berakhir wajib diisi';
    }
    if (formData.start_date && formData.end_date) {
      const dateValidation = validatePromoDateRange(formData.start_date, formData.end_date);
      if (!dateValidation.valid) {
        newErrors.end_date = dateValidation.error;
      }
    }

    // Discount type validation
    if (!formData.discount_type) {
      newErrors.discount_type = 'Pilih tipe diskon';
    }

    // Discount value validation
    const validation = validateDiscount(formData.discount_type, formData.discount_value);
    if (!validation.valid) {
      newErrors.discount_value = validation.error;
    }

    // Minimum purchase validation (optional but must be positive if provided)
    if (formData.min_purchase !== undefined && formData.min_purchase <= 0) {
      newErrors.min_purchase = 'Minimum pembelian harus lebih dari 0';
    }

    // Products validation
    if (formData.product_ids.length === 0) {
      newErrors.product_ids = 'Pilih minimal satu produk';
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

  const handleChange = (field: keyof PromoFormData, value: string | number | undefined) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field as keyof FormErrors]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  // Filter out already selected products
  const availableProducts = products.filter(
    p => !selectedProducts.some(sp => sp.id === p.id)
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            {isEditMode ? 'Edit Promo' : 'Tambah Promo Baru'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6">
          {/* Submit Error */}
          {submitError && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
              <span className="text-sm text-red-700 dark:text-red-400">{submitError}</span>
            </div>
          )}

          <div className="space-y-4">
            {/* Promo Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Nama Promo <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white ${
                  errors.name
                    ? 'border-red-500 dark:border-red-500'
                    : 'border-gray-300 dark:border-gray-600'
                }`}
                placeholder="Contoh: Promo Akhir Tahun"
              />
              {errors.name && (
                <p className="mt-1 text-sm text-red-500">{errors.name}</p>
              )}
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Deskripsi
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => handleChange('description', e.target.value)}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="Deskripsi promo (opsional)"
              />
            </div>

            {/* Date Range */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  <Calendar className="w-4 h-4 inline mr-1" />
                  Tanggal Mulai <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => handleChange('start_date', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white ${
                    errors.start_date
                      ? 'border-red-500 dark:border-red-500'
                      : 'border-gray-300 dark:border-gray-600'
                  }`}
                />
                {errors.start_date && (
                  <p className="mt-1 text-sm text-red-500">{errors.start_date}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  <Calendar className="w-4 h-4 inline mr-1" />
                  Tanggal Berakhir <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={formData.end_date}
                  onChange={(e) => handleChange('end_date', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white ${
                    errors.end_date
                      ? 'border-red-500 dark:border-red-500'
                      : 'border-gray-300 dark:border-gray-600'
                  }`}
                />
                {errors.end_date && (
                  <p className="mt-1 text-sm text-red-500">{errors.end_date}</p>
                )}
              </div>
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
            </div>

            {/* Minimum Purchase (Optional) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Minimum Pembelian (Opsional)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">Rp</span>
                <input
                  type="number"
                  min="0"
                  step="1000"
                  value={formData.min_purchase || ''}
                  onChange={(e) => handleChange('min_purchase', e.target.value ? parseFloat(e.target.value) : undefined)}
                  className={`w-full pl-10 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white ${
                    errors.min_purchase
                      ? 'border-red-500 dark:border-red-500'
                      : 'border-gray-300 dark:border-gray-600'
                  }`}
                  placeholder="Contoh: 100000"
                />
              </div>
              {errors.min_purchase && (
                <p className="mt-1 text-sm text-red-500">{errors.min_purchase}</p>
              )}
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Kosongkan jika tidak ada minimum pembelian
              </p>
            </div>

            {/* Product Selection */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Produk <span className="text-red-500">*</span>
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

              {/* Product Search */}
              {showProductSearch && (
                <div className="mb-3 p-3 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900">
                  <div className="relative mb-2">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Cari produk..."
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                    />
                  </div>
                  <div className="max-h-40 overflow-y-auto">
                    {loadingProducts ? (
                      <div className="flex items-center justify-center py-4">
                        <Loader2 className="w-5 h-5 animate-spin text-primary-600" />
                      </div>
                    ) : availableProducts.length === 0 ? (
                      <p className="text-sm text-gray-500 text-center py-2">
                        {products.length === 0 ? 'Tidak ada produk' : 'Semua produk sudah dipilih'}
                      </p>
                    ) : (
                      availableProducts.map((product) => (
                        <div
                          key={product.id}
                          onClick={() => handleAddProduct(product)}
                          className="flex justify-between items-center p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded cursor-pointer"
                        >
                          <span className="text-sm text-gray-900 dark:text-white">{product.name}</span>
                          <span className="text-xs text-gray-500">Rp {product.price.toLocaleString()}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* Selected Products */}
              {selectedProducts.length === 0 ? (
                <div className="text-center py-4 text-gray-500 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg">
                  Belum ada produk dipilih
                </div>
              ) : (
                <div className="space-y-2">
                  {selectedProducts.map((product) => (
                    <div
                      key={product.id}
                      className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700 rounded-lg"
                    >
                      <span className="text-sm text-gray-900 dark:text-white">{product.name}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveProduct(product.id)}
                        className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {errors.product_ids && (
                <p className="mt-1 text-sm text-red-500">{errors.product_ids}</p>
              )}
            </div>
          </div>
        </form>

        {/* Actions */}
        <div className="flex gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
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
            onClick={handleSubmit}
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
      </div>
    </div>
  );
};

export default PromoFormModal;
