/**
 * Return Policy Form Component
 * 
 * Form for configuring return policy settings:
 * - Max return days input
 * - Non-returnable categories multi-select
 * 
 * Requirements: 3.1, 3.3
 */

import React, { useState, useEffect } from 'react';
import { Loader2, AlertCircle, Save, Calendar, Tag, X, Check } from 'lucide-react';
import { Button } from '../ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { ReturnPolicy, Category } from '@/types';
import { getReturnPolicy, updateReturnPolicy, UpdateReturnPolicyInput } from '@/api/returnPolicies';
import { listCategories } from '@/api/categories';

interface ReturnPolicyFormProps {
  onSaved?: () => void;
}

interface FormErrors {
  max_return_days?: string;
  non_returnable_categories?: string;
}

export const ReturnPolicyForm: React.FC<ReturnPolicyFormProps> = ({ onSaved }) => {
  const [policy, setPolicy] = useState<ReturnPolicy | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Form state
  const [maxReturnDays, setMaxReturnDays] = useState<number>(7);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [requireReceipt, setRequireReceipt] = useState<boolean>(true);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);

  // Load policy and categories on mount
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [policyData, categoriesData] = await Promise.all([
        getReturnPolicy(),
        listCategories(),
      ]);

      setCategories(categoriesData);
      
      if (policyData) {
        setPolicy(policyData);
        setMaxReturnDays(policyData.max_return_days);
        setSelectedCategories(policyData.non_returnable_categories || []);
        setRequireReceipt(policyData.require_receipt);
      }
    } catch (err: any) {
      console.error('Failed to load data:', err);
      setSubmitError('Gagal memuat data kebijakan retur');
    } finally {
      setLoading(false);
    }
  };

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!maxReturnDays || maxReturnDays < 1) {
      newErrors.max_return_days = 'Batas hari retur minimal 1 hari';
    } else if (maxReturnDays > 365) {
      newErrors.max_return_days = 'Batas hari retur maksimal 365 hari';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    setSuccessMessage(null);

    if (!validateForm()) {
      return;
    }

    setSaving(true);
    try {
      const input: UpdateReturnPolicyInput = {
        max_return_days: maxReturnDays,
        non_returnable_categories: selectedCategories,
        require_receipt: requireReceipt,
      };

      const updatedPolicy = await updateReturnPolicy(input);
      setPolicy(updatedPolicy);
      setSuccessMessage('Kebijakan retur berhasil disimpan');
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(null), 3000);
      
      onSaved?.();
    } catch (error: any) {
      setSubmitError(error.message || 'Terjadi kesalahan saat menyimpan');
    } finally {
      setSaving(false);
    }
  };

  const toggleCategory = (categoryId: string) => {
    setSelectedCategories(prev => {
      if (prev.includes(categoryId)) {
        return prev.filter(id => id !== categoryId);
      }
      return [...prev, categoryId];
    });
  };

  const removeCategory = (categoryId: string) => {
    setSelectedCategories(prev => prev.filter(id => id !== categoryId));
  };

  const getCategoryName = (categoryId: string): string => {
    const category = categories.find(c => c.id === categoryId);
    return category?.name || 'Unknown';
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Tag className="w-5 h-5 mr-2 text-primary-600" />
          Kebijakan Retur
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Submit Error */}
        {submitError && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
            <span className="text-sm text-red-700 dark:text-red-400">{submitError}</span>
          </div>
        )}

        {/* Success Message */}
        {successMessage && (
          <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg flex items-center gap-2">
            <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
            <span className="text-sm text-green-700 dark:text-green-400">{successMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Max Return Days */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              <div className="flex items-center">
                <Calendar className="w-4 h-4 mr-1 text-gray-400" />
                Batas Waktu Retur (Hari)
              </div>
            </label>
            <input
              type="number"
              min="1"
              max="365"
              value={maxReturnDays}
              onChange={(e) => {
                setMaxReturnDays(parseInt(e.target.value) || 0);
                if (errors.max_return_days) {
                  setErrors(prev => ({ ...prev, max_return_days: undefined }));
                }
              }}
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white ${
                errors.max_return_days
                  ? 'border-red-500 dark:border-red-500'
                  : 'border-gray-300 dark:border-gray-600'
              }`}
              placeholder="7"
            />
            {errors.max_return_days && (
              <p className="mt-1 text-sm text-red-500">{errors.max_return_days}</p>
            )}
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Retur setelah batas waktu ini memerlukan persetujuan manager
            </p>
          </div>


          {/* Non-Returnable Categories */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              <div className="flex items-center">
                <Tag className="w-4 h-4 mr-1 text-gray-400" />
                Kategori Tidak Dapat Diretur
              </div>
            </label>
            
            {/* Selected Categories Tags */}
            {selectedCategories.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2">
                {selectedCategories.map(categoryId => (
                  <span
                    key={categoryId}
                    className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-full text-sm"
                  >
                    {getCategoryName(categoryId)}
                    <button
                      type="button"
                      onClick={() => removeCategory(categoryId)}
                      className="hover:bg-red-200 dark:hover:bg-red-800 rounded-full p-0.5"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* Category Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-left bg-white dark:bg-gray-700 text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-600 focus:ring-2 focus:ring-primary-500"
              >
                {selectedCategories.length === 0
                  ? 'Pilih kategori...'
                  : `${selectedCategories.length} kategori dipilih`}
              </button>

              {showCategoryDropdown && (
                <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                  {categories.length === 0 ? (
                    <p className="text-sm text-gray-500 text-center py-4">
                      Tidak ada kategori
                    </p>
                  ) : (
                    categories.map(category => (
                      <div
                        key={category.id}
                        onClick={() => toggleCategory(category.id)}
                        className="flex items-center justify-between px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer border-b last:border-b-0 border-gray-100 dark:border-gray-700"
                      >
                        <span className="text-gray-900 dark:text-white">
                          {category.name}
                        </span>
                        {selectedCategories.includes(category.id) && (
                          <Check className="w-4 h-4 text-primary-600" />
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
            
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Produk dalam kategori ini tidak dapat diretur
            </p>
          </div>

          {/* Require Receipt */}
          <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
            <div>
              <p className="font-medium text-gray-900 dark:text-white">
                Wajib Struk Asli
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Retur harus menyertakan nomor transaksi asli
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={requireReceipt}
                onChange={(e) => setRequireReceipt(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 dark:peer-focus:ring-primary-800 rounded-full peer dark:bg-gray-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary-600"></div>
            </label>
          </div>

          {/* Save Button */}
          <div className="flex justify-end pt-4 border-t border-gray-200 dark:border-gray-700">
            <Button
              type="submit"
              disabled={saving}
              className="bg-primary-600 hover:bg-primary-700"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Menyimpan...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Simpan Kebijakan
                </>
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

export default ReturnPolicyForm;
