import React, { useState, useEffect } from 'react';
import { MenuItem, MenuReview, CategoryItem } from '../types';
import { DEFAULT_CATEGORIES, DEFAULT_SAMBAL_OPTIONS } from '../data/dimsumMenu';
import { Plus, Check, Clock, Utensils, Flame, Star, MessageSquarePlus, User, Send } from 'lucide-react';
import { formatCurrency } from '../services/whatsappService';
import { resolveDriveImageUrl } from '../services/googleSheetsService';

interface MenuCardProps {
  item: MenuItem;
  index?: number;
  reviews?: MenuReview[];
  customCategories?: CategoryItem[];
  sambalOptions?: string[];
  storeName?: string;
  onAddReview?: (
    menuItemId: string,
    rating: number,
    reviewerName: string,
    comment: string
  ) => void;
  onAddToCart: (
    item: MenuItem,
    quantity: number,
    notes?: string,
    chiliLevel?: string
  ) => void;
}

const RATING_LABELS: Record<number, string> = {
  1: 'Kurang Memuaskan',
  2: 'Cukup',
  3: 'Lumayan Enak',
  4: 'Enak & Segar',
  5: 'Sangat Enak & Juara!',
};

export const MenuCard: React.FC<MenuCardProps> = ({
  item,
  index = 0,
  reviews = [],
  customCategories,
  sambalOptions,
  storeName = 'Ngdimsum',
  onAddReview,
  onAddToCart,
}) => {
  const isDrinkCategory =
    item.category.toLowerCase().includes('minum') ||
    item.category.toLowerCase().includes('teh');

  const availableSambals = Array.isArray(item.sambalOptions)
    ? item.sambalOptions
    : isDrinkCategory || item.hasSambal === false
    ? []
    : sambalOptions && sambalOptions.length > 0
    ? sambalOptions
    : DEFAULT_SAMBAL_OPTIONS;

  const isDrinkItem =
    item.hasSambal === false || availableSambals.length === 0;

  const [showOptionsModal, setShowOptionsModal] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [chiliLevel, setChiliLevel] = useState<string>(
    isDrinkItem ? '' : availableSambals[0] || ''
  );
  const [notes, setNotes] = useState('');
  const [addedAnimation, setAddedAnimation] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  useEffect(() => {
    if (!isDrinkItem && (!chiliLevel || !availableSambals.includes(chiliLevel))) {
      setChiliLevel(availableSambals[0] || '');
    } else if (isDrinkItem && chiliLevel) {
      setChiliLevel('');
    }
  }, [availableSambals, isDrinkItem]);

  // Star rating & review states
  const [hoverStar, setHoverStar] = useState<number>(0);
  const [selectedRating, setSelectedRating] = useState<number>(5);
  const [reviewerName, setReviewerName] = useState('');
  const [reviewComment, setReviewComment] = useState('');
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);

  const resolvedImg = resolveDriveImageUrl(item.image);

  const categoryLabel = (() => {
    const list =
      customCategories && customCategories.length > 0
        ? customCategories
        : DEFAULT_CATEGORIES;
    const found = list.find((c) => c.id === item.category);
    if (found) return found.label;
    return item.category;
  })();

  // Calculate average rating & total reviews
  const totalReviews = reviews.length;
  const averageRating =
    totalReviews > 0
      ? Number((reviews.reduce((sum, r) => sum + r.rating, 0) / totalReviews).toFixed(1))
      : 5.0;

  const handleQuickAdd = () => {
    if (!item.inStock) return;
    onAddToCart(item, 1, '', isDrinkItem ? undefined : chiliLevel);
    setAddedAnimation(true);
    setTimeout(() => setAddedAnimation(false), 800);
  };

  const handleCustomAdd = () => {
    if (!item.inStock) return;
    onAddToCart(item, quantity, notes, isDrinkItem ? undefined : chiliLevel);
    setShowOptionsModal(false);
    setAddedAnimation(true);
    setNotes('');
    setQuantity(1);
    setTimeout(() => setAddedAnimation(false), 800);
  };

  const handleOpenReviewWithStar = (starValue: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedRating(starValue);
    setShowReviewModal(true);
  };

  const handleSubmitReview = (e: React.FormEvent) => {
    e.preventDefault();
    if (!onAddReview) return;
    setIsSubmittingReview(true);
    setTimeout(() => {
      onAddReview(
        item.id,
        selectedRating,
        reviewerName.trim() || 'Pembeli Ngdimsum',
        reviewComment.trim() || RATING_LABELS[selectedRating]
      );
      setReviewerName('');
      setReviewComment('');
      setIsSubmittingReview(false);
      setShowReviewModal(false);
    }, 280);
  };

  return (
    <>
      <div
        style={{ animationDelay: `${Math.min(index * 45, 360)}ms` }}
        className={`animate-fade-up group flex flex-col min-w-0 bg-white border border-rose-100/90 rounded-xl overflow-hidden hover:shadow-md hover:border-rose-200 transition-all duration-300 ease-out ${
          item.inStock ? 'hover:-translate-y-1' : 'opacity-75'
        }`}
      >
        {/* Product Image Showcase with Shimmer Skeleton Loading */}
        <div
          className="relative aspect-[16/11] w-full bg-rose-50/40 overflow-hidden cursor-pointer"
          onClick={() => item.inStock && setShowOptionsModal(true)}
        >
          {/* Loading Shimmer Placeholder */}
          {!imageLoaded && !imageError && (
            <div className="absolute inset-0 bg-gradient-to-r from-rose-50 via-rose-100/70 to-rose-50 animate-shimmer flex items-center justify-center">
              <Utensils className="w-5 h-5 text-rose-200 animate-pulse" />
            </div>
          )}

          {!imageError ? (
            <img
              src={resolvedImg}
              alt={item.name}
              referrerPolicy="no-referrer"
              onLoad={() => setImageLoaded(true)}
              onError={() => {
                setImageError(true);
                setImageLoaded(true);
              }}
              className={`w-full h-full object-cover object-center group-hover:scale-105 transition-all duration-500 ease-out ${
                imageLoaded ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
              }`}
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center p-3 bg-rose-50/60 text-stone-400">
              <Utensils className="w-6 h-6 mb-1 text-rose-300" />
              <span className="text-[11px] font-serif-brand font-medium text-stone-500 text-center line-clamp-1">
                {item.name}
              </span>
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
        <div className="p-2.5 sm:p-3 flex-1 flex flex-col justify-between min-w-0">
          <div className="min-w-0">
            {/* Category & Prep Time */}
            <div className="flex items-center gap-1 text-[9px] sm:text-[10px] text-stone-400 mb-0.5 min-w-0">
              <span className="uppercase tracking-wider font-semibold text-rose-600 truncate min-w-0">
                {categoryLabel}
              </span>
              <span aria-hidden="true" className="shrink-0">·</span>
              <span className="flex items-center gap-0.5 shrink-0">
                <Clock className="w-2.5 h-2.5 text-stone-400 shrink-0" />
                <span>{item.prepTimeMinutes}m</span>
              </span>
              {item.isSpicy && (
                <>
                  <span aria-hidden="true" className="hidden sm:inline shrink-0">·</span>
                  <span className="text-rose-600 hidden sm:flex items-center gap-0.5 shrink-0">
                    <Flame className="w-2.5 h-2.5 text-rose-500" />
                    <span>Pedas</span>
                  </span>
                </>
              )}
            </div>

            {/* Menu Name */}
            <h3
              onClick={() => item.inStock && setShowOptionsModal(true)}
              className="text-xs sm:text-sm font-semibold text-stone-900 hover:text-rose-600 transition-colors cursor-pointer line-clamp-1 mb-1"
              title={item.name}
            >
              {item.name}
            </h3>

            {/* Star Rating & Average Rating Row directly below Menu Name */}
            <div className="flex flex-wrap items-center justify-between gap-x-1 gap-y-0.5 mb-1.5 min-w-0">
              <div
                className="flex items-center gap-0.5 sm:gap-1 group/stars cursor-pointer min-w-0"
                onMouseLeave={() => setHoverStar(0)}
                onClick={(e) => handleOpenReviewWithStar(5, e)}
                title="Klik bintang untuk memberi rating & ulasan"
              >
                <div className="flex items-center gap-px sm:gap-0.5 shrink-0">
                  {[1, 2, 3, 4, 5].map((star) => {
                    const isFilled = hoverStar
                      ? star <= hoverStar
                      : star <= Math.round(averageRating);
                    return (
                      <button
                        key={star}
                        type="button"
                        onMouseEnter={() => setHoverStar(star)}
                        onClick={(e) => handleOpenReviewWithStar(star, e)}
                        aria-label={`Beri rating ${star} bintang untuk ${item.name}`}
                        className="p-0 sm:p-0.5 sm:-m-0.5 transition-transform duration-150 hover:scale-125 focus:outline-none"
                      >
                        <Star
                          className={`w-2.5 h-2.5 sm:w-3 sm:h-3 transition-colors duration-150 ${
                            isFilled
                              ? 'fill-amber-400 text-amber-400'
                              : 'fill-stone-100 text-stone-300'
                          }`}
                        />
                      </button>
                    );
                  })}
                </div>
                <span className="text-[10px] sm:text-[11px] font-bold text-stone-800 font-mono tabular-nums ml-0.5">
                  {averageRating.toFixed(1)}
                </span>
                <span className="text-[9px] sm:text-[10px] text-stone-400">
                  ({totalReviews})
                </span>
              </div>

              <button
                type="button"
                onClick={(e) => handleOpenReviewWithStar(5, e)}
                className="inline-flex items-center gap-0.5 text-[9px] sm:text-[10px] font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-1 sm:px-1.5 py-0.5 rounded transition-colors shrink-0"
              >
                <MessageSquarePlus className="w-2.5 h-2.5 shrink-0" />
                <span>Ulas</span>
              </button>
            </div>

            <p className="text-[10px] sm:text-[11px] text-stone-500 line-clamp-1 sm:line-clamp-2 leading-relaxed mb-2">
              {item.description}
            </p>

            {/* Pilihan Sambal Langsung di Kartu Menu */}
            {!isDrinkItem && item.inStock && (
              <div className="mb-2 min-w-0">
                <label className="block text-[9px] sm:text-[10px] font-semibold text-rose-800 mb-0.5 flex items-center gap-1">
                  <Flame className="w-2.5 h-2.5 text-rose-500 shrink-0" />
                  <span className="truncate">Pilihan Sambal:</span>
                </label>
                <select
                  value={chiliLevel}
                  onChange={(e) => setChiliLevel(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  className="w-full min-w-0 px-1.5 sm:px-2 py-1 text-[10px] sm:text-[11px] font-medium bg-rose-50/60 border border-rose-200 rounded-lg text-stone-800 focus:outline-none focus:border-rose-400 cursor-pointer truncate"
                >
                  {availableSambals.map((sambal, idx) => (
                    <option key={idx} value={sambal}>
                      {sambal}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Price & Action Row */}
          <div className="flex items-center justify-between pt-2 border-t border-rose-50 gap-1 min-w-0">
            <div className="min-w-0">
              <span className="text-[11px] sm:text-sm font-bold text-rose-950 font-mono tabular-nums tracking-tight whitespace-nowrap">
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
                className={`flex items-center gap-0.5 sm:gap-1 px-2 sm:px-2.5 py-1 text-[11px] sm:text-xs font-semibold rounded-lg transition-all duration-200 shadow-2xs active:scale-95 whitespace-nowrap ${
                  !item.inStock
                    ? 'bg-stone-200 text-stone-500 cursor-not-allowed'
                    : addedAnimation
                    ? 'bg-emerald-600 text-white scale-105'
                    : 'bg-rose-500 hover:bg-rose-600 text-white'
                }`}
              >
                {!item.inStock ? (
                  <span>Habis</span>
                ) : addedAnimation ? (
                  <>
                    <Check className="w-3 h-3 shrink-0" />
                    <span className="hidden sm:inline">Masuk</span>
                  </>
                ) : (
                  <>
                    <Plus className="w-3 h-3 shrink-0" />
                    <span>Pesan</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Modal Ulasan & Rating Bintang */}
      {showReviewModal && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-4 bg-stone-950/60 backdrop-blur-xs animate-fade-smooth"
          onClick={() => setShowReviewModal(false)}
        >
          <div
            className="bg-white rounded-2xl max-w-sm sm:max-w-md w-full max-h-[90dvh] flex flex-col overflow-hidden shadow-2xl border border-rose-100 animate-fade-up"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-3.5 sm:p-4 bg-gradient-to-r from-rose-50 via-white to-amber-50/50 border-b border-rose-100 flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <img
                  src={resolvedImg}
                  alt={item.name}
                  referrerPolicy="no-referrer"
                  className="w-11 h-11 rounded-xl object-cover border border-rose-200 shrink-0"
                />
                <div className="min-w-0">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-rose-600">
                    Rating &amp; Ulasan Pembeli
                  </div>
                  <h3 className="text-sm font-bold text-stone-900 truncate">{item.name}</h3>
                  <div className="flex items-center gap-1 text-xs text-stone-600 mt-0.5">
                    <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                    <span className="font-bold font-mono">{averageRating.toFixed(1)}</span>
                    <span className="text-stone-400 text-[11px]">
                      dari {totalReviews} ulasan
                    </span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowReviewModal(false)}
                className="w-7 h-7 rounded-full bg-stone-100 text-stone-500 hover:bg-stone-200 hover:text-stone-800 flex items-center justify-center text-xs transition-colors shrink-0"
              >
                ✕
              </button>
            </div>

            <div className="p-3.5 sm:p-5 space-y-4 flex-1 overflow-y-auto overscroll-contain">
              {/* Form Beri Rating */}
              <form onSubmit={handleSubmitReview} className="space-y-3 bg-rose-50/40 p-3.5 rounded-xl border border-rose-100">
                <div className="text-center">
                  <label className="block text-xs font-bold text-stone-800 mb-1.5">
                    Berikan Rating Bintang Anda:
                  </label>
                  <div className="flex items-center justify-center gap-2 my-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setSelectedRating(star)}
                        className="p-1 transition-transform duration-200 hover:scale-125 active:scale-95 focus:outline-none"
                      >
                        <Star
                          className={`w-7 h-7 transition-all duration-200 ${
                            star <= selectedRating
                              ? 'fill-amber-400 text-amber-400 drop-shadow-2xs animate-star-pop'
                              : 'fill-white text-stone-300 hover:text-amber-300'
                          }`}
                        />
                      </button>
                    ))}
                  </div>
                  <div className="text-[11px] font-semibold text-amber-700">
                    {RATING_LABELS[selectedRating]} ({selectedRating}/5)
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-semibold text-stone-700 mb-1">
                      Nama Anda (Opsional)
                    </label>
                    <div className="relative">
                      <User className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-2.5" />
                      <input
                        type="text"
                        value={reviewerName}
                        onChange={(e) => setReviewerName(e.target.value)}
                        placeholder="Contoh: Budi / Pembeli Ngdimsum"
                        maxLength={40}
                        className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-stone-200 rounded-lg focus:outline-none focus:border-rose-400 transition-colors"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-stone-700 mb-1">
                      Ulasan Menu Ini (Opsional)
                    </label>
                    <textarea
                      rows={2}
                      value={reviewComment}
                      onChange={(e) => setReviewComment(e.target.value)}
                      placeholder="Bagaimana rasa dimsum & chili oilnya? Tulis ulasan singkat..."
                      maxLength={200}
                      className="w-full px-3 py-1.5 text-xs bg-white border border-stone-200 rounded-lg focus:outline-none focus:border-rose-400 transition-colors resize-none"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmittingReview}
                  className="w-full py-2 px-3 bg-rose-500 hover:bg-rose-600 disabled:bg-rose-300 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5 active:scale-98"
                >
                  {isSubmittingReview ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Mengirim Ulasan...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      <span>Kirim Rating &amp; Ulasan</span>
                    </>
                  )}
                </button>
              </form>

              {/* Daftar Ulasan Pembeli */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-bold text-stone-800">
                    Ulasan Pembeli ({totalReviews})
                  </h4>
                </div>

                {reviews.length === 0 ? (
                  <div className="text-center py-4 text-xs text-stone-400 bg-stone-50 rounded-xl border border-stone-100">
                    Belum ada ulasan tertulis. Jadilah yang pertama mengulas menu ini!
                  </div>
                ) : (
                  <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
                    {reviews.map((rev) => (
                      <div
                        key={rev.id}
                        className="p-2.5 rounded-xl bg-stone-50/80 border border-stone-200/70 text-xs space-y-1"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-stone-800 truncate">
                            {rev.reviewerName}
                          </span>
                          <div className="flex items-center gap-0.5 shrink-0">
                            {[1, 2, 3, 4, 5].map((st) => (
                              <Star
                                key={st}
                                className={`w-3 h-3 ${
                                  st <= rev.rating
                                    ? 'fill-amber-400 text-amber-400'
                                    : 'fill-stone-200 text-stone-300'
                                }`}
                              />
                            ))}
                          </div>
                        </div>
                        {rev.comment && (
                          <p className="text-[11px] text-stone-600 leading-relaxed">
                            "{rev.comment}"
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Kustomisasi Dimsum */}
      {showOptionsModal && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-4 bg-stone-950/60 backdrop-blur-xs animate-fade-smooth"
          onClick={() => setShowOptionsModal(false)}
        >
          <div
            className="bg-white rounded-2xl max-w-sm sm:max-w-md w-full max-h-[90dvh] overflow-y-auto overscroll-contain shadow-2xl border border-rose-100 animate-fade-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative w-full bg-rose-50/50">
              <img
                src={resolvedImg}
                alt={item.name}
                referrerPolicy="no-referrer"
                className="w-full h-auto block object-cover"
              />
              <button
                onClick={() => setShowOptionsModal(false)}
                className="absolute top-3 right-3 w-7 h-7 rounded-full bg-stone-900/60 text-white flex items-center justify-center hover:bg-stone-900 transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="p-4 sm:p-5 space-y-3.5">
              <div>
                <div className="text-[11px] text-rose-600 font-semibold uppercase tracking-wider mb-0.5">
                  {storeName} · {item.pieces}
                </div>
                <h3 className="text-base font-bold text-stone-900">{item.name}</h3>
                {/* Average rating inside detail modal as well */}
                <div className="flex items-center gap-1.5 mt-1">
                  <div className="flex items-center gap-0.5">
                    {[1, 2, 3, 4, 5].map((st) => (
                      <Star
                        key={st}
                        className={`w-3.5 h-3.5 ${
                          st <= Math.round(averageRating)
                            ? 'fill-amber-400 text-amber-400'
                            : 'fill-stone-100 text-stone-300'
                        }`}
                      />
                    ))}
                  </div>
                  <span className="text-xs font-bold font-mono text-stone-800">
                    {averageRating.toFixed(1)}
                  </span>
                  <span className="text-[11px] text-stone-400">
                    ({totalReviews} ulasan)
                  </span>
                </div>
                <p className="text-xs text-stone-500 mt-1.5">{item.description}</p>
                <div className="text-sm font-bold text-rose-950 font-mono tabular-nums mt-1.5">
                  {formatCurrency(item.price)} / porsi
                </div>
              </div>

              {/* Pilihan Sambal di Modal Detail Menu */}
              {!isDrinkItem && (
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1.5 flex items-center gap-1">
                    <Flame className="w-3.5 h-3.5 text-rose-500" />
                    <span>Pilih Sambal Favorit Anda:</span>
                  </label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {availableSambals.map((sambal, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setChiliLevel(sambal)}
                        className={`py-1.5 px-2.5 text-xs font-medium rounded-lg border text-left transition-all truncate ${
                          chiliLevel === sambal
                            ? 'border-rose-500 bg-rose-50 text-rose-800 font-bold shadow-2xs'
                            : 'border-stone-200 text-stone-600 hover:bg-stone-50'
                        }`}
                      >
                        🌶️ {sambal}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Catatan Khusus */}
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Catatan untuk {storeName} (Opsional):
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
                    className="w-6 h-6 rounded bg-white text-stone-700 font-bold hover:bg-stone-200 flex items-center justify-center text-xs transition-colors"
                  >
                    -
                  </button>
                  <span className="w-6 text-center text-xs font-mono font-bold tabular-nums">
                    {quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => setQuantity(quantity + 1)}
                    className="w-6 h-6 rounded bg-white text-stone-700 font-bold hover:bg-stone-200 flex items-center justify-center text-xs transition-colors"
                  >
                    +
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleCustomAdd}
                  className="flex-1 ml-3 py-2 px-3 bg-rose-500 hover:bg-rose-600 text-white font-bold text-xs rounded-xl shadow transition-all flex items-center justify-center gap-1.5 active:scale-98"
                >
                  <span>Tambah Pesanan</span>
                  <span className="font-mono tabular-nums">
                    ({formatCurrency(item.price * quantity)})
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
