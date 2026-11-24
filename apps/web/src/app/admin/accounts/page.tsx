'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Lock, Pencil, Plus, Search, Trash2, Unlock, X } from 'lucide-react';
import { AdminAccount, api, formatDateTime, UserRole } from '../../../lib/api';
import { useAuthStore } from '../../../store/useAuthStore';

interface FormState {
  email: string;
  fullName: string;
  phone: string;
  password: string;
  role: UserRole;
}

const EMPTY_FORM: FormState = {
  email: '',
  fullName: '',
  phone: '',
  password: '',
  role: 'CUSTOMER',
};

const inputCls =
  'w-full px-3 py-2 rounded-xl border border-[#E6DCD2] bg-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-400';

export default function AdminAccountsPage() {
  const { token, user } = useAuthStore();
  const [accounts, setAccounts] = useState<AdminAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'ALL' | UserRole>('ALL');
  const [editing, setEditing] = useState<AdminAccount | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<AdminAccount | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      setAccounts(await api.getAdminAccounts(token));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tải được danh sách tài khoản');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return accounts.filter(
      (a) =>
        (roleFilter === 'ALL' || a.role === roleFilter) &&
        (!q || a.email.toLowerCase().includes(q) || a.fullName.toLowerCase().includes(q)),
    );
  }, [accounts, search, roleFilter]);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setShowForm(true);
  };

  const openEdit = (a: AdminAccount) => {
    setEditing(a);
    setForm({ email: a.email, fullName: a.fullName, phone: a.phone ?? '', password: '', role: a.role });
    setFormError(null);
    setShowForm(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || saving) return;
    setSaving(true);
    setFormError(null);
    try {
      if (editing) {
        await api.updateAdminAccount(token, editing.id, {
          fullName: form.fullName,
          phone: form.phone,
          role: form.role,
          ...(form.password ? { password: form.password } : {}),
        });
      } else {
        await api.createAdminAccount(token, {
          email: form.email,
          fullName: form.fullName,
          password: form.password,
          role: form.role,
          ...(form.phone ? { phone: form.phone } : {}),
        });
      }
      setShowForm(false);
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Lưu tài khoản không thành công');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (a: AdminAccount) => {
    if (!token) return;
    setError(null);
    try {
      await api.updateAdminAccount(token, a.id, { isActive: !a.isActive });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Cập nhật không thành công');
    }
  };

  const confirmDelete = async () => {
    if (!token || !deleting) return;
    setError(null);
    try {
      await api.deleteAdminAccount(token, deleting.id);
      setDeleting(null);
      await load();
    } catch (err) {
      setDeleting(null);
      setError(err instanceof Error ? err.message : 'Xóa tài khoản không thành công');
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold">Quản lý tài khoản</h1>
          <p className="text-xs text-[#795548]">
            Tài khoản Quản trị chỉ dùng giao diện admin; tài khoản Khách hàng dùng để đặt đồ uống.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#2C1810] text-white text-sm font-bold hover:bg-[#3E2723]"
        >
          <Plus className="w-4 h-4" /> Thêm tài khoản
        </button>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#A1887F]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm theo tên hoặc email"
            className={`${inputCls} pl-9`}
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value as 'ALL' | UserRole)}
          className={`${inputCls} w-auto`}
        >
          <option value="ALL">Tất cả vai trò</option>
          <option value="ADMIN">Quản trị</option>
          <option value="CUSTOMER">Khách hàng</option>
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
              <th className="text-left px-4 py-3">Tài khoản</th>
              <th className="text-left px-4 py-3">Vai trò</th>
              <th className="text-left px-4 py-3">Trạng thái</th>
              <th className="text-right px-4 py-3">Đơn</th>
              <th className="text-left px-4 py-3">Ngày tạo</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-[#795548]">
                  Đang tải...
                </td>
              </tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-[#795548]">
                  Không có tài khoản phù hợp
                </td>
              </tr>
            )}
            {filtered.map((a) => {
              const isSelf = a.id === user?.id;
              return (
                <tr key={a.id} className="border-t border-[#F0E8DF]">
                  <td className="px-4 py-3">
                    <p className="font-bold">
                      {a.fullName} {isSelf && <span className="text-[10px] text-amber-700">(bạn)</span>}
                    </p>
                    <p className="text-xs text-[#795548]">{a.email}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-0.5 rounded-lg text-xs font-bold ${
                        a.role === 'ADMIN' ? 'bg-amber-100 text-amber-800' : 'bg-stone-100 text-stone-700'
                      }`}
                    >
                      {a.role === 'ADMIN' ? 'Quản trị' : 'Khách hàng'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={a.isActive ? 'text-green-700 font-semibold' : 'text-red-600 font-semibold'}>
                      {a.isActive ? 'Hoạt động' : 'Đã khóa'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">{a._count?.orders ?? 0}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{formatDateTime(a.createdAt)}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <button
                        type="button"
                        title="Sửa"
                        onClick={() => openEdit(a)}
                        className="p-2 rounded-lg hover:bg-[#F7F2EB]"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        title={a.isActive ? 'Khóa' : 'Mở khóa'}
                        disabled={isSelf}
                        onClick={() => toggleActive(a)}
                        className="p-2 rounded-lg hover:bg-[#F7F2EB] disabled:opacity-30"
                      >
                        {a.isActive ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                      </button>
                      <button
                        type="button"
                        title="Xóa"
                        disabled={isSelf}
                        onClick={() => setDeleting(a)}
                        className="p-2 rounded-lg text-red-600 hover:bg-red-50 disabled:opacity-30"
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
            className="bg-white rounded-2xl w-full max-w-md p-6 space-y-3 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between">
              <h2 className="font-extrabold">{editing ? 'Sửa tài khoản' : 'Thêm tài khoản'}</h2>
              <button type="button" onClick={() => setShowForm(false)} className="p-1">
                <X className="w-5 h-5" />
              </button>
            </div>
            <input
              required
              type="email"
              disabled={!!editing}
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="Email"
              className={`${inputCls} disabled:bg-stone-100`}
            />
            <input
              required
              value={form.fullName}
              onChange={(e) => setForm({ ...form, fullName: e.target.value })}
              placeholder="Họ tên"
              className={inputCls}
            />
            <input
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="Số điện thoại (tùy chọn)"
              className={inputCls}
            />
            <input
              required={!editing}
              minLength={6}
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder={editing ? 'Mật khẩu mới (bỏ trống nếu không đổi)' : 'Mật khẩu (tối thiểu 6 ký tự)'}
              className={inputCls}
            />
            <select
              value={form.role}
              disabled={editing?.id === user?.id}
              onChange={(e) => setForm({ ...form, role: e.target.value as UserRole })}
              className={inputCls}
            >
              <option value="CUSTOMER">Khách hàng</option>
              <option value="ADMIN">Quản trị</option>
            </select>
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
            <h2 className="font-extrabold">Xóa tài khoản?</h2>
            <p className="text-sm text-[#795548]">
              Xóa <strong>{deleting.email}</strong>. Tài khoản đã có đơn hàng sẽ không xóa được, hãy khóa thay thế.
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
