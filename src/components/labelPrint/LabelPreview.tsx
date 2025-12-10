/**
 * Label Preview Component
 * Shows label preview with barcode and size selection
 * 
 * Requirements: 6.2, 6.3 - Include barcode, name, price; support label sizes
 */

import React, { useMemo } from 'react';
import { generateLabelSVG, LabelSize, getLabelDimensions } from '../../lib/labelGenerator';
import { SelectedProduct } from './ProductSelectionList';

export interface LabelPreviewProps {
  selectedProducts: SelectedProduct[];
  labelSize: LabelSize;
  onSizeChange: (size: LabelSize) => void;
}

export const LabelPreview: React.FC<LabelPreviewProps> = ({
  selectedProducts,
  labelSize,
  onSizeChange,
}) => {
  const dimensions = getLabelDimensions(labelSize);

  // Generate preview SVGs for first few products
  const previewLabels = useMemo(() => {
    return selectedProducts.slice(0, 4).map(({ product }) => {
      if (!product.barcode) return null;
      
      const svg = generateLabelSVG({
        barcode: product.barcode,
        productName: product.name,
        price: product.price,
        size: labelSize,
      });
      
      return {
        productId: product.id,
        productName: product.name,
        svg,
      };
    }).filter(Boolean);
  }, [selectedProducts, labelSize]);

  const totalLabels = selectedProducts.reduce((sum, sp) => sum + sp.quantity, 0);

  return (
    <div className="space-y-4">
      {/* Size Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Ukuran Label
        </label>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => onSizeChange('38x25')}
            className={`flex-1 p-3 rounded-lg border-2 transition-all ${
              labelSize === '38x25'
                ? 'border-primary-500 bg-primary-50 text-primary-700'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="text-center">
              <p className="font-medium">38 x 25 mm</p>
              <p className="text-xs text-gray-500">Label kecil</p>
            </div>
          </button>
          <button
            type="button"
            onClick={() => onSizeChange('50x30')}
            className={`flex-1 p-3 rounded-lg border-2 transition-all ${
              labelSize === '50x30'
                ? 'border-primary-500 bg-primary-50 text-primary-700'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="text-center">
              <p className="font-medium">50 x 30 mm</p>
              <p className="text-xs text-gray-500">Label standar</p>
            </div>
          </button>
        </div>
      </div>

      {/* Label Info */}
      <div className="p-3 bg-gray-50 rounded-lg">
        <p className="text-sm text-gray-600">
          Ukuran: <span className="font-medium">{dimensions.widthMm} x {dimensions.heightMm} mm</span>
        </p>
        <p className="text-sm text-gray-600">
          Total label: <span className="font-medium">{totalLabels}</span>
        </p>
      </div>

      {/* Preview */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Preview Label
        </label>
        
        {selectedProducts.length === 0 ? (
          <div className="p-8 border-2 border-dashed border-gray-300 rounded-lg text-center text-gray-500">
            Pilih produk untuk melihat preview label
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {previewLabels.map((label) => (
              <div
                key={label!.productId}
                className="border border-gray-200 rounded-lg p-2 bg-white"
              >
                <div
                  className="mx-auto"
                  style={{
                    width: labelSize === '38x25' ? '144px' : '189px',
                    height: labelSize === '38x25' ? '95px' : '113px',
                  }}
                  dangerouslySetInnerHTML={{ __html: label!.svg }}
                />
                <p className="text-xs text-gray-500 text-center mt-1 truncate">
                  {label!.productName}
                </p>
              </div>
            ))}
          </div>
        )}

        {selectedProducts.length > 4 && (
          <p className="text-sm text-gray-500 text-center mt-2">
            +{selectedProducts.length - 4} produk lainnya
          </p>
        )}
      </div>
    </div>
  );
};
