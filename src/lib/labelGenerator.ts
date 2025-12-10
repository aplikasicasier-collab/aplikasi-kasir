/**
 * Label Generator
 * Generates barcode labels for products with barcode, name, and price
 * Supports 38x25mm and 50x30mm label sizes
 * 
 * Requirements: 6.1, 6.2, 6.3, 6.4
 */

import { formatCurrency } from './receipt';

// ============================================
// Types
// ============================================

export type LabelSize = '38x25' | '50x30';

export interface LabelData {
  barcode: string;
  productName: string;
  price: number;
  size: LabelSize;
}

export interface LabelBatchItem {
  productId: string;
  barcode: string;
  productName: string;
  price: number;
  quantity: number;
}

export interface LabelBatch {
  products: LabelBatchItem[];
  size: LabelSize;
}

// Label dimensions in mm and pixels (assuming 96 DPI for screen, 300 DPI for print)
const LABEL_DIMENSIONS: Record<LabelSize, { widthMm: number; heightMm: number; widthPx: number; heightPx: number }> = {
  '38x25': { widthMm: 38, heightMm: 25, widthPx: 144, heightPx: 95 },
  '50x30': { widthMm: 50, heightMm: 30, widthPx: 189, heightPx: 113 },
};

// ============================================
// Code 128 Barcode Encoding
// ============================================

// Code 128 character set B (ASCII 32-127)
const CODE128_START_B = 104;
const CODE128_STOP = 106;

// Code 128 patterns (bars: 1=black, 0=white)
const CODE128_PATTERNS: string[] = [
  '11011001100', '11001101100', '11001100110', '10010011000', '10010001100', // 0-4
  '10001001100', '10011001000', '10011000100', '10001100100', '11001001000', // 5-9
  '11001000100', '11000100100', '10110011100', '10011011100', '10011001110', // 10-14
  '10111001100', '10011101100', '10011100110', '11001110010', '11001011100', // 15-19
  '11001001110', '11011100100', '11001110100', '11101101110', '11101001100', // 20-24
  '11100101100', '11100100110', '11101100100', '11100110100', '11100110010', // 25-29
  '11011011000', '11011000110', '11000110110', '10100011000', '10001011000', // 30-34
  '10001000110', '10110001000', '10001101000', '10001100010', '11010001000', // 35-39
  '11000101000', '11000100010', '10110111000', '10110001110', '10001101110', // 40-44
  '10111011000', '10111000110', '10001110110', '11101110110', '11010001110', // 45-49
  '11000101110', '11011101000', '11011100010', '11011101110', '11101011000', // 50-54
  '11101000110', '11100010110', '11101101000', '11101100010', '11100011010', // 55-59
  '11101111010', '11001000010', '11110001010', '10100110000', '10100001100', // 60-64
  '10010110000', '10010000110', '10000101100', '10000100110', '10110010000', // 65-69
  '10110000100', '10011010000', '10011000010', '10000110100', '10000110010', // 70-74
  '11000010010', '11001010000', '11110111010', '11000010100', '10001111010', // 75-79
  '10100111100', '10010111100', '10010011110', '10111100100', '10011110100', // 80-84
  '10011110010', '11110100100', '11110010100', '11110010010', '11011011110', // 85-89
  '11011110110', '11110110110', '10101111000', '10100011110', '10001011110', // 90-94
  '10111101000', '10111100010', '11110101000', '11110100010', '10111011110', // 95-99
  '10111101110', '11101011110', '11110101110', '11010000100', '11010010000', // 100-104
  '11010011100', '1100011101011', // 105-106 (STOP has extra bar)
];

/**
 * Encode a string to Code 128 barcode pattern
 */
function encodeCode128(data: string): string {
  if (!data || data.length === 0) {
    return '';
  }

  const values: number[] = [CODE128_START_B];
  
  // Convert characters to Code 128 values
  for (let i = 0; i < data.length; i++) {
    const charCode = data.charCodeAt(i);
    if (charCode < 32 || charCode > 127) {
      // Skip invalid characters
      continue;
    }
    values.push(charCode - 32);
  }

  // Calculate checksum
  let checksum = values[0];
  for (let i = 1; i < values.length; i++) {
    checksum += values[i] * i;
  }
  checksum = checksum % 103;
  values.push(checksum);
  values.push(CODE128_STOP);

  // Convert to bar pattern
  return values.map(v => CODE128_PATTERNS[v]).join('');
}

// ============================================
// SVG Generation
// ============================================

/**
 * Generate SVG barcode from pattern
 */
function generateBarcodeSVG(pattern: string, width: number, height: number): string {
  if (!pattern) {
    return '';
  }

  const barWidth = width / pattern.length;
  let svg = '';
  let x = 0;

  for (let i = 0; i < pattern.length; i++) {
    if (pattern[i] === '1') {
      svg += `<rect x="${x.toFixed(2)}" y="0" width="${barWidth.toFixed(2)}" height="${height}" fill="black"/>`;
    }
    x += barWidth;
  }

  return svg;
}

/**
 * Truncate text to fit within a maximum width (approximate)
 */
function truncateText(text: string, maxChars: number): string {
  if (text.length <= maxChars) {
    return text;
  }
  return text.substring(0, maxChars - 2) + '..';
}

/**
 * Generate a single label as SVG
 * Requirements: 6.1, 6.2 - Include barcode, product name, and price
 */
export function generateLabelSVG(data: LabelData): string {
  const { barcode, productName, price, size } = data;
  const dims = LABEL_DIMENSIONS[size];
  
  // Calculate layout based on size
  const padding = size === '38x25' ? 4 : 6;
  const barcodeHeight = size === '38x25' ? 30 : 40;
  const fontSize = size === '38x25' ? 8 : 10;
  const priceFontSize = size === '38x25' ? 10 : 12;
  const maxNameChars = size === '38x25' ? 18 : 24;
  
  const barcodeWidth = dims.widthPx - (padding * 2);
  const barcodeY = padding;
  const barcodeTextY = barcodeY + barcodeHeight + fontSize + 2;
  const nameY = barcodeTextY + fontSize + 4;
  const priceY = nameY + priceFontSize + 2;
  
  // Encode barcode
  const barcodePattern = encodeCode128(barcode);
  const barcodeSVG = generateBarcodeSVG(barcodePattern, barcodeWidth, barcodeHeight);
  
  // Truncate product name if needed
  const displayName = truncateText(productName, maxNameChars);
  
  // Format price
  const displayPrice = formatCurrency(price);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${dims.widthPx}" height="${dims.heightPx}" viewBox="0 0 ${dims.widthPx} ${dims.heightPx}">
  <rect width="100%" height="100%" fill="white"/>
  <g transform="translate(${padding}, ${barcodeY})">
    ${barcodeSVG}
  </g>
  <text x="${dims.widthPx / 2}" y="${barcodeTextY}" text-anchor="middle" font-family="monospace" font-size="${fontSize}" fill="black">${escapeXml(barcode)}</text>
  <text x="${dims.widthPx / 2}" y="${nameY}" text-anchor="middle" font-family="Arial, sans-serif" font-size="${fontSize}" font-weight="bold" fill="black">${escapeXml(displayName)}</text>
  <text x="${dims.widthPx / 2}" y="${priceY}" text-anchor="middle" font-family="Arial, sans-serif" font-size="${priceFontSize}" font-weight="bold" fill="black">${escapeXml(displayPrice)}</text>
</svg>`;
}

/**
 * Escape XML special characters
 */
function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// ============================================
// PDF Generation
// ============================================

/**
 * Generate PDF content for batch label printing
 * Requirements: 6.1, 6.3, 6.4 - Generate printable labels, support sizes, batch printing
 * 
 * This generates an HTML document that can be printed as PDF
 * Each label is repeated according to quantity
 */
export function generateLabelPDF(batch: LabelBatch): Blob {
  const { products, size } = batch;
  const dims = LABEL_DIMENSIONS[size];
  
  // Generate all labels (respecting quantity)
  const labels: string[] = [];
  for (const product of products) {
    const labelData: LabelData = {
      barcode: product.barcode,
      productName: product.productName,
      price: product.price,
      size,
    };
    const svg = generateLabelSVG(labelData);
    
    // Add label multiple times based on quantity
    for (let i = 0; i < product.quantity; i++) {
      labels.push(svg);
    }
  }

  // Calculate labels per row based on A4 paper (210mm width)
  const labelsPerRow = Math.floor(200 / dims.widthMm);
  
  // Generate HTML with print styles
  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Barcode Labels</title>
  <style>
    @page {
      size: A4;
      margin: 5mm;
    }
    body {
      margin: 0;
      padding: 5mm;
      font-family: Arial, sans-serif;
    }
    .labels-container {
      display: flex;
      flex-wrap: wrap;
      gap: 2mm;
    }
    .label {
      width: ${dims.widthMm}mm;
      height: ${dims.heightMm}mm;
      border: 0.5px dashed #ccc;
      box-sizing: border-box;
      page-break-inside: avoid;
    }
    .label svg {
      width: 100%;
      height: 100%;
    }
    @media print {
      .label {
        border: none;
      }
    }
  </style>
</head>
<body>
  <div class="labels-container">
    ${labels.map(svg => `<div class="label">${svg}</div>`).join('\n    ')}
  </div>
</body>
</html>`;

  return new Blob([html], { type: 'text/html' });
}

/**
 * Print labels by opening a new window with the generated HTML
 * Requirements: 6.1 - Generate printable barcode labels
 */
export function printLabels(batch: LabelBatch): void {
  const blob = generateLabelPDF(batch);
  const url = URL.createObjectURL(blob);
  
  const printWindow = window.open(url, '_blank');
  if (printWindow) {
    printWindow.onload = () => {
      printWindow.print();
    };
  }
  
  // Clean up URL after a delay
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

// ============================================
// Validation
// ============================================

/**
 * Validate that a label contains all required content
 * Requirements: 6.1, 6.2 - Labels must include barcode, product name, and price
 */
export function validateLabelContent(svg: string, data: LabelData): boolean {
  const { barcode, productName, price } = data;
  
  // Check barcode is present
  if (!svg.includes(escapeXml(barcode))) {
    return false;
  }
  
  // Check product name is present (may be truncated)
  const truncatedName = truncateText(productName, data.size === '38x25' ? 18 : 24);
  if (!svg.includes(escapeXml(truncatedName))) {
    return false;
  }
  
  // Check price is present
  const formattedPrice = formatCurrency(price);
  if (!svg.includes(escapeXml(formattedPrice))) {
    return false;
  }
  
  return true;
}

/**
 * Get label dimensions for a given size
 */
export function getLabelDimensions(size: LabelSize): { widthMm: number; heightMm: number } {
  const dims = LABEL_DIMENSIONS[size];
  return { widthMm: dims.widthMm, heightMm: dims.heightMm };
}
