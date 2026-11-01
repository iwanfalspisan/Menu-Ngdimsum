import React from 'react';
import { ShoppingBag, LogOut } from 'lucide-react';

interface NavbarProps {
  activeTab: 'menu' | 'admin';
  setActiveTab: (tab: 'menu' | 'admin') => void;
  cartCount: number;
  onOpenCart: () => void;
  isAdminLoggedIn: boolean;
  onAdminLogout: () => void;
  storeName?: string;
  storeLogoUrl?: string;
  tagline?: string;
  adminWhatsapp?: string;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  cartCount,
  onOpenCart,
  isAdminLoggedIn,
  onAdminLogout,
  storeName = 'Ngdimsum',
  storeLogoUrl,
  tagline,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-rose-100 text-stone-900 transition-all shadow-2xs">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-4">
        {/* Zone 1: Brand Logo, Wordmark & Editable Tagline */}
        <button
          onClick={() => setActiveTab('menu')}
          className="flex items-center gap-2.5 text-left group focus:outline-none min-w-0"
        >
          {storeLogoUrl ? (
            <img
              src={storeLogoUrl}
              alt={storeName}
              referrerPolicy="no-referrer"
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl object-cover border border-rose-200 bg-rose-50 group-hover:scale-105 transition-transform shrink-0 shadow-2xs"
            />
          ) : (
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-rose-100 border border-rose-200 flex items-center justify-center text-rose-600 font-serif-brand font-bold text-base group-hover:scale-105 transition-transform shrink-0">
              蒸
            </div>
          )}
          <div className="flex flex-col min-w-0">
            <span className="font-serif-brand text-base sm:text-lg font-bold tracking-tight text-rose-950 truncate leading-tight">
              {storeName}
            </span>
            {tagline && tagline.trim() !== '' && (
              <span className="text-[10px] sm:text-[11px] text-rose-600 font-medium truncate leading-tight">
                {tagline}
              </span>
            )}
          </div>
        </button>

        {/* Zone 2: Desktop Navigation links (Hidden on Mobile because Mobile uses App Bottom Nav) */}
        <nav className="hidden md:flex items-center gap-5 text-sm font-medium text-stone-600">
          <button
            onClick={() => setActiveTab('menu')}
            className={`transition-colors whitespace-nowrap shrink-0 hover:text-rose-600 py-1 ${
              activeTab === 'menu' ? 'text-rose-600 font-semibold border-b-2 border-rose-500' : ''
            }`}
          >
            Katalog Menu
          </button>

          {isAdminLoggedIn && (
            <div className="flex items-center gap-2 pl-3 border-l border-rose-200">
              <button
                onClick={() => setActiveTab('admin')}
                className={`text-xs px-2.5 py-1 rounded-md font-semibold transition-colors ${
                  activeTab === 'admin'
                    ? 'bg-rose-500 text-white'
                    : 'bg-rose-100 text-rose-800 hover:bg-rose-200'
                }`}
              >
                Dasbor Pemilik
              </button>
              <button
                onClick={onAdminLogout}
                title="Keluar dari sesi Admin"
                className="text-stone-400 hover:text-rose-600 p-1"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </nav>

        {/* Zone 3: Cart action */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onOpenCart}
            aria-label="Buka Keranjang Pesanan"
            className="relative flex items-center gap-2 px-3 sm:px-3.5 py-1.5 sm:py-2 text-xs font-semibold text-white bg-rose-500 hover:bg-rose-600 rounded-xl transition-all shadow-xs active:scale-95 whitespace-nowrap shrink-0"
          >
            <ShoppingBag className="w-4 h-4 text-white" />
            <span className="hidden sm:inline">Keranjang</span>
            <span className="tabular-nums font-mono bg-white text-rose-600 text-xs px-1.5 py-0.2 rounded-full font-bold">
              {cartCount}
            </span>
          </button>
        </div>
      </div>
    </header>
  );
};

