/**
 * Discount List Component
 * 
 * Displays discounts table with product name, type, value, status
 * Includes filter by status and activate/deactivate toggle
 * 
 * Requirements: 3.1, 3.4
 */

import React, { useState, useMemo } from 'react';
import { Search, Filter, Percent, DollarSign, Edit2, ToggleLeft, ToggleRight, Loader2, Trash2, Tag } from 'lucide-react';
import { Button } from '../ui/Button';
import { Discount } from '@/types';

interface DiscountListProps {
  discounts: Discount[];
  loading: boolean;
  onSelect: (discount: Discount) => void;
  onCreateNew: () => void;
  onToggleStatus: (discount: Discount) => void;
  onDelete?: (discount: Discount) => void;
}

type StatusFilter = 'all' | 'active' | 'inactive';

export const DiscountList: React.FC<DiscountListProps> = ({
  discounts,
  loading,
  onSelect,
  onCreateNew,
  onToggleStatus,
  onDelete,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [showFilters, setShowFilters] = useState(false);

  // Filter discounts based on search and filters
  const filteredDiscounts = useMemo(() => {
    return discounts.filter((discount) => {
      // Search filter (product name)
      const searchLower = searchQuery.toLowerCase().trim();
      const matchesSearch = searchLower === '' ||
        (discount.product_name?.toLowerCase().includes(searchLower) ?? false);

      // Status filter
      const matchesStatus = statusFilter === 'all' ||
        (statusFilter === 'active' && discount.is_active) ||
        (statusFilter === 'inactive' && !discount.is_active);

      return matchesSearch && matchesStatus;
    });
  }, [discounts, searchQuery, statusFilter]);


  const formatDiscountValue = (discount: Discount) => {
    if (discount.discount_type === 'percentage') {
      return `${discount.discount_value}%`;
    }
    return `Rp ${discount.discount_value.toLocaleString()}`;
  };

  const getStatusBadgeClass = (isActive: boolean) => {
    return isActive
      ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
      : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
  };

  const getTypeBadgeClass = (type: string) => {
    return type === 'percentage'
      ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
      : 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400';
  };

  return (
    <div className="space-y-4">
      {/* Search and Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Cari nama produk..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
        </div>

        {/* Filter Toggle Button */}
        <Button
          variant="outline"
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center gap-2"
        >
          <Filter className="w-4 h-4" />
          Filter
        </Button>

        {/* Add Discount Button */}
        <Button onClick={onCreateNew} className="flex items-center gap-2">
          <Tag className="w-4 h-4" />
          Tambah Diskon
        </Button>
      </div>

      {/* Filter Options */}
      {showFilters && (
        <div className="flex flex-wrap gap-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="all">Semua Status</option>
              <option value="active">Aktif</option>
              <option value="inactive">Tidak Aktif</option>
            </select>
          </div>
        </div>
      )}

      {/* Discounts Table */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
        </div>
      ) : filteredDiscounts.length === 0 ? (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          {discounts.length === 0
            ? 'Belum ada diskon. Klik "Tambah Diskon" untuk membuat.'
            : 'Tidak ada diskon yang sesuai dengan filter.'}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b dark:border-gray-700">
                <th className="text-left py-3 px-4 font-medium text-gray-700 dark:text-gray-300">Produk</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700 dark:text-gray-300">Tipe</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700 dark:text-gray-300">Nilai</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700 dark:text-gray-300">Status</th>
                <th className="text-right py-3 px-4 font-medium text-gray-700 dark:text-gray-300">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filteredDiscounts.map((discount) => (
                <tr
                  key={discount.id}
                  className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  <td className="py-3 px-4 text-gray-900 dark:text-white font-medium">
                    {discount.product_name || 'Produk tidak diketahui'}
                  </td>
                  <td className="py-3 px-4">
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getTypeBadgeClass(discount.discount_type)}`}>
                      {discount.discount_type === 'percentage' ? (
                        <Percent className="w-3 h-3" />
                      ) : (
                        <DollarSign className="w-3 h-3" />
                      )}
                      {discount.discount_type === 'percentage' ? 'Persentase' : 'Nominal'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-gray-900 dark:text-white font-semibold">
                    {formatDiscountValue(discount)}
                  </td>
                  <td className="py-3 px-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadgeClass(discount.is_active)}`}>
                      {discount.is_active ? 'Aktif' : 'Tidak Aktif'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onSelect(discount)}
                        title="Edit Diskon"
                      >
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onToggleStatus(discount)}
                        title={discount.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                        className={discount.is_active ? 'text-red-500' : 'text-green-500'}
                      >
                        {discount.is_active ? (
                          <ToggleRight className="w-4 h-4" />
                        ) : (
                          <ToggleLeft className="w-4 h-4" />
                        )}
                      </Button>
                      {onDelete && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => onDelete(discount)}
                          title="Hapus Diskon"
                          className="text-red-500"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Results count */}
      {!loading && filteredDiscounts.length > 0 && (
        <div className="text-sm text-gray-500 dark:text-gray-400">
          Menampilkan {filteredDiscounts.length} dari {discounts.length} diskon
        </div>
      )}
    </div>
  );
};

export default DiscountList;
