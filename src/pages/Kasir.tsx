import React, { useEffect, useMemo, useState } from 'react';
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
  ShoppingCart
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { useCartStore } from '../stores/cartStore';
import { Product } from '../types';
import { listActiveProducts, searchProducts } from '../api/products';
import { useDebouncedValue } from '../hooks/useDebouncedValue';

const Kasir: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'e-wallet'>('cash');
  const [cashReceived, setCashReceived] = useState(0);
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const debouncedSearch = useDebouncedValue(searchTerm, 350);
  
  const { 
    items, 
    addItem, 
    removeItem, 
    updateQuantity, 
    updateDiscount,
    clearCart,
    getTotalItems,
    getTotalAmount,
    getTotalDiscount 
  } = useCartStore();

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoadingProducts(true);
      setLoadError(null);
      try {
        const data = await listActiveProducts();
        if (!cancelled) setProducts(data);
      } catch (e: any) {
        if (!cancelled) setLoadError('Gagal memuat produk');
      } finally {
        if (!cancelled) setLoadingProducts(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!debouncedSearch) {
        try {
          const data = await listActiveProducts();
          if (!cancelled) setProducts(data);
        } catch (e: any) {
          if (!cancelled) setLoadError('Gagal memuat produk');
        }
        return;
      }
      try {
        const data = await searchProducts(debouncedSearch);
        if (!cancelled) setProducts(data);
      } catch (e: any) {
        if (!cancelled) setLoadError('Pencarian gagal');
      }
    }
    run();
    return () => { cancelled = true; };
  }, [debouncedSearch]);

  const filteredProducts = useMemo(() => {
    if (products.length > 0) return products;
    return [];
  }, [products]);

  const handleAddToCart = (product: Product) => {
    addItem(product);
  };

  const handleQuantityChange = (productId: string, newQuantity: number) => {
    if (newQuantity <= 0) {
      removeItem(productId);
    } else {
      updateQuantity(productId, newQuantity);
    }
  };

  const handleCheckout = () => {
    if (items.length === 0) return;
    
    // Simulate checkout process
    alert('Transaksi berhasil! Struk akan dicetak.');
    clearCart();
    setCashReceived(0);
  };

  const calculateChange = () => {
    const total = getTotalAmount();
    return Math.max(0, cashReceived - total);
  };

  return (
    <div className="p-4 md:p-6 bg-gray-50 min-h-screen">
      <div className="mb-6 mt-12 md:mt-0">
        <h1 className="text-2xl md:text-3xl font-display font-bold text-gray-900 mb-2">
          Kasir
        </h1>
        <p className="text-sm md:text-base text-gray-600">
          Proses transaksi penjualan dengan cepat dan akurat.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Product Selection */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Search className="w-5 h-5 mr-2 text-primary-600" />
                Pilih Produk
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mb-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="text"
                    placeholder="Cari produk berdasarkan nama atau barcode..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {loadingProducts && (
                  <div className="col-span-2 text-center text-gray-500">Memuat produk...</div>
                )}
                {!loadingProducts && filteredProducts.length === 0 && (
                  <div className="col-span-2 text-center text-gray-500">Produk tidak ditemukan</div>
                )}
                {filteredProducts.map((product) => (
                  <motion.div
                    key={product.id}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <Card className="hover:shadow-premium transition-shadow cursor-pointer">
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <h3 className="font-semibold text-gray-900">{product.name}</h3>
                            <p className="text-sm text-gray-600">{product.barcode}</p>
                          </div>
                          <span className="text-lg font-bold text-primary-600">
                            Rp {product.price.toLocaleString()}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-500">
                            Stok: {product.stock_quantity}
                          </span>
                          <Button
                            size="sm"
                            onClick={() => handleAddToCart(product)}
                            className="bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800"
                          >
                            <Plus className="w-4 h-4 mr-1" />
                            Tambah
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
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
                <span className="text-sm text-gray-500">
                  {getTotalItems()} item
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {items.length === 0 ? (
                <div className="text-center py-8">
                  <ShoppingCart className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">Keranjang kosong</p>
                  <p className="text-sm text-gray-400">Tambahkan produk untuk memulai transaksi</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {items.map((item) => (
                    <div key={item.product.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-900">{item.product.name}</h4>
                        <p className="text-sm text-gray-600">
                          Rp {item.product.price.toLocaleString()} × {item.quantity}
                        </p>
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
                        <span className="w-8 text-center font-medium">{item.quantity}</span>
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
                  ))}
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
                  <span className="text-gray-600">Subtotal:</span>
                  <span className="font-medium">Rp {(getTotalAmount() + getTotalDiscount()).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Diskon:</span>
                  <span className="font-medium text-red-600">- Rp {getTotalDiscount().toLocaleString()}</span>
                </div>
                <div className="border-t pt-3">
                  <div className="flex justify-between text-lg font-bold">
                    <span>Total:</span>
                    <span className="text-primary-600">Rp {getTotalAmount().toLocaleString()}</span>
                  </div>
                </div>

                {/* Payment Method */}
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
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
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Uang Diterima
                    </label>
                    <input
                      type="number"
                      value={cashReceived}
                      onChange={(e) => setCashReceived(Number(e.target.value))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      placeholder="Masukkan jumlah uang"
                    />
                    {cashReceived > 0 && (
                      <div className="mt-2 p-2 bg-green-50 rounded-lg">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Kembalian:</span>
                          <span className="font-medium text-green-600">
                            Rp {calculateChange().toLocaleString()}
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
                  disabled={items.length === 0}
                  className="w-full mt-6 bg-gradient-to-r from-gold-400 to-gold-600 hover:from-gold-500 hover:to-gold-700 text-gray-900 font-semibold"
                >
                  <Printer className="w-5 h-5 mr-2" />
                  Proses & Cetak Struk
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Kasir;
