import React, { useState, useEffect } from 'react';
import { X, Check, XCircle, Package, Loader2, Calendar, Truck, AlertCircle } from 'lucide-react';
import { Button } from '../ui/Button';
import { PurchaseOrder, Product } from '../../types';
import {
  PurchaseOrderWithItems,
  approvePurchaseOrder,
  cancelPurchaseOrder,
  receivePurchaseOrder,
  ReceivedItem,
} from '../../api/purchaseOrders';
import { supabase } from '../../lib/supabaseClient';

interface PODetailProps {
  purchaseOrder: PurchaseOrderWithItems;
  onClose: () => void;
  onUpdate: () => void;
}

const STATUS_LABELS: Record<PurchaseOrder['status'], string> = {
  pending: 'Menunggu',
  approved: 'Disetujui',
  received: 'Diterima',
  cancelled: 'Dibatalkan',
};

const STATUS_COLORS: Record<PurchaseOrder['status'], string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-blue-100 text-blue-800',
  received: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
};

interface ReceivedItemInput {
  productId: string;
  productName: string;
  orderedQuantity: number;
  receivedQuantity: number;
}

export const PODetail: React.FC<PODetailProps> = ({ purchaseOrder, onClose, onUpdate }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showReceiveForm, setShowReceiveForm] = useState(false);
  const [receivedItems, setReceivedItems] = useState<ReceivedItemInput[]>([]);
  const [receiveNotes, setReceiveNotes] = useState('');
  const [productNames, setProductNames] = useState<Record<string, string>>({});

  useEffect(() => {
    loadProductNames();
    initializeReceivedItems();
  }, [purchaseOrder]);

  const loadProductNames = async () => {
    const productIds = purchaseOrder.items.map(item => item.product_id);
    if (productIds.length === 0) return;

    const { data } = await supabase
      .from('products')
      .select('id, name')
      .in('id', productIds);

    if (data) {
      const names: Record<string, string> = {};
      data.forEach(p => { names[p.id] = p.name; });
      setProductNames(names);
    }
  };


  const initializeReceivedItems = () => {
    const items: ReceivedItemInput[] = purchaseOrder.items.map(item => ({
      productId: item.product_id,
      productName: productNames[item.product_id] || item.product_id,
      orderedQuantity: item.quantity,
      receivedQuantity: item.quantity, // Default to ordered quantity
    }));
    setReceivedItems(items);
  };

  const handleApprove = async () => {
    setLoading(true);
    setError(null);
    try {
      await approvePurchaseOrder(purchaseOrder.id);
      onUpdate();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Gagal menyetujui PO');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!confirm('Apakah Anda yakin ingin membatalkan PO ini?')) return;

    setLoading(true);
    setError(null);
    try {
      await cancelPurchaseOrder(purchaseOrder.id);
      onUpdate();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Gagal membatalkan PO');
    } finally {
      setLoading(false);
    }
  };

  const handleReceive = async () => {
    setLoading(true);
    setError(null);
    try {
      const items: ReceivedItem[] = receivedItems.map(item => ({
        productId: item.productId,
        receivedQuantity: item.receivedQuantity,
      }));

      await receivePurchaseOrder(purchaseOrder.id, items, receiveNotes || undefined);
      onUpdate();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Gagal menerima PO');
    } finally {
      setLoading(false);
    }
  };

  const handleReceivedQuantityChange = (productId: string, quantity: number) => {
    setReceivedItems(prev =>
      prev.map(item =>
        item.productId === productId
          ? { ...item, receivedQuantity: Math.max(0, quantity) }
          : item
      )
    );
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  const hasDiscrepancy = receivedItems.some(
    item => item.receivedQuantity !== item.orderedQuantity
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-xl font-semibold dark:text-white">{purchaseOrder.order_number}</h2>
            <span className={`inline-block mt-1 px-2 py-0.5 text-xs font-medium rounded-full ${STATUS_COLORS[purchaseOrder.status]}`}>
              {STATUS_LABELS[purchaseOrder.status]}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>


        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}

          {/* PO Info */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Supplier</p>
              <p className="font-medium text-gray-900 dark:text-white flex items-center gap-1">
                <Truck className="w-4 h-4 text-gray-400" />
                {purchaseOrder.supplier?.name || '-'}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Total</p>
              <p className="font-bold text-primary-600">
                Rp {purchaseOrder.total_amount.toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Tanggal Order</p>
              <p className="text-gray-900 dark:text-white flex items-center gap-1">
                <Calendar className="w-4 h-4 text-gray-400" />
                {formatDate(purchaseOrder.order_date)}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Tanggal Diharapkan</p>
              <p className="text-gray-900 dark:text-white">
                {formatDate(purchaseOrder.expected_date)}
              </p>
            </div>
            {purchaseOrder.received_date && (
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Tanggal Diterima</p>
                <p className="text-gray-900 dark:text-white">
                  {formatDate(purchaseOrder.received_date)}
                </p>
              </div>
            )}
            {purchaseOrder.notes && (
              <div className="col-span-2">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Catatan</p>
                <p className="text-gray-900 dark:text-white text-sm">{purchaseOrder.notes}</p>
              </div>
            )}
          </div>

          {/* Items */}
          <div>
            <h3 className="font-medium text-gray-900 dark:text-white mb-3 flex items-center gap-2">
              <Package className="w-4 h-4" />
              Daftar Item ({purchaseOrder.items.length})
            </h3>
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-900">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Produk</th>
                    <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Qty</th>
                    {showReceiveForm && (
                      <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Diterima</th>
                    )}
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Harga</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {purchaseOrder.items.map((item) => (
                    <tr key={item.id}>
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                        {productNames[item.product_id] || item.product_id}
                      </td>
                      <td className="px-4 py-3 text-sm text-center text-gray-900 dark:text-white">
                        {item.quantity}
                      </td>
                      {showReceiveForm && (
                        <td className="px-4 py-3">
                          <input
                            type="number"
                            min="0"
                            max={item.quantity * 2}
                            value={receivedItems.find(r => r.productId === item.product_id)?.receivedQuantity ?? item.quantity}
                            onChange={(e) => handleReceivedQuantityChange(item.product_id, parseInt(e.target.value) || 0)}
                            className="w-20 px-2 py-1 text-center border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                          />
                        </td>
                      )}
                      <td className="px-4 py-3 text-sm text-right text-gray-900 dark:text-white">
                        Rp {item.unit_price.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-gray-900 dark:text-white">
                        Rp {item.total_price.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>


          {/* Receive Form Notes */}
          {showReceiveForm && (
            <div className="mt-4">
              {hasDiscrepancy && (
                <div className="mb-3 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg text-amber-700 dark:text-amber-400 text-sm">
                  <AlertCircle className="w-4 h-4 inline mr-2" />
                  Terdapat perbedaan antara jumlah pesanan dan jumlah diterima. Perbedaan akan dicatat.
                </div>
              )}
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Catatan Penerimaan (Opsional)
              </label>
              <textarea
                value={receiveNotes}
                onChange={(e) => setReceiveNotes(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                rows={2}
                placeholder="Tambahkan catatan jika diperlukan..."
              />
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-6 border-t border-gray-200 dark:border-gray-700">
          {purchaseOrder.status === 'pending' && (
            <div className="flex gap-3">
              <Button
                variant="danger"
                onClick={handleCancel}
                disabled={loading}
                className="flex-1"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <XCircle className="w-4 h-4 mr-2" />}
                Batalkan
              </Button>
              <Button
                onClick={handleApprove}
                disabled={loading}
                className="flex-1"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Check className="w-4 h-4 mr-2" />}
                Setujui
              </Button>
            </div>
          )}

          {purchaseOrder.status === 'approved' && !showReceiveForm && (
            <div className="flex gap-3">
              <Button
                variant="danger"
                onClick={handleCancel}
                disabled={loading}
                className="flex-1"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <XCircle className="w-4 h-4 mr-2" />}
                Batalkan
              </Button>
              <Button
                onClick={() => {
                  initializeReceivedItems();
                  setShowReceiveForm(true);
                }}
                className="flex-1"
              >
                <Package className="w-4 h-4 mr-2" />
                Terima Barang
              </Button>
            </div>
          )}

          {purchaseOrder.status === 'approved' && showReceiveForm && (
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setShowReceiveForm(false)}
                disabled={loading}
                className="flex-1"
              >
                Batal
              </Button>
              <Button
                onClick={handleReceive}
                disabled={loading}
                className="flex-1"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Check className="w-4 h-4 mr-2" />}
                Konfirmasi Penerimaan
              </Button>
            </div>
          )}

          {(purchaseOrder.status === 'received' || purchaseOrder.status === 'cancelled') && (
            <Button variant="outline" onClick={onClose} className="w-full">
              Tutup
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
