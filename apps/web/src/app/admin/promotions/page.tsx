'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pencil, Plus, Power, Search, Trash2, X } from 'lucide-react';
import {
  AdminPromotion,
  AdminPromotionPayload,
  api,
  formatVND,
} from '../../../lib/api';
import { useAuthStore } from '../../../store/useAuthStore';

type StatusFilter = 'ALL' | 'ACTIVE' | 'INACTIVE' | 'EXPIRED';

interface FormState {
  code: string;
  description: string;
  discountPercent: string;
  maxDiscountAmount: string;
  minOrderValue: string;
  expiresAt: string; // yyyy-MM-dd
  isActive: boolean;
}

const inputCls =
  'w-full px-3 py-2 rounded-xl border border-[#E6DCD2] bg-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-400';

const labelCls = 'block text-xs font-bold text-[#795548] mb-1';

const toDateInput = (iso: string): string => {
  const d = new Date(iso);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
};

const emptyForm = (): FormState => {
  const next = new Date();
  next.setMonth(next.getMonth() + 1);
  return {
    code: '',
    description: '',
    discountPercent: '10',
    maxDiscountAmount: '20000',
    minOrderValue: '40000',
    expiresAt: toDateInput(next.toISOString()),
    isActive: true,
  };
};

type PromoState = 'ACTIVE' | 'INACTIVE' | 'EXPIRED';

const getState = (p: AdminPromotion): PromoState => {
  if (!p.isActive) return 'INACTIVE';
  if (new Date(p.expiresAt).getTime() < Date.now()) return 'EXPIRED';
  return 'ACTIVE';
};

const STATE_UI: Record<PromoState, { label: string; cls: string }> = {
  ACTIVE: { label: 'Đang áp dụng', cls: 'bg-green-100 text-green-800' },
  INACTIVE: { label: 'Đã tắt', cls: 'bg-stone-100 text-stone-700' },
  EXPIRED: { label: 'Hết hạn', cls: 'bg-red-100 text-red-700' },
};

export default function AdminPromotionsPage() {
  const { token } = useAuthStore();
  const [promotions, setPromotions] = useState<AdminPromotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [editing, setEditing] = useState<AdminPromotion | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<AdminPromotion | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      setPromotions(await api.getAdminPromotions(token));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tải được danh sách khuyến mãi');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return promotions.filter(
      (p) =>
        (statusFilter === 'ALL' || getState(p) === statusFilter) &&
        (!q || p.code.toLowerCase().includes(q) || p.description.toLowerCase().includes(q)),
    );
  }, [promotions, search, statusFilter]);

  const counts = useMemo(() => {
    const c = { ACTIVE: 0, INACTIVE: 0, EXPIRED: 0 };
    promotions.forEach((p) => {
      c[getState(p)] += 1;
    });
    return c;
  }, [promotions]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm());
    setFormError(null);
    setShowForm(true);
  };

  const openEdit = (p: AdminPromotion) => {
    setEditing(p);
    setForm({
      code: p.code,
      description: p.description,
      discountPercent: String(p.discountPercent),
      maxDiscountAmount: String(p.maxDiscountAmount),
      minOrderValue: String(p.minOrderValue),
      expiresAt: toDateInput(p.expiresAt),
      isActive: p.isActive,
    });
    setFormError(null);
    setShowForm(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || saving) return;
    setFormError(null);

    const discountPercent = Number(form.discountPercent);
    const maxDiscountAmount = Number(form.maxDiscountAmount);
    const minOrderValue = Number(form.minOrderValue);

    if (!Number.isInteger(discountPercent) || discountPercent < 1 || discountPercent > 100) {
      setFormError('Phần trăm giảm phải là số nguyên từ 1 đến 100');
      return;
    }
    if (![maxDiscountAmount, minOrderValue].every((n) => Number.isInteger(n) && n >= 0)) {
      setFormError('Mức giảm tối đa và đơn tối thiểu phải là số nguyên không âm');
      return;
    }
    if (!form.expiresAt) {
      setFormError('Vui lòng chọn ngày hết hạn');
      return;
    }

    // Hết hạn vào cuối ngày được chọn (giờ địa phương).
    const expiresAt = new Date(`${form.expiresAt}T23:59:59`).toISOString();

    setSaving(true);
    try {
      if (editing) {
        await api.updateAdminPromotion(token, editing.id, {
          description: form.description.trim(),
          discountPercent,
          maxDiscountAmount,
          minOrderValue,
          isActive: form.isActive,
          expiresAt,
        });
      } else {
        const payload: AdminPromotionPayload = {
          code: form.code.trim().toUpperCase(),
          description: form.description.trim(),
          discountPercent,
          maxDiscountAmount,
          minOrderValue,
          isActive: form.isActive,
          expiresAt,
        };
        await api.createAdminPromotion(token, payload);
      }
      setShowForm(false);
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Lưu khuyến mãi không thành công');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (p: AdminPromotion) => {
    if (!token) return;
    setError(null);
    try {
      await api.updateAdminPromotion(token, p.id, { isActive: !p.isActive });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Cập nhật không thành công');
    }
  };

  const confirmDelete = async () => {
    if (!token || !deleting) return;
    setError(null);
    try {
      await api.deleteAdminPromotion(token, deleting.id);
      setDeleting(null);
      await load();
    } catch (err) {
      setDeleting(null);
      setError(err instanceof Error ? err.message : 'Xóa khuyến mãi không thành công');
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold">Quản lý khuyến mãi</h1>
          <p className="text-xs text-[#795548]">
            Mã giảm giá khách nhập ở bước thanh toán. Tắt áp dụng để tạm ngừng mã, xóa để bỏ hẳn.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#2C1810] text-white text-sm font-bold hover:bg-[#3E2723]"
        >
          <Plus className="w-4 h-4" /> Thêm khuyến mãi
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {(Object.keys(STATE_UI) as PromoState[]).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setStatusFilter(statusFilter === k ? 'ALL' : k)}
            className={`text-left p-3.5 rounded-2xl border bg-white transition-colors ${
              statusFilter === k ? 'border-amber-400 ring-2 ring-amber-200' : 'border-[#E6DCD2] hover:bg-[#FDFBF7]'
            }`}
          >
            <p className="text-xs font-semibold text-[#795548]">{STATE_UI[k].label}</p>
            <p className="text-2xl font-extrabold tabular-nums">{counts[k]}</p>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#A1887F]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm theo mã hoặc mô tả"
            className={`${inputCls} pl-9`}
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          className={`${inputCls} w-auto`}
        >
          <option value="ALL">Tất cả trạng thái</option>
          <option value="ACTIVE">Đang áp dụng</option>
          <option value="INACTIVE">Đã tắt</option>
          <option value="EXPIRED">Hết hạn</option>
        </select>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-sm font-semibold text-red-700">
          {error}
        </div>
      )}

      <div className="bg-white border border-[#E6DCD2] rounded-2xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-[#F7F2EB] text-xs uppercase text-[#795548]">
            <tr>
              <th className="text-left px-4 py-3">Mã</th>
              <th className="text-left px-4 py-3">Ưu đãi</th>
              <th className="text-left px-4 py-3">Hạn dùng</th>
              <th className="text-left px-4 py-3">Trạng thái</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-[#795548]">
                  Đang tải...
                </td>
              </tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-[#795548]">
                  Không có khuyến mãi phù hợp
                </td>
              </tr>
            )}
            {filtered.map((p) => {
              const state = getState(p);
              return (
                <tr key={p.id} className="border-t border-[#F0E8DF] align-top">
                  <td className="px-4 py-3">
                    <p className="font-extrabold tabular-nums">{p.code}</p>
                    <p className="text-xs text-[#795548] max-w-[240px]">{p.description}</p>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <p className="font-bold text-[#B45309]">Giảm {p.discountPercent}%</p>
                    <p className="text-xs text-[#795548]">
                      Tối đa {formatVND(p.maxDiscountAmount)}
                    </p>
                    <p className="text-xs text-[#795548]">
                      Đơn từ {formatVND(p.minOrderValue)}
                    </p>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {new Date(p.expiresAt).toLocaleDateString('vi-VN')}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-lg text-xs font-bold ${STATE_UI[state].cls}`}>
                      {STATE_UI[state].label}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <button
                        type="button"
                        title="Sửa"
                        onClick={() => openEdit(p)}
                        className="p-2 rounded-lg hover:bg-[#F7F2EB]"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        title={p.isActive ? 'Tắt áp dụng' : 'Bật áp dụng'}
                        onClick={() => toggleActive(p)}
                        className={`p-2 rounded-lg hover:bg-[#F7F2EB] ${
                          p.isActive ? 'text-green-700' : 'text-stone-400'
                        }`}
                      >
                        <Power className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        title="Xóa"
                        onClick={() => setDeleting(p)}
                        className="p-2 rounded-lg text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <form
            onSubmit={handleSave}
            className="bg-white rounded-2xl w-full max-w-lg p-6 space-y-3 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between">
              <h2 className="font-extrabold">
                {editing ? `Sửa khuyến mãi ${editing.code}` : 'Thêm khuyến mãi'}
              </h2>
              <button type="button" onClick={() => setShowForm(false)} className="p-1" aria-label="Đóng">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <label className={labelCls}>Mã khuyến mãi</label>
              <input
                required
                disabled={!!editing}
                maxLength={30}
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                placeholder="VD: BREWLITE10"
                className={`${inputCls} uppercase disabled:bg-stone-100`}
              />
            </div>

            <div>
              <label className={labelCls}>Mô tả hiển thị cho khách</label>
              <input
                required
                maxLength={200}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="VD: Giảm 10% cho đơn từ 40.000đ"
                className={inputCls}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Giảm (%)</label>
                <input
                  required
                  type="number"
                  min={1}
                  max={100}
                  value={form.discountPercent}
                  onChange={(e) => setForm({ ...form, discountPercent: e.target.value })}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Giảm tối đa (đ)</label>
                <input
                  required
                  type="number"
                  min={0}
                  step={1000}
                  value={form.maxDiscountAmount}
                  onChange={(e) => setForm({ ...form, maxDiscountAmount: e.target.value })}
                  className={inputCls}
                />
              </div>
              <div className="col-span-2">
                <label className={labelCls}>Đơn tối thiểu (đ)</label>
                <input
                  required
                  type="number"
                  min={0}
                  step={1000}
                  value={form.minOrderValue}
                  onChange={(e) => setForm({ ...form, minOrderValue: e.target.value })}
                  className={inputCls}
                />
              </div>
            </div>

            <div>
              <label className={labelCls}>Ngày hết hạn (đến hết ngày này)</label>
              <input
                required
                type="date"
                value={form.expiresAt}
                onChange={(e) => setForm({ ...form, expiresAt: e.target.value })}
                className={inputCls}
              />
            </div>

            <label className="flex items-center gap-2 text-sm font-semibold cursor-pointer">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                className="w-4 h-4 accent-amber-500"
              />
              Cho phép áp dụng
            </label>

            {formError && <p className="text-sm font-semibold text-red-600">{formError}</p>}

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="flex-1 px-4 py-2.5 rounded-xl border border-[#E6DCD2] text-sm font-bold"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex-1 px-4 py-2.5 rounded-xl bg-[#2C1810] text-white text-sm font-bold disabled:opacity-50"
              >
                {saving ? 'Đang lưu...' : 'Lưu'}
              </button>
            </div>
          </form>
        </div>
      )}

      {deleting && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 space-y-4">
            <h2 className="font-extrabold">Xóa khuyến mãi?</h2>
            <p className="text-sm text-[#795548]">
              Xóa mã <strong>{deleting.code}</strong>. Hành động này không thể hoàn tác.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setDeleting(null)}
                className="flex-1 px-4 py-2.5 rounded-xl border border-[#E6DCD2] text-sm font-bold"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 text-white text-sm font-bold"
              >
                Xóa
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
