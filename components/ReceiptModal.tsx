'use client';

import { QRCodeSVG } from 'qrcode.react';
import { useRef, useMemo } from 'react';
import { useLanguage } from './LanguageProvider';

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
  discountStr?: string;
  discountMode?: 'amount' | 'percent';
  discountAmountOverride?: number;
};

export default function ReceiptModal({
  isOpen,
  onClose,
  orders,
  orderItems,
  products,
  tableNumber,
  settings,
  localPriceEdits = {},
  localItemPriceEdits = {},
  discountStr = '0',
  discountMode = 'amount',
  discountAmountOverride,
}: Props) {
  const { t, locale } = useLanguage();
  if (!isOpen) return null;

  const now = new Date();
  const dateStr = now.toLocaleDateString(locale === 'ko' ? 'ko-KR' : locale === 'vi' ? 'vi-VN' : 'en-US', { year: 'numeric', month: '2-digit', day: '2-digit' });
  const timeStr = now.toLocaleTimeString(locale === 'ko' ? 'ko-KR' : locale === 'vi' ? 'vi-VN' : 'en-US', { hour: '2-digit', minute: '2-digit' });
  const printFrameRef = useRef<HTMLIFrameElement>(null);
  const qrWrapRef = useRef<HTMLDivElement>(null);

  // Aggregate all order items (sum quantities for same menu items)
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
        const name = product?.name || t('common.product');
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
  }, [orders, orderItems, products, localPriceEdits, localItemPriceEdits, t]);

  const supplyTotal = lineItems.reduce((s, i) => s + i.subtotal, 0);
  const vatTotal = lineItems.reduce((s, i) => s + Math.round(i.subtotal * i.taxRate), 0);
  const discountBase = supplyTotal;
  const discountInput = Math.max(0, parseInt(String(discountStr).replace(/[^\d]/g, '') || '0', 10) || 0);
  const computedDiscountAmount = discountMode === 'percent'
    ? Math.round(discountBase * Math.min(100, discountInput) / 100)
    : Math.min(discountInput, discountBase);
  const discountAmount = discountAmountOverride !== undefined
    ? Math.max(0, Math.min(discountAmountOverride, discountBase))
    : computedDiscountAmount;
  const receiptTotal = Math.max(0, (supplyTotal - discountAmount) + vatTotal);
  const discountLabel = discountMode === 'percent'
    ? `${t('common.discount')} (${Math.min(100, discountInput)}%)`
    : t('common.discount');

  // === VietQR Generation ===
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
    'vib bank': '970441',
    'vibbank': '970441',
  };

  function normalizeBankName(name: string): string {
    return name.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
  }

  function getBankId(name: string): string | null {
    const norm = normalizeBankName(name);
    if (bankNameToId[norm]) return bankNameToId[norm];
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
    const payloadFormat = '000201';
    const poiMethod = '010212';
    const guid = '00' + padVietQRLen('A000000727') + 'A000000727';
    const bankIdField = '00' + padVietQRLen(bankId) + bankId;
    const accField    = '01' + padVietQRLen(accountNumber) + accountNumber;
    const serviceCode = '02' + padVietQRLen('QRIBFTTA') + 'QRIBFTTA';
    const paymentNetworkValue = bankIdField + accField + serviceCode;
    const paymentNetwork = '01' + padVietQRLen(paymentNetworkValue) + paymentNetworkValue;
    const merchantValue = guid + paymentNetwork;
    const merchantInfo = '38' + padVietQRLen(merchantValue) + merchantValue;
    const currency = '5303704';
    const amt = Math.round(amount).toString();
    const amountField = '54' + padVietQRLen(amt) + amt;
    const country = '5802VN';
    let additional = '';
    if (memo) {
      const purpose = '08' + padVietQRLen(memo) + memo;
      additional = '62' + padVietQRLen(purpose) + purpose;
    }
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
    const header = settings.receipt_header || t('common.receipt_header');

    const itemRows = lineItems.map(item => {
      const taxLabel = item.isService ? '' : ` ${Math.round(item.taxRate * 100)}%`;
      return `
        <tr>
          <td style="text-align:left;padding:2px 0;font-size:12px;color:#000;font-weight:600;">
            ${item.name}${item.isService ? ' <span style="font-size:10px;color:#000;font-weight:700;">(' + t('common.service') + ')</span>' : `<span style="font-size:10px;color:#111;font-weight:600;">${taxLabel}</span>`}
          </td>
          <td style="text-align:center;padding:2px 0;font-size:12px;width:30px;color:#000;font-weight:600;">${item.quantity}</td>
          <td style="text-align:right;padding:2px 0;font-size:12px;width:70px;color:#000;font-weight:600;">${item.isService ? '0' : item.unitPrice.toLocaleString()}</td>
          <td style="text-align:right;padding:2px 0;font-size:12px;width:70px;font-weight:800;color:#000;">${item.isService ? '0' : item.subtotal.toLocaleString()}</td>
        </tr>
      `;
    }).join('');

    const qrSvg = qrWrapRef.current?.querySelector('svg')?.outerHTML || '';

    const html = `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>${t('common.receipt')}</title>
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
    font-weight: 500;
    color: #000;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .receipt { width: 72mm; margin: 0 auto; }
  .center { text-align: center; }
  .header { font-size: 16px; font-weight: 800; margin-bottom: 4px; color: #000; }
  .sub { font-size: 11px; color: #222; margin-bottom: 6px; font-weight: 600; }
  .divider { border-top: 1px dashed #444; margin: 6px 0; }
  table { width: 100%; border-collapse: collapse; }
  th { font-size: 11px; color: #000; border-bottom: 1px solid #222; padding: 2px 0; text-align: left; font-weight: 700; }
  td { vertical-align: top; }
  .right { text-align: right; }
  .bold { font-weight: bold; }
  .total-row { border-top: 1px solid #111; margin-top: 4px; padding-top: 4px; }
  .total-label { font-size: 14px; font-weight: 800; color: #000; }
  .total-value { font-size: 16px; font-weight: 800; color: #000; }
  .qr-wrap { text-align: center; margin-top: 8px; }
  .qr-wrap img, .qr-wrap svg { display: block; margin: 0 auto; }
  .bank { font-size: 11px; margin-top: 4px; color: #000; font-weight: 600; }
  .footer { text-align: center; font-size: 11px; color: #000; margin-top: 10px; font-weight: 700; }
  .nowrap { white-space: nowrap; }
</style>
</head>
<body>
  <div class="receipt">
    <div class="center">
      <div class="header">${header}</div>
      <div class="sub">${t('common.receipt')} · ${t('common.provisional')}</div>
      <div style="font-size:11px;color:#111;margin-bottom:4px;font-weight:600;">
        ${t('common.table_num')} ${tableNumber} · ${dateStr} ${timeStr}
      </div>
    </div>
    <div class="divider"></div>
    <table>
      <thead>
        <tr>
          <th>${t('common.product')}</th>
          <th style="text-align:center;width:30px;">${t('common.quantity')}</th>
          <th style="text-align:right;width:70px;">${t('common.price')}</th>
          <th style="text-align:right;width:70px;">${t('common.amount')}</th>
        </tr>
      </thead>
      <tbody>
        ${itemRows || '<tr><td colspan="4" style="text-align:center;color:#999;padding:8px 0;">' + t('common.no_orders') + '</td></tr>'}
      </tbody>
    </table>
    <div class="divider"></div>
    <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:2px;">
      <span>${t('common.order_count')}</span><span>${orders.length}${t('common.order_count_label')}</span>
    </div>
    <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:2px;">
      <span>${t('common.supply_amount')}</span><span>${Math.round(supplyTotal).toLocaleString()} ${t('common.currency')}</span>
    </div>
    <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:2px;">
      <span>${t('common.tax')}</span><span>${Math.round(vatTotal).toLocaleString()} ${t('common.currency')}</span>
    </div>
    ${discountAmount > 0 ? `<div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px;">
      <span>${discountLabel}</span><span>-${Math.round(discountAmount).toLocaleString()} ${t('common.currency')}</span>
    </div>` : ''}
    <div class="total-row" style="display:flex;justify-content:space-between;align-items:center;">
      <span class="total-label">${t('common.total')}</span>
      <span class="total-value">${Math.round(receiptTotal).toLocaleString()} ${t('common.currency')}</span>
    </div>
    ${hasBankInfo ? `
    <div class="divider"></div>
    <div class="center bank">
      <div style="font-size:11px;color:#111;margin-bottom:4px;font-weight:600;">${t('common.bank_info')}</div>
      ${qrSvg ? `<div class="qr-wrap" style="margin-bottom:6px;">${qrSvg}</div>` : ''}
      <div>${settings.bank_name}</div>
      <div>${settings.account_number}</div>
      <div>${settings.account_holder}</div>
    </div>
    ` : ''}
    <div class="footer">
      ${t('common.thank_you')}
    </div>
  </div>
</body>
</html>`;

    printDoc.open();
    printDoc.write(html);
    printDoc.close();

    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    }, 300);
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      {/* Hidden print iframe */}
      <iframe ref={printFrameRef} style={{ position: 'absolute', width: '0px', height: '0px', border: 'none' }} title="print-frame" />

      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Top header */}
        <div className="bg-[#1F2937] px-5 py-4 text-white">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wider mb-0.5">{t('common.receipt')}</p>
              <h2 className="text-base font-bold">{settings.receipt_header || t('common.pos_restaurant')}</h2>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-white mt-0.5">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="mt-3 flex items-center gap-4 text-xs text-gray-300">
            <span>🍽️ {t('common.table_num')} {tableNumber}</span>
            <span>📅 {dateStr}</span>
            <span>⏰ {timeStr}</span>
          </div>
        </div>

        {/* Dashed separator */}
        <div className="px-5 py-2">
          <div className="border-t-2 border-dashed border-gray-200"></div>
        </div>

        {/* Order items list */}
        <div className="px-5 space-y-2 max-h-52 overflow-y-auto">
          <div className="flex text-[10px] text-gray-400 font-medium pb-1 border-b border-gray-100">
            <span className="flex-1">{t('common.product')}</span>
            <span className="w-10 text-center">{t('common.quantity')}</span>
            <span className="w-16 text-right">{t('common.price')}</span>
            <span className="w-20 text-right">{t('common.amount')}</span>
          </div>
          {lineItems.map((item, idx) => (
            <div key={idx} className={`flex items-center text-xs py-0.5 rounded ${item.isService ? 'bg-pink-50' : ''}`}>
              <span className="flex-1 text-[#374151] truncate pr-2">
                {item.name}
                {item.isService
                  ? <span className="ml-1 text-[9px] font-bold text-pink-600 bg-pink-100 border border-pink-200 px-1 py-0.5 rounded">{t('common.service')}</span>
                  : <span className="text-[9px] text-gray-400"> {Math.round((item.taxRate)*100)}%</span>}
              </span>
              <span className="w-10 text-center text-gray-500">{item.quantity}</span>
              <span className={`w-16 text-right ${item.isService ? 'text-pink-500 font-medium' : 'text-gray-500'}`}>{item.isService ? t('common.service') : item.unitPrice.toLocaleString()}</span>
              <span className={`w-20 text-right font-medium ${item.isService ? 'text-pink-500' : 'text-[#1F2937]'}`}>{item.isService ? '0' : item.subtotal.toLocaleString()}</span>
            </div>
          ))}
          {lineItems.length === 0 && (
            <p className="text-center text-gray-400 text-xs py-4">{t('common.no_orders')}</p>
          )}
        </div>

        {/* Totals */}
        <div className="px-5 py-3">
          <div className="border-t-2 border-dashed border-gray-200 pt-2 mt-1 space-y-1">
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-500">{t('common.order_count')}</span>
              <span className="text-xs text-gray-700">{orders.length}{t('common.order_count_label')}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-500">{t('common.supply_amount')}</span>
              <span className="text-xs text-gray-700">{Math.round(supplyTotal).toLocaleString()} {t('common.currency')}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-500">{t('common.tax')}</span>
              <span className="text-xs text-gray-700">{Math.round(vatTotal).toLocaleString()} {t('common.currency')}</span>
            </div>
            {discountAmount > 0 && (
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-500">{discountLabel}</span>
                <span className="text-xs text-gray-700">-{Math.round(discountAmount).toLocaleString()} {t('common.currency')}</span>
              </div>
            )}
            <div className="flex justify-between items-center pt-1 border-t border-gray-100">
              <span className="text-sm font-bold text-[#1F2937]">{t('common.total')}</span>
              <span className="text-lg font-bold text-blue-600">{Math.round(receiptTotal).toLocaleString()} {t('common.currency')}</span>
            </div>
          </div>
        </div>

        {/* QR code + Bank info */}
        {hasBankInfo && (
          <div className="mx-5 mb-4 bg-gray-50 rounded-xl p-4 border border-gray-100">
            <p className="text-[10px] text-gray-400 text-center mb-3 uppercase tracking-wider">{t('common.bank_info')} QR</p>
            <div className="flex items-center gap-4">
              <div ref={qrWrapRef} className="flex-shrink-0 bg-white p-2 rounded-lg border border-gray-200">
                <QRCodeSVG value={qrValue} size={80} level="M" />
              </div>
              <div className="flex-1 space-y-1">
                <div>
                  <p className="text-[9px] text-gray-400">{t('common.bank_name')}</p>
                  <p className="text-xs font-semibold text-[#1F2937]">{settings.bank_name}</p>
                </div>
                <div>
                  <p className="text-[9px] text-gray-400">{t('common.account_number')}</p>
                  <p className="text-xs font-bold text-[#1F2937] tracking-wider">{settings.account_number}</p>
                </div>
                <div>
                  <p className="text-[9px] text-gray-400">{t('common.account_holder')}</p>
                  <p className="text-xs font-semibold text-[#1F2937]">{settings.account_holder}</p>
                </div>
              </div>
            </div>
            <p className="text-[9px] text-gray-400 text-center mt-3">
              {t('common.scan_qr')} {receiptTotal.toLocaleString()} {t('common.currency')}
            </p>
          </div>
        )}

        {/* Bottom section */}
        <div className="px-5 pb-4">
          <div className="border-t border-dashed border-gray-200 pt-3 text-center">
            <p className="text-[10px] text-gray-400">{t('common.thank_you')}</p>
          </div>
        </div>
        {/* Print button */}
        <div className="px-5 py-2 text-center">
          <button
            onClick={handlePrint}
            className="bg-blue-600 text-white px-4 py-1 rounded text-sm hover:bg-blue-700"
          >
            {t('common.print')}
          </button>
        </div>
      </div>
    </div>
  );
}