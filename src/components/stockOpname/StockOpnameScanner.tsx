/**
 * Stock Opname Scanner Component
 * Continuous scanning mode for stock opname
 * Display current stock and input for actual count
 * Highlight discrepancies
 * Requirements: 5.1, 5.2, 5.3
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Camera, Barcode, Package, AlertTriangle, Check, X, Loader2 } from 'lucide-react';
import { Button } from '../ui/Button';
import { CameraScanner } from '../scanner/CameraScanner';
import { BarcodeInput } from '../scanner/BarcodeInput';
import { playSuccessBeep, playErrorBeep, playWarningBeep } from '../scanner/audioFeedback';
import { lookupProductByBarcode } from '@/api/barcodes';
import { StockOpnameItem, addOpnameItem, updateOpnameItem } from '@/api/stockOpname';
import { Product } from '@/types';

interface StockOpnameScannerProps {
  opnameId: string;
  existingItems: StockOpnameItem[];
  onItemScanned: (item: StockOpnameItem) => void;
  onItemUpdated: (item: StockOpnameItem) => void;
}

interface ScannedProduct {
  product: Product;
  systemStock: number;
  actualStock: number;
  existingItemId?: string;
}

export const StockOpnameScanner: React.FC<StockOpnameScannerProps> = ({
  opnameId,
  existingItems,
  onItemScanned,
  onItemUpdated,
}) => {
  const [showCamera, setShowCamera] = useState(false);
  const [scannedProduct, setScannedProduct] = useState<ScannedProduct | null>(null);
  const [actualStockInput, setActualStockInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);


  // Focus on actual stock input when product is scanned
  useEffect(() => {
    if (scannedProduct && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [scannedProduct]);

  // Clear messages after timeout
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  // Handle barcode scan
  const handleBarcodeScan = useCallback(async (barcode: string) => {
    setError(null);
    setIsProcessing(true);

    try {
      const result = await lookupProductByBarcode(barcode);

      if (!result.found || !result.product) {
        playErrorBeep();
        setError(`Produk dengan barcode "${barcode}" tidak ditemukan`);
        setScannedProduct(null);
        return;
      }

      const product = result.product;
      
      // Check if product already scanned in this opname
      const existingItem = existingItems.find(item => item.product_id === product.id);
      
      playSuccessBeep();
      setScannedProduct({
        product,
        systemStock: product.stock_quantity,
        actualStock: existingItem?.actual_stock ?? product.stock_quantity,
        existingItemId: existingItem?.id,
      });
      setActualStockInput(existingItem?.actual_stock?.toString() ?? product.stock_quantity.toString());
      
    } catch (err) {
      playErrorBeep();
      setError(err instanceof Error ? err.message : 'Gagal memproses barcode');
      setScannedProduct(null);
    } finally {
      setIsProcessing(false);
    }
  }, [existingItems]);

  // Handle actual stock submission
  const handleSubmitActualStock = useCallback(async () => {
    if (!scannedProduct) return;

    const actualStock = parseInt(actualStockInput, 10);
    if (isNaN(actualStock) || actualStock < 0) {
      setError('Masukkan jumlah stok yang valid (angka positif)');
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      let item: StockOpnameItem;

      if (scannedProduct.existingItemId) {
        // Update existing item
        item = await updateOpnameItem(scannedProduct.existingItemId, actualStock);
        onItemUpdated(item);
      } else {
        // Add new item
        item = await addOpnameItem(opnameId, scannedProduct.product.id, actualStock);
        onItemScanned(item);
      }

      const discrepancy = actualStock - scannedProduct.systemStock;
      if (discrepancy !== 0) {
        playWarningBeep();
        setSuccessMessage(`Tercatat: ${scannedProduct.product.name} (Selisih: ${discrepancy > 0 ? '+' : ''}${discrepancy})`);
      } else {
        playSuccessBeep();
        setSuccessMessage(`Tercatat: ${scannedProduct.product.name} (Stok sesuai)`);
      }

      // Reset for next scan
      setScannedProduct(null);
      setActualStockInput('');

    } catch (err) {
      playErrorBeep();
      setError(err instanceof Error ? err.message : 'Gagal menyimpan data opname');
    } finally {
      setIsProcessing(false);
    }
  }, [scannedProduct, actualStockInput, opnameId, onItemScanned, onItemUpdated]);

  // Handle cancel
  const handleCancel = () => {
    setScannedProduct(null);
    setActualStockInput('');
    setError(null);
  };

  // Handle key press for quick submission
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSubmitActualStock();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };

  const discrepancy = scannedProduct 
    ? parseInt(actualStockInput, 10) - scannedProduct.systemStock 
    : 0;

  return (
    <div className="space-y-4">
      {/* Scanner Controls */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1">
          <BarcodeInput
            onSubmit={handleBarcodeScan}
            placeholder="Scan atau ketik barcode produk..."
            disabled={isProcessing}
            autoFocus={!scannedProduct}
          />
        </div>
        <Button
          variant="outline"
          onClick={() => setShowCamera(true)}
          className="flex items-center gap-2"
          disabled={isProcessing}
        >
          <Camera className="w-4 h-4" />
          Kamera
        </Button>
      </div>


      {/* Success Message */}
      {successMessage && (
        <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg flex items-center gap-2">
          <Check className="w-5 h-5 text-green-600 dark:text-green-400" />
          <span className="text-green-800 dark:text-green-200">{successMessage}</span>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
          <span className="text-red-800 dark:text-red-200">{error}</span>
        </div>
      )}

      {/* Processing Indicator */}
      {isProcessing && !scannedProduct && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-primary-600 mr-2" />
          <span className="text-gray-600 dark:text-gray-400">Memproses...</span>
        </div>
      )}

      {/* Scanned Product Card */}
      {scannedProduct && (
        <div className={`p-4 rounded-lg border-2 ${
          !isNaN(discrepancy) && discrepancy !== 0
            ? 'border-yellow-400 bg-yellow-50 dark:bg-yellow-900/20'
            : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
        }`}>
          <div className="flex items-start gap-4">
            {/* Product Info */}
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <Package className="w-5 h-5 text-gray-500" />
                <h3 className="font-semibold text-gray-900 dark:text-white">
                  {scannedProduct.product.name}
                </h3>
              </div>
              
              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-3">
                <Barcode className="w-4 h-4" />
                <span>{scannedProduct.product.barcode}</span>
              </div>

              {/* Stock Info */}
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="p-3 bg-gray-100 dark:bg-gray-700 rounded-lg">
                  <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Stok Sistem</div>
                  <div className="text-xl font-bold text-gray-900 dark:text-white">
                    {scannedProduct.systemStock}
                  </div>
                </div>
                
                <div className="p-3 bg-primary-50 dark:bg-primary-900/20 rounded-lg">
                  <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Stok Aktual</div>
                  <input
                    ref={inputRef}
                    type="number"
                    min="0"
                    value={actualStockInput}
                    onChange={(e) => setActualStockInput(e.target.value)}
                    onKeyDown={handleKeyPress}
                    className="w-full text-xl font-bold bg-transparent border-none focus:outline-none focus:ring-0 text-primary-600 dark:text-primary-400"
                    disabled={isProcessing}
                  />
                </div>
              </div>

              {/* Discrepancy Display */}
              {!isNaN(discrepancy) && discrepancy !== 0 && (
                <div className={`p-2 rounded-lg flex items-center gap-2 ${
                  discrepancy > 0 
                    ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200'
                    : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200'
                }`}>
                  <AlertTriangle className="w-4 h-4" />
                  <span className="font-medium">
                    Selisih: {discrepancy > 0 ? '+' : ''}{discrepancy}
                  </span>
                </div>
              )}

              {scannedProduct.existingItemId && (
                <div className="mt-2 text-xs text-blue-600 dark:text-blue-400">
                  * Produk ini sudah pernah di-scan. Data akan diperbarui.
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <Button
              onClick={handleSubmitActualStock}
              disabled={isProcessing || actualStockInput === ''}
              className="flex-1 flex items-center justify-center gap-2"
            >
              {isProcessing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Check className="w-4 h-4" />
              )}
              Simpan
            </Button>
            <Button
              variant="outline"
              onClick={handleCancel}
              disabled={isProcessing}
              className="flex items-center gap-2"
            >
              <X className="w-4 h-4" />
              Batal
            </Button>
          </div>
        </div>
      )}

      {/* Instructions when no product scanned */}
      {!scannedProduct && !isProcessing && (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          <Barcode className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>Scan barcode produk untuk memulai penghitungan stok</p>
          <p className="text-sm mt-1">Gunakan scanner eksternal atau kamera</p>
        </div>
      )}

      {/* Camera Scanner Modal */}
      {showCamera && (
        <CameraScanner
          isActive={showCamera}
          onScan={(barcode) => {
            handleBarcodeScan(barcode);
            // Keep camera open in continuous mode
          }}
          onError={(err) => setError(err)}
          onClose={() => setShowCamera(false)}
          continuous={true}
        />
      )}
    </div>
  );
};

export default StockOpnameScanner;
