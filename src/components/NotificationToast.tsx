import React, { useEffect, useRef } from 'react';
import { X, CheckCircle2 } from 'lucide-react';

export interface ToastMessage {
  id: string;
  title: string;
  message: string;
  type?: 'info' | 'success' | 'alert';
}

interface NotificationToastProps {
  toast: ToastMessage | null;
  onClose: () => void;
}

export const NotificationToast: React.FC<NotificationToastProps> = ({
  toast,
  onClose,
}) => {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => {
      onCloseRef.current();
    }, 2000);
    return () => clearTimeout(timer);
  }, [toast?.id]);

  if (!toast) return null;

  return (
    <div className="fixed top-18 inset-x-0 z-50 flex justify-center px-4 pointer-events-none">
      <div className="max-w-sm w-auto bg-stone-900/95 backdrop-blur-md text-stone-100 rounded-xl shadow-lg border border-stone-700/80 px-3.5 py-2.5 flex items-center gap-2.5 pointer-events-auto animate-in fade-in slide-in-from-top-3 duration-150">
        <div className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center shrink-0">
          <CheckCircle2 className="w-3.5 h-3.5" />
        </div>

        <div className="text-xs">
          <span className="font-bold text-white mr-1.5">{toast.title}:</span>
          <span className="text-stone-300 text-[11px]">{toast.message}</span>
        </div>

        <button
          onClick={onClose}
          className="text-stone-400 hover:text-white p-0.5 rounded ml-1 shrink-0"
          aria-label="Tutup notifikasi"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
