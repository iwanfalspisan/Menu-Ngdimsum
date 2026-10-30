import React from 'react';
import { Order, StoreSettings } from '../types';
import { formatCurrency } from '../services/whatsappService';
import { Printer, X, Check } from 'lucide-react';

interface ReceiptModalProps {
  order: Order | null;
  storeSettings: StoreSettings;
  onClose: () => void;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({
  order,
  storeSettings,
  onClose,
}) => {
  if (!order) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/70 backdrop-blur-xs">
      <div className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl border border-stone-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="p-4 bg-stone-900 text-stone-100 flex items-center justify-between print:hidden">
          <div className="flex items-center gap-2 text-xs font-bold">
            <Printer className="w-4 h-4 text-amber-400" />
            <span>Struk Pesanan Kasir / Dapur</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-stone-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Thermal Receipt Paper Style */}
        <div className="p-6 bg-white font-mono text-xs text-stone-900 space-y-4">
          <div className="text-center border-b border-dashed border-stone-300 pb-3">
            <h3 className="font-bold text-sm tracking-wider uppercase font-serif-brand">
              {storeSettings.storeName}
            </h3>
            <p className="text-[10px] text-stone-600 mt-0.5">{storeSettings.storeAddress}</p>
            <p className="text-[10px] text-stone-600">WA: {storeSettings.adminWhatsapp}</p>
          </div>

          <div className="space-y-1 text-[11px] border-b border-dashed border-stone-300 pb-3">
            <div className="flex justify-between">
              <span>No. Pesanan:</span>
              <span className="font-bold">#{order.id}</span>
            </div>
            <div className="flex justify-between">
              <span>Waktu:</span>
              <span>{new Date(order.createdAt).toLocaleString('id-ID')}</span>
            </div>
            <div className="flex justify-between">
              <span>Pelanggan:</span>
              <span>{order.customer.name}</span>
            </div>
            <div className="flex justify-between">
              <span>Layanan:</span>
              <span className="font-bold uppercase">
                {order.customer.orderType === 'delivery'
                  ? 'KIRIM KURIR'
                  : 'AMBIL SENDIRI'}
              </span>
            </div>
          </div>

          {/* Items */}
          <div className="border-b border-dashed border-stone-300 pb-3 space-y-2">
            {order.items.map((it, idx) => (
              <div key={idx} className="space-y-0.5">
                <div className="flex justify-between">
                  <span>
                    {it.name} x{it.quantity}
                  </span>
                  <span>{formatCurrency(it.subtotal)}</span>
                </div>
                {(it.chiliLevel || it.notes) && (
                  <div className="text-[10px] text-stone-500 italic pl-2">
                    {it.chiliLevel && `[${it.chiliLevel}] `}
                    {it.notes}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Calculations */}
          <div className="space-y-1 text-[11px] border-b border-dashed border-stone-300 pb-3">
            <div className="flex justify-between">
              <span>Subtotal:</span>
              <span>{formatCurrency(order.subtotal)}</span>
            </div>
            {order.packagingFee > 0 && (
              <div className="flex justify-between">
                <span>Kemasan:</span>
                <span>{formatCurrency(order.packagingFee)}</span>
              </div>
            )}
            {order.deliveryFee > 0 && (
              <div className="flex justify-between">
                <span>Ongkir:</span>
                <span>{formatCurrency(order.deliveryFee)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-xs pt-1 border-t border-stone-200">
              <span>TOTAL:</span>
              <span>{formatCurrency(order.total)}</span>
            </div>
            <div className="flex justify-between text-[10px] text-stone-600">
              <span>Metode:</span>
              <span>{order.payment.method.toUpperCase()} ({order.payment.status})</span>
            </div>
          </div>

          <div className="text-center text-[10px] text-stone-500 pt-1">
            <p>Terima kasih atas kunjungan Anda!</p>
            <p>Semua dimsum dibuat segar &amp; 100% Halal</p>
          </div>
        </div>

        {/* Print Button */}
        <div className="p-4 bg-stone-50 border-t border-stone-200 flex gap-2 print:hidden">
          <button
            onClick={handlePrint}
            className="flex-1 py-2 px-3 bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 shadow-2xs"
          >
            <Printer className="w-4 h-4" />
            <span>Cetak Struk Thermal</span>
          </button>
          <button
            onClick={onClose}
            className="py-2 px-3 bg-stone-200 hover:bg-stone-300 text-stone-700 text-xs font-semibold rounded-lg"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
