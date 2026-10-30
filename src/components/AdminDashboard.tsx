import React, { useState, useRef } from 'react';
import {
  Order,
  OrderStatus,
  MenuItem,
  GoogleSheetConfig,
  StoreSettings,
} from '../types';
import {
  formatCurrency,
  getCustomerWhatsappUrl,
} from '../services/whatsappService';
import {
  uploadProductImageToDrive,
  resolveDriveImageUrl,
  downloadOrdersAsCsv,
} from '../services/googleSheetsService';
import {
  FileSpreadsheet,
  ExternalLink,
  Search,
  Printer,
  MessageCircle,
  UtensilsCrossed,
  TrendingUp,
  LogOut,
  KeyRound,
  Plus,
  Trash2,
  Upload,
  Settings,
  Check,
  Sparkles,
  Download,
  ShoppingBag,
  BarChart3,
} from 'lucide-react';

interface AdminDashboardProps {
  orders: Order[];
  onUpdateOrderStatus: (orderId: string, newStatus: OrderStatus) => void;
  menuItems: MenuItem[];
  onAddMenuItem: (item: MenuItem) => void;
  onUpdateMenuItem: (item: MenuItem) => void;
  onDeleteMenuItem: (itemId: string) => void;
  onToggleItemStock: (itemId: string) => void;
  storeSettings: StoreSettings;
  onUpdateStoreSettings: (newSettings: StoreSettings) => void;
  googleSheetConfig: GoogleSheetConfig;
  onOpenGoogleSheetModal: () => void;
  onPrintReceipt: (order: Order) => void;
  soundAlertsEnabled: boolean;
  onToggleSoundAlerts: () => void;
  onLogoutAdmin: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  orders,
  onUpdateOrderStatus,
  menuItems,
  onAddMenuItem,
  onUpdateMenuItem,
  onDeleteMenuItem,
  onToggleItemStock,
  storeSettings,
  onUpdateStoreSettings,
  googleSheetConfig,
  onOpenGoogleSheetModal,
  onPrintReceipt,
  soundAlertsEnabled,
  onToggleSoundAlerts,
  onLogoutAdmin,
}) => {
  // Navigation inside Admin: 'orders' | 'menu' | 'settings'
  const [adminTab, setAdminTab] = useState<'orders' | 'menu' | 'settings'>('orders');

  // Orders filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | OrderStatus>('all');
  const [orderTypeFilter, setOrderTypeFilter] = useState<'all' | 'takeaway' | 'delivery'>('all');

  // Menu Management State
  const [menuSearch, setMenuSearch] = useState('');
  const [showAddMenuModal, setShowAddMenuModal] = useState(false);
  const [editingMenuId, setEditingMenuId] = useState<string | null>(null);
  const [newMenuName, setNewMenuName] = useState('');
  const [newMenuCategory, setNewMenuCategory] = useState<'kukus' | 'goreng' | 'spesial' | 'minuman'>('kukus');
  const [newMenuPrice, setNewMenuPrice] = useState<number>(25000);
  const [newMenuPieces, setNewMenuPieces] = useState('4 pcs');
  const [newMenuPrepTime, setNewMenuPrepTime] = useState<number>(12);
  const [newMenuDesc, setNewMenuDesc] = useState('');
  const [newMenuIsPopular, setNewMenuIsPopular] = useState(false);
  const [newMenuIsSpicy, setNewMenuIsSpicy] = useState(false);
  const [newMenuIsChef, setNewMenuIsChef] = useState(false);
  const [newMenuImage, setNewMenuImage] = useState<string>('/images/dimsum_siomay_hakau_platter_1792773517046.jpg');
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [uploadStatusMsg, setUploadStatusMsg] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Settings State (Logo, Nama Toko, Tagline, Banner Promo, Ongkos Kirim, dll)
  const [storeNameInput, setStoreNameInput] = useState<string>(storeSettings.storeName || 'Ngdimsum');
  const [taglineInput, setTaglineInput] = useState<string>(
    storeSettings.tagline ?? 'Dimsum Rumahan Fresh Dibuat dari Hati'
  );
  const [storeLogoUrl, setStoreLogoUrl] = useState<string>(storeSettings.storeLogoUrl || '');
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [logoUploadMsg, setLogoUploadMsg] = useState<string>('');
  const logoFileInputRef = useRef<HTMLInputElement | null>(null);

  // Banner Promo State
  const [promoEnabled, setPromoEnabled] = useState<boolean>(storeSettings.promoEnabled !== false);
  const [promoBadge, setPromoBadge] = useState<string>(
    storeSettings.promoBadge || 'PROMO SPESIAL HARI INI'
  );
  const [promoTitle, setPromoTitle] = useState<string>(
    storeSettings.promoTitle || 'Dimsum Mentai Bakar Tobiko & Siomay Ayam Udang'
  );
  const [promoDescription, setPromoDescription] = useState<string>(
    storeSettings.promoDescription ||
      'Hangat baru dikukus dari dapur rumah, gratis Chili Oil khas Ngdimsum setiap pemesanan via WhatsApp!'
  );
  const [promoHighlightText, setPromoHighlightText] = useState<string>(
    storeSettings.promoHighlightText || 'Mulai Rp 25.000'
  );
  const [promoImageUrl, setPromoImageUrl] = useState<string>(
    storeSettings.promoImageUrl || '/images/dimsum_mentai_special_1792773517652.jpg'
  );
  const [promoCategoryTarget, setPromoCategoryTarget] = useState<any>(
    storeSettings.promoCategoryTarget || 'spesial'
  );
  const [isUploadingPromoImg, setIsUploadingPromoImg] = useState(false);
  const [promoImgUploadMsg, setPromoImgUploadMsg] = useState<string>('');
  const promoFileInputRef = useRef<HTMLInputElement | null>(null);

  const [deliveryFee, setDeliveryFee] = useState<number>(storeSettings.deliveryFeeFixed);
  const [adminWhatsapp, setAdminWhatsapp] = useState(storeSettings.adminWhatsapp);
  const [storeAddress, setStoreAddress] = useState(storeSettings.storeAddress);
  const [openingHours, setOpeningHours] = useState(storeSettings.openingHours);
  const [customQrisImage, setCustomQrisImage] = useState<string>(storeSettings.customQrisImageUrl || '');
  const [isUploadingQris, setIsUploadingQris] = useState(false);
  const [qrisUploadMsg, setQrisUploadMsg] = useState<string>('');
  const [settingsSaved, setSettingsSaved] = useState(false);
  const qrisFileInputRef = useRef<HTMLInputElement | null>(null);

  // PIN modal
  const [showPinModal, setShowPinModal] = useState(false);
  const [newPin, setNewPin] = useState('');

  // Orders Filter logic (Rekapan Semua Penjualan)
  const filteredOrders = orders.filter((order) => {
    const matchesSearch =
      order.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.customer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.customer.phone.includes(searchQuery) ||
      order.items.some((i) => i.name.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesType =
      orderTypeFilter === 'all'
        ? true
        : order.customer.orderType === orderTypeFilter;

    return matchesSearch && matchesType;
  });

  // Menu filter logic
  const filteredMenuList = menuItems.filter((item) =>
    item.name.toLowerCase().includes(menuSearch.toLowerCase()) ||
    item.category.toLowerCase().includes(menuSearch.toLowerCase())
  );

  // Statistik & Rekapan Penjualan Calculations
  const validOrders = orders.filter((o) => o.status !== 'dibatalkan');
  const totalRevenue = validOrders.reduce((sum, o) => sum + o.total, 0);
  const totalOrdersCount = validOrders.length;
  const totalPortionsSold = validOrders.reduce(
    (sum, o) => sum + o.items.reduce((s, it) => s + it.quantity, 0),
    0
  );

  // Rekap penjualan per item menu
  const itemSalesRecap = React.useMemo(() => {
    const map = new Map<string, { name: string; qty: number; revenue: number }>();
    validOrders.forEach((o) => {
      o.items.forEach((it) => {
        const prev = map.get(it.name) || { name: it.name, qty: 0, revenue: 0 };
        prev.qty += it.quantity;
        prev.revenue += it.subtotal || it.price * it.quantity;
        map.set(it.name, prev);
      });
    });
    return Array.from(map.values()).sort((a, b) => b.qty - a.qty);
  }, [validOrders]);

  const topSellingItem = itemSalesRecap[0];

  const handleChangePin = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPin.trim().length >= 4) {
      localStorage.setItem('dimsum_admin_pin', newPin.trim());
      setShowPinModal(false);
      setNewPin('');
    }
  };

  // Upload image directly to Google Drive via Apps Script
  const handlePhotoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingPhoto(true);
    setUploadStatusMsg('Mengunggah ke Google Drive...');

    try {
      const res = await uploadProductImageToDrive(file, googleSheetConfig);
      setNewMenuImage(res.driveUrl || res.base64Url);
      setUploadStatusMsg(res.message);
    } catch (err) {
      console.error(err);
      setUploadStatusMsg('Gagal mengunggah foto');
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handleOpenAddModal = () => {
    setEditingMenuId(null);
    setNewMenuName('');
    setNewMenuCategory('kukus');
    setNewMenuPrice(25000);
    setNewMenuPieces('4 pcs');
    setNewMenuPrepTime(12);
    setNewMenuDesc('');
    setNewMenuIsPopular(false);
    setNewMenuIsSpicy(false);
    setNewMenuIsChef(false);
    setNewMenuImage('/images/dimsum_siomay_hakau_platter_1792773517046.jpg');
    setUploadStatusMsg('');
    setShowAddMenuModal(true);
  };

  const handleOpenEditModal = (item: MenuItem) => {
    setEditingMenuId(item.id);
    setNewMenuName(item.name);
    setNewMenuCategory(item.category);
    setNewMenuPrice(item.price);
    setNewMenuPieces(item.pieces);
    setNewMenuPrepTime(item.prepTimeMinutes || 12);
    setNewMenuDesc(item.description);
    setNewMenuIsPopular(!!item.isPopular);
    setNewMenuIsSpicy(!!item.isSpicy);
    setNewMenuIsChef(!!item.isChefsPick);
    setNewMenuImage(item.image);
    setUploadStatusMsg('');
    setShowAddMenuModal(true);
  };

  // Submit new or edited menu item
  const handleCreateMenuItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMenuName.trim()) {
      return;
    }

    const existing = editingMenuId ? menuItems.find((m) => m.id === editingMenuId) : null;

    const itemPayload: MenuItem = {
      id: editingMenuId || `dm-cust-${Date.now().toString().slice(-5)}`,
      name: newMenuName.trim(),
      category: newMenuCategory,
      price: Number(newMenuPrice),
      pieces: newMenuPieces.trim() || '4 pcs',
      prepTimeMinutes: Number(newMenuPrepTime) || 12,
      description: newMenuDesc.trim() || 'Dimsum lezat buatan dapur rumah Ngdimsum.',
      image: resolveDriveImageUrl(newMenuImage),
      isPopular: newMenuIsPopular,
      isSpicy: newMenuIsSpicy,
      isChefsPick: newMenuIsChef,
      isHalal: true,
      inStock: existing ? existing.inStock : true,
    };

    if (editingMenuId) {
      onUpdateMenuItem(itemPayload);
    } else {
      onAddMenuItem(itemPayload);
    }

    setShowAddMenuModal(false);
    setEditingMenuId(null);
    setNewMenuName('');
    setNewMenuDesc('');
    setUploadStatusMsg('');
  };

  // Upload Website Logo directly to Google Drive & immediately apply to website
  const handleLogoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingLogo(true);
    setLogoUploadMsg('Mengunggah logo ke Google Drive...');

    try {
      const res = await uploadProductImageToDrive(file, googleSheetConfig);
      const uploadedLogoUrl = resolveDriveImageUrl(res.driveUrl || res.base64Url);
      setStoreLogoUrl(uploadedLogoUrl);
      setLogoUploadMsg('Logo berhasil diunggah & langsung diterapkan ke website!');
      onUpdateStoreSettings({
        ...storeSettings,
        storeName: storeNameInput.trim() || storeSettings.storeName,
        tagline: taglineInput.trim(),
        storeLogoUrl: uploadedLogoUrl,
        deliveryFeeFixed: Number(deliveryFee),
        adminWhatsapp: adminWhatsapp.trim(),
        storeAddress: storeAddress.trim(),
        openingHours: openingHours.trim(),
      });
    } catch (err) {
      console.error(err);
      setLogoUploadMsg('Gagal mengunggah logo');
    } finally {
      setIsUploadingLogo(false);
    }
  };

  // Upload Promo Banner Image to Google Drive
  const handlePromoImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingPromoImg(true);
    setPromoImgUploadMsg('Mengunggah gambar promo ke Google Drive...');

    try {
      const res = await uploadProductImageToDrive(file, googleSheetConfig);
      const uploadedPromoUrl = resolveDriveImageUrl(res.driveUrl || res.base64Url);
      setPromoImageUrl(uploadedPromoUrl);
      setPromoImgUploadMsg('Gambar promo berhasil diunggah!');
    } catch (err) {
      console.error(err);
      setPromoImgUploadMsg('Gagal mengunggah gambar promo');
    } finally {
      setIsUploadingPromoImg(false);
    }
  };

  // Upload QRIS Code directly or save base64
  const handleQrisFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingQris(true);
    setQrisUploadMsg('Mengunggah QRIS...');

    try {
      const res = await uploadProductImageToDrive(file, googleSheetConfig);
      setCustomQrisImage(res.driveUrl || res.base64Url);
      setQrisUploadMsg(res.message || 'QRIS berhasil diunggah!');
    } catch (err) {
      console.error(err);
      setQrisUploadMsg('Gagal mengunggah QRIS');
    } finally {
      setIsUploadingQris(false);
    }
  };

  // Sync local form state when storeSettings updates via 2-way Google Sheet sync
  React.useEffect(() => {
    setStoreNameInput(storeSettings.storeName || 'Ngdimsum');
    setTaglineInput(storeSettings.tagline ?? 'Dimsum Rumahan Fresh Dibuat dari Hati');
    setStoreLogoUrl(storeSettings.storeLogoUrl || '');
    setPromoEnabled(storeSettings.promoEnabled !== false);
    setPromoBadge(storeSettings.promoBadge || 'PROMO SPESIAL HARI INI');
    setPromoTitle(
      storeSettings.promoTitle || 'Dimsum Mentai Bakar Tobiko & Siomay Ayam Udang'
    );
    setPromoDescription(
      storeSettings.promoDescription ||
        'Hangat baru dikukus dari dapur rumah, gratis Chili Oil khas Ngdimsum setiap pemesanan via WhatsApp!'
    );
    setPromoHighlightText(storeSettings.promoHighlightText || 'Mulai Rp 25.000');
    setPromoImageUrl(
      storeSettings.promoImageUrl || '/images/dimsum_mentai_special_1792773517652.jpg'
    );
    setPromoCategoryTarget(storeSettings.promoCategoryTarget || 'spesial');
    setDeliveryFee(storeSettings.deliveryFeeFixed);
    setAdminWhatsapp(storeSettings.adminWhatsapp);
    setStoreAddress(storeSettings.storeAddress);
    setOpeningHours(storeSettings.openingHours);
    setCustomQrisImage(storeSettings.customQrisImageUrl || '');
  }, [
    storeSettings.storeName,
    storeSettings.tagline,
    storeSettings.storeLogoUrl,
    storeSettings.promoEnabled,
    storeSettings.promoBadge,
    storeSettings.promoTitle,
    storeSettings.promoDescription,
    storeSettings.promoHighlightText,
    storeSettings.promoImageUrl,
    storeSettings.promoCategoryTarget,
    storeSettings.deliveryFeeFixed,
    storeSettings.adminWhatsapp,
    storeSettings.storeAddress,
    storeSettings.openingHours,
    storeSettings.customQrisImageUrl,
  ]);

  // Save Settings (Logo, Nama Toko, Tagline, Banner Promo, Ongkir, dll)
  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanedLogoUrl = storeLogoUrl.trim()
      ? resolveDriveImageUrl(storeLogoUrl.trim())
      : '';
    const cleanedPromoImgUrl = promoImageUrl.trim()
      ? resolveDriveImageUrl(promoImageUrl.trim())
      : '';
    const cleanedQrisUrl = customQrisImage.trim()
      ? resolveDriveImageUrl(customQrisImage.trim())
      : '';
    setStoreLogoUrl(cleanedLogoUrl);
    setPromoImageUrl(cleanedPromoImgUrl);
    setCustomQrisImage(cleanedQrisUrl);
    onUpdateStoreSettings({
      ...storeSettings,
      storeName: storeNameInput.trim() || 'Ngdimsum',
      tagline: taglineInput.trim(),
      storeLogoUrl: cleanedLogoUrl,
      promoEnabled,
      promoBadge: promoBadge.trim() || 'PROMO SPESIAL',
      promoTitle: promoTitle.trim(),
      promoDescription: promoDescription.trim(),
      promoHighlightText: promoHighlightText.trim(),
      promoImageUrl: cleanedPromoImgUrl,
      promoCategoryTarget,
      deliveryFeeFixed: Number(deliveryFee),
      adminWhatsapp: adminWhatsapp.trim(),
      storeAddress: storeAddress.trim(),
      openingHours: openingHours.trim(),
      customQrisImageUrl: cleanedQrisUrl,
    });
    setSettingsSaved(true);
    setTimeout(() => setSettingsSaved(false), 2000);
  };

  const statusBadges: Record<OrderStatus, { label: string; bg: string; text: string }> = {
    menunggu_pembayaran: { label: 'Menunggu Bayar', bg: 'bg-amber-100', text: 'text-amber-800' },
    diproses_dapur: { label: 'Di Dapur (Dimasak)', bg: 'bg-rose-100', text: 'text-rose-800' },
    siap_saji: { label: 'Siap Ambil/Kirim', bg: 'bg-emerald-100', text: 'text-emerald-800' },
    dalam_pengiriman: { label: 'Dalam Pengantaran', bg: 'bg-sky-100', text: 'text-sky-800' },
    selesai: { label: 'Selesai', bg: 'bg-stone-100', text: 'text-stone-700' },
    dibatalkan: { label: 'Dibatalkan', bg: 'bg-rose-50', text: 'text-rose-400' },
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-5 space-y-5 pb-24 md:pb-10">
      {/* Top Header & Action Row */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-rose-100 pb-4">
        <div>
          <h1 className="font-serif-brand text-xl sm:text-2xl font-bold text-stone-900">
            Dashboard Admin {storeSettings.storeName}
          </h1>
          <p className="text-xs text-stone-500 mt-0.5">
            Rekapan penjualan, kelola katalog menu, dan pengaturan dapur.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Change PIN Button */}
          <button
            onClick={() => setShowPinModal(true)}
            className="p-2 bg-white border border-rose-100 hover:bg-rose-50 text-stone-600 text-xs font-medium rounded-lg flex items-center gap-1"
            title="Ganti PIN Admin"
          >
            <KeyRound className="w-3.5 h-3.5 text-rose-500" />
            <span className="hidden sm:inline">Ganti PIN</span>
          </button>

          {/* Google Sheets Status Pill */}
          <button
            onClick={onOpenGoogleSheetModal}
            className={`px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition-all shadow-2xs ${
              googleSheetConfig.webAppUrl
                ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                : 'bg-rose-50 border-rose-200 text-rose-900'
            }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span>
              {googleSheetConfig.webAppUrl ? 'Google Sheet: Aktif' : 'Atur Google Sheet & Drive'}
            </span>
          </button>

          {/* Logout Button */}
          <button
            onClick={onLogoutAdmin}
            className="px-3 py-1.5 bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 shadow-2xs"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Keluar Admin</span>
          </button>
        </div>
      </div>

      {/* Main Admin Section Tabs (Statistik, Kelola Menu, Pengaturan Dapur) */}
      <div className="flex border-b border-rose-100 bg-white/80 p-1 rounded-xl gap-1.5 shadow-2xs">
        <button
          type="button"
          onClick={() => setAdminTab('orders')}
          className={`flex-1 py-2.5 px-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
            adminTab === 'orders'
              ? 'bg-rose-500 text-white shadow-2xs'
              : 'text-stone-600 hover:bg-rose-50/70 hover:text-rose-700'
          }`}
        >
          <BarChart3 className="w-3.5 h-3.5 shrink-0" />
          <span>Statistik</span>
        </button>

        <button
          type="button"
          onClick={() => setAdminTab('menu')}
          className={`flex-1 py-2.5 px-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
            adminTab === 'menu'
              ? 'bg-rose-500 text-white shadow-2xs'
              : 'text-stone-600 hover:bg-rose-50/70 hover:text-rose-700'
          }`}
        >
          <UtensilsCrossed className="w-3.5 h-3.5 shrink-0" />
          <span>Kelola Menu</span>
        </button>

        <button
          type="button"
          onClick={() => setAdminTab('settings')}
          className={`flex-1 py-2.5 px-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
            adminTab === 'settings'
              ? 'bg-rose-500 text-white shadow-2xs'
              : 'text-stone-600 hover:bg-rose-50/70 hover:text-rose-700'
          }`}
        >
          <Settings className="w-3.5 h-3.5 shrink-0" />
          <span>Pengaturan Dapur</span>
        </button>
      </div>

      {/* ======================================================== */}
      {/* TAB 1: STATISTIK & REKAPAN SEMUA PENJUALAN               */}
      {/* ======================================================== */}
      {adminTab === 'orders' && (
        <div className="space-y-4">
          {/* Ringkasan Statistik Penjualan */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white p-3.5 rounded-xl border border-rose-100 shadow-2xs">
              <div className="flex items-center justify-between text-stone-500 text-[11px] mb-0.5">
                <span>Total Penjualan</span>
                <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
              </div>
              <div className="text-lg font-bold font-mono text-stone-900 tabular-nums">
                {formatCurrency(totalRevenue)}
              </div>
              <span className="text-[10px] text-stone-400 mt-0.5 block">
                Akumulasi seluruh pesanan
              </span>
            </div>

            <div className="bg-white p-3.5 rounded-xl border border-rose-100 shadow-2xs">
              <div className="flex items-center justify-between text-stone-500 text-[11px] mb-0.5">
                <span>Total Transaksi</span>
                <ShoppingBag className="w-3.5 h-3.5 text-rose-500" />
              </div>
              <div className="text-lg font-bold font-mono text-rose-600 tabular-nums">
                {totalOrdersCount} Pesanan
              </div>
              <span className="text-[10px] text-stone-400 mt-0.5 block">
                Pesanan masuk via WhatsApp
              </span>
            </div>

            <div className="bg-white p-3.5 rounded-xl border border-rose-100 shadow-2xs">
              <div className="flex items-center justify-between text-stone-500 text-[11px] mb-0.5">
                <span>Total Menu Terjual</span>
                <UtensilsCrossed className="w-3.5 h-3.5 text-emerald-600" />
              </div>
              <div className="text-lg font-bold font-mono text-emerald-700 tabular-nums">
                {totalPortionsSold} Porsi
              </div>
              <span className="text-[10px] text-stone-400 mt-0.5 block">
                Total porsi dimsum &amp; minuman
              </span>
            </div>

            <div className="bg-white p-3.5 rounded-xl border border-rose-100 shadow-2xs">
              <div className="flex items-center justify-between text-stone-500 text-[11px] mb-0.5">
                <span>Menu Terlaris</span>
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              </div>
              <div className="text-sm font-bold text-stone-900 truncate">
                {topSellingItem ? topSellingItem.name : '-'}
              </div>
              <span className="text-[10px] text-stone-400 mt-0.5 block">
                {topSellingItem ? `${topSellingItem.qty} porsi terjual` : 'Belum ada data'}
              </span>
            </div>
          </div>

          {/* Rekap Penjualan Per Menu */}
          {itemSalesRecap.length > 0 && (
            <div className="bg-white p-4 rounded-xl border border-rose-100 shadow-2xs">
              <h3 className="font-bold text-xs text-stone-800 uppercase tracking-wider mb-2.5">
                Rekap Penjualan Per Menu
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {itemSalesRecap.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2.5 rounded-lg bg-rose-50/40 border border-rose-100 text-xs"
                  >
                    <div className="min-w-0 pr-2">
                      <div className="font-semibold text-stone-900 truncate">{item.name}</div>
                      <div className="text-[11px] text-stone-500">{item.qty} porsi terjual</div>
                    </div>
                    <div className="font-mono font-bold text-rose-950 shrink-0">
                      {formatCurrency(item.revenue)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Pencarian & Unduh Rekapan Pesanan (Tanpa Filter Status Dapur) */}
          <div className="bg-white p-3.5 rounded-xl border border-rose-100 shadow-2xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
            <div className="relative flex-1 max-w-sm">
              <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari rekapan pesanan (ID, nama, menu, no WA)..."
                className="w-full pl-8 pr-3 py-1.5 text-xs border border-rose-100 rounded-lg focus:outline-none focus:border-rose-400"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1.5 text-xs text-stone-400 hover:text-stone-700"
                >
                  Reset
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 self-end sm:self-auto text-xs">
              <select
                value={orderTypeFilter}
                onChange={(e) => setOrderTypeFilter(e.target.value as any)}
                className="bg-rose-50/50 border border-rose-100 rounded-lg px-2.5 py-1.5 text-xs text-stone-700 focus:outline-none"
              >
                <option value="all">Semua Pengambilan</option>
                <option value="takeaway">Ambil Sendiri</option>
                <option value="delivery">Pesan Antar (Kurir)</option>
              </select>

              <button
                type="button"
                onClick={() => downloadOrdersAsCsv(filteredOrders)}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg text-xs flex items-center gap-1.5 shadow-2xs transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Unduh Rekapan (CSV)</span>
              </button>
            </div>
          </div>

          {/* Tabel Rekapan Semua Penjualan */}
          <div className="bg-white rounded-xl border border-rose-100 shadow-2xs overflow-hidden">
            <div className="px-4 py-3 border-b border-rose-100 flex items-center justify-between">
              <h3 className="font-bold text-xs text-stone-800 uppercase tracking-wider">
                Daftar Rekapan Semua Pesanan ({filteredOrders.length})
              </h3>
            </div>

            {filteredOrders.length === 0 ? (
              <div className="p-8 text-center text-stone-500">
                <UtensilsCrossed className="w-8 h-8 text-rose-200 mx-auto mb-1.5" />
                <h3 className="font-semibold text-stone-800 text-xs">Belum Ada Rekapan Pesanan</h3>
                <p className="text-[11px] text-stone-400 mt-0.5">
                  Semua pesanan pembeli yang checkout via WhatsApp otomatis tercatat di sini.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-rose-50/70 border-b border-rose-100 text-rose-900 uppercase tracking-wider font-semibold text-[10px]">
                    <tr>
                      <th className="py-2.5 px-3.5">Waktu &amp; ID</th>
                      <th className="py-2.5 px-3.5">Pembeli</th>
                      <th className="py-2.5 px-3.5">Pengambilan</th>
                      <th className="py-2.5 px-3.5">Rincian Menu</th>
                      <th className="py-2.5 px-3.5">Total Penjualan</th>
                      <th className="py-2.5 px-3.5 text-right">Struk / WA</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-rose-50/60 text-stone-800">
                    {filteredOrders.map((order) => (
                      <tr key={order.id} className="hover:bg-rose-50/30 transition-colors">
                        <td className="py-3 px-3.5 font-mono whitespace-nowrap">
                          <span className="font-bold text-stone-900 block">#{order.id}</span>
                          <span className="text-[10px] text-stone-400">
                            {new Date(order.createdAt).toLocaleDateString('id-ID', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                            })}{' '}
                            ·{' '}
                            {new Date(order.createdAt).toLocaleTimeString('id-ID', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </td>

                        <td className="py-3 px-3.5">
                          <div className="font-semibold text-stone-900">{order.customer.name}</div>
                          {order.customer.phone && order.customer.phone !== '-' && (
                            <div className="text-[11px] text-stone-500">{order.customer.phone}</div>
                          )}
                          {order.customer.notes && (
                            <div className="text-[10px] text-rose-800 italic mt-0.5 line-clamp-1">
                              &quot;{order.customer.notes}&quot;
                            </div>
                          )}
                        </td>

                        <td className="py-3 px-3.5 whitespace-nowrap">
                          <span className="font-semibold capitalize block">
                            {order.customer.orderType === 'delivery'
                              ? 'Pesan Antar'
                              : 'Ambil Sendiri'}
                          </span>
                          {order.customer.orderType === 'delivery' && (
                            <span className="text-[10px] text-stone-400 line-clamp-1 max-w-[140px]">
                              {order.customer.deliveryAddress}
                            </span>
                          )}
                        </td>

                        <td className="py-3 px-3.5">
                          <div className="space-y-0.5 max-w-xs">
                            {order.items.map((it, idx) => (
                              <div key={idx} className="text-[11px]">
                                <strong>{it.quantity}x</strong> {it.name}
                                {it.chiliLevel && it.chiliLevel !== 'Normal' && (
                                  <span className="text-rose-600 ml-1">[{it.chiliLevel}]</span>
                                )}
                              </div>
                            ))}
                          </div>
                        </td>

                        <td className="py-3 px-3.5 whitespace-nowrap font-mono">
                          <div className="font-bold text-rose-950 tabular-nums">
                            {formatCurrency(order.total)}
                          </div>
                          {order.deliveryFee > 0 && (
                            <span className="text-[10px] text-stone-400 block">
                              Termasuk ongkir {formatCurrency(order.deliveryFee)}
                            </span>
                          )}
                        </td>

                        <td className="py-3 px-3.5 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => onPrintReceipt(order)}
                              className="p-1.5 rounded-md border border-stone-200 text-stone-600 hover:text-stone-900 hover:bg-stone-50"
                              title="Cetak Struk"
                            >
                              <Printer className="w-3.5 h-3.5" />
                            </button>

                            {order.customer.phone && order.customer.phone !== '-' && (
                              <a
                                href={getCustomerWhatsappUrl(order, storeSettings.storeName)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1.5 rounded-md border border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                                title="Hubungi WhatsApp Pembeli"
                              >
                                <MessageCircle className="w-3.5 h-3.5" />
                              </a>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 2: KELOLA MENU DIMSUM (TAMBAH / HAPUS / UPLOAD DRIVE)  */}
      {/* ======================================================== */}
      {adminTab === 'menu' && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-xl border border-rose-100 shadow-2xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={menuSearch}
                onChange={(e) => setMenuSearch(e.target.value)}
                placeholder="Cari menu"
                className="w-full pl-8 pr-3 py-1.5 text-xs border border-rose-100 rounded-lg focus:outline-none focus:border-rose-400"
              />
            </div>

            <button
              onClick={handleOpenAddModal}
              className="px-3.5 py-2 bg-rose-500 hover:bg-rose-600 text-white font-bold text-xs rounded-xl shadow-2xs flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Menu Dimsum Baru</span>
            </button>
          </div>

          {/* Menu Items Table */}
          <div className="bg-white rounded-xl border border-rose-100 shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-rose-50/70 border-b border-rose-100 text-rose-900 uppercase tracking-wider font-semibold text-[10px]">
                  <tr>
                    <th className="py-2.5 px-3.5">Foto Produk</th>
                    <th className="py-2.5 px-3.5">Nama Dimsum</th>
                    <th className="py-2.5 px-3.5">Kategori</th>
                    <th className="py-2.5 px-3.5">Porsi / Isi</th>
                    <th className="py-2.5 px-3.5">Harga</th>
                    <th className="py-2.5 px-3.5">Status Stok</th>
                    <th className="py-2.5 px-3.5 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-rose-50/60 text-stone-800">
                  {filteredMenuList.map((item) => (
                    <tr key={item.id} className="hover:bg-rose-50/30 transition-colors">
                      <td className="py-2.5 px-3.5">
                        <img
                          src={item.image}
                          alt={item.name}
                          referrerPolicy="no-referrer"
                          className="w-12 h-12 rounded-lg object-cover border border-rose-100 bg-rose-50"
                        />
                      </td>

                      <td className="py-2.5 px-3.5">
                        <div className="font-bold text-stone-900">{item.name}</div>
                        <div className="text-[11px] text-stone-500 line-clamp-1 max-w-xs">
                          {item.description}
                        </div>
                        <div className="flex items-center gap-1 mt-0.5 text-[10px]">
                          {item.isPopular && <span className="text-rose-600 font-semibold">★ Favorit</span>}
                          {item.isChefsPick && <span className="text-amber-700 font-semibold">· Rekomendasi</span>}
                          {item.isSpicy && <span className="text-rose-500 font-semibold">· Pedas</span>}
                        </div>
                      </td>

                      <td className="py-2.5 px-3.5 capitalize font-medium text-stone-600">
                        {item.category}
                      </td>

                      <td className="py-2.5 px-3.5 font-mono text-stone-600">
                        {item.pieces}
                      </td>

                      <td className="py-2.5 px-3.5 font-mono font-bold text-rose-950 tabular-nums">
                        {formatCurrency(item.price)}
                      </td>

                      <td className="py-2.5 px-3.5">
                        <button
                          onClick={() => onToggleItemStock(item.id)}
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-colors ${
                            item.inStock
                              ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                              : 'bg-stone-200 text-stone-600 hover:bg-stone-300'
                          }`}
                        >
                          {item.inStock ? 'Tersedia' : 'Habis'}
                        </button>
                      </td>

                      <td className="py-2.5 px-3.5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenEditModal(item)}
                            className="px-2.5 py-1 rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100 text-[11px] font-semibold transition-colors"
                            title="Edit Menu (Otomatis Sinkron ke Sheet)"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => onDeleteMenuItem(item.id)}
                            className="p-1.5 rounded-lg text-rose-400 hover:text-rose-700 hover:bg-rose-50 transition-colors"
                            title="Hapus Menu"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 3: PENGATURAN ONGKIR & DAPUR                          */}
      {/* ======================================================== */}
      {adminTab === 'settings' && (
        <div className="bg-white p-5 rounded-xl border border-rose-100 shadow-2xs max-w-xl mx-auto space-y-4">
          <div className="border-b border-rose-100 pb-3">
            <h3 className="font-serif-brand text-lg font-bold text-stone-900">
              Pengaturan Toko, Ongkir &amp; Nomor WhatsApp Checkout
            </h3>
            <p className="text-xs text-stone-500 mt-0.5">
              Ubah tarif ongkos kirim, nomor WhatsApp tujuan checkout, serta kelola link Google Sheet &amp; Google Drive tertanam.
            </p>
          </div>

          {/* Embedded Google Sheet, Google Drive & Apps Script Summary Card */}
          <div className="bg-emerald-50/70 p-3.5 rounded-xl border border-emerald-200 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-bold text-emerald-950 flex items-center gap-1.5">
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                Database Tertanam (Sinkronisasi 2 Arah)
              </span>
              <button
                type="button"
                onClick={onOpenGoogleSheetModal}
                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg text-[11px]"
              >
                Kelola Link &amp; Script
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
              <a
                href={googleSheetConfig.spreadsheetUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between p-2 rounded-lg bg-white border border-emerald-200 hover:border-emerald-400 text-stone-700"
              >
                <span className="font-semibold text-[11px] truncate">Buka Google Sheet</span>
                <ExternalLink className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              </a>
              <a
                href={googleSheetConfig.driveFolderUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between p-2 rounded-lg bg-white border border-emerald-200 hover:border-emerald-400 text-stone-700"
              >
                <span className="font-semibold text-[11px] truncate">Buka Folder Google Drive</span>
                <ExternalLink className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              </a>
            </div>
          </div>

          <form onSubmit={handleSaveSettings} className="space-y-3.5 text-xs">
            {/* Website Logo & Brand Name Upload Section */}
            <div className="bg-rose-50/70 p-4 rounded-xl border border-rose-200 space-y-3">
              <div className="flex items-center justify-between">
                <label className="block font-bold text-rose-950 text-xs">
                  Logo Website &amp; Nama Brand Dimsum:
                </label>
                {storeLogoUrl && (
                  <button
                    type="button"
                    onClick={() => {
                      setStoreLogoUrl('');
                      setLogoUploadMsg('Logo dikembalikan ke ikon standar');
                      onUpdateStoreSettings({
                        ...storeSettings,
                        storeLogoUrl: '',
                      });
                    }}
                    className="text-[11px] text-rose-600 hover:text-rose-800 font-semibold"
                  >
                    Reset Logo
                  </button>
                )}
              </div>

              <div className="flex items-center gap-3.5">
                {storeLogoUrl ? (
                  <img
                    src={storeLogoUrl}
                    alt="Logo Website"
                    referrerPolicy="no-referrer"
                    className="w-16 h-16 rounded-xl object-cover border-2 border-rose-300 bg-white shrink-0 shadow-xs"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-xl bg-rose-100 border-2 border-rose-200 flex items-center justify-center text-rose-600 font-serif-brand font-bold text-2xl shrink-0">
                    蒸
                  </div>
                )}

                <div className="flex-1 space-y-1.5">
                  <input
                    type="file"
                    ref={logoFileInputRef}
                    accept="image/*"
                    onChange={handleLogoFileChange}
                    className="hidden"
                  />
                  <button
                    type="button"
                    disabled={isUploadingLogo}
                    onClick={() => logoFileInputRef.current?.click()}
                    className="px-3 py-2 bg-rose-600 hover:bg-rose-500 disabled:bg-stone-400 text-white rounded-lg font-bold flex items-center gap-1.5 transition-colors shadow-2xs"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>
                      {isUploadingLogo ? 'Mengunggah Logo...' : 'Upload Logo Dimsum'}
                    </span>
                  </button>
                  <span className="text-[10px] text-stone-500 block">
                    {logoUploadMsg ||
                      'Upload gambar logo (PNG/JPG). Otomatis tersimpan ke Google Drive & langsung mengubah logo di pojok kiri atas website.'}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                <div>
                  <label className="block font-semibold text-stone-700 mb-1 text-[11px]">
                    Nama Brand / Toko di Website:
                  </label>
                  <input
                    type="text"
                    value={storeNameInput}
                    onChange={(e) => setStoreNameInput(e.target.value)}
                    placeholder="Ngdimsum"
                    className="w-full px-2.5 py-1.5 text-xs border border-rose-200 rounded-lg bg-white focus:outline-none focus:border-rose-400 font-semibold"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-stone-700 mb-1 text-[11px]">
                    Tagline di Atas Web (Bawah Nama Brand):
                  </label>
                  <input
                    type="text"
                    value={taglineInput}
                    onChange={(e) => setTaglineInput(e.target.value)}
                    placeholder="Dimsum Rumahan Fresh Dibuat dari Hati"
                    className="w-full px-2.5 py-1.5 text-xs border border-rose-200 rounded-lg bg-white focus:outline-none focus:border-rose-400"
                  />
                </div>
              </div>

              <div className="pt-1">
                <label className="block font-semibold text-stone-700 mb-1 text-[11px]">
                  Atau Tempel Link URL Logo (Google Drive / Web):
                </label>
                <input
                  type="text"
                  value={storeLogoUrl}
                  onChange={(e) => setStoreLogoUrl(resolveDriveImageUrl(e.target.value))}
                  placeholder="https://drive.google.com/file/d/..."
                  className="w-full px-2.5 py-1.5 text-[11px] border border-rose-200 rounded-lg bg-white focus:outline-none focus:border-rose-400 font-mono"
                />
              </div>
            </div>

            {/* Banner Promo & Menu Spesial Management Section */}
            <div className="bg-amber-50/70 p-4 rounded-xl border border-amber-200 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-amber-600" />
                  <span className="font-bold text-stone-900 text-xs">
                    Banner Promo &amp; Menu Spesial (Di Bawah Navbar)
                  </span>
                </div>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={promoEnabled}
                    onChange={(e) => setPromoEnabled(e.target.checked)}
                    className="rounded text-rose-600 focus:ring-rose-500"
                  />
                  <span className="text-[11px] font-bold text-stone-700">
                    {promoEnabled ? 'Tampilkan Banner' : 'Sembunyikan'}
                  </span>
                </label>
              </div>

              {promoEnabled && (
                <div className="space-y-2.5 pt-1">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block font-semibold text-stone-700 mb-1 text-[11px]">
                        Label Badge Promo:
                      </label>
                      <input
                        type="text"
                        value={promoBadge}
                        onChange={(e) => setPromoBadge(e.target.value)}
                        placeholder="PROMO SPESIAL HARI INI"
                        className="w-full px-2.5 py-1.5 text-xs border border-amber-200 rounded-lg bg-white focus:outline-none focus:border-rose-400 font-semibold"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-stone-700 mb-1 text-[11px]">
                        Teks Highlight Harga / Diskon:
                      </label>
                      <input
                        type="text"
                        value={promoHighlightText}
                        onChange={(e) => setPromoHighlightText(e.target.value)}
                        placeholder="Mulai Rp 25.000"
                        className="w-full px-2.5 py-1.5 text-xs border border-amber-200 rounded-lg bg-white focus:outline-none focus:border-rose-400"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-semibold text-stone-700 mb-1 text-[11px]">
                      Judul Promo / Menu Spesial:
                    </label>
                    <input
                      type="text"
                      value={promoTitle}
                      onChange={(e) => setPromoTitle(e.target.value)}
                      placeholder="Dimsum Mentai Bakar Tobiko & Siomay Ayam Udang"
                      className="w-full px-2.5 py-1.5 text-xs border border-amber-200 rounded-lg bg-white focus:outline-none focus:border-rose-400 font-bold"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-stone-700 mb-1 text-[11px]">
                      Deskripsi Singkat Promo:
                    </label>
                    <textarea
                      rows={2}
                      value={promoDescription}
                      onChange={(e) => setPromoDescription(e.target.value)}
                      placeholder="Hangat baru dikukus dari dapur rumah..."
                      className="w-full px-2.5 py-1.5 text-xs border border-amber-200 rounded-lg bg-white focus:outline-none focus:border-rose-400"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 items-center">
                    <div>
                      <label className="block font-semibold text-stone-700 mb-1 text-[11px]">
                        Target Kategori Saat Diklik:
                      </label>
                      <select
                        value={promoCategoryTarget}
                        onChange={(e) => setPromoCategoryTarget(e.target.value as any)}
                        className="w-full px-2.5 py-1.5 text-xs border border-amber-200 rounded-lg bg-white focus:outline-none focus:border-rose-400"
                      >
                        <option value="all">Semua Menu</option>
                        <option value="spesial">Spesial Mentai</option>
                        <option value="kukus">Dimsum Kukus</option>
                        <option value="goreng">Dimsum Goreng</option>
                        <option value="minuman">Minuman</option>
                      </select>
                    </div>

                    <div>
                      <label className="block font-semibold text-stone-700 mb-1 text-[11px]">
                        Foto Banner Promo:
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="file"
                          ref={promoFileInputRef}
                          accept="image/*"
                          onChange={handlePromoImageFileChange}
                          className="hidden"
                        />
                        <button
                          type="button"
                          disabled={isUploadingPromoImg}
                          onClick={() => promoFileInputRef.current?.click()}
                          className="px-2.5 py-1.5 bg-stone-900 hover:bg-stone-800 text-white rounded-lg font-semibold text-[11px] flex items-center gap-1"
                        >
                          <Upload className="w-3 h-3" />
                          <span>{isUploadingPromoImg ? 'Mengunggah...' : 'Upload Foto Promo'}</span>
                        </button>
                      </div>
                      {promoImgUploadMsg && (
                        <span className="text-[10px] text-emerald-700 block mt-0.5">
                          {promoImgUploadMsg}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Delivery fee editing */}
            <div className="bg-rose-50/60 p-3.5 rounded-xl border border-rose-200 space-y-1.5">
              <label className="block font-bold text-rose-950 text-xs">
                Tarif Ongkos Kirim (Flat Kurir / Ojol):
              </label>
              <div className="relative max-w-xs">
                <span className="absolute left-3 top-2 text-stone-500 font-bold">Rp</span>
                <input
                  type="number"
                  required
                  step={1000}
                  value={deliveryFee}
                  onChange={(e) => setDeliveryFee(Number(e.target.value))}
                  className="w-full pl-9 pr-3 py-1.5 text-sm font-bold font-mono border border-rose-300 rounded-lg bg-white focus:outline-none focus:border-rose-500"
                />
              </div>
              <span className="text-[11px] text-stone-500 block">
                Tarif ini otomatis muncul saat pembeli memilih opsi <em>&quot;Pesan Antar (Kurir)&quot;</em> di Keranjang.
              </span>
            </div>

            {/* Admin WhatsApp */}
            <div>
              <label className="block font-semibold text-stone-700 mb-1">
                Nomor WhatsApp Admin (Penerima Checkout Pesanan):
              </label>
              <input
                type="text"
                required
                value={adminWhatsapp}
                onChange={(e) => setAdminWhatsapp(e.target.value)}
                placeholder="6281234567890"
                className="w-full px-3 py-1.5 border border-stone-200 rounded-lg focus:outline-none focus:border-rose-400"
              />
              <span className="text-[10px] text-stone-400 mt-0.5 block">
                Gunakan awalan 628... agar tautan notifikasi WhatsApp otomatis terhubung.
              </span>
            </div>

            {/* Address */}
            <div>
              <label className="block font-semibold text-stone-700 mb-1">
                Alamat Dapur Rumah (Untuk Pengambilan Sendiri):
              </label>
              <textarea
                rows={2}
                value={storeAddress}
                onChange={(e) => setStoreAddress(e.target.value)}
                className="w-full px-3 py-1.5 border border-stone-200 rounded-lg focus:outline-none focus:border-rose-400"
              />
            </div>

            {/* Opening Hours */}
            <div>
              <label className="block font-semibold text-stone-700 mb-1">
                Jam Operasional Dapur:
              </label>
              <input
                type="text"
                value={openingHours}
                onChange={(e) => setOpeningHours(e.target.value)}
                placeholder="09:00 - 21:00 WIB"
                className="w-full px-3 py-1.5 border border-stone-200 rounded-lg focus:outline-none focus:border-rose-400"
              />
            </div>

            <div className="pt-2 flex items-center justify-between">
              {settingsSaved ? (
                <span className="text-emerald-600 font-bold flex items-center gap-1 text-xs">
                  <Check className="w-4 h-4" />
                  Pengaturan Berhasil Disimpan!
                </span>
              ) : (
                <span className="text-stone-400 text-[11px]">Tersimpan di sistem Ngdimsum</span>
              )}

              <button
                type="submit"
                className="px-4 py-2 bg-rose-500 hover:bg-rose-600 text-white font-bold rounded-lg shadow-2xs transition-colors"
              >
                Simpan Pengaturan
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL TAMBAH MENU DIMSUM BARU (FOTO GOOGLE DRIVE)       */}
      {/* ======================================================== */}
      {showAddMenuModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/70 backdrop-blur-xs overflow-y-auto">
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-rose-100 overflow-hidden my-6 animate-in fade-in zoom-in-95 duration-150">
            <div className="px-5 py-3.5 bg-rose-500 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UtensilsCrossed className="w-4 h-4" />
                <h3 className="font-serif-brand text-base font-bold">
                  {editingMenuId ? 'Edit Menu Dimsum (Sinkron ke Sheet)' : 'Tambah Menu Dimsum Baru'}
                </h3>
              </div>
              <button
                onClick={() => setShowAddMenuModal(false)}
                className="p-1 text-rose-200 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateMenuItem} className="p-5 space-y-3.5 text-xs">
              {/* Photo Upload to Google Drive */}
              <div className="space-y-1.5">
                <label className="block font-semibold text-stone-700">
                  Foto Produk Dimsum (Langsung Tersimpan ke Google Drive):
                </label>

                <div className="flex items-center gap-3">
                  <img
                    src={newMenuImage}
                    alt="Preview"
                    referrerPolicy="no-referrer"
                    className="w-16 h-16 rounded-lg object-cover border border-rose-200 bg-rose-50 shrink-0"
                  />

                  <div className="flex-1 space-y-1">
                    <input
                      type="file"
                      ref={fileInputRef}
                      accept="image/*"
                      onChange={handlePhotoFileChange}
                      className="hidden"
                    />
                    <button
                      type="button"
                      disabled={isUploadingPhoto}
                      onClick={() => fileInputRef.current?.click()}
                      className="px-3 py-1.5 bg-stone-900 hover:bg-stone-800 disabled:bg-stone-400 text-white rounded-lg font-semibold flex items-center gap-1.5 transition-colors shadow-2xs"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>{isUploadingPhoto ? 'Mengunggah ke Drive...' : 'Pilih Foto dari Galeri / Kamera'}</span>
                    </button>
                    <span className="text-[10px] text-stone-400 block">
                      {uploadStatusMsg || 'Foto akan otomatis diarsipkan ke folder Google Drive'}
                    </span>
                  </div>
                </div>

                {/* Direct Google Drive URL Input */}
                <div className="pt-1">
                  <input
                    type="text"
                    value={newMenuImage}
                    onChange={(e) => setNewMenuImage(resolveDriveImageUrl(e.target.value))}
                    placeholder="Atau tempel link gambar Google Drive (https://drive.google.com/file/d/...)"
                    className="w-full px-2.5 py-1.5 text-[11px] border border-stone-200 rounded-lg focus:outline-none focus:border-rose-400 font-mono"
                  />
                </div>

                {/* Preset default photos quick choice */}
                <div className="flex items-center gap-1.5 pt-1">
                  <span className="text-[10px] text-stone-400">Atau pilih contoh:</span>
                  {[
                    { label: 'Siomay/Hakau', url: '/images/dimsum_siomay_hakau_platter_1792773517046.jpg' },
                    { label: 'Goreng Crispy', url: '/images/dimsum_fried_crispy_platter_1792773517430.jpg' },
                    { label: 'Mentai Bakar', url: '/images/dimsum_mentai_special_1792773517652.jpg' },
                  ].map((preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setNewMenuImage(preset.url)}
                      className="px-2 py-0.5 rounded text-[10px] bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Name & Category */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-semibold text-stone-700 mb-1">
                    Nama Menu Dimsum *
                  </label>
                  <input
                    type="text"
                    required
                    value={newMenuName}
                    onChange={(e) => setNewMenuName(e.target.value)}
                    placeholder="Contoh: Siomay Kepiting Keju"
                    className="w-full px-3 py-1.5 border border-stone-200 rounded-lg focus:outline-none focus:border-rose-400"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-stone-700 mb-1">
                    Kategori Menu
                  </label>
                  <select
                    value={newMenuCategory}
                    onChange={(e) => setNewMenuCategory(e.target.value as any)}
                    className="w-full px-2.5 py-1.5 border border-stone-200 rounded-lg focus:outline-none focus:border-rose-400 bg-white"
                  >
                    <option value="kukus">Dimsum Kukus</option>
                    <option value="goreng">Dimsum Goreng</option>
                    <option value="spesial">Spesial &amp; Mentai</option>
                    <option value="minuman">Minuman &amp; Teh</option>
                  </select>
                </div>
              </div>

              {/* Price, Pieces, Time */}
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block font-semibold text-stone-700 mb-1">
                    Harga (Rp) *
                  </label>
                  <input
                    type="number"
                    required
                    step={1000}
                    value={newMenuPrice}
                    onChange={(e) => setNewMenuPrice(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 border border-stone-200 rounded-lg focus:outline-none focus:border-rose-400 font-mono font-semibold"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-stone-700 mb-1">
                    Isi / Porsi
                  </label>
                  <input
                    type="text"
                    value={newMenuPieces}
                    onChange={(e) => setNewMenuPieces(e.target.value)}
                    placeholder="4 pcs"
                    className="w-full px-2.5 py-1.5 border border-stone-200 rounded-lg focus:outline-none focus:border-rose-400"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-stone-700 mb-1">
                    Waktu Masak
                  </label>
                  <input
                    type="number"
                    value={newMenuPrepTime}
                    onChange={(e) => setNewMenuPrepTime(Number(e.target.value))}
                    placeholder="12 mnt"
                    className="w-full px-2.5 py-1.5 border border-stone-200 rounded-lg focus:outline-none focus:border-rose-400"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block font-semibold text-stone-700 mb-1">
                  Deskripsi Menu (Bahan &amp; Cita Rasa):
                </label>
                <textarea
                  rows={2}
                  value={newMenuDesc}
                  onChange={(e) => setNewMenuDesc(e.target.value)}
                  placeholder="Isian ayam udang segar dengan balutan keju mozzarella..."
                  className="w-full px-3 py-1.5 border border-stone-200 rounded-lg focus:outline-none focus:border-rose-400"
                />
              </div>

              {/* Badges / Checkboxes */}
              <div className="flex items-center gap-4 pt-1">
                <label className="flex items-center gap-1.5 cursor-pointer text-stone-700">
                  <input
                    type="checkbox"
                    checked={newMenuIsPopular}
                    onChange={(e) => setNewMenuIsPopular(e.target.checked)}
                    className="text-rose-500 rounded border-stone-300"
                  />
                  <span>Menu Favorit</span>
                </label>

                <label className="flex items-center gap-1.5 cursor-pointer text-stone-700">
                  <input
                    type="checkbox"
                    checked={newMenuIsChef}
                    onChange={(e) => setNewMenuIsChef(e.target.checked)}
                    className="text-rose-500 rounded border-stone-300"
                  />
                  <span>Rekomendasi</span>
                </label>

                <label className="flex items-center gap-1.5 cursor-pointer text-stone-700">
                  <input
                    type="checkbox"
                    checked={newMenuIsSpicy}
                    onChange={(e) => setNewMenuIsSpicy(e.target.checked)}
                    className="text-rose-500 rounded border-stone-300"
                  />
                  <span>Pedas</span>
                </label>
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddMenuModal(false)}
                  className="flex-1 py-2 text-stone-500 hover:text-stone-800"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-rose-500 hover:bg-rose-600 text-white font-bold rounded-xl shadow-2xs transition-colors"
                >
                  Simpan &amp; Publikasikan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Change PIN Modal */}
      {showPinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/60 backdrop-blur-xs">
          <div className="bg-white rounded-xl p-5 max-w-xs w-full shadow-2xl border border-rose-100">
            <h3 className="font-bold text-sm text-stone-900 mb-2">Ubah PIN Admin</h3>
            <form onSubmit={handleChangePin} className="space-y-3 text-xs">
              <input
                type="password"
                required
                maxLength={8}
                value={newPin}
                onChange={(e) => setNewPin(e.target.value)}
                placeholder="Masukkan PIN baru (min. 4 angka)"
                className="w-full px-3 py-2 border border-stone-200 rounded-lg focus:outline-none focus:border-rose-400 font-mono tracking-widest text-center"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowPinModal(false)}
                  className="flex-1 py-1.5 text-stone-500 hover:text-stone-800"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 py-1.5 bg-rose-500 hover:bg-rose-600 text-white font-bold rounded-lg"
                >
                  Simpan PIN
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Mobile Bottom Navigation Bar Khusus Dashboard Admin (Statistik, Kelola Menu, Pengaturan Dapur) */}
      <nav
        aria-label="Navigasi Dashboard Admin HP"
        className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-md border-t border-rose-100 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] print:hidden"
      >
        <div className="grid grid-cols-3 h-16 max-w-md mx-auto px-2">
          <button
            type="button"
            onClick={() => {
              setAdminTab('orders');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className={`flex flex-col items-center justify-center gap-1 transition-colors ${
              adminTab === 'orders'
                ? 'text-rose-600 font-bold'
                : 'text-stone-500 hover:text-stone-800 font-medium'
            }`}
          >
            <BarChart3 className="w-5 h-5" />
            <span className="text-[11px] leading-none">Statistik</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setAdminTab('menu');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className={`flex flex-col items-center justify-center gap-1 transition-colors ${
              adminTab === 'menu'
                ? 'text-rose-600 font-bold'
                : 'text-stone-500 hover:text-stone-800 font-medium'
            }`}
          >
            <UtensilsCrossed className="w-5 h-5" />
            <span className="text-[11px] leading-none">Kelola Menu</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setAdminTab('settings');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className={`flex flex-col items-center justify-center gap-1 transition-colors ${
              adminTab === 'settings'
                ? 'text-rose-600 font-bold'
                : 'text-stone-500 hover:text-stone-800 font-medium'
            }`}
          >
            <Settings className="w-5 h-5" />
            <span className="text-[11px] leading-none">Pengaturan Dapur</span>
          </button>
        </div>
      </nav>
    </div>
  );
};
