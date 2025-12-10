/**
 * Stock Opname List Component
 * Display opname history with status
 * Filter by date and status
 * Requirements: 5.5
 */

import React, { useState, useMemo } from 'react';
import { Search, Filter, ClipboardList, Eye, Loader2, Plus, Calendar } from 'lucide-react';
import { Button } from '../ui/Button';
import { StockOpname } from '@/api/stockOpname';

interface StockOpnameListProps {
  opnames: StockOpname[];
  loading: boolean;
  onSelect: (opname: StockOpname) => void;
  onCreateNew: () => void;
}

type StatusFilter = 'all' | 'in_progress' | 'completed' | 'cancelled';

const STATUS_LABELS: Record<string, string> = {
  in_progress: 'Sedang Berjalan',
  completed: 'Selesai',
  cancelled: 'Dibatalkan',
};

const STATUS_COLORS: Record<string, string> = {
  in_progress: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  completed: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  cancelled: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
};

export const StockOpnameList: React.FC<StockOpnameListProps> = ({
  opnames,
  loading,
  onSelect,
  onCreateNew,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');


  // Filter opnames based on search, status, and date filters
  const filteredOpnames = useMemo(() => {
    return opnames.filter((opname) => {
      // Search filter (opname number)
      const searchLower = searchQuery.toLowerCase().trim();
      const matchesSearch = searchLower === '' ||
        opname.opname_number.toLowerCase().includes(searchLower);

      // Status filter
      const matchesStatus = statusFilter === 'all' || opname.status === statusFilter;

      // Date filter
      let matchesDate = true;
      if (startDate) {
        matchesDate = matchesDate && new Date(opname.created_at) >= new Date(startDate);
      }
      if (endDate) {
        const endDateTime = new Date(endDate);
        endDateTime.setHours(23, 59, 59, 999);
        matchesDate = matchesDate && new Date(opname.created_at) <= endDateTime;
      }

      return matchesSearch && matchesStatus && matchesDate;
    });
  }, [opnames, searchQuery, statusFilter, startDate, endDate]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getItemCount = (opname: StockOpname): number => {
    return opname.items?.length ?? 0;
  };

  const getDiscrepancyCount = (opname: StockOpname): number => {
    return opname.items?.filter(item => item.discrepancy !== 0).length ?? 0;
  };

  const clearFilters = () => {
    setStatusFilter('all');
    setStartDate('');
    setEndDate('');
    setSearchQuery('');
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
            placeholder="Cari nomor opname..."
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

        {/* Add Opname Button */}
        <Button onClick={onCreateNew} className="flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Stock Opname Baru
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
              <option value="in_progress">Sedang Berjalan</option>
              <option value="completed">Selesai</option>
              <option value="cancelled">Dibatalkan</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Tanggal Mulai
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Tanggal Akhir
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>

          <div className="flex items-end">
            <Button variant="ghost" onClick={clearFilters} size="sm">
              Reset Filter
            </Button>
          </div>
        </div>
      )}

      {/* Opnames Table */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
        </div>
      ) : filteredOpnames.length === 0 ? (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          <ClipboardList className="w-12 h-12 mx-auto mb-4 opacity-50" />
          {opnames.length === 0
            ? 'Belum ada stock opname. Klik "Stock Opname Baru" untuk memulai.'
            : 'Tidak ada opname yang sesuai dengan filter.'}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b dark:border-gray-700">
                <th className="text-left py-3 px-4 font-medium text-gray-700 dark:text-gray-300">No. Opname</th>
                <th className="text-center py-3 px-4 font-medium text-gray-700 dark:text-gray-300">Item</th>
                <th className="text-center py-3 px-4 font-medium text-gray-700 dark:text-gray-300">Selisih</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700 dark:text-gray-300">Status</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700 dark:text-gray-300">Tanggal</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700 dark:text-gray-300">Selesai</th>
                <th className="text-right py-3 px-4 font-medium text-gray-700 dark:text-gray-300">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filteredOpnames.map((opname) => (
                <tr
                  key={opname.id}
                  className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
                  onClick={() => onSelect(opname)}
                >
                  <td className="py-3 px-4">
                    <span className="font-mono text-sm text-primary-600 dark:text-primary-400">
                      {opname.opname_number}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center text-gray-600 dark:text-gray-400">
                    {getItemCount(opname)}
                  </td>
                  <td className="py-3 px-4 text-center">
                    {getDiscrepancyCount(opname) > 0 ? (
                      <span className="text-red-600 dark:text-red-400 font-medium">
                        {getDiscrepancyCount(opname)}
                      </span>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[opname.status]}`}>
                      {STATUS_LABELS[opname.status]}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-gray-600 dark:text-gray-400 text-sm">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {formatDate(opname.created_at)}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-gray-600 dark:text-gray-400 text-sm">
                    {opname.completed_at ? formatDate(opname.completed_at) : '-'}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelect(opname);
                      }}
                      title="Lihat Detail"
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Results count */}
      {!loading && filteredOpnames.length > 0 && (
        <div className="text-sm text-gray-500 dark:text-gray-400">
          Menampilkan {filteredOpnames.length} dari {opnames.length} stock opname
        </div>
      )}
    </div>
  );
};

export default StockOpnameList;
