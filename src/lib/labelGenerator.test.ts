import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  generateLabelSVG,
  generateLabelPDF,
  validateLabelContent,
  getLabelDimensions,
  LabelData,
  LabelSize,
  LabelBatch,
} from './labelGenerator';
import { formatCurrency } from './receipt';

// ============================================
// Generators
// ============================================

// Generator for valid barcode strings
const validBarcode = fc.array(
  fc.constantFrom(...'0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'.split('')),
  { minLength: 1, maxLength: 20 }
).map(arr => arr.join(''));

// Generator for product names (non-empty, printable ASCII)
const productName = fc.array(
  fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 -_'.split('')),
  { minLength: 1, maxLength: 50 }
).map(arr => arr.join('')).filter(s => s.trim().length > 0);

// Generator for prices (positive numbers)
const price = fc.integer({ min: 100, max: 100000000 });

// Generator for label sizes
const labelSize = fc.constantFrom<LabelSize>('38x25', '50x30');

// Generator for label data
const labelData = fc.record<LabelData>({
  barcode: validBarcode,
  productName: productName,
  price: price,
  size: labelSize,
});

// Generator for batch item quantity
const quantity = fc.integer({ min: 1, max: 10 });

// ============================================
// Unit Tests
// ============================================

describe('Label Generator', () => {
  describe('generateLabelSVG', () => {
    it('should generate valid SVG for 38x25 size', () => {
      const data: LabelData = {
        barcode: '1234567890',
        productName: 'Test Product',
        price: 15000,
        size: '38x25',
      };
      
      const svg = generateLabelSVG(data);
      
      expect(svg).toContain('<svg');
      expect(svg).toContain('</svg>');
      expect(svg).toContain('1234567890');
      expect(svg).toContain('Test Product');
      expect(svg).toContain(formatCurrency(15000));
    });

    it('should generate valid SVG for 50x30 size', () => {
      const data: LabelData = {
        barcode: 'ABC123',
        productName: 'Another Product',
        price: 25000,
        size: '50x30',
      };
      
      const svg = generateLabelSVG(data);
      
      expect(svg).toContain('<svg');
      expect(svg).toContain('</svg>');
      expect(svg).toContain('ABC123');
      expect(svg).toContain('Another Product');
      expect(svg).toContain(formatCurrency(25000));
    });

    it('should truncate long product names', () => {
      const data: LabelData = {
        barcode: '123',
        productName: 'This is a very long product name that should be truncated',
        price: 10000,
        size: '38x25',
      };
      
      const svg = generateLabelSVG(data);
      
      // Should contain truncated name with '..'
      expect(svg).toContain('..');
      // Should not contain full name
      expect(svg).not.toContain('This is a very long product name that should be truncated');
    });

    it('should escape XML special characters', () => {
      const data: LabelData = {
        barcode: '123',
        productName: 'Product <Test> & "Special"',
        price: 10000,
        size: '38x25',
      };
      
      const svg = generateLabelSVG(data);
      
      // Should contain escaped characters
      expect(svg).toContain('&lt;');
      expect(svg).toContain('&gt;');
      expect(svg).toContain('&amp;');
    });
  });

  describe('generateLabelPDF', () => {
    it('should generate HTML blob for batch printing', () => {
      const batch: LabelBatch = {
        products: [
          {
            productId: '1',
            barcode: '123456',
            productName: 'Product 1',
            price: 10000,
            quantity: 2,
          },
          {
            productId: '2',
            barcode: '789012',
            productName: 'Product 2',
            price: 20000,
            quantity: 1,
          },
        ],
        size: '38x25',
      };
      
      const blob = generateLabelPDF(batch);
      
      expect(blob).toBeInstanceOf(Blob);
      expect(blob.type).toBe('text/html');
    });

    it('should respect quantity for each product', async () => {
      const batch: LabelBatch = {
        products: [
          {
            productId: '1',
            barcode: 'TEST123',
            productName: 'Test Product',
            price: 15000,
            quantity: 3,
          },
        ],
        size: '50x30',
      };
      
      const blob = generateLabelPDF(batch);
      const html = await blob.text();
      
      // Should contain 3 instances of the barcode (one per quantity)
      const matches = html.match(/TEST123/g);
      expect(matches).toHaveLength(3);
    });
  });

  describe('validateLabelContent', () => {
    it('should return true for valid label with all content', () => {
      const data: LabelData = {
        barcode: '1234567890',
        productName: 'Test Product',
        price: 15000,
        size: '38x25',
      };
      
      const svg = generateLabelSVG(data);
      const isValid = validateLabelContent(svg, data);
      
      expect(isValid).toBe(true);
    });

    it('should return false if barcode is missing', () => {
      const data: LabelData = {
        barcode: '1234567890',
        productName: 'Test Product',
        price: 15000,
        size: '38x25',
      };
      
      // Create SVG without barcode
      const fakeSvg = '<svg><text>Test Product</text><text>Rp15.000</text></svg>';
      const isValid = validateLabelContent(fakeSvg, data);
      
      expect(isValid).toBe(false);
    });
  });

  describe('getLabelDimensions', () => {
    it('should return correct dimensions for 38x25', () => {
      const dims = getLabelDimensions('38x25');
      expect(dims.widthMm).toBe(38);
      expect(dims.heightMm).toBe(25);
    });

    it('should return correct dimensions for 50x30', () => {
      const dims = getLabelDimensions('50x30');
      expect(dims.widthMm).toBe(50);
      expect(dims.heightMm).toBe(30);
    });
  });
});

// ============================================
// Property-Based Tests
// ============================================

// **Feature: barcode-scanner, Property 10: Label Generation Content**
// **Validates: Requirements 6.1, 6.2**
describe('Property 10: Label Generation Content', () => {
  it('should always include barcode value in generated label', () => {
    fc.assert(
      fc.property(labelData, (data: LabelData) => {
        const svg = generateLabelSVG(data);
        // Barcode should be present in the SVG (escaped if needed)
        const escapedBarcode = data.barcode
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;');
        return svg.includes(escapedBarcode);
      }),
      { numRuns: 100 }
    );
  });

  it('should always include product name (or truncated version) in generated label', () => {
    fc.assert(
      fc.property(labelData, (data: LabelData) => {
        const svg = generateLabelSVG(data);
        const maxChars = data.size === '38x25' ? 18 : 24;
        
        // Get expected name (truncated if needed)
        let expectedName = data.productName;
        if (expectedName.length > maxChars) {
          expectedName = expectedName.substring(0, maxChars - 2) + '..';
        }
        
        // Escape for XML
        const escapedName = expectedName
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&apos;');
        
        return svg.includes(escapedName);
      }),
      { numRuns: 100 }
    );
  });

  it('should always include formatted price in generated label', () => {
    fc.assert(
      fc.property(labelData, (data: LabelData) => {
        const svg = generateLabelSVG(data);
        const formattedPrice = formatCurrency(data.price);
        // Escape for XML
        const escapedPrice = formattedPrice
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;');
        return svg.includes(escapedPrice);
      }),
      { numRuns: 100 }
    );
  });

  it('should generate valid SVG structure for any label data', () => {
    fc.assert(
      fc.property(labelData, (data: LabelData) => {
        const svg = generateLabelSVG(data);
        // Should be valid SVG structure
        return (
          svg.startsWith('<svg') &&
          svg.endsWith('</svg>') &&
          svg.includes('xmlns="http://www.w3.org/2000/svg"')
        );
      }),
      { numRuns: 100 }
    );
  });

  it('should pass validation for any generated label', () => {
    fc.assert(
      fc.property(labelData, (data: LabelData) => {
        const svg = generateLabelSVG(data);
        return validateLabelContent(svg, data);
      }),
      { numRuns: 100 }
    );
  });

  it('should generate correct number of labels in batch based on quantity', async () => {
    await fc.assert(
      fc.asyncProperty(
        validBarcode,
        productName,
        price,
        quantity,
        labelSize,
        async (barcode: string, name: string, priceVal: number, qty: number, size: LabelSize) => {
          const batch: LabelBatch = {
            products: [{
              productId: '1',
              barcode,
              productName: name,
              price: priceVal,
              quantity: qty,
            }],
            size,
          };
          
          const blob = generateLabelPDF(batch);
          const html = await blob.text();
          
          // Count the number of label divs (each label is wrapped in a div with class "label")
          const labelDivMatches = html.match(/<div class="label">/g);
          
          // Should have exactly qty label divs
          return labelDivMatches !== null && labelDivMatches.length === qty;
        }
      ),
      { numRuns: 100 }
    );
  });
});
