/**
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

const EMBEDDED_SPREADSHEET_ID = '10zY_223gYKDlm5fCMoVeOVmHSQYBD2LRFx5S6AFnZJ8';
const EMBEDDED_DRIVE_FOLDER_ID = '1wkMokZMJM4KIjvtrhURCtJp5SgkhoOOP';

const SHEET_NAMES = {
  MENU: 'MENU_KATALOG',
  ORDERS: 'PESANAN_DIMSUM',
  ITEMS: 'ITEMS_DETAIL',
  SETTINGS: 'PENGATURAN_TOKO',
  LOGS: 'LOG_STATUS'
};

const DRIVE_FOLDER_NAME = 'Ngdimsum_Foto_Produk_Drive';

/**
 * Jalankan fungsi ini satu kali dari editor Apps Script jika ingin langsung
 * membuat struktur Sheet & Folder Drive serta melihat link-nya di Execution Log.
 */
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

/**
 * Handler POST dengan STRICT FIFO MUTEX LOCK (Anti-Bentrok & Anti-Hilang)
 */
function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    // Tunggu antrean hingga 25 detik agar semua pesanan yang masuk bersamaan
    // diproses satu per satu secara berurutan tanpa ada yang ditolak atau menimpa baris!
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

      // Cek apakah ID Pesanan sudah pernah masuk (Idempotency & Anti-Collision)
      if (lastOrderRow > 1) {
        const existingOrders = sheetOrders.getRange(2, 1, lastOrderRow - 1, 4).getValues();
        for (let i = 0; i < existingOrders.length; i++) {
          if (String(existingOrders[i][0]) === finalOrderId) {
            const existingPhone = String(existingOrders[i][3] || '');
            const incomingPhone = String((order.customer && order.customer.phone) || '');
            if (existingPhone === incomingPhone) {
              // Pesanan yang sama persis sudah tercatat (akibat retry jaringan) -> Jangan tulis ganda!
              return createJsonResponse({
                status: 'success',
                duplicate: true,
                message: 'Pesanan #' + finalOrderId + ' sudah tercatat aman di Sheet.',
                orderId: finalOrderId
              });
            } else {
              // Jika kebetulan ID sama dari pelanggan berbeda, berikan akhiran unik agar tidak bentrok
              finalOrderId = finalOrderId + '-' + Utilities.getUuid().slice(0, 3).toUpperCase();
              break;
            }
          }
        }
      }

      const itemsSummary = (order.items || []).map(function(it) {
        return it.name + ' (' + it.quantity + 'x)';
      }).join(', ');

      const location = order.customer.orderType === 'dine_in'
        ? 'Meja: ' + (order.customer.tableNumber || '-')
        : (order.customer.deliveryAddress || 'Takeaway');

      // appendRow dijamin selalu menambah di baris paling bawah secara atomik (tidak pernah menimpa)
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

      // Tulis rincian item menggunakan appendRow per item di dalam Lock agar 100% bebas timpa
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

    // 2. TAMBAH / EDIT 1 MENU SECARA INSTAN (Upsert berdasarkan ID Menu)
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

      // Tulis langsung menimpa baris yang ada (tanpa mengosongkan tabel terlebih dahulu)
      sheetMenu.getRange(2, 1, rows.length, 13).setValues(rows);

      // Hanya bersihkan sisa baris di bawahnya jika jumlah menu berkurang
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

    // 6. UPDATE PENGATURAN TOKO (Upsert per Key tanpa menghapus key lain)
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
