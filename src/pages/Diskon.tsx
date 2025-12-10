/**
 * Diskon & Promo Page
 * 
 * Main page with tab navigation for Discounts and Promos
 * Integrates all discount/promo components with state management
 * 
 * Requirements: 3.1, 3.2
 */

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Tag, Gift } from 'lucide-react';
import { 
  DiscountList, 
  DiscountFormModal, 
  PromoList, 
  PromoFormModal,
  DiscountFormData,
  PromoFormData
} from '../components/diskon';
import { 
  getDiscounts, 
  createDiscount, 
  updateDiscount, 
  deactivateDiscount,
  deleteDiscount,
  Discount 
} from '../api/discounts';
import { 
  getPromos, 
  createPromo, 
  updatePromo, 
  deletePromo,
  addProductsToPromo,
  Promo 
} from '../api/promos';

type TabType = 'discounts' | 'promos';

interface TabConfig {
  id: TabType;
  label: string;
  icon: React.ElementType;
}

const tabs: TabConfig[] = [
  { id: 'discounts', label: 'Diskon Produk', icon: Tag },
  { id: 'promos', label: 'Promo', icon: Gift },
];

export const Diskon: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('discounts');
  
  // Discount state
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [discountsLoading, setDiscountsLoading] = useState(false);
  const [selectedDiscount, setSelectedDiscount] = useState<Discount | null>(null);
  const [showDiscountModal, setShowDiscountModal] = useState(false);

  // Promo state
  const [promos, setPromos] = useState<Promo[]>([]);
  const [promosLoading, setPromosLoading] = useState(false);
  const [selectedPromo, setSelectedPromo] = useState<Promo | null>(null);
  const [showPromoModal, setShowPromoModal] = useState(false);

  // Toast state for feedback
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Load discounts
  const loadDiscounts = useCallback(async () => {
    setDiscountsLoading(true);
    try {
      const data = await getDiscounts();
      setDiscounts(data);
    } catch (err) {
      console.error('Failed to load discounts:', err);
      showToast('Gagal memuat data diskon', 'error');
    } finally {
      setDiscountsLoading(false);
    }
  }, []);

  // Load promos
  const loadPromos = useCallback(async () => {
    setPromosLoading(true);
    try {
      const data = await getPromos();
      setPromos(data);
    } catch (err) {
      console.error('Failed to load promos:', err);
      showToast('Gagal memuat data promo', 'error');
    } finally {
      setPromosLoading(false);
    }
  }, []);

  // Load data on mount and tab change
  useEffect(() => {
    if (activeTab === 'discounts') {
      loadDiscounts();
    } else {
      loadPromos();
    }
  }, [activeTab, loadDiscounts, loadPromos]);

  // Toast helper
  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // ============================================
  // Discount Handlers
  // ============================================

  const handleCreateDiscount = () => {
    setSelectedDiscount(null);
    setShowDiscountModal(true);
  };

  const handleSelectDiscount = (discount: Discount) => {
    setSelectedDiscount(discount);
    setShowDiscountModal(true);
  };

  const handleSaveDiscount = async (data: DiscountFormData) => {
    if (selectedDiscount) {
      // Update existing discount
      await updateDiscount(selectedDiscount.id, {
        discount_type: data.discount_type,
        discount_value: data.discount_value,
      });
      showToast('Diskon berhasil diperbarui', 'success');
    } else {
      // Create new discount
      await createDiscount(data);
      showToast('Diskon berhasil dibuat', 'success');
    }
    loadDiscounts();
  };

  const handleToggleDiscountStatus = async (discount: Discount) => {
    try {
      if (discount.is_active) {
        await deactivateDiscount(discount.id);
        showToast('Diskon berhasil dinonaktifkan', 'success');
      } else {
        await updateDiscount(discount.id, { is_active: true });
        showToast('Diskon berhasil diaktifkan', 'success');
      }
      loadDiscounts();
    } catch (err: any) {
      showToast(err.message || 'Gagal mengubah status diskon', 'error');
    }
  };

  const handleDeleteDiscount = async (discount: Discount) => {
    if (!confirm(`Hapus diskon untuk "${discount.product_name}"?`)) return;
    
    try {
      await deleteDiscount(discount.id);
      showToast('Diskon berhasil dihapus', 'success');
      loadDiscounts();
    } catch (err: any) {
      showToast(err.message || 'Gagal menghapus diskon', 'error');
    }
  };


  // ============================================
  // Promo Handlers
  // ============================================

  const handleCreatePromo = () => {
    setSelectedPromo(null);
    setShowPromoModal(true);
  };

  const handleSelectPromo = (promo: Promo) => {
    setSelectedPromo(promo);
    setShowPromoModal(true);
  };

  const handleSavePromo = async (data: PromoFormData) => {
    if (selectedPromo) {
      // Update existing promo
      await updatePromo(selectedPromo.id, {
        name: data.name,
        description: data.description,
        start_date: data.start_date,
        end_date: data.end_date,
        discount_type: data.discount_type,
        discount_value: data.discount_value,
        min_purchase: data.min_purchase || null,
      });
      
      // Update products if changed
      if (data.product_ids.length > 0) {
        await addProductsToPromo(selectedPromo.id, data.product_ids);
      }
      
      showToast('Promo berhasil diperbarui', 'success');
    } else {
      // Create new promo
      await createPromo(data);
      showToast('Promo berhasil dibuat', 'success');
    }
    loadPromos();
  };

  const handleDeletePromo = async (promo: Promo) => {
    if (!confirm(`Hapus promo "${promo.name}"?`)) return;
    
    try {
      await deletePromo(promo.id);
      showToast('Promo berhasil dihapus', 'success');
      loadPromos();
    } catch (err: any) {
      showToast(err.message || 'Gagal menghapus promo', 'error');
    }
  };

  // ============================================
  // Render
  // ============================================

  const renderTabContent = () => {
    switch (activeTab) {
      case 'discounts':
        return (
          <DiscountList
            discounts={discounts}
            loading={discountsLoading}
            onSelect={handleSelectDiscount}
            onCreateNew={handleCreateDiscount}
            onToggleStatus={handleToggleDiscountStatus}
            onDelete={handleDeleteDiscount}
          />
        );
      case 'promos':
        return (
          <PromoList
            promos={promos}
            loading={promosLoading}
            onSelect={handleSelectPromo}
            onCreateNew={handleCreatePromo}
            onDelete={handleDeletePromo}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 animate-fade-in ${
            toast.type === 'success'
              ? 'bg-green-500 text-white'
              : 'bg-red-500 text-white'
          }`}
        >
          {toast.message}
        </div>
      )}

      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Diskon & Promo</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Kelola diskon produk dan kampanye promosi
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex space-x-1" aria-label="Tabs">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  relative flex items-center px-4 py-3 text-sm font-medium rounded-t-lg
                  transition-colors duration-200
                  ${isActive 
                    ? 'text-primary-600 bg-primary-50 dark:bg-primary-900/20 dark:text-primary-400' 
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50 dark:text-gray-400 dark:hover:text-gray-300 dark:hover:bg-gray-800'
                  }
                `}
              >
                <Icon className="w-4 h-4 mr-2" />
                {tab.label}
                {isActive && (
                  <motion.div
                    layoutId="activeDiskonTab"
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-600"
                    initial={false}
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  />
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
          className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6"
        >
          {renderTabContent()}
        </motion.div>
      </AnimatePresence>

      {/* Discount Form Modal */}
      <DiscountFormModal
        isOpen={showDiscountModal}
        discount={selectedDiscount}
        onSave={handleSaveDiscount}
        onClose={() => {
          setShowDiscountModal(false);
          setSelectedDiscount(null);
        }}
      />

      {/* Promo Form Modal */}
      <PromoFormModal
        isOpen={showPromoModal}
        promo={selectedPromo}
        onSave={handleSavePromo}
        onClose={() => {
          setShowPromoModal(false);
          setSelectedPromo(null);
        }}
      />
    </div>
  );
};

export default Diskon;
