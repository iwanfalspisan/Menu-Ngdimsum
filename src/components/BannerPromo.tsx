import React from 'react';
import { DimsumCategory, StoreSettings } from '../types';
import { Sparkles, ArrowRight, Flame } from 'lucide-react';

interface BannerPromoProps {
  storeSettings: StoreSettings;
  onSelectCategory?: (category: DimsumCategory) => void;
}

export const BannerPromo: React.FC<BannerPromoProps> = ({
  storeSettings,
  onSelectCategory,
}) => {
  const isEnabled = storeSettings.promoEnabled !== false;
  const promoTitle =
    storeSettings.promoTitle ||
    'Dimsum Mentai Bakar Tobiko & Siomay Ayam Udang';
  const promoBadge = storeSettings.promoBadge || 'PROMO SPESIAL HARI INI';
  const promoDescription =
    storeSettings.promoDescription ||
    'Hangat baru dikukus dari dapur rumah, gratis Chili Oil khas Ngdimsum setiap pemesanan via WhatsApp!';
  const promoHighlightText =
    storeSettings.promoHighlightText || 'Mulai Rp 25.000';
  const promoImageUrl =
    storeSettings.promoImageUrl ||
    '/images/dimsum_mentai_special_1792773517652.jpg';
  const targetCat: DimsumCategory =
    storeSettings.promoCategoryTarget || 'spesial';

  if (!isEnabled || !promoTitle.trim()) {
    return null;
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-3 sm:pt-4">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-rose-900 via-rose-800 to-rose-700 text-white shadow-md border border-rose-700/60">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-5 p-4 sm:p-5">
          {/* Left: Promo Copy */}
          <div className="flex-1 space-y-1.5 z-10">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-amber-400 text-stone-950 text-[10px] font-extrabold uppercase tracking-wider shadow-2xs">
                <Flame className="w-3 h-3 fill-stone-950" />
                {promoBadge}
              </span>
              {promoHighlightText && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/15 backdrop-blur-xs text-rose-100 text-[11px] font-mono font-bold border border-white/20">
                  <Sparkles className="w-3 h-3 text-amber-300" />
                  {promoHighlightText}
                </span>
              )}
            </div>

            <h2 className="font-serif-brand text-base sm:text-xl font-bold text-white leading-snug">
              {promoTitle}
            </h2>

            {promoDescription && (
              <p className="text-xs text-rose-100/90 leading-relaxed max-w-xl line-clamp-2">
                {promoDescription}
              </p>
            )}

            {onSelectCategory && (
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => {
                    onSelectCategory(targetCat);
                    const el = document.getElementById('filter-kategori');
                    if (el) {
                      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white text-rose-900 hover:bg-rose-50 active:scale-95 text-xs font-bold shadow-xs transition-all"
                >
                  <span>Lihat Menu Spesial</span>
                  <ArrowRight className="w-3.5 h-3.5 text-rose-600" />
                </button>
              </div>
            )}
          </div>

          {/* Right: Promo Thumbnail Image */}
          {promoImageUrl && (
            <div className="sm:w-44 md:w-52 h-28 sm:h-28 rounded-xl overflow-hidden border-2 border-white/20 shadow-md shrink-0 bg-rose-950/40">
              <img
                src={promoImageUrl}
                alt={promoTitle}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
