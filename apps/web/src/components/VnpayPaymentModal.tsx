'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Loader2,
  QrCode,
  RefreshCw,
  X,
} from 'lucide-react';
import { api, formatVND, Order, VnpayPaymentSession } from '../lib/api';

const POLL_INTERVAL_MS = 3000;

type Phase = 'creating' | 'waiting' | 'expired' | 'failed' | 'error';

interface Props {
  token: string;
  orderId: string;
  onPaid: (order: Order) => void;
  onClose: () => void;
}

function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const mm = String(Math.floor(total / 60)).padStart(2, '0');
  const ss = String(total % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

// Các trạng thái đơn đã đi qua bước thanh toán thành công.
const PAID_STATES: Order['status'][] = ['PAID', 'PREPARING', 'READY', 'COMPLETED'];

export function VnpayPaymentModal({ token, orderId, onPaid, onClose }: Props) {
  const [phase, setPhase] = useState<Phase>('creating');
  const [session, setSession] = useState<VnpayPaymentSession | null>(null);
  const [remainingMs, setRemainingMs] = useState<number>(0);
  const [message, setMessage] = useState<string | null>(null);
  // Mã giao dịch cuối cùng đã báo thất bại, để không báo lại cùng một lỗi mỗi lần poll.
  const settledFailureRef = useRef<string | null>(null);
  const paidRef = useRef(false);
  // Giữ onPaid mới nhất trong ref để việc cha render lại không làm reset vòng poll.
  const onPaidRef = useRef(onPaid);
  onPaidRef.current = onPaid;

  const createSession = useCallback(async () => {
    setPhase('creating');
    setMessage(null);
    try {
      const created = await api.createVnpayPayment(token, orderId);
      setSession(created);
      setRemainingMs(new Date(created.expiresAt).getTime() - Date.now());
      setPhase('waiting');
    } catch (err) {
      setMessage(
        err instanceof Error ? err.message : 'Không thể tạo mã thanh toán VNPay',
      );
      setPhase('error');
    }
  }, [token, orderId]);

  useEffect(() => {
    createSession();
  }, [createSession]);

  // Đếm ngược thời hạn của mã QR.
  useEffect(() => {
    if (phase !== 'waiting' || !session) return;
    const expiresAt = new Date(session.expiresAt).getTime();
    const tick = () => {
      const left = expiresAt - Date.now();
      setRemainingMs(left);
      if (left <= 0) setPhase('expired');
    };
    tick();
    const timer = setInterval(tick, 500);
    return () => clearInterval(timer);
  }, [phase, session]);

  // Hỏi lại trạng thái đơn: khách có thể trả tiền bằng điện thoại, trang này không tự biết.
  useEffect(() => {
    if (phase !== 'waiting' || !session) return;
    let cancelled = false;

    const poll = async () => {
      try {
        const order = await api.getOrderById(token, orderId);
        if (cancelled || paidRef.current) return;

        if (PAID_STATES.includes(order.status)) {
          paidRef.current = true;
          onPaidRef.current(order);
          return;
        }

        // Chỉ quan tâm đúng lần thanh toán đang hiển thị (khớp mã giao dịch), không phải lần cũ.
        const mine = order.payments?.find((p) => p.txnRef === session.txnRef);
        if (mine?.status === 'FAILED' && settledFailureRef.current !== mine.id) {
          settledFailureRef.current = mine.id;
          setMessage(mine.errorMessage || 'Thanh toán VNPay không thành công');
          setPhase('failed');
        }
      } catch {
        // Lỗi mạng thoáng qua: lần poll sau thử lại.
      }
    };

    const timer = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [phase, session, token, orderId]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Thanh toán VNPay"
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
      >
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center">
              <QrCode className="w-6 h-6 text-[#3E2723]" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-[#2C1810]">
                Thanh toán qua VNPay
              </h2>
              {session && (
                <p className="text-sm font-bold text-[#B45309] tabular-nums">
                  {formatVND(session.amount)}
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-gray-500 hover:bg-gray-100"
            aria-label="Đóng cửa sổ thanh toán"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {phase === 'creating' && (
          <div className="flex flex-col items-center gap-3 py-12 text-[#795548]">
            <Loader2 className="w-8 h-8 animate-spin" />
            <p className="text-sm">Đang tạo mã thanh toán...</p>
          </div>
        )}

        {phase === 'waiting' && session && (
          <div className="mt-5 space-y-4">
            <div className="mx-auto w-fit rounded-2xl border border-[#E6DCD2] bg-white p-3">
              <QRCodeSVG value={session.paymentUrl} size={232} level="L" includeMargin />
            </div>

            <div className="text-center space-y-1">
              <p className="text-sm text-[#5D4037]">
                Quét mã bằng điện thoại để mở trang thanh toán VNPay, hoặc bấm nút bên
                dưới để thanh toán ngay trên máy này.
              </p>
              <p className="text-xs text-[#795548]">
                Mã hết hạn sau{' '}
                <strong className="text-[#2C1810] tabular-nums">
                  {formatCountdown(remainingMs)}
                </strong>
              </p>
            </div>

            <a
              href={session.paymentUrl}
              className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-[#3E2723] text-white text-sm font-bold hover:bg-[#2C1810] transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              <span>Mở trang thanh toán VNPay</span>
            </a>

            <p className="flex items-center justify-center gap-2 text-xs text-[#795548]">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Đang chờ xác nhận thanh toán...</span>
            </p>
          </div>
        )}

        {phase === 'expired' && (
          <div className="mt-6 space-y-4 text-center">
            <AlertTriangle className="w-10 h-10 text-amber-600 mx-auto" />
            <p className="text-sm text-[#5D4037]">
              Mã QR đã hết hạn. Đơn hàng của bạn vẫn được giữ, bạn có thể tạo mã mới
              để thanh toán tiếp.
            </p>
            <button
              type="button"
              onClick={createSession}
              className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-[#3E2723] text-white text-sm font-bold hover:bg-[#2C1810]"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Tạo mã QR mới</span>
            </button>
          </div>
        )}

        {(phase === 'failed' || phase === 'error') && (
          <div className="mt-6 space-y-4 text-center">
            <AlertTriangle className="w-10 h-10 text-red-600 mx-auto" />
            <p className="text-sm font-bold text-red-800">
              {phase === 'failed' ? 'Thanh toán chưa thành công' : 'Không thể tạo mã thanh toán'}
            </p>
            {message && <p className="text-sm text-[#5D4037]">{message}</p>}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2.5 rounded-xl border border-[#E6DCD2] bg-white text-[#5D4037] text-sm font-bold hover:bg-[#FDFBF7]"
              >
                Đóng
              </button>
              <button
                type="button"
                onClick={createSession}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#3E2723] text-white text-sm font-bold hover:bg-[#2C1810]"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Thử lại</span>
              </button>
            </div>
          </div>
        )}

        {phase === 'waiting' && (
          <p className="mt-4 flex items-start gap-2 text-[11px] text-[#A8A29E] leading-relaxed">
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span>
              Đây là môi trường thử nghiệm (VNPay Sandbox), không trừ tiền thật. Đóng cửa sổ
              này không hủy đơn; bạn có thể quay lại thanh toán sau.
            </span>
          </p>
        )}
      </div>
    </div>
  );
}
