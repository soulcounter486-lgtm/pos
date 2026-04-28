'use client';

import { useState, useMemo } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import type { OrderData, OrderItemData, Product, Settings } from '@/types';
import { useLanguage } from '@/components/LanguageProvider';

interface PaymentModalProps {
  isOpen: boolean;
  pendingOrders: OrderData[];
  allOrderItems: OrderItemData[];
  products: Product[];
  settings: Settings;
  payMethod: 'cash' | 'card' | 'transfer' | 'mixed';
  discountStr: string;
  discountMode: 'amount' | 'percent';
  cashReceivedStr: string;
  localItemPriceEdits: Record<string, number>;
  localPriceEdits: Record<string, number>;
  loading: boolean;
  onClose: () => void;
  onPayMethodChange: (method: 'cash' | 'card' | 'transfer' | 'mixed') => void;
  onDiscountChange: (value: string) => void;
  onDiscountModeChange: (mode: 'amount' | 'percent') => void;
  onCashReceivedChange: (value: string) => void;
  onPaymentComplete: (method: string, amount: number) => void;
  onIssueReceipt: () => void;
  onShowTransferQR: () => void;
}

export default function PaymentModal({
  isOpen,
  pendingOrders,
  allOrderItems,
  products,
  settings,
  payMethod,
  discountStr,
  discountMode,
  cashReceivedStr,
  localItemPriceEdits,
  localPriceEdits,
  loading,
  onClose,
  onPayMethodChange,
  onDiscountChange,
  onDiscountModeChange,
  onCashReceivedChange,
  onPaymentComplete,
  onIssueReceipt,
  onShowTransferQR,
}: PaymentModalProps) {
  const { t } = useLanguage();
  const [showTransferQR, setShowTransferQR] = useState(false);

  if (!isOpen) return null;

  // Amount calculation
  const { subtotal, taxAmount, itemCount, grossBeforeDiscount, discount, payable, hasBankInfo, qrValue } = useMemo(() => {
    let subtotal = 0;
    let taxAmount = 0;
    let itemCount = 0;

    pendingOrders.forEach(order => {
      allOrderItems.filter(i => i.order_id === order.id).forEach(item => {
        const up = (order.status === 'completed' && localItemPriceEdits[item.id] !== undefined)
          ? localItemPriceEdits[item.id]
          : (order.status === 'completed' && localPriceEdits[item.product_id] !== undefined)
            ? localPriceEdits[item.product_id]
            : (item.unit_price || (item.quantity > 0 ? item.price / item.quantity : item.price));
        const supply = up * item.quantity;
        const product = products.find(p => p.id === item.product_id);
        const taxRate = product?.tax_rate ?? 0.1;
        subtotal += supply;
        taxAmount += supply * taxRate;
        itemCount += item.quantity;
      });
    });

    subtotal = Math.round(subtotal);
    taxAmount = Math.round(taxAmount);
    const discountInput = Math.max(0, parseInt(discountStr.replace(/[^\d]/g, '') || '0', 10) || 0);
    const gross = subtotal + taxAmount;
    const disc = discountMode === 'percent'
      ? Math.round(gross * Math.min(100, discountInput) / 100)
      : Math.min(discountInput, gross);
    const payable = Math.max(0, gross - disc);
    const hasBankInfo = settings.bank_name || settings.account_number;
    const qrValue = hasBankInfo
      ? `${settings.receipt_header || 'POS'}\n${t('common.bank_label')} ${settings.bank_name}\n${t('common.account_label')} ${settings.account_number}\n${t('common.account_holder_label2')} ${settings.account_holder}\n${t('common.amount_label')} ${payable.toLocaleString()} VND`
      : '';

    return { subtotal, taxAmount, itemCount, grossBeforeDiscount: gross, discount: disc, payable, hasBankInfo, qrValue };
  }, [pendingOrders, allOrderItems, products, settings, localItemPriceEdits, localPriceEdits, discountStr, discountMode, t]);

  const cashReceived = parseInt(cashReceivedStr.replace(/[^\d]/g, '') || '0', 10) || 0;
  const change = cashReceived - payable;

  const handlePay = () => {
    if (payMethod === 'transfer') {
      setShowTransferQR(true);
      onShowTransferQR();
      return;
    }
    if (payMethod === 'cash' && cashReceived > 0 && cashReceived < payable) {
      // insufficient funds handled by caller
      return;
    }
    onPaymentComplete(payMethod, payable);
    onClose();
  };

  const methods = [
    { key: 'cash', icon: '💵', name: t('common.pay_methods.cash') },
    { key: 'card', icon: '💳', name: t('common.pay_methods.card') },
    { key: 'transfer', icon: '🏦', name: t('common.pay_methods.transfer') },
    { key: 'mixed', icon: '🔀', name: t('common.pay_methods.mixed') },
  ] as const;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-[#F8F9FA] sm:rounded-2xl shadow-2xl w-full sm:max-w-md max-h-screen flex flex-col overflow-hidden">
        {showTransferQR ? (
          <>
            <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3 bg-white">
              <button onClick={() => setShowTransferQR(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div>
                <h3 className="text-lg font-bold text-[#111827]">{t('common.account_transfer_title')}</h3>
                <p className="text-sm text-gray-400">Table ...</p>
              </div>
            </div>
            <div className="p-5 space-y-4 bg-white">
              {hasBankInfo ? (
                <div className="flex items-start gap-4 bg-blue-50 rounded-xl p-4 border border-blue-100">
                  <div className="bg-white p-2 rounded-lg border border-blue-200 flex-shrink-0">
                    <QRCodeSVG value={qrValue || ' '} size={76} level="M" />
                  </div>
                  <div className="space-y-2 flex-1">
                    <div>
                      <p className="text-[10px] text-blue-400 uppercase">{t('common.bank_label_qr')}</p>
                      <p className="text-sm font-bold text-[#1F2937]">{settings.bank_name}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-blue-400 uppercase">{t('common.account_label_qr')}</p>
                      <p className="text-sm font-bold text-[#1F2937] tracking-wider">{settings.account_number}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-blue-400 uppercase">{t('common.holder_label_qr')}</p>
                      <p className="text-sm font-semibold text-[#1F2937]">{settings.account_holder}</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-amber-50 rounded-xl p-4 border border-amber-100 text-center">
                  <p className="text-sm text-amber-600">{t('common.admin_settings_bank_warning')}</p>
                </div>
              )}
              <div className="bg-gray-50 rounded-xl p-3 text-center">
                <p className="text-xs text-gray-400">{t('common.transfer_amount_label')}</p>
                <p className="text-xl font-bold text-blue-600">{payable.toLocaleString()} VND</p>
              </div>
            </div>
            <div className="px-5 pb-5 space-y-2 bg-white">
              <button
                onClick={() => {
                  setShowTransferQR(false);
                  onPaymentComplete('transfer', payable);
                }}
                disabled={!hasBankInfo}
                className="w-full py-3 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-xl font-bold text-sm transition-colors"
              >
                {t('common.transfer_complete')}
              </button>
              <button
                onClick={() => setShowTransferQR(false)}
                className="w-full py-2 text-gray-400 hover:text-[#374151] text-sm font-medium"
              >
                {t('common.back_btn')}
              </button>
            </div>
          </>
        ) : (
          <>
            {/* Header */}
            <div className="px-4 py-3 bg-white flex items-center gap-3 border-b border-gray-100">
              <button onClick={onClose} className="p-1 -ml-1 text-gray-700">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div className="flex-1 text-center">
                <h3 className="text-base font-bold text-[#111827]">{t('common.payment_title')}</h3>
                <p className="text-xs text-gray-400">Table ...</p>
              </div>
              <button onClick={onIssueReceipt} className="p-1 text-gray-600" title={t('common.receipt_label')}>
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              {/* Customer card */}
              <div className="p-3">
                <div className="bg-white rounded-xl border border-gray-200 px-4 py-3 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <span className="text-sm text-[#111827]">{t('common.guest_label')}</span>
                </div>
              </div>

              {/* Amount summary */}
              <div className="px-3">
                <div className="bg-white rounded-xl border border-gray-200 px-4 py-3 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-600">{t('common.total_product_amount')}</span>
                      <span className="text-[10px] bg-blue-100 text-blue-600 rounded-full px-2 py-0.5 font-medium">{itemCount}</span>
                    </div>
                    <span className="text-sm text-[#111827]">{subtotal.toLocaleString()} VND</span>
                  </div>
                  {/* ... 금액 상세 rows ... */}
                </div>
              </div>

              {/* Payment method selection */}
              <div className="p-3">
                <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
                  <p className="text-sm font-semibold text-gray-700 mb-2">{t('common.pay_method')}</p>
                  <div className="grid grid-cols-2 gap-2">
                    {methods.map(m => (
                      <button
                        key={m.key}
                        onClick={() => onPayMethodChange(m.key)}
                        className={`p-3 rounded-xl text-left transition-all ${
                          payMethod === m.key
                            ? 'bg-blue-50 border-2 border-blue-500'
                            : 'bg-gray-50 border-2 border-transparent hover:bg-gray-100'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{m.icon}</span>
                          <span className="text-sm font-medium text-gray-700">{m.name}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Discount input */}
              {(payMethod === 'cash' || payMethod === 'card') && (
                <div className="px-3 pb-3">
                  <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
                    <p className="text-sm font-semibold text-gray-700">{t('common.discount')}</p>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        inputMode="numeric"
                        value={discountStr}
                        onChange={e => onDiscountChange(e.target.value)}
                        placeholder={t('common.discount_label_form')}
                        className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <select
                        value={discountMode}
                        onChange={e => onDiscountModeChange(e.target.value === 'percent' ? 'percent' : 'amount')}
                        className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none"
                      >
                        <option value="percent">%</option>
                        <option value="amount">VND</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* Cash input */}
              {payMethod === 'cash' && (
                <div className="px-3 pb-3">
                  <div className="bg-white rounded-xl border border-gray-200 p-4">
                    <p className="text-sm font-semibold text-gray-700 mb-2">{t('common.cash_received_form')}</p>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={cashReceivedStr}
                      onChange={e => onCashReceivedChange(e.target.value)}
                      placeholder={t('common.cash_received_form')}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              )}

              {/* Payment summary and button */}
              <div className="p-3 bg-white border-t border-gray-100 space-y-3">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-600">{t('common.payable_label_form')}</span>
                  <span className="text-xl font-bold text-blue-600">{payable.toLocaleString()} VND</span>
                </div>
                {payMethod === 'cash' && cashReceived > 0 && (
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-600">{t('common.received')}</span>
                    <span className="text-gray-800">{cashReceived.toLocaleString()} VND</span>
                  </div>
                )}
                {payMethod === 'cash' && cashReceived > payable && (
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-600">{t('common.change')}</span>
                    <span className="text-green-600 font-bold">{(cashReceived - payable).toLocaleString()} VND</span>
                  </div>
                )}
                <button
                  onClick={handlePay}
                  disabled={loading || (payMethod === 'cash' && cashReceived > 0 && cashReceived < payable)}
                  className="w-full py-3 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-xl font-bold text-sm transition-colors"
                >
                  {loading ? t('common.processing') : t('common.pay')}
                </button>
              </div>
            </div>
          </>
          )}
      </div>
    </div>
  );
}
