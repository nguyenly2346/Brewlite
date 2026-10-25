'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Play,
  CheckCircle2,
  BellRing,
  XCircle,
  RefreshCw,
  AlertCircle,
  Flame,
  Eye,
  X,
  CreditCard,
  User,
  Clock,
  Store,
  Receipt,
  FileText,
} from 'lucide-react';
import {
  api,
  BarStation,
  formatDateTime,
  formatVND,
  getStationLabel,
  Order,
  OrderStatus,
} from '../../../lib/api';
import { OrderStatusBadge } from '../../../components/OrderStatusBadge';
import { useAuthStore } from '../../../store/useAuthStore';

type TabFilter =
  | 'ALL'
  | 'PAID'
  | 'PREPARING'
  | 'READY'
  | 'COMPLETED'
  | 'CANCELLED';

const TABS: Array<{ key: TabFilter; label: string }> = [
  { key: 'ALL', label: 'Tất cả' },
  { key: 'PAID', label: 'Chờ nhận (PAID)' },
  { key: 'PREPARING', label: 'Đang pha (PREPARING)' },
  { key: 'READY', label: 'Chờ lấy (READY)' },
  { key: 'COMPLETED', label: 'Hoàn tất (COMPLETED)' },
  { key: 'CANCELLED', label: 'Đã hủy' },
];

const STATIONS: Array<{ key: 'ALL' | BarStation; label: string }> = [
  { key: 'ALL', label: 'Tất cả trạm KDS' },
  { key: 'ESPRESSO_BAR', label: 'Trạm Máy Espresso & Phin' },
  { key: 'COLD_BREW_BAR', label: 'Trạm Ủ Lạnh Cold Brew' },
  { key: 'TEA_MATCHA_BAR', label: 'Trạm Trà & Matcha' },
];

export default function AdminOrdersPage() {
  const { token } = useAuthStore();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabFilter>('ALL');
  const [stationFilter, setStationFilter] = useState<'ALL' | BarStation>('ALL');
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [selectedDetailOrder, setSelectedDetailOrder] = useState<Order | null>(null);

  const fetchAllOrders = async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api.getAdminOrders(token);
      setOrders(data);
      if (selectedDetailOrder) {
        const refreshed = data.find((o) => o.id === selectedDetailOrder.id);
        if (refreshed) setSelectedDetailOrder(refreshed);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Không thể tải danh sách đơn hàng',
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllOrders();
  }, [token]);

  const handleTransition = async (orderId: string, nextStatus: OrderStatus) => {
    if (!token) return;
    setUpdatingId(orderId);
    setError(null);
    try {
      const updated = await api.updateOrderStatus(token, orderId, nextStatus);
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, ...updated } : o)),
      );
      if (selectedDetailOrder && selectedDetailOrder.id === orderId) {
        setSelectedDetailOrder((prev) => (prev ? { ...prev, ...updated } : null));
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Không thể chuyển trạng thái đơn hàng',
      );
    } finally {
      setUpdatingId(null);
    }
  };

  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      const matchesStatus = activeTab === 'ALL' || o.status === activeTab;
      const matchesStation =
        stationFilter === 'ALL' ||
        o.items.some((i) => (i.station || 'ESPRESSO_BAR') === stationFilter);
      return matchesStatus && matchesStation;
    });
  }, [orders, activeTab, stationFilter]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#2C1810]">
            Điều phối Quầy Pha Chế KDS & Quản lý Đơn hàng
          </h1>
          <p className="text-sm text-[#795548]">
            Phân luồng theo trạm Barista, xem chi tiết hóa đơn và tự động trừ kho nguyên liệu BOM khi bấm Nhận đơn
          </p>
        </div>

        <button
          type="button"
          onClick={fetchAllOrders}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-[#E6DCD2] text-xs sm:text-sm font-bold text-[#2C1810] hover:bg-[#FDFBF7] shadow-sm"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Làm mới KDS</span>
        </button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.key;
            const count =
              tab.key === 'ALL'
                ? orders.length
                : orders.filter((o) => o.status === tab.key).length;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                  isActive
                    ? 'bg-[#3E2723] text-white shadow-sm'
                    : 'bg-white text-[#795548] border border-[#E6DCD2] hover:text-[#2C1810]'
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`px-1.5 py-0.5 rounded-full text-[11px] tabular-nums ${
                    isActive
                      ? 'bg-amber-400 text-[#2C1810]'
                      : 'bg-[#FDFBF7] text-[#2C1810]'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-1.5">
          {STATIONS.map((st) => (
            <button
              key={st.key}
              type="button"
              onClick={() => setStationFilter(st.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                stationFilter === st.key
                  ? 'bg-amber-100 text-[#3E2723] border-amber-400'
                  : 'bg-white text-[#795548] border-[#E6DCD2]'
              }`}
            >
              {st.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-4 rounded-2xl bg-red-50 border border-red-200 text-xs sm:text-sm text-red-700 font-semibold">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="space-y-3 animate-pulse">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="h-20 bg-white border border-[#E6DCD2] rounded-2xl"
            />
          ))}
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="bg-white border border-[#E6DCD2] rounded-2xl p-10 text-center space-y-2">
          <p className="text-base font-bold text-[#2C1810]">
            Không có đơn hàng nào trong trạm / trạng thái này
          </p>
          <p className="text-xs text-[#795548]">
            Hãy chuyển sang tab trạng thái hoặc trạm pha chế khác.
          </p>
        </div>
      ) : (
        <div className="bg-white border border-[#E6DCD2] rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#FDFBF7] border-b border-[#E6DCD2] text-[11px] font-bold uppercase tracking-wider text-[#795548]">
                  <th className="py-3.5 px-5">Mã đơn</th>
                  <th className="py-3.5 px-5">Khách hàng</th>
                  <th className="py-3.5 px-5">Chi tiết món & Tùy chọn KDS</th>
                  <th className="py-3.5 px-5">Tổng tiền</th>
                  <th className="py-3.5 px-5">Trạng thái</th>
                  <th className="py-3.5 px-5 text-right">Thao tác điều phối & Xem chi tiết</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E6DCD2] text-sm">
                {filteredOrders.map((order) => {
                  const isBusy = updatingId === order.id;
                  return (
                    <tr key={order.id} className="hover:bg-[#FDFBF7]/60">
                      <td className="py-4 px-5 align-top">
                        <button
                          type="button"
                          onClick={() => setSelectedDetailOrder(order)}
                          className="font-extrabold text-[#2C1810] hover:text-[#B45309] tabular-nums block text-left hover:underline"
                          title="Nhấn để xem chi tiết đầy đủ đơn hàng"
                        >
                          {order.orderCode}
                        </button>
                        <span className="text-[11px] text-[#795548] block">
                          {formatDateTime(order.createdAt)}
                        </span>
                        <span className="inline-block mt-1 px-2 py-0.5 rounded bg-[#F7F2EB] text-[10px] font-bold text-[#5D4037]">
                          {order.pickupMethod === 'TAKEAWAY_BAG'
                            ? 'Đóng gói mang đi'
                            : 'Lấy tại quầy'}
                        </span>
                      </td>
                      <td className="py-4 px-5 align-top">
                        <p className="font-bold text-[#2C1810]">
                          {order.user?.fullName || 'Khách hàng'}
                        </p>
                        <p className="text-xs text-[#795548]">
                          {order.user?.email || ''}
                        </p>
                      </td>
                      <td className="py-4 px-5 align-top space-y-2 max-w-md">
                        {order.items.map((item) => {
                          const toppings = Array.isArray(item.toppings)
                            ? item.toppings
                            : [];
                          return (
                            <div
                              key={item.id}
                              className="p-2.5 rounded-xl bg-[#FDFBF7] border border-[#E6DCD2] text-xs space-y-1"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-extrabold text-[#2C1810]">
                                  {item.qty}x {item.productName} (Size {item.size})
                                </span>
                                <span className="px-2 py-0.5 rounded-full bg-amber-100 text-[#3E2723] text-[10px] font-bold">
                                  {getStationLabel(item.station)}
                                </span>
                              </div>
                              <p className="text-[#5D4037] font-medium">
                                {item.sugarLevel || '100% đường'} •{' '}
                                {item.iceLevel || 'Đá bình thường'}
                                {toppings.length > 0 &&
                                  ` • +${toppings.map((t) => t.name).join(', ')}`}
                              </p>
                              {item.itemNote && (
                                <p className="text-[#B45309] font-semibold italic">
                                  Ghi chú: &ldquo;{item.itemNote}&rdquo;
                                </p>
                              )}
                              {item.inventoryDeducted && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700">
                                  <Flame className="w-3 h-3" />
                                  Đã tự động trừ nguyên liệu BOM
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </td>
                      <td className="py-4 px-5 align-top font-extrabold text-[#B45309] tabular-nums whitespace-nowrap">
                        {formatVND(order.total)}
                      </td>
                      <td className="py-4 px-5 align-top">
                        <OrderStatusBadge status={order.status} />
                      </td>
                      <td className="py-4 px-5 align-top text-right">
                        <div className="inline-flex flex-wrap items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setSelectedDetailOrder(order)}
                            className="inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-white border border-[#E6DCD2] text-xs font-bold text-[#3E2723] hover:bg-[#F7F2EB] shadow-sm transition-colors"
                            title="Xem chi tiết đơn hàng"
                          >
                            <Eye className="w-3.5 h-3.5 text-[#B45309]" />
                            <span>Chi tiết</span>
                          </button>

                          {order.status === 'PAID' && (
                            <>
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() =>
                                  handleTransition(order.id, 'PREPARING')
                                }
                                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#3E2723] text-white text-xs font-bold hover:bg-[#2C1810] disabled:opacity-50 transition-colors"
                              >
                                <Play className="w-3.5 h-3.5 text-amber-300" />
                                <span>Nhận đơn & Trừ BOM</span>
                              </button>
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() =>
                                  handleTransition(order.id, 'CANCELLED')
                                }
                                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-50 text-red-700 border border-red-200 text-xs font-bold hover:bg-red-100 disabled:opacity-50 transition-colors"
                              >
                                <XCircle className="w-3.5 h-3.5" />
                                <span>Hủy đơn</span>
                              </button>
                            </>
                          )}

                          {order.status === 'PREPARING' && (
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() =>
                                handleTransition(order.id, 'READY')
                              }
                              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-600 text-white text-xs font-bold hover:bg-amber-700 disabled:opacity-50 transition-colors"
                            >
                              <BellRing className="w-3.5 h-3.5" />
                              <span>Pha xong (READY)</span>
                            </button>
                          )}

                          {order.status === 'READY' && (
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() =>
                                handleTransition(order.id, 'COMPLETED')
                              }
                              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-700 text-white text-xs font-bold hover:bg-emerald-800 disabled:opacity-50 transition-colors"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Giao khách (COMPLETED)</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL XEM CHI TIẾT ĐƠN HÀNG */}
      {selectedDetailOrder && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border border-[#E6DCD2] rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl space-y-6 my-8 animate-in fade-in zoom-in-95">
            <div className="flex items-start justify-between border-b border-[#E6DCD2] pb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-amber-100 text-[#3E2723] flex items-center justify-center font-extrabold">
                  <Receipt className="w-6 h-6 text-[#B45309]" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-extrabold text-[#2C1810]">
                      Chi tiết đơn hàng {selectedDetailOrder.orderCode}
                    </h2>
                    <OrderStatusBadge status={selectedDetailOrder.status} />
                  </div>
                  <p className="text-xs text-[#795548] mt-1 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" />
                    <span>Thời gian đặt: {formatDateTime(selectedDetailOrder.createdAt)}</span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDetailOrder(null)}
                className="p-2 rounded-xl text-[#795548] hover:bg-[#FDFBF7] transition-colors"
                title="Đóng chi tiết"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="p-4 rounded-2xl bg-[#FDFBF7] border border-[#E6DCD2] space-y-1.5">
                <p className="font-extrabold uppercase tracking-wider text-[#B45309] flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5" />
                  <span>Thông tin khách hàng</span>
                </p>
                <p className="text-sm font-bold text-[#2C1810]">
                  {selectedDetailOrder.user?.fullName || 'Khách hàng thành viên'}
                </p>
                <p className="text-[#795548]">{selectedDetailOrder.user?.email || 'N/A'}</p>
                {selectedDetailOrder.user?.loyaltyPoints !== undefined && (
                  <p className="text-[#3E2723] font-semibold">
                    Số dư điểm: {selectedDetailOrder.user.loyaltyPoints.toLocaleString('vi-VN')} điểm
                  </p>
                )}
              </div>

              <div className="p-4 rounded-2xl bg-[#FDFBF7] border border-[#E6DCD2] space-y-1.5">
                <p className="font-extrabold uppercase tracking-wider text-[#B45309] flex items-center gap-1.5">
                  <Store className="w-3.5 h-3.5" />
                  <span>Hình thức nhận & Giao dịch</span>
                </p>
                <p className="text-sm font-bold text-[#2C1810]">
                  {selectedDetailOrder.pickupMethod === 'TAKEAWAY_BAG'
                    ? 'Đóng gói mang đi (Takeaway Bag)'
                    : 'Nhận trực tiếp tại quầy (Pickup Counter)'}
                </p>
                {selectedDetailOrder.customerNote ? (
                  <p className="text-[#B45309] font-medium italic">
                    Ghi chú: &ldquo;{selectedDetailOrder.customerNote}&rdquo;
                  </p>
                ) : (
                  <p className="text-[#795548] italic">Không có ghi chú đơn</p>
                )}
                {selectedDetailOrder.payments && selectedDetailOrder.payments.length > 0 && (
                  <p className="text-[#3E2723] font-semibold flex items-center gap-1">
                    <CreditCard className="w-3 h-3 text-[#B45309]" />
                    <span>
                      {selectedDetailOrder.payments[0].method === 'CARD' ? 'Thẻ ngân hàng' : 'Ví điện tử'} •{' '}
                      {selectedDetailOrder.payments[0].status}
                    </span>
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#2C1810] flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-[#B45309]" />
                <span>Danh sách món đã đặt ({selectedDetailOrder.items.length} món)</span>
              </h3>
              <div className="divide-y divide-[#E6DCD2] border border-[#E6DCD2] rounded-2xl overflow-hidden max-h-60 overflow-y-auto">
                {selectedDetailOrder.items.map((item) => {
                  const toppings = Array.isArray(item.toppings) ? item.toppings : [];
                  return (
                    <div key={item.id} className="p-3.5 bg-white flex items-start justify-between gap-3 text-xs">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-[#2C1810] text-sm">
                            {item.qty}x {item.productName} (Size {item.size})
                          </span>
                          <span className="px-2 py-0.5 rounded-full bg-amber-100 text-[#3E2723] text-[10px] font-bold">
                            {getStationLabel(item.station)}
                          </span>
                        </div>
                        <p className="text-[#5D4037]">
                          Tùy chọn: {item.sugarLevel || '100% đường'} • {item.iceLevel || 'Đá bình thường'}
                          {toppings.length > 0 && ` • +Topping: ${toppings.map((t) => t.name).join(', ')}`}
                        </p>
                        {item.itemNote && (
                          <p className="text-[#B45309] italic">Ghi chú pha chế: &ldquo;{item.itemNote}&rdquo;</p>
                        )}
                        {item.inventoryDeducted && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700">
                            <Flame className="w-3 h-3" />
                            Đã trừ kho nguyên liệu BOM
                          </span>
                        )}
                      </div>
                      <span className="font-extrabold text-[#2C1810] tabular-nums whitespace-nowrap text-sm">
                        {formatVND(item.lineTotal)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="border-t border-[#E6DCD2] pt-4 space-y-2 text-xs sm:text-sm">
              <div className="flex items-center justify-between text-[#795548]">
                <span>Tạm tính</span>
                <span className="font-semibold text-[#2C1810] tabular-nums">
                  {formatVND(selectedDetailOrder.subtotal)}
                </span>
              </div>
              {selectedDetailOrder.discountAmount > 0 && (
                <div className="flex items-center justify-between text-[#795548]">
                  <span>Mã giảm giá ({selectedDetailOrder.promotionCode || 'Khuyến mãi'})</span>
                  <span className="font-semibold text-emerald-700 tabular-nums">
                    -{formatVND(selectedDetailOrder.discountAmount)}
                  </span>
                </div>
              )}
              {selectedDetailOrder.pointsDiscountAmount > 0 && (
                <div className="flex items-center justify-between text-[#B45309]">
                  <span>Điểm thưởng quy đổi ({selectedDetailOrder.pointsUsed} điểm)</span>
                  <span className="font-semibold tabular-nums">
                    -{formatVND(selectedDetailOrder.pointsDiscountAmount)}
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between pt-2 border-t border-[#E6DCD2] text-base font-extrabold text-[#2C1810]">
                <span>Tổng cộng thanh toán</span>
                <span className="text-xl text-[#B45309] tabular-nums">
                  {formatVND(selectedDetailOrder.total)}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[#E6DCD2]">
              <div className="flex items-center gap-2">
                {selectedDetailOrder.status === 'PAID' && (
                  <button
                    type="button"
                    onClick={() => handleTransition(selectedDetailOrder.id, 'PREPARING')}
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#3E2723] text-white text-xs font-bold hover:bg-[#2C1810]"
                  >
                    <Play className="w-3.5 h-3.5 text-amber-300" />
                    <span>Nhận đơn & Trừ kho BOM</span>
                  </button>
                )}
                {selectedDetailOrder.status === 'PREPARING' && (
                  <button
                    type="button"
                    onClick={() => handleTransition(selectedDetailOrder.id, 'READY')}
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-amber-600 text-white text-xs font-bold hover:bg-amber-700"
                  >
                    <BellRing className="w-3.5 h-3.5" />
                    <span>Pha xong (READY)</span>
                  </button>
                )}
                {selectedDetailOrder.status === 'READY' && (
                  <button
                    type="button"
                    onClick={() => handleTransition(selectedDetailOrder.id, 'COMPLETED')}
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-700 text-white text-xs font-bold hover:bg-emerald-800"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Giao khách (COMPLETED)</span>
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={() => setSelectedDetailOrder(null)}
                className="px-5 py-2.5 rounded-xl bg-[#F7F2EB] border border-[#E6DCD2] text-xs font-bold text-[#3E2723] hover:bg-[#EFE8DF]"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
