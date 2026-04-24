'use client';

import { QRCodeSVG } from 'qrcode.react';
import { useRef, useMemo } from 'react';

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
  tax_rate?: number;
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
  localPriceEdits?: Record<string, number>;
  localItemPriceEdits?: Record<string, number>;
};

export default function ReceiptModal({ isOpen, onClose, orders, orderItems, products, tableNumber, settings, localPriceEdits = {}, localItemPriceEdits = {} }: Props) {
  if (!isOpen) return null;

  const now = new Date();
  const dateStr = now.toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' });
  const timeStr = now.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
  const printFrameRef = useRef<HTMLIFrameElement>(null);
  const qrWrapRef = useRef<HTMLDivElement>(null);

  // 모든 주문 아이템 집계 (같은 메뉴는 수량 합산)
  const lineItems = useMemo(() => {
    const itemMap = new Map<string, { name: string; quantity: number; unitPrice: number; subtotal: number; taxRate: number; isService: boolean }>();
    orders.forEach(order => {
      orderItems.filter(i => i.order_id === order.id).forEach(item => {
        const product = products.find(p => p.id === item.product_id);
        const unitPrice = (localItemPriceEdits[item.id] !== undefined)
          ? localItemPriceEdits[item.id]
          : (localPriceEdits[item.product_id] !== undefined)
            ? localPriceEdits[item.product_id]
            : (item.unit_price || (item.quantity > 0 ? item.price / item.quantity : item.price));
        const name = product?.name || '상품';
        const taxRate = product?.tax_rate ?? 0.1;
        const isService = unitPrice === 0;
        const mapKey = item.product_id + (isService ? '_svc' : '');
        const existing = itemMap.get(mapKey);
        if (existing) {
          existing.quantity += item.quantity;
          existing.subtotal += item.quantity * unitPrice;
        } else {
          itemMap.set(mapKey, { name, quantity: item.quantity, unitPrice, subtotal: item.quantity * unitPrice, taxRate, isService });
        }
      });
    });
    return Array.from(itemMap.values());
  }, [orders, orderItems, products, localPriceEdits, localItemPriceEdits]);

  const supplyTotal = lineItems.reduce((s, i) => s + i.subtotal, 0);
  const vatTotal = lineItems.reduce((s, i) => s + Math.round(i.subtotal * i.taxRate), 0);
  const receiptTotal = supplyTotal + vatTotal;

  // === VietQR 생성 ===
  const bankNameToId: Record<string, string> = {
    'vietcombank': '970436',
    'vietinbank': '970415',
    'bidv': '970418',
    'agribank': '970405',
    'techcombank': '970407',
    'mb bank': '970422',
    'mb': '970422',
    'acb': '970416',
    'vpbank': '970432',
    'sacombank': '970403',
    'tpbank': '970423',
    'ocb': '970448',
    'msb': '970426',
    'vib': '970441',
    'hdbank': '970437',
    'shinhan bank': '970424',
    'shinhan': '970424',
    'woori bank': '970457',
    'woori': '970457',
    'eximbank': '970431',
    'lienvietpostbank': '970449',
    'lpbank': '970449',
    'oceanbank': '970414',
    'pvcombank': '970430',
    'nam a bank': '970428',
    'namabank': '970428',
    'saigonbank': '970400',
    'babylon': '970409',
    'bac a bank': '970409',
    'bacabank': '970409',
    'dong a bank': '970406',
    'dongabank': '970406',
    'seabank': '970440',
    'abbank': '970425',
    'viet bank': '970433',
    'vietbank': '970433',
    'ncb': '970419',
    'kienlongbank': '970452',
    'baoviet bank': '970438',
    'baovietbank': '970438',
    'pg bank': '970439',
    'pgbank': '970439',
    'vietcapital bank': '970454',
    'vietcapitalbank': '970454',
    'ivb': '970434',
    'indovina': '970434',
    'vrbbank': '970421',
    'vrb': '970421',
    'public bank': '970443',
    'publicbank': '970443',
    'scb': '970429',
    'cimb': '970422',
    'hsbc': '970458',
    'citibank': '970455',
    'anz': '970455',
    'standard chartered': '970410',
    'uob': '970458',
    'maritime bank': '970426',
    'maritime': '970426',
    'sacombank': '970403',
    'vib bank': '970441',
    'vibbank': '970441',
  };

  function normalizeBankName(name: string): string {
    return name.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
  }

  function getBankId(name: string): string | null {
    const norm = normalizeBankName(name);
    // exact match first
    if (bankNameToId[norm]) return bankNameToId[norm];
    // partial match
    for (const [key, id] of Object.entries(bankNameToId)) {
      if (norm.includes(key) || key.includes(norm)) return id;
    }
    return null;
  }

  function padVietQRLen(value: string): string {
    const len = value.length;
    return len < 10 ? '0' + len : String(len);
  }

  function crc16CCITT(str: string): string {
    let crc = 0xFFFF;
    for (let i = 0; i < str.length; i++) {
      crc ^= str.charCodeAt(i) << 8;
      for (let j = 0; j < 8; j++) {
        crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) : (crc << 1);
        crc &= 0xFFFF;
      }
    }
    return crc.toString(16).toUpperCase().padStart(4, '0');
  }

  function generateVietQR(bankId: string, accountNumber: string, amount: number, memo: string = ''): string {
    // Payload Format Indicator
    const payloadFormat = '000201';
    // Point of Initiation Method (Dynamic QR)
    const poiMethod = '010212';

    // Merchant Account Information (Tag 38)
    const guid = '00' + padVietQRLen('A000000727') + 'A000000727';

    // Payment Network Specific (Tag 01) — nested TLV
    const bankIdField = '00' + padVietQRLen(bankId) + bankId;
    const accField    = '01' + padVietQRLen(accountNumber) + accountNumber;
    const serviceCode = '02' + padVietQRLen('QRIBFTTA') + 'QRIBFTTA';
    const paymentNetworkValue = bankIdField + accField + serviceCode;
    const paymentNetwork = '01' + padVietQRLen(paymentNetworkValue) + paymentNetworkValue;

    const merchantValue = guid + paymentNetwork;
    const merchantInfo = '38' + padVietQRLen(merchantValue) + merchantValue;

    // Transaction Currency (704 = VND)
    const currency = '5303704';

    // Transaction Amount
    const amt = Math.round(amount).toString();
    const amountField = '54' + padVietQRLen(amt) + amt;

    // Country Code
    const country = '5802VN';

    // Additional Data Field (memo)
    let additional = '';
    if (memo) {
      const purpose = '08' + padVietQRLen(memo) + memo;
      additional = '62' + padVietQRLen(purpose) + purpose;
    }

    // CRC
    const dataBeforeCrc = payloadFormat + poiMethod + merchantInfo + currency + amountField + country + additional + '6304';
    const crc = crc16CCITT(dataBeforeCrc);
    return dataBeforeCrc + crc;
  }

  const bankId = getBankId(settings.bank_name);
  const hasBankInfo = !!bankId && !!settings.account_number;
  const qrValue = hasBankInfo
    ? generateVietQR(bankId, settings.account_number.replace(/\s/g, ''), receiptTotal, `Table ${tableNumber}`)
    : '';

  const handlePrint = () => {
    const iframe = printFrameRef.current;
    if (!iframe || !iframe.contentWindow) return;

    const printDoc = iframe.contentWindow.document;
    const header = settings.receipt_header || 'POS 레스토랑';

    const itemRows = lineItems.map(item => {
      const taxLabel = item.isService ? '' : ` ${Math.round(item.taxRate * 100)}%`;
      return `
        <tr>
          <td style="text-align:left;padding:2px 0;font-size:12px;">
            ${item.name}${item.isService ? ' <span style="font-size:10px;color:#db2777;">(서비스)</span>' : `<span style="font-size:10px;color:#666;">${taxLabel}</span>`}
          </td>
          <td style="text-align:center;padding:2px 0;font-size:12px;width:30px;">${item.quantity}</td>
          <td style="text-align:right;padding:2px 0;font-size:12px;width:70px;">${item.isService ? '0' : item.unitPrice.toLocaleString()}</td>
          <td style="text-align:right;padding:2px 0;font-size:12px;width:70px;font-weight:bold;">${item.isService ? '0' : item.subtotal.toLocaleString()}</td>
        </tr>
      `;
    }).join('');

    const qrSvg = qrWrapRef.current?.querySelector('svg')?.outerHTML || '';

    const html = `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>영수증</title>
<style>
  @page { size: 80mm auto; margin: 0; }
  @media print {
    body { margin: 0; padding: 0; }
    .receipt { width: 80mm; max-width: 80mm; margin: 0 auto; box-sizing: border-box; }
  }
  * { box-sizing: border-box; }
  body {
    font-family: 'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif;
    margin: 0;
    padding: 4mm;
    font-size: 12px;
    color: #111;
  }
  .receipt { width: 72mm; margin: 0 auto; }
  .center { text-align: center; }
  .header { font-size: 16px; font-weight: bold; margin-bottom: 4px; }
  .sub { font-size: 11px; color: #555; margin-bottom: 6px; }
  .divider { border-top: 1px dashed #999; margin: 6px 0; }
  table { width: 100%; border-collapse: collapse; }
  th { font-size: 11px; color: #555; border-bottom: 1px solid #ddd; padding: 2px 0; text-align: left; }
  td { vertical-align: top; }
  .right { text-align: right; }
  .bold { font-weight: bold; }
  .total-row { border-top: 1px solid #333; margin-top: 4px; padding-top: 4px; }
  .total-label { font-size: 14px; font-weight: bold; }
  .total-value { font-size: 16px; font-weight: bold; color: #2563eb; }
  .qr-wrap { text-align: center; margin-top: 8px; }
  .qr-wrap img, .qr-wrap svg { display: block; margin: 0 auto; }
  .bank { font-size: 11px; margin-top: 4px; }
  .footer { text-align: center; font-size: 11px; color: #777; margin-top: 10px; }
  .nowrap { white-space: nowrap; }
</style>
</head>
<body>
  <div class="receipt">
    <div class="center">
      <div class="header">${header}</div>
      <div class="sub">가영수증 · Provisional Receipt</div>
      <div style="font-size:11px;color:#555;margin-bottom:4px;">
        Table ${tableNumber} · ${dateStr} ${timeStr}
      </div>
    </div>
    <div class="divider"></div>
    <table>
      <thead>
        <tr>
          <th>메뉴</th>
          <th style="text-align:center;width:30px;">수량</th>
          <th style="text-align:right;width:70px;">단가</th>
          <th style="text-align:right;width:70px;">금액</th>
        </tr>
      </thead>
      <tbody>
        ${itemRows || '<tr><td colspan="4" style="text-align:center;color:#999;padding:8px 0;">주문 내역 없음</td></tr>'}
      </tbody>
    </table>
    <div class="divider"></div>
    <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:2px;">
      <span>주문 건수</span><span>${orders.length}건</span>
    </div>
    <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:2px;">
      <span>공급가액</span><span>${Math.round(supplyTotal).toLocaleString()} VND</span>
    </div>
    <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px;">
      <span>부가세</span><span>${Math.round(vatTotal).toLocaleString()} VND</span>
    </div>
    <div class="total-row" style="display:flex;justify-content:space-between;align-items:center;">
      <span class="total-label">합 계</span>
      <span class="total-value">${Math.round(receiptTotal).toLocaleString()} VND</span>
    </div>
    ${hasBankInfo ? `
    <div class="divider"></div>
    <div class="center bank">
      <div style="font-size:11px;color:#555;margin-bottom:4px;">계좌이체 안내</div>
      ${qrSvg ? `<div class="qr-wrap" style="margin-bottom:6px;">${qrSvg}</div>` : ''}
      <div>은행: ${settings.bank_name}</div>
      <div>계좌: ${settings.account_number}</div>
      <div>예금주: ${settings.account_holder}</div>
    </div>
    ` : ''}
    <div class="footer">
      감사합니다 · Cảm ơn quý khách
    </div>
  </div>
</body>
</html>`;

    printDoc.open();
    printDoc.write(html);
    printDoc.close();

    // 이미지/폰트 로딩 후 인쇄
    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    }, 300);
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      {/* 숨겨진 인쇄용 iframe */}
      <iframe ref={printFrameRef} style={{ position: 'absolute', width: '0px', height: '0px', border: 'none' }} title="print-frame" />

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
            <div key={idx} className={`flex items-center text-xs py-0.5 rounded ${item.isService ? 'bg-pink-50' : ''}`}>
              <span className="flex-1 text-[#374151] truncate pr-2">
                {item.name}
                {item.isService
                  ? <span className="ml-1 text-[9px] font-bold text-pink-600 bg-pink-100 border border-pink-200 px-1 py-0.5 rounded">서비스</span>
                  : <span className="text-[9px] text-gray-400"> {Math.round((item.taxRate)*100)}%</span>}
              </span>
              <span className="w-10 text-center text-gray-500">{item.quantity}</span>
              <span className={`w-16 text-right ${item.isService ? 'text-pink-500 font-medium' : 'text-gray-500'}`}>{item.isService ? '서비스' : item.unitPrice.toLocaleString()}</span>
              <span className={`w-20 text-right font-medium ${item.isService ? 'text-pink-500' : 'text-[#1F2937]'}`}>{item.isService ? '0' : item.subtotal.toLocaleString()}</span>
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
              <span className="text-xs text-gray-500">공급가액</span>
              <span className="text-xs text-gray-700">{Math.round(supplyTotal).toLocaleString()} VND</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-500">부가세</span>
              <span className="text-xs text-gray-700">{Math.round(vatTotal).toLocaleString()} VND</span>
            </div>
            <div className="flex justify-between items-center pt-1 border-t border-gray-100">
              <span className="text-sm font-bold text-[#1F2937]">합 계</span>
              <span className="text-lg font-bold text-blue-600">{Math.round(receiptTotal).toLocaleString()} VND</span>
            </div>
          </div>
        </div>

        {/* QR코드 + 은행정보 */}
        {hasBankInfo && (
          <div className="mx-5 mb-4 bg-gray-50 rounded-xl p-4 border border-gray-100">
            <p className="text-[10px] text-gray-400 text-center mb-3 uppercase tracking-wider">계좌이체 QR코드</p>
            <div className="flex items-center gap-4">
              <div ref={qrWrapRef} className="flex-shrink-0 bg-white p-2 rounded-lg border border-gray-200">
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
              QR코드를 스캔하여 {receiptTotal.toLocaleString()} VND 이체
            </p>
          </div>
        )}

        {/* 하단 */}
        <div className="px-5 pb-4">
          <div className="border-t border-dashed border-gray-200 pt-3 text-center">
            <p className="text-[10px] text-gray-400">감사합니다 · Cảm ơn quý khách</p>
          </div>
        </div>
        {/* 인쇄 버튼 */}
        <div className="px-5 py-2 text-center">
          <button
            onClick={handlePrint}
            className="bg-blue-600 text-white px-4 py-1 rounded text-sm hover:bg-blue-700"
          >
            인쇄
          </button>
        </div>
      </div>
    </div>
  );
}
