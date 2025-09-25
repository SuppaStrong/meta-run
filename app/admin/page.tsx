'use client';

import Link from 'next/link';
import React, { useState, useEffect } from 'react';

interface KmAdjustment {
  id: string;
  bibNumber: number;
  date: string;
  adjustmentKm: number;
  reason: string;
  createdAt: string;
}

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [adjustments, setAdjustments] = useState<KmAdjustment[]>([]);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    bibNumber: '',
    date: new Date().toISOString().split('T')[0],
    adjustmentKm: '',
    reason: ''
  });

  const ADMIN_PASSWORD = 'meta@2025'; // Thay đổi password này!

  useEffect(() => {
    // Check if already logged in (stored in sessionStorage)
    const auth = sessionStorage.getItem('adminAuth');
    if (auth === 'true') {
      setIsAuthenticated(true);
      fetchAdjustments();
    }
  }, []);

  const handleLogin = () => {
    if (password === ADMIN_PASSWORD) {
      setIsAuthenticated(true);
      sessionStorage.setItem('adminAuth', 'true');
      fetchAdjustments();
    } else {
      alert('Sai mật khẩu!');
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    sessionStorage.removeItem('adminAuth');
    setPassword('');
  };

  const fetchAdjustments = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/km-adjustments');
      const data = await response.json();
      setAdjustments(data);
    } catch (error) {
      console.error('Error fetching adjustments:', error);
      alert('Lỗi khi tải danh sách điều chỉnh');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!formData.bibNumber || !formData.adjustmentKm) {
      alert('Vui lòng điền đầy đủ thông tin');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/km-adjustments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bibNumber: parseInt(formData.bibNumber),
          date: formData.date,
          adjustmentKm: parseFloat(formData.adjustmentKm),
          reason: formData.reason
        })
      });

      if (response.ok) {
        setFormData({
          bibNumber: '',
          date: new Date().toISOString().split('T')[0],
          adjustmentKm: '',
          reason: ''
        });
        fetchAdjustments();
        alert('Đã thêm điều chỉnh thành công');
      } else {
        alert('Lỗi khi thêm điều chỉnh');
      }
    } catch (error) {
      console.error('Error adding adjustment:', error);
      alert('Lỗi khi thêm điều chỉnh');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Bạn có chắc muốn xóa điều chỉnh này?')) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/km-adjustments?id=${id}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        fetchAdjustments();
        alert('Đã xóa điều chỉnh');
      } else {
        alert('Lỗi khi xóa điều chỉnh');
      }
    } catch (error) {
      console.error('Error deleting adjustment:', error);
      alert('Lỗi khi xóa điều chỉnh');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  // Login screen
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 text-white flex items-center justify-center p-4">
        <div className="backdrop-blur-md bg-white/10 rounded-2xl p-6 md:p-8 border border-white/20 shadow-2xl max-w-md w-full">
          <div className="text-center mb-6">
            <div className="text-3xl md:text-4xl mb-4">🔒</div>
            <h1 className="text-xl md:text-2xl font-bold">Admin Login</h1>
            <p className="text-gray-400 mt-2 text-sm md:text-base">Nhập mật khẩu để truy cập</p>
          </div>
          
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
            className="w-full px-4 py-3 rounded-lg bg-white/10 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-orange-400 mb-4 text-sm md:text-base"
            placeholder="Nhập mật khẩu admin"
          />
          
          <button
            onClick={handleLogin}
            className="w-full px-6 py-3 bg-gradient-to-r from-orange-500 to-red-600 rounded-lg font-semibold hover:from-orange-600 hover:to-red-700 transition-all text-sm md:text-base"
          >
            Đăng nhập
          </button>
          
          <div className="mt-6 text-center">
            <Link href="/" className="text-orange-400 hover:text-orange-300 text-sm">
              ← Quay lại trang chủ
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Admin dashboard
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 text-white p-2 md:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header with logout */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 md:mb-8 gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold mb-2 bg-gradient-to-r from-orange-400 to-red-500 bg-clip-text text-transparent">
              🔧 Admin - Quản lý Điều chỉnh KM
            </h1>
            <p className="text-gray-400 text-sm md:text-base">Thêm/xóa điều chỉnh km cho các vận động viên</p>
          </div>
          <div className="flex gap-2 md:gap-4 w-full md:w-auto">
            <Link 
              href="/"
              className="flex-1 md:flex-none px-3 py-2 md:px-4 md:py-2 bg-white/10 rounded-lg hover:bg-white/20 transition-colors text-center text-sm md:text-base"
            >
              🏠 Trang chủ
            </Link>
            <button
              onClick={handleLogout}
              className="flex-1 md:flex-none px-3 py-2 md:px-4 md:py-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors text-sm md:text-base"
            >
              🚪 Đăng xuất
            </button>
          </div>
        </div>

        {/* Form thêm điều chỉnh */}
        <div className="backdrop-blur-md bg-white/10 rounded-2xl p-4 md:p-6 border border-white/20 shadow-xl mb-6 md:mb-8">
          <h2 className="text-lg md:text-xl font-bold mb-4">➕ Thêm Điều chỉnh Mới</h2>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">BIB Number</label>
                <input
                  type="number"
                  value={formData.bibNumber}
                  onChange={(e) => setFormData({...formData, bibNumber: e.target.value})}
                  className="w-full px-3 py-2 md:px-4 md:py-2 rounded-lg bg-white/10 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-orange-400 text-sm md:text-base"
                  placeholder="Ví dụ: 931158"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Ngày</label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({...formData, date: e.target.value})}
                  className="w-full px-3 py-2 md:px-4 md:py-2 rounded-lg bg-white/10 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-orange-400 text-sm md:text-base"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Điều chỉnh KM (số âm để trừ đi)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.adjustmentKm}
                  onChange={(e) => setFormData({...formData, adjustmentKm: e.target.value})}
                  className="w-full px-3 py-2 md:px-4 md:py-2 rounded-lg bg-white/10 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-orange-400 text-sm md:text-base"
                  placeholder="Ví dụ: -30 hoặc 20"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Lý do</label>
                <input
                  type="text"
                  value={formData.reason}
                  onChange={(e) => setFormData({...formData, reason: e.target.value})}
                  className="w-full px-3 py-2 md:px-4 md:py-2 rounded-lg bg-white/10 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-orange-400 text-sm md:text-base"
                  placeholder="Vi phạm quy định, sai thiết bị..."
                />
              </div>
            </div>
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="w-full md:w-auto px-4 py-3 md:px-6 md:py-3 bg-gradient-to-r from-orange-500 to-red-600 rounded-lg font-semibold hover:from-orange-600 hover:to-red-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm md:text-base"
            >
              {loading ? 'Đang xử lý...' : '✅ Thêm Điều chỉnh'}
            </button>
          </div>
        </div>

        {/* Danh sách điều chỉnh */}
        <div className="backdrop-blur-md bg-white/10 rounded-2xl border border-white/20 shadow-xl overflow-hidden">
          <div className="p-4 md:p-6 border-b border-white/20">
            <h2 className="text-lg md:text-xl font-bold">📋 Danh sách Điều chỉnh</h2>
          </div>
          
          {loading && adjustments.length === 0 ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 md:h-12 md:w-12 border-4 border-gray-400 border-t-orange-400 mx-auto"></div>
              <p className="mt-4 text-gray-400 text-sm md:text-base">Đang tải...</p>
            </div>
          ) : adjustments.length === 0 ? (
            <div className="p-8 text-center text-gray-400">
              <p className="text-sm md:text-base">Chưa có điều chỉnh nào</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              {/* Mobile card layout */}
              <div className="md:hidden">
                {adjustments.map((adj) => (
                  <div key={adj.id} className="p-4 border-b border-white/10 last:border-b-0">
                    <div className="space-y-2">
                      <div className="flex justify-between items-start">
                        <span className="font-mono font-semibold text-orange-400 text-lg">
                          BIB {adj.bibNumber}
                        </span>
                        <button
                          onClick={() => handleDelete(adj.id)}
                          disabled={loading}
                          className="px-2 py-1 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors disabled:opacity-50 text-sm"
                        >
                          🗑️ Xóa
                        </button>
                      </div>
                      <div className="text-sm text-gray-300">
                        <strong>Ngày:</strong> {formatDate(adj.date)}
                      </div>
                      <div className="text-sm">
                        <strong>Điều chỉnh:</strong> 
                        <span className={`font-bold ml-1 ${adj.adjustmentKm < 0 ? 'text-red-400' : 'text-green-400'}`}>
                          {adj.adjustmentKm > 0 ? '+' : ''}{adj.adjustmentKm.toFixed(2)} km
                        </span>
                      </div>
                      <div className="text-sm text-gray-300">
                        <strong>Lý do:</strong> {adj.reason || '-'}
                      </div>
                      <div className="text-xs text-gray-400">
                        <strong>Tạo:</strong> {formatDate(adj.createdAt)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop table */}
              <table className="w-full hidden md:table">
                <thead className="bg-white/5">
                  <tr>
                    <th className="px-4 py-3 md:px-6 md:py-4 text-left text-sm font-bold">BIB Number</th>
                    <th className="px-4 py-3 md:px-6 md:py-4 text-left text-sm font-bold">Ngày</th>
                    <th className="px-4 py-3 md:px-6 md:py-4 text-left text-sm font-bold">Điều chỉnh KM</th>
                    <th className="px-4 py-3 md:px-6 md:py-4 text-left text-sm font-bold">Lý do</th>
                    <th className="px-4 py-3 md:px-6 md:py-4 text-left text-sm font-bold">Thời gian tạo</th>
                    <th className="px-4 py-3 md:px-6 md:py-4 text-left text-sm font-bold">Hành động</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {adjustments.map((adj) => (
                    <tr key={adj.id} className="hover:bg-white/5 transition-colors">
                      <td className="px-4 py-3 md:px-6 md:py-4">
                        <span className="font-mono font-semibold text-orange-400">
                          {adj.bibNumber}
                        </span>
                      </td>
                      <td className="px-4 py-3 md:px-6 md:py-4">{formatDate(adj.date)}</td>
                      <td className="px-4 py-3 md:px-6 md:py-4">
                        <span className={`font-bold ${adj.adjustmentKm < 0 ? 'text-red-400' : 'text-green-400'}`}>
                          {adj.adjustmentKm > 0 ? '+' : ''}{adj.adjustmentKm.toFixed(2)} km
                        </span>
                      </td>
                      <td className="px-4 py-3 md:px-6 md:py-4 text-gray-300">{adj.reason || '-'}</td>
                      <td className="px-4 py-3 md:px-6 md:py-4 text-sm text-gray-400">
                        {formatDate(adj.createdAt)}
                      </td>
                      <td className="px-4 py-3 md:px-6 md:py-4">
                        <button
                          onClick={() => handleDelete(adj.id)}
                          disabled={loading}
                          className="px-3 py-1 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors disabled:opacity-50 text-sm"
                        >
                          🗑️ Xóa
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Hướng dẫn */}
        <div className="mt-6 md:mt-8 backdrop-blur-md bg-blue-500/10 rounded-2xl p-4 md:p-6 border border-blue-500/20">
          <h3 className="text-base md:text-lg font-bold mb-3 text-blue-400">💡 Hướng dẫn sử dụng</h3>
          <ul className="space-y-2 text-gray-300 text-sm md:text-base">
            <li>• <strong>Số âm (-30)</strong>: Trừ đi km vi phạm của vận động viên</li>
            <li>• <strong>Số dương (+20)</strong>: Thêm km (nếu cần)</li>
            <li>• Điều chỉnh sẽ tự động áp dụng vào Daily Rankings</li>
            <li>• BIB Number là số BIB của vận động viên trong hệ thống</li>
            <li>• <strong>Lưu ý mới:</strong> Activities có class "text-danger" đã được tự động loại bỏ khỏi tổng km</li>
          </ul>
        </div>
      </div>
    </div>
  );
}