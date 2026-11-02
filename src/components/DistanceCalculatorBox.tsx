import React, { useState, useEffect, useRef, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { StoreSettings } from '../types';
import {
  calculateRoadDistanceKm,
  calculateHaversineDistanceKm,
  calculateDeliveryFeeFromDistance,
  reverseGeocodeNominatim,
  normalizeCoordinates,
  DEFAULT_STORE_LAT,
  DEFAULT_STORE_LNG,
  getGoogleMapsPinUrl,
  getGoogleMapsDirectionsUrl,
} from '../services/distanceService';
import { formatCurrency } from '../services/whatsappService';
import {
  MapPin,
  Navigation,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  Crosshair,
} from 'lucide-react';

export interface SpecificAddressDetails {
  street: string;
  house: string;
  landmark: string;
}

interface DistanceCalculatorBoxProps {
  storeSettings?: StoreSettings;
  deliveryAddress: string;
  onChangeAddress: (addr: string, details?: SpecificAddressDetails) => void;
  distanceKm: number | null;
  buyerCoords: { lat: number; lng: number } | null;
  onDistanceCalculated: (
    distanceKm: number | null,
    coords: { lat: number; lng: number } | null,
    detectedAddress?: string
  ) => void;
  onClearValidation?: () => void;
}

// Ikon Pin Penjual (Merah Rose)
const createSellerIcon = (storeName: string) =>
  L.divIcon({
    className: 'ngdimsum-seller-pin',
    html: `<div style="display:flex;flex-direction:column;align-items:center;transform:translate(-50%,-100%);">
      <div style="background:#e11d48;color:#fff;font-size:10px;font-weight:700;padding:2px 6px;border-radius:9999px;white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,0.25);border:1.5px solid #fff;margin-bottom:2px;">
        ${storeName || 'Toko Penjual'}
      </div>
      <div style="width:24px;height:24px;background:#e11d48;border:2.5px solid #fff;border-radius:9999px;display:flex;align-items:center;justify-content:center;box-shadow:0 3px 8px rgba(0,0,0,0.35);">
        <div style="width:8px;height:8px;background:#fff;border-radius:9999px;"></div>
      </div>
    </div>`,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  });

// Ikon Pin Pembeli (Hijau Emerald - Bisa Digeser)
const createBuyerIcon = () =>
  L.divIcon({
    className: 'ngdimsum-buyer-pin',
    html: `<div style="display:flex;flex-direction:column;align-items:center;transform:translate(-50%,-100%);cursor:grab;">
      <div style="background:#059669;color:#fff;font-size:10px;font-weight:700;padding:2px 6px;border-radius:9999px;white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,0.25);border:1.5px solid #fff;margin-bottom:2px;">
        Titik Pembeli
      </div>
      <div style="width:26px;height:26px;background:#10b981;border:2.5px solid #fff;border-radius:9999px;display:flex;align-items:center;justify-content:center;box-shadow:0 3px 8px rgba(0,0,0,0.35);">
        <div style="width:8px;height:8px;background:#fff;border-radius:9999px;"></div>
      </div>
    </div>`,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  });

export const DistanceCalculatorBox: React.FC<DistanceCalculatorBoxProps> = ({
  storeSettings,
  deliveryAddress,
  onChangeAddress,
  distanceKm,
  buyerCoords,
  onDistanceCalculated,
  onClearValidation,
}) => {
  const storeName = storeSettings?.storeName || 'Ngdimsum';
  const [isLocatingGps, setIsLocatingGps] = useState(false);
  const [isAutoCalculating, setIsAutoCalculating] = useState(false);
  const [detectedLocationLabel, setDetectedLocationLabel] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [estimatedMinutes, setEstimatedMinutes] = useState<number | null>(null);
  const [routeGeometry, setRouteGeometry] = useState<Array<[number, number]>>([]);

  // Field Detail Alamat Spesifik (Hanya untuk panduan kurir, TIDAK mengubah titik/ongkir)
  const [streetInput, setStreetInput] = useState<string>(() => deliveryAddress || '');
  const [houseInput, setHouseInput] = useState<string>('');
  const [landmarkInput, setLandmarkInput] = useState<string>('');

  const updateCombinedSpecificAddress = (
    nextStreet: string,
    nextHouse: string,
    nextLandmark: string
  ) => {
    const parts: string[] = [];
    if (nextStreet.trim()) parts.push(nextStreet.trim());
    if (nextHouse.trim()) parts.push(`No/RT-RW: ${nextHouse.trim()}`);
    if (nextLandmark.trim()) parts.push(`Patokan: ${nextLandmark.trim()}`);
    const full = parts.join(' | ');
    onChangeAddress(full, {
      street: nextStreet.trim(),
      house: nextHouse.trim(),
      landmark: nextLandmark.trim(),
    });
    if (onClearValidation) onClearValidation();
  };

  // Gunakan LANGSUNG titik koordinat penjual yang sudah disetting di Pengaturan Toko
  const resolvedRawStore = (() => {
    let rawLat = storeSettings?.storeLat;
    let rawLng = storeSettings?.storeLng;
    if (
      typeof rawLat !== 'number' ||
      typeof rawLng !== 'number' ||
      isNaN(rawLat) ||
      isNaN(rawLng)
    ) {
      try {
        const manualSaved = localStorage.getItem('ngdimsum_manual_store_coords_v1');
        if (manualSaved) {
          const parsedManual = JSON.parse(manualSaved);
          if (
            typeof parsedManual.lat === 'number' &&
            typeof parsedManual.lng === 'number' &&
            !isNaN(parsedManual.lat) &&
            !isNaN(parsedManual.lng)
          ) {
            rawLat = parsedManual.lat;
            rawLng = parsedManual.lng;
          }
        }
      } catch (e) {}
    }
    return normalizeCoordinates(
      rawLat ?? DEFAULT_STORE_LAT,
      rawLng ?? DEFAULT_STORE_LNG
    );
  })();
  const storeLat = resolvedRawStore.lat;
  const storeLng = resolvedRawStore.lng;

  const perKmRate = storeSettings?.deliveryFeePerKm ?? 2000;
  const minFee = storeSettings?.deliveryFeeMin ?? 8000;
  const maxDistanceKm = storeSettings?.maxDeliveryDistanceKm ?? 25;
  const useDistance = storeSettings?.useDistanceDelivery !== false;

  const calculatedFee = calculateDeliveryFeeFromDistance(distanceKm, storeSettings);
  const isOverMaxDistance =
    useDistance && distanceKm !== null && maxDistanceKm > 0 && distanceKm > maxDistanceKm;

  const lastStoreKeyRef = useRef<string>('');

  // Refs untuk Leaflet Map & kontrol kamera agar tidak mereset zoom saat pengguna melakukan zoom manual
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const sellerMarkerRef = useRef<L.Marker | null>(null);
  const buyerMarkerRef = useRef<L.Marker | null>(null);
  const routePolylineRef = useRef<L.Polyline | null>(null);
  const handlePinSetByUserRef = useRef<(lat: number, lng: number) => void>(() => {});
  const onDistanceCalculatedRef = useRef(onDistanceCalculated);
  const shouldAutoFitMapRef = useRef<boolean>(true);
  const lastCenteredStoreKeyRef = useRef<string>('');
  const mapClickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    onDistanceCalculatedRef.current = onDistanceCalculated;
  }, [onDistanceCalculated]);

  // Fungsi menghitung jarak rute jalan raya MURNI dari titik koordinat toko ke titik lokasi pembeli
  const computeRouteFromBuyerCoords = useCallback(
    async (
      rawLat: number,
      rawLng: number,
      locationLabel?: string,
      isSilent?: boolean
    ) => {
      const normBuyer = normalizeCoordinates(rawLat, rawLng, storeLat, storeLng);
      const route = await calculateRoadDistanceKm(
        storeLat,
        storeLng,
        normBuyer.lat,
        normBuyer.lng
      );

      if (route.isOutOfRegion) {
        onDistanceCalculatedRef.current(null, null);
        setEstimatedMinutes(null);
        setRouteGeometry([]);
        setStatusMessage(null);
        if (!isSilent) {
          setErrorMessage(
            `Titik lokasi yang dipilih berada terlalu jauh di luar jangkauan wilayah ${storeName}. Silakan geser pin ke area sekitar toko.`
          );
        }
        return;
      }

      setEstimatedMinutes(route.durationMinutes);
      setRouteGeometry(
        route.routeGeometry || [
          [storeLat, storeLng],
          [normBuyer.lat, normBuyer.lng],
        ]
      );
      if (locationLabel) {
        setDetectedLocationLabel(locationLabel);
      }
      onDistanceCalculatedRef.current(
        route.distanceKm,
        { lat: normBuyer.lat, lng: normBuyer.lng },
        locationLabel
      );
      setStatusMessage(
        `Jarak rute dihitung dari titik lokasi pembeli: ${route.distanceKm} km.`
      );
      setErrorMessage(null);
      if (onClearValidation) onClearValidation();
    },
    [storeLat, storeLng, storeName, onClearValidation]
  );

  // Saat pembeli klik pada peta Leaflet atau menggeser pin hijau pembeli
  const handlePinSetByUser = useCallback(
    async (lat: number, lng: number) => {
      // Jangan ubah posisi zoom peta saat pembeli sedang klik/geser pin manual di peta
      shouldAutoFitMapRef.current = false;
      setIsAutoCalculating(true);
      setErrorMessage(null);

      const norm = normalizeCoordinates(lat, lng, storeLat, storeLng);

      try {
        await computeRouteFromBuyerCoords(
          norm.lat,
          norm.lng,
          `Titik Pembeli (${norm.lat.toFixed(5)}, ${norm.lng.toFixed(5)})`,
          false
        );

        const rev = await reverseGeocodeNominatim(norm.lat, norm.lng);
        if (rev) {
          setDetectedLocationLabel(rev);
        }
      } finally {
        setIsAutoCalculating(false);
      }
    },
    [storeLat, storeLng, computeRouteFromBuyerCoords]
  );

  useEffect(() => {
    handlePinSetByUserRef.current = handlePinSetByUser;
  }, [handlePinSetByUser]);

  // Inisialisasi Peta Leaflet
  useEffect(() => {
    if (!useDistance || !mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [storeLat, storeLng],
      zoom: 15,
      zoomControl: true,
      attributionControl: true,
      scrollWheelZoom: true,
      touchZoom: true,
      doubleClickZoom: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap',
    }).addTo(map);

    const sellerMarker = L.marker([storeLat, storeLng], {
      icon: createSellerIcon(storeName),
      interactive: true,
    })
      .addTo(map)
      .bindPopup(
        `<b>Lokasi ${storeName}</b><br/>${
          storeSettings?.storeAddress || storeName
        }<br/><span style="font-family:monospace;font-size:10px;">${storeLat.toFixed(
          6
        )}, ${storeLng.toFixed(6)}</span>`
      );

    sellerMarkerRef.current = sellerMarker;

    // Batalkan auto-fit & timer klik jika pengguna sedang melakukan zoom / double-click zoom
    map.on('zoomstart', () => {
      shouldAutoFitMapRef.current = false;
      if (mapClickTimerRef.current) {
        clearTimeout(mapClickTimerRef.current);
        mapClickTimerRef.current = null;
      }
    });

    map.on('dblclick', () => {
      shouldAutoFitMapRef.current = false;
      if (mapClickTimerRef.current) {
        clearTimeout(mapClickTimerRef.current);
        mapClickTimerRef.current = null;
      }
    });

    map.on('dragstart', () => {
      shouldAutoFitMapRef.current = false;
    });

    map.on('click', (e: L.LeafletMouseEvent) => {
      if (mapClickTimerRef.current) {
        clearTimeout(mapClickTimerRef.current);
      }
      const clickedLat = e.latlng.lat;
      const clickedLng = e.latlng.lng;
      mapClickTimerRef.current = setTimeout(() => {
        mapClickTimerRef.current = null;
        handlePinSetByUserRef.current(clickedLat, clickedLng);
      }, 200);
    });

    mapInstanceRef.current = map;

    const resizeTimer = setTimeout(() => {
      map.invalidateSize();
    }, 250);

    return () => {
      clearTimeout(resizeTimer);
      if (mapClickTimerRef.current) {
        clearTimeout(mapClickTimerRef.current);
        mapClickTimerRef.current = null;
      }
      map.remove();
      mapInstanceRef.current = null;
      sellerMarkerRef.current = null;
      buyerMarkerRef.current = null;
      routePolylineRef.current = null;
    };
  }, [useDistance]);

  // Sinkronkan posisi Marker Penjual (sesuai Pengaturan), Marker Pembeli (Draggable), dan Garis Rute di Peta Leaflet
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const currentStoreKey = `${storeLat.toFixed(6)},${storeLng.toFixed(6)}`;
    const storeCoordsChanged = lastCenteredStoreKeyRef.current !== currentStoreKey;

    if (sellerMarkerRef.current) {
      sellerMarkerRef.current.setLatLng([storeLat, storeLng]);
      sellerMarkerRef.current.setIcon(createSellerIcon(storeName));
      sellerMarkerRef.current.setPopupContent(
        `<b>Lokasi ${storeName}</b><br/>${
          storeSettings?.storeAddress || storeName
        }<br/><span style="font-family:monospace;font-size:10px;">${storeLat.toFixed(
          6
        )}, ${storeLng.toFixed(6)}</span>`
      );
    }

    // Cegah koordinat pembeli lama (misal dari cache kota lain > 80 km) menarik peta menjauh dari toko penjual
    const validBuyerCoords =
      buyerCoords &&
      calculateHaversineDistanceKm(storeLat, storeLng, buyerCoords.lat, buyerCoords.lng) <= 80
        ? buyerCoords
        : null;

    if (buyerCoords && !validBuyerCoords) {
      onDistanceCalculatedRef.current(null, null);
    }

    if (validBuyerCoords) {
      if (!buyerMarkerRef.current) {
        const marker = L.marker([validBuyerCoords.lat, validBuyerCoords.lng], {
          icon: createBuyerIcon(),
          draggable: true,
        }).addTo(map);

        marker.on('dragstart', () => {
          shouldAutoFitMapRef.current = false;
        });

        marker.on('dragend', () => {
          shouldAutoFitMapRef.current = false;
          const pos = marker.getLatLng();
          handlePinSetByUserRef.current(pos.lat, pos.lng);
        });

        buyerMarkerRef.current = marker;
      } else {
        buyerMarkerRef.current.setLatLng([validBuyerCoords.lat, validBuyerCoords.lng]);
      }
    } else if (buyerMarkerRef.current) {
      buyerMarkerRef.current.remove();
      buyerMarkerRef.current = null;
    }

    if (routePolylineRef.current) {
      routePolylineRef.current.remove();
      routePolylineRef.current = null;
    }

    if (validBuyerCoords) {
      const pathCoords: L.LatLngExpression[] =
        routeGeometry && routeGeometry.length >= 2
          ? routeGeometry.map((pt) => [pt[0], pt[1]] as [number, number])
          : [
              [storeLat, storeLng],
              [validBuyerCoords.lat, validBuyerCoords.lng],
            ];

      const polyline = L.polyline(pathCoords, {
        color: '#e11d48',
        weight: 4,
        opacity: 0.85,
      }).addTo(map);

      routePolylineRef.current = polyline;

      // Hanya atur ulang tampilan/zoom peta jika baru pertama kali dimuat, titik toko berubah, atau diminta via GPS
      if (storeCoordsChanged || shouldAutoFitMapRef.current) {
        lastCenteredStoreKeyRef.current = currentStoreKey;
        shouldAutoFitMapRef.current = false;
        const bounds = L.latLngBounds([
          [storeLat, storeLng],
          [validBuyerCoords.lat, validBuyerCoords.lng],
        ]);
        if (routeGeometry && routeGeometry.length > 2) {
          routeGeometry.forEach((pt) => bounds.extend([pt[0], pt[1]]));
        }
        map.invalidateSize();
        map.fitBounds(bounds, { padding: [32, 32], maxZoom: 16 });
      }
    } else if (storeCoordsChanged || shouldAutoFitMapRef.current) {
      lastCenteredStoreKeyRef.current = currentStoreKey;
      shouldAutoFitMapRef.current = false;
      map.invalidateSize();
      map.setView([storeLat, storeLng], 15);
    }
  }, [storeLat, storeLng, buyerCoords, routeGeometry, storeSettings?.storeAddress, storeName]);

  // Jika titik toko berubah sementara titik pembeli sudah dipilih, hitung ulang rute dari titik pembeli
  useEffect(() => {
    if (!useDistance || !buyerCoords) return;

    const currentStoreKey = `${storeLat.toFixed(6)},${storeLng.toFixed(6)}`;
    const storeChanged = lastStoreKeyRef.current !== currentStoreKey;

    if (storeChanged || distanceKm === null) {
      lastStoreKeyRef.current = currentStoreKey;
      computeRouteFromBuyerCoords(
        buyerCoords.lat,
        buyerCoords.lng,
        detectedLocationLabel || undefined,
        true
      );
    }
  }, [
    storeLat,
    storeLng,
    useDistance,
    distanceKm,
    buyerCoords,
    detectedLocationLabel,
    computeRouteFromBuyerCoords,
  ]);

  // Gunakan GPS Pembeli (1-Klik) untuk menentukan Titik Lokasi Pembeli
  const handleUseMyGps = () => {
    if (!navigator.geolocation) {
      setErrorMessage(
        'Browser Anda tidak mendukung GPS otomatis. Silakan klik titik lokasi Anda langsung pada peta di bawah.'
      );
      return;
    }

    setIsLocatingGps(true);
    setErrorMessage(null);
    setStatusMessage('Mendeteksi titik lokasi GPS Anda...');

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const normBuyer = normalizeCoordinates(
            pos.coords.latitude,
            pos.coords.longitude,
            storeLat,
            storeLng
          );

          const routeCheck = await calculateRoadDistanceKm(
            storeLat,
            storeLng,
            normBuyer.lat,
            normBuyer.lng
          );

          if (routeCheck.isOutOfRegion || routeCheck.distanceKm > 100) {
            onDistanceCalculatedRef.current(null, null);
            setEstimatedMinutes(null);
            setStatusMessage(null);
            setErrorMessage(
              `GPS perangkat mendeteksi lokasi jaringan yang jauh dari ${storeName}. Silakan klik langsung titik lokasi Anda pada peta di bawah.`
            );
            return;
          }

          shouldAutoFitMapRef.current = true;
          await handlePinSetByUser(normBuyer.lat, normBuyer.lng);
          if (mapInstanceRef.current) {
            const bounds = L.latLngBounds([
              [storeLat, storeLng],
              [normBuyer.lat, normBuyer.lng],
            ]);
            mapInstanceRef.current.fitBounds(bounds, { padding: [32, 32], maxZoom: 16 });
          }
        } catch {
          setErrorMessage('Gagal menghitung rute dari titik GPS.');
        } finally {
          setIsLocatingGps(false);
        }
      },
      () => {
        setIsLocatingGps(false);
        setStatusMessage(null);
        setErrorMessage(
          'Izin GPS tidak aktif. Silakan klik langsung lokasi Anda pada peta di bawah untuk mengatur titik pembeli.'
        );
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  // Tombol cepat untuk menaruh pin pembeli di tengah peta yang sedang dilihat lalu digeser
  const handlePlacePinAtMapCenter = () => {
    const map = mapInstanceRef.current;
    shouldAutoFitMapRef.current = false;
    if (map) {
      const center = map.getCenter();
      const isSameAsStore =
        Math.abs(center.lat - storeLat) < 0.0002 &&
        Math.abs(center.lng - storeLng) < 0.0002;
      const targetLat = isSameAsStore ? storeLat + 0.0015 : center.lat;
      const targetLng = isSameAsStore ? storeLng + 0.0015 : center.lng;
      handlePinSetByUser(targetLat, targetLng);
    } else {
      handlePinSetByUser(storeLat + 0.0015, storeLng + 0.0015);
    }
  };

  return (
    <div className="space-y-2.5 bg-white p-2.5 sm:p-3 rounded-xl border border-rose-200/90 shadow-2xs animate-fade-smooth min-w-0 overflow-hidden">
      {/* 1. Detail Alamat Pengantaran Lebih Spesifik (Untuk Panduan Kurir) */}
      <div className="space-y-2.5 min-w-0">
        <div className="flex items-center justify-between gap-2 min-w-0">
          <span className="text-[11px] font-bold text-stone-800 leading-tight min-w-0 truncate">
            Detail Alamat Pengantaran <span className="text-rose-500">*</span>
          </span>
          {useDistance && (
            <span className="shrink-0 whitespace-nowrap text-[10px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200/80">
              {formatCurrency(perKmRate)}/km
            </span>
          )}
        </div>

        {/* Kolom 1: Nama Jalan / Gang, Desa / Kelurahan, Kecamatan */}
        <div>
          <label className="block text-[10px] font-semibold text-stone-700 mb-1">
            Nama Jalan / Gang, Desa / Kelurahan &amp; Kecamatan <span className="text-rose-500">*</span>
          </label>
          <textarea
            rows={2}
            required
            value={streetInput}
            onChange={(e) => {
              const val = e.target.value;
              setStreetInput(val);
              updateCombinedSpecificAddress(val, houseInput, landmarkInput);
            }}
            placeholder="Contoh: Jl. Raya Sindangkasih, Gg. Mawar, Desa Sindangkasih, Kec. Ciamis"
            className="w-full px-2.5 py-1.5 text-xs leading-relaxed bg-stone-50/70 border border-stone-200 rounded-lg resize-none focus:outline-none focus:bg-white focus:border-rose-400 transition-colors"
          />
        </div>

        {/* Kolom 2: Nomor Rumah, RT/RW, Blok / Nama Perumahan / Kos */}
        <div>
          <label className="block text-[10px] font-semibold text-stone-700 mb-1">
            Nomor Rumah / RT-RW / Blok / Nama Perumahan atau Kos
          </label>
          <input
            type="text"
            value={houseInput}
            onChange={(e) => {
              const val = e.target.value;
              setHouseInput(val);
              updateCombinedSpecificAddress(streetInput, val, landmarkInput);
            }}
            placeholder="Contoh: No. 14, RT 02 / RW 05, Perum Griya Asri Blok B2"
            className="w-full px-2.5 py-1.5 text-xs bg-stone-50/70 border border-stone-200 rounded-lg focus:outline-none focus:bg-white focus:border-rose-400 transition-colors"
          />
        </div>

        {/* Kolom 3: Detail Patokan & Ciri Bangunan Spesifik */}
        <div>
          <label className="block text-[10px] font-semibold text-stone-700 mb-1">
            Patokan Lokasi &amp; Ciri Rumah Spesifik (Memudahkan Kurir)
          </label>
          <input
            type="text"
            value={landmarkInput}
            onChange={(e) => {
              const val = e.target.value;
              setLandmarkInput(val);
              updateCombinedSpecificAddress(streetInput, houseInput, val);
            }}
            placeholder="Contoh: Rumah pagar hitam cat krem, samping Masjid Al-Ikhlas / seberang Alfamart"
            className="w-full px-2.5 py-1.5 text-xs bg-stone-50/70 border border-stone-200 rounded-lg focus:outline-none focus:bg-white focus:border-rose-400 transition-colors"
          />
        </div>
      </div>

      {/* 2. Titik Lokasi Pembeli di Peta (Penentu Perhitungan Ongkir) */}
      {useDistance && (
        <div className="pt-2.5 border-t border-rose-100 space-y-2 min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-1.5 min-w-0">
            <span className="text-[11px] font-bold text-stone-800 leading-tight">
              Titik Lokasi Pembeli (Penentu Ongkir) <span className="text-rose-500">*</span>
            </span>
            {isAutoCalculating && (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-rose-600 shrink-0">
                <Loader2 className="w-3 h-3 animate-spin shrink-0" />
                <span>Menghitung...</span>
              </span>
            )}
          </div>

          {/* Tombol Aksi Cepat Menentukan Titik Lokasi Pembeli */}
          <div className="grid grid-cols-2 gap-1.5 min-w-0">
            <button
              type="button"
              disabled={isLocatingGps || isAutoCalculating}
              onClick={handleUseMyGps}
              className="w-full min-w-0 py-2 px-1.5 sm:px-2 bg-rose-500 hover:bg-rose-600 disabled:bg-stone-300 text-white font-bold text-[10px] sm:text-[11px] rounded-lg flex items-center justify-center gap-1 transition-all shadow-2xs active:scale-95"
            >
              {isLocatingGps ? (
                <Loader2 className="w-3 h-3 sm:w-3.5 sm:h-3.5 animate-spin shrink-0" />
              ) : (
                <Navigation className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
              )}
              <span className="truncate">Gunakan GPS Saya</span>
            </button>

            <button
              type="button"
              disabled={isAutoCalculating || isLocatingGps}
              onClick={handlePlacePinAtMapCenter}
              className="w-full min-w-0 py-2 px-1.5 sm:px-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-[10px] sm:text-[11px] rounded-lg flex items-center justify-center gap-1 transition-all shadow-2xs active:scale-95"
              title="Taruh pin pembeli di tengah peta lalu geser sesuai lokasi Anda"
            >
              <Crosshair className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
              <span className="truncate">Taruh Pin di Peta</span>
            </button>
          </div>

          {/* Peta Interaktif Leaflet untuk Mengatur Titik Koordinat Pembeli */}
          <div className="rounded-xl overflow-hidden border border-stone-200 bg-stone-50 shadow-2xs min-w-0">
            {/* Header Peta Rapi & Presisi di HP */}
            <div className="px-2.5 py-1.5 bg-emerald-50/90 border-b border-emerald-200/80 flex flex-wrap items-center justify-between gap-1 min-w-0">
              <div className="flex items-center gap-1 min-w-0">
                <span className="text-[11px] leading-none shrink-0">📍</span>
                <span className="text-[10px] font-semibold text-emerald-950 leading-tight truncate">
                  Klik peta / geser pin hijau
                </span>
              </div>
              {buyerCoords && (
                <span className="font-mono text-[9px] font-medium text-emerald-800 bg-white/95 px-1.5 py-0.5 rounded border border-emerald-200/90 shrink-0 whitespace-nowrap">
                  {buyerCoords.lat.toFixed(4)}, {buyerCoords.lng.toFixed(4)}
                </span>
              )}
            </div>

            {/* Kanvas Peta Leaflet */}
            <div
              ref={mapContainerRef}
              className="h-44 sm:h-52 w-full z-0 cursor-crosshair"
            />

            {/* Footer Legenda Peta */}
            <div className="px-2.5 py-1.5 bg-stone-100/90 border-t border-stone-200 flex flex-wrap items-center justify-between gap-x-2 gap-y-1 text-[10px] text-stone-600 min-w-0">
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 min-w-0">
                <span className="inline-flex items-center gap-1 font-semibold whitespace-nowrap">
                  <span className="w-2 h-2 rounded-full bg-rose-600 inline-block shrink-0" />
                  <span>{storeName}</span>
                </span>
                <span className="inline-flex items-center gap-1 font-semibold whitespace-nowrap">
                  <span className="w-2 h-2 rounded-full bg-emerald-600 inline-block shrink-0" />
                  <span>Titik Pembeli</span>
                </span>
              </div>
              {buyerCoords ? (
                <a
                  href={getGoogleMapsDirectionsUrl(
                    storeLat,
                    storeLng,
                    buyerCoords.lat,
                    buyerCoords.lng
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-rose-600 hover:underline font-bold shrink-0 inline-flex items-center gap-0.5 whitespace-nowrap"
                >
                  <span>Rute Maps</span>
                  <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                </a>
              ) : (
                <a
                  href={getGoogleMapsPinUrl(storeLat, storeLng)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-rose-600 hover:underline font-bold shrink-0 inline-flex items-center gap-0.5 whitespace-nowrap"
                >
                  <span>Buka Maps</span>
                  <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                </a>
              )}
            </div>
          </div>

          {/* Pesan Error */}
          {errorMessage && (
            <div className="p-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-[11px] leading-snug flex items-start gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Kartu Hasil Pengukuran Jarak & Ongkir Otomatis dari Titik Lokasi Pembeli */}
          {buyerCoords && distanceKm !== null && distanceKm > 0 ? (
            <div
              className={`p-2.5 rounded-lg border text-[11px] space-y-1 transition-all min-w-0 ${
                isOverMaxDistance
                  ? 'bg-rose-50 border-rose-300 text-rose-900'
                  : 'bg-emerald-50/90 border-emerald-200 text-emerald-950'
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-1.5 font-bold min-w-0">
                <span className="flex items-center gap-1 min-w-0">
                  <CheckCircle2
                    className={`w-3.5 h-3.5 shrink-0 ${
                      isOverMaxDistance ? 'text-rose-600' : 'text-emerald-600'
                    }`}
                  />
                  <span className="whitespace-nowrap">Jarak: {distanceKm} km</span>
                </span>
                <span className="font-mono text-[11px] px-2 py-0.5 rounded-md bg-white border border-emerald-200/90 shrink-0 whitespace-nowrap shadow-2xs">
                  Ongkir {formatCurrency(calculatedFee)}
                </span>
              </div>

              <div className="flex items-center justify-between gap-1 text-[10px] text-stone-600 min-w-0">
                <span className="truncate">
                  {distanceKm} km × {formatCurrency(perKmRate)}/km (Min. {formatCurrency(minFee)})
                  {estimatedMinutes ? ` · ~${estimatedMinutes} mnt` : ''}
                </span>
              </div>

              {detectedLocationLabel && (
                <div className="text-[10px] text-stone-500 line-clamp-1 pt-0.5 border-t border-emerald-200/50">
                  📍 {detectedLocationLabel}
                </div>
              )}

              {isOverMaxDistance && (
                <div className="text-[10px] font-semibold text-rose-700 pt-0.5">
                  ⚠️ Jarak melebihi batas pengantaran maksimal ({maxDistanceKm} km). Silakan konfirmasi ke admin via WhatsApp.
                </div>
              )}
            </div>
          ) : (
            <div className="text-[10px] text-stone-500 leading-snug px-0.5">
              {statusMessage ||
                'Klik titik lokasi Anda pada peta di atas atau tekan "Gunakan GPS Saya" — ongkir dihitung otomatis dari titik lokasi pembeli.'}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
