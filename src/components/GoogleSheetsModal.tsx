import React, { useState, useEffect } from 'react';
import { GoogleSheetConfig, Order } from '../types';
import {
  getGoogleAppsScriptCode,
  testGoogleAppsScriptConnection,
  downloadOrdersAsCsv,
  extractSpreadsheetId,
  extractDriveFolderId,
} from '../services/googleSheetsService';
import {
  FileSpreadsheet,
  HardDrive,
  Copy,
  Check,
  RefreshCw,
  ExternalLink,
  Download,
  AlertCircle,
  CheckCircle2,
  X,
  Code2,
  Sparkles,
  Link2,
  ArrowLeftRight,
} from 'lucide-react';

interface GoogleSheetsModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: GoogleSheetConfig;
  onSaveConfig: (config: GoogleSheetConfig) => void;
  orders: Order[];
  onTriggerTestOrder: () => void;
  onTriggerManualTwoWaySync?: () => Promise<void>;
}

export const GoogleSheetsModal: React.FC<GoogleSheetsModalProps> = ({
  isOpen,
  onClose,
  config,
  onSaveConfig,
  orders,
  onTriggerTestOrder,
  onTriggerManualTwoWaySync,
}) => {
  const [webAppUrl, setWebAppUrl] = useState(config.webAppUrl || '');
  const [spreadsheetUrl, setSpreadsheetUrl] = useState(config.spreadsheetUrl || '');
  const [driveFolderUrl, setDriveFolderUrl] = useState(config.driveFolderUrl || '');
  const [autoSync, setAutoSync] = useState(config.autoSync);
  const [syncIntervalSeconds, setSyncIntervalSeconds] = useState(config.syncIntervalSeconds || 5);
  const [testing, setTesting] = useState(false);
  const [syncingNow, setSyncingNow] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    latencyMs: number;
    message: string;
  } | null>(null);
  const [copiedScript, setCopiedScript] = useState(false);
  const [activeTab, setActiveTab] = useState<'setup' | 'script' | 'backup'>('setup');

  useEffect(() => {
    if (isOpen) {
      setWebAppUrl(config.webAppUrl || '');
      setSpreadsheetUrl(config.spreadsheetUrl || '');
      setDriveFolderUrl(config.driveFolderUrl || '');
      setAutoSync(config.autoSync);
      setSyncIntervalSeconds(config.syncIntervalSeconds || 5);
    }
  }, [isOpen, config]);

  if (!isOpen) return null;

  const previewConfig: GoogleSheetConfig = {
    ...config,
    webAppUrl: webAppUrl.trim(),
    spreadsheetUrl: spreadsheetUrl.trim(),
    driveFolderUrl: driveFolderUrl.trim(),
    spreadsheetId: extractSpreadsheetId(spreadsheetUrl),
    driveFolderId: extractDriveFolderId(driveFolderUrl),
    autoSync,
    syncIntervalSeconds,
  };

  const scriptCode = getGoogleAppsScriptCode(previewConfig);

  const handleCopyScript = () => {
    navigator.clipboard.writeText(scriptCode);
    setCopiedScript(true);
    setTimeout(() => setCopiedScript(false), 2500);
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    const res = await testGoogleAppsScriptConnection(webAppUrl.trim());
    setTestResult(res);
    setTesting(false);

    if (res.success) {
      const nextSheetUrl = res.spreadsheetUrl || spreadsheetUrl.trim();
      const nextDriveUrl = res.driveFolderUrl || driveFolderUrl.trim();
      setSpreadsheetUrl(nextSheetUrl);
      setDriveFolderUrl(nextDriveUrl);
      onSaveConfig({
        ...previewConfig,
        spreadsheetUrl: nextSheetUrl,
        driveFolderUrl: nextDriveUrl,
        spreadsheetId: extractSpreadsheetId(nextSheetUrl),
        driveFolderId: extractDriveFolderId(nextDriveUrl),
        syncStatus: 'connected',
        lastSyncAt: new Date().toISOString(),
        errorMessage: undefined,
      });
    }
  };

  const handleManualSyncNow = async () => {
    if (!onTriggerManualTwoWaySync) return;
    setSyncingNow(true);
    await onTriggerManualTwoWaySync();
    setSyncingNow(false);
  };

  const handleSave = () => {
    onSaveConfig({
      ...previewConfig,
      syncStatus: webAppUrl.trim() ? 'connected' : 'idle',
      lastSyncAt: new Date().toISOString(),
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/70 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-stone-200 overflow-hidden my-6 animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-stone-900 text-stone-100 flex items-center justify-between border-b border-stone-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
              <ArrowLeftRight className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-serif-brand text-lg font-bold text-white">
                Database 2 Arah: Google Sheet, Google Drive &amp; Apps Script
              </h2>
              <p className="text-xs text-stone-400">
                Link Sheet, Link Drive &amp; App URL Apps Script tertanam dan berjalan di latar belakang
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-stone-400 hover:text-white hover:bg-stone-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-stone-200 bg-stone-50 px-6 pt-3 gap-2 overflow-x-auto">
          <button
            onClick={() => setActiveTab('setup')}
            className={`px-3 py-2 text-xs font-semibold rounded-t-lg transition-colors whitespace-nowrap ${
              activeTab === 'setup'
                ? 'bg-white border-t border-x border-stone-200 text-emerald-800 shadow-2xs'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            Link Tertanam &amp; Sinkron 2 Arah
          </button>
          <button
            onClick={() => setActiveTab('script')}
            className={`px-3 py-2 text-xs font-semibold rounded-t-lg transition-colors flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'script'
                ? 'bg-white border-t border-x border-stone-200 text-emerald-800 shadow-2xs'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <Code2 className="w-3.5 h-3.5" />
            <span>Kode Apps Script 2 Arah (Otomatis)</span>
          </button>
          <button
            onClick={() => setActiveTab('backup')}
            className={`px-3 py-2 text-xs font-semibold rounded-t-lg transition-colors whitespace-nowrap ${
              activeTab === 'backup'
                ? 'bg-white border-t border-x border-stone-200 text-emerald-800 shadow-2xs'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            Uji Coba &amp; Ekspor CSV
          </button>
        </div>

        {/* CONTENT TAB 1: SETUP */}
        {activeTab === 'setup' && (
          <div className="p-6 space-y-4">
            {/* 2-Way Sync Info Banner */}
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold text-emerald-900">
                  <Sparkles className="w-4 h-4 text-emerald-600" />
                  <span>Sinkronisasi 2 Arah Berjalan di Latar Belakang</span>
                </div>
                {onTriggerManualTwoWaySync && (
                  <button
                    type="button"
                    disabled={syncingNow}
                    onClick={handleManualSyncNow}
                    className="px-2.5 py-1 bg-emerald-700 hover:bg-emerald-600 text-white text-[11px] font-bold rounded-lg flex items-center gap-1 transition-colors"
                  >
                    <RefreshCw className={`w-3 h-3 ${syncingNow ? 'animate-spin' : ''}`} />
                    <span>{syncingNow ? 'Menyinkronkan...' : 'Sinkronkan 2 Arah Sekarang'}</span>
                  </button>
                )}
              </div>
              <p className="text-[11px] text-emerald-800 leading-relaxed">
                Perubahan menu, harga, stok, atau status pesanan di <strong>Google Sheet</strong> akan otomatis memperbarui <strong>Website</strong> di latar belakang, dan setiap pesanan baru atau foto produk dari Website otomatis masuk ke <strong>Google Sheet &amp; Google Drive</strong>.
              </p>
            </div>

            {/* 1. Embedded Google Sheet Link */}
            <div className="space-y-1">
              <label className="flex items-center justify-between text-xs font-bold text-stone-800">
                <span className="flex items-center gap-1.5">
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                  1. Link Database Google Sheet (Tertanam):
                </span>
                {spreadsheetUrl && (
                  <a
                    href={spreadsheetUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] text-emerald-700 hover:underline flex items-center gap-1 font-semibold"
                  >
                    <span>Buka Sheet</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </label>
              <input
                type="url"
                value={spreadsheetUrl}
                onChange={(e) => setSpreadsheetUrl(e.target.value)}
                placeholder="https://docs.google.com/spreadsheets/d/1BxiMVs0XRA.../edit"
                className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg focus:outline-none focus:border-emerald-500 font-mono bg-stone-50/60"
              />
              <span className="text-[10px] text-stone-500 block">
                ID Sheet Terdeteksi: <code className="text-emerald-700 font-semibold">{extractSpreadsheetId(spreadsheetUrl) || '-'}</code>
              </span>
            </div>

            {/* 2. Embedded Google Drive Folder Link */}
            <div className="space-y-1">
              <label className="flex items-center justify-between text-xs font-bold text-stone-800">
                <span className="flex items-center gap-1.5">
                  <HardDrive className="w-3.5 h-3.5 text-blue-600" />
                  2. Link Folder Gambar Google Drive (Tertanam):
                </span>
                {driveFolderUrl && (
                  <a
                    href={driveFolderUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] text-blue-700 hover:underline flex items-center gap-1 font-semibold"
                  >
                    <span>Buka Folder Drive</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </label>
              <input
                type="url"
                value={driveFolderUrl}
                onChange={(e) => setDriveFolderUrl(e.target.value)}
                placeholder="https://drive.google.com/drive/folders/1A2B3C4D5E6F..."
                className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg focus:outline-none focus:border-emerald-500 font-mono bg-stone-50/60"
              />
              <span className="text-[10px] text-stone-500 block">
                ID Folder Drive Terdeteksi: <code className="text-blue-700 font-semibold">{extractDriveFolderId(driveFolderUrl) || '-'}</code>
              </span>
            </div>

            {/* 3. Embedded Google Apps Script Web App URL */}
            <div className="space-y-1">
              <label className="flex items-center justify-between text-xs font-bold text-stone-800">
                <span className="flex items-center gap-1.5">
                  <Link2 className="w-3.5 h-3.5 text-rose-600" />
                  3. App URL Google Apps Script (Web App Endpoint):
                </span>
              </label>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={webAppUrl}
                  onChange={(e) => setWebAppUrl(e.target.value)}
                  placeholder="https://script.google.com/macros/s/AKfycbx.../exec"
                  className="flex-1 px-3 py-2 text-xs border border-stone-300 rounded-lg focus:outline-none focus:border-emerald-500 font-mono bg-stone-50/60"
                />
                <button
                  type="button"
                  disabled={testing || !webAppUrl.trim()}
                  onClick={handleTestConnection}
                  className="px-3.5 py-2 bg-stone-900 hover:bg-stone-800 disabled:bg-stone-300 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 shadow-2xs whitespace-nowrap"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${testing ? 'animate-spin' : ''}`} />
                  <span>{testing ? 'Menguji...' : 'Uji Koneksi'}</span>
                </button>
              </div>
            </div>

            {/* Test result message */}
            {testResult && (
              <div
                className={`p-3 rounded-lg border text-xs flex items-start gap-2 ${
                  testResult.success
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-rose-50 border-rose-200 text-rose-800'
                }`}
              >
                {testResult.success ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                )}
                <div>
                  <div className="font-bold">
                    {testResult.success ? 'Koneksi 2 Arah Aktif!' : 'Perlu Verifikasi URL'}
                  </div>
                  <div className="mt-0.5">{testResult.message}</div>
                </div>
              </div>
            )}

            {/* Background Sync Settings */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-stone-200">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="autoSync"
                  checked={autoSync}
                  onChange={(e) => setAutoSync(e.target.checked)}
                  className="w-4 h-4 text-emerald-600 rounded border-stone-300 focus:ring-emerald-500"
                />
                <label htmlFor="autoSync" className="text-xs text-stone-700 font-medium">
                  Jalankan sinkronisasi 2 arah otomatis di latar belakang
                </label>
              </div>

              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-stone-500">Interval:</span>
                <select
                  value={syncIntervalSeconds}
                  onChange={(e) => setSyncIntervalSeconds(Number(e.target.value))}
                  className="px-2 py-1 border border-stone-200 rounded-lg text-xs bg-white font-semibold text-stone-700"
                >
                  <option value={5}>Setiap 5 detik (Turbo Cepat)</option>
                  <option value={10}>Setiap 10 detik</option>
                  <option value={15}>Setiap 15 detik</option>
                  <option value={30}>Setiap 30 detik</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* CONTENT TAB 2: CODE SCRIPT */}
        {activeTab === 'script' && (
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold text-stone-900">
                  Kode Google Apps Script 2 Arah (Code.gs)
                </h3>
                <p className="text-[11px] text-stone-500">
                  Link Sheet &amp; Link Folder Drive Anda sudah tertanam otomatis di dalam script di bawah ini.
                </p>
              </div>
              <button
                onClick={handleCopyScript}
                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 shadow-2xs"
              >
                {copiedScript ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedScript ? 'Tersalin ke Clipboard!' : 'Salin Seluruh Kode'}</span>
              </button>
            </div>

            <div className="relative">
              <textarea
                readOnly
                rows={13}
                value={scriptCode}
                className="w-full p-3 bg-stone-900 text-emerald-300 font-mono text-[11px] rounded-xl border border-stone-800 leading-relaxed focus:outline-none"
              />
            </div>
          </div>
        )}

        {/* CONTENT TAB 3: BACKUP & CSV */}
        {activeTab === 'backup' && (
          <div className="p-6 space-y-4">
            <div>
              <h3 className="text-xs font-bold text-stone-900">
                Uji Koneksi Pesanan &amp; Ekspor Spreadsheet
              </h3>
              <p className="text-[11px] text-stone-500">
                Uji pengiriman baris otomatis ke Google Sheet atau unduh data sebagai CSV.
              </p>
            </div>

            <div className="border border-stone-200 rounded-xl p-4 bg-stone-50 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-stone-900 block">
                  Kirim Pesanan Uji Coba ke Google Sheet
                </span>
                <span className="text-[11px] text-stone-500">
                  Menguji pembuatan baris otomatis di tab PESANAN_DIMSUM &amp; ITEMS_DETAIL.
                </span>
              </div>
              <button
                onClick={onTriggerTestOrder}
                className="px-3.5 py-2 bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 shadow-2xs whitespace-nowrap"
              >
                <Sparkles className="w-4 h-4" />
                <span>Kirim Tes Pesanan</span>
              </button>
            </div>

            <div className="border border-stone-200 rounded-xl p-4 bg-stone-50 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-stone-900 block">
                  Unduh File CSV ({orders.length} pesanan tersimpan)
                </span>
                <span className="text-[11px] text-stone-500">
                  Format kompatibel langsung dengan Microsoft Excel &amp; Google Spreadsheet.
                </span>
              </div>
              <button
                onClick={() => downloadOrdersAsCsv(orders)}
                className="px-3.5 py-2 bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 shadow-2xs whitespace-nowrap"
              >
                <Download className="w-4 h-4" />
                <span>Unduh CSV</span>
              </button>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="px-6 py-3.5 bg-stone-50 border-t border-stone-200 flex justify-between items-center">
          <span className="text-[11px] text-stone-500">
            Sinkronisasi 2 Arah Google Sheet &amp; Drive Aktif di Latar Belakang
          </span>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-xs text-stone-600 hover:text-stone-900 rounded-lg"
            >
              Tutup
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg shadow-2xs"
            >
              Simpan Konfigurasi
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
