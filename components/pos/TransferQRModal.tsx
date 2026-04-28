'use client';

import { QRCodeSVG } from 'qrcode.react';
import type { Settings } from '@/types';

interface TransferQRModalProps {
  payable: number;
  selectedTable: string;
  settings: Settings;
  t: (key: string, vars?: Record<string, string | number>) => string;
  hasBankInfo: boolean;
  qrValue: string;
  onClose: () => void;
  onConfirm: () => void;
}

export default function TransferQRModal({
  payable,
  selectedTable,
  settings,
  t,
  hasBankInfo,
  qrValue,
  onClose,
  onConfirm,
}: TransferQRModalProps) {
  return (
    <>
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3 bg-white">
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div>
          <h3 className="text-lg font-bold text-[#111827]">{t('common.account_transfer_title')}</h3>
          <p className="text-sm text-gray-400">Table {selectedTable} · {payable.toLocaleString()} VND</p>
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
          onClick={onConfirm}
          disabled={!hasBankInfo}
          className="w-full py-3 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-xl font-bold text-sm transition-colors"
        >
          {t('common.transfer_complete')}
        </button>
        <button
          onClick={onClose}
          className="w-full py-2 text-gray-400 hover:text-[#374151] text-sm font-medium"
        >
          {t('common.back_btn')}
        </button>
      </div>
    </>
  );
}
