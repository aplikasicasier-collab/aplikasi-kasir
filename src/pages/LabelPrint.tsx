/**
 * Label Print Page
 * 
 * Main page for printing barcode labels with:
 * - Product selection with barcode filter
 * - Label preview with size selection
 * - Print and download functionality
 * 
 * Requirements: 6.1
 */

import React, { useState } from 'react';
import { Tag, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import {
  ProductSelectionList,
  LabelPreview,
  PrintButton,
  SelectedProduct,
} from '../components/labelPrint';
import { LabelSize } from '../lib/labelGenerator';

const LabelPrintPage: React.FC = () => {
  const navigate = useNavigate();
  
  // State for selected products
  const [selectedProducts, setSelectedProducts] = useState<SelectedProduct[]>([]);
  
  // State for label size
  const [labelSize, setLabelSize] = useState<LabelSize>('50x30');

  // Handle back navigation
  const handleBack = () => {
    navigate('/inventori');
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleBack}
            className="flex items-center gap-1"
          >
            <ArrowLeft className="w-4 h-4" />
            Kembali
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Tag className="w-7 h-7 text-primary-600" />
              Cetak Label Barcode
            </h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1">
              Pilih produk dan cetak label barcode
            </p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Product Selection */}
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Pilih Produk
          </h2>
          <ProductSelectionList
            selectedProducts={selectedProducts}
            onSelectionChange={setSelectedProducts}
          />
        </Card>

        {/* Label Preview and Print */}
        <div className="space-y-6">
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Preview & Pengaturan
            </h2>
            <LabelPreview
              selectedProducts={selectedProducts}
              labelSize={labelSize}
              onSizeChange={setLabelSize}
            />
          </Card>

          <Card className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Cetak Label
            </h2>
            <PrintButton
              selectedProducts={selectedProducts}
              labelSize={labelSize}
            />
          </Card>
        </div>
      </div>
    </div>
  );
};

export default LabelPrintPage;
