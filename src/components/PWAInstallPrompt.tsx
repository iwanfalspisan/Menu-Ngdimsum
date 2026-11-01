import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Download,
  X,
  Share,
  PlusSquare,
  MoreVertical,
  CheckCircle2,
  WifiOff,
} from 'lucide-react';
import { usePWAInstall, useOnlineStatus } from '../hooks/usePWAInstall';

interface PWAInstallProps {
  storeName?: string;
  storeLogoUrl?: string;
}

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();
  if (isOnline) return null;

  return (
    <div className="bg-amber-500 text-amber-950 text-xs font-bold py-1.5 px-4 text-center flex items-center justify-center gap-1.5 shadow-xs z-50">
      <WifiOff className="w-3.5 h-3.5 shrink-0" />
      <span>Mode Offline — Katalog menu tetap bisa dilihat tanpa internet</span>
    </div>
  );
};

export const PWAInstallModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  storeName: string;
  storeLogoUrl?: string;
  isIOS: boolean;
  isInstallable: boolean;
  onTriggerNativeInstall: () => Promise<void>;
}> = ({
  isOpen,
  onClose,
  storeName,
  storeLogoUrl,
  isIOS,
  isInstallable,
  onTriggerNativeInstall,
}) => {
  const [activeDeviceTab, setActiveDeviceTab] = useState<'android' | 'ios'>(
    isIOS ? 'ios' : 'android'
  );

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || typeof document === 'undefined') return null;

  const modalContent = (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 bg-stone-950/65 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-white rounded-2xl border border-rose-100 shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-rose-600 to-rose-500 px-4 sm:px-5 py-3.5 sm:py-4 text-white flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {storeLogoUrl ? (
              <img
                src={storeLogoUrl}
                alt={storeName}
                className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl object-cover border-2 border-white/80 bg-white shadow-sm shrink-0"
              />
            ) : (
              <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-white text-rose-600 font-serif-brand font-bold text-lg sm:text-xl flex items-center justify-center shadow-sm shrink-0">
                蒸
              </div>
            )}
            <div className="min-w-0">
              <h3 className="font-bold text-sm sm:text-base leading-tight truncate">
                Install Aplikasi {storeName}
              </h3>
              <p className="text-[11px] text-rose-100 mt-0.5 truncate">
                Akses cepat dari layar utama HP Anda
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup"
            className="p-1.5 rounded-full bg-white/15 hover:bg-white/25 text-white transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-5 space-y-3.5 text-xs text-stone-700 max-h-[75vh] overflow-y-auto">
          {/* Keunggulan Install */}
          <div className="grid grid-cols-3 gap-2 bg-rose-50/80 border border-rose-100 rounded-xl p-2.5 text-center">
            <div className="flex flex-col items-center gap-1">
              <CheckCircle2 className="w-4 h-4 text-rose-600" />
              <span className="text-[10px] font-semibold text-stone-700">1-Klik di HP</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <CheckCircle2 className="w-4 h-4 text-rose-600" />
              <span className="text-[10px] font-semibold text-stone-700">Hemat Kuota</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <CheckCircle2 className="w-4 h-4 text-rose-600" />
              <span className="text-[10px] font-semibold text-stone-700">Layar Penuh</span>
            </div>
          </div>

          {/* Direct Install Button if native prompt is ready */}
          {isInstallable && (
            <button
              type="button"
              onClick={onTriggerNativeInstall}
              className="w-full py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 active:scale-[0.99] text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md transition-all"
            >
              <Download className="w-4 h-4" />
              <span>Pasang Aplikasi Sekarang (Otomatis)</span>
            </button>
          )}

          {/* Device Selector Tabs */}
          <div>
            <div className="grid grid-cols-2 gap-1.5 p-1 bg-stone-100 rounded-xl mb-3">
              <button
                type="button"
                onClick={() => setActiveDeviceTab('android')}
                className={`py-2 px-3 rounded-lg text-xs font-bold transition-all ${
                  activeDeviceTab === 'android'
                    ? 'bg-white text-rose-600 shadow-2xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                HP Android (Chrome)
              </button>
              <button
                type="button"
                onClick={() => setActiveDeviceTab('ios')}
                className={`py-2 px-3 rounded-lg text-xs font-bold transition-all ${
                  activeDeviceTab === 'ios'
                    ? 'bg-white text-rose-600 shadow-2xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                iPhone / iPad (Safari)
              </button>
            </div>

            {activeDeviceTab === 'android' ? (
              <div className="space-y-2.5 bg-stone-50 border border-stone-200/80 rounded-xl p-3.5">
                <div className="font-bold text-stone-900 text-xs">
                  Cara Install di HP Android:
                </div>
                <ol className="space-y-2.5 text-[11px] text-stone-700 leading-relaxed">
                  <li className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-rose-100 text-rose-700 font-bold flex items-center justify-center shrink-0 text-[10px] mt-0.5">
                      1
                    </span>
                    <span>
                      Buka website ini di browser <strong>Google Chrome</strong> HP Anda.
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-rose-100 text-rose-700 font-bold flex items-center justify-center shrink-0 text-[10px] mt-0.5">
                      2
                    </span>
                    <span className="flex-1">
                      Ketuk ikon menu titik tiga{' '}
                      <span className="inline-flex items-center px-1 py-0.5 bg-stone-200 rounded text-stone-800 align-middle">
                        <MoreVertical className="w-3 h-3" />
                      </span>{' '}
                      di pojok kanan atas browser Chrome.
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-rose-100 text-rose-700 font-bold flex items-center justify-center shrink-0 text-[10px] mt-0.5">
                      3
                    </span>
                    <span>
                      Pilih menu <strong>&ldquo;Instal aplikasi&rdquo;</strong> atau{' '}
                      <strong>&ldquo;Tambahkan ke layar utama&rdquo;</strong> lalu konfirmasi{' '}
                      <strong>Instal</strong>.
                    </span>
                  </li>
                </ol>
              </div>
            ) : (
              <div className="space-y-2.5 bg-stone-50 border border-stone-200/80 rounded-xl p-3.5">
                <div className="font-bold text-stone-900 text-xs">
                  Cara Install di iPhone / iPad (Safari):
                </div>
                <ol className="space-y-2.5 text-[11px] text-stone-700 leading-relaxed">
                  <li className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-rose-100 text-rose-700 font-bold flex items-center justify-center shrink-0 text-[10px] mt-0.5">
                      1
                    </span>
                    <span>
                      Buka website ini menggunakan browser <strong>Safari</strong> di iPhone/iPad.
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-rose-100 text-rose-700 font-bold flex items-center justify-center shrink-0 text-[10px] mt-0.5">
                      2
                    </span>
                    <span className="flex-1">
                      Ketuk tombol <strong>Bagikan (Share)</strong>{' '}
                      <span className="inline-flex items-center px-1 py-0.5 bg-stone-200 rounded text-stone-800 align-middle">
                        <Share className="w-3 h-3" />
                      </span>{' '}
                      di bilah bawah layar Safari.
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-rose-100 text-rose-700 font-bold flex items-center justify-center shrink-0 text-[10px] mt-0.5">
                      3
                    </span>
                    <span className="flex-1">
                      Gulir ke bawah lalu pilih{' '}
                      <strong className="inline-flex items-center gap-1">
                        <PlusSquare className="w-3 h-3 text-rose-600" />
                        Tambah ke Layar Utama (Add to Home Screen)
                      </strong>{' '}
                      dan ketuk <strong>Tambah</strong>.
                    </span>
                  </li>
                </ol>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 sm:px-5 py-3 bg-stone-50 border-t border-stone-200/80 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition-colors shadow-2xs"
          >
            Mengerti
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};

export const PWAInstallBanner: React.FC<PWAInstallProps> = ({
  storeName = 'Ngdimsum',
  storeLogoUrl,
}) => {
  const { isInstallable, isInstalled, isIOS, promptInstall } = usePWAInstall();
  const [dismissed, setDismissed] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem('ngdimsum_pwa_banner_dismissed') === 'true';
    } catch {
      return false;
    }
  });
  const [isModalOpen, setIsModalOpen] = useState(false);

  if (isInstalled || dismissed) return null;

  const handleDismiss = () => {
    setDismissed(true);
    try {
      sessionStorage.setItem('ngdimsum_pwa_banner_dismissed', 'true');
    } catch {
      // ignore
    }
  };

  const handleBannerAction = async () => {
    if (isInstallable) {
      const outcome = await promptInstall();
      if (outcome === 'unavailable') {
        setIsModalOpen(true);
      }
    } else {
      setIsModalOpen(true);
    }
  };

  return (
    <>
      <div className="bg-gradient-to-r from-rose-900 via-rose-800 to-rose-900 text-white border-b border-rose-700/60 px-3 sm:px-4 py-2 print:hidden">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-white/15 border border-white/20 flex items-center justify-center shrink-0">
              <Download className="w-3.5 h-3.5 text-rose-200" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] sm:text-xs font-bold text-white truncate">
                Pasang Aplikasi {storeName} di HP Anda
              </p>
              <p className="text-[10px] text-rose-200 truncate">
                Pesan dimsum lebih cepat langsung dari layar utama HP
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={handleBannerAction}
              className="px-2.5 sm:px-3 py-1 rounded-lg bg-white text-rose-700 hover:bg-rose-50 font-bold text-[11px] shadow-2xs transition-all active:scale-95"
            >
              Install di HP
            </button>
            <button
              type="button"
              onClick={handleDismiss}
              aria-label="Tutup banner install"
              className="p-1 rounded-lg text-rose-200 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      <PWAInstallModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        storeName={storeName}
        storeLogoUrl={storeLogoUrl}
        isIOS={isIOS}
        isInstallable={isInstallable}
        onTriggerNativeInstall={async () => {
          const res = await promptInstall();
          if (res === 'accepted') {
            setIsModalOpen(false);
          }
        }}
      />
    </>
  );
};
