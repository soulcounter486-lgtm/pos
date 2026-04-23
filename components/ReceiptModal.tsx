'use client';

import { QRCodeSVG } from 'qrcode.react';

type OrderData = {
  id: string;
  table_id: string;
  total: number;
  status: string;
  created_at: string;
  total_amount?: number;
};

type OrderItemData = {
  id: string;
  order_id: string;
  product_id: string;
  quantity: number;
  price: number;
  unit_price?: number;
  note?: string;
};

type Product = {
  id: string;
  name: string;
  price: number;
  image_url?: string;
};

type Settings = {
  bank_name: string;
  account_number: string;
  account_holder: string;
  receipt_header: string;
};

type Props = {
  isOpen: boolean;
  onClose: () => void;
  orders: OrderData[];
  orderItems: OrderItemData[];
  products: Product[];
  tableNumber: string;
  settings: Settings;
};

export default function ReceiptModal({ isOpen, onClose, orders, orderItems, products, tableNumber, settings }: Props) {
  if (!isOpen) return null;

  const now = new Date();
  const dateStr = now.toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' });
  const timeStr = now.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });

  // 모든 주문 아이템 집계 (같은 메뉴는 수량 합산)
  const itemMap = new Map<string, { name: string; quantity: number; unitPrice: number; subtotal: number }>();
  orders.forEach(order => {
    orderItems.filter(i => i.order_id === order.id).forEach(item => {
      const product = products.find(p => p.id === item.product_id);
      const unitPrice = item.unit_price || (item.quantity > 0 ? item.price / item.quantity : item.price);
      const name = product?.name || '상품';
      const existing = itemMap.get(item.product_id);
      if (existing) {
        existing.quantity += item.quantity;
        existing.subtotal += item.quantity * unitPrice;
      } else {
        itemMap.set(item.product_id, { name, quantity: item.quantity, unitPrice, subtotal: item.quantity * unitPrice });
      }
    });
  });
  const lineItems = Array.from(itemMap.values());
  const grandTotal = orders.reduce((s, o) => s + (o.total_amount !== undefined ? o.total_amount : o.total), 0);

  const hasBankInfo = settings.bank_name || settings.account_number;
  const qrValue = hasBankInfo
    ? `${settings.receipt_header || 'POS'}\n은행: ${settings.bank_name}\n계좌: ${settings.account_number}\n예금주: ${settings.account_holder}\n금액: ${grandTotal.toLocaleString()} VND`
    : '';

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* 상단 헤더 */}
        <div className="bg-[#1F2937] px-5 py-4 text-white">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wider mb-0.5">가영수증</p>
              <h2 className="text-base font-bold">{settings.receipt_header || 'POS 레스토랑'}</h2>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-white mt-0.5">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="mt-3 flex items-center gap-4 text-xs text-gray-300">
            <span>🍽️ Table {tableNumber}</span>
            <span>📅 {dateStr}</span>
            <span>⏰ {timeStr}</span>
          </div>
        </div>

        {/* 점선 구분 */}
        <div className="px-5 py-2">
          <div className="border-t-2 border-dashed border-gray-200"></div>
        </div>

        {/* 주문 아이템 목록 */}
        <div className="px-5 space-y-2 max-h-52 overflow-y-auto">
          <div className="flex text-[10px] text-gray-400 font-medium pb-1 border-b border-gray-100">
            <span className="flex-1">메뉴</span>
            <span className="w-10 text-center">수량</span>
            <span className="w-16 text-right">단가</span>
            <span className="w-20 text-right">금액</span>
          </div>
          {lineItems.map((item, idx) => (
            <div key={idx} className="flex items-center text-xs">
              <span className="flex-1 text-[#374151] truncate pr-2">{item.name}</span>
              <span className="w-10 text-center text-gray-500">{item.quantity}</span>
              <span className="w-16 text-right text-gray-500">{item.unitPrice.toLocaleString()}</span>
              <span className="w-20 text-right font-medium text-[#1F2937]">{item.subtotal.toLocaleString()}</span>
            </div>
          ))}
          {lineItems.length === 0 && (
            <p className="text-center text-gray-400 text-xs py-4">주문 내역 없음</p>
          )}
        </div>

        {/* 합계 */}
        <div className="px-5 py-3">
          <div className="border-t-2 border-dashed border-gray-200 pt-2 mt-1 space-y-1">
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-500">주문 건수</span>
              <span className="text-xs text-gray-700">{orders.length}건</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-500">공급가액 (Net)</span>
              <span className="text-xs text-gray-700">{Math.round(grandTotal / 1.1).toLocaleString()} VND</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-500">부가세 (VAT 10%)</span>
              <span className="text-xs text-gray-700">{Math.round(grandTotal / 1.1 * 0.1).toLocaleString()} VND</span>
            </div>
            <div className="flex justify-between items-center pt-1 border-t border-gray-100">
              <span className="text-sm font-bold text-[#1F2937]">합 계</span>
              <span className="text-lg font-bold text-blue-600">{grandTotal.toLocaleString()} VND</span>
            </div>
          </div>
        </div>

        {/* QR코드 + 은행정보 */}
        {hasBankInfo && (
          <div className="mx-5 mb-4 bg-gray-50 rounded-xl p-4 border border-gray-100">
            <p className="text-[10px] text-gray-400 text-center mb-3 uppercase tracking-wider">계좌이체 QR코드</p>
            <div className="flex items-center gap-4">
              <div className="flex-shrink-0 bg-white p-2 rounded-lg border border-gray-200">
                <QRCodeSVG value={qrValue} size={80} level="M" />
              </div>
              <div className="flex-1 space-y-1">
                <div>
                  <p className="text-[9px] text-gray-400">은행</p>
                  <p className="text-xs font-semibold text-[#1F2937]">{settings.bank_name}</p>
                </div>
                <div>
                  <p className="text-[9px] text-gray-400">계좌번호</p>
                  <p className="text-xs font-bold text-[#1F2937] tracking-wider">{settings.account_number}</p>
                </div>
                <div>
                  <p className="text-[9px] text-gray-400">예금주</p>
                  <p className="text-xs font-semibold text-[#1F2937]">{settings.account_holder}</p>
                </div>
              </div>
            </div>
            <p className="text-[9px] text-gray-400 text-center mt-3">
              QR코드를 스캔하여 {grandTotal.toLocaleString()} VND 이체
            </p>
          </div>
        )}

        {/* 하단 */}
        <div className="px-5 pb-4">
          <div className="border-t border-dashed border-gray-200 pt-3 text-center">
            <p className="text-[10px] text-gray-400">감사합니다 · Cảm ơn quý khách</p>
          </div>
        </div>
      </div>
    </div>
  );
}
