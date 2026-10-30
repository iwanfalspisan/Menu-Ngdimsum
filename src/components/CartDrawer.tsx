import React, { useState, useMemo } from 'react';
import { CartItem, Order, OrderType, StoreSettings } from '../types';
import {
  formatCurrency,
  getAdminWhatsappUrl,
} from '../services/whatsappService';
import {
  X,
  Trash2,
  ShoppingBag,
  Utensils,
  MessageCircle,
  AlertCircle,
} from 'lucide-react';

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  items: CartItem[];
  onUpdateQuantity: (index: number, newQty: number) => void;
  onRemoveItem: (index: number) => void;
  onProceedToCheckout: () => void;
  storeSettings?: StoreSettings;
  onOrderCreated?: (order: Order) => void;
}

export const CartDrawer: React.FC<CartDrawerProps> = ({
  isOpen,
  onClose,
  items,
  onUpdateQuantity,
  onRemoveItem,
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
  const [validationError, setValidationError] = useState<string | null>(null);

  const subtotal = items.reduce(
    (sum, item) => sum + item.menuItem.price * item.quantity,
    0
  );

  const deliveryFee =
    orderType === 'delivery' ? storeSettings?.deliveryFeeFixed || 10000 : 0;
  const totalAmount = subtotal + deliveryFee;

  // Generate collision-proof order ID
  const nextOrderId = useMemo(() => {
    const d = new Date();
    const dateStr = d.toISOString().slice(5, 10).replace('-', '');
    const msEntropy = (d.getTime() % 10000)
      .toString(36)
      .toUpperCase()
      .padStart(3, '0');
    const randChars = Math.random().toString(36).substring(2, 5).toUpperCase();
    return `RMH-${dateStr}-${msEntropy}${randChars}`;
  }, [items.length, subtotal, isOpen]);

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
      items: items.map((c) => ({
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
          note: 'Pesanan masuk via Checkout WhatsApp di Keranjang',
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
      items,
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

  const liveWhatsappUrl = getAdminWhatsappUrl(
    draftOrder,
    storeSettings?.adminWhatsapp || '6281234567890',
    storeSettings?.storeName || 'Ngdimsum'
  );

  const handleDirectWhatsappClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (!isFormValid) {
      e.preventDefault();
      if (!customerName.trim() || !customerPhone.trim()) {
        setValidationError('Mohon isi Nama Pemesan dan Nomor WhatsApp terlebih dahulu.');
      } else if (orderType === 'delivery' && !deliveryAddress.trim()) {
        setValidationError('Mohon isi Alamat Pengantaran untuk pengiriman kurir.');
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

    // Biarkan browser membuka tab WhatsApp terlebih dahulu, lalu kosongkan & tutup keranjang
    setTimeout(() => {
      setCustomerNotes('');
      if (onOrderCreated) {
        onOrderCreated(finalOrder);
      }
      onClose();
    }, 150);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="absolute inset-0 bg-stone-950/60 backdrop-blur-xs transition-opacity"
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-0 sm:pl-10">
        <div className="w-screen max-w-md bg-white shadow-2xl flex flex-col">
          {/* Header */}
          <div className="p-4 border-b border-rose-100 flex items-center justify-between bg-rose-500 text-white">
            <div className="flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-white" />
              <h2 className="text-sm font-bold">
                Keranjang ({items.reduce((acc, it) => acc + it.quantity, 0)} porsi)
              </h2>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-rose-100 hover:text-white hover:bg-rose-600 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* CART ITEMS & DIRECT WHATSAPP CHECKOUT FORM */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {items.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-6 text-stone-500">
                    <div className="w-14 h-14 rounded-full bg-rose-50 flex items-center justify-center text-rose-500 mb-3 border border-rose-100">
                      <Utensils className="w-6 h-6" />
                    </div>
                    <h3 className="font-semibold text-stone-800 text-sm mb-1">
                      Keranjang Masih Kosong
                    </h3>
                    <p className="text-xs text-stone-500 max-w-xs mb-4">
                      Yuk pilih menu dimsum favorit, masukkan ke keranjang, lalu checkout langsung ke WhatsApp.
                    </p>
                    <button
                      onClick={onClose}
                      className="px-4 py-2 text-xs font-semibold bg-rose-500 text-white rounded-lg hover:bg-rose-600 transition-colors"
                    >
                      Pilih Menu Dimsum
                    </button>
                  </div>
                ) : (
                  <>
                    {/* Daftar Menu di Keranjang */}
                    <div className="divide-y divide-rose-50 border border-rose-100 rounded-xl p-3 bg-white">
                      {items.map((cartItem, idx) => (
                        <div
                          key={`${cartItem.menuItem.id}-${idx}`}
                          className="py-2.5 first:pt-0 last:pb-0 flex gap-3"
                        >
                          <img
                            src={cartItem.menuItem.image}
                            alt={cartItem.menuItem.name}
                            referrerPolicy="no-referrer"
                            className="w-13 h-13 rounded-lg object-cover bg-rose-50 shrink-0 border border-rose-100"
                          />
                          <div className="flex-1 flex flex-col justify-between">
                            <div>
                              <div className="flex items-start justify-between gap-2">
                                <h4 className="text-xs font-semibold text-stone-900 line-clamp-1">
                                  {cartItem.menuItem.name}
                                </h4>
                                <button
                                  onClick={() => onRemoveItem(idx)}
                                  className="text-stone-400 hover:text-rose-600 transition-colors p-0.5"
                                  title="Hapus"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>

                              <div className="text-[11px] text-stone-500 mt-0.5">
                                <span>{formatCurrency(cartItem.menuItem.price)}</span>
                                {cartItem.chiliLevel &&
                                  cartItem.chiliLevel !== 'Normal' && (
                                    <span className="text-rose-600 font-medium ml-1">
                                      · {cartItem.chiliLevel}
                                    </span>
                                  )}
                              </div>

                              {cartItem.notes && (
                                <div className="text-[10px] text-stone-500 italic mt-0.5 bg-rose-50/50 px-2 py-0.5 rounded border border-rose-100">
                                  Catatan: {cartItem.notes}
                                </div>
                              )}
                            </div>

                            <div className="flex items-center justify-between mt-1.5 pt-1">
                              {/* Quantity Stepper */}
                              <div className="flex items-center gap-1 border border-stone-200 rounded-md bg-stone-50 px-1 py-0.5">
                                <button
                                  onClick={() =>
                                    onUpdateQuantity(idx, cartItem.quantity - 1)
                                  }
                                  className="w-5 h-5 rounded bg-white text-stone-700 hover:bg-stone-200 text-xs font-bold flex items-center justify-center"
                                >
                                  -
                                </button>
                                <span className="w-5 text-center text-xs font-mono font-semibold tabular-nums">
                                  {cartItem.quantity}
                                </span>
                                <button
                                  onClick={() =>
                                    onUpdateQuantity(idx, cartItem.quantity + 1)
                                  }
                                  className="w-5 h-5 rounded bg-white text-stone-700 hover:bg-stone-200 text-xs font-bold flex items-center justify-center"
                                >
                                  +
                                </button>
                              </div>

                              <span className="text-xs font-bold text-rose-950 font-mono tabular-nums">
                                {formatCurrency(
                                  cartItem.menuItem.price * cartItem.quantity
                                )}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Form Data Pemesan untuk Template Chat WhatsApp */}
                    <div className="bg-rose-50/50 border border-rose-100 rounded-xl p-3.5 space-y-3">
                      <div className="text-xs font-bold text-stone-800 flex items-center gap-1.5">
                        <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Data Pemesan (Untuk Chat WhatsApp)</span>
                      </div>

                      {validationError && (
                        <div className="p-2 rounded-lg bg-rose-100 border border-rose-200 text-rose-800 text-[11px] flex items-center gap-1.5">
                          <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-600" />
                          <span>{validationError}</span>
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { id: 'takeaway', label: 'Ambil Sendiri' },
                          { id: 'delivery', label: 'Pesan Antar (Kurir)' },
                        ].map((t) => (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => setOrderType(t.id as OrderType)}
                            className={`py-2 px-2 rounded-lg border text-xs font-semibold transition-all ${
                              orderType === t.id
                                ? 'border-rose-400 bg-white text-rose-700 shadow-2xs'
                                : 'border-stone-200 bg-white/60 text-stone-600 hover:bg-white'
                            }`}
                          >
                            {t.label}
                          </button>
                        ))}
                      </div>

                      <div className="space-y-2.5">
                        <div>
                          <label className="block text-[11px] font-semibold text-stone-700 mb-1">
                            Nama Anda *
                          </label>
                          <input
                            type="text"
                            value={customerName}
                            onChange={(e) => {
                              setCustomerName(e.target.value);
                              if (validationError) setValidationError(null);
                            }}
                            placeholder="Contoh: Budi"
                            className="w-full px-3 py-1.5 text-xs bg-white border border-stone-200 rounded-lg focus:outline-none focus:border-rose-400"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-stone-700 mb-1">
                            Nomor WhatsApp *
                          </label>
                          <input
                            type="tel"
                            value={customerPhone}
                            onChange={(e) => {
                              setCustomerPhone(e.target.value);
                              if (validationError) setValidationError(null);
                            }}
                            placeholder="081234567890"
                            className="w-full px-3 py-1.5 text-xs bg-white border border-stone-200 rounded-lg focus:outline-none focus:border-rose-400"
                          />
                        </div>

                        {orderType === 'delivery' && (
                          <div>
                            <label className="block text-[11px] font-semibold text-stone-700 mb-1">
                              Alamat Lengkap Pengantaran *
                            </label>
                            <textarea
                              rows={2}
                              value={deliveryAddress}
                              onChange={(e) => {
                                setDeliveryAddress(e.target.value);
                                if (validationError) setValidationError(null);
                              }}
                              placeholder="Nama jalan, nomor rumah, patokan..."
                              className="w-full px-3 py-1.5 text-xs bg-white border border-stone-200 rounded-lg focus:outline-none focus:border-rose-400"
                            />
                          </div>
                        )}

                        <div>
                          <label className="block text-[11px] font-semibold text-stone-700 mb-1">
                            Catatan Pesanan (Opsional)
                          </label>
                          <input
                            type="text"
                            value={customerNotes}
                            onChange={(e) => setCustomerNotes(e.target.value)}
                            placeholder="Misal: Minta sumpit 2, sambal dipisah..."
                            className="w-full px-3 py-1.5 text-xs bg-white border border-stone-200 rounded-lg focus:outline-none focus:border-rose-400"
                          />
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Footer Subtotal & Direct WhatsApp Checkout Button */}
              {items.length > 0 && (
                <div className="p-4 border-t border-rose-100 bg-rose-50/40 space-y-3">
                  <div className="space-y-1 text-xs text-stone-600">
                    <div className="flex justify-between">
                      <span>Subtotal Menu ({items.reduce((a, b) => a + b.quantity, 0)} porsi)</span>
                      <span className="font-mono font-medium tabular-nums text-stone-900">
                        {formatCurrency(subtotal)}
                      </span>
                    </div>
                    {deliveryFee > 0 && (
                      <div className="flex justify-between text-stone-600 text-xs">
                        <span>Ongkos Kirim</span>
                        <span className="font-mono tabular-nums text-stone-900">
                          {formatCurrency(deliveryFee)}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm font-bold text-stone-900 pt-1.5 border-t border-rose-100">
                      <span>Total Pesanan</span>
                      <span className="font-mono text-base text-rose-600 tabular-nums">
                        {formatCurrency(totalAmount)}
                      </span>
                    </div>
                  </div>

                  <a
                    href={isFormValid ? liveWhatsappUrl : '#checkout-wa'}
                    target={isFormValid ? '_blank' : undefined}
                    rel={isFormValid ? 'noopener noreferrer' : undefined}
                    onClick={handleDirectWhatsappClick}
                    className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs sm:text-sm rounded-xl shadow-md transition-all flex items-center justify-center gap-2 active:scale-98"
                  >
                    <MessageCircle className="w-4 h-4" />
                    <span>Checkout &amp; Pesan via WhatsApp</span>
                  </a>
                </div>
              )}
        </div>
      </div>
    </div>
  );
};
