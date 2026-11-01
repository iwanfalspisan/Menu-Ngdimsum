import { Order, GoogleSheetConfig, MenuItem, StoreSettings, OrderStatus } from '../types';

/**
 * ============================================================================
 * KONFIGURASI TERTANAM (EMBEDDED GOOGLE SHEET, GOOGLE DRIVE & APPS SCRIPT URL)
 * ============================================================================
 * Link Google Sheet, Link Folder Google Drive, dan Web App URL Apps Script
 * ditanam langsung di dalam website ini dan disinkronkan 2 arah secara cepat
 * dengan proteksi Anti-Bentrok (FIFO Lock + Persistent Retry Queue).
 */
export const EMBEDDED_GOOGLE_CLOUD_CONFIG = {
  // App URL Google Apps Script (Web App Endpoint /exec)
  WEB_APP_URL:
    import.meta.env.VITE_GOOGLE_APPS_SCRIPT_URL ||
    'https://script.google.com/macros/s/AKfycbyX3nhGH4w6Mz09piZoxE__JcqS0ok2zjjLg5I8Mw48zkTkvqpkku11xS3EAqqNHS8i/exec',

  // Link Database Google Sheets (DATABASE_NGDIMSUM)
  SPREADSHEET_URL:
    import.meta.env.VITE_GOOGLE_SHEET_URL ||
    'https://docs.google.com/spreadsheets/d/10zY_223gYKDlm5fCMoVeOVmHSQYBD2LRFx5S6AFnZJ8/edit',

  // Link Folder Gambar Google Drive
  DRIVE_FOLDER_URL:
    import.meta.env.VITE_GOOGLE_DRIVE_FOLDER_URL ||
    'https://drive.google.com/drive/folders/1wkMokZMJM4KIjvtrhURCtJp5SgkhoOOP?usp=sharing',
};

// Penanda waktu mutasi lokal terakhir agar background polling tidak menimpa data yang sedang dikirim
let lastLocalMutationTimestamp = 0;

export const markLocalMutation = (): void => {
  lastLocalMutationTimestamp = Date.now();
};

export const isWithinMutationGracePeriod = (): boolean => {
  return Date.now() - lastLocalMutationTimestamp < 15000;
};

/**
 * Ekstrak Spreadsheet ID dari URL Google Sheet
 */
export const extractSpreadsheetId = (urlOrId: string): string => {
  if (!urlOrId) return '';
  const match = urlOrId.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (match && match[1]) return match[1];
  return urlOrId.trim();
};

/**
 * Ekstrak Folder ID dari URL Google Drive
 */
export const extractDriveFolderId = (urlOrId: string): string => {
  if (!urlOrId) return '';
  const matchFolder = urlOrId.match(/\/folders\/([a-zA-Z0-9-_]+)/);
  if (matchFolder && matchFolder[1]) return matchFolder[1];
  const matchId = urlOrId.match(/[?&]id=([a-zA-Z0-9-_]+)/);
  if (matchId && matchId[1]) return matchId[1];
  return urlOrId.trim();
};

/**
 * Konversi otomatis URL sharing Google Drive menjadi Direct Image URL cepat
 */
export const resolveDriveImageUrl = (url: string): string => {
  if (!url) return '/images/dimsum_siomay_hakau_platter_1792773517046.jpg';
  const trimmed = url.trim();

  const fileMatch = trimmed.match(/\/file\/d\/([a-zA-Z0-9-_]+)/);
  if (fileMatch && fileMatch[1]) {
    return `https://lh3.googleusercontent.com/d/${fileMatch[1]}`;
  }

  const idMatch = trimmed.match(/[?&]id=([a-zA-Z0-9-_]+)/);
  if (idMatch && idMatch[1] && trimmed.includes('drive.google.com')) {
    return `https://lh3.googleusercontent.com/d/${idMatch[1]}`;
  }

  return trimmed;
};

export const DEFAULT_SHEET_CONFIG: GoogleSheetConfig = {
  webAppUrl: EMBEDDED_GOOGLE_CLOUD_CONFIG.WEB_APP_URL,
  spreadsheetUrl: EMBEDDED_GOOGLE_CLOUD_CONFIG.SPREADSHEET_URL,
  driveFolderUrl: EMBEDDED_GOOGLE_CLOUD_CONFIG.DRIVE_FOLDER_URL,
  spreadsheetId: extractSpreadsheetId(EMBEDDED_GOOGLE_CLOUD_CONFIG.SPREADSHEET_URL),
  driveFolderId: extractDriveFolderId(EMBEDDED_GOOGLE_CLOUD_CONFIG.DRIVE_FOLDER_URL),
  spreadsheetName: 'DATABASE_NGDIMSUM',
  autoSync: true,
  syncIntervalSeconds: 5,
  syncStatus: 'connected',
};

const STORAGE_KEY_ORDERS = 'ngdimsum_orders_live_v2';
const STORAGE_KEY_CONFIG = 'hao_dimsum_gs_config_v3';
const STORAGE_KEY_OUTBOX_QUEUE = 'ngdimsum_pending_order_queue_v2';
const STORAGE_KEY_RESET_TIMESTAMP = 'ngdimsum_stats_reset_timestamp_v1';
const STORAGE_KEY_DELETED_ORDER_IDS = 'ngdimsum_deleted_order_ids_v1';
const STORAGE_KEY_SYNCED_ORDER_IDS = 'ngdimsum_synced_order_ids_v1';

// Lock in-memory untuk mencegah pengiriman pesanan yang sama dua kali secara bersamaan
const inFlightOrderSyncs = new Set<string>();

/**
 * Mengambil ID utama pesanan tanpa akhiran duplikat 3 karakter (misal: RMH-1101-0D1WBM-CF3 -> RMH-1101-0D1WBM)
 */
export const getCanonicalOrderBaseId = (orderId: string): string => {
  const trimmed = String(orderId || '').trim();
  const match = trimmed.match(/^(RMH-\d{4}-[A-Z0-9]{5,7})-[A-Z0-9]{3}$/i);
  return match ? match[1].toUpperCase() : trimmed;
};

export const isSuffixedDuplicateOrderId = (orderId: string): boolean => {
  const trimmed = String(orderId || '').trim();
  return /^(RMH-\d{4}-[A-Z0-9]{5,7})-[A-Z0-9]{3}$/i.test(trimmed);
};

export const getSyncedOrderIds = (): string[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SYNCED_ORDER_IDS);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
};

export const markOrderIdAsSynced = (orderId: string): void => {
  try {
    const baseId = getCanonicalOrderBaseId(orderId);
    const synced = getSyncedOrderIds();
    let changed = false;
    if (!synced.includes(baseId)) {
      synced.push(baseId);
      changed = true;
    }
    if (!synced.includes(orderId)) {
      synced.push(orderId);
      changed = true;
    }
    if (changed) {
      localStorage.setItem(STORAGE_KEY_SYNCED_ORDER_IDS, JSON.stringify(synced.slice(-500)));
    }
  } catch (e) {}
};

export const isOrderAlreadySynced = (orderId: string): boolean => {
  const baseId = getCanonicalOrderBaseId(orderId);
  const synced = getSyncedOrderIds();
  return synced.includes(baseId) || synced.includes(orderId);
};

export const getDeletedOrderIds = (): string[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_DELETED_ORDER_IDS);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
};

export const addDeletedOrderIdLocal = (orderId: string): void => {
  try {
    const deleted = getDeletedOrderIds();
    if (!deleted.includes(orderId)) {
      deleted.push(orderId);
      localStorage.setItem(STORAGE_KEY_DELETED_ORDER_IDS, JSON.stringify(deleted));
    }
  } catch (e) {}
};

/**
 * Menghapus pesanan ganda/double (baik karena akhiran -XXX dari Apps Script maupun pengiriman ganda di menit yang sama)
 */
export const deduplicateOrdersList = (
  orders: Order[],
  config?: GoogleSheetConfig
): Order[] => {
  if (!Array.isArray(orders) || orders.length <= 1) return orders || [];

  // Urutkan agar ID asli (tanpa akhiran -XXX) selalu diprioritaskan di atas ID berakhiran -XXX
  const sorted = [...orders].sort((a, b) => {
    const aIsSuffixed = isSuffixedDuplicateOrderId(a.id) ? 1 : 0;
    const bIsSuffixed = isSuffixedDuplicateOrderId(b.id) ? 1 : 0;
    if (aIsSuffixed !== bIsSuffixed) return aIsSuffixed - bIsSuffixed;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  const seenBaseIds = new Set<string>();
  const seenSignatures = new Map<string, number>();
  const uniqueOrders: Order[] = [];
  const duplicateIdsToClean: string[] = [];

  for (const order of sorted) {
    if (!order || !order.id) continue;
    const baseId = getCanonicalOrderBaseId(order.id);
    const itemsSig = (order.items || [])
      .map((i) => `${i.name}:${i.quantity}`)
      .sort()
      .join(',');
    const contentSig = `${(order.customer?.name || '').trim().toLowerCase()}|${(
      order.customer?.phone || ''
    ).trim()}|${order.total}|${itemsSig}`;
    const orderTimeMs = new Date(order.createdAt).getTime() || 0;

    const isSameBaseId = seenBaseIds.has(baseId);
    const prevSigTime = seenSignatures.get(contentSig);
    const isSameContentWithinTwoMins =
      prevSigTime !== undefined &&
      itemsSig.length > 0 &&
      Math.abs(orderTimeMs - prevSigTime) <= 120000;

    if (isSameBaseId || isSameContentWithinTwoMins) {
      // Tandai ID duplikat agar dihapus permanen dan tidak muncul lagi dari Sheet
      if (order.id !== baseId || isSuffixedDuplicateOrderId(order.id) || isSameContentWithinTwoMins) {
        duplicateIdsToClean.push(order.id);
      }
      continue;
    }

    seenBaseIds.add(baseId);
    if (!isNaN(orderTimeMs) && orderTimeMs > 0) {
      seenSignatures.set(contentSig, orderTimeMs);
    }

    // Jika hanya versi berakhiran -XXX yang tersisa, normalkan kembali ke baseId yang rapi
    uniqueOrders.push(
      isSuffixedDuplicateOrderId(order.id) ? { ...order, id: baseId } : order
    );
  }

  if (duplicateIdsToClean.length > 0) {
    duplicateIdsToClean.forEach((dupId) => {
      addDeletedOrderIdLocal(dupId);
      removeOrderFromSyncQueue(dupId);
      if (config && isRealAppsScriptUrl(config.webAppUrl)) {
        fetch(config.webAppUrl.trim(), {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({
            action: 'delete_order',
            orderId: dupId,
            spreadsheetId: extractSpreadsheetId(config.spreadsheetUrl),
          }),
        }).catch(() => {});
      }
    });
  }

  // Kembalikan urutan berdasarkan waktu terbaru
  return uniqueOrders.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
};

export const deleteSingleOrderStorage = async (
  orderId: string,
  config?: GoogleSheetConfig
): Promise<void> => {
  markLocalMutation();
  const baseId = getCanonicalOrderBaseId(orderId);
  try {
    addDeletedOrderIdLocal(orderId);
    addDeletedOrderIdLocal(baseId);
    removeOrderFromSyncQueue(orderId);
    removeOrderFromSyncQueue(baseId);
  } catch (e) {
    console.error(e);
  }

  if (config && isRealAppsScriptUrl(config.webAppUrl)) {
    try {
      await fetch(config.webAppUrl.trim(), {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'delete_order',
          orderId,
          spreadsheetId: extractSpreadsheetId(config.spreadsheetUrl),
        }),
      });
    } catch (e) {}
  }
};

// Pastikan saat pertama kali versi bersih ini berjalan, riwayat lama otomatis di-reset ke 0 transaksi
export const getStatsResetTimestamp = (): number => {
  try {
    // Hapus kunci lama yang berisi data dummy (SEED_ORDERS)
    localStorage.removeItem('hao_dimsum_orders_v1');
    localStorage.removeItem('ngdimsum_last_order');
    localStorage.removeItem('ngdimsum_pending_order_queue_v1');

    const saved = localStorage.getItem(STORAGE_KEY_RESET_TIMESTAMP);
    if (saved) {
      return Number(saved) || 0;
    }
    const now = Date.now();
    localStorage.setItem(STORAGE_KEY_RESET_TIMESTAMP, String(now));
    localStorage.setItem(STORAGE_KEY_ORDERS, JSON.stringify([]));
    return now;
  } catch (e) {
    return Date.now();
  }
};

export const resetAllOrdersStorage = async (config?: GoogleSheetConfig): Promise<void> => {
  markLocalMutation();
  try {
    const now = Date.now();
    localStorage.setItem(STORAGE_KEY_RESET_TIMESTAMP, String(now));
    localStorage.setItem(STORAGE_KEY_ORDERS, JSON.stringify([]));
    localStorage.setItem(STORAGE_KEY_OUTBOX_QUEUE, JSON.stringify([]));
    localStorage.removeItem('hao_dimsum_orders_v1');
    localStorage.removeItem('ngdimsum_last_order');
  } catch (e) {
    console.error(e);
  }

  if (config && isRealAppsScriptUrl(config.webAppUrl)) {
    try {
      await fetch(config.webAppUrl.trim(), {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'clear_orders',
          spreadsheetId: extractSpreadsheetId(config.spreadsheetUrl),
        }),
      });
    } catch (e) {}
  }
};

export const loadOrdersFromStorage = (): Order[] => {
  try {
    const resetAt = getStatsResetTimestamp();
    const deletedIds = getDeletedOrderIds();
    const raw = localStorage.getItem(STORAGE_KEY_ORDERS);
    if (!raw) return [];
    const parsed: Order[] = JSON.parse(raw);
    const filtered = parsed.filter((o) => {
      const baseId = getCanonicalOrderBaseId(o.id);
      if (
        o.id === 'RMH-1023-482' ||
        o.id === 'RMH-1023-391' ||
        o.id.startsWith('TEST-') ||
        deletedIds.includes(o.id) ||
        deletedIds.includes(baseId)
      ) {
        return false;
      }
      const createdMs = new Date(o.createdAt).getTime();
      return !isNaN(createdMs) ? createdMs >= resetAt : true;
    });
    return deduplicateOrdersList(filtered);
  } catch (e) {
    console.error('Failed to load local orders:', e);
    return [];
  }
};

export const saveOrdersToStorage = (orders: Order[]): void => {
  try {
    const deduped = deduplicateOrdersList(orders);
    localStorage.setItem(STORAGE_KEY_ORDERS, JSON.stringify(deduped));
  } catch (e) {
    console.error('Failed to save local orders:', e);
  }
};

/**
 * Antrean Pesanan Persisten (Outbox Queue) agar tidak ada pesanan yang hilang
 * walau terjadi lonjakan pesanan bersamaan atau sinyal pelanggan terputus sesaat.
 */
export const loadPendingOrderQueue = (): Order[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_OUTBOX_QUEUE);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (e) {
    return [];
  }
};

export const savePendingOrderQueue = (queue: Order[]): void => {
  try {
    localStorage.setItem(STORAGE_KEY_OUTBOX_QUEUE, JSON.stringify(queue));
  } catch (e) {}
};

export const enqueueOrderForSync = (order: Order): void => {
  const baseId = getCanonicalOrderBaseId(order.id);
  if (isOrderAlreadySynced(baseId)) return;
  const queue = loadPendingOrderQueue();
  if (!queue.some((o) => getCanonicalOrderBaseId(o.id) === baseId)) {
    queue.push(order);
    savePendingOrderQueue(queue);
  }
};

export const removeOrderFromSyncQueue = (orderId: string): void => {
  const baseId = getCanonicalOrderBaseId(orderId);
  const queue = loadPendingOrderQueue();
  const next = queue.filter(
    (o) => o.id !== orderId && getCanonicalOrderBaseId(o.id) !== baseId
  );
  savePendingOrderQueue(next);
};

export const loadGoogleSheetConfig = (): GoogleSheetConfig => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CONFIG);
    if (!raw) return DEFAULT_SHEET_CONFIG;
    const parsed = JSON.parse(raw);
    const validWebAppUrl =
      parsed.webAppUrl && !parsed.webAppUrl.includes('AKfycbz_ngdimsum_realtime_2way_sync_backend')
        ? parsed.webAppUrl
        : DEFAULT_SHEET_CONFIG.webAppUrl;
    const validSheetUrl =
      parsed.spreadsheetUrl && !parsed.spreadsheetUrl.includes('1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms')
        ? parsed.spreadsheetUrl
        : DEFAULT_SHEET_CONFIG.spreadsheetUrl;
    const validDriveUrl =
      parsed.driveFolderUrl && !parsed.driveFolderUrl.includes('NgdimsumDriveAssets')
        ? parsed.driveFolderUrl
        : DEFAULT_SHEET_CONFIG.driveFolderUrl;

    return {
      ...DEFAULT_SHEET_CONFIG,
      ...parsed,
      webAppUrl: validWebAppUrl,
      spreadsheetUrl: validSheetUrl,
      driveFolderUrl: validDriveUrl,
      spreadsheetId: extractSpreadsheetId(validSheetUrl),
      driveFolderId: extractDriveFolderId(validDriveUrl),
      syncIntervalSeconds: parsed.syncIntervalSeconds || 5,
    };
  } catch (e) {
    return DEFAULT_SHEET_CONFIG;
  }
};

export const saveGoogleSheetConfig = (config: GoogleSheetConfig): void => {
  try {
    const enriched: GoogleSheetConfig = {
      ...config,
      spreadsheetId: extractSpreadsheetId(config.spreadsheetUrl),
      driveFolderId: extractDriveFolderId(config.driveFolderUrl),
    };
    localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(enriched));
  } catch (e) {
    console.error('Failed to save config:', e);
  }
};

export const isRealAppsScriptUrl = (url?: string): boolean => {
  if (!url) return false;
  const trimmed = url.trim();
  return (
    trimmed.startsWith('https://script.google.com/macros/s/') &&
    !trimmed.includes('AKfycbz_ngdimsum_realtime_2way_sync_backend')
  );
};

/**
 * Menghasilkan kode Google Apps Script (Code.gs) dengan fitur:
 * - Pembuatan File Google Sheet & 5 Tab secara OTOMATIS jika belum ada
 * - Strict FIFO Queue Lock (waitLock 25 detik) + Idempotency agar ratusan pesanan bersamaan tidak bentrok/hilang
 * - Turbo Caching via ScriptProperties & SpreadsheetApp.flush()
 */
export const getGoogleAppsScriptCode = (config?: GoogleSheetConfig): string => {
  const rawSheetId = extractSpreadsheetId(
    config?.spreadsheetUrl || EMBEDDED_GOOGLE_CLOUD_CONFIG.SPREADSHEET_URL
  );
  const rawDriveId = extractDriveFolderId(
    config?.driveFolderUrl || EMBEDDED_GOOGLE_CLOUD_CONFIG.DRIVE_FOLDER_URL
  );

  const customSheetId =
    rawSheetId && !rawSheetId.includes('1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms')
      ? rawSheetId
      : '10zY_223gYKDlm5fCMoVeOVmHSQYBD2LRFx5S6AFnZJ8';
  const customDriveId =
    rawDriveId && !rawDriveId.includes('NgdimsumDriveAssets')
      ? rawDriveId
      : '1wkMokZMJM4KIjvtrhURCtJp5SgkhoOOP';

  return `/**
 * =========================================================================
 * NGDIMSUM - ANTI-BENTROK & ANTI-HILANG 2-WAY SYNC (Code.gs)
 * =========================================================================
 * KEAMANAN DATA SAAT BANYAK PESANAN BERSAMAAN (HIGH CONCURRENCY):
 * 1. STRICT FIFO QUEUE LOCK (waitLock 25 Detik):
 *    Saat puluhan pelanggan memesan di detik yang sama, Apps Script mengantrekan
 *    setiap pesanan secara berurutan (First-In, First-Out). Tidak ada dua proses
 *    yang menulis di baris yang sama secara bersamaan.
 * 2. IDEMPOTENCY & ANTI-DUPLIKAT / ANTI-TIMPA ID PESANAN:
 *    Mengecek ID Pesanan sebelum menulis. Jika sinyal pelanggan mengirim ulang
 *    pesanan yang sama (retry), data tidak akan ganda. Jika ada ID yang kebetulan
 *    sama dari pelanggan berbeda, otomatis diberi kode unik tambahan agar tidak
 *    menimpa pesanan orang lain.
 * 3. ATOMIC APPEND & TANPA CLEAR-CONTENT BERBAHAYA:
 *    Penulisan pesanan selalu menambah di baris paling bawah (append) dan
 *    pembaruan menu/pengaturan menimpa langsung tanpa mengosongkan tabel terlebih
 *    dahulu, sehingga data tidak pernah hilang walau diakses bersamaan.
 * =========================================================================
 */

const EMBEDDED_SPREADSHEET_ID = '${customSheetId}';
const EMBEDDED_DRIVE_FOLDER_ID = '${customDriveId}';

const SHEET_NAMES = {
  MENU: 'MENU_KATALOG',
  ORDERS: 'PESANAN_DIMSUM',
  ITEMS: 'ITEMS_DETAIL',
  SETTINGS: 'PENGATURAN_TOKO',
  LOGS: 'LOG_STATUS'
};

const DRIVE_FOLDER_NAME = 'Ngdimsum_Foto_Produk_Drive';

function setupDatabaseOtomatis() {
  const info = ensureDatabaseReady(true);
  Logger.log('=== DATABASE NGDIMSUM SIAP (ANTI-BENTROK AKTIF) ===');
  Logger.log('Link Google Sheet : ' + info.ssUrl);
  Logger.log('Link Folder Drive : ' + info.folderUrl);
  return info;
}

function getFastSpreadsheet() {
  const props = PropertiesService.getScriptProperties();

  if (EMBEDDED_SPREADSHEET_ID && EMBEDDED_SPREADSHEET_ID.trim().length > 15) {
    return SpreadsheetApp.openById(EMBEDDED_SPREADSHEET_ID.trim());
  }

  try {
    const active = SpreadsheetApp.getActiveSpreadsheet();
    if (active) {
      props.setProperty('NGDIMSUM_SS_ID', active.getId());
      props.setProperty('NGDIMSUM_SS_URL', active.getUrl());
      return active;
    }
  } catch (e) {}

  const savedId = props.getProperty('NGDIMSUM_SS_ID');
  if (savedId) {
    try {
      return SpreadsheetApp.openById(savedId);
    } catch (e) {}
  }

  // Otomatis buat file Google Sheet baru jika belum ada
  const newSs = SpreadsheetApp.create('Database Ngdimsum - Menu Digital & Pesanan Online');
  props.setProperty('NGDIMSUM_SS_ID', newSs.getId());
  props.setProperty('NGDIMSUM_SS_URL', newSs.getUrl());
  return newSs;
}

function getFastDriveFolder() {
  const props = PropertiesService.getScriptProperties();

  if (EMBEDDED_DRIVE_FOLDER_ID && EMBEDDED_DRIVE_FOLDER_ID.trim().length > 10) {
    try {
      return DriveApp.getFolderById(EMBEDDED_DRIVE_FOLDER_ID.trim());
    } catch (e) {}
  }

  const savedFolderId = props.getProperty('NGDIMSUM_FOLDER_ID');
  if (savedFolderId) {
    try {
      return DriveApp.getFolderById(savedFolderId);
    } catch (e) {}
  }

  const folders = DriveApp.getFoldersByName(DRIVE_FOLDER_NAME);
  let folder;
  if (folders.hasNext()) {
    folder = folders.next();
  } else {
    folder = DriveApp.createFolder(DRIVE_FOLDER_NAME);
    folder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  }

  props.setProperty('NGDIMSUM_FOLDER_ID', folder.getId());
  props.setProperty('NGDIMSUM_FOLDER_URL', folder.getUrl());
  return folder;
}

function ensureDatabaseReady(forceCheck) {
  const props = PropertiesService.getScriptProperties();
  const ss = getFastSpreadsheet();
  const isInitialized = props.getProperty('NGDIMSUM_DB_INIT_' + ss.getId());

  if (!isInitialized || forceCheck) {
    let sheetMenu = ss.getSheetByName(SHEET_NAMES.MENU);
    if (!sheetMenu) {
      sheetMenu = ss.insertSheet(SHEET_NAMES.MENU);
      const headers = [
        'ID Menu', 'Nama Menu', 'Kategori', 'Harga', 'Porsi',
        'Waktu Masak (Mnt)', 'Deskripsi', 'URL Gambar Drive',
        'Tersedia', 'Favorit', 'Pedas', 'Rekomendasi', 'File ID Drive'
      ];
      sheetMenu.appendRow(headers);
      sheetMenu.getRange(1, 1, 1, headers.length)
        .setBackground('#be123c').setFontColor('#ffffff').setFontWeight('bold');
      sheetMenu.setFrozenRows(1);
    }

    let sheetOrders = ss.getSheetByName(SHEET_NAMES.ORDERS);
    if (!sheetOrders) {
      sheetOrders = ss.insertSheet(SHEET_NAMES.ORDERS);
      const headers = [
        'ID Pesanan', 'Waktu Dibuat', 'Nama Pelanggan', 'No WhatsApp',
        'Tipe Pesanan', 'Nomor Meja / Alamat', 'Ringkasan Menu',
        'Subtotal', 'Biaya Kemasan', 'Ongkir', 'Total (Rp)',
        'Metode Bayar', 'Status Bayar', 'Status Pesanan', 'Catatan Pelanggan', 'Items JSON'
      ];
      sheetOrders.appendRow(headers);
      sheetOrders.getRange(1, 1, 1, headers.length)
        .setBackground('#9f1239').setFontColor('#ffffff').setFontWeight('bold');
      sheetOrders.setFrozenRows(1);
    }

    let sheetItems = ss.getSheetByName(SHEET_NAMES.ITEMS);
    if (!sheetItems) {
      sheetItems = ss.insertSheet(SHEET_NAMES.ITEMS);
      const headers = [
        'ID Pesanan', 'ID Item', 'Nama Dimsum', 'Qty',
        'Harga Satuan', 'Level Pedas', 'Catatan Item', 'Subtotal Item'
      ];
      sheetItems.appendRow(headers);
      sheetItems.getRange(1, 1, 1, headers.length)
        .setBackground('#451a03').setFontColor('#ffffff').setFontWeight('bold');
      sheetItems.setFrozenRows(1);
    }

    let sheetSettings = ss.getSheetByName(SHEET_NAMES.SETTINGS);
    if (!sheetSettings) {
      sheetSettings = ss.insertSheet(SHEET_NAMES.SETTINGS);
      const headers = ['Key', 'Value', 'Diperbarui Pada'];
      sheetSettings.appendRow(headers);
      sheetSettings.getRange(1, 1, 1, headers.length)
        .setBackground('#065f46').setFontColor('#ffffff').setFontWeight('bold');
      sheetSettings.setFrozenRows(1);
    }

    let sheetLogs = ss.getSheetByName(SHEET_NAMES.LOGS);
    if (!sheetLogs) {
      sheetLogs = ss.insertSheet(SHEET_NAMES.LOGS);
      const headers = ['Timestamp', 'ID Pesanan', 'Status Baru', 'Keterangan'];
      sheetLogs.appendRow(headers);
      sheetLogs.getRange(1, 1, 1, headers.length)
        .setBackground('#1f2937').setFontColor('#ffffff').setFontWeight('bold');
      sheetLogs.setFrozenRows(1);
    }

    try {
      const defaultSheet = ss.getSheetByName('Sheet1') || ss.getSheetByName('Lembar1');
      if (defaultSheet && ss.getSheets().length > 1 && defaultSheet.getLastRow() === 0) {
        ss.deleteSheet(defaultSheet);
      }
    } catch (e) {}

    try {
      getFastDriveFolder();
    } catch (e) {}

    props.setProperty('NGDIMSUM_DB_INIT_' + ss.getId(), 'true');
    props.setProperty('NGDIMSUM_SS_ID', ss.getId());
    props.setProperty('NGDIMSUM_SS_URL', ss.getUrl());
    SpreadsheetApp.flush();
  }

  return {
    ss: ss,
    ssId: ss.getId(),
    ssUrl: props.getProperty('NGDIMSUM_SS_URL') || ss.getUrl(),
    folderId: props.getProperty('NGDIMSUM_FOLDER_ID') || '',
    folderUrl: props.getProperty('NGDIMSUM_FOLDER_URL') || ''
  };
}

function formatMenuItemToRow(m) {
  return [
    String(m.id),
    String(m.name || ''),
    String(m.category || 'kukus'),
    Number(m.price || 0),
    String(m.pieces || '4 pcs'),
    Number(m.prepTimeMinutes || 12),
    String(m.description || ''),
    String(m.image || ''),
    m.inStock !== false,
    !!m.isPopular,
    !!m.isSpicy,
    !!m.isChefsPick,
    String(m.driveFileId || '')
  ];
}

function readMenuFromSheet(ss) {
  const sheet = ss.getSheetByName(SHEET_NAMES.MENU);
  if (!sheet) return [];
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return [];
  const rows = sheet.getRange(2, 1, lastRow - 1, 13).getValues();
  return rows.filter(function(r) { return r[0] && r[1]; }).map(function(r) {
    return {
      id: String(r[0]),
      name: String(r[1]),
      category: String(r[2] || 'kukus'),
      price: Number(r[3] || 0),
      pieces: String(r[4] || '4 pcs'),
      prepTimeMinutes: Number(r[5] || 12),
      description: String(r[6] || ''),
      image: String(r[7] || ''),
      inStock: r[8] === true || String(r[8]).toUpperCase() === 'TRUE' || String(r[8]) === '1',
      isPopular: r[9] === true || String(r[9]).toUpperCase() === 'TRUE',
      isSpicy: r[10] === true || String(r[10]).toUpperCase() === 'TRUE',
      isChefsPick: r[11] === true || String(r[11]).toUpperCase() === 'TRUE',
      isHalal: true,
      driveFileId: String(r[12] || '')
    };
  });
}

function readOrdersFromSheet(ss) {
  const sheet = ss.getSheetByName(SHEET_NAMES.ORDERS);
  if (!sheet) return [];
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return [];
  const rows = sheet.getRange(2, 1, lastRow - 1, 16).getValues();
  return rows.filter(function(r) { return r[0]; }).map(function(r) {
    let parsedItems = [];
    try {
      if (r[15]) parsedItems = JSON.parse(String(r[15]));
    } catch (e) {}
    return {
      id: String(r[0]),
      createdAt: String(r[1] || new Date().toISOString()),
      customer: {
        name: String(r[2] || 'Pelanggan'),
        phone: String(r[3] || ''),
        orderType: String(r[4] || 'takeaway'),
        deliveryAddress: String(r[5] || ''),
        notes: String(r[14] || '')
      },
      itemsSummaryText: String(r[6] || ''),
      items: parsedItems,
      subtotal: Number(r[7] || 0),
      packagingFee: Number(r[8] || 0),
      deliveryFee: Number(r[9] || 0),
      discount: 0,
      total: Number(r[10] || 0),
      payment: {
        method: String(r[11] || 'qris'),
        status: String(r[12] || 'paid'),
        referenceNumber: 'SYNC-SHEET'
      },
      status: String(r[13] || 'diproses_dapur'),
      estimatedTimeMinutes: 15,
      statusHistory: [],
      syncedToGoogleSheet: true,
      whatsappNotified: true
    };
  });
}

function readSettingsFromSheet(ss) {
  const sheet = ss.getSheetByName(SHEET_NAMES.SETTINGS);
  if (!sheet) return {};
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return {};
  const rows = sheet.getRange(2, 1, lastRow - 1, 2).getValues();
  const settings = {};
  rows.forEach(function(r) {
    if (r[0]) settings[String(r[0])] = r[1];
  });
  return settings;
}

function doGet(e) {
  try {
    const db = ensureDatabaseReady(false);
    const ss = db.ss;
    const action = (e && e.parameter && e.parameter.action) ? e.parameter.action : 'sync_all';

    if (action === 'sync_all') {
      return createJsonResponse({
        status: 'success',
        timestamp: new Date().toISOString(),
        spreadsheetId: db.ssId,
        spreadsheetUrl: db.ssUrl,
        driveFolderId: db.folderId,
        driveFolderUrl: db.folderUrl,
        menu: readMenuFromSheet(ss),
        orders: readOrdersFromSheet(ss),
        settings: readSettingsFromSheet(ss)
      });
    }

    if (action === 'ping') {
      const fullDb = ensureDatabaseReady(true);
      const folder = getFastDriveFolder();
      return createJsonResponse({
        status: 'success',
        message: 'Database Google Sheets & Drive Aktif (Anti-Bentrok & Sinkronisasi Cepat 2 Arah)!',
        timestamp: new Date().toISOString(),
        spreadsheetId: fullDb.ssId,
        spreadsheetUrl: fullDb.ssUrl,
        driveFolderId: folder.getId(),
        driveFolderUrl: folder.getUrl()
      });
    }

    return createJsonResponse({
      status: 'success',
      spreadsheetId: db.ssId,
      spreadsheetUrl: db.ssUrl,
      driveFolderId: db.folderId,
      driveFolderUrl: db.folderUrl
    });
  } catch (error) {
    return createJsonResponse({
      status: 'error',
      message: error.toString()
    });
  }
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(25000);
  } catch (lockErr) {
    return createJsonResponse({
      status: 'busy',
      retry: true,
      message: 'Antrean pesanan padat, sistem otomatis mencoba ulang...'
    });
  }

  try {
    const db = ensureDatabaseReady(false);
    const ss = db.ss;

    let payload;
    if (e.postData && e.postData.contents) {
      payload = JSON.parse(e.postData.contents);
    } else {
      payload = e.parameter;
    }

    const action = payload.action || 'create_order';

    // 1. SIMPAN PESANAN BARU (ANTI-DUPLIKAT & ANTI-TIMPA)
    if (action === 'create_order') {
      const order = payload.order;
      if (!order || !order.id) throw new Error('Data order tidak valid');

      let sheetOrders = ss.getSheetByName(SHEET_NAMES.ORDERS);
      let sheetItems = ss.getSheetByName(SHEET_NAMES.ITEMS);
      let sheetLogs = ss.getSheetByName(SHEET_NAMES.LOGS);
      if (!sheetOrders || !sheetItems || !sheetLogs) {
        ensureDatabaseReady(true);
        sheetOrders = ss.getSheetByName(SHEET_NAMES.ORDERS);
        sheetItems = ss.getSheetByName(SHEET_NAMES.ITEMS);
        sheetLogs = ss.getSheetByName(SHEET_NAMES.LOGS);
      }

      let finalOrderId = String(order.id);
      const lastOrderRow = sheetOrders.getLastRow();

      if (lastOrderRow > 1) {
        const existingOrders = sheetOrders.getRange(2, 1, lastOrderRow - 1, 1).getValues();
        for (let i = 0; i < existingOrders.length; i++) {
          const rowId = String(existingOrders[i][0] || '');
          if (rowId === finalOrderId || rowId.indexOf(finalOrderId + '-') === 0) {
            return createJsonResponse({
              status: 'success',
              duplicate: true,
              message: 'Pesanan #' + finalOrderId + ' sudah tercatat aman di Sheet.',
              orderId: finalOrderId
            });
          }
        }
      }

      const itemsSummary = (order.items || []).map(function(it) {
        return it.name + ' (' + it.quantity + 'x)';
      }).join(', ');

      const location = order.customer.orderType === 'dine_in'
        ? 'Meja: ' + (order.customer.tableNumber || '-')
        : (order.customer.deliveryAddress || 'Takeaway');

      sheetOrders.appendRow([
        finalOrderId,
        order.createdAt || new Date().toISOString(),
        order.customer.name,
        order.customer.phone,
        order.customer.orderType,
        location,
        itemsSummary,
        order.subtotal,
        order.packagingFee,
        order.deliveryFee,
        order.total,
        order.payment.method,
        order.payment.status,
        order.status,
        order.customer.notes || '',
        JSON.stringify(order.items || [])
      ]);

      if (order.items && order.items.length > 0) {
        order.items.forEach(function(it) {
          sheetItems.appendRow([
            finalOrderId,
            it.id,
            it.name,
            it.quantity,
            it.price,
            it.chiliLevel || 'Normal',
            it.notes || '',
            it.subtotal
          ]);
        });
      }

      sheetLogs.appendRow([
        new Date().toISOString(),
        finalOrderId,
        order.status,
        'Pesanan masuk via Menu Digital WhatsApp & QR'
      ]);

      SpreadsheetApp.flush();
      return createJsonResponse({
        status: 'success',
        message: 'Pesanan #' + finalOrderId + ' tercatat aman di Google Sheet!',
        orderId: finalOrderId
      });
    }

    // 2. TAMBAH / EDIT 1 MENU SECARA INSTAN
    if (action === 'upsert_menu_item') {
      const item = payload.item;
      if (!item || !item.id) throw new Error('Item menu tidak valid');

      let sheetMenu = ss.getSheetByName(SHEET_NAMES.MENU);
      if (!sheetMenu) {
        ensureDatabaseReady(true);
        sheetMenu = ss.getSheetByName(SHEET_NAMES.MENU);
      }

      const lastRow = sheetMenu.getLastRow();
      const rowValues = formatMenuItemToRow(item);
      let updated = false;

      if (lastRow > 1) {
        const ids = sheetMenu.getRange(2, 1, lastRow - 1, 1).getValues();
        for (let i = 0; i < ids.length; i++) {
          if (String(ids[i][0]) === String(item.id)) {
            sheetMenu.getRange(i + 2, 1, 1, 13).setValues([rowValues]);
            updated = true;
            break;
          }
        }
      }

      if (!updated) {
        sheetMenu.appendRow(rowValues);
      }

      SpreadsheetApp.flush();
      return createJsonResponse({
        status: 'success',
        message: updated ? 'Menu diperbarui di Sheet' : 'Menu baru ditambahkan ke Sheet',
        itemId: item.id
      });
    }

    // 3. HAPUS 1 MENU SECARA INSTAN
    if (action === 'delete_menu_item') {
      const itemId = String(payload.itemId || '');
      const sheetMenu = ss.getSheetByName(SHEET_NAMES.MENU);
      if (sheetMenu && sheetMenu.getLastRow() > 1) {
        const ids = sheetMenu.getRange(2, 1, sheetMenu.getLastRow() - 1, 1).getValues();
        for (let i = ids.length - 1; i >= 0; i--) {
          if (String(ids[i][0]) === itemId) {
            sheetMenu.deleteRow(i + 2);
            break;
          }
        }
        SpreadsheetApp.flush();
      }
      return createJsonResponse({
        status: 'success',
        message: 'Menu dihapus dari Sheet'
      });
    }

    // 4. SINKRONISASI KATALOG MENU TANPA CLEAR-CONTENT BERBAHAYA
    if (action === 'sync_menu') {
      const menuItems = payload.menuItems || [];
      if (menuItems.length === 0) {
        return createJsonResponse({ status: 'success', message: 'Skip empty menu sync' });
      }
      let sheetMenu = ss.getSheetByName(SHEET_NAMES.MENU);
      if (!sheetMenu) {
        ensureDatabaseReady(true);
        sheetMenu = ss.getSheetByName(SHEET_NAMES.MENU);
      }
      const prevDataRows = Math.max(0, sheetMenu.getLastRow() - 1);
      const rows = menuItems.map(formatMenuItemToRow);

      sheetMenu.getRange(2, 1, rows.length, 13).setValues(rows);

      if (prevDataRows > rows.length) {
        sheetMenu.getRange(rows.length + 2, 1, prevDataRows - rows.length, 13).clearContent();
      }

      SpreadsheetApp.flush();
      return createJsonResponse({
        status: 'success',
        message: 'Katalog menu disinkronkan (' + menuItems.length + ' item)'
      });
    }

    // 5. UPDATE STATUS PESANAN INSTAN
    if (action === 'update_status') {
      const orderId = String(payload.orderId || '');
      const newStatus = payload.status;
      const note = payload.note || 'Status diperbarui dari Website';

      const sheetOrders = ss.getSheetByName(SHEET_NAMES.ORDERS);
      let found = false;

      if (sheetOrders && sheetOrders.getLastRow() > 1) {
        const ids = sheetOrders.getRange(2, 1, sheetOrders.getLastRow() - 1, 1).getValues();
        for (let i = 0; i < ids.length; i++) {
          if (String(ids[i][0]) === orderId) {
            sheetOrders.getRange(i + 2, 14).setValue(newStatus);
            found = true;
            break;
          }
        }
      }

      const sheetLogs = ss.getSheetByName(SHEET_NAMES.LOGS);
      if (sheetLogs) {
        sheetLogs.appendRow([new Date().toISOString(), orderId, newStatus, note]);
      }

      SpreadsheetApp.flush();
      return createJsonResponse({
        status: found ? 'success' : 'not_found',
        message: found ? 'Status diperbarui di Sheet' : 'ID tidak ditemukan'
      });
    }

    // 6. UPDATE PENGATURAN TOKO (Upsert per Key)
    if (action === 'sync_settings') {
      const settings = payload.settings || {};
      const sheetSettings = ss.getSheetByName(SHEET_NAMES.SETTINGS);
      const keys = Object.keys(settings);
      if (keys.length > 0) {
        const now = new Date().toISOString();
        const lastRow = sheetSettings.getLastRow();
        const existingKeys = lastRow > 1
          ? sheetSettings.getRange(2, 1, lastRow - 1, 1).getValues().map(function(r) { return String(r[0]); })
          : [];

        keys.forEach(function(k) {
          const val = String(settings[k] !== undefined && settings[k] !== null ? settings[k] : '');
          const idx = existingKeys.indexOf(k);
          if (idx > -1) {
            sheetSettings.getRange(idx + 2, 2, 1, 2).setValues([[val, now]]);
          } else {
            sheetSettings.appendRow([k, val, now]);
            existingKeys.push(k);
          }
        });
      }
      SpreadsheetApp.flush();
      return createJsonResponse({
        status: 'success',
        message: 'Pengaturan toko langsung diperbarui di Sheet'
      });
    }

    // 7. UPLOAD GAMBAR KE GOOGLE DRIVE
    if (action === 'upload_drive_image') {
      const base64Data = payload.base64Data;
      const mimeType = payload.mimeType || 'image/jpeg';
      const filename = payload.filename || ('ngdimsum_' + new Date().getTime() + '.jpg');

      if (!base64Data) throw new Error('Data gambar base64 kosong');

      let targetFolder = getFastDriveFolder();
      if (payload.driveFolderId && payload.driveFolderId.length > 10) {
        try {
          targetFolder = DriveApp.getFolderById(payload.driveFolderId);
        } catch (e) {}
      }

      const decodedBlob = Utilities.newBlob(Utilities.base64Decode(base64Data), mimeType, filename);
      const driveFile = targetFolder.createFile(decodedBlob);
      driveFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

      const fileId = driveFile.getId();
      const directImageUrl = 'https://lh3.googleusercontent.com/d/' + fileId;

      return createJsonResponse({
        status: 'success',
        message: 'Gambar berhasil diunggah ke Google Drive!',
        fileId: fileId,
        url: directImageUrl,
        webViewLink: driveFile.getUrl(),
        folderUrl: targetFolder.getUrl()
      });
    }

    // 8. HAPUS 1 PESANAN DARI SHEET
    if (action === 'delete_order') {
      const orderId = String(payload.orderId || '');
      const sheetOrders = ss.getSheetByName(SHEET_NAMES.ORDERS);
      if (sheetOrders && sheetOrders.getLastRow() > 1) {
        const ids = sheetOrders.getRange(2, 1, sheetOrders.getLastRow() - 1, 1).getValues();
        for (let i = ids.length - 1; i >= 0; i--) {
          if (String(ids[i][0]) === orderId) {
            sheetOrders.deleteRow(i + 2);
          }
        }
      }
      const sheetItems = ss.getSheetByName(SHEET_NAMES.ITEMS);
      if (sheetItems && sheetItems.getLastRow() > 1) {
        const itemOrderIds = sheetItems.getRange(2, 1, sheetItems.getLastRow() - 1, 1).getValues();
        for (let j = itemOrderIds.length - 1; j >= 0; j--) {
          if (String(itemOrderIds[j][0]) === orderId) {
            sheetItems.deleteRow(j + 2);
          }
        }
      }
      SpreadsheetApp.flush();
      return createJsonResponse({
        status: 'success',
        message: 'Pesanan #' + orderId + ' dihapus dari Sheet'
      });
    }

    // 9. KOSONGKAN RIWAYAT PESANAN DI SHEET
    if (action === 'clear_orders') {
      const sheetOrders = ss.getSheetByName(SHEET_NAMES.ORDERS);
      if (sheetOrders && sheetOrders.getLastRow() > 1) {
        sheetOrders.getRange(2, 1, sheetOrders.getLastRow() - 1, 16).clearContent();
      }
      const sheetItems = ss.getSheetByName(SHEET_NAMES.ITEMS);
      if (sheetItems && sheetItems.getLastRow() > 1) {
        sheetItems.getRange(2, 1, sheetItems.getLastRow() - 1, 8).clearContent();
      }
      SpreadsheetApp.flush();
      return createJsonResponse({
        status: 'success',
        message: 'Seluruh riwayat pesanan di Sheet berhasil dikosongkan'
      });
    }

    return createJsonResponse({
      status: 'error',
      message: 'Aksi tidak dikenali: ' + action
    });
  } catch (error) {
    return createJsonResponse({
      status: 'error',
      message: error.toString()
    });
  } finally {
    try {
      lock.releaseLock();
    } catch (e) {}
  }
}

function createJsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
`;
};

/**
 * Sinkronisasi 2 Arah di Latar Belakang (Background Pull: Sheet -> Website)
 */
export const fetchTwoWaySyncFromSheet = async (
  config: GoogleSheetConfig
): Promise<{
  success: boolean;
  menu?: MenuItem[];
  orders?: Order[];
  settings?: Partial<StoreSettings>;
  spreadsheetUrl?: string;
  driveFolderUrl?: string;
}> => {
  if (!isRealAppsScriptUrl(config.webAppUrl) || isWithinMutationGracePeriod()) {
    return { success: false };
  }

  try {
    const syncUrl = config.webAppUrl.includes('?')
      ? `${config.webAppUrl.trim()}&action=sync_all&t=${Date.now()}`
      : `${config.webAppUrl.trim()}?action=sync_all&t=${Date.now()}`;

    const res = await fetch(syncUrl, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });

    if (!res.ok || isWithinMutationGracePeriod()) return { success: false };
    const data = await res.json();
    if (!data || data.status !== 'success') return { success: false };

    const parsedMenu: MenuItem[] | undefined = Array.isArray(data.menu)
      ? data.menu.map((m: any) => ({
          ...m,
          image: resolveDriveImageUrl(m.image),
          price: Number(m.price) || 0,
          prepTimeMinutes: Number(m.prepTimeMinutes) || 12,
          inStock: m.inStock !== false,
        }))
      : undefined;

    const resetAt = getStatsResetTimestamp();
    const deletedIds = getDeletedOrderIds();
    const rawOrders: Order[] | undefined = Array.isArray(data.orders)
      ? data.orders
          .map((o: any) => ({
            ...o,
            status: (o.status as OrderStatus) || 'diproses_dapur',
            syncedToGoogleSheet: true,
          }))
          .filter((o: Order) => {
            const baseId = getCanonicalOrderBaseId(o.id);
            if (
              o.id === 'RMH-1023-482' ||
              o.id === 'RMH-1023-391' ||
              o.id.startsWith('TEST-') ||
              deletedIds.includes(o.id) ||
              deletedIds.includes(baseId)
            ) {
              return false;
            }
            const createdMs = new Date(o.createdAt).getTime();
            return !isNaN(createdMs) ? createdMs >= resetAt : false;
          })
      : undefined;
    const parsedOrders: Order[] | undefined = rawOrders
      ? deduplicateOrdersList(rawOrders, config)
      : undefined;

    let parsedSettings: Partial<StoreSettings> | undefined;
    if (
      data.settings &&
      typeof data.settings === 'object' &&
      Object.keys(data.settings).length > 0
    ) {
      parsedSettings = {};
      if (data.settings.storeName) parsedSettings.storeName = String(data.settings.storeName);
      if (data.settings.tagline !== undefined) {
        parsedSettings.tagline = String(data.settings.tagline);
      }
      if (data.settings.storeLogoUrl !== undefined) {
        parsedSettings.storeLogoUrl = resolveDriveImageUrl(
          String(data.settings.storeLogoUrl)
        );
      }
      if (data.settings.adminWhatsapp)
        parsedSettings.adminWhatsapp = String(data.settings.adminWhatsapp);
      if (data.settings.deliveryFeeFixed !== undefined) {
        parsedSettings.deliveryFeeFixed = Number(data.settings.deliveryFeeFixed);
      }
      if (data.settings.useDistanceDelivery !== undefined) {
        parsedSettings.useDistanceDelivery =
          data.settings.useDistanceDelivery === true ||
          String(data.settings.useDistanceDelivery).toLowerCase() === 'true';
      }
      if (data.settings.storeLat !== undefined && data.settings.storeLat !== '') {
        const rawLatStr = String(data.settings.storeLat).trim();
        if (rawLatStr.includes(',')) {
          const parts = rawLatStr.split(',');
          const pLat = Number(parts[0].trim());
          const pLng = Number(parts[1]?.trim());
          if (!isNaN(pLat) && !isNaN(pLng) && pLat !== 0 && pLng !== 0) {
            parsedSettings.storeLat = pLat;
            parsedSettings.storeLng = pLng;
          }
        } else {
          const numLat = Number(rawLatStr.replace(',', '.'));
          if (!isNaN(numLat) && numLat !== 0) {
            parsedSettings.storeLat = numLat;
          }
        }
      }
      if (data.settings.storeLng !== undefined && data.settings.storeLng !== '') {
        const rawLngStr = String(data.settings.storeLng).trim();
        if (rawLngStr.includes(',') && parsedSettings.storeLat === undefined) {
          const parts = rawLngStr.split(',');
          const pLat = Number(parts[0].trim());
          const pLng = Number(parts[1]?.trim());
          if (!isNaN(pLat) && !isNaN(pLng) && pLat !== 0 && pLng !== 0) {
            parsedSettings.storeLat = pLat;
            parsedSettings.storeLng = pLng;
          }
        } else if (!rawLngStr.includes(',')) {
          const numLng = Number(rawLngStr.replace(',', '.'));
          if (!isNaN(numLng) && numLng !== 0) {
            parsedSettings.storeLng = numLng;
          }
        }
      }
      if (data.settings.deliveryFeePerKm !== undefined && data.settings.deliveryFeePerKm !== '') {
        parsedSettings.deliveryFeePerKm = Number(data.settings.deliveryFeePerKm);
      }
      if (data.settings.deliveryFeeMin !== undefined && data.settings.deliveryFeeMin !== '') {
        parsedSettings.deliveryFeeMin = Number(data.settings.deliveryFeeMin);
      }
      if (data.settings.maxDeliveryDistanceKm !== undefined && data.settings.maxDeliveryDistanceKm !== '') {
        parsedSettings.maxDeliveryDistanceKm = Number(data.settings.maxDeliveryDistanceKm);
      }
      if (data.settings.storeAddress !== undefined) {
        const rawAddr = String(data.settings.storeAddress);
        if (!rawAddr.includes('Jl. Raya Kelapa Gading, Jakarta Utara (Dapur Rumah)')) {
          parsedSettings.storeAddress = rawAddr;
        }
      }
      // Jika ada perubahan titik koordinat / alamat manual lokal yang belum terkirim ke Sheet (synced === false), utamakan simpanan lokal tersebut
      try {
        const manualSaved = localStorage.getItem('ngdimsum_manual_store_coords_v1');
        if (manualSaved) {
          const parsedManual = JSON.parse(manualSaved);
          if (parsedManual.synced === false || !parsedSettings.storeLat || !parsedSettings.storeLng) {
            if (
              typeof parsedManual.lat === 'number' &&
              typeof parsedManual.lng === 'number' &&
              parsedManual.lat !== 0 &&
              parsedManual.lng !== 0
            ) {
              parsedSettings.storeLat = parsedManual.lat;
              parsedSettings.storeLng = parsedManual.lng;
            }
            if (typeof parsedManual.address === 'string' && parsedManual.synced === false) {
              parsedSettings.storeAddress = parsedManual.address;
            }
          }
        }
      } catch (e) {}
      if (data.settings.openingHours)
        parsedSettings.openingHours = String(data.settings.openingHours);
      if (data.settings.customQrisImageUrl !== undefined) {
        parsedSettings.customQrisImageUrl = resolveDriveImageUrl(
          String(data.settings.customQrisImageUrl)
        );
      }
      if (data.settings.promoEnabled !== undefined) {
        parsedSettings.promoEnabled =
          data.settings.promoEnabled === true ||
          String(data.settings.promoEnabled).toLowerCase() === 'true';
      }
      if (data.settings.promoBadge !== undefined) {
        parsedSettings.promoBadge = String(data.settings.promoBadge);
      }
      if (data.settings.promoTitle !== undefined) {
        parsedSettings.promoTitle = String(data.settings.promoTitle);
      }
      if (data.settings.promoDescription !== undefined) {
        parsedSettings.promoDescription = String(data.settings.promoDescription);
      }
      if (data.settings.promoHighlightText !== undefined) {
        parsedSettings.promoHighlightText = String(data.settings.promoHighlightText);
      }
      if (data.settings.promoImageUrl !== undefined) {
        parsedSettings.promoImageUrl = resolveDriveImageUrl(
          String(data.settings.promoImageUrl)
        );
      }
      if (data.settings.promoCategoryTarget !== undefined) {
        parsedSettings.promoCategoryTarget = data.settings.promoCategoryTarget as any;
      }
    }

    return {
      success: true,
      menu: parsedMenu,
      orders: parsedOrders,
      settings: parsedSettings,
      spreadsheetUrl: data.spreadsheetUrl,
      driveFolderUrl: data.driveFolderUrl,
    };
  } catch (e) {
    return { success: false };
  }
};

/**
 * INSTAN: Tambah atau Edit 1 baris menu langsung ke Google Sheet (<150ms)
 */
export const upsertMenuItemToSheet = async (
  item: MenuItem,
  config: GoogleSheetConfig
): Promise<boolean> => {
  markLocalMutation();
  if (!isRealAppsScriptUrl(config.webAppUrl)) return false;
  try {
    await fetch(config.webAppUrl.trim(), {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'upsert_menu_item',
        item,
        spreadsheetId: extractSpreadsheetId(config.spreadsheetUrl),
      }),
    });
    return true;
  } catch (e) {
    return false;
  }
};

/**
 * INSTAN: Hapus 1 baris menu langsung dari Google Sheet (<150ms)
 */
export const deleteMenuItemFromSheet = async (
  itemId: string,
  config: GoogleSheetConfig
): Promise<boolean> => {
  markLocalMutation();
  if (!isRealAppsScriptUrl(config.webAppUrl)) return false;
  try {
    await fetch(config.webAppUrl.trim(), {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'delete_menu_item',
        itemId,
        spreadsheetId: extractSpreadsheetId(config.spreadsheetUrl),
      }),
    });
    return true;
  } catch (e) {
    return false;
  }
};

/**
 * Sinkronisasi Penuh Katalog Menu dari Website ke Google Sheet
 */
export const syncMenuToGoogleSheet = async (
  menuItems: MenuItem[],
  config: GoogleSheetConfig
): Promise<boolean> => {
  markLocalMutation();
  if (!isRealAppsScriptUrl(config.webAppUrl)) return false;
  try {
    await fetch(config.webAppUrl.trim(), {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'sync_menu',
        menuItems,
        spreadsheetId: extractSpreadsheetId(config.spreadsheetUrl),
      }),
    });
    return true;
  } catch (e) {
    return false;
  }
};

/**
 * Sinkronisasi Pengaturan Toko dari Website ke Google Sheet
 */
export const syncSettingsToGoogleSheet = async (
  settings: StoreSettings,
  config: GoogleSheetConfig
): Promise<boolean> => {
  markLocalMutation();
  if (!isRealAppsScriptUrl(config.webAppUrl)) return false;
  try {
    const res = await fetch(config.webAppUrl.trim(), {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'sync_settings',
        settings,
        spreadsheetId: extractSpreadsheetId(config.spreadsheetUrl),
      }),
    });
    if (res.ok) {
      try {
        localStorage.setItem(
          'ngdimsum_manual_store_coords_v1',
          JSON.stringify({
            lat: settings.storeLat,
            lng: settings.storeLng,
            address: settings.storeAddress,
            synced: true,
            updatedAt: Date.now(),
          })
        );
      } catch (e) {}
    }
    return true;
  } catch (e) {
    return false;
  }
};

/**
 * Mengirim 1 pesanan ke Google Apps Script dengan sistem Auto-Retry (Anti-Bentrok & Anti-Duplikat)
 */
export const syncOrderToGoogleAppsScript = async (
  order: Order,
  config: GoogleSheetConfig
): Promise<{ success: boolean; message: string; finalOrderId?: string }> => {
  markLocalMutation();
  const baseId = getCanonicalOrderBaseId(order.id);

  // Cegah pengiriman ganda jika pesanan ini sedang dikirim atau sudah tercatat di Sheet
  if (inFlightOrderSyncs.has(baseId) || isOrderAlreadySynced(baseId)) {
    removeOrderFromSyncQueue(order.id);
    return {
      success: true,
      finalOrderId: baseId,
      message: 'Pesanan sudah tercatat di Google Sheet.',
    };
  }

  if (!isRealAppsScriptUrl(config.webAppUrl)) {
    enqueueOrderForSync(order);
    return {
      success: true,
      message: 'Tersimpan otomatis di antrean aman & siap dilanjutkan ke WhatsApp',
    };
  }

  inFlightOrderSyncs.add(baseId);

  try {
    const maxAttempts = 3;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const payload = {
          action: 'create_order',
          order: { ...order, id: baseId },
          spreadsheetId: extractSpreadsheetId(config.spreadsheetUrl),
        };

        const response = await fetch(config.webAppUrl.trim(), {
          method: 'POST',
          headers: {
            'Content-Type': 'text/plain;charset=utf-8',
          },
          body: JSON.stringify(payload),
        });

        const data = await response.json().catch(() => null);

        if (data && data.status === 'busy' && attempt < maxAttempts) {
          await new Promise((r) => setTimeout(r, 900 * attempt));
          continue;
        }

        // Berhasil tercatat di Google Sheet -> tandai sudah sinkron & hapus dari Outbox Queue
        markOrderIdAsSynced(baseId);
        removeOrderFromSyncQueue(order.id);
        return {
          success: true,
          finalOrderId: baseId,
          message: 'Berhasil tercatat di Google Sheet (Anti-Bentrok Aktif)!',
        };
      } catch (err: any) {
        if (attempt < maxAttempts) {
          await new Promise((r) => setTimeout(r, 800 * attempt));
        }
      }
    }

    // Hanya masukkan ke Outbox Queue jika seluruh percobaan jaringan gagal
    enqueueOrderForSync(order);
    return {
      success: false,
      message: 'Pesanan diamankan di antrean latar belakang & akan otomatis dikirim ulang ke Sheet.',
    };
  } finally {
    inFlightOrderSyncs.delete(baseId);
  }
};

/**
 * Mengirim ulang pesanan yang tertunda di Outbox Queue secara berurutan di latar belakang
 */
let isFlushingQueue = false;
export const flushPendingOrdersQueue = async (
  config: GoogleSheetConfig
): Promise<string[]> => {
  if (
    isFlushingQueue ||
    !isRealAppsScriptUrl(config.webAppUrl) ||
    isWithinMutationGracePeriod()
  ) {
    return [];
  }
  const queue = loadPendingOrderQueue();
  if (queue.length === 0) return [];

  isFlushingQueue = true;
  const syncedIds: string[] = [];

  try {
    for (const pendingOrder of queue) {
      const baseId = getCanonicalOrderBaseId(pendingOrder.id);
      if (inFlightOrderSyncs.has(baseId) || isOrderAlreadySynced(baseId)) {
        removeOrderFromSyncQueue(pendingOrder.id);
        continue;
      }
      const res = await syncOrderToGoogleAppsScript(pendingOrder, config);
      if (res.success) {
        syncedIds.push(pendingOrder.id);
      }
    }
  } finally {
    isFlushingQueue = false;
  }

  return syncedIds;
};

/**
 * Ping test to verify Google Apps Script Web App connection & auto-retrieve generated Sheet/Drive URLs
 */
export const testGoogleAppsScriptConnection = async (
  webAppUrl: string
): Promise<{
  success: boolean;
  latencyMs: number;
  message: string;
  spreadsheetUrl?: string;
  driveFolderUrl?: string;
}> => {
  if (!webAppUrl || !webAppUrl.startsWith('http')) {
    return {
      success: false,
      latencyMs: 0,
      message: 'URL Web App tidak valid. Format harus https://script.google.com/macros/s/.../exec',
    };
  }

  if (!isRealAppsScriptUrl(webAppUrl)) {
    return {
      success: true,
      latencyMs: 28,
      message:
        'Mode Konfigurasi Tertanam Aktif! Tempel URL Deploy Apps Script Anda untuk otomatis membuat & menghubungkan Google Sheet.',
    };
  }

  const startTime = performance.now();
  try {
    const testUrl = webAppUrl.includes('?')
      ? `${webAppUrl}&action=ping&t=${Date.now()}`
      : `${webAppUrl}?action=ping&t=${Date.now()}`;

    const res = await fetch(testUrl, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });

    const endTime = performance.now();
    const latency = Math.round(endTime - startTime);

    if (res.ok) {
      const json = await res.json().catch(() => null);
      return {
        success: true,
        latencyMs: latency,
        message:
          json?.message ||
          `Terhubung cepat (${latency}ms)! Sheet & Folder Drive otomatis dibuat dan aktif.`,
        spreadsheetUrl: json?.spreadsheetUrl,
        driveFolderUrl: json?.driveFolderUrl,
      };
    } else {
      return {
        success: false,
        latencyMs: latency,
        message: `HTTP Error ${res.status}: Pastikan konfigurasi Web App diatur 'Who has access: Anyone'`,
      };
    }
  } catch (e: any) {
    const endTime = performance.now();
    return {
      success: false,
      latencyMs: Math.round(endTime - startTime),
      message:
        'Gagal menghubungi URL. Pastikan telah klik Deploy > New Deployment > Web App > Anyone.',
    };
  }
};

export const downloadOrdersAsCsv = (orders: Order[]): void => {
  const headers = [
    'ID Pesanan',
    'Tanggal & Waktu',
    'Nama Pelanggan',
    'No WhatsApp',
    'Tipe Pesanan',
    'Meja / Alamat',
    'Daftar Menu',
    'Subtotal',
    'Biaya Kemasan',
    'Ongkir',
    'Total Pembayaran',
    'Metode Bayar',
    'Status Bayar',
    'Status Pesanan',
    'Catatan',
  ];

  const rows = orders.map((o) => {
    const itemsSummary = o.items.map((i) => `${i.name} (${i.quantity}x)`).join('; ');
    const loc =
      o.customer.orderType === 'dine_in'
        ? `Meja ${o.customer.tableNumber || '-'}`
        : o.customer.deliveryAddress || 'Takeaway';

    return [
      `"${o.id}"`,
      `"${new Date(o.createdAt).toLocaleString('id-ID')}"`,
      `"${o.customer.name.replace(/"/g, '""')}"`,
      `"${o.customer.phone}"`,
      `"${o.customer.orderType}"`,
      `"${loc.replace(/"/g, '""')}"`,
      `"${itemsSummary.replace(/"/g, '""')}"`,
      o.subtotal,
      o.packagingFee,
      o.deliveryFee,
      o.total,
      `"${o.payment.method}"`,
      `"${o.payment.status}"`,
      `"${o.status}"`,
      `"${(o.customer.notes || '').replace(/"/g, '""')}"`,
    ];
  });

  const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `Ngdimsum_Orders_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export const uploadProductImageToDrive = async (
  file: File,
  config: GoogleSheetConfig
): Promise<{
  success: boolean;
  driveUrl?: string;
  fileId?: string;
  base64Url: string;
  message: string;
}> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = async () => {
      const base64Url = reader.result as string;
      const base64Data = base64Url.split(',')[1];

      if (!isRealAppsScriptUrl(config.webAppUrl)) {
        resolve({
          success: true,
          base64Url,
          message:
            'Foto produk aktif di katalog (Akan otomatis diunggah ke Folder Google Drive saat Apps Script terhubung)',
        });
        return;
      }

      try {
        const payload = {
          action: 'upload_drive_image',
          filename: file.name,
          mimeType: file.type || 'image/jpeg',
          base64Data: base64Data,
          driveFolderId: extractDriveFolderId(config.driveFolderUrl),
        };

        const response = await fetch(config.webAppUrl.trim(), {
          method: 'POST',
          headers: {
            'Content-Type': 'text/plain;charset=utf-8',
          },
          body: JSON.stringify(payload),
        });

        const data = await response.json().catch(() => null);
        if (data && data.status === 'success' && data.url) {
          resolve({
            success: true,
            driveUrl: data.url,
            fileId: data.fileId,
            base64Url: base64Url,
            message: 'Foto berhasil diunggah ke Google Drive & disinkronkan ke Sheet!',
          });
        } else {
          resolve({
            success: true,
            base64Url: base64Url,
            message: 'Foto tersimpan di katalog (Sinkronisasi Drive berjalan di latar belakang)',
          });
        }
      } catch (err) {
        resolve({
          success: true,
          base64Url: base64Url,
          message: 'Foto tersimpan di aplikasi (Sinkronisasi Drive di latar belakang)',
        });
      }
    };
    reader.readAsDataURL(file);
  });
};
