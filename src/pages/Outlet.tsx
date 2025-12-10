/**
 * Outlet Management Page
 * 
 * Main page for managing outlets with:
 * - Outlet list with search and filters
 * - Outlet create/edit form modal
 * - Activate/deactivate outlet functionality
 * 
 * Requirements: 1.1
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Store, AlertCircle, CheckCircle } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { OutletList } from '../components/outlet/OutletList';
import { OutletFormModal, OutletFormData } from '../components/outlet/OutletFormModal';
import { Outlet as OutletType } from '../types';
import {
  getOutlets,
  createOutlet,
  updateOutlet,
  deactivateOutlet,
} from '../api/outlets';

const OutletPage: React.FC = () => {
  // State for outlets data
  const [outlets, setOutlets] = useState<OutletType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // State for modals
  const [showOutletForm, setShowOutletForm] = useState(false);
  const [selectedOutlet, setSelectedOutlet] = useState<OutletType | null>(null);

  // State for action feedback
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Load outlets on mount
  const loadOutlets = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Include inactive outlets to show all in management view
      const data = await getOutlets(true);
      setOutlets(data);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Gagal memuat data outlet';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOutlets();
  }, [loadOutlets]);


  // Clear action message after 3 seconds
  useEffect(() => {
    if (actionMessage) {
      const timer = setTimeout(() => setActionMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [actionMessage]);

  // Handle create new outlet
  const handleCreateNew = useCallback(() => {
    setSelectedOutlet(null);
    setShowOutletForm(true);
  }, []);

  // Handle select outlet for edit
  const handleSelectOutlet = useCallback((outlet: OutletType) => {
    setSelectedOutlet(outlet);
    setShowOutletForm(true);
  }, []);

  // Handle save outlet (create or update)
  const handleSaveOutlet = useCallback(async (data: OutletFormData) => {
    if (selectedOutlet) {
      // Update existing outlet
      await updateOutlet(selectedOutlet.id, {
        name: data.name,
        address: data.address,
        phone: data.phone,
        email: data.email,
      });
      setActionMessage({ type: 'success', text: 'Outlet berhasil diperbarui' });
    } else {
      // Create new outlet
      await createOutlet({
        name: data.name,
        address: data.address,
        phone: data.phone,
        email: data.email,
      });
      setActionMessage({ type: 'success', text: 'Outlet berhasil dibuat' });
    }
    setShowOutletForm(false);
    setSelectedOutlet(null);
    await loadOutlets();
  }, [selectedOutlet, loadOutlets]);

  // Handle toggle outlet status (activate/deactivate)
  const handleToggleStatus = useCallback(async (outlet: OutletType) => {
    const action = outlet.is_active ? 'menonaktifkan' : 'mengaktifkan';
    const confirmed = window.confirm(
      `Apakah Anda yakin ingin ${action} outlet "${outlet.name}"?`
    );
    
    if (!confirmed) return;

    try {
      if (outlet.is_active) {
        await deactivateOutlet(outlet.id);
        setActionMessage({ type: 'success', text: `Outlet "${outlet.name}" berhasil dinonaktifkan` });
      } else {
        // Reactivate outlet
        await updateOutlet(outlet.id, { is_active: true });
        setActionMessage({ type: 'success', text: `Outlet "${outlet.name}" berhasil diaktifkan` });
      }
      await loadOutlets();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Gagal mengubah status outlet';
      setActionMessage({ type: 'error', text: message });
    }
  }, [loadOutlets]);

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Store className="w-7 h-7 text-primary-600" />
            Manajemen Outlet
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Kelola outlet dan cabang toko
          </p>
        </div>
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
          <Button size="sm" variant="outline" onClick={loadOutlets} className="ml-auto">
            Coba Lagi
          </Button>
        </div>
      )}

      {/* Main Content */}
      <Card className="p-6">
        <OutletList
          outlets={outlets}
          loading={loading}
          onSelect={handleSelectOutlet}
          onCreateNew={handleCreateNew}
          onToggleStatus={handleToggleStatus}
        />
      </Card>

      {/* Outlet Form Modal */}
      <OutletFormModal
        isOpen={showOutletForm}
        outlet={selectedOutlet}
        onSave={handleSaveOutlet}
        onClose={() => {
          setShowOutletForm(false);
          setSelectedOutlet(null);
        }}
      />
    </div>
  );
};

export default OutletPage;
