import React from 'react';
import { Search, Flame, ShieldCheck, HeartHandshake, ArrowDown, Sparkles } from 'lucide-react';

interface HeroProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  onExploreMenu: () => void;
  storeName?: string;
}

export const Hero: React.FC<HeroProps> = ({
  searchQuery,
  setSearchQuery,
  onExploreMenu,
  storeName = 'Ngdimsum',
}) => {
  return (
    <section className="relative bg-gradient-to-br from-stone-900 via-rose-950 to-stone-900 text-stone-100 overflow-hidden border-b border-rose-900/40">
      {/* Background Dimsum Atmosphere */}
      <div className="absolute inset-0 z-0 opacity-30">
        <img
          src="/src/assets/images/hero_dimsum_bamboo_steamers_1792773515491.jpg"
          alt={`${storeName} Segar Dibuat Fresh`}
          className="w-full h-full object-cover object-center"
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-stone-950 via-stone-950/80 to-rose-950/50" />
      </div>

      <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 py-14 sm:py-20">
        <div className="max-w-2xl">
          {/* Natural editorial kicker */}
          <div className="flex items-center gap-2 text-xs text-rose-300 font-medium tracking-wide uppercase mb-3">
            <span>{storeName}</span>
            <span aria-hidden="true">·</span>
            <span>Fresh Made by Order</span>
            <span aria-hidden="true">·</span>
            <span>100% Halal &amp; Higienis</span>
          </div>

          <h1 className="font-serif-brand text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-white text-balance leading-snug mb-4">
            {storeName}: Sensasi Dimsum Hangat Pilihan.
          </h1>

          <p className="text-sm sm:text-base text-rose-100/90 leading-relaxed mb-6">
            Pilihan dimsum kukus lembut dan goreng renyah buatan {storeName} dengan isian ayam &amp; udang melimpah. Cocok untuk santapan keluarga, camilan sore, atau stok frozen siap kukus.
          </p>

          {/* Practical Live Search & Filter Bar */}
          <div className="bg-stone-950/80 p-2 rounded-xl border border-rose-900/60 shadow-xl backdrop-blur-md flex flex-col sm:flex-row items-stretch sm:items-center gap-2 max-w-xl">
            <div className="flex-1 flex items-center gap-2.5 px-3 py-1.5 text-stone-300">
              <Search className="w-4 h-4 text-rose-400 shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari Siomay, Hakau, Pangsit Goreng, Mentai..."
                className="w-full bg-transparent text-xs sm:text-sm text-white placeholder-stone-400 focus:outline-none"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="text-xs text-stone-400 hover:text-white px-1.5 py-0.5 rounded bg-stone-800"
                >
                  Reset
                </button>
              )}
            </div>
            <button
              onClick={onExploreMenu}
              className="px-4 py-2 text-xs font-semibold text-white bg-rose-500 hover:bg-rose-600 rounded-lg transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 shadow-xs"
            >
              <span>Pilih Menu</span>
              <ArrowDown className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Homemade Trust Indicators */}
          <div className="flex flex-wrap items-center gap-y-2 gap-x-6 text-xs text-rose-200/80 mt-6 pt-5 border-t border-rose-900/40">
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-rose-400" />
              <span>Tanpa Pengawet Buatan</span>
            </div>
            <div className="flex items-center gap-1.5">
              <HeartHandshake className="w-3.5 h-3.5 text-rose-400" />
              <span>Resep Dapur Keluarga</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Flame className="w-3.5 h-3.5 text-rose-400" />
              <span>Gratis Chili Oil Racikan</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
