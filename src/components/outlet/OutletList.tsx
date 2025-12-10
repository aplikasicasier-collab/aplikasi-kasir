/**
 * Outlet List Component
 * 
 * Display outlets table with code, name, address, status
 * Add filter by status
 * 
 * Requirements: 1.5
 */

import React, { useState, useMemo } from 'react';
import { Search, Filter, Store, Edit2, Power, PowerOff, Loader2, Plus } from 'lucide-react';
import { Button } from '../ui/Button';
import { Outlet } from '@/types';

interface OutletListProps {
  outlets: Outlet[];
  loading: boolean;
  onSelect: (outlet: Outlet) => void;
  onCreateNew: () => void;
  onToggleStatus: (outlet: Outlet) => void;
}

type StatusFilter = 'all' | 'active' | 'inactive';

export const OutletList: React.FC<OutletListProps> = ({
  outlets,
  loading,
  onSelect,
  onCreateNew,
  onToggleStatus,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [showFilters, setShowFilters] = useState(false);

  // Filter outlets based on search and status filter
  const filteredOutlets = useMemo(() => {
    return outlets.filter((outlet) => {
      // Search filter (name, code, or address)
      const searchLower = searchQuery.toLowerCase().trim();
      const matchesSearch = searchLower === '' ||
        outlet.name.toLowerCase().includes(searchLower) ||
        outlet.code.toLowerCase().includes(searchLower) ||
        (outlet.address?.toLowerCase().includes(searchLower) ?? false);

      // Status filter
      const matchesStatus = statusFilter === 'all' ||
        (statusFilter === 'active' && outlet.is_active) ||
        (statusFilter === 'inactive' && !outlet.is_active);

      return matchesSearch && matchesStatus;
    });
  }, [outlets, searchQuery, statusFilter]);

  const getStatusBadgeClass = (isActive: boolean) => {
    return isActive
      ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
      : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
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
            placeholder="Cari nama, kode, atau alamat outlet..."
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

        {/* Add Outlet Button */}
        <Button onClick={onCreateNew} className="flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Tambah Outlet
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

      {/* Outlets Table */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
        </div>
      ) : filteredOutlets.length === 0 ? (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          <Store className="w-12 h-12 mx-auto mb-4 opacity-50" />
          {outlets.length === 0
            ? 'Belum ada outlet. Klik "Tambah Outlet" untuk membuat.'
            : 'Tidak ada outlet yang sesuai dengan filter.'}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b dark:border-gray-700">
                <th className="text-left py-3 px-4 font-medium text-gray-700 dark:text-gray-300">Kode</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700 dark:text-gray-300">Nama</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700 dark:text-gray-300">Alamat</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700 dark:text-gray-300">Telepon</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700 dark:text-gray-300">Status</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700 dark:text-gray-300">Dibuat</th>
                <th className="text-right py-3 px-4 font-medium text-gray-700 dark:text-gray-300">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filteredOutlets.map((outlet) => (
                <tr
                  key={outlet.id}
                  className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  <td className="py-3 px-4">
                    <span className="font-mono text-sm text-primary-600 dark:text-primary-400">
                      {outlet.code}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-gray-900 dark:text-white font-medium">
                    {outlet.name}
                  </td>
                  <td className="py-3 px-4 text-gray-600 dark:text-gray-400 max-w-xs truncate">
                    {outlet.address || '-'}
                  </td>
                  <td className="py-3 px-4 text-gray-600 dark:text-gray-400">
                    {outlet.phone || '-'}
                  </td>
                  <td className="py-3 px-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadgeClass(outlet.is_active)}`}>
                      {outlet.is_active ? 'Aktif' : 'Tidak Aktif'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-gray-600 dark:text-gray-400 text-sm">
                    {formatDate(outlet.created_at)}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onSelect(outlet)}
                        title="Edit Outlet"
                      >
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onToggleStatus(outlet)}
                        title={outlet.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                        className={outlet.is_active ? 'text-red-500' : 'text-green-500'}
                      >
                        {outlet.is_active ? (
                          <PowerOff className="w-4 h-4" />
                        ) : (
                          <Power className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Results count */}
      {!loading && filteredOutlets.length > 0 && (
        <div className="text-sm text-gray-500 dark:text-gray-400">
          Menampilkan {filteredOutlets.length} dari {outlets.length} outlet
        </div>
      )}
    </div>
  );
};

export default OutletList;
