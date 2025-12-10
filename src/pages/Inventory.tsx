import React, { useEffect, useState, useRef } from 'react';
import { 
  Plus, 
  Search, 
  Edit2, 
  Trash2, 
  Package, 
  Image as ImageIcon,
  X,
  Save,
  Store,
  Eye,
  Barcode,
  RefreshCw,
  Camera
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Product, Category, Supplier } from '../types';
import { getProducts, createProduct, updateProduct, deleteProduct, uploadProductImage } from '../api/inventory';
import { listCategories } from '../api/categories';
import { listSuppliers } from '../api/suppliers';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { useOutlet } from '../contexts/OutletContext';
import { getOutletStock, getProductStockByOutlet, OutletStockBreakdown } from '../api/outletStock';
import { generateInternalBarcode, validateBarcodeFormat } from '../lib/barcodeUtils';
import { checkBarcodeUniqueness } from '../api/barcodes';
import { CameraScanner } from '../components/scanner/CameraScanner';

const Inventory: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebouncedValue(searchTerm, 300);
  
  // Outlet context for multi-outlet support (Requirements: 3.1, 3.4)
  const { currentOutlet } = useOutlet();
  
  // Outlet stock state
  const [outletStockMap, setOutletStockMap] = useState<Map<string, number>>(new Map());
  
  // Stock breakdown modal state (Requirements: 3.4)
  const [showStockBreakdown, setShowStockBreakdown] = useState(false);
  const [selectedProductForBreakdown, setSelectedProductForBreakdown] = useState<Product | null>(null);
  const [stockBreakdown, setStockBreakdown] = useState<OutletStockBreakdown[]>([]);
  const [isLoadingBreakdown, setIsLoadingBreakdown] = useState(false);
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    barcode: '',
    price: 0,
    stock_quantity: 0,
    min_stock: 5,
    image_url: '',
    category_id: '',
    supplier_id: '',
    is_active: true
  });

  // Barcode field state (Requirements: 3.1, 3.4)
  const [barcodeError, setBarcodeError] = useState<string | null>(null);
  const [isGeneratingBarcode, setIsGeneratingBarcode] = useState(false);
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);
  const barcodeInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadProducts();
    loadCategories();
    loadSuppliers();
  }, []);

  // Load outlet-specific stock when outlet changes (Requirements: 3.1)
  useEffect(() => {
    if (currentOutlet) {
      loadOutletStock();
    }
  }, [currentOutlet]);

  const loadProducts = async () => {
    setIsLoading(true);
    try {
      const data = await getProducts();
      setProducts(data);
    } catch (error) {
      console.error('Failed to load products:', error);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Load outlet-specific stock quantities
   * Requirements: 3.1 - Display stock quantities for selected outlet only
   */
  const loadOutletStock = async () => {
    if (!currentOutlet) return;
    
    try {
      const outletStock = await getOutletStock(currentOutlet.id);
      const stockMap = new Map<string, number>();
      outletStock.forEach(item => {
        stockMap.set(item.product_id, item.quantity);
      });
      setOutletStockMap(stockMap);
    } catch (error) {
      console.error('Failed to load outlet stock:', error);
    }
  };

  /**
   * Get stock quantity for a product - uses outlet stock if available
   * Requirements: 3.1 - Display stock quantities for selected outlet only
   */
  const getProductStock = (product: Product): number => {
    if (currentOutlet && outletStockMap.has(product.id)) {
      return outletStockMap.get(product.id) || 0;
    }
    return product.stock_quantity;
  };

  /**
   * Show stock breakdown by outlet for a product
   * Requirements: 3.4 - Show stock breakdown by outlet
   */
  const handleShowStockBreakdown = async (product: Product) => {
    setSelectedProductForBreakdown(product);
    setShowStockBreakdown(true);
    setIsLoadingBreakdown(true);
    
    try {
      const breakdown = await getProductStockByOutlet(product.id);
      setStockBreakdown(breakdown);
    } catch (error) {
      console.error('Failed to load stock breakdown:', error);
      setStockBreakdown([]);
    } finally {
      setIsLoadingBreakdown(false);
    }
  };

  const loadCategories = async () => {
    try {
      const data = await listCategories();
      setCategories(data);
    } catch (error) {
      console.error('Failed to load categories:', error);
    }
  };

  const loadSuppliers = async () => {
    try {
      const data = await listSuppliers();
      setSuppliers(data);
    } catch (error) {
      console.error('Failed to load suppliers:', error);
    }
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
    p.barcode?.includes(debouncedSearch)
  );

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      barcode: product.barcode || '',
      price: product.price,
      stock_quantity: product.stock_quantity,
      min_stock: product.min_stock || 5,
      image_url: product.image_url || '',
      category_id: product.category_id || '',
      supplier_id: product.supplier_id || '',
      is_active: product.is_active
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Apakah Anda yakin ingin menghapus produk ini?')) return;
    try {
      await deleteProduct(id);
      loadProducts();
    } catch (error) {
      alert('Gagal menghapus produk');
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      if (editingProduct) {
        await updateProduct(editingProduct.id, formData);
      } else {
        await createProduct(formData);
      }
      setIsModalOpen(false);
      loadProducts();
      resetForm();
    } catch (error: any) {
      alert('Gagal menyimpan: ' + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    try {
      const url = await uploadProductImage(file);
      setFormData(prev => ({ ...prev, image_url: url }));
    } catch (error) {
      alert('Gagal upload gambar');
    }
  };

  const resetForm = () => {
    setEditingProduct(null);
    setFormData({
      name: '',
      barcode: '',
      price: 0,
      stock_quantity: 0,
      min_stock: 5,
      image_url: '',
      category_id: '',
      supplier_id: '',
      is_active: true
    });
    setBarcodeError(null);
  };

  /**
   * Validate barcode format and uniqueness
   * Requirements: 3.1, 3.2, 3.3
   */
  const validateBarcode = async (barcode: string): Promise<boolean> => {
    if (!barcode || barcode.trim().length === 0) {
      setBarcodeError(null);
      return true; // Empty barcode is allowed
    }

    const trimmedBarcode = barcode.trim();
    
    // Validate format
    const validation = validateBarcodeFormat(trimmedBarcode);
    if (!validation.isValid) {
      setBarcodeError(validation.error || 'Format barcode tidak valid');
      return false;
    }

    // Check uniqueness
    const isUnique = await checkBarcodeUniqueness(trimmedBarcode, editingProduct?.id);
    if (!isUnique) {
      setBarcodeError('Barcode sudah digunakan produk lain');
      return false;
    }

    setBarcodeError(null);
    return true;
  };

  /**
   * Handle barcode input change with validation
   * Requirements: 3.1, 3.3
   */
  const handleBarcodeChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const newBarcode = e.target.value;
    setFormData({ ...formData, barcode: newBarcode });
    
    // Debounce validation
    if (newBarcode.trim().length > 0) {
      await validateBarcode(newBarcode);
    } else {
      setBarcodeError(null);
    }
  };

  /**
   * Generate internal barcode with store prefix
   * Requirements: 3.4, 3.5
   */
  const handleGenerateBarcode = async () => {
    setIsGeneratingBarcode(true);
    try {
      // Generate barcode with INT prefix
      const newBarcode = generateInternalBarcode('INT');
      
      // Verify uniqueness
      const isUnique = await checkBarcodeUniqueness(newBarcode, editingProduct?.id);
      if (!isUnique) {
        // Try again if not unique
        const retryBarcode = generateInternalBarcode('INT');
        setFormData({ ...formData, barcode: retryBarcode });
      } else {
        setFormData({ ...formData, barcode: newBarcode });
      }
      
      setBarcodeError(null);
    } catch (error) {
      setBarcodeError('Gagal generate barcode');
    } finally {
      setIsGeneratingBarcode(false);
    }
  };

  /**
   * Handle barcode scan from camera
   * Requirements: 3.1
   */
  const handleBarcodeScan = async (barcode: string) => {
    setFormData({ ...formData, barcode });
    setShowBarcodeScanner(false);
    await validateBarcode(barcode);
    
    // Focus back to barcode input
    if (barcodeInputRef.current) {
      barcodeInputRef.current.focus();
    }
  };

  /**
   * Handle barcode scanner error
   */
  const handleBarcodeScanError = (error: string) => {
    console.error('Barcode scan error:', error);
    setShowBarcodeScanner(false);
  };

  return (
    <div className="p-4 md:p-6 bg-gray-50 min-h-screen">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 mt-12 md:mt-0 gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-display font-bold text-gray-900 mb-2">
            Inventori
          </h1>
          <p className="text-sm md:text-base text-gray-600">
            Kelola stok produk, harga, dan informasi barang.
          </p>
        </div>
        <Button onClick={() => { resetForm(); setIsModalOpen(true); }}>
          <Plus className="w-4 h-4 mr-2" />
          Tambah Produk
        </Button>
      </div>

      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Cari nama produk atau scan barcode..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4">
        {isLoading ? (
          <div className="text-center py-10">Memuat data...</div>
        ) : filteredProducts.length === 0 ? (
          <div className="text-center py-10 text-gray-500">Tidak ada produk ditemukan</div>
        ) : (
          filteredProducts.map((product) => {
            const stockQty = getProductStock(product);
            const isLowStock = stockQty <= (product.min_stock || 5);
            
            return (
              <motion.div
                key={product.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                layout
              >
                <Card>
                  <CardContent className="p-4 flex flex-col md:flex-row items-start md:items-center gap-4">
                    {/* Image */}
                    <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0">
                      {product.image_url ? (
                        <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
                      ) : (
                        <Package className="w-8 h-8 text-gray-400" />
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-gray-900 truncate">{product.name}</h3>
                      {/* Barcode display - Requirements: 3.1 */}
                      <div className="flex items-center gap-1 text-sm text-gray-500 mb-1">
                        <Barcode className="w-3 h-3" />
                        <span className="font-mono">{product.barcode || '-'}</span>
                      </div>
                      <div className="flex flex-wrap gap-2 items-center">
                        <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">
                          Rp {product.price.toLocaleString()}
                        </span>
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          isLowStock 
                            ? 'bg-red-100 text-red-700' 
                            : 'bg-green-100 text-green-700'
                        }`}>
                          Stok: {stockQty}
                        </span>
                        {currentOutlet && (
                          <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded-full flex items-center gap-1">
                            <Store className="w-3 h-3" />
                            {currentOutlet.name}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 w-full md:w-auto justify-end">
                      {/* Stock breakdown button - Requirements: 3.4 */}
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => handleShowStockBreakdown(product)}
                        title="Lihat stok per outlet"
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handleEdit(product)}>
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="sm" className="text-red-500 hover:bg-red-50" onClick={() => handleDelete(product.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })
        )}
      </div>

      {/* Modal Form */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
            >
              <div className="p-6 border-b flex justify-between items-center sticky top-0 bg-white z-10">
                <h2 className="text-xl font-bold">
                  {editingProduct ? 'Edit Produk' : 'Tambah Produk Baru'}
                </h2>
                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-full">
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <form onSubmit={handleSave} className="p-6 space-y-4">
                {/* Image Upload */}
                <div className="flex justify-center mb-6">
                  <div className="relative group w-32 h-32">
                    <div className="w-full h-full rounded-xl bg-gray-100 border-2 border-dashed border-gray-300 flex items-center justify-center overflow-hidden">
                      {formData.image_url ? (
                        <img src={formData.image_url} alt="Preview" className="w-full h-full object-cover" />
                      ) : (
                        <ImageIcon className="w-8 h-8 text-gray-400" />
                      )}
                    </div>
                    <label className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity rounded-xl text-white text-xs">
                      <ImageIcon className="w-6 h-6 mb-1" />
                      Ubah Foto
                      <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
                    </label>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Nama Produk</label>
                    <input
                      required
                      type="text"
                      value={formData.name}
                      onChange={e => setFormData({...formData, name: e.target.value})}
                      className="w-full p-2 border rounded-lg"
                      placeholder="Contoh: Kopi Susu"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Barcode (Opsional)</label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Barcode className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                        <input
                          ref={barcodeInputRef}
                          type="text"
                          value={formData.barcode}
                          onChange={handleBarcodeChange}
                          className={`w-full pl-10 pr-3 p-2 border rounded-lg ${
                            barcodeError ? 'border-red-500 focus:ring-red-500' : ''
                          }`}
                          placeholder="Scan atau ketik barcode..."
                        />
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setShowBarcodeScanner(true)}
                        title="Scan dengan kamera"
                        className="px-3"
                      >
                        <Camera className="w-4 h-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleGenerateBarcode}
                        disabled={isGeneratingBarcode}
                        title="Generate barcode internal"
                        className="px-3"
                      >
                        <RefreshCw className={`w-4 h-4 ${isGeneratingBarcode ? 'animate-spin' : ''}`} />
                      </Button>
                    </div>
                    {barcodeError && (
                      <p className="text-xs text-red-500 mt-1">{barcodeError}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Harga Jual (Rp)</label>
                    <input
                      required
                      type="number"
                      min="0"
                      value={formData.price}
                      onChange={e => setFormData({...formData, price: parseInt(e.target.value) || 0})}
                      className="w-full p-2 border rounded-lg"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Stok Awal</label>
                    <input
                      required
                      type="number"
                      min="0"
                      value={formData.stock_quantity}
                      onChange={e => setFormData({...formData, stock_quantity: parseInt(e.target.value) || 0})}
                      className="w-full p-2 border rounded-lg"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Min. Stok (Alert)</label>
                    <input
                      type="number"
                      min="0"
                      value={formData.min_stock}
                      onChange={e => setFormData({...formData, min_stock: parseInt(e.target.value) || 0})}
                      className="w-full p-2 border rounded-lg"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Kategori</label>
                    <select
                      value={formData.category_id}
                      onChange={e => setFormData({...formData, category_id: e.target.value})}
                      className="w-full p-2 border rounded-lg bg-white"
                    >
                      <option value="">-- Pilih Kategori --</option>
                      {categories.map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Supplier</label>
                    <select
                      value={formData.supplier_id}
                      onChange={e => setFormData({...formData, supplier_id: e.target.value})}
                      className="w-full p-2 border rounded-lg bg-white"
                    >
                      <option value="">-- Pilih Supplier --</option>
                      {suppliers.map(sup => (
                        <option key={sup.id} value={sup.id}>{sup.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="pt-4 flex gap-3 justify-end">
                  <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}>
                    Batal
                  </Button>
                  <Button type="submit" isLoading={isSaving}>
                    <Save className="w-4 h-4 mr-2" />
                    Simpan
                  </Button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Stock Breakdown Modal - Requirements: 3.4 */}
      <AnimatePresence>
        {showStockBreakdown && selectedProductForBreakdown && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto"
            >
              <div className="p-6 border-b flex justify-between items-center sticky top-0 bg-white z-10">
                <div>
                  <h2 className="text-xl font-bold">Stok per Outlet</h2>
                  <p className="text-sm text-gray-500">{selectedProductForBreakdown.name}</p>
                </div>
                <button 
                  onClick={() => {
                    setShowStockBreakdown(false);
                    setSelectedProductForBreakdown(null);
                    setStockBreakdown([]);
                  }} 
                  className="p-2 hover:bg-gray-100 rounded-full"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="p-6">
                {isLoadingBreakdown ? (
                  <div className="text-center py-8 text-gray-500">Memuat data...</div>
                ) : stockBreakdown.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    Tidak ada data stok outlet
                  </div>
                ) : (
                  <div className="space-y-3">
                    {stockBreakdown.map((item) => (
                      <div 
                        key={item.outlet_id}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                      >
                        <div className="flex items-center gap-2">
                          <Store className="w-4 h-4 text-purple-500" />
                          <div>
                            <p className="font-medium text-gray-900">{item.outlet_name}</p>
                            <p className="text-xs text-gray-500">{item.outlet_code}</p>
                          </div>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                          item.quantity <= (selectedProductForBreakdown.min_stock || 5)
                            ? 'bg-red-100 text-red-700'
                            : 'bg-green-100 text-green-700'
                        }`}>
                          {item.quantity} unit
                        </span>
                      </div>
                    ))}
                    
                    {/* Total */}
                    <div className="border-t pt-3 mt-3">
                      <div className="flex items-center justify-between font-medium">
                        <span className="text-gray-700">Total Semua Outlet</span>
                        <span className="text-primary-600">
                          {stockBreakdown.reduce((sum, item) => sum + item.quantity, 0)} unit
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Barcode Scanner Modal - Requirements: 3.1 */}
      <AnimatePresence>
        {showBarcodeScanner && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden"
            >
              <div className="p-4 border-b flex justify-between items-center">
                <h2 className="text-lg font-bold">Scan Barcode</h2>
                <button 
                  onClick={() => setShowBarcodeScanner(false)} 
                  className="p-2 hover:bg-gray-100 rounded-full"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="p-4">
                <CameraScanner
                  onScan={handleBarcodeScan}
                  onError={handleBarcodeScanError}
                  isActive={showBarcodeScanner}
                  continuous={false}
                />
                <p className="text-sm text-gray-500 text-center mt-4">
                  Arahkan kamera ke barcode produk
                </p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Inventory;
