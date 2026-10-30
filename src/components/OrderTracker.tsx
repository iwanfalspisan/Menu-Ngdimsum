import React, { useState } from 'react';
import { Order, OrderStatus } from '../types';
import { formatCurrency, getCustomerWhatsappUrl } from '../services/whatsappService';
import {
  requestPushPermission,
  isPushPermissionGranted,
} from '../services/pushNotificationService';
import {
  Search,
  CheckCircle2,
  Clock,
  UtensilsCrossed,
  Bell,
  MessageCircle,
  Sparkles,
  Flame,
  Bike,
  PackageCheck,
  AlertCircle,
  RefreshCw,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface OrderTrackerProps {
  orders: Order[];
  currentOrderId?: string;
  onSelectOrder: (orderId: string) => void;
  storeName: string;
}

export const OrderTracker: React.FC<OrderTrackerProps> = ({
  orders,
  currentOrderId,
  onSelectOrder,
  storeName,
}) => {
  const [searchQuery, setSearchQuery] = useState(currentOrderId || '');
  const [pushEnabled, setPushEnabled] = useState(isPushPermissionGranted());

  const selectedOrder =
    orders.find(
      (o) =>
        o.id.toLowerCase() === (currentOrderId || searchQuery).trim().toLowerCase()
    ) || orders[0];

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const found = orders.find(
      (o) =>
        o.id.toLowerCase().includes(searchQuery.trim().toLowerCase()) ||
        o.customer.phone.includes(searchQuery.trim())
    );
    if (found) {
      onSelectOrder(found.id);
    } else {
      alert('Pesanan dengan ID atau No HP tersebut tidak ditemukan.');
    }
  };

  const handleEnablePush = async () => {
    const granted = await requestPushPermission();
    setPushEnabled(granted);
  };

  const [showHistory, setShowHistory] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const getStepIndex = (status: OrderStatus): number => {
    switch (status) {
      case 'menunggu_pembayaran':
        return 0;
      case 'diproses_dapur':
        return 1;
      case 'siap_saji':
      case 'dalam_pengiriman':
        return 2;
      case 'selesai':
        return 3;
      case 'dibatalkan':
        return -1;
      default:
        return 0;
    }
  };

  const getProgressPercentage = (status: OrderStatus): number => {
    switch (status) {
      case 'menunggu_pembayaran':
        return 18;
      case 'diproses_dapur':
        return 52;
      case 'siap_saji':
        return 82;
      case 'dalam_pengiriman':
        return 88;
      case 'selesai':
        return 100;
      case 'dibatalkan':
        return 100;
      default:
        return 15;
    }
  };

  const isDelivery = selectedOrder?.customer?.orderType === 'delivery';

  const steps = [
    {
      key: 'menunggu_pembayaran' as OrderStatus,
      label: 'Pembayaran',
      desc: 'Verifikasi bayar',
      icon: Clock,
    },
    {
      key: 'diproses_dapur' as OrderStatus,
      label: 'Proses Dapur',
      desc: 'Kukus & goreng fresh',
      icon: Flame,
    },
    {
      key: 'siap_saji' as OrderStatus,
      label: isDelivery ? 'Pengantaran' : 'Siap Diambil',
      desc: isDelivery ? 'Kurir jalan' : 'Siap di rumah dapur',
      icon: isDelivery ? Bike : PackageCheck,
    },
    {
      key: 'selesai' as OrderStatus,
      label: 'Selesai',
      desc: 'Pesanan dinikmati',
      icon: CheckCircle2,
    },
  ];

  const handleManualRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setIsRefreshing(false);
    }, 600);
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      {/* Tracker Header */}
      <div className="text-center max-w-lg mx-auto mb-6">
        <div className="inline-flex items-center gap-1.5 text-xs text-rose-600 font-semibold uppercase tracking-wider mb-1.5">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Status Pesanan Dapur Rumah</span>
        </div>
        <h2 className="font-serif-brand text-2xl sm:text-3xl font-bold text-stone-900">
          Lacak Dimsum Anda
        </h2>
        <p className="text-xs text-stone-500 mt-1">
          Pantau proses pembuatan dimsum hangat dari dapur rumah hingga siap disantap.
        </p>

        {/* Search by Order ID */}
        <form onSubmit={handleSearch} className="mt-4 flex gap-2 max-w-sm mx-auto">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Masukkan ID Pesanan (misal: RMH-...)"
              className="w-full pl-8 pr-3 py-1.5 text-xs border border-rose-100 rounded-lg bg-white focus:outline-none focus:border-rose-400 shadow-2xs"
            />
          </div>
          <button
            type="submit"
            className="px-3.5 py-1.5 bg-rose-500 hover:bg-rose-600 text-white text-xs font-semibold rounded-lg shadow-2xs whitespace-nowrap"
          >
            Cari
          </button>
        </form>
      </div>

      {!selectedOrder ? (
        <div className="bg-white rounded-2xl border border-rose-100 p-8 text-center text-stone-500">
          <Clock className="w-10 h-10 text-rose-200 mx-auto mb-2" />
          <h3 className="text-sm font-bold text-stone-800">Belum Ada Pesanan yang Dipilih</h3>
          <p className="text-xs text-stone-500 mt-1">
            Pesan dimsum melalui menu atau cari menggunakan ID pesanan Anda di atas.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-rose-100 shadow-sm overflow-hidden">
          {/* Order Header Card */}
          <div className="p-5 bg-gradient-to-r from-rose-600 to-rose-500 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-xs text-rose-100 font-mono">
                <span>#{selectedOrder.id}</span>
                <span aria-hidden="true">·</span>
                <span>{new Date(selectedOrder.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB</span>
              </div>
              <h3 className="font-serif-brand text-lg font-bold text-white mt-0.5">
                Pesanan {selectedOrder.customer.name}
              </h3>
              <p className="text-xs text-rose-100 mt-0.5">
                {selectedOrder.customer.orderType === 'delivery'
                  ? `Kirim Kurir · ${selectedOrder.customer.deliveryAddress || '-'}`
                  : 'Ambil Sendiri di Rumah'}
              </p>
            </div>

            <div className="flex flex-col sm:items-end">
              <span className="text-[10px] text-rose-200">Total Pembayaran</span>
              <span className="font-mono text-lg font-bold text-white tabular-nums">
                {formatCurrency(selectedOrder.total)}
              </span>
              <span className="text-[10px] text-rose-100 capitalize">
                {selectedOrder.payment.method} · {selectedOrder.payment.status}
              </span>
            </div>
          </div>

          {/* Push notification banner */}
          <div className="px-5 py-2.5 bg-rose-50 border-b border-rose-100 flex items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 text-rose-900">
              <Bell className="w-3.5 h-3.5 text-rose-600 shrink-0" />
              <span>
                {pushEnabled
                  ? 'Notifikasi aktif: Anda akan tahu saat dimsum matang!'
                  : 'Aktifkan notifikasi browser agar diberitahu saat pesanan matang.'}
              </span>
            </div>
            {!pushEnabled && (
              <button
                onClick={handleEnablePush}
                className="px-2 py-0.5 text-[11px] font-semibold bg-rose-500 text-white rounded hover:bg-rose-600 whitespace-nowrap shrink-0"
              >
                Nyalakan
              </button>
            )}
          </div>

          {/* Real-time Progress Bar & Stepper Timeline */}
          <div className="p-5 sm:p-6 space-y-6">
            {/* Live Status Header & Refresh Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-rose-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                </span>
                <span className="text-xs font-bold text-stone-800">
                  {selectedOrder.status === 'selesai'
                    ? 'Pesanan Selesai'
                    : selectedOrder.status === 'dibatalkan'
                    ? 'Pesanan Dibatalkan'
                    : 'Pemantauan Dapur Real-Time'}
                </span>
                <span className="text-[10px] text-stone-400 hidden sm:inline">
                  (Otomatis Sinkron)
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleManualRefresh}
                  disabled={isRefreshing}
                  className="px-2 py-1 text-[11px] rounded-lg border border-rose-200 bg-rose-50/60 hover:bg-rose-100/80 text-rose-700 flex items-center gap-1 transition-colors"
                  title="Periksa Pembaruan Status Dapur"
                >
                  <RefreshCw className={`w-3 h-3 ${isRefreshing ? 'animate-spin text-rose-500' : ''}`} />
                  <span className="text-[10px] font-semibold">
                    {isRefreshing ? 'Menyinkron...' : 'Perbarui Status'}
                  </span>
                </button>

                <div className="px-2.5 py-0.5 rounded-full text-xs font-bold font-mono bg-rose-100 text-rose-800 border border-rose-200">
                  {getProgressPercentage(selectedOrder.status)}%
                </div>
              </div>
            </div>

            {/* Continuous Animated Shimmer Progress Bar */}
            <div className="space-y-1">
              <div className="h-3 w-full bg-stone-100 rounded-full overflow-hidden p-0.5 border border-rose-100 shadow-inner relative">
                <div
                  className={`h-full rounded-full transition-all duration-700 ease-out animate-shimmer relative ${
                    selectedOrder.status === 'dibatalkan'
                      ? 'bg-stone-400'
                      : selectedOrder.status === 'selesai'
                      ? 'bg-gradient-to-r from-emerald-500 to-emerald-600'
                      : 'bg-gradient-to-r from-rose-500 via-rose-400 to-amber-400'
                  }`}
                  style={{ width: `${getProgressPercentage(selectedOrder.status)}%` }}
                >
                  {/* Glowing pulse indicator at front edge */}
                  {selectedOrder.status !== 'selesai' && selectedOrder.status !== 'dibatalkan' && (
                    <div className="absolute right-0 top-0 bottom-0 w-2.5 bg-white/70 rounded-full shadow-xs animate-pulse" />
                  )}
                </div>
              </div>
              <div className="flex justify-between text-[10px] text-stone-400 px-0.5">
                <span>Pesanan Dibuat</span>
                <span>Proses Dapur</span>
                <span>Penyajian</span>
                <span>Selesai</span>
              </div>
            </div>

            {/* Connected Step Nodes */}
            <div className="relative pt-1">
              {/* Connecting Background Line for Desktop */}
              <div className="hidden sm:block absolute top-6 left-10 right-10 h-0.5 bg-stone-200 -z-0" />
              
              {/* Active Connecting Fill Line */}
              {selectedOrder.status !== 'dibatalkan' && (
                <div
                  className="hidden sm:block absolute top-6 left-10 h-0.5 bg-gradient-to-r from-rose-500 to-emerald-500 transition-all duration-700 ease-out -z-0"
                  style={{
                    width: `${Math.min(
                      100,
                      Math.max(
                        0,
                        (getStepIndex(selectedOrder.status) / (steps.length - 1)) * 82
                      )
                    )}%`,
                  }}
                />
              )}

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 relative z-10">
                {steps.map((st, idx) => {
                  const currentIdx = getStepIndex(selectedOrder.status);
                  const isCompleted = currentIdx > idx;
                  const isCurrent = currentIdx === idx && selectedOrder.status !== 'dibatalkan';
                  const StepIcon = st.icon;

                  return (
                    <div
                      key={st.key}
                      className={`flex flex-col items-center text-center p-2.5 rounded-xl transition-all duration-300 ${
                        isCurrent
                          ? 'bg-rose-50/70 border border-rose-200/80 shadow-2xs'
                          : 'border border-transparent'
                      }`}
                    >
                      <div className="relative mb-2">
                        {/* Pulsing ring for current active step */}
                        {isCurrent && (
                          <span className="absolute -inset-1.5 rounded-full bg-rose-400/40 animate-ping" />
                        )}

                        <div
                          className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 shadow-2xs ${
                            isCompleted
                              ? 'bg-emerald-600 text-white'
                              : isCurrent
                              ? 'bg-rose-500 text-white ring-4 ring-rose-200/90 scale-105'
                              : 'bg-white border-2 border-stone-200 text-stone-400'
                          }`}
                        >
                          {isCompleted ? (
                            <CheckCircle2 className="w-5 h-5 text-white" />
                          ) : (
                            <StepIcon className="w-4 h-4" />
                          )}
                        </div>
                      </div>

                      <span
                        className={`text-xs font-bold leading-tight flex items-center gap-1 ${
                          isCurrent
                            ? 'text-rose-800'
                            : isCompleted
                            ? 'text-stone-800'
                            : 'text-stone-400'
                        }`}
                      >
                        {st.label}
                        {isCurrent && (
                          <span className="inline-block w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                        )}
                      </span>
                      <span className="text-[10px] text-stone-400 mt-0.5">
                        {st.desc}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Stage-Specific Live Kitchen Status Card with Animations */}
            {selectedOrder.status === 'diproses_dapur' && (
              <div className="p-4 rounded-2xl bg-gradient-to-br from-rose-50 via-rose-50/60 to-amber-50/40 border border-rose-200 shadow-2xs transition-all duration-300 animate-in fade-in">
                <div className="flex items-start gap-3.5">
                  <div className="relative p-2.5 bg-rose-500 text-white rounded-xl shadow-2xs shrink-0">
                    <Flame className="w-5 h-5 animate-pulse text-amber-200" />
                    <span className="absolute -top-1 -right-1 flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
                    </span>
                  </div>

                  <div className="flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-bold text-rose-950 uppercase tracking-wider">
                        Tahap Aktif:
                      </span>
                      <span className="text-xs font-extrabold text-rose-700 bg-rose-100 px-2 py-0.5 rounded-md border border-rose-200 animate-pulse">
                        Dimsum Sedang Dibuat Fresh di Dapur Rumah
                      </span>
                    </div>
                    <p className="text-xs text-stone-700 leading-relaxed">
                      Dapur Ngdimsum sedang mengukus dan menggoreng pesanan Anda langsung di klakat bambu agar tekstur lembut, juicy, dan aroma harumnya tersaji maksimal.
                    </p>
                    <div className="pt-1.5 flex flex-wrap items-center gap-3 text-[11px] text-stone-600 font-medium">
                      <span className="flex items-center gap-1 text-rose-700 font-semibold">
                        <Clock className="w-3.5 h-3.5 text-rose-500" />
                        Estimasi proses: ~10 - 15 Menit
                      </span>
                      <span className="flex items-center gap-1 text-emerald-700 font-semibold">
                        <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                        100% Hangat &amp; Halal
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {selectedOrder.status === 'menunggu_pembayaran' && (
              <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-200 shadow-2xs transition-all duration-300 animate-in fade-in">
                <div className="flex items-start gap-3">
                  <div className="p-2.5 bg-amber-500 text-white rounded-xl shadow-2xs shrink-0">
                    <Clock className="w-5 h-5" />
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-amber-950 uppercase tracking-wider">
                        Tahap Aktif:
                      </span>
                      <span className="text-xs font-extrabold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-md border border-amber-200">
                        Menunggu Pembayaran
                      </span>
                    </div>
                    <p className="text-xs text-stone-700 leading-relaxed">
                      Pesanan Anda sudah masuk dalam daftar antrean dapur. Silakan selesaikan pembayaran via QRIS atau transfer rekening agar tim dapur segera mengukus dimsum Anda.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {(selectedOrder.status === 'siap_saji' || selectedOrder.status === 'dalam_pengiriman') && (
              <div className="p-4 rounded-2xl bg-emerald-50/90 border border-emerald-200 shadow-2xs transition-all duration-300 animate-in fade-in">
                <div className="flex items-start gap-3">
                  <div className="p-2.5 bg-emerald-600 text-white rounded-xl shadow-2xs shrink-0">
                    {isDelivery ? (
                      <Bike className="w-5 h-5 text-white" />
                    ) : (
                      <PackageCheck className="w-5 h-5 text-white" />
                    )}
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-emerald-950 uppercase tracking-wider">
                        Tahap Aktif:
                      </span>
                      <span className="text-xs font-extrabold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-md border border-emerald-200">
                        {isDelivery ? 'Dalam Pengantaran Kurir' : 'Dimsum Siap Diambil di Rumah'}
                      </span>
                    </div>
                    <p className="text-xs text-stone-700 leading-relaxed">
                      {isDelivery
                        ? `Dimsum telah dikemas rapi dalam kemasan hangat dan sedang diantarkan kurir menuju: ${selectedOrder.customer.deliveryAddress || 'Alamat Anda'}.`
                        : 'Dimsum telah matang sempurna dan siap Anda ambil langsung di dapur rumah Ngdimsum dalam keadaan hangat.'}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {selectedOrder.status === 'selesai' && (
              <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200 shadow-2xs transition-all duration-300">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-600 text-white rounded-xl shrink-0">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-stone-900">
                      Pesanan Telah Selesai Diterima!
                    </h4>
                    <p className="text-xs text-stone-600 mt-0.5">
                      Terima kasih sudah memesan dimsum rumahan Ngdimsum. Selamat menikmati sajian hangat kami!
                    </p>
                  </div>
                </div>
              </div>
            )}

            {selectedOrder.status === 'dibatalkan' && (
              <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center gap-2.5">
                <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
                <div>
                  <span className="font-bold block">Pesanan Ini Telah Dibatalkan</span>
                  <span className="text-[11px] text-stone-500">
                    Hubungi kami di WhatsApp apabila ada pertanyaan mengenai pembatalan pesanan.
                  </span>
                </div>
              </div>
            )}

            {/* Collapsible Order History / Log Timeline */}
            {selectedOrder.statusHistory && selectedOrder.statusHistory.length > 0 && (
              <div className="border border-rose-100 rounded-xl overflow-hidden bg-white/70">
                <button
                  type="button"
                  onClick={() => setShowHistory(!showHistory)}
                  className="w-full px-3.5 py-2.5 flex items-center justify-between text-xs font-semibold text-stone-700 hover:bg-rose-50/50 transition-colors"
                >
                  <span className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-rose-500" />
                    <span>Catatan Riwayat Dapur ({selectedOrder.statusHistory.length})</span>
                  </span>
                  {showHistory ? (
                    <ChevronUp className="w-4 h-4 text-stone-400" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-stone-400" />
                  )}
                </button>

                {showHistory && (
                  <div className="p-3.5 border-t border-rose-100 bg-rose-50/30 space-y-2 text-xs">
                    {selectedOrder.statusHistory.map((log, idx) => (
                      <div key={idx} className="flex items-start gap-2.5 text-[11px]">
                        <span className="w-2 h-2 rounded-full bg-rose-400 mt-1 shrink-0" />
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-stone-900 capitalize">
                              {log.status.replace(/_/g, ' ')}
                            </span>
                            <span className="text-[10px] text-stone-400 font-mono">
                              {new Date(log.timestamp).toLocaleTimeString('id-ID', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}{' '}
                              WIB
                            </span>
                          </div>
                          <p className="text-stone-600 mt-0.5">{log.note}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Rincian Menu */}
          <div className="p-5 border-t border-rose-50 bg-stone-50/40">
            <h4 className="text-[11px] font-bold text-stone-700 uppercase tracking-wider mb-2">
              Menu yang Dipesan
            </h4>
            <div className="divide-y divide-rose-50 text-xs">
              {selectedOrder.items.map((it, idx) => (
                <div key={idx} className="py-2 flex items-center justify-between">
                  <div>
                    <span className="font-semibold text-stone-900">
                      {it.name} <span className="text-rose-600">x{it.quantity}</span>
                    </span>
                    <div className="text-[10px] text-stone-500">
                      {it.pieces}
                      {it.chiliLevel && it.chiliLevel !== 'Normal' && ` · ${it.chiliLevel}`}
                      {it.notes && ` · "${it.notes}"`}
                    </div>
                  </div>
                  <span className="font-mono tabular-nums font-bold text-stone-800">
                    {formatCurrency(it.subtotal)}
                  </span>
                </div>
              ))}
            </div>

            {/* Chat WhatsApp Dapur */}
            <div className="mt-4 pt-3 border-t border-rose-100 flex flex-col sm:flex-row items-center justify-between gap-2.5">
              <span className="text-xs text-stone-500">
                Mau tanya estimasi atau ganti catatan?
              </span>
              <a
                href={getCustomerWhatsappUrl(selectedOrder, storeName)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg shadow-2xs transition-colors"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                <span>Chat WhatsApp Pemilik Dapur</span>
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
