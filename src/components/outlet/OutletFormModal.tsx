/**
 * Outlet Form Modal Component
 * 
 * Build form for create/edit outlet
 * Include name, address, phone, email
 * 
 * Requirements: 1.1, 1.3
 */

import React, { useState, useEffect } from 'react';
import { X, Loader2, AlertCircle, Store } from 'lucide-react';
import { Button } from '../ui/Button';
import { Outlet } from '@/types';

interface OutletFormModalProps {
  isOpen: boolean;
  outlet?: Outlet | null;
  onSave: (data: OutletFormData) => Promise<void>;
  onClose: () => void;
}

export interface OutletFormData {
  name: string;
  address?: string;
  phone?: string;
  email?: string;
}

interface FormErrors {
  name?: string;
  email?: string;
  phone?: string;
}

/**
 * Validate email format
 */
function isValidEmail(email: string): boolean {
  if (!email) return true; // Email is optional
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate phone format (Indonesian phone numbers)
 */
function isValidPhone(phone: string): boolean {
  if (!phone) return true; // Phone is optional
  // Allow digits, spaces, dashes, parentheses, and + for country code
  const phoneRegex = /^[+]?[\d\s\-()]{8,20}$/;
  return phoneRegex.test(phone);
}

export const OutletFormModal: React.FC<OutletFormModalProps> = ({
  isOpen,
  outlet,
  onSave,
  onClose,
}) => {
  const isEditMode = !!outlet;

  const [formData, setFormData] = useState<OutletFormData>({
    name: '',
    address: '',
    phone: '',
    email: '',
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSaving, setIsSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Reset form when modal opens/closes or outlet changes
  useEffect(() => {
    if (isOpen) {
      if (outlet) {
        setFormData({
          name: outlet.name,
          address: outlet.address || '',
          phone: outlet.phone || '',
          email: outlet.email || '',
        });
      } else {
        setFormData({
          name: '',
          address: '',
          phone: '',
          email: '',
        });
      }
      setErrors({});
      setSubmitError(null);
    }
  }, [isOpen, outlet]);

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    // Name validation (required)
    if (!formData.name.trim()) {
      newErrors.name = 'Nama outlet wajib diisi';
    } else if (formData.name.trim().length < 2) {
      newErrors.name = 'Nama outlet minimal 2 karakter';
    }

    // Email validation (optional but must be valid if provided)
    if (formData.email && !isValidEmail(formData.email)) {
      newErrors.email = 'Format email tidak valid';
    }

    // Phone validation (optional but must be valid if provided)
    if (formData.phone && !isValidPhone(formData.phone)) {
      newErrors.phone = 'Format nomor telepon tidak valid';
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
      await onSave({
        name: formData.name.trim(),
        address: formData.address?.trim() || undefined,
        phone: formData.phone?.trim() || undefined,
        email: formData.email?.trim() || undefined,
      });
      onClose();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Terjadi kesalahan saat menyimpan';
      setSubmitError(message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleChange = (field: keyof OutletFormData, value: string) => {
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
          <div className="flex items-center gap-2">
            <Store className="w-5 h-5 text-primary-600" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              {isEditMode ? 'Edit Outlet' : 'Tambah Outlet Baru'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Outlet Code (display only for edit mode) */}
        {isEditMode && outlet && (
          <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <span className="text-sm text-gray-500 dark:text-gray-400">Kode Outlet: </span>
            <span className="font-mono font-medium text-primary-600 dark:text-primary-400">
              {outlet.code}
            </span>
          </div>
        )}

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
            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Nama Outlet <span className="text-red-500">*</span>
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
                placeholder="Masukkan nama outlet"
              />
              {errors.name && (
                <p className="mt-1 text-sm text-red-500">{errors.name}</p>
              )}
            </div>

            {/* Address */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Alamat
              </label>
              <textarea
                value={formData.address}
                onChange={(e) => handleChange('address', e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
                placeholder="Masukkan alamat outlet"
              />
            </div>

            {/* Phone */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Nomor Telepon
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => handleChange('phone', e.target.value)}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white ${
                  errors.phone
                    ? 'border-red-500 dark:border-red-500'
                    : 'border-gray-300 dark:border-gray-600'
                }`}
                placeholder="Contoh: 021-1234567"
              />
              {errors.phone && (
                <p className="mt-1 text-sm text-red-500">{errors.phone}</p>
              )}
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Email
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => handleChange('email', e.target.value)}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white ${
                  errors.email
                    ? 'border-red-500 dark:border-red-500'
                    : 'border-gray-300 dark:border-gray-600'
                }`}
                placeholder="outlet@example.com"
              />
              {errors.email && (
                <p className="mt-1 text-sm text-red-500">{errors.email}</p>
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

export default OutletFormModal;
