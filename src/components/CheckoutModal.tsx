import React, { useState, useMemo } from 'react';
import {
  CartItem,
  Order,
  OrderType,
  StoreSettings,
} from '../types';
import {
  formatCurrency,
  getAdminWhatsappUrl,
  createWhatsappAdminMessage,
} from '../services/whatsappService';
import {
  X,
  CheckCircle2,
  MessageCircle,
  AlertCircle,
  PlusCircle,
} from 'lucide-react';

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  cartItems: CartItem[];
  storeSettings: StoreSettings;
  onOrderCreated: (order: Order) => void;
}

export const CheckoutModal: React.FC<CheckoutModalProps> = ({
  isOpen,
  onClose,
  cartItems,
  storeSettings,
  onOrderCreated,
}) => {
  const [customerName, setCustomerName] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('ngdimsum_customer_profile_v1');
      if (saved) return JSON.parse(saved).name || '';
    } catch (e) {}
    return '';
  });
  const [customerPhone, setCustomerPhone] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('ngdimsum_customer_profile_v1');
      if (saved) return JSON.parse(saved).phone || '';
    } catch (e) {}
    return '';
  });
  const [orderType, setOrderType] = useState<OrderType>('takeaway');
  const [deliveryAddress, setDeliveryAddress] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('ngdimsum_customer_profile_v1');
      if (saved) return JSON.parse(saved).address || '';
    } catch (e) {}
    return '';
  });
  const [customerNotes, setCustomerNotes] = useState('');
  const [createdOrder, setCreatedOrder] = useState<Order | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  const subtotal = cartItems.reduce(
    (sum, it) => sum + it.menuItem.price * it.quantity,
    0
  );

  const deliveryFee =
    orderType === 'delivery' ? storeSettings.deliveryFeeFixed : 0;
  const totalAmount = subtotal + deliveryFee;

  const nextOrderId = useMemo(() => {
    const d = new Date();
    const dateStr = d.toISOString().slice(5, 10).replace('-', '');
    const msEntropy = (d.getTime() % 10000)
      .toString(36)
      .toUpperCase()
      .padStart(3, '0');
    const randChars = Math.random().toString(36).substring(2, 5).toUpperCase();
    return `RMH-${dateStr}-${msEntropy}${randChars}`;
  }, [cartItems.length, subtotal, isOpen]);

  const draftOrder: Order = useMemo(
    () => ({
      id: nextOrderId,
      createdAt: new Date().toISOString(),
      customer: {
        name: customerName.trim() || 'Pelanggan',
        phone: customerPhone.trim() || '-',
        orderType,
        deliveryAddress:
          orderType === 'delivery' ? deliveryAddress.trim() : undefined,
        notes: customerNotes.trim() || undefined,
      },
      items: cartItems.map((c) => ({
        id: c.menuItem.id,
        name: c.menuItem.name,
        price: c.menuItem.price,
        quantity: c.quantity,
        pieces: c.menuItem.pieces,
        notes: c.notes,
        chiliLevel: c.chiliLevel,
        subtotal: c.menuItem.price * c.quantity,
      })),
      subtotal,
      packagingFee: 0,
      deliveryFee,
      discount: 0,
      total: totalAmount,
      payment: {
        method: 'cash',
        status: 'pending',
        referenceNumber: `WA-${Date.now().toString().slice(-6)}`,
      },
      status: 'diproses_dapur',
      estimatedTimeMinutes: 15,
      statusHistory: [
        {
          status: 'diproses_dapur',
          timestamp: new Date().toISOString(),
          note: 'Pesanan masuk melalui Checkout WhatsApp',
        },
      ],
      syncedToGoogleSheet: false,
      whatsappNotified: true,
    }),
    [
      nextOrderId,
      customerName,
      customerPhone,
      orderType,
      deliveryAddress,
      customerNotes,
      cartItems,
      subtotal,
      deliveryFee,
      totalAmount,
    ]
  );

  if (!isOpen) return null;

  const isFormValid =
    customerName.trim().length > 0 &&
    customerPhone.trim().length > 0 &&
    (orderType !== 'delivery' || deliveryAddress.trim().length > 0);

  const whatsappCheckoutUrl = getAdminWhatsappUrl(
    createdOrder || draftOrder,
    storeSettings.adminWhatsapp,
    storeSettings.storeName
  );

  const handleCloseAndReset = () => {
    setCreatedOrder(null);
    setCustomerNotes('');
    setValidationError(null);
    onClose();
  };

  const handleWhatsappOrderClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (!isFormValid) {
      e.preventDefault();
      if (!customerName.trim() || !customerPhone.trim()) {
        setValidationError('Mohon isi Nama Anda dan Nomor WhatsApp terlebih dahulu.');
      } else if (orderType === 'delivery' && !deliveryAddress.trim()) {
        setValidationError('Mohon masukkan alamat lengkap pengantaran kurir.');
      }
      return;
    }

    setValidationError(null);
    try {
      localStorage.setItem(
        'ngdimsum_customer_profile_v1',
        JSON.stringify({
          name: customerName.trim(),
          phone: customerPhone.trim(),
          address: deliveryAddress.trim(),
        })
      );
    } catch (err) {}

    const finalOrder: Order = {
      ...draftOrder,
      createdAt: new Date().toISOString(),
    };

    setTimeout(() => {
      setCustomerNotes('');
      onOrderCreated(finalOrder);
      onClose();
    }, 150);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/70 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-rose-100 overflow-hidden my-6 animate-in fade-in zoom-in-95 duration-150">
        {/* Top Header */}
        <div className="px-5 py-3.5 bg-rose-500 text-white flex items-center justify-between">
          <div>
            <h2 className="font-serif-brand text-base font-bold">
              Checkout Pesanan via WhatsApp
            </h2>
            <p className="text-[11px] text-rose-100">
              Isi nama &amp; nomor WA, template chat otomatis sesuai menu di keranjang
            </p>
          </div>
          <button
            onClick={handleCloseAndReset}
            className="p-1 rounded text-rose-200 hover:text-white"
            title="Tutup"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* FORM CHECKOUT LANGSUNG KE WHATSAPP */}
        <div className="p-5 space-y-3.5">
          {validationError && (
            <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{validationError}</span>
            </div>
          )}

          {/* Cara Pengambilan */}
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1.5">
              Cara Pengambilan Dimsum:
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              {[
                { id: 'takeaway', label: 'Ambil Sendiri', sub: 'Ke Rumah Dapur' },
                { id: 'delivery', label: 'Kirim Kurir', sub: 'Ojol / Antar ke Rumah' },
              ].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setOrderType(t.id as OrderType)}
                  className={`py-2.5 px-2 rounded-xl border text-center transition-all ${
                    orderType === t.id
                      ? 'border-rose-400 bg-rose-50 text-rose-800 font-bold shadow-2xs'
                      : 'border-stone-200 text-stone-600 hover:bg-stone-50'
                  }`}
                >
                  <div className="text-xs font-semibold">{t.label}</div>
                  <div className="text-[10px] text-stone-400 font-normal">{t.sub}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Name & Phone */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Nama Pemesan *
              </label>
              <input
                type="text"
                required
                value={customerName}
                onChange={(e) => {
                  setCustomerName(e.target.value);
                  if (validationError) setValidationError(null);
                }}
                placeholder="Nama Anda"
                className="w-full px-3 py-1.5 text-xs border border-stone-200 rounded-lg focus:outline-none focus:border-rose-400"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Nomor WhatsApp *
              </label>
              <input
                type="tel"
                required
                value={customerPhone}
                onChange={(e) => {
                  setCustomerPhone(e.target.value);
                  if (validationError) setValidationError(null);
                }}
                placeholder="081234567890"
                className="w-full px-3 py-1.5 text-xs border border-stone-200 rounded-lg focus:outline-none focus:border-rose-400"
              />
            </div>
          </div>

          {orderType === 'delivery' && (
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Alamat Pengantaran Lengkap *
              </label>
              <textarea
                required
                rows={2}
                value={deliveryAddress}
                onChange={(e) => {
                  setDeliveryAddress(e.target.value);
                  if (validationError) setValidationError(null);
                }}
                placeholder="Nama jalan, nomor rumah, patokan..."
                className="w-full px-3 py-1.5 text-xs border border-stone-200 rounded-lg focus:outline-none focus:border-rose-400"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Catatan Tambahan untuk Dapur (Opsional)
            </label>
            <input
              type="text"
              value={customerNotes}
              onChange={(e) => setCustomerNotes(e.target.value)}
              placeholder="Misal: Mau yang frozen / siap kukus sendiri..."
              className="w-full px-3 py-1.5 text-xs border border-stone-200 rounded-lg focus:outline-none focus:border-rose-400"
            />
          </div>

          {/* Rincian Menu yang Akan Dikirim ke Chat WhatsApp */}
          <div className="bg-rose-50/50 p-3 rounded-xl border border-rose-100 text-xs space-y-1.5">
            <div className="font-bold text-stone-800 text-[11px] pb-1 border-b border-rose-100">
              Rincian Menu di Keranjang ({cartItems.reduce((a, b) => a + b.quantity, 0)} porsi):
            </div>
            <div className="max-h-28 overflow-y-auto space-y-1 pr-1">
              {cartItems.map((c, i) => (
                <div key={i} className="flex justify-between text-[11px] text-stone-700">
                  <span className="truncate pr-2">
                    {i + 1}. {c.menuItem.name} <strong>x{c.quantity}</strong>
                  </span>
                  <span className="font-mono shrink-0">
                    {formatCurrency(c.menuItem.price * c.quantity)}
                  </span>
                </div>
              ))}
            </div>
            {deliveryFee > 0 && (
              <div className="flex justify-between text-stone-600 pt-1 border-t border-rose-100/60">
                <span>Ongkos Kirim</span>
                <span className="font-mono tabular-nums text-stone-900">
                  {formatCurrency(deliveryFee)}
                </span>
              </div>
            )}
            <div className="flex justify-between text-sm font-bold text-stone-900 pt-1.5 border-t border-rose-100">
              <span>Total Pesanan</span>
              <span className="font-mono text-rose-600 tabular-nums">
                {formatCurrency(totalAmount)}
              </span>
            </div>
          </div>

          <div className="pt-1">
            <a
              href={isFormValid ? whatsappCheckoutUrl : '#checkout-wa'}
              target={isFormValid ? '_blank' : undefined}
              rel={isFormValid ? 'noopener noreferrer' : undefined}
              onClick={handleWhatsappOrderClick}
              className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs sm:text-sm rounded-xl shadow-md transition-colors flex items-center justify-center gap-2 active:scale-98"
            >
              <MessageCircle className="w-4 h-4" />
              <span>Checkout &amp; Pesan Sekarang via WhatsApp</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
