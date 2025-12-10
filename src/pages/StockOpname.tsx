/**
 * Stock Opname Page
 * 
 * Main page for managing stock opname (inventory count) with:
 * - Opname list with search and filters
 * - Create new opname session
 * - Scanner for counting products
 * - Summary view with complete/cancel actions
 * 
 * Requirements: 5.1
 */

import React, { useState, useEffect, useCallback } from 'react';
import { ClipboardList, AlertCircle, CheckCircle, ArrowLeft } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { StockOpnameList, StockOpnameScanner, StockOpnameSummary } from '../components/stockOpname';
import {
  StockOpname,
  StockOpnameItem,
  getStockOpnames,
  getStockOpnameById,
  createStockOpname,
  completeStockOpname,
  cancelStockOpname,
} from '../api/stockOpname';
import { useOutlet } from '../contexts/OutletContext';

type ViewMode = 'list' | 'scanner' | 'detail';

const StockOpnamePage: React.FC = () => {
  // State for opnames data
  const [opnames, setOpnames] = useState<StockOpname[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // State for current view
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [currentOpname, setCurrentOpname] = useState<StockOpname | null>(null);
  const [opnameItems, setOpnameItems] = useState<StockOpnameItem[]>([]);

  // State for action feedback
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Get current outlet
  const { currentOutlet } = useOutlet();


  // Load opnames on mount
  const loadOpnames = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getStockOpnames();
      setOpnames(data);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Gagal memuat data stock opname';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOpnames();
  }, [loadOpnames]);

  // Clear action message after 3 seconds
  useEffect(() => {
    if (actionMessage) {
      const timer = setTimeout(() => setActionMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [actionMessage]);

  // Handle create new opname
  const handleCreateNew = useCallback(async () => {
    setIsProcessing(true);
    setError(null);
    try {
      const newOpname = await createStockOpname({
        outlet_id: currentOutlet?.id,
        notes: null,
      });
      setCurrentOpname(newOpname);
      setOpnameItems([]);
      setViewMode('scanner');
      setActionMessage({ type: 'success', text: 'Stock opname baru berhasil dibuat' });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Gagal membuat stock opname';
      setError(message);
    } finally {
      setIsProcessing(false);
    }
  }, [currentOutlet?.id]);

  // Handle select opname for detail view
  const handleSelectOpname = useCallback(async (opname: StockOpname) => {
    setIsProcessing(true);
    try {
      const freshOpname = await getStockOpnameById(opname.id);
      if (freshOpname) {
        setCurrentOpname(freshOpname);
        setOpnameItems(freshOpname.items || []);
        // Show scanner if in progress, otherwise show detail
        setViewMode(freshOpname.status === 'in_progress' ? 'scanner' : 'detail');
      }
    } catch (e) {
      console.error('Failed to fetch opname details:', e);
      setCurrentOpname(opname);
      setOpnameItems(opname.items || []);
      setViewMode(opname.status === 'in_progress' ? 'scanner' : 'detail');
    } finally {
      setIsProcessing(false);
    }
  }, []);

  // Handle item scanned
  const handleItemScanned = useCallback((item: StockOpnameItem) => {
    setOpnameItems(prev => [...prev, item]);
  }, []);

  // Handle item updated
  const handleItemUpdated = useCallback((updatedItem: StockOpnameItem) => {
    setOpnameItems(prev => 
      prev.map(item => item.id === updatedItem.id ? updatedItem : item)
    );
  }, []);

  // Handle complete opname
  const handleCompleteOpname = useCallback(async () => {
    if (!currentOpname) return;
    
    setIsProcessing(true);
    try {
      await completeStockOpname(currentOpname.id);
      setActionMessage({ type: 'success', text: 'Stock opname berhasil diselesaikan. Stok produk telah diperbarui.' });
      setViewMode('list');
      setCurrentOpname(null);
      setOpnameItems([]);
      await loadOpnames();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Gagal menyelesaikan stock opname';
      setActionMessage({ type: 'error', text: message });
    } finally {
      setIsProcessing(false);
    }
  }, [currentOpname, loadOpnames]);

  // Handle cancel opname
  const handleCancelOpname = useCallback(async () => {
    if (!currentOpname) return;
    
    setIsProcessing(true);
    try {
      await cancelStockOpname(currentOpname.id);
      setActionMessage({ type: 'success', text: 'Stock opname berhasil dibatalkan' });
      setViewMode('list');
      setCurrentOpname(null);
      setOpnameItems([]);
      await loadOpnames();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Gagal membatalkan stock opname';
      setActionMessage({ type: 'error', text: message });
    } finally {
      setIsProcessing(false);
    }
  }, [currentOpname, loadOpnames]);

  // Handle back to list
  const handleBackToList = useCallback(() => {
    setViewMode('list');
    setCurrentOpname(null);
    setOpnameItems([]);
    loadOpnames();
  }, [loadOpnames]);


  // Render page title based on view mode
  const renderTitle = () => {
    if (viewMode === 'list') {
      return (
        <>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <ClipboardList className="w-7 h-7 text-primary-600" />
            Stock Opname
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Kelola penghitungan dan verifikasi stok fisik
          </p>
        </>
      );
    }

    return (
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleBackToList}
          className="flex items-center gap-1"
        >
          <ArrowLeft className="w-4 h-4" />
          Kembali
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <ClipboardList className="w-7 h-7 text-primary-600" />
            {currentOpname?.opname_number || 'Stock Opname'}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            {viewMode === 'scanner' ? 'Scan barcode produk untuk menghitung stok' : 'Detail stock opname'}
          </p>
        </div>
      </div>
    );
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        {renderTitle()}
      </div>

      {/* Action Message */}
      {actionMessage && (
        <div
          className={`mb-4 p-3 rounded-lg flex items-center gap-2 ${
            actionMessage.type === 'success'
              ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
              : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
          }`}
        >
          {actionMessage.type === 'success' ? (
            <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
          )}
          <span
            className={`text-sm ${
              actionMessage.type === 'success'
                ? 'text-green-700 dark:text-green-400'
                : 'text-red-700 dark:text-red-400'
            }`}
          >
            {actionMessage.text}
          </span>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
          <span className="text-red-700 dark:text-red-400">{error}</span>
          <Button size="sm" variant="outline" onClick={loadOpnames} className="ml-auto">
            Coba Lagi
          </Button>
        </div>
      )}

      {/* Main Content */}
      {viewMode === 'list' && (
        <Card className="p-6">
          <StockOpnameList
            opnames={opnames}
            loading={loading}
            onSelect={handleSelectOpname}
            onCreateNew={handleCreateNew}
          />
        </Card>
      )}

      {viewMode === 'scanner' && currentOpname && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Scanner Section */}
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Scan Produk
            </h2>
            <StockOpnameScanner
              opnameId={currentOpname.id}
              existingItems={opnameItems}
              onItemScanned={handleItemScanned}
              onItemUpdated={handleItemUpdated}
            />
          </Card>

          {/* Summary Section */}
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Ringkasan
            </h2>
            <StockOpnameSummary
              items={opnameItems}
              status={currentOpname.status}
              onComplete={handleCompleteOpname}
              onCancel={handleCancelOpname}
              isProcessing={isProcessing}
            />
          </Card>
        </div>
      )}

      {viewMode === 'detail' && currentOpname && (
        <Card className="p-6">
          <StockOpnameSummary
            items={opnameItems}
            status={currentOpname.status}
            onComplete={handleCompleteOpname}
            onCancel={handleCancelOpname}
            isProcessing={isProcessing}
          />
        </Card>
      )}
    </div>
  );
};

export default StockOpnamePage;
