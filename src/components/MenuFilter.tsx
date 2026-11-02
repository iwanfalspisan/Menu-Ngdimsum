import React, { useRef, useState } from 'react';
import { DimsumCategory, CategoryItem } from '../types';
import { DEFAULT_CATEGORIES } from '../data/dimsumMenu';
import { Flame, Star, Sparkles, SlidersHorizontal, ArrowUpDown, Search, X } from 'lucide-react';

interface MenuFilterProps {
  selectedCategory: DimsumCategory;
  setSelectedCategory: (cat: DimsumCategory) => void;
  tagFilter: string | null;
  setTagFilter: (tag: string | null) => void;
  sortBy: 'popular' | 'price_asc' | 'price_desc' | 'name_asc';
  setSortBy: (sort: 'popular' | 'price_asc' | 'price_desc' | 'name_asc') => void;
  totalFiltered: number;
  searchQuery?: string;
  setSearchQuery?: (q: string) => void;
  customCategories?: CategoryItem[];
}

export const MenuFilter: React.FC<MenuFilterProps> = ({
  selectedCategory,
  setSelectedCategory,
  tagFilter,
  setTagFilter,
  sortBy,
  setSortBy,
  totalFiltered,
  searchQuery,
  setSearchQuery,
  customCategories,
}) => {
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);

  const activeCategoryList =
    customCategories && customCategories.length > 0
      ? customCategories
      : DEFAULT_CATEGORIES;

  const categories: { id: DimsumCategory; label: string }[] = [
    { id: 'all', label: 'Semua Menu' },
    ...activeCategoryList,
  ];

  const tags = [
    { id: 'popular', label: 'Paling Laris', icon: Star },
    { id: 'chef', label: 'Rekomendasi', icon: Sparkles },
    { id: 'spicy', label: 'Pedas', icon: Flame },
  ];

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!scrollContainerRef.current) return;
    setIsDragging(true);
    setStartX(e.pageX - scrollContainerRef.current.offsetLeft);
    setScrollLeft(scrollContainerRef.current.scrollLeft);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging || !scrollContainerRef.current) return;
    e.preventDefault();
    const x = e.pageX - scrollContainerRef.current.offsetLeft;
    const walk = (x - startX) * 1.5;
    scrollContainerRef.current.scrollLeft = scrollLeft - walk;
  };

  const stopDragging = () => {
    setIsDragging(false);
  };

  return (
    <div className="space-y-3.5 mb-6">
      {/* Compact Search Bar */}
      {setSearchQuery && (
        <div className="relative">
          <Search className="w-4 h-4 text-rose-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery || ''}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari menu"
            className="w-full pl-10 pr-9 py-2 text-xs sm:text-sm bg-white border border-rose-200/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-400/50 text-stone-800 placeholder-stone-400 shadow-2xs transition-all"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 p-0.5 rounded-full hover:bg-stone-100"
              title="Hapus pencarian"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      {/* Primary Category Segmented Control (Swipeable horizontally on HP & Desktop) */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5 border-b border-rose-100 pb-3">
        <div className="relative w-full md:w-auto overflow-hidden">
          <div
            ref={scrollContainerRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={stopDragging}
            onMouseLeave={stopDragging}
            style={{ WebkitOverflowScrolling: 'touch' }}
            className="flex items-center gap-2 overflow-x-auto touch-pan-x overscroll-x-contain py-1 pr-6 scrollbar-none select-none cursor-grab active:cursor-grabbing"
          >
            {categories.map((cat) => {
              const isActive = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={(e) => {
                    setSelectedCategory(cat.id);
                    e.currentTarget.scrollIntoView({
                      behavior: 'smooth',
                      inline: 'center',
                      block: 'nearest',
                    });
                  }}
                  className={`px-3.5 py-2 text-xs font-semibold rounded-xl transition-all whitespace-nowrap shrink-0 snap-center ${
                    isActive
                      ? 'bg-rose-500 text-white font-bold shadow-xs'
                      : 'bg-white border border-rose-100 text-stone-600 hover:text-rose-600 hover:bg-rose-50/50'
                  }`}
                >
                  <span>{cat.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Sort selector & Count */}
        <div className="flex items-center justify-between md:justify-end gap-2.5 shrink-0">
          <span className="text-xs text-stone-500 tabular-nums">
            <strong className="text-stone-800 font-bold">{totalFiltered}</strong> menu tersedia
          </span>
          <div className="flex items-center gap-1 bg-white border border-rose-100 rounded-lg px-2 py-1 text-xs text-stone-700 shadow-2xs">
            <ArrowUpDown className="w-3 h-3 text-rose-400 shrink-0" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-transparent text-stone-700 text-xs focus:outline-none cursor-pointer"
            >
              <option value="popular">Paling Laris</option>
              <option value="price_asc">Harga: Termurah</option>
              <option value="price_desc">Harga: Tertinggi</option>
              <option value="name_asc">Nama: A - Z</option>
            </select>
          </div>
        </div>
      </div>

      {/* Secondary Quick Filter Toggles */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs font-medium text-stone-400 mr-1 flex items-center gap-1">
          <SlidersHorizontal className="w-3 h-3" />
          Filter:
        </span>
        {tags.map((t) => {
          const isSelected = tagFilter === t.id;
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setTagFilter(isSelected ? null : t.id)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 border ${
                isSelected
                  ? 'bg-rose-100 border-rose-300 text-rose-800 font-semibold shadow-2xs'
                  : 'bg-white border-rose-100 text-stone-600 hover:bg-rose-50/60 hover:text-stone-900'
              }`}
            >
              <Icon className={`w-3 h-3 ${isSelected ? 'text-rose-600' : 'text-stone-400'}`} />
              <span>{t.label}</span>
            </button>
          );
        })}

        {tagFilter && (
          <button
            onClick={() => setTagFilter(null)}
            className="text-xs text-rose-600 hover:text-rose-800 underline ml-2 whitespace-nowrap shrink-0"
          >
            Hapus Filter
          </button>
        )}
      </div>
    </div>
  );
};
