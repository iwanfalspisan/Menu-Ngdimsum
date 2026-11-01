import { Order } from '../types';

export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

export const createWhatsappAdminMessage = (order: Order, storeName: string = 'Ngdimsum'): string => {
  const orderTypeLabel =
    order.customer.orderType === 'delivery'
      ? 'Pesan Antar / Kirim Kurir'
      : 'Ambil Sendiri di Dapur';

  const itemsList = order.items
    .map((item, idx) => {
      const piecesInfo = item.pieces ? ` (${item.pieces})` : '';
      let line = `${idx + 1}. *${item.name}*${piecesInfo} x${item.quantity} = *${formatCurrency(item.subtotal)}*`;
      if (item.chiliLevel && item.chiliLevel !== 'Normal') {
        line += `\n   • Sambal: _${item.chiliLevel}_`;
      }
      if (item.notes) {
        line += `\n   • Catatan: _${item.notes}_`;
      }
      return line;
    })
    .join('\n');

  let addressInfo = '';
  if (order.customer.orderType === 'delivery' && order.customer.deliveryAddress) {
    addressInfo = `\n📍 *Alamat Pengantaran:* ${order.customer.deliveryAddress}`;
    if (order.customer.deliveryDistanceKm && order.customer.deliveryDistanceKm > 0) {
      addressInfo += `\n📏 *Jarak dari Dapur:* ${order.customer.deliveryDistanceKm} km`;
    }
    if (
      order.customer.deliveryLat !== undefined &&
      order.customer.deliveryLng !== undefined
    ) {
      addressInfo += `\n🗺️ *Titik Maps:* https://www.google.com/maps?q=${order.customer.deliveryLat},${order.customer.deliveryLng}`;
    }
  }

  let customerNotes = '';
  if (order.customer.notes) {
    customerNotes = `\n📝 *Catatan Tambahan:* ${order.customer.notes}`;
  }

  const distanceSuffix =
    order.customer.orderType === 'delivery' &&
    order.customer.deliveryDistanceKm &&
    order.customer.deliveryDistanceKm > 0
      ? ` (${order.customer.deliveryDistanceKm} km)`
      : '';

  const deliveryLine =
    order.customer.orderType === 'delivery'
      ? `\nOngkos Kirim${distanceSuffix}: ${formatCurrency(order.deliveryFee)}`
      : '';

  return `Halo *${storeName}*, saya mau pesan menu dimsum berikut:

📋 *ID Pesanan:* #${order.id}
👤 *Nama Pemesan:* ${order.customer.name}
📱 *No. WhatsApp:* ${order.customer.phone}
🛍️ *Metode Ambil:* ${orderTypeLabel}${addressInfo}${customerNotes}

🥟 *DAFTAR MENU PESANAN:*
${itemsList}

💰 *RINCIAN TOTAL:*
Subtotal Menu: ${formatCurrency(order.subtotal)}${deliveryLine}
*TOTAL PESANAN: ${formatCurrency(order.total)}*

Mohon diproses ya Kak, terima kasih! 🙏`;
};

export const getAdminWhatsappUrl = (
  order: Order,
  adminPhone: string,
  storeName: string
): string => {
  const cleanPhone = adminPhone.replace(/[^0-9]/g, '');
  const finalPhone = cleanPhone.startsWith('0')
    ? '62' + cleanPhone.slice(1)
    : cleanPhone;

  const message = createWhatsappAdminMessage(order, storeName);
  return `https://api.whatsapp.com/send?phone=${finalPhone}&text=${encodeURIComponent(
    message
  )}`;
};

export const getCustomerWhatsappUrl = (
  order: Order,
  storeName: string
): string => {
  const cleanPhone = order.customer.phone.replace(/[^0-9]/g, '');
  const finalPhone = cleanPhone.startsWith('0')
    ? '62' + cleanPhone.slice(1)
    : cleanPhone;

  const msg = `Halo Kak *${order.customer.name}*, terima kasih sudah memesan di *${storeName}*! 🙏\n\nPesanan Kakak *#${order.id}* sebesar *${formatCurrency(
    order.total
  )}* telah kami terima dan langsung diproses.\n\nJika ada pertanyaan mengenai pesanan, Kakak bisa langsung membalas pesan ini ya! 😊`;

  return `https://api.whatsapp.com/send?phone=${finalPhone}&text=${encodeURIComponent(
    msg
  )}`;
};
