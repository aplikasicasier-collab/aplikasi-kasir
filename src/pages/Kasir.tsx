import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { 
  Search, 
  Plus, 
  Minus, 
  Trash2, 
  Calculator,
  Printer,
  CreditCard,
  DollarSign,
  ShoppingCart,
  AlertCircle,
  Loader2,
  Store,
  Tag,
  Percent,
  Gift,
  Camera
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { useCartStore } from '../stores/cartStore';
import { Product, Transaction, TransactionItem, Discount, Promo } from '../types';
import { listActiveProducts, searchProducts } from '../api/products';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { createTransaction, CreateTransactionInput } from '../api/transactions';
import { validateStockAvailability, updateStockAfterTransaction } from '../api/stock';
import { validateCheckout, isCheckoutEnabled, calculateChange, PaymentInfo } from '../lib/checkout';
import { ReceiptModal } from '../components/kasir/ReceiptModal';
import { useOutlet } from '../contexts/OutletContext';
import { getOutletStock } from '../api/outletStock';
import { getDiscounts } from '../api/discounts';
import { getActivePromos } from '../api/promos';
import { 
  calculateCartWithDiscounts, 
  checkMinimumPurchase,
  CartItemWithDiscount,
  CartWithDiscounts
} from '../lib/discountCalculation';
import { 
  CameraScanner, 
  BarcodeInput, 
  ScanResultToast, 
  useScanResultToast,
  playSuccessBeep,
  playErrorBeep,
  playWarningBeep,
  initAudioFeedback
} from '../components/scanner';

const Kasir: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'e-wallet'>('cash');
  const [cashReceived, setCashReceived] = useState(0);
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const debouncedSearch = useDebouncedValue(searchTerm, 350);
  
  // Outlet context for multi-outlet support (Requirements: 5.2)
  const { currentOutlet } = useOutlet();
  
  // Outlet stock map for current outlet
  const [outletStockMap, setOutletStockMap] = useState<Map<string, number>>(new Map());
  
  // Discount and Promo state (Requirements: 4.1, 4.2)
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [promos, setPromos] = useState<Promo[]>([]);
  
  // Checkout state
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [showReceipt, setShowReceipt] = useState(false);
  const [completedTransaction, setCompletedTransaction] = useState<Transaction | null>(null);
  const [completedItems, setCompletedItems] = useState<TransactionItem[]>([]);
  
  // Barcode scanner state (Requirements: 1.1, 2.1)
  const [showCameraScanner, setShowCameraScanner] = useState(false);
  const { toast, showSuccess, showError, showWarning, dismiss } = useScanResultToast();
  
  const { 
    items, 
    addItem, 
    removeItem, 
    updateQuantity, 
    clearCart,
    getTotalItems,
    getTotalAmount,
    getTotalDiscount,
    addToCartByBarcode
  } = useCartStore();

  // Create products map for receipt
  const productsMap = useMemo(() => {
    const map = new Map<string, Product>();
    products.forEach(p => map.set(p.id, p));
    items.forEach(item => map.set(item.product.id, item.product));
    return map;
  }, [products, items]);

  useEffect(() => {
    loadProducts();
    loadDiscountsAndPromos();
    // Initialize audio feedback for barcode scanning (Requirements: 1.5)
    initAudioFeedback();
  }, []);

  // Load outlet-specific stock when outlet changes (Requirements: 5.2)
  useEffect(() => {
    if (currentOutlet) {
      loadOutletStock();
    }
  }, [currentOutlet]);

  /**
   * Load active discounts and promos
   * Requirements: 4.1 - Display discounts at checkout
   */
  const loadDiscountsAndPromos = async () => {
    try {
      const [discountsData, promosData] = await Promise.all([
        getDiscounts({ is_active: true }),
        getActivePromos(),
      ]);
      setDiscounts(discountsData);
      // Map promo products to product_ids for discount calculation
      const promosWithProductIds = promosData.map(promo => ({
        ...promo,
        product_ids: promo.products?.map((p: any) => p.product_id) || [],
      }));
      setPromos(promosWithProductIds as unknown as Promo[]);
    } catch (error) {
      console.error('Failed to load discounts and promos:', error);
    }
  };

  /**
   * Load outlet-specific stock quantities
   * Requirements: 5.2 - Use current outlet for stock check
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
   * Requirements: 5.2 - Use current outlet for stock check
   */
  const getProductStock = (product: Product): number => {
    if (currentOutlet && outletStockMap.has(product.id)) {
      return outletStockMap.get(product.id) || 0;
    }
    return product.stock_quantity;
  };

  /**
   * Handle barcode scan from camera or external scanner
   * Requirements: 1.3, 1.4, 1.5, 4.1, 4.2, 4.3
   */
  const handleBarcodeScan = useCallback(async (barcode: string) => {
    const result = await addToCartByBarcode(barcode);
    
    if (result.success && result.product) {
      // Play success beep (Requirements: 1.5)
      playSuccessBeep();
      // Show success toast with product info (Requirements: 4.1)
      showSuccess(`${result.product.name} ditambahkan ke keranjang`, result.product);
    } else if (result.isOutOfStock && result.product) {
      // Play warning beep for out of stock (Requirements: 4.3)
      playWarningBeep();
      showWarning(result.error || 'Stok habis', result.product);
    } else {
      // Play error beep for not found (Requirements: 4.2)
      playErrorBeep();
      showError(result.error || 'Produk tidak ditemukan');
    }
  }, [addToCartByBarcode, showSuccess, showWarning, showError]);

  /**
   * Handle camera scanner error
   * Requirements: 4.4
   */
  const handleScannerError = useCallback((error: string) => {
    playErrorBeep();
    showError(error);
  }, [showError]);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!debouncedSearch) {
        loadProducts();
        return;
      }
      try {
        const data = await searchProducts(debouncedSearch);
        if (!cancelled) setProducts(data);
      } catch {
        if (!cancelled) setLoadError('Pencarian gagal');
      }
    }
    run();
    return () => { cancelled = true; };
  }, [debouncedSearch]);

  const loadProducts = async () => {
    setLoadingProducts(true);
    setLoadError(null);
    try {
      const data = await listActiveProducts();
      setProducts(data);
    } catch {
      setLoadError('Gagal memuat produk');
    } finally {
      setLoadingProducts(false);
    }
  };

  const filteredProducts = useMemo(() => {
    return products.length > 0 ? products : [];
  }, [products]);

  const handleAddToCart = (product: Product) => {
    // Check if adding would exceed stock (using outlet stock if available)
    const existingItem = items.find(i => i.product.id === product.id);
    const currentQty = existingItem?.quantity || 0;
    const availableStock = getProductStock(product);
    
    if (currentQty >= availableStock) {
      setCheckoutError(`Stok ${product.name} tidak mencukupi${currentOutlet ? ` di ${currentOutlet.name}` : ''}`);
      setTimeout(() => setCheckoutError(null), 3000);
      return;
    }
    
    addItem(product);
    setCheckoutError(null);
  };

  const handleQuantityChange = (productId: string, newQuantity: number) => {
    if (newQuantity <= 0) {
      removeItem(productId);
    } else {
      // Check stock before increasing (using outlet stock if available)
      const item = items.find(i => i.product.id === productId);
      if (item) {
        const availableStock = getProductStock(item.product);
        if (newQuantity > availableStock) {
          setCheckoutError(`Stok ${item.product.name} tidak mencukupi${currentOutlet ? ` di ${currentOutlet.name}` : ''}`);
          setTimeout(() => setCheckoutError(null), 3000);
          return;
        }
      }
      updateQuantity(productId, newQuantity);
    }
    setCheckoutError(null);
  };

  // Calculate cart with discounts applied (Requirements: 4.1, 4.2)
  const cartWithDiscounts: CartWithDiscounts = useMemo(() => {
    // Map promos to include product_ids for calculation
    const promosForCalc = promos.map(promo => ({
      ...promo,
      product_ids: (promo as any).product_ids || promo.products?.map((p: any) => p.product_id) || [],
    }));
    return calculateCartWithDiscounts(items, discounts, promosForCalc);
  }, [items, discounts, promos]);

  // Check minimum purchase eligibility for promos (Requirements: 6.2, 6.3, 6.4)
  const promoEligibility = useMemo(() => {
    const eligibilityMap: Map<string, { eligible: boolean; remaining: number; promo: Promo }> = new Map();
    
    for (const promo of promos) {
      if (promo.min_purchase && promo.min_purchase > 0) {
        const result = checkMinimumPurchase(cartWithDiscounts.subtotal, promo);
        eligibilityMap.set(promo.id, { ...result, promo });
      }
    }
    
    return eligibilityMap;
  }, [promos, cartWithDiscounts.subtotal]);

  const subtotal = cartWithDiscounts.subtotal;
  const discount = cartWithDiscounts.totalDiscount;
  const tax = 0; // Can be configured
  const totalAmount = cartWithDiscounts.total;

  const paymentInfo: PaymentInfo = {
    method: paymentMethod,
    cashReceived: paymentMethod === 'cash' ? cashReceived : undefined,
    totalAmount,
  };

  const canCheckout = isCheckoutEnabled(items, paymentInfo, isCheckingOut);

  const handleCheckout = async () => {
    if (!canCheckout) return;
    
    setIsCheckingOut(true);
    setCheckoutError(null);

    try {
      // Validate checkout
      const validation = validateCheckout(items, paymentInfo);
      if (!validation.valid) {
        setCheckoutError(validation.errors[0]);
        setIsCheckingOut(false);
        return;
      }

      // Validate stock availability (using outlet stock if available)
      // Requirements: 5.2 - Use current outlet for stock check
      const stockValidation = await validateStockAvailability(items, currentOutlet?.id);
      if (!stockValidation.valid) {
        setCheckoutError(stockValidation.errors[0].message);
        setIsCheckingOut(false);
        return;
      }

      // Create transaction with outlet ID and discount information
      // Requirements: 4.5, 5.1 - Record discount_id, promo_id, original_price, discount_amount
      const input: CreateTransactionInput = {
        items: cartWithDiscounts.items, // Use items with discount info
        paymentMethod,
        cashReceived: paymentMethod === 'cash' ? cashReceived : undefined,
        discountAmount: discount,
        taxAmount: tax,
        subtotal,
        totalAmount,
        outletId: currentOutlet?.id, // Associate transaction with current outlet
      };

      const result = await createTransaction(input);

      // Update stock (deduct from current outlet)
      // Requirements: 5.2 - Deduct stock from current outlet only
      await updateStockAfterTransaction(items, result.transaction.id, currentOutlet?.id);

      // Show receipt
      setCompletedTransaction(result.transaction);
      setCompletedItems(result.transactionItems);
      setShowReceipt(true);

      // Refresh products and outlet stock to show updated stock
      await loadProducts();
      if (currentOutlet) {
        await loadOutletStock();
      }

    } catch (error: any) {
      setCheckoutError(error.message || 'Gagal memproses transaksi');
    } finally {
      setIsCheckingOut(false);
    }
  };

  const handleCloseReceipt = () => {
    setShowReceipt(false);
    setCompletedTransaction(null);
    setCompletedItems([]);
    clearCart();
    setCashReceived(0);
  };

  const change = calculateChange(cashReceived, totalAmount);

  return (
    <div className="p-4 md:p-6 bg-gray-50 dark:bg-gray-900 min-h-screen">
      <div className="mb-6 mt-12 md:mt-0">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
          <div>
            <h1 className="text-2xl md:text-3xl font-display font-bold text-gray-900 dark:text-white mb-2">
              Kasir
            </h1>
            <p className="text-sm md:text-base text-gray-600 dark:text-gray-400">
              Proses transaksi penjualan dengan cepat dan akurat.
            </p>
          </div>
          {currentOutlet && (
            <div className="flex items-center gap-2 px-3 py-2 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
              <Store className="w-4 h-4 text-purple-600" />
              <span className="text-sm font-medium text-purple-700 dark:text-purple-300">
                {currentOutlet.name}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Error Alert */}
      {checkoutError && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-3"
        >
          <AlertCircle className="w-5 h-5 text-red-500" />
          <span className="text-red-700 dark:text-red-400">{checkoutError}</span>
        </motion.div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Product Selection */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center">
                  <Search className="w-5 h-5 mr-2 text-primary-600" />
                  Pilih Produk
                </span>
                {/* Camera Scanner Button - Requirements: 1.1 */}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowCameraScanner(true)}
                  className="flex items-center gap-2"
                >
                  <Camera className="w-4 h-4" />
                  <span className="hidden sm:inline">Scan Kamera</span>
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {/* Barcode Input for External Scanner - Requirements: 2.1, 2.4 */}
              <div className="mb-4">
                <BarcodeInput
                  onSubmit={handleBarcodeScan}
                  autoFocus={true}
                  placeholder="Scan barcode dengan scanner eksternal..."
                />
              </div>
              
              <div className="mb-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="text"
                    placeholder="Cari produk berdasarkan nama..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[60vh] overflow-y-auto">
                {loadingProducts && (
                  <div className="col-span-2 text-center text-gray-500 py-8">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />
                    Memuat produk...
                  </div>
                )}
                {!loadingProducts && filteredProducts.length === 0 && (
                  <div className="col-span-2 text-center text-gray-500 py-8">Produk tidak ditemukan</div>
                )}
                {filteredProducts.map((product) => {
                  const stockQty = getProductStock(product);
                  const isLowStock = stockQty <= product.min_stock;
                  
                  return (
                    <motion.div
                      key={product.id}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <Card className="hover:shadow-premium transition-shadow cursor-pointer">
                        <CardContent className="p-4">
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <h3 className="font-semibold text-gray-900 dark:text-white">{product.name}</h3>
                              <p className="text-sm text-gray-600 dark:text-gray-400">{product.barcode}</p>
                            </div>
                            <span className="text-lg font-bold text-primary-600">
                              Rp {product.price.toLocaleString()}
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <div className="flex items-center gap-2">
                              <span className={`text-sm ${isLowStock ? 'text-red-500' : 'text-gray-500 dark:text-gray-400'}`}>
                                Stok: {stockQty}
                              </span>
                              {currentOutlet && (
                                <span className="text-xs text-purple-500 flex items-center gap-1">
                                  <Store className="w-3 h-3" />
                                </span>
                              )}
                            </div>
                            <Button
                              size="sm"
                              onClick={() => handleAddToCart(product)}
                              disabled={stockQty <= 0}
                              className="bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800"
                            >
                              <Plus className="w-4 h-4 mr-1" />
                              Tambah
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Cart & Payment */}
        <div className="space-y-6">
          {/* Shopping Cart */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center">
                  <ShoppingCart className="w-5 h-5 mr-2 text-primary-600" />
                  Keranjang
                </span>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {getTotalItems()} item
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {items.length === 0 ? (
                <div className="text-center py-8">
                  <ShoppingCart className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500 dark:text-gray-400">Keranjang kosong</p>
                  <p className="text-sm text-gray-400 dark:text-gray-500">Tambahkan produk untuk memulai transaksi</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[40vh] overflow-y-auto">
                  {cartWithDiscounts.items.map((item: CartItemWithDiscount) => {
                    const hasDiscount = item.discountAmount > 0;
                    return (
                      <div key={item.product.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium text-gray-900 dark:text-white">{item.product.name}</h4>
                            {/* Discount Badge - Requirements: 4.1 */}
                            {hasDiscount && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 rounded-full">
                                {item.appliedPromo ? (
                                  <>
                                    <Gift className="w-3 h-3" />
                                    {item.appliedPromo.name}
                                  </>
                                ) : item.appliedDiscount?.discount_type === 'percentage' ? (
                                  <>
                                    <Percent className="w-3 h-3" />
                                    {item.appliedDiscount.discount_value}%
                                  </>
                                ) : (
                                  <>
                                    <Tag className="w-3 h-3" />
                                    -{(item.discountAmount).toLocaleString()}
                                  </>
                                )}
                              </span>
                            )}
                          </div>
                          {/* Price display - Requirements: 4.1 */}
                          <div className="text-sm">
                            {hasDiscount ? (
                              <div className="flex items-center gap-2">
                                <span className="text-gray-400 line-through">
                                  Rp {item.originalPrice.toLocaleString()}
                                </span>
                                <span className="text-red-600 font-medium">
                                  Rp {item.finalPrice.toLocaleString()}
                                </span>
                                <span className="text-gray-500">× {item.quantity}</span>
                              </div>
                            ) : (
                              <span className="text-gray-600 dark:text-gray-400">
                                Rp {item.product.price.toLocaleString()} × {item.quantity}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleQuantityChange(item.product.id, item.quantity - 1)}
                            className="p-1"
                          >
                            <Minus className="w-4 h-4" />
                          </Button>
                          <span className="w-8 text-center font-medium dark:text-white">{item.quantity}</span>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleQuantityChange(item.product.id, item.quantity + 1)}
                            className="p-1"
                          >
                            <Plus className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => removeItem(item.product.id)}
                            className="p-1 text-red-500 hover:text-red-700"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Payment Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Calculator className="w-5 h-5 mr-2 text-primary-600" />
                Ringkasan Pembayaran
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Subtotal:</span>
                  <span className="font-medium dark:text-white">Rp {subtotal.toLocaleString()}</span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Diskon:</span>
                    <span className="font-medium text-red-600">- Rp {discount.toLocaleString()}</span>
                  </div>
                )}
                
                {/* Total Savings Display - Requirements: 4.2 */}
                {discount > 0 && (
                  <div className="p-2 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                    <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
                      <Tag className="w-4 h-4" />
                      <span className="text-sm font-medium">
                        Anda hemat Rp {discount.toLocaleString()}!
                      </span>
                    </div>
                  </div>
                )}

                {/* Minimum Purchase Indicator - Requirements: 6.2, 6.3, 6.4 */}
                {Array.from(promoEligibility.values()).map(({ eligible, remaining, promo }) => (
                  <div 
                    key={promo.id}
                    className={`p-2 rounded-lg border ${
                      eligible 
                        ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' 
                        : 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <Gift className={`w-4 h-4 mt-0.5 ${eligible ? 'text-green-600' : 'text-yellow-600'}`} />
                      <div className="flex-1">
                        <p className={`text-sm font-medium ${eligible ? 'text-green-700 dark:text-green-400' : 'text-yellow-700 dark:text-yellow-400'}`}>
                          {promo.name}
                        </p>
                        {eligible ? (
                          <p className="text-xs text-green-600 dark:text-green-500">
                            ✓ Promo aktif! Diskon {promo.discount_type === 'percentage' ? `${promo.discount_value}%` : `Rp ${promo.discount_value.toLocaleString()}`}
                          </p>
                        ) : (
                          <p className="text-xs text-yellow-600 dark:text-yellow-500">
                            Belanja Rp {remaining.toLocaleString()} lagi untuk mendapat promo ini
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}

                <div className="border-t dark:border-gray-700 pt-3">
                  <div className="flex justify-between text-lg font-bold">
                    <span className="dark:text-white">Total:</span>
                    <span className="text-primary-600">Rp {totalAmount.toLocaleString()}</span>
                  </div>
                </div>

                {/* Payment Method */}
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Metode Pembayaran
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { value: 'cash', label: 'Tunai', icon: DollarSign },
                      { value: 'card', label: 'Kartu', icon: CreditCard },
                      { value: 'e-wallet', label: 'E-Wallet', icon: CreditCard }
                    ].map((method) => {
                      const Icon = method.icon;
                      return (
                        <Button
                          key={method.value}
                          size="sm"
                          variant={paymentMethod === method.value ? 'primary' : 'outline'}
                          onClick={() => setPaymentMethod(method.value as any)}
                          className="flex items-center justify-center"
                        >
                          <Icon className="w-4 h-4 mr-1" />
                          {method.label}
                        </Button>
                      );
                    })}
                  </div>
                </div>

                {/* Cash Input */}
                {paymentMethod === 'cash' && (
                  <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Uang Diterima
                    </label>
                    <input
                      type="number"
                      value={cashReceived || ''}
                      onChange={(e) => setCashReceived(Number(e.target.value))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                      placeholder="Masukkan jumlah uang"
                    />
                    {cashReceived > 0 && cashReceived >= totalAmount && (
                      <div className="mt-2 p-2 bg-green-50 dark:bg-green-900/20 rounded-lg">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600 dark:text-gray-400">Kembalian:</span>
                          <span className="font-medium text-green-600">
                            Rp {change.toLocaleString()}
                          </span>
                        </div>
                      </div>
                    )}
                    {cashReceived > 0 && cashReceived < totalAmount && (
                      <div className="mt-2 p-2 bg-red-50 dark:bg-red-900/20 rounded-lg">
                        <div className="flex justify-between text-sm">
                          <span className="text-red-600">Kurang:</span>
                          <span className="font-medium text-red-600">
                            Rp {(totalAmount - cashReceived).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Checkout Button */}
                <Button
                  size="lg"
                  variant="secondary"
                  onClick={handleCheckout}
                  disabled={!canCheckout}
                  className="w-full mt-6 bg-gradient-to-r from-gold-400 to-gold-600 hover:from-gold-500 hover:to-gold-700 text-gray-900 font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isCheckingOut ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Memproses...
                    </>
                  ) : (
                    <>
                      <Printer className="w-5 h-5 mr-2" />
                      Proses & Cetak Struk
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Receipt Modal - Requirements: 5.4 - Include outlet name and address */}
      {completedTransaction && (
        <ReceiptModal
          isOpen={showReceipt}
          onClose={handleCloseReceipt}
          transaction={completedTransaction}
          items={completedItems}
          products={productsMap}
          storeName={currentOutlet?.name || "Toko Anda"}
          storeAddress={currentOutlet?.address || undefined}
          storePhone={currentOutlet?.phone || undefined}
        />
      )}

      {/* Camera Scanner Modal - Requirements: 1.1, 1.2 */}
      <CameraScanner
        isActive={showCameraScanner}
        onScan={handleBarcodeScan}
        onError={handleScannerError}
        onClose={() => setShowCameraScanner(false)}
        continuous={false}
      />

      {/* Scan Result Toast - Requirements: 4.1, 4.2, 4.3 */}
      {toast && (
        <ScanResultToast
          type={toast.type}
          message={toast.message}
          product={toast.product}
          onDismiss={dismiss}
        />
      )}
    </div>
  );
};

export default Kasir;
