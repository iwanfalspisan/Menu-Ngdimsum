import { OrderStatus } from '../types';

/**
 * Play a gentle culinary chime sound using Web Audio API
 */
export const playNotificationChime = (type: 'order_placed' | 'status_update' | 'kitchen_alert' = 'status_update'): void => {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();

    if (type === 'order_placed') {
      // Pleasant rising arpeggio (C5 -> E5 -> G5 -> C6)
      const freqs = [523.25, 659.25, 783.99, 1046.5];
      freqs.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.1);
        gain.gain.setValueAtTime(0, ctx.currentTime + idx * 0.1);
        gain.gain.linearRampToValueAtTime(0.15, ctx.currentTime + idx * 0.1 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.1 + 0.35);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + idx * 0.1);
        osc.stop(ctx.currentTime + idx * 0.1 + 0.4);
      });
    } else if (type === 'kitchen_alert') {
      // Double attention beep (E5 -> A5)
      [659.25, 880.0].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.14);
        gain.gain.setValueAtTime(0.18, ctx.currentTime + idx * 0.14);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.14 + 0.25);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + idx * 0.14);
        osc.stop(ctx.currentTime + idx * 0.14 + 0.3);
      });
    } else {
      // Gentle status chime (G5 -> C6)
      [783.99, 1046.5].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.12);
        gain.gain.setValueAtTime(0.12, ctx.currentTime + idx * 0.12);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.12 + 0.4);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + idx * 0.12);
        osc.stop(ctx.currentTime + idx * 0.12 + 0.45);
      });
    }
  } catch (e) {
    console.debug('AudioContext not allowed or not supported yet:', e);
  }
};

/**
 * Request browser push notification permission
 */
export const requestPushPermission = async (): Promise<boolean> => {
  if (!('Notification' in window)) {
    console.info('Browser does not support notifications');
    return false;
  }

  if (Notification.permission === 'granted') {
    return true;
  }

  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }

  return false;
};

export const isPushPermissionGranted = (): boolean => {
  return typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted';
};

/**
 * Dispatch desktop push notification
 */
export const sendOrderPushNotification = (
  orderId: string,
  newStatus: OrderStatus,
  customerName?: string
): void => {
  playNotificationChime(newStatus === 'menunggu_pembayaran' ? 'kitchen_alert' : 'status_update');

  const statusMessages: Record<OrderStatus, { title: string; body: string }> = {
    menunggu_pembayaran: {
      title: '⏳ Menunggu Pembayaran',
      body: `Pesanan #${orderId}: Mohon selesaikan pembayaran agar pesanan segera dikukus.`,
    },
    diproses_dapur: {
      title: '🥟 Sedang Dimasak di Dapur',
      body: `Pesanan #${orderId}: Tim koki Hao Dimsum sedang mengukus & menggoreng dimsum Anda. Harum!`,
    },
    siap_saji: {
      title: '✨ Dimsum Siap Disajikan / Diambil!',
      body: `Pesanan #${orderId}: Dimsum hangat Anda sudah matang sempurna dan siap dinikmati!`,
    },
    dalam_pengiriman: {
      title: '🛵 Sedang Dalam Perjalanan',
      body: `Pesanan #${orderId}: Kurir sedang mengantar dimsum hangat menuju alamat Anda.`,
    },
    selesai: {
      title: '🎉 Pesanan Selesai!',
      body: `Pesanan #${orderId} telah selesai. Selamat menikmati hidangan Hao Dimsum!`,
    },
    dibatalkan: {
      title: '❌ Pesanan Dibatalkan',
      body: `Pesanan #${orderId} telah dibatalkan. Hubungi admin via WhatsApp untuk info lebih lanjut.`,
    },
  };

  const info = statusMessages[newStatus];
  if (!info) return;

  if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
    try {
      new Notification(info.title, {
        body: info.body,
        icon: '/favicon.ico',
        tag: `order-${orderId}-${newStatus}`,
      });
    } catch (e) {
      console.debug('Notification trigger error:', e);
    }
  }
};
