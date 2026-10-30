import React, { useState } from 'react';
import { MenuItem } from '../types';
import { Plus, Check, Clock, Utensils, Flame } from 'lucide-react';
import { formatCurrency } from '../services/whatsappService';
import { resolveDriveImageUrl } from '../services/googleSheetsService';

interface MenuCardProps {
  item: MenuItem;
  onAddToCart: (
    item: MenuItem,
    quantity: number,
    notes?: string,
    chiliLevel?: 'Normal' | 'Extra Pedas' | 'Pisah Sambal'
  ) => void;
}

export const MenuCard: React.FC<MenuCardProps> = ({ item, onAddToCart }) => {
  const [showOptionsModal, setShowOptionsModal] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [chiliLevel, setChiliLevel] = useState<'Normal' | 'Extra Pedas' | 'Pisah Sambal'>('Normal');
  const [notes, setNotes] = useState('');
  const [addedAnimation, setAddedAnimation] = useState(false);
  const [imageError, setImageError] = useState(false);

  const resolvedImg = resolveDriveImageUrl(item.image);

  const handleQuickAdd = () => {
    if (!item.inStock) return;
    onAddToCart(item, 1, '', 'Normal');
    setAddedAnimation(true);
    setTimeout(() => setAddedAnimation(false), 800);
  };

  const handleCustomAdd = () => {
    if (!item.inStock) return;
    onAddToCart(item, quantity, notes, chiliLevel);
    setShowOptionsModal(false);
    setAddedAnimation(true);
    setNotes('');
    setQuantity(1);
    setTimeout(() => setAddedAnimation(false), 800);
  };

  return (
    <>
      <div className={`group flex flex-col bg-white border border-rose-100/90 rounded-xl overflow-hidden hover:shadow-sm transition-all duration-200 ${item.inStock ? 'hover:-translate-y-0.5' : 'opacity-75'}`}>
        {/* Product Image Showcase (Compact) */}
        <div
          className="relative aspect-[16/11] w-full bg-rose-50/40 overflow-hidden cursor-pointer"
          onClick={() => item.inStock && setShowOptionsModal(true)}
        >
          {!imageError ? (
            <img
              src={resolvedImg}
              alt={item.name}
              referrerPolicy="no-referrer"
              onError={() => setImageError(true)}
              className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center p-3 bg-rose-50/60 text-stone-400">
              <Utensils className="w-6 h-6 mb-1 text-rose-300" />
              <span className="text-[11px] font-serif-brand font-medium text-stone-500 text-center line-clamp-1">{item.name}</span>
            </div>
          )}

          {/* Clean Tag */}
          {!item.inStock ? (
            <div className="absolute top-2 right-2 bg-stone-900/90 text-white text-[9px] font-bold px-2 py-0.5 rounded shadow-2xs">
              Habis
            </div>
          ) : item.isChefsPick ? (
            <div className="absolute top-2 right-2 bg-rose-600/90 text-white text-[9px] font-medium px-1.5 py-0.5 rounded shadow-2xs backdrop-blur-xs">
              Andalan
            </div>
          ) : item.isPopular ? (
            <div className="absolute top-2 right-2 bg-rose-500 text-white text-[9px] font-semibold px-1.5 py-0.5 rounded shadow-2xs">
              Favorit
            </div>
          ) : null}

          {/* Portion indicator */}
          <div className="absolute bottom-1.5 left-1.5 bg-stone-900/75 text-white text-[9px] font-mono px-1.5 py-0.5 rounded backdrop-blur-xs">
            {item.pieces}
          </div>
        </div>

        {/* Card Body (Compact & tidy) */}
        <div className="p-2.5 sm:p-3 flex-1 flex flex-col justify-between">
          <div>
            {/* Category & Prep Time */}
            <div className="flex items-center gap-1 text-[10px] text-stone-400 mb-0.5">
              <span className="uppercase tracking-wider font-semibold text-rose-600">
                {item.category === 'kukus' ? 'Kukus' : item.category === 'goreng' ? 'Goreng' : item.category === 'spesial' ? 'Mentai' : item.category}
              </span>
              <span aria-hidden="true">·</span>
              <span className="flex items-center gap-0.5">
                <Clock className="w-2.5 h-2.5 text-stone-400" />
                <span>{item.prepTimeMinutes}m</span>
              </span>
              {item.isSpicy && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="text-rose-600 flex items-center gap-0.5">
                    <Flame className="w-2.5 h-2.5 text-rose-500" />
                    <span>Pedas</span>
                  </span>
                </>
              )}
            </div>

            <h3
              onClick={() => item.inStock && setShowOptionsModal(true)}
              className="text-xs sm:text-sm font-semibold text-stone-900 hover:text-rose-600 transition-colors cursor-pointer line-clamp-1 mb-0.5"
              title={item.name}
            >
              {item.name}
            </h3>

            <p className="text-[11px] text-stone-500 line-clamp-1 sm:line-clamp-2 leading-relaxed mb-2">
              {item.description}
            </p>
          </div>

          {/* Price & Action Row */}
          <div className="flex items-center justify-between pt-2 border-t border-rose-50 gap-1">
            <div>
              <span className="text-xs sm:text-sm font-bold text-rose-950 font-mono tabular-nums tracking-tight">
                {formatCurrency(item.price)}
              </span>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              {item.inStock && (
                <button
                  type="button"
                  onClick={() => setShowOptionsModal(true)}
                  className="px-1.5 py-1 text-[10px] text-stone-500 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors hidden sm:inline-block"
                  title="Pilih sambal / catatan"
                >
                  Catatan
                </button>
              )}
              <button
                type="button"
                disabled={!item.inStock}
                onClick={handleQuickAdd}
                aria-label={`Tambah ${item.name} ke keranjang`}
                className={`flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg transition-all shadow-2xs active:scale-95 whitespace-nowrap ${
                  !item.inStock
                    ? 'bg-stone-200 text-stone-500 cursor-not-allowed'
                    : addedAnimation
                    ? 'bg-emerald-600 text-white'
                    : 'bg-rose-500 hover:bg-rose-600 text-white'
                }`}
              >
                {!item.inStock ? (
                  <span>Habis</span>
                ) : addedAnimation ? (
                  <>
                    <Check className="w-3 h-3" />
                    <span className="hidden sm:inline">Masuk</span>
                  </>
                ) : (
                  <>
                    <Plus className="w-3 h-3" />
                    <span>Pesan</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Modal Kustomisasi Dimsum */}
      {showOptionsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-sm sm:max-w-md w-full overflow-hidden shadow-2xl border border-rose-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="relative aspect-16/9 w-full bg-rose-50/50">
              <img
                src={item.image}
                alt={item.name}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
              <button
                onClick={() => setShowOptionsModal(false)}
                className="absolute top-3 right-3 w-7 h-7 rounded-full bg-stone-900/60 text-white flex items-center justify-center hover:bg-stone-900"
              >
                ✕
              </button>
            </div>

            <div className="p-4 sm:p-5 space-y-3.5">
              <div>
                <div className="text-[11px] text-rose-600 font-semibold uppercase tracking-wider mb-0.5">
                  Dapur Rumahan · {item.pieces}
                </div>
                <h3 className="text-base font-bold text-stone-900">{item.name}</h3>
                <p className="text-xs text-stone-500 mt-1">{item.description}</p>
                <div className="text-sm font-bold text-rose-950 font-mono tabular-nums mt-1.5">
                  {formatCurrency(item.price)} / porsi
                </div>
              </div>

              {/* Pilihan Level Sambal */}
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Pilihan Sambal Chili Oil Racikan:
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {(['Normal', 'Extra Pedas', 'Pisah Sambal'] as const).map((lvl) => (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => setChiliLevel(lvl)}
                      className={`py-1.5 px-2 text-xs font-medium rounded-lg border text-center transition-all ${
                        chiliLevel === lvl
                          ? 'border-rose-500 bg-rose-50 text-rose-800 font-bold'
                          : 'border-stone-200 text-stone-600 hover:bg-stone-50'
                      }`}
                    >
                      {lvl}
                    </button>
                  ))}
                </div>
              </div>

              {/* Catatan Khusus */}
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Catatan untuk Dapur (Opsional):
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Misal: Sambal minta banyakan, tanpa daun bawang..."
                  className="w-full px-3 py-1.5 text-xs border border-stone-200 rounded-lg focus:outline-none focus:border-rose-400"
                />
              </div>

              {/* Stepper & Total */}
              <div className="flex items-center justify-between pt-2 border-t border-rose-50">
                <div className="flex items-center gap-1.5 border border-stone-200 rounded-lg p-1 bg-stone-50">
                  <button
                    type="button"
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="w-6 h-6 rounded bg-white text-stone-700 font-bold hover:bg-stone-200 flex items-center justify-center text-xs"
                  >
                    -
                  </button>
                  <span className="w-6 text-center text-xs font-mono font-bold tabular-nums">
                    {quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => setQuantity(quantity + 1)}
                    className="w-6 h-6 rounded bg-white text-stone-700 font-bold hover:bg-stone-200 flex items-center justify-center text-xs"
                  >
                    +
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleCustomAdd}
                  className="flex-1 ml-3 py-2 px-3 bg-rose-500 hover:bg-rose-600 text-white font-bold text-xs rounded-xl shadow transition-colors flex items-center justify-center gap-1.5"
                >
                  <span>Tambah Pesanan</span>
                  <span className="font-mono tabular-nums">({formatCurrency(item.price * quantity)})</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
