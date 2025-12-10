/**
 * Print Button Component
 * Generate and download/print PDF for barcode labels
 * 
 * Requirements: 6.1 - Generate printable barcode labels
 */

import React, { useState } from 'react';
import { Printer, Download, Loader2 } from 'lucide-react';
import { Button } from '../ui/Button';
import { printLabels, generateLabelPDF, LabelSize, LabelBatchItem } from '../../lib/labelGenerator';
import { SelectedProduct } from './ProductSelectionList';

export interface PrintButtonProps {
  selectedProducts: SelectedProduct[];
  labelSize: LabelSize;
  disabled?: boolean;
}

export const PrintButton: React.FC<PrintButtonProps> = ({
  selectedProducts,
  labelSize,
  disabled = false,
}) => {
  const [isPrinting, setIsPrinting] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const prepareBatchItems = (): LabelBatchItem[] => {
    return selectedProducts
      .filter(sp => sp.product.barcode)
      .map(sp => ({
        productId: sp.product.id,
        barcode: sp.product.barcode!,
        productName: sp.product.name,
        price: sp.product.price,
        quantity: sp.quantity,
      }));
  };

  const handlePrint = async () => {
    if (selectedProducts.length === 0) return;
    
    setIsPrinting(true);
    try {
      const items = prepareBatchItems();
      printLabels({
        products: items,
        size: labelSize,
      });
    } catch (error) {
      console.error('Failed to print labels:', error);
      alert('Gagal mencetak label');
    } finally {
      setIsPrinting(false);
    }
  };

  const handleDownload = async () => {
    if (selectedProducts.length === 0) return;
    
    setIsDownloading(true);
    try {
      const items = prepareBatchItems();
      const blob = generateLabelPDF({
        products: items,
        size: labelSize,
      });
      
      // Create download link
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `barcode-labels-${new Date().toISOString().split('T')[0]}.html`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to download labels:', error);
      alert('Gagal mengunduh label');
    } finally {
      setIsDownloading(false);
    }
  };

  const totalLabels = selectedProducts.reduce((sum, sp) => sum + sp.quantity, 0);
  const isDisabled = disabled || selectedProducts.length === 0;

  return (
    <div className="flex flex-col sm:flex-row gap-3">
      <Button
        onClick={handlePrint}
        disabled={isDisabled || isPrinting}
        className="flex-1"
      >
        {isPrinting ? (
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
        ) : (
          <Printer className="w-4 h-4 mr-2" />
        )}
        Cetak {totalLabels > 0 ? `(${totalLabels} label)` : ''}
      </Button>
      
      <Button
        variant="outline"
        onClick={handleDownload}
        disabled={isDisabled || isDownloading}
      >
        {isDownloading ? (
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
        ) : (
          <Download className="w-4 h-4 mr-2" />
        )}
        Unduh
      </Button>
    </div>
  );
};
