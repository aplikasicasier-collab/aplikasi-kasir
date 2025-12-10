/**
 * Promo List Component
 * 
 * Displays promos table with name, period, product count, status
 * Shows active/upcoming/expired status
 * 
 * Requirements: 3.2
 */

import React, { useState, useMemo } from 'react';
import { Search, Filter, Calendar, Package, Edit2, Trash2, Loader2, Gift, Clock, CheckCircle, XCircle } from 'lucide-react';
import { Button } from '../ui/Button';
import { Promo, getPromoStatus } from '@/api/promos';

interface PromoListProps {
  promos: Promo[];
  loading: boolean;
  onSelect: (promo: Promo) => void;
  onCreateNew: () => void;
  onDelete?: (promo: Promo) => void;
}

type StatusFilter = 'all' | 'active' | 'upcoming' | 'expired' | 'inactive';

const STATUS_LABELS: Record<string, string> = {
  active: 'Aktif',
  upcoming: 'Akan Datang',
  expired: 'Berakhir',
  inactive: 'Tidak Aktif',
};

const STATUS_ICONS: Record<string, React.ReactNode> = {
  active: <CheckCircle className="w-3 h-3" />,
  upcoming: <Clock className="w-3 h-3" />,
  expired: <XCircle className="w-3 h-3" />,
  inactive: <XCircle className="w-3 h-3" />,
};

export const PromoList: React.FC<PromoListProps> = ({
  promos,
  loading,
  onSelect,
  onCreateNew,
  onDelete,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [showFilters, setShowFilters] = useState(false);

  // Filter promos based on search and filters
  const filteredPromos = useMemo(() => {
    return promos.filter((promo) => {
      // Search filter (promo name)
      const searchLower = searchQuery.toLowerCase().trim();
      const matchesSearch = searchLower === '' ||
        promo.name.toLowerCase().includes(searchLower);

      // Status filter
      const promoStatus = getPromoStatus(promo);
      const matchesStatus = statusFilter === 'all' || promoStatus === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [promos, searchQuery, statusFilter]);


  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const formatDiscountValue = (promo: Promo) => {
    if (promo.discount_type === 'percentage') {
      return `${promo.discount_value}%`;
    }
    return `Rp ${promo.discount_value.toLocaleString()}`;
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
      case 'upcoming':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
      case 'expired':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-400';
      case 'inactive':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    }
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
            placeholder="Cari nama promo..."
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

        {/* Add Promo Button */}
        <Button onClick={onCreateNew} className="flex items-center gap-2">
          <Gift className="w-4 h-4" />
          Tambah Promo
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
              <option value="upcoming">Akan Datang</option>
              <option value="expired">Berakhir</option>
              <option value="inactive">Tidak Aktif</option>
            </select>
          </div>
        </div>
      )}

      {/* Promos Table */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
        </div>
      ) : filteredPromos.length === 0 ? (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          {promos.length === 0
            ? 'Belum ada promo. Klik "Tambah Promo" untuk membuat.'
            : 'Tidak ada promo yang sesuai dengan filter.'}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b dark:border-gray-700">
                <th className="text-left py-3 px-4 font-medium text-gray-700 dark:text-gray-300">Nama Promo</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700 dark:text-gray-300">Periode</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700 dark:text-gray-300">Diskon</th>
                <th className="text-center py-3 px-4 font-medium text-gray-700 dark:text-gray-300">Produk</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700 dark:text-gray-300">Status</th>
                <th className="text-right py-3 px-4 font-medium text-gray-700 dark:text-gray-300">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filteredPromos.map((promo) => {
                const status = getPromoStatus(promo);
                return (
                  <tr
                    key={promo.id}
                    className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"
                  >
                    <td className="py-3 px-4">
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">{promo.name}</p>
                        {promo.description && (
                          <p className="text-sm text-gray-500 dark:text-gray-400 truncate max-w-xs">
                            {promo.description}
                          </p>
                        )}
                        {promo.min_purchase && (
                          <p className="text-xs text-orange-600 dark:text-orange-400">
                            Min. pembelian: Rp {promo.min_purchase.toLocaleString()}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400">
                        <Calendar className="w-4 h-4" />
                        <span>{formatDate(promo.start_date)} - {formatDate(promo.end_date)}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-gray-900 dark:text-white font-semibold">
                      {formatDiscountValue(promo)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-1 text-gray-600 dark:text-gray-400">
                        <Package className="w-4 h-4" />
                        <span>{promo.product_count || 0}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusBadgeClass(status)}`}>
                        {STATUS_ICONS[status]}
                        {STATUS_LABELS[status]}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => onSelect(promo)}
                          title="Edit Promo"
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        {onDelete && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => onDelete(promo)}
                            title="Hapus Promo"
                            className="text-red-500"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Results count */}
      {!loading && filteredPromos.length > 0 && (
        <div className="text-sm text-gray-500 dark:text-gray-400">
          Menampilkan {filteredPromos.length} dari {promos.length} promo
        </div>
      )}
    </div>
  );
};

export default PromoList;
