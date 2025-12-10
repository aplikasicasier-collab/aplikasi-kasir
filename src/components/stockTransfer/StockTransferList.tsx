/**
 * Stock Transfer List Component
 * 
 * Display transfers with source, destination, status
 * Add filter by status
 * 
 * Requirements: 4.5
 */

import React, { useState, useMemo } from 'react';
import { Search, Filter, ArrowRightLeft, Eye, Loader2, Plus, Calendar } from 'lucide-react';
import { Button } from '../ui/Button';
import { StockTransfer, TransferStatus } from '@/api/stockTransfers';

interface StockTransferListProps {
  transfers: StockTransfer[];
  loading: boolean;
  onSelect: (transfer: StockTransfer) => void;
  onCreateNew: () => void;
}

type StatusFilter = 'all' | TransferStatus;

const STATUS_LABELS: Record<TransferStatus, string> = {
  pending: 'Menunggu',
  approved: 'Disetujui',
  completed: 'Selesai',
  cancelled: 'Dibatalkan',
};

const STATUS_COLORS: Record<TransferStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  approved: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  completed: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  cancelled: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
};

export const StockTransferList: React.FC<StockTransferListProps> = ({
  transfers,
  loading,
  onSelect,
  onCreateNew,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [showFilters, setShowFilters] = useState(false);


  // Filter transfers based on search and status filter
  const filteredTransfers = useMemo(() => {
    return transfers.filter((transfer) => {
      // Search filter (transfer number, source outlet, destination outlet)
      const searchLower = searchQuery.toLowerCase().trim();
      const matchesSearch = searchLower === '' ||
        transfer.transfer_number.toLowerCase().includes(searchLower) ||
        (transfer.source_outlet?.name?.toLowerCase().includes(searchLower) ?? false) ||
        (transfer.source_outlet?.code?.toLowerCase().includes(searchLower) ?? false) ||
        (transfer.destination_outlet?.name?.toLowerCase().includes(searchLower) ?? false) ||
        (transfer.destination_outlet?.code?.toLowerCase().includes(searchLower) ?? false);

      // Status filter
      const matchesStatus = statusFilter === 'all' || transfer.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [transfers, searchQuery, statusFilter]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getItemCount = (transfer: StockTransfer): number => {
    return transfer.items?.length ?? 0;
  };

  const getTotalQuantity = (transfer: StockTransfer): number => {
    return transfer.items?.reduce((sum, item) => sum + item.quantity, 0) ?? 0;
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
            placeholder="Cari nomor transfer atau outlet..."
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

        {/* Add Transfer Button */}
        <Button onClick={onCreateNew} className="flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Transfer Baru
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
              <option value="pending">Menunggu</option>
              <option value="approved">Disetujui</option>
              <option value="completed">Selesai</option>
              <option value="cancelled">Dibatalkan</option>
            </select>
          </div>
        </div>
      )}


      {/* Transfers Table */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
        </div>
      ) : filteredTransfers.length === 0 ? (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          <ArrowRightLeft className="w-12 h-12 mx-auto mb-4 opacity-50" />
          {transfers.length === 0
            ? 'Belum ada transfer stok. Klik "Transfer Baru" untuk membuat.'
            : 'Tidak ada transfer yang sesuai dengan filter.'}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b dark:border-gray-700">
                <th className="text-left py-3 px-4 font-medium text-gray-700 dark:text-gray-300">No. Transfer</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700 dark:text-gray-300">Outlet Asal</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700 dark:text-gray-300">Outlet Tujuan</th>
                <th className="text-center py-3 px-4 font-medium text-gray-700 dark:text-gray-300">Item</th>
                <th className="text-center py-3 px-4 font-medium text-gray-700 dark:text-gray-300">Total Qty</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700 dark:text-gray-300">Status</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700 dark:text-gray-300">Tanggal</th>
                <th className="text-right py-3 px-4 font-medium text-gray-700 dark:text-gray-300">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filteredTransfers.map((transfer) => (
                <tr
                  key={transfer.id}
                  className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
                  onClick={() => onSelect(transfer)}
                >
                  <td className="py-3 px-4">
                    <span className="font-mono text-sm text-primary-600 dark:text-primary-400">
                      {transfer.transfer_number}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <div className="text-gray-900 dark:text-white font-medium">
                      {transfer.source_outlet?.name || '-'}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {transfer.source_outlet?.code || ''}
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="text-gray-900 dark:text-white font-medium">
                      {transfer.destination_outlet?.name || '-'}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {transfer.destination_outlet?.code || ''}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-center text-gray-600 dark:text-gray-400">
                    {getItemCount(transfer)}
                  </td>
                  <td className="py-3 px-4 text-center text-gray-600 dark:text-gray-400">
                    {getTotalQuantity(transfer)}
                  </td>
                  <td className="py-3 px-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[transfer.status]}`}>
                      {STATUS_LABELS[transfer.status]}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-gray-600 dark:text-gray-400 text-sm">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {formatDate(transfer.created_at)}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelect(transfer);
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
      {!loading && filteredTransfers.length > 0 && (
        <div className="text-sm text-gray-500 dark:text-gray-400">
          Menampilkan {filteredTransfers.length} dari {transfers.length} transfer
        </div>
      )}
    </div>
  );
};

export default StockTransferList;
