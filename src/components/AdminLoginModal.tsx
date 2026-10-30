import React, { useState } from 'react';
import { Lock, X, KeyRound, AlertCircle, CheckCircle2 } from 'lucide-react';

interface AdminLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const AdminLoginModal: React.FC<AdminLoginModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Default PIN: 1234 or saved custom PIN in localStorage
    const savedPin = localStorage.getItem('dimsum_admin_pin') || '1234';

    if (pin.trim() === savedPin) {
      setError(false);
      setPin('');
      onSuccess();
    } else {
      setError(true);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/70 backdrop-blur-xs">
      <div className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl border border-rose-100 p-6 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-stone-400 hover:text-stone-700 p-1"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="text-center mb-5">
          <div className="w-12 h-12 rounded-full bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto mb-3 shadow-2xs">
            <Lock className="w-6 h-6" />
          </div>
          <h3 className="font-serif-brand text-lg font-bold text-stone-900">
            Akses Pengelola Dapur
          </h3>
          <p className="text-xs text-stone-500 mt-1">
            Area privat pemilik untuk memantau pesanan &amp; integrasi Google Sheets.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Masukkan PIN Admin:
            </label>
            <div className="relative">
              <KeyRound className="w-4 h-4 text-rose-400 absolute left-3 top-2.5" />
              <input
                type="password"
                required
                autoFocus
                maxLength={8}
                value={pin}
                onChange={(e) => {
                  setPin(e.target.value);
                  if (error) setError(false);
                }}
                placeholder="PIN (Default: 1234)"
                className="w-full pl-9 pr-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:border-rose-400 focus:ring-1 focus:ring-rose-200 font-mono tracking-widest text-center"
              />
            </div>
            {error && (
              <div className="flex items-center gap-1 text-[11px] text-rose-600 mt-1.5 font-medium">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>PIN salah. Silakan coba lagi (Default: 1234).</span>
              </div>
            )}
          </div>

          <button
            type="submit"
            className="w-full py-2.5 bg-rose-500 hover:bg-rose-600 text-white font-bold text-xs rounded-xl shadow transition-colors flex items-center justify-center gap-1.5 active:scale-98"
          >
            <span>Buka Dasbor Dapur</span>
          </button>
        </form>

        <div className="mt-4 pt-3 border-t border-stone-100 text-center text-[10px] text-stone-400">
          PIN default adalah <strong className="text-stone-600">1234</strong>. Anda dapat mengubahnya di pengaturan dasbor.
        </div>
      </div>
    </div>
  );
};
