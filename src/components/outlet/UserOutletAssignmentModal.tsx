/**
 * User Outlet Assignment Modal Component
 * 
 * Multi-select outlets for user
 * Set default outlet option
 * 
 * Requirements: 2.1, 2.2, 7.1
 */

import React, { useState, useEffect } from 'react';
import { X, Loader2, AlertCircle, Store, Check, Star } from 'lucide-react';
import { Button } from '../ui/Button';
import { Outlet, User } from '@/types';
import { getOutlets } from '@/api/outlets';
import { getUserOutletAssignments } from '@/api/userOutlets';

interface UserOutletAssignmentModalProps {
  isOpen: boolean;
  user: User | null;
  onSave: (data: UserOutletAssignmentData) => Promise<void>;
  onClose: () => void;
}

export interface UserOutletAssignmentData {
  user_id: string;
  outlet_ids: string[];
  default_outlet_id?: string;
}

export const UserOutletAssignmentModal: React.FC<UserOutletAssignmentModalProps> = ({
  isOpen,
  user,
  onSave,
  onClose,
}) => {
  const [allOutlets, setAllOutlets] = useState<Outlet[]>([]);
  const [selectedOutletIds, setSelectedOutletIds] = useState<Set<string>>(new Set());
  const [defaultOutletId, setDefaultOutletId] = useState<string | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load outlets and current assignments when modal opens
  useEffect(() => {
    if (isOpen && user) {
      loadData();
    }
  }, [isOpen, user]);

  const loadData = async () => {
    if (!user) return;

    setIsLoading(true);
    setError(null);

    try {
      // Load all active outlets
      const outlets = await getOutlets(false);
      setAllOutlets(outlets);

      // Load current user assignments
      const assignments = await getUserOutletAssignments(user.id);
      const assignedIds = new Set(assignments.map(a => a.outlet_id));
      setSelectedOutletIds(assignedIds);

      // Find default outlet
      const defaultAssignment = assignments.find(a => a.is_default);
      setDefaultOutletId(defaultAssignment?.outlet_id);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Gagal memuat data outlet';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleOutlet = (outletId: string) => {
    setSelectedOutletIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(outletId)) {
        newSet.delete(outletId);
        // If removing the default outlet, clear default
        if (defaultOutletId === outletId) {
          setDefaultOutletId(undefined);
        }
      } else {
        newSet.add(outletId);
      }
      return newSet;
    });
  };

  const handleSetDefault = (outletId: string) => {
    // Can only set default if outlet is selected
    if (selectedOutletIds.has(outletId)) {
      setDefaultOutletId(outletId === defaultOutletId ? undefined : outletId);
    }
  };

  const handleSelectAll = () => {
    if (selectedOutletIds.size === allOutlets.length) {
      // Deselect all
      setSelectedOutletIds(new Set());
      setDefaultOutletId(undefined);
    } else {
      // Select all
      setSelectedOutletIds(new Set(allOutlets.map(o => o.id)));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) return;

    if (selectedOutletIds.size === 0) {
      setError('Pilih minimal satu outlet');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      await onSave({
        user_id: user.id,
        outlet_ids: Array.from(selectedOutletIds),
        default_outlet_id: defaultOutletId,
      });
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Gagal menyimpan assignment';
      setError(message);
    } finally {
      setIsSaving(false);
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
      <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-lg w-full mx-4 p-6 max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Store className="w-5 h-5 text-primary-600" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Assign Outlet
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* User Info */}
        {user && (
          <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <p className="text-sm text-gray-500 dark:text-gray-400">User:</p>
            <p className="font-medium text-gray-900 dark:text-white">{user.full_name}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">{user.email}</p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
            <span className="text-sm text-red-700 dark:text-red-400">{error}</span>
          </div>
        )}

        {/* Content */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
            {/* Select All */}
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {selectedOutletIds.size} dari {allOutlets.length} outlet dipilih
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleSelectAll}
              >
                {selectedOutletIds.size === allOutlets.length ? 'Hapus Semua' : 'Pilih Semua'}
              </Button>
            </div>

            {/* Outlet List */}
            <div className="flex-1 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg divide-y divide-gray-200 dark:divide-gray-700 mb-4">
              {allOutlets.length === 0 ? (
                <div className="p-4 text-center text-gray-500 dark:text-gray-400">
                  Tidak ada outlet tersedia
                </div>
              ) : (
                allOutlets.map((outlet) => {
                  const isSelected = selectedOutletIds.has(outlet.id);
                  const isDefault = defaultOutletId === outlet.id;

                  return (
                    <div
                      key={outlet.id}
                      className={`flex items-center gap-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${
                        isSelected ? 'bg-primary-50 dark:bg-primary-900/20' : ''
                      }`}
                    >
                      {/* Checkbox */}
                      <button
                        type="button"
                        onClick={() => handleToggleOutlet(outlet.id)}
                        className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                          isSelected
                            ? 'bg-primary-600 border-primary-600 text-white'
                            : 'border-gray-300 dark:border-gray-600'
                        }`}
                      >
                        {isSelected && <Check className="w-3 h-3" />}
                      </button>

                      {/* Outlet Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono text-gray-500 dark:text-gray-400">
                            {outlet.code}
                          </span>
                        </div>
                        <p className="font-medium text-gray-900 dark:text-white truncate">
                          {outlet.name}
                        </p>
                        {outlet.address && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                            {outlet.address}
                          </p>
                        )}
                      </div>

                      {/* Default Star */}
                      <button
                        type="button"
                        onClick={() => handleSetDefault(outlet.id)}
                        disabled={!isSelected}
                        className={`p-1 rounded transition-colors ${
                          isDefault
                            ? 'text-yellow-500'
                            : isSelected
                            ? 'text-gray-300 hover:text-yellow-400 dark:text-gray-600 dark:hover:text-yellow-400'
                            : 'text-gray-200 dark:text-gray-700 cursor-not-allowed'
                        }`}
                        title={isDefault ? 'Default outlet' : 'Set sebagai default'}
                      >
                        <Star className={`w-5 h-5 ${isDefault ? 'fill-current' : ''}`} />
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            {/* Help Text */}
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
              <Star className="w-3 h-3 inline text-yellow-500 fill-current" /> Klik bintang untuk set outlet default. 
              Outlet default akan otomatis dipilih saat user login.
            </p>

            {/* Actions */}
            <div className="flex gap-3">
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
                disabled={isSaving || selectedOutletIds.size === 0}
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
        )}
      </div>
    </div>
  );
};

export default UserOutletAssignmentModal;
