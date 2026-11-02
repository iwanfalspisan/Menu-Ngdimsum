import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  MenuItem,
  CartItem,
  Order,
  DimsumCategory,
  OrderStatus,
  GoogleSheetConfig,
  StoreSettings,
  MenuReview,
} from './types';
import {
  INITIAL_MENU,
  DEFAULT_STORE_SETTINGS,
  INITIAL_REVIEWS,
  DEFAULT_CATEGORIES,
  DEFAULT_SAMBAL_OPTIONS,
} from './data/dimsumMenu';
import {
  loadOrdersFromStorage,
  saveOrdersToStorage,
  loadGoogleSheetConfig,
  saveGoogleSheetConfig,
  syncOrderToGoogleAppsScript,
  fetchTwoWaySyncFromSheet,
  syncMenuToGoogleSheet,
  upsertMenuItemToSheet,
  deleteMenuItemFromSheet,
  syncSettingsToGoogleSheet,
  isRealAppsScriptUrl,
  markLocalMutation,
  flushPendingOrdersQueue,
  resetAllOrdersStorage,
  deleteSingleOrderStorage,
  deduplicateOrdersList,
  getCanonicalOrderBaseId,
} from './services/googleSheetsService';
import { formatCurrency } from './services/whatsappService';
import { Navbar } from './components/Navbar';
import { BannerPromo } from './components/BannerPromo';
import { MenuFilter } from './components/MenuFilter';
import { MenuCard } from './components/MenuCard';
import { CartDrawer } from './components/CartDrawer';
import { CheckoutModal } from './components/CheckoutModal';
import { AdminDashboard } from './components/AdminDashboard';
import { AdminLoginModal } from './components/AdminLoginModal';
import { GoogleSheetsModal } from './components/GoogleSheetsModal';
import { ReceiptModal } from './components/ReceiptModal';
import { NotificationToast, ToastMessage } from './components/NotificationToast';
import { OfflineIndicator, PWAInstallBanner } from './components/PWAInstallPrompt';
import {
  Clock,
  Phone,
  MapPin,
  UtensilsCrossed,
  Lock,
  MessageCircle,
  ShoppingBag,
  ArrowRight,
  Settings,
} from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<'menu' | 'admin'>('menu');
  // Menu Items backed by localStorage & 2-way Google Sheet
  const [menuItems, setMenuItems] = useState<MenuItem[]>(() => {
    try {
      const saved = localStorage.getItem('ngdimsum_menu_items_v1');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error(e);
    }
    return INITIAL_MENU;
  });

  const [cart, setCart] = useState<CartItem[]>([]);
  // Mulai dengan daftar transaksi kosong (0 transaksi) sampai ada pesanan asli masuk
  const [orders, setOrders] = useState<Order[]>(() => loadOrdersFromStorage());

  // Reviews & Star Ratings per Menu Item (persisted in localStorage)
  const [reviews, setReviews] = useState<MenuReview[]>(() => {
    try {
      const saved = localStorage.getItem('ngdimsum_menu_reviews_v1');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error(e);
    }
    return INITIAL_REVIEWS;
  });

  // Loading animation state for initial load & category transitions
  const [isMenuLoading, setIsMenuLoading] = useState<boolean>(true);

  useEffect(() => {
    const timer = setTimeout(() => setIsMenuLoading(false), 420);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('ngdimsum_menu_reviews_v1', JSON.stringify(reviews));
    } catch (e) {
      console.error(e);
    }
  }, [reviews]);

  const handleAddReview = (
    menuItemId: string,
    rating: number,
    reviewerName: string,
    comment: string
  ) => {
    const targetMenu = menuItems.find((m) => m.id === menuItemId);
    const newReview: MenuReview = {
      id: `rev-${Date.now()}`,
      menuItemId,
      reviewerName,
      rating,
      comment,
      createdAt: new Date().toISOString(),
    };
    setReviews((prev) => [newReview, ...prev]);
    setToast({
      id: Date.now().toString(),
      title: 'Ulasan Terkirim!',
      message: `Terima kasih atas rating ★${rating} untuk ${targetMenu?.name || 'menu ini'}.`,
    });
  };

  // Admin authentication state (hidden login for owner only; customers NEVER need login)
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState<boolean>(() => {
    return sessionStorage.getItem('dimsum_admin_auth') === 'true';
  });
  const [isAdminLoginModalOpen, setIsAdminLoginModalOpen] = useState(false);

  const [googleSheetConfig, setGoogleSheetConfig] = useState<GoogleSheetConfig>(() =>
    loadGoogleSheetConfig()
  );

  // Store Settings (Ongkir, info toko) backed by localStorage & 2-way Google Sheet
  const [storeSettings, setStoreSettings] = useState<StoreSettings>(() => {
    try {
      const saved = localStorage.getItem('ngdimsum_store_settings_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (
          parsed.storeLat === undefined ||
          parsed.storeLng === undefined ||
          parsed.storeLat === 0 ||
          parsed.storeLng === 0
        ) {
          parsed.storeLat = DEFAULT_STORE_SETTINGS.storeLat;
          parsed.storeLng = DEFAULT_STORE_SETTINGS.storeLng;
        }
        // Bersihkan teks alamat template bawaan lama jika masih ada, tanpa memaksa alamat default baru
        if (
          typeof parsed.storeAddress === 'string' &&
          (parsed.storeAddress.includes('Kelapa Gading, Jakarta Utara') ||
            parsed.storeAddress === 'Sindangkasih, Ciamis, Jawa Barat')
        ) {
          parsed.storeAddress = '';
        }
        // Cek simpanan manual koordinat & alamat toko terbaru dari Pengaturan Admin
        const manualSaved = localStorage.getItem('ngdimsum_manual_store_coords_v1');
        if (manualSaved) {
          const manualCoord = JSON.parse(manualSaved);
          if (
            typeof manualCoord.lat === 'number' &&
            typeof manualCoord.lng === 'number' &&
            manualCoord.lat !== 0 &&
            manualCoord.lng !== 0
          ) {
            parsed.storeLat = manualCoord.lat;
            parsed.storeLng = manualCoord.lng;
          }
          if (typeof manualCoord.address === 'string') {
            parsed.storeAddress = manualCoord.address;
          }
        }
        if (!Array.isArray(parsed.categories) || parsed.categories.length === 0) {
          parsed.categories = DEFAULT_CATEGORIES;
        }
        if (!Array.isArray(parsed.sambalOptions) || parsed.sambalOptions.length === 0) {
          parsed.sambalOptions = DEFAULT_SAMBAL_OPTIONS;
        }
        const activeBrandName = parsed.storeName || 'Ngdimsum';
        if (typeof parsed.tagline === 'string') {
          parsed.tagline = parsed.tagline
            .replace(/dapur rumahan|dapur rumah/gi, activeBrandName)
            .replace(/Dimsum Rumahan/gi, activeBrandName);
        }
        if (typeof parsed.promoDescription === 'string') {
          parsed.promoDescription = parsed.promoDescription
            .replace(/dapur rumahan|dapur rumah/gi, activeBrandName)
            .replace(/dimsum rumahan/gi, activeBrandName);
        }
        return parsed;
      }
    } catch (e) {
      console.error(e);
    }
    return {
      ...DEFAULT_STORE_SETTINGS,
      storeName: 'Ngdimsum',
      tagline: 'Dimsum Fresh Dibuat dari Hati',
    };
  });

  // Persist menuItems to localStorage on change
  useEffect(() => {
    try {
      localStorage.setItem('ngdimsum_menu_items_v1', JSON.stringify(menuItems));
    } catch (e) {
      console.error(e);
    }
  }, [menuItems]);

  // Persist storeSettings to localStorage & update browser favicon when logo changes
  useEffect(() => {
    try {
      localStorage.setItem('ngdimsum_store_settings_v1', JSON.stringify(storeSettings));
      if (storeSettings.storeName) {
        document.title = storeSettings.tagline
          ? `${storeSettings.storeName} - ${storeSettings.tagline}`
          : storeSettings.storeName;
      }
      if (storeSettings.storeLogoUrl) {
        let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement | null;
        if (!link) {
          link = document.createElement('link');
          link.rel = 'icon';
          document.head.appendChild(link);
        }
        link.href = storeSettings.storeLogoUrl;
      }
    } catch (e) {
      console.error(e);
    }
  }, [storeSettings]);

  // ============================================================================
  // BACKGROUND 2-WAY SYNC ENGINE (GOOGLE SHEETS & DRIVE <-> WEBSITE)
  // ============================================================================
  const runBackgroundTwoWaySync = useCallback(async () => {
    if (!googleSheetConfig.autoSync || !isRealAppsScriptUrl(googleSheetConfig.webAppUrl)) {
      return;
    }

    // Pastikan antrean pesanan lokal yang belum terkirim dikirim lebih dulu sebelum tarik data
    const flushedIds = await flushPendingOrdersQueue(googleSheetConfig);
    if (flushedIds.length > 0) {
      setOrders((prev) =>
        prev.map((o) => (flushedIds.includes(o.id) ? { ...o, syncedToGoogleSheet: true } : o))
      );
    }

    const syncRes = await fetchTwoWaySyncFromSheet(googleSheetConfig);
    if (!syncRes.success) return;

    // Auto-save generated Spreadsheet URL if Apps Script created one and none was set
    if (
      syncRes.spreadsheetUrl &&
      (!googleSheetConfig.spreadsheetUrl ||
        googleSheetConfig.spreadsheetUrl.includes('1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms'))
    ) {
      setGoogleSheetConfig((prev) => {
        const updated = {
          ...prev,
          spreadsheetUrl: syncRes.spreadsheetUrl || prev.spreadsheetUrl,
        };
        saveGoogleSheetConfig(updated);
        return updated;
      });
    }

    // 1. Sync Menu 2-Way (Sheet <-> Website)
    if (syncRes.menu && syncRes.menu.length > 0) {
      setMenuItems(syncRes.menu);
    } else if (syncRes.menu && syncRes.menu.length === 0) {
      // Seed initial menu into empty Google Sheet MENU_KATALOG tab
      syncMenuToGoogleSheet(menuItems, googleSheetConfig);
    }

    // 2. Sync Orders 2-Way (Sheet <-> Website)
    if (syncRes.orders && syncRes.orders.length > 0) {
      setOrders((prevOrders) => {
        const sheetMap = new Map(
          syncRes.orders!.map((o) => [getCanonicalOrderBaseId(o.id), o])
        );
        const merged = prevOrders.map((localOrder) => {
          const baseId = getCanonicalOrderBaseId(localOrder.id);
          const remote = sheetMap.get(baseId);
          if (remote) {
            sheetMap.delete(baseId);
            return {
              ...localOrder,
              id: baseId,
              status: remote.status || localOrder.status,
              syncedToGoogleSheet: true,
            };
          }
          return localOrder;
        });
        const newFromSheet = Array.from(sheetMap.values()).filter(
          (o) => o.items && o.items.length > 0
        );
        return deduplicateOrdersList([...newFromSheet, ...merged], googleSheetConfig);
      });
    }

    // 3. Sync Store Settings 2-Way (Sheet <-> Website)
    if (syncRes.settings && Object.keys(syncRes.settings).length > 0) {
      setStoreSettings((prev) => ({
        ...prev,
        ...syncRes.settings,
      }));
    } else if (syncRes.settings && Object.keys(syncRes.settings).length === 0) {
      // Seed initial store settings into empty Google Sheet PENGATURAN_TOKO tab
      syncSettingsToGoogleSheet(storeSettings, googleSheetConfig);
    }
  }, [googleSheetConfig, menuItems, storeSettings]);

  useEffect(() => {
    runBackgroundTwoWaySync();
    const intervalMs = (googleSheetConfig.syncIntervalSeconds || 5) * 1000;
    const timer = setInterval(() => {
      runBackgroundTwoWaySync();
    }, intervalMs);

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        runBackgroundTwoWaySync();
      }
    };
    window.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearInterval(timer);
      window.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [runBackgroundTwoWaySync, googleSheetConfig.syncIntervalSeconds]);

  // Handlers for menu management (with INSTANT single-row 2-way push to Google Sheet)
  const handleAddMenuItem = (newItem: MenuItem) => {
    setMenuItems((prev) => [newItem, ...prev]);
    upsertMenuItemToSheet(newItem, googleSheetConfig);
    setToast({
      id: Date.now().toString(),
      title: 'Menu Ditambahkan & Disinkronkan',
      message: `"${newItem.name}" langsung tersimpan di Google Sheet.`,
    });
  };

  const handleUpdateMenuItem = (updatedItem: MenuItem) => {
    setMenuItems((prev) =>
      prev.map((it) => (it.id === updatedItem.id ? updatedItem : it))
    );
    upsertMenuItemToSheet(updatedItem, googleSheetConfig);
    setToast({
      id: Date.now().toString(),
      title: 'Menu Diperbarui',
      message: `Perubahan "${updatedItem.name}" langsung diperbarui di Google Sheet.`,
    });
  };

  const handleDeleteMenuItem = (itemId: string) => {
    setMenuItems((prev) => prev.filter((it) => it.id !== itemId));
    deleteMenuItemFromSheet(itemId, googleSheetConfig);
    setToast({
      id: Date.now().toString(),
      title: 'Menu Dihapus',
      message: 'Menu langsung dihapus dari katalog & Google Sheet.',
    });
  };

  const handleToggleItemStock = (itemId: string) => {
    setMenuItems((prev) =>
      prev.map((it) => {
        if (it.id === itemId) {
          const updated = { ...it, inStock: !it.inStock };
          upsertMenuItemToSheet(updated, googleSheetConfig);
          return updated;
        }
        return it;
      })
    );
  };

  const handleUpdateStoreSettings = (newSettings: StoreSettings) => {
    try {
      if (
        typeof newSettings.storeLat === 'number' &&
        typeof newSettings.storeLng === 'number' &&
        newSettings.storeLat !== 0 &&
        newSettings.storeLng !== 0
      ) {
        localStorage.setItem(
          'ngdimsum_manual_store_coords_v1',
          JSON.stringify({
            lat: newSettings.storeLat,
            lng: newSettings.storeLng,
            address: newSettings.storeAddress || '',
            synced: false,
            updatedAt: Date.now(),
          })
        );
      }
    } catch (e) {}
    setStoreSettings(newSettings);
    syncSettingsToGoogleSheet(newSettings, googleSheetConfig);
    setToast({
      id: Date.now().toString(),
      title: 'Pengaturan disimpan',
      message: '',
    });
  };

  // Filter & Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<DimsumCategory>('all');
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'popular' | 'price_asc' | 'price_desc' | 'name_asc'>('popular');

  // Modals
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isWaBtnAnimating, setIsWaBtnAnimating] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isGoogleSheetModalOpen, setIsGoogleSheetModalOpen] = useState(false);
  const [receiptOrder, setReceiptOrder] = useState<Order | null>(null);
  const [soundAlertsEnabled, setSoundAlertsEnabled] = useState(true);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const handleQuickWaCheckoutClick = () => {
    setIsWaBtnAnimating(true);
    setTimeout(() => {
      setIsCartOpen(true);
    }, 210);
    setTimeout(() => {
      setIsWaBtnAnimating(false);
    }, 450);
  };

  // Hidden admin access shortcut listener (Alt + A, or URL hash #admin)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.altKey && (e.key === 'a' || e.key === 'A')) || (e.ctrlKey && e.shiftKey && (e.key === 'a' || e.key === 'A'))) {
        e.preventDefault();
        if (isAdminLoggedIn) {
          setActiveTab('admin');
        } else {
          setIsAdminLoginModalOpen(true);
        }
      }
    };

    if (window.location.hash === '#admin') {
      if (isAdminLoggedIn) {
        setActiveTab('admin');
      } else {
        setIsAdminLoginModalOpen(true);
      }
      window.history.replaceState(null, '', window.location.pathname);
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAdminLoggedIn]);

  // Save orders to localStorage on change
  useEffect(() => {
    saveOrdersToStorage(orders);
  }, [orders]);

  // Save Google Sheets config
  const handleSaveGoogleSheetConfig = (newConfig: GoogleSheetConfig) => {
    setGoogleSheetConfig(newConfig);
    saveGoogleSheetConfig(newConfig);
    setToast({
      id: Date.now().toString(),
      title: 'Konfigurasi 2 Arah Disimpan',
      message: 'Link Google Sheet, Drive, dan Apps Script berjalan di latar belakang.',
    });
  };

  const handleAdminLoginSuccess = () => {
    setIsAdminLoggedIn(true);
    sessionStorage.setItem('dimsum_admin_auth', 'true');
    setIsAdminLoginModalOpen(false);
    setActiveTab('admin');
    setToast({
      id: Date.now().toString(),
      title: 'Login Berhasil',
      message: 'Selamat datang di Dasbor Dapur Pengelola.',
    });
  };

  const handleAdminLogout = () => {
    setIsAdminLoggedIn(false);
    sessionStorage.removeItem('dimsum_admin_auth');
    setActiveTab('menu');
    setToast({
      id: Date.now().toString(),
      title: 'Sesi Ditutup',
      message: 'Anda telah keluar dari dasbor admin.',
    });
  };

  // Add to cart handler (No Login Required)
  const handleAddToCart = (
    item: MenuItem,
    quantity: number,
    notes?: string,
    chiliLevel?: string
  ) => {
    setCart((prev) => {
      const existingIdx = prev.findIndex(
        (c) =>
          c.menuItem.id === item.id &&
          c.notes === notes &&
          c.chiliLevel === chiliLevel
      );
      if (existingIdx > -1) {
        const next = [...prev];
        next[existingIdx].quantity += quantity;
        return next;
      }
      return [...prev, { menuItem: item, quantity, notes, chiliLevel }];
    });

    setToast({
      id: Date.now().toString(),
      title: 'Masuk Keranjang',
      message: `${quantity}x ${item.name}${chiliLevel ? ` (${chiliLevel})` : ''} berhasil ditambahkan.`,
    });
  };

  const handleUpdateCartQuantity = (index: number, newQty: number) => {
    if (newQty <= 0) {
      handleRemoveCartItem(index);
      return;
    }
    setCart((prev) => {
      const next = [...prev];
      next[index].quantity = newQty;
      return next;
    });
  };

  const handleUpdateCartItemSambal = (index: number, newSambal: string) => {
    setCart((prev) => {
      const next = [...prev];
      if (next[index]) {
        next[index] = { ...next[index], chiliLevel: newSambal };
      }
      return next;
    });
  };

  const handleRemoveCartItem = (index: number) => {
    setCart((prev) => prev.filter((_, i) => i !== index));
  };

  const handleOrderCreated = async (newOrder: Order) => {
    const cleanId = getCanonicalOrderBaseId(newOrder.id);
    const normalizedOrder: Order = { ...newOrder, id: cleanId };
    setOrders((prev) => deduplicateOrdersList([normalizedOrder, ...prev], googleSheetConfig));
    setCart([]);
    setIsCartOpen(false);
    setIsCheckoutOpen(false);

    // Background 2-way sync to Google Sheets without showing any order-processing notification
    if (googleSheetConfig.autoSync && googleSheetConfig.webAppUrl) {
      const syncResult = await syncOrderToGoogleAppsScript(normalizedOrder, googleSheetConfig);
      if (syncResult.success) {
        setOrders((prev) =>
          prev.map((o) =>
            getCanonicalOrderBaseId(o.id) === cleanId
              ? { ...o, syncedToGoogleSheet: true }
              : o
          )
        );
      }
    }
  };

  const handleUpdateOrderStatus = async (orderId: string, newStatus: OrderStatus) => {
    markLocalMutation();
    setOrders((prev) =>
      prev.map((o) => {
        if (o.id === orderId) {
          const statusNote = {
            menunggu_pembayaran: 'Menunggu pembayaran pembeli',
            diproses_dapur: `${storeSettings.storeName || 'Ngdimsum'} mulai mengukus / menggoreng`,
            siap_saji: 'Dimsum hangat matang, siap diambil / diantar',
            dalam_pengiriman: 'Kurir sedang mengantar pesanan',
            selesai: 'Pesanan telah selesai',
            dibatalkan: 'Pesanan dibatalkan',
          }[newStatus];

          return {
            ...o,
            status: newStatus,
            statusHistory: [
              ...o.statusHistory,
              {
                status: newStatus,
                timestamp: new Date().toISOString(),
                note: statusNote,
              },
            ],
          };
        }
        return o;
      })
    );

    setToast({
      id: Date.now().toString(),
      title: 'Status Pesanan Diperbarui',
      message: `Pesanan #${orderId} kini berstatus: ${newStatus.replace('_', ' ').toUpperCase()}`,
    });

    if (isRealAppsScriptUrl(googleSheetConfig.webAppUrl)) {
      try {
        await fetch(googleSheetConfig.webAppUrl.trim(), {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({
            action: 'update_status',
            orderId: orderId,
            status: newStatus,
          }),
        });
      } catch (e) {
        console.debug('Background status sync:', e);
      }
    }
  };

  const handleTriggerTestOrder = async () => {
    const testOrder: Order = {
      id: `TEST-${Date.now().toString().slice(-4)}`,
      createdAt: new Date().toISOString(),
      customer: {
        name: `Tester ${storeSettings.storeName || 'Ngdimsum'}`,
        phone: '081299998888',
        orderType: 'takeaway',
        notes: 'Uji koneksi 2 arah Google Sheet & Drive',
      },
      items: [
        {
          id: 'dm-01',
          name: 'Siomay Ayam Udang Premium',
          price: 26000,
          quantity: 2,
          pieces: '4 pcs',
          chiliLevel: 'Normal',
          subtotal: 52000,
        },
      ],
      subtotal: 52000,
      packagingFee: 0,
      deliveryFee: 0,
      discount: 0,
      total: 52000,
      payment: {
        method: 'cash',
        status: 'pending',
        referenceNumber: 'WA-TEST-01',
      },
      status: 'diproses_dapur',
      estimatedTimeMinutes: 15,
      statusHistory: [
        {
          status: 'diproses_dapur',
          timestamp: new Date().toISOString(),
          note: 'Pesanan uji coba berhasil dibuat',
        },
      ],
      syncedToGoogleSheet: false,
      whatsappNotified: true,
    };

    setOrders((prev) => [testOrder, ...prev]);

    const res = await syncOrderToGoogleAppsScript(testOrder, googleSheetConfig);
    setToast({
      id: Date.now().toString(),
      title: res.success ? 'Uji Coba Berhasil!' : 'Tersimpan Lokal',
      message: res.message,
    });
  };

  // Filtered menu calculation
  const filteredMenu = useMemo(() => {
    return menuItems
      .filter((item) => {
        const matchesCategory =
          selectedCategory === 'all' ? true : item.category === selectedCategory;

        const matchesQuery =
          !searchQuery.trim() ||
          item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.description.toLowerCase().includes(searchQuery.toLowerCase());

        let matchesTag = true;
        if (tagFilter === 'popular') matchesTag = !!item.isPopular;
        if (tagFilter === 'chef') matchesTag = !!item.isChefsPick;
        if (tagFilter === 'spicy') matchesTag = !!item.isSpicy;

        return matchesCategory && matchesQuery && matchesTag;
      })
      .sort((a, b) => {
        if (sortBy === 'price_asc') return a.price - b.price;
        if (sortBy === 'price_desc') return b.price - a.price;
        if (sortBy === 'name_asc') return a.name.localeCompare(b.name);
        return (b.isPopular ? 1 : 0) - (a.isPopular ? 1 : 0);
      });
  }, [menuItems, selectedCategory, searchQuery, tagFilter, sortBy]);

  const totalCartItems = cart.reduce((sum, item) => sum + item.quantity, 0);
  const totalCartPrice = cart.reduce(
    (sum, item) => sum + item.menuItem.price * item.quantity,
    0
  );

  return (
    <div className="min-h-screen flex flex-col bg-[#fdf5f5] text-stone-900 selection:bg-rose-200">
      {/* Offline Indicator & Mobile PWA Install Banner */}
      <OfflineIndicator />
      <PWAInstallBanner
        storeName={storeSettings.storeName}
        storeLogoUrl={storeSettings.storeLogoUrl}
      />

      {/* Top Bar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        cartCount={totalCartItems}
        onOpenCart={() => setIsCartOpen(true)}
        isAdminLoggedIn={isAdminLoggedIn}
        onAdminLogout={handleAdminLogout}
        storeName={storeSettings.storeName}
        storeLogoUrl={storeSettings.storeLogoUrl}
        tagline={storeSettings.tagline}
        adminWhatsapp={storeSettings.adminWhatsapp}
      />

      {/* Promo Terbatas / Menu Spesial Banner (Dikelola dari Dashboard Admin) */}
      {activeTab === 'menu' && (
        <BannerPromo
          storeSettings={storeSettings}
          onSelectCategory={(cat) => setSelectedCategory(cat)}
        />
      )}

      {/* Main Views */}
      <main className="flex-1 pb-28 md:pb-20">
        {activeTab === 'menu' && (
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 sm:py-7">
            {/* Product Grid Section */}
            <section id="katalog-menu">
              <div className="mb-3">
                <h2 className="font-serif-brand text-xl sm:text-2xl font-bold text-stone-900">
                  Pilihan Menu
                </h2>
              </div>

              {/* Filter & Sort Controls */}
              <div id="filter-kategori">
                <MenuFilter
                  selectedCategory={selectedCategory}
                  setSelectedCategory={(cat) => {
                    if (cat !== selectedCategory) {
                      setIsMenuLoading(true);
                      setSelectedCategory(cat);
                      setTimeout(() => setIsMenuLoading(false), 240);
                    }
                  }}
                  tagFilter={tagFilter}
                  setTagFilter={setTagFilter}
                  sortBy={sortBy}
                  setSortBy={setSortBy}
                  totalFiltered={filteredMenu.length}
                  searchQuery={searchQuery}
                  setSearchQuery={setSearchQuery}
                  customCategories={storeSettings.categories}
                />
              </div>

              {/* Product Grid with Loading Skeleton & Smooth Staggered Transitions */}
              {isMenuLoading ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 animate-fade-smooth">
                  {Array.from({ length: 8 }).map((_, idx) => (
                    <div
                      key={idx}
                      className="flex flex-col bg-white border border-rose-100/80 rounded-xl overflow-hidden shadow-2xs"
                    >
                      <div className="aspect-[16/11] w-full bg-gradient-to-r from-rose-50 via-rose-100/70 to-rose-50 animate-shimmer" />
                      <div className="p-3 space-y-2">
                        <div className="h-2.5 w-16 bg-rose-100/80 rounded animate-pulse" />
                        <div className="h-3.5 w-3/4 bg-stone-200/80 rounded animate-pulse" />
                        <div className="h-3 w-1/2 bg-amber-100/80 rounded animate-pulse" />
                        <div className="h-2.5 w-full bg-stone-100 rounded animate-pulse" />
                        <div className="pt-2 border-t border-rose-50 flex items-center justify-between">
                          <div className="h-4 w-16 bg-rose-100 rounded animate-pulse" />
                          <div className="h-6 w-16 bg-rose-200/70 rounded-lg animate-pulse" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : filteredMenu.length === 0 ? (
                <div className="bg-white rounded-2xl border border-rose-100 p-8 text-center text-stone-500 animate-fade-up">
                  <UtensilsCrossed className="w-7 h-7 text-rose-300 mx-auto mb-2" />
                  <h3 className="font-bold text-stone-800 text-xs">Dimsum Tidak Ditemukan</h3>
                  <p className="text-xs text-stone-400 mt-1">
                    Coba ganti kata kunci pencarian Anda.
                  </p>
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      setSelectedCategory('all');
                      setTagFilter(null);
                    }}
                    className="mt-3 px-3 py-1.5 text-xs font-semibold bg-rose-500 text-white rounded-lg hover:bg-rose-600 transition-colors"
                  >
                    Tampilkan Semua
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
                  {filteredMenu.map((item, idx) => (
                    <MenuCard
                      key={item.id}
                      item={item}
                      index={idx}
                      reviews={reviews.filter((r) => r.menuItemId === item.id)}
                      onAddReview={handleAddReview}
                      onAddToCart={handleAddToCart}
                      customCategories={storeSettings.categories}
                      sambalOptions={storeSettings.sambalOptions}
                      storeName={storeSettings.storeName}
                    />
                  ))}
                </div>
              )}
            </section>
          </div>
        )}

        {activeTab === 'admin' && isAdminLoggedIn && (
          <AdminDashboard
            orders={orders}
            onUpdateOrderStatus={handleUpdateOrderStatus}
            onDeleteOrder={async (orderId) => {
              await deleteSingleOrderStorage(orderId, googleSheetConfig);
              setOrders((prev) => prev.filter((o) => o.id !== orderId));
              setToast({
                id: Date.now().toString(),
                title: 'Transaksi Dihapus',
                message: `Riwayat transaksi #${orderId} telah dihapus.`,
              });
            }}
            onClearOrdersHistory={async () => {
              await resetAllOrdersStorage(googleSheetConfig);
              setOrders([]);
              setToast({
                id: Date.now().toString(),
                title: 'Riwayat Dikosongkan',
                message: 'Seluruh riwayat statistik penjualan berhasil dihapus.',
              });
            }}
            menuItems={menuItems}
            onAddMenuItem={handleAddMenuItem}
            onUpdateMenuItem={handleUpdateMenuItem}
            onDeleteMenuItem={handleDeleteMenuItem}
            onToggleItemStock={handleToggleItemStock}
            storeSettings={storeSettings}
            onUpdateStoreSettings={handleUpdateStoreSettings}
            googleSheetConfig={googleSheetConfig}
            onOpenGoogleSheetModal={() => setIsGoogleSheetModalOpen(true)}
            onPrintReceipt={(order) => setReceiptOrder(order)}
            soundAlertsEnabled={soundAlertsEnabled}
            onToggleSoundAlerts={() => setSoundAlertsEnabled(!soundAlertsEnabled)}
            onLogoutAdmin={handleAdminLogout}
          />
        )}
      </main>

      {/* Floating Cart & Quick Checkout via WhatsApp Bar (Positioned above Bottom Nav on Mobile) */}
      {activeTab === 'menu' && totalCartItems > 0 && (
        <div className="fixed bottom-18 md:bottom-4 inset-x-0 z-30 px-3 sm:px-4 pointer-events-none">
          <div className="max-w-xl mx-auto bg-stone-900/95 backdrop-blur-md text-white rounded-2xl p-2.5 sm:p-3 shadow-2xl border border-stone-700/80 flex items-center justify-between gap-3 pointer-events-auto animate-in fade-in slide-in-from-bottom-4 duration-200">
            <button
              type="button"
              onClick={() => setIsCartOpen(true)}
              className="flex items-center gap-2.5 text-left group"
            >
              <div className="relative w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-rose-500 flex items-center justify-center text-white shrink-0">
                <ShoppingBag className="w-4 h-4 sm:w-5 sm:h-5" />
                <span className="absolute -top-1.5 -right-1.5 bg-white text-rose-600 text-[10px] font-mono font-extrabold w-5 h-5 rounded-full flex items-center justify-center shadow">
                  {totalCartItems}
                </span>
              </div>
              <div>
                <div className="text-[10px] sm:text-[11px] text-stone-300">Keranjang Anda</div>
                <div className="text-xs sm:text-sm font-mono font-bold text-white tabular-nums">
                  {formatCurrency(totalCartPrice)}
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={handleQuickWaCheckoutClick}
              className={`relative overflow-visible px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-xl text-white text-xs font-bold flex items-center gap-1.5 shadow-md transition-all duration-200 group ${
                isWaBtnAnimating
                  ? 'bg-emerald-500 ring-4 ring-emerald-400/40 shadow-emerald-500/40 shadow-lg animate-wa-btn-pop'
                  : 'bg-emerald-600 hover:bg-emerald-500 active:scale-95'
              }`}
            >
              {isWaBtnAnimating && (
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 rounded-xl border-2 border-emerald-300 animate-wa-ripple"
                />
              )}
              <MessageCircle
                className={`w-4 h-4 transition-transform ${
                  isWaBtnAnimating
                    ? 'animate-wa-icon-bounce'
                    : 'group-hover:scale-110 group-hover:-rotate-6'
                }`}
              />
              <span>Checkout via WhatsApp</span>
              <ArrowRight
                className={`w-3.5 h-3.5 transition-transform ${
                  isWaBtnAnimating
                    ? 'animate-wa-arrow-slide'
                    : 'group-hover:translate-x-0.5'
                }`}
              />
            </button>
          </div>
        </div>
      )}

      {/* Mobile App-Style Bottom Navigation Bar for Customer Menu (Only visible on HP when viewing Menu) */}
      {activeTab === 'menu' && (
        <nav
          aria-label="Navigasi Utama HP"
          className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-md border-t border-rose-100 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] print:hidden"
        >
          <div
            className={`grid ${
              isAdminLoggedIn ? 'grid-cols-3' : 'grid-cols-2'
            } h-16 max-w-md mx-auto px-2`}
          >
            {/* Tab 1: Menu */}
            <button
              type="button"
              onClick={() => {
                setActiveTab('menu');
                setIsCartOpen(false);
                setIsCheckoutOpen(false);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className={`flex flex-col items-center justify-center gap-1 transition-colors ${
                activeTab === 'menu' && !isCartOpen && !isCheckoutOpen
                  ? 'text-rose-600 font-bold'
                  : 'text-stone-500 hover:text-stone-800 font-medium'
              }`}
            >
              <UtensilsCrossed className="w-5 h-5" />
              <span className="text-[11px] leading-none">Menu</span>
            </button>

            {/* Tab 2: Keranjang & Checkout WA */}
            <button
              type="button"
              onClick={() => setIsCartOpen(true)}
              className={`relative flex flex-col items-center justify-center gap-1 transition-colors ${
                isCartOpen
                  ? 'text-rose-600 font-bold'
                  : 'text-stone-500 hover:text-rose-600 font-medium'
              }`}
            >
              <div className="relative">
                <ShoppingBag className="w-5 h-5" />
                {totalCartItems > 0 && (
                  <span className="absolute -top-1.5 -right-2.5 bg-rose-500 text-white text-[10px] font-mono font-bold min-w-4 h-4 px-1 rounded-full flex items-center justify-center shadow-2xs">
                    {totalCartItems}
                  </span>
                )}
              </div>
              <span className="text-[11px] leading-none">Keranjang</span>
            </button>

            {/* Tab 3 (Optional): Admin Dapur if Logged In */}
            {isAdminLoggedIn && (
              <button
                type="button"
                onClick={() => {
                  setIsCartOpen(false);
                  setIsCheckoutOpen(false);
                  setActiveTab('admin');
                }}
                className="flex flex-col items-center justify-center gap-1 text-stone-500 hover:text-stone-800 font-medium transition-colors"
              >
                <Settings className="w-5 h-5" />
                <span className="text-[11px] leading-none">Dapur</span>
              </button>
            )}
          </div>
        </nav>
      )}

      {/* Cart Drawer (With Direct WhatsApp Checkout & New Order Button) */}
      <CartDrawer
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        items={cart}
        onUpdateQuantity={handleUpdateCartQuantity}
        onUpdateItemSambal={handleUpdateCartItemSambal}
        onRemoveItem={handleRemoveCartItem}
        onProceedToCheckout={() => {
          setIsCartOpen(false);
          setIsCheckoutOpen(true);
        }}
        storeSettings={storeSettings}
        onOrderCreated={handleOrderCreated}
      />

      {/* Checkout Modal (Direct WhatsApp Checkout & New Order Button) */}
      <CheckoutModal
        isOpen={isCheckoutOpen}
        onClose={() => setIsCheckoutOpen(false)}
        cartItems={cart}
        storeSettings={storeSettings}
        onOrderCreated={handleOrderCreated}
      />

      {/* Hidden Admin Login PIN Modal */}
      <AdminLoginModal
        isOpen={isAdminLoginModalOpen}
        onClose={() => setIsAdminLoginModalOpen(false)}
        onSuccess={handleAdminLoginSuccess}
      />

      {/* Google Sheets & Drive 2-Way Sync Modal */}
      <GoogleSheetsModal
        isOpen={isGoogleSheetModalOpen}
        onClose={() => setIsGoogleSheetModalOpen(false)}
        config={googleSheetConfig}
        onSaveConfig={handleSaveGoogleSheetConfig}
        orders={orders}
        onTriggerTestOrder={handleTriggerTestOrder}
        onTriggerManualTwoWaySync={runBackgroundTwoWaySync}
      />

      {/* Receipt Print Modal */}
      <ReceiptModal
        order={receiptOrder}
        storeSettings={storeSettings}
        onClose={() => setReceiptOrder(null)}
      />

      {/* Live Toast Alert (2 Seconds Non-Blocking) */}
      <NotificationToast toast={toast} onClose={() => setToast(null)} />

      {/* Footer in warm pastel red & discreet admin trigger */}
      <footer className="bg-rose-950 text-rose-100/90 border-t border-rose-900/40 mt-10 pb-20 md:pb-0 print:hidden">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 text-xs">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="font-serif-brand text-base font-bold text-white">
                  {storeSettings.storeName}
                </span>
              </div>
              <p className="text-rose-200/80 leading-relaxed text-[11px]">
                Pesan menu {storeSettings.storeName} secara online tanpa perlu login. Pilih menu, masukkan ke keranjang, dan checkout langsung melalui chat WhatsApp.
              </p>
            </div>

            <div className="space-y-1 text-rose-200/80 text-[11px]">
              <div className="font-bold text-white uppercase tracking-wider text-[11px] mb-1">
                Lokasi &amp; Kontak {storeSettings.storeName}
              </div>
              <div className="flex items-start gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
                <span>{storeSettings.storeAddress}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                <span>Buka: {storeSettings.openingHours}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                <span>WhatsApp: {storeSettings.adminWhatsapp}</span>
              </div>
            </div>

            <div className="space-y-1.5 text-rose-200/80 text-[11px]">
              <div className="font-bold text-white uppercase tracking-wider text-[11px] mb-1">
                Pemesanan Cepat &amp; Praktis
              </div>
              <p className="leading-relaxed">
                Tersedia pilihan matang siap santap. Pilih menu ke keranjang dan langsung kirim pesanan via WhatsApp.
              </p>
            </div>
          </div>

          <div className="pt-6 mt-6 border-t border-rose-900/50 text-[11px] text-rose-300/70 flex items-center">
            <div className="flex items-center gap-1.5">
              <span>© 2026 {storeSettings.storeName}.</span>
              <button
                type="button"
                onClick={() => {
                  if (isAdminLoggedIn) {
                    setActiveTab('admin');
                  } else {
                    setIsAdminLoginModalOpen(true);
                  }
                }}
                aria-label="Admin"
                className="text-rose-400/50 hover:text-rose-200 transition-colors p-1 inline-flex items-center"
              >
                <Lock className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
