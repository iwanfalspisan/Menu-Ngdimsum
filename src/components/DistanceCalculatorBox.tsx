import React, { useState, useEffect, useRef, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { StoreSettings } from '../types';
import {
  calculateRoadDistanceKm,
  calculateHaversineDistanceKm,
  calculateDeliveryFeeFromDistance,
  searchAddressNominatim,
  reverseGeocodeNominatim,
  parseCoordinatesFromInput,
  normalizeCoordinates,
  DEFAULT_STORE_LAT,
  DEFAULT_STORE_LNG,
  GeocodedLocation,
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
  RotateCcw,
  Crosshair,
} from 'lucide-react';

interface DistanceCalculatorBoxProps {
  storeSettings?: StoreSettings;
  deliveryAddress: string;
  onChangeAddress: (addr: string) => void;
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
const createSellerIcon = () =>
  L.divIcon({
    className: 'ngdimsum-seller-pin',
    html: `<div style="display:flex;flex-direction:column;align-items:center;transform:translate(-50%,-100%);">
      <div style="background:#e11d48;color:#fff;font-size:10px;font-weight:700;padding:2px 6px;border-radius:9999px;white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,0.25);border:1.5px solid #fff;margin-bottom:2px;">
        Toko Penjual
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
        Lokasi Pembeli
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
  const [isLocatingGps, setIsLocatingGps] = useState(false);
  const [isAutoCalculating, setIsAutoCalculating] = useState(false);
  const [candidateLocations, setCandidateLocations] = useState<GeocodedLocation[]>([]);
  const [detectedLocationLabel, setDetectedLocationLabel] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [estimatedMinutes, setEstimatedMinutes] = useState<number | null>(null);
  const [routeGeometry, setRouteGeometry] = useState<Array<[number, number]>>([]);

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

  const lastGeocodedAddressRef = useRef<string>('');
  const lastStoreKeyRef = useRef<string>('');
  const manualPinLockedRef = useRef<boolean>(false);

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

  // Fungsi menghitung jarak rute jalan raya dari koordinat penjual ke pembeli
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
            'Titik lokasi yang dipilih berada terlalu jauh di luar jangkauan wilayah toko. Silakan geser pin ke area sekitar toko.'
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
        `Jarak rute otomatis terukur ${route.distanceKm} km dari penjual ke titik pembeli.`
      );
      setErrorMessage(null);
    },
    [storeLat, storeLng]
  );

  // Saat pembeli klik pada peta Leaflet atau menggeser pin hijau pembeli
  const handlePinSetByUser = useCallback(
    async (lat: number, lng: number) => {
      manualPinLockedRef.current = true;
      // Jangan ubah posisi zoom peta saat pembeli sedang klik/geser pin manual di peta
      shouldAutoFitMapRef.current = false;
      setIsAutoCalculating(true);
      setErrorMessage(null);

      const norm = normalizeCoordinates(lat, lng, storeLat, storeLng);

      try {
        await computeRouteFromBuyerCoords(
          norm.lat,
          norm.lng,
          `Titik Koordinat (${norm.lat.toFixed(5)}, ${norm.lng.toFixed(5)})`,
          false
        );

        const rev = await reverseGeocodeNominatim(norm.lat, norm.lng);
        if (rev) {
          setDetectedLocationLabel(rev);
          // Jangan langsung menimpa kolom Alamat Lengkap Pengantaran dengan default kelurahan/kecamatan,
          // melainkan tampilkan sebagai rekomendasi di bawah input agar pembeli bisa memilih jika sesuai
          if (!deliveryAddress.trim()) {
            setCandidateLocations([
              {
                displayName: rev,
                lat: norm.lat,
                lng: norm.lng,
                matchedQuery: 'Titik Peta',
              },
            ]);
          }
        }
      } finally {
        setIsAutoCalculating(false);
      }
    },
    [
      storeLat,
      storeLng,
      computeRouteFromBuyerCoords,
      deliveryAddress,
    ]
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
      icon: createSellerIcon(),
      interactive: true,
    })
      .addTo(map)
      .bindPopup(
        `<b>Lokasi Penjual</b><br/>${
          storeSettings?.storeAddress || 'Dapur Ngdimsum'
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
      sellerMarkerRef.current.setPopupContent(
        `<b>Lokasi Penjual</b><br/>${
          storeSettings?.storeAddress || 'Dapur Ngdimsum'
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

      // Hanya atur ulang tampilan/zoom peta jika baru pertama kali dimuat, titik toko berubah, atau diminta via pencarian alamat / GPS
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
  }, [storeLat, storeLng, buyerCoords, routeGeometry, storeSettings?.storeAddress]);

  // Fungsi otomatis mencari rekomendasi alamat & titik koordinat dari teks Alamat Lengkap Pengantaran Pembeli
  const autoMeasureFromAddressText = useCallback(
    async (addressText: string, forceRecalc = false) => {
      const trimmed = addressText.trim();
      if (!useDistance || trimmed.length < 2) {
        setCandidateLocations([]);
        return;
      }

      const currentStoreKey = `${storeLat.toFixed(6)},${storeLng.toFixed(6)}`;
      if (
        !forceRecalc &&
        lastGeocodedAddressRef.current === trimmed &&
        lastStoreKeyRef.current === currentStoreKey &&
        distanceKm !== null &&
        distanceKm <= 100
      ) {
        return;
      }

      setIsAutoCalculating(true);
      setErrorMessage(null);

      try {
        const directCoords = parseCoordinatesFromInput(trimmed);
        if (directCoords) {
          lastGeocodedAddressRef.current = trimmed;
          lastStoreKeyRef.current = currentStoreKey;
          shouldAutoFitMapRef.current = true;
          setCandidateLocations([]);
          await computeRouteFromBuyerCoords(
            directCoords.lat,
            directCoords.lng,
            `Koordinat (${directCoords.lat.toFixed(5)}, ${directCoords.lng.toFixed(5)})`,
            false
          );
          return;
        }

        const results = await searchAddressNominatim(trimmed, {
          lat: storeLat,
          lng: storeLng,
        });

        if (results.length > 0) {
          lastGeocodedAddressRef.current = trimmed;
          lastStoreKeyRef.current = currentStoreKey;
          shouldAutoFitMapRef.current = true;
          const best = results[0];
          // Tampilkan daftar rekomendasi alamat di bawah kolom input selama teks input belum persis sama dengan pilihan
          const isExactPicked =
            results.length === 1 &&
            results[0].displayName.toLowerCase() === trimmed.toLowerCase();
          setCandidateLocations(isExactPicked ? [] : results.slice(0, 5));
          await computeRouteFromBuyerCoords(best.lat, best.lng, best.displayName, true);
        } else {
          setCandidateLocations([]);
          if (forceRecalc) {
            setErrorMessage(
              'Alamat belum dikenali otomatis. Silakan langsung klik titik lokasi rumah Anda pada peta di bawah atau geser pin hijau.'
            );
          }
        }
      } catch {
        if (forceRecalc) {
          setErrorMessage('Gagal menghitung jarak otomatis. Silakan klik titik lokasi pada peta.');
        }
      } finally {
        setIsAutoCalculating(false);
      }
    },
    [useDistance, storeLat, storeLng, distanceKm, computeRouteFromBuyerCoords]
  );

  // 2. OTOMATIS tampilkan rekomendasi & ukur jarak saat pembeli mengetik Alamat Lengkap Pengantaran
  useEffect(() => {
    if (!useDistance) return;

    const currentStoreKey = `${storeLat.toFixed(6)},${storeLng.toFixed(6)}`;
    const storeChanged = lastStoreKeyRef.current !== currentStoreKey;

    if (buyerCoords && (manualPinLockedRef.current || storeChanged)) {
      if (storeChanged) {
        lastStoreKeyRef.current = currentStoreKey;
        shouldAutoFitMapRef.current = true;
        computeRouteFromBuyerCoords(
          buyerCoords.lat,
          buyerCoords.lng,
          detectedLocationLabel || undefined,
          true
        );
      }
      if (manualPinLockedRef.current) return;
    }

    const trimmed = deliveryAddress.trim();
    if (trimmed.length < 2) {
      setCandidateLocations([]);
      return;
    }

    const delayMs =
      distanceKm === null || storeChanged || distanceKm > 100 ? 250 : 400;

    const timer = setTimeout(() => {
      autoMeasureFromAddressText(
        trimmed,
        storeChanged || (distanceKm !== null && distanceKm > 100)
      );
    }, delayMs);

    return () => clearTimeout(timer);
  }, [
    deliveryAddress,
    storeLat,
    storeLng,
    useDistance,
    distanceKm,
    buyerCoords,
    detectedLocationLabel,
    autoMeasureFromAddressText,
    computeRouteFromBuyerCoords,
  ]);

  // 3. Gunakan GPS Pembeli (1-Klik)
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
    setCandidateLocations([]);

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
              'GPS perangkat mendeteksi lokasi jaringan yang jauh dari toko. Silakan klik langsung lokasi rumah Anda pada peta di bawah.'
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
          'Izin GPS tidak aktif. Silakan klik langsung lokasi rumah Anda pada peta di bawah untuk mengatur titik pembeli.'
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

  // Saat pembeli mengklik salah satu rekomendasi alamat di bawah input
  const handleSelectCandidateLocation = async (loc: GeocodedLocation) => {
    manualPinLockedRef.current = true;
    shouldAutoFitMapRef.current = true;
    lastGeocodedAddressRef.current = loc.displayName;
    onChangeAddress(loc.displayName);
    if (onClearValidation) onClearValidation();
    setCandidateLocations([]);
    setIsAutoCalculating(true);
    try {
      await computeRouteFromBuyerCoords(loc.lat, loc.lng, loc.displayName, false);
    } finally {
      setIsAutoCalculating(false);
    }
  };

  const handleRecalculateFromAddress = () => {
    manualPinLockedRef.current = false;
    shouldAutoFitMapRef.current = true;
    if (deliveryAddress.trim().length >= 2) {
      autoMeasureFromAddressText(deliveryAddress, true);
    } else if (buyerCoords) {
      computeRouteFromBuyerCoords(
        buyerCoords.lat,
        buyerCoords.lng,
        detectedLocationLabel || undefined,
        false
      );
    } else {
      setErrorMessage(
        'Ketik alamat pengantaran atau klik langsung titik lokasi Anda pada peta di bawah.'
      );
    }
  };

  return (
    <div className="space-y-2.5 bg-white p-3 rounded-xl border border-rose-200/90 shadow-2xs animate-fade-smooth">
      {/* 1. Alamat Lengkap Input + Rekomendasi Alamat Otomatis di Bawahnya */}
      <div>
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <label className="text-[11px] font-bold text-stone-800 leading-tight">
            Alamat Lengkap Pengantaran <span className="text-rose-500">*</span>
          </label>
          {useDistance && (
            <span className="shrink-0 whitespace-nowrap text-[10px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200/80">
              {formatCurrency(perKmRate)}/km
            </span>
          )}
        </div>
        <div className="relative">
          <textarea
            rows={2}
            required
            value={deliveryAddress}
            onChange={(e) => {
              manualPinLockedRef.current = false;
              onChangeAddress(e.target.value);
              if (onClearValidation) onClearValidation();
            }}
            placeholder="Ketik nama jalan, desa/kelurahan, kecamatan, atau patokan rumah..."
            className="w-full px-2.5 py-2 text-xs leading-relaxed bg-stone-50/70 border border-stone-200 rounded-lg resize-none focus:outline-none focus:bg-white focus:border-rose-400 transition-colors"
          />
          {isAutoCalculating && (
            <div className="flex items-center gap-1.5 text-[10px] font-medium text-rose-600 mt-1">
              <Loader2 className="w-3 h-3 animate-spin shrink-0" />
              <span className="truncate">Mencari rekomendasi alamat & menghitung jarak...</span>
            </div>
          )}

          {/* Rekomendasi Alamat Otomatis tepat di bawah kolom input saat pembeli mengetik */}
          {candidateLocations.length > 0 && (
            <div className="mt-1.5 bg-white border border-rose-200 rounded-xl shadow-md overflow-hidden z-20">
              <div className="px-2.5 py-1.5 bg-rose-50/80 border-b border-rose-100 flex items-center justify-between">
                <span className="text-[10px] font-bold text-rose-800 flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-rose-500 shrink-0" />
                  Rekomendasi Alamat (Klik untuk memilih):
                </span>
                <button
                  type="button"
                  onClick={() => setCandidateLocations([])}
                  className="text-[10px] text-stone-400 hover:text-stone-600 font-semibold px-1"
                >
                  Tutup
                </button>
              </div>
              <div className="max-h-36 overflow-y-auto divide-y divide-stone-100">
                {candidateLocations.map((loc, idx) => {
                  const approxKm =
                    Math.round(
                      calculateHaversineDistanceKm(storeLat, storeLng, loc.lat, loc.lng) *
                        1.25 *
                        10
                    ) / 10;
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSelectCandidateLocation(loc)}
                      className="w-full text-left py-2 px-2.5 text-[11px] text-stone-700 hover:bg-rose-50/90 hover:text-rose-800 flex items-start justify-between gap-2 transition-colors group"
                    >
                      <div className="flex items-start gap-1.5 min-w-0 flex-1">
                        <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0 mt-0.5 group-hover:scale-110 transition-transform" />
                        <span className="leading-snug line-clamp-2">{loc.displayName}</span>
                      </div>
                      <span className="shrink-0 text-[9px] font-mono font-bold text-rose-600 bg-rose-50 group-hover:bg-white px-1.5 py-0.5 rounded border border-rose-200/80 whitespace-nowrap mt-0.5">
                        ~{approxKm} km
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 2. Fitur Pengukur Jarak & Peta Interaktif Leaflet */}
      {useDistance && (
        <div className="pt-2 border-t border-rose-100 space-y-2">
          {/* Info Lokasi Dapur Penjual (Sesuai Pengaturan Toko) */}
          <div className="flex items-center justify-between gap-2 bg-rose-50/60 px-2.5 py-2 rounded-lg border border-rose-100">
            <div className="flex items-center gap-1.5 min-w-0 flex-1">
              <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0" />
              <div className="min-w-0 flex-1">
                {storeSettings?.storeAddress && storeSettings.storeAddress.trim() ? (
                  <>
                    <div className="text-[11px] leading-tight truncate">
                      <span className="font-bold text-stone-700">Lokasi Penjual: </span>
                      <span className="text-stone-600">{storeSettings.storeAddress}</span>
                    </div>
                    <div className="text-[9px] font-mono text-rose-700/80 leading-tight mt-0.5">
                      Titik: {storeLat.toFixed(6)}, {storeLng.toFixed(6)}
                    </div>
                  </>
                ) : (
                  <div className="text-[11px] leading-tight truncate">
                    <span className="font-bold text-stone-700">Titik Lokasi Penjual: </span>
                    <span className="font-mono text-rose-700">
                      {storeLat.toFixed(6)}, {storeLng.toFixed(6)}
                    </span>
                  </div>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                if (mapInstanceRef.current) {
                  mapInstanceRef.current.setView([storeLat, storeLng], 16);
                }
              }}
              className="shrink-0 whitespace-nowrap text-[10px] font-bold text-rose-600 bg-white hover:bg-rose-50 px-2 py-1 rounded-md border border-rose-200/80 shadow-2xs active:scale-95 transition-all"
            >
              Fokus Toko
            </button>
          </div>

          {/* Tombol Aksi Cepat - Grid 3 Kolom Simetris & Presisi untuk Layar HP */}
          <div className="grid grid-cols-3 gap-1.5">
            <button
              type="button"
              disabled={isLocatingGps || isAutoCalculating}
              onClick={handleUseMyGps}
              className="w-full py-2 px-1.5 bg-rose-500 hover:bg-rose-600 disabled:bg-stone-300 text-white font-bold text-[10px] sm:text-[11px] rounded-lg flex items-center justify-center gap-1 transition-all shadow-2xs active:scale-95 whitespace-nowrap"
            >
              {isLocatingGps ? (
                <Loader2 className="w-3 h-3 animate-spin shrink-0" />
              ) : (
                <Navigation className="w-3 h-3 shrink-0" />
              )}
              <span>GPS Saya</span>
            </button>

            <button
              type="button"
              disabled={isAutoCalculating || isLocatingGps}
              onClick={handlePlacePinAtMapCenter}
              className="w-full py-2 px-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-[10px] sm:text-[11px] rounded-lg flex items-center justify-center gap-1 transition-all shadow-2xs active:scale-95 whitespace-nowrap"
              title="Taruh pin pembeli di tengah peta lalu geser sesuai lokasi rumah"
            >
              <Crosshair className="w-3 h-3 shrink-0" />
              <span>Taruh Pin</span>
            </button>

            <button
              type="button"
              disabled={isAutoCalculating || isLocatingGps}
              onClick={handleRecalculateFromAddress}
              className="w-full py-2 px-1.5 bg-stone-100 hover:bg-stone-200 disabled:opacity-50 text-stone-700 font-bold text-[10px] sm:text-[11px] rounded-lg flex items-center justify-center gap-1 transition-colors border border-stone-200/90 active:scale-95 whitespace-nowrap"
              title="Cari titik dari teks alamat & hitung ulang"
            >
              <RotateCcw className={`w-3 h-3 shrink-0 ${isAutoCalculating ? 'animate-spin' : ''}`} />
              <span>Dari Alamat</span>
            </button>
          </div>

          {/* Peta Interaktif Leaflet untuk Mengatur Titik Koordinat Pembeli */}
          <div className="rounded-xl overflow-hidden border border-stone-200 bg-stone-50 shadow-2xs">
            {/* Header Peta Rapi & Presisi di HP */}
            <div className="px-2.5 py-1.5 bg-emerald-50/90 border-b border-emerald-200/80 flex items-center justify-between gap-1.5">
              <div className="flex items-center gap-1 min-w-0">
                <span className="text-[11px] leading-none shrink-0">📍</span>
                <span className="text-[10px] font-semibold text-emerald-950 leading-tight truncate">
                  Klik peta / geser pin hijau ke lokasi Anda
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
              className="h-48 sm:h-52 w-full z-0 cursor-crosshair"
            />

            {/* Footer Legenda Peta */}
            <div className="px-2.5 py-1.5 bg-stone-100/90 border-t border-stone-200 flex items-center justify-between gap-2 text-[10px] text-stone-600">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="inline-flex items-center gap-1 font-semibold whitespace-nowrap">
                  <span className="w-2 h-2 rounded-full bg-rose-600 inline-block shrink-0" />
                  Penjual
                </span>
                <span className="inline-flex items-center gap-1 font-semibold whitespace-nowrap">
                  <span className="w-2 h-2 rounded-full bg-emerald-600 inline-block shrink-0" />
                  Pembeli (Geser)
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
                  <ExternalLink className="w-2.5 h-2.5" />
                </a>
              ) : (
                <a
                  href={getGoogleMapsPinUrl(storeLat, storeLng)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-rose-600 hover:underline font-bold shrink-0 inline-flex items-center gap-0.5 whitespace-nowrap"
                >
                  <span>Buka Maps</span>
                  <ExternalLink className="w-2.5 h-2.5" />
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

          {/* Kartu Hasil Pengukuran Jarak & Ongkir Otomatis */}
          {distanceKm !== null && distanceKm > 0 ? (
            <div
              className={`p-2.5 rounded-lg border text-[11px] space-y-1 transition-all ${
                isOverMaxDistance
                  ? 'bg-rose-50 border-rose-300 text-rose-900'
                  : 'bg-emerald-50/90 border-emerald-200 text-emerald-950'
              }`}
            >
              <div className="flex items-center justify-between gap-2 font-bold">
                <span className="flex items-center gap-1.5 min-w-0">
                  <CheckCircle2
                    className={`w-3.5 h-3.5 shrink-0 ${
                      isOverMaxDistance ? 'text-rose-600' : 'text-emerald-600'
                    }`}
                  />
                  <span className="truncate">Jarak Rute: {distanceKm} km</span>
                </span>
                <span className="font-mono text-[11px] px-2 py-0.5 rounded-md bg-white border border-emerald-200/90 shrink-0 whitespace-nowrap shadow-2xs">
                  Ongkir {formatCurrency(calculatedFee)}
                </span>
              </div>

              <div className="flex items-center justify-between gap-1 text-[10px] text-stone-600">
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
                'Klik lokasi Anda pada peta di atas atau ketik alamat lengkap — jarak & ongkir dihitung otomatis.'}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
