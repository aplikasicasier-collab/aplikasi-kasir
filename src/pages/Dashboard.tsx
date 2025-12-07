import React from 'react';
import { motion } from 'framer-motion';
import { 
  DollarSign, 
  ShoppingCart, 
  Package, 
  TrendingUp,
  Users,
  AlertTriangle,
  BarChart3
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';

const Dashboard: React.FC = () => {
  // Mock data - nanti akan diganti dengan data nyata
  const stats = [
    {
      title: 'Penjualan Hari Ini',
      value: 'Rp 2,450,000',
      change: '+12.5%',
      icon: DollarSign,
      color: 'text-green-500',
      bgColor: 'bg-green-500/10'
    },
    {
      title: 'Total Transaksi',
      value: '47',
      change: '+8.2%',
      icon: ShoppingCart,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10'
    },
    {
      title: 'Produk Terjual',
      value: '156',
      change: '+15.3%',
      icon: Package,
      color: 'text-purple-500',
      bgColor: 'bg-purple-500/10'
    },
    {
      title: 'Customer Baru',
      value: '12',
      change: '+2.1%',
      icon: Users,
      color: 'text-orange-500',
      bgColor: 'bg-orange-500/10'
    }
  ];

  const lowStockProducts = [
    { name: 'Indomie Goreng', stock: 5, minStock: 10 },
    { name: 'Teh Botol Sosro', stock: 3, minStock: 15 },
    { name: 'Rokok Sampoerna', stock: 8, minStock: 20 }
  ];

  const topProducts = [
    { name: 'Indomie Goreng', sales: 45, revenue: 225000 },
    { name: 'Aqua 600ml', sales: 38, revenue: 114000 },
    { name: 'Rokok Gudang Garam', sales: 25, revenue: 75000 },
    { name: 'Kopi Kapal Api', sales: 22, revenue: 88000 }
  ];

  return (
    <div className="p-4 md:p-6 bg-gray-50 min-h-screen">
      <div className="mb-8 mt-12 md:mt-0">
        <h1 className="text-2xl md:text-3xl font-display font-bold text-gray-900 mb-2">
          Dashboard
        </h1>
        <p className="text-sm md:text-base text-gray-600">
          Selamat datang kembali! Berikut ringkasan performa bisnis Anda hari ini.
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <motion.div
              key={stat.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card className="hover:shadow-premium transition-shadow duration-300">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className={`p-3 rounded-lg ${stat.bgColor}`}>
                      <Icon className={`w-6 h-6 ${stat.color}`} />
                    </div>
                    <div className="text-right">
                      <span className={`text-sm font-medium ${stat.color}`}>
                        {stat.change}
                      </span>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-600 mb-1">
                      {stat.title}
                    </p>
                    <p className="text-2xl font-bold text-gray-900">
                      {stat.value}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick Actions */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="flex items-center">
                <TrendingUp className="w-5 h-5 mr-2 text-primary-600" />
                Quick Actions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <Button 
                  variant="primary" 
                  size="sm" 
                  className="w-full justify-center"
                >
                  <ShoppingCart className="w-4 h-4 mr-2" />
                  Transaksi Baru
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full justify-center"
                >
                  <Package className="w-4 h-4 mr-2" />
                  Tambah Produk
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="w-full justify-center"
                >
                  <BarChart3 className="w-4 h-4 mr-2" />
                  Lihat Laporan
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Low Stock Alert */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="flex items-center text-orange-600">
                <AlertTriangle className="w-5 h-5 mr-2" />
                Stok Menipis
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {lowStockProducts.map((product, index) => (
                  <div key={index} className="flex items-center justify-between p-2 bg-orange-50 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900">{product.name}</p>
                      <p className="text-sm text-gray-600">
                        Stok: {product.stock} / Min: {product.minStock}
                      </p>
                    </div>
                    <div className="text-orange-600">
                      <AlertTriangle className="w-4 h-4" />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Top Products */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.6 }}
        >
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="flex items-center text-green-600">
                <TrendingUp className="w-5 h-5 mr-2" />
                Produk Terlaris
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {topProducts.map((product, index) => (
                  <div key={index} className="flex items-center justify-between p-2 bg-green-50 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900">{product.name}</p>
                      <p className="text-sm text-gray-600">
                        {product.sales} pcs - Rp {product.revenue.toLocaleString()}
                      </p>
                    </div>
                    <div className="text-green-600">
                      <TrendingUp className="w-4 h-4" />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
};

export default Dashboard;