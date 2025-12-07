import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { TrendingUp, Package } from 'lucide-react';
import { TopProduct } from '../../api/reports';

interface TopProductsChartProps {
  data: TopProduct[];
  metric: 'quantity' | 'revenue';
  title?: string;
  isLoading?: boolean;
  onProductClick?: (productId: string) => void;
}

/**
 * Format currency for display
 */
function formatCurrency(value: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

/**
 * Custom tooltip component
 */
const CustomTooltip: React.FC<{
  active?: boolean;
  payload?: Array<{ payload: TopProduct }>;
  metric: 'quantity' | 'revenue';
}> = ({ active, payload, metric }) => {
  if (active && payload && payload.length) {
    const product = payload[0].payload;
    return (
      <div className="bg-white p-3 rounded-lg shadow-lg border border-gray-200">
        <p className="font-medium text-gray-900 mb-1">{product.productName}</p>
        <p className="text-sm text-gray-600">
          Qty: <span className="font-semibold">{product.quantity}</span>
        </p>
        <p className="text-sm text-gray-600">
          Revenue: <span className="font-semibold">{formatCurrency(product.revenue)}</span>
        </p>
      </div>
    );
  }
  return null;
};

export const TopProductsChart: React.FC<TopProductsChartProps> = ({
  data,
  metric,
  title,
  isLoading = false,
  onProductClick,
}) => {
  const chartTitle = title || (metric === 'quantity' ? 'Top Produk (Qty)' : 'Top Produk (Revenue)');
  const dataKey = metric === 'quantity' ? 'quantity' : 'revenue';
  const fillColor = metric === 'quantity' ? '#10b981' : '#8b5cf6';

  // Prepare data with shortened names for chart
  const chartData = data.map(item => ({
    ...item,
    shortName: item.productName.length > 15 
      ? item.productName.substring(0, 15) + '...' 
      : item.productName,
  }));

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <TrendingUp className="w-5 h-5 mr-2 text-primary-600" />
            {chartTitle}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 flex items-center justify-center">
            <div className="animate-pulse text-gray-400">Memuat chart...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <TrendingUp className="w-5 h-5 mr-2 text-primary-600" />
            {chartTitle}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 flex items-center justify-center text-gray-500">
            Tidak ada data produk
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <TrendingUp className="w-5 h-5 mr-2 text-primary-600" />
          {chartTitle}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ top: 5, right: 20, left: 80, bottom: 5 }}

            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis 
                type="number"
                tick={{ fontSize: 12 }}
                stroke="#9ca3af"
                tickFormatter={(value) => 
                  metric === 'revenue' 
                    ? `${(value / 1000000).toFixed(1)}jt` 
                    : value.toString()
                }
              />
              <YAxis 
                type="category"
                dataKey="shortName"
                tick={{ fontSize: 11 }}
                stroke="#9ca3af"
                width={75}
              />
              <Tooltip content={<CustomTooltip metric={metric} />} />
              <Bar
                dataKey={dataKey}
                fill={fillColor}
                radius={[0, 4, 4, 0]}
                cursor={onProductClick ? 'pointer' : 'default'}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Product List Table */}
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-2 px-2 font-medium text-gray-600">#</th>
                <th className="text-left py-2 px-2 font-medium text-gray-600">Produk</th>
                <th className="text-right py-2 px-2 font-medium text-gray-600">Qty</th>
                <th className="text-right py-2 px-2 font-medium text-gray-600">Revenue</th>
              </tr>
            </thead>
            <tbody>
              {data.map((product, index) => (
                <tr 
                  key={product.productId}
                  className={`border-b border-gray-100 hover:bg-gray-50 ${onProductClick ? 'cursor-pointer' : ''}`}
                  onClick={() => onProductClick?.(product.productId)}
                >
                  <td className="py-2 px-2 text-gray-500">{index + 1}</td>
                  <td className="py-2 px-2">
                    <div className="flex items-center">
                      <Package className="w-4 h-4 mr-2 text-gray-400" />
                      <span className="font-medium text-gray-900">{product.productName}</span>
                    </div>
                  </td>
                  <td className="py-2 px-2 text-right text-gray-700">{product.quantity}</td>
                  <td className="py-2 px-2 text-right text-gray-700">{formatCurrency(product.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
};

export default TopProductsChart;
