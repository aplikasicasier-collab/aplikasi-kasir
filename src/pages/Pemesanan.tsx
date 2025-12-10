import React, { useState, useCallback } from 'react';
import { ShoppingCart, Plus, Users } from 'lucide-react';
import { Button } from '../components/ui/Button';
import {
  POList,
  POForm,
  PODetail,
  LowStockAlert,
  SupplierModal,
} from '../components/pemesanan';
import { PurchaseOrderWithItems } from '../api/purchaseOrders';
import { LowStockProduct } from '../api/stock';
import { Supplier } from '../types';

type ViewMode = 'list' | 'create' | 'detail';

const Pemesanan: React.FC = () => {
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [selectedPO, setSelectedPO] = useState<PurchaseOrderWithItems | null>(null);
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [initialPOItems, setInitialPOItems] = useState<LowStockProduct[]>([]);

  const handleCreateNew = useCallback(() => {
    setInitialPOItems([]);
    setViewMode('create');
  }, []);

  const handleSelectPO = useCallback((po: PurchaseOrderWithItems) => {
    setSelectedPO(po);
    setViewMode('detail');
  }, []);

  const handlePOSaved = useCallback(() => {
    setViewMode('list');
    setRefreshTrigger(prev => prev + 1);
  }, []);

  const handlePOUpdated = useCallback(() => {
    setRefreshTrigger(prev => prev + 1);
  }, []);

  const handleCloseDetail = useCallback(() => {
    setSelectedPO(null);
    setViewMode('list');
  }, []);

  const handleAddLowStockToOrder = useCallback((products: LowStockProduct[]) => {
    setInitialPOItems(products);
    setViewMode('create');
  }, []);

  const handleSupplierSaved = useCallback((_supplier: Supplier) => {
    setShowSupplierModal(false);
  }, []);

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <ShoppingCart className="w-7 h-7 text-primary-600" />
            Pemesanan
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Kelola purchase order dan pemesanan barang dari supplier
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setShowSupplierModal(true)}
          >
            <Users className="w-4 h-4 mr-2" />
            Tambah Supplier
          </Button>
          <Button onClick={handleCreateNew}>
            <Plus className="w-4 h-4 mr-2" />
            Buat PO Baru
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Low Stock Alert */}
        <div className="lg:col-span-1">
          <LowStockAlert onAddToOrder={handleAddLowStockToOrder} />
        </div>

        {/* Right Column - PO List */}
        <div className="lg:col-span-2">
          <POList
            onSelect={handleSelectPO}
            onCreateNew={handleCreateNew}
            refreshTrigger={refreshTrigger}
          />
        </div>
      </div>

      {/* PO Form Modal */}
      {viewMode === 'create' && (
        <POForm
          onSave={handlePOSaved}
          onCancel={() => setViewMode('list')}
          initialItems={initialPOItems.length > 0 ? initialPOItems : undefined}
        />
      )}

      {/* PO Detail Modal */}
      {viewMode === 'detail' && selectedPO && (
        <PODetail
          purchaseOrder={selectedPO}
          onClose={handleCloseDetail}
          onUpdate={handlePOUpdated}
        />
      )}

      {/* Supplier Modal */}
      <SupplierModal
        isOpen={showSupplierModal}
        onSave={handleSupplierSaved}
        onClose={() => setShowSupplierModal(false)}
      />
    </div>
  );
};

export default Pemesanan;
