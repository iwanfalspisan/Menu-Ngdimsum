import { StoreSettings } from '../types';

export interface GeocodedLocation {
  displayName: string;
  lat: number;
  lng: number;
  matchedQuery?: string;
}

export interface RouteDistanceResult {
  distanceKm: number;
  straightLineKm: number;
  osrmRoadKm: number | null;
  durationMinutes: number;
  isRoadRoute: boolean;
  isOutOfRegion?: boolean;
  routingMethod:
    | 'OSRM Driving Route'
    | 'Haversine x 1.25 Fallback'
    | 'Area Sama (<150m)'
    | 'Di Luar Jangkauan Wilayah';
  routeGeometry: Array<[number, number]>; // Array of [lat, lng]
}

export interface RouteComparisonDiagnostics {
  id: string;
  timestamp: string;
  // Data Koordinat Penjual (Toko)
  rawStoreLat: number | undefined;
  rawStoreLng: number | undefined;
  storeAddressText: string;
  resolvedStoreLat: number;
  resolvedStoreLng: number;
  geocodedStoreAddressLat?: number;
  geocodedStoreAddressLng?: number;
  geocodedStoreDisplayName?: string;
  storeAddressMismatchKm?: number;
  wasStoreSwapped: boolean;
  storeCoordSource: string;
  // Data Koordinat Pembeli
  buyerAddressInput: string;
  geocodingQueryUsed: string;
  resolvedBuyerLat: number;
  resolvedBuyerLng: number;
  buyerMatchedDisplayName: string;
  wasBuyerSwapped: boolean;
  buyerCoordSource: 'Alamat Otomatis (Nominatim)' | 'GPS Perangkat' | 'Koordinat / Link Maps';
  // Hasil Perhitungan Jarak & Ongkir
  straightLineKm: number;
  osrmRoadKm: number | null;
  finalDistanceKm: number;
  routingMethod: string;
  durationMinutes: number;
  perKmRate: number;
  minFee: number;
  calculatedFee: number;
  isOutOfRegion: boolean;
  routeGeometry: Array<[number, number]>;
  logs: string[];
}

export const DEFAULT_STORE_LAT = -7.303170618196189;
export const DEFAULT_STORE_LNG = 108.24690595305718;
const DEFAULT_JAKARTA_LAT = DEFAULT_STORE_LAT;
const DEFAULT_JAKARTA_LNG = DEFAULT_STORE_LNG;
const STORE_GEOCACHE_KEY = 'ngdimsum_store_coords_cache_v2';

export const isLegacyJakartaPlaceholder = (_lat: unknown, _lng: unknown): boolean => {
  return false;
};

// Menyimpan log diagnostik terakhir agar dapat dipantau langsung di UI saat checkout
let latestRouteDiagnostics: RouteComparisonDiagnostics | null = null;
const diagnosticsListeners = new Set<(diag: RouteComparisonDiagnostics | null) => void>();

export const getLastRouteDiagnostics = (): RouteComparisonDiagnostics | null => {
  return latestRouteDiagnostics;
};

export const publishRouteDiagnostics = (diag: RouteComparisonDiagnostics | null): void => {
  latestRouteDiagnostics = diag;
  if (diag) {
    try {
      console.groupCollapsed(
        `[Ngdimsum Distance Diagnostics] ${diag.finalDistanceKm} km (${diag.routingMethod})`
      );
      console.table({
        Penjual_Raw: {
          lat: diag.rawStoreLat,
          lng: diag.rawStoreLng,
          alamat: diag.storeAddressText,
        },
        Penjual_Aktif: {
          lat: diag.resolvedStoreLat,
          lng: diag.resolvedStoreLng,
          sumber: diag.storeCoordSource,
        },
        Pembeli_Terdeteksi: {
          lat: diag.resolvedBuyerLat,
          lng: diag.resolvedBuyerLng,
          sumber: diag.buyerCoordSource,
          alamat: diag.buyerMatchedDisplayName,
        },
        Perhitungan: {
          jarakGarisLurusKm: diag.straightLineKm,
          jarakRuteOsrmKm: diag.osrmRoadKm,
          jarakFinalKm: diag.finalDistanceKm,
          ongkirRp: diag.calculatedFee,
        },
      });
      diag.logs.forEach((line) => console.log(line));
      console.groupEnd();
    } catch (e) {}
  }
  diagnosticsListeners.forEach((listener) => listener(diag));
};

export const subscribeRouteDiagnostics = (
  listener: (diag: RouteComparisonDiagnostics | null) => void
): (() => void) => {
  diagnosticsListeners.add(listener);
  return () => {
    diagnosticsListeners.delete(listener);
  };
};

/**
 * Konversi angka koordinat dengan aman (mendukung koma desimal format Indonesia seperti "-7,3039")
 */
export const parseCoordinateNumber = (val: unknown): number => {
  if (typeof val === 'number') return val;
  if (typeof val === 'string') {
    const cleaned = val.trim().replace(',', '.');
    if (!cleaned) return NaN;
    return Number(cleaned);
  }
  return NaN;
};

/**
 * Validasi apakah angka koordinat berada di rentang bumi yang sah
 */
export const isValidLatLng = (lat: number, lng: number): boolean => {
  return (
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    !isNaN(lat) &&
    !isNaN(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180 &&
    lat !== 0 &&
    lng !== 0
  );
};

/**
 * Cek apakah koordinat berada di wilayah Indonesia (sekitar Lat -11.5 s/d 6.5, Lng 94.5 s/d 141.5)
 */
export const isCoordinateInIndonesia = (lat: number, lng: number): boolean => {
  return lat >= -11.5 && lat <= 6.5 && lng >= 94.5 && lng <= 141.5;
};

/**
 * Normalisasi koordinat & otomatis perbaiki jika Latitude dan Longitude tertukar
 */
export const normalizeCoordinates = (
  rawLat: unknown,
  rawLng: unknown,
  fallbackLat = DEFAULT_STORE_LAT,
  fallbackLng = DEFAULT_STORE_LNG
): { lat: number; lng: number; wasSwapped: boolean } => {
  // Jika rawLat berupa teks gabungan seperti "-7.303170618196189, 108.24690595305718"
  if (typeof rawLat === 'string' && rawLat.includes(',')) {
    const parts = rawLat.split(',');
    if (parts.length >= 2) {
      const pLat = Number(parts[0].trim());
      const pLng = Number(parts[1].trim());
      if (!isNaN(pLat) && !isNaN(pLng) && isValidLatLng(pLat, pLng)) {
        return { lat: pLat, lng: pLng, wasSwapped: false };
      }
    }
  }

  const lat = parseCoordinateNumber(rawLat);
  const lng = parseCoordinateNumber(rawLng);

  if (isNaN(lat) || isNaN(lng) || lat === 0 || lng === 0) {
    return { lat: fallbackLat, lng: fallbackLng, wasSwapped: false };
  }

  // Kasus 1: Nilai lat > 90 atau < -90 (pasti tertukar dengan longitude), sedangkan lng valid sebagai latitude
  if (Math.abs(lat) > 90 && Math.abs(lng) <= 90 && Math.abs(lat) <= 180) {
    return {
      lat: lng,
      lng: lat,
      wasSwapped: true,
    };
  }

  // Kasus 2: Di Indonesia, Longitude berkisar 94.5..141.5 dan Latitude berkisar -11.5..6.5
  if (isCoordinateInIndonesia(lng, lat) && !isCoordinateInIndonesia(lat, lng)) {
    return {
      lat: lng,
      lng: lat,
      wasSwapped: true,
    };
  }

  if (isValidLatLng(lat, lng)) {
    return {
      lat,
      lng,
      wasSwapped: false,
    };
  }

  return { lat: fallbackLat, lng: fallbackLng, wasSwapped: false };
};

/**
 * Menghitung jarak garis lurus (Haversine) dalam satuan Kilometer
 */
export const calculateHaversineDistanceKm = (
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number => {
  const norm1 = normalizeCoordinates(lat1, lng1);
  const norm2 = normalizeCoordinates(lat2, lng2);

  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371; // Radius bumi dalam KM
  const dLat = toRad(norm2.lat - norm1.lat);
  const dLng = toRad(norm2.lng - norm1.lng);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(norm1.lat)) *
      Math.cos(toRad(norm2.lat)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

/**
 * Menghitung jarak rute jalan raya sesungguhnya (OSRM) beserta geometri garis rute (GeoJSON)
 * dengan fallback Haversine x 1.25
 */
export const calculateRoadDistanceKm = async (
  rawStoreLat: number,
  rawStoreLng: number,
  rawBuyerLat: number,
  rawBuyerLng: number
): Promise<RouteDistanceResult> => {
  const store = normalizeCoordinates(rawStoreLat, rawStoreLng);
  const buyer = normalizeCoordinates(rawBuyerLat, rawBuyerLng, store.lat, store.lng);

  const straightKmRaw = calculateHaversineDistanceKm(
    store.lat,
    store.lng,
    buyer.lat,
    buyer.lng
  );
  const straightLineKm = Math.round(straightKmRaw * 100) / 100;

  const fallbackGeometry: Array<[number, number]> = [
    [store.lat, store.lng],
    [buyer.lat, buyer.lng],
  ];

  // Jika koordinat pembeli berada di luar Indonesia (misal efek IP VPN/server luar negeri)
  if (!isCoordinateInIndonesia(buyer.lat, buyer.lng)) {
    const outKm = Math.round(straightKmRaw * 10) / 10;
    return {
      distanceKm: outKm,
      straightLineKm,
      osrmRoadKm: null,
      durationMinutes: 60,
      isRoadRoute: false,
      isOutOfRegion: true,
      routingMethod: 'Di Luar Jangkauan Wilayah',
      routeGeometry: fallbackGeometry,
    };
  }

  // Jika jarak garis lurus > 800 km (beda pulau jauh / IP ISP melenceng jauh)
  if (straightKmRaw > 800) {
    const outKm = Math.round(straightKmRaw * 10) / 10;
    return {
      distanceKm: outKm,
      straightLineKm,
      osrmRoadKm: null,
      durationMinutes: Math.round(outKm * 2),
      isRoadRoute: false,
      isOutOfRegion: true,
      routingMethod: 'Di Luar Jangkauan Wilayah',
      routeGeometry: fallbackGeometry,
    };
  }

  // Jika titik penjual dan pembeli berada di kelurahan/titik yang sama (< 150 meter)
  if (straightKmRaw < 0.15) {
    const nearKm =
      straightKmRaw < 0.03 ? 0.5 : Math.max(0.3, Math.round(straightKmRaw * 1.3 * 10) / 10);
    return {
      distanceKm: nearKm,
      straightLineKm,
      osrmRoadKm: nearKm,
      durationMinutes: 4,
      isRoadRoute: true,
      isOutOfRegion: false,
      routingMethod: 'Area Sama (<150m)',
      routeGeometry: fallbackGeometry,
    };
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4500);

    // Minta overview=full & geometries=geojson untuk menggambar jalur jalan raya di pemetaan visual
    const url = `https://router.project-osrm.org/route/v1/driving/${store.lng},${store.lat};${buyer.lng},${buyer.lat}?overview=full&geometries=geojson`;
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      if (data && data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        const roadKm = Math.max(0.2, Math.round((route.distance / 1000) * 10) / 10);
        const durationMin = Math.max(3, Math.round(route.duration / 60));

        let geometryCoords: Array<[number, number]> = fallbackGeometry;
        if (
          route.geometry &&
          Array.isArray(route.geometry.coordinates) &&
          route.geometry.coordinates.length >= 2
        ) {
          geometryCoords = route.geometry.coordinates.map((pt: [number, number]) => [
            Number(pt[1]),
            Number(pt[0]),
          ]);
        }

        // Guard: pastikan rute jalan wajar terhadap jarak lurus
        if (roadKm <= Math.max(350, straightKmRaw * 3.2)) {
          return {
            distanceKm: roadKm,
            straightLineKm,
            osrmRoadKm: roadKm,
            durationMinutes: durationMin,
            isRoadRoute: true,
            isOutOfRegion: false,
            routingMethod: 'OSRM Driving Route',
            routeGeometry: geometryCoords,
          };
        }
      }
    }
  } catch (e) {
    // Fallback ke estimasi rute jalan (Haversine * 1.25)
  }

  const estimatedRoadKm = Math.max(0.2, Math.round(straightKmRaw * 1.25 * 10) / 10);
  const estimatedDurationMin = Math.max(4, Math.round(estimatedRoadKm * 3));

  return {
    distanceKm: estimatedRoadKm,
    straightLineKm,
    osrmRoadKm: null,
    durationMinutes: estimatedDurationMin,
    isRoadRoute: false,
    isOutOfRegion: false,
    routingMethod: 'Haversine x 1.25 Fallback',
    routeGeometry: fallbackGeometry,
  };
};

/**
 * Menghitung tarif ongkos kirim berdasarkan jarak (KM) & pengaturan toko
 */
export const calculateDeliveryFeeFromDistance = (
  distanceKm: number | null | undefined,
  settings?: StoreSettings
): number => {
  if (!settings) return 10000;

  if (settings.useDistanceDelivery === false) {
    return settings.deliveryFeeFixed ?? 10000;
  }

  const minFee = settings.deliveryFeeMin ?? 8000;
  const perKm = settings.deliveryFeePerKm ?? 2500;

  // Jika jarak belum diukur atau di luar batas kewajaran (> 800 km)
  if (
    distanceKm === null ||
    distanceKm === undefined ||
    isNaN(distanceKm) ||
    distanceKm <= 0 ||
    distanceKm > 800
  ) {
    return minFee;
  }

  // Hitung tarif per KM dan bulatkan ke atas kelipatan Rp 500 terdekat
  const rawFee = distanceKm * perKm;
  const roundedFee = Math.ceil(rawFee / 500) * 500;

  return Math.max(minFee, roundedFee);
};

/**
 * Ekstrak koordinat (lat, lng) dari link Google Maps atau teks koordinat
 */
export const parseCoordinatesFromInput = (
  input: string
): { lat: number; lng: number } | null => {
  if (!input) return null;
  const trimmed = input.trim();

  // 1. Format pin akurat Google Maps: !3d-6.1586!4d106.9056
  const bangMatch = trimmed.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
  if (bangMatch) {
    const norm = normalizeCoordinates(
      parseFloat(bangMatch[1]),
      parseFloat(bangMatch[2]),
      NaN,
      NaN
    );
    if (isValidLatLng(norm.lat, norm.lng)) return { lat: norm.lat, lng: norm.lng };
  }

  // 2. Format URL Google Maps: @-6.1586,106.9056 atau ?q=-6.1586,106.9056 atau ll= atau /search/
  const urlCoordMatch = trimmed.match(
    /(?:@|q=|ll=|query=|center=|search\/|place\/)(-?\d+\.\d+)\s*(?:,|%2C|\s)\s*(-?\d+\.\d+)/i
  );
  if (urlCoordMatch) {
    const norm = normalizeCoordinates(
      parseFloat(urlCoordMatch[1]),
      parseFloat(urlCoordMatch[2]),
      NaN,
      NaN
    );
    if (isValidLatLng(norm.lat, norm.lng)) return { lat: norm.lat, lng: norm.lng };
  }

  // 3. Format koordinat langsung di dalam teks: "-7.303170618196189, 108.24690595305718" atau di tengah kalimat
  const rawMatch = trimmed.match(
    /[([]?\s*(-?\d+\.\d+)\s*[,;/\s]\s*(-?\d+\.\d+)\s*[)\]]?/
  );
  if (rawMatch) {
    const norm = normalizeCoordinates(
      parseFloat(rawMatch[1]),
      parseFloat(rawMatch[2]),
      NaN,
      NaN
    );
    if (isValidLatLng(norm.lat, norm.lng)) return { lat: norm.lat, lng: norm.lng };
  }

  return null;
};

/**
 * Membersihkan alamat Indonesia yang memiliki detail nomor rumah / RT / RW / patokan
 * menjadi daftar variasi kueri bertahap agar Nominatim OpenStreetMap selalu menemukan titik akurat.
 */
export const buildIndonesianAddressQueries = (rawQuery: string): string[] => {
  const base = rawQuery
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\b(?:rt|rw)\.?\s*\d+(?:\s*\/\s*(?:rt|rw)?\.?\s*\d+)?/gi, ' ')
    .replace(/\b(?:no|nomor|blok|gang|gg|kav|lantai|lt|km)\.?\s*[a-z0-9/-]+/gi, ' ')
    .replace(
      /\b(?:dekat|sebelah|depan|belakang|samping|seberang|patokan|rumah|toko|warung)\b[^,]*/gi,
      ' '
    )
    .replace(/\s+/g, ' ')
    .trim();

  const candidates: string[] = [];
  const addCandidate = (q: string) => {
    const clean = q
      .replace(/^[,.\s-]+|[,.\s-]+$/g, '')
      .replace(/\s*,\s*/g, ', ')
      .replace(/\s+/g, ' ')
      .trim();
    if (clean.length >= 3 && !candidates.includes(clean)) {
      candidates.push(clean);
    }
  };

  addCandidate(rawQuery);
  addCandidate(base);

  const expanded = base
    .replace(/\bjl\.?\s+/gi, 'Jalan ')
    .replace(/\bkec\.?\s+/gi, 'Kecamatan ')
    .replace(/\bkel\.?\s+/gi, 'Kelurahan ')
    .replace(/\bds\.?\s+/gi, 'Desa ')
    .replace(/\bkab\.?\s+/gi, 'Kabupaten ');
  addCandidate(expanded);

  const parts = expanded
    .split(',')
    .map((p) => p.trim())
    .filter((p) => p.length >= 2);

  if (parts.length >= 2) {
    addCandidate(parts.slice(1).join(', '));
  }
  if (parts.length >= 3) {
    addCandidate(parts.slice(2).join(', '));
    addCandidate(parts.slice(-3).join(', '));
  }
  if (parts.length >= 4) {
    addCandidate(parts.slice(-2).join(', '));
  }

  return candidates.slice(0, 5);
};

const fetchNominatimRaw = async (
  query: string,
  biasCoords?: { lat: number; lng: number }
): Promise<GeocodedLocation[]> => {
  try {
    let url = `https://nominatim.openstreetmap.org/search?format=json&countrycodes=id&addressdetails=1&limit=6&q=${encodeURIComponent(
      query
    )}`;

    if (
      biasCoords &&
      isValidLatLng(biasCoords.lat, biasCoords.lng) &&
      isCoordinateInIndonesia(biasCoords.lat, biasCoords.lng)
    ) {
      const delta = 0.85;
      const left = (biasCoords.lng - delta).toFixed(4);
      const top = (biasCoords.lat + delta).toFixed(4);
      const right = (biasCoords.lng + delta).toFixed(4);
      const bottom = (biasCoords.lat - delta).toFixed(4);
      url += `&viewbox=${left},${top},${right},${bottom}`;
    }

    const res = await fetch(url, {
      headers: {
        'Accept-Language': 'id,en',
      },
    });
    if (!res.ok) return [];
    const data = await res.json();
    if (!Array.isArray(data)) return [];

    const mapped = data
      .map((item: any) => {
        const norm = normalizeCoordinates(
          parseFloat(item.lat),
          parseFloat(item.lon),
          NaN,
          NaN
        );
        return {
          displayName: String(item.display_name || ''),
          lat: norm.lat,
          lng: norm.lng,
          matchedQuery: query,
        };
      })
      .filter(
        (loc) => isValidLatLng(loc.lat, loc.lng) && isCoordinateInIndonesia(loc.lat, loc.lng)
      );

    if (
      biasCoords &&
      isValidLatLng(biasCoords.lat, biasCoords.lng) &&
      isCoordinateInIndonesia(biasCoords.lat, biasCoords.lng) &&
      mapped.length > 1
    ) {
      mapped.sort((a, b) => {
        const distA = calculateHaversineDistanceKm(
          biasCoords.lat,
          biasCoords.lng,
          a.lat,
          a.lng
        );
        const distB = calculateHaversineDistanceKm(
          biasCoords.lat,
          biasCoords.lng,
          b.lat,
          b.lng
        );
        return distA - distB;
      });
    }

    return mapped;
  } catch (e) {
    return [];
  }
};

const fetchPhotonRaw = async (
  query: string,
  biasCoords?: { lat: number; lng: number }
): Promise<GeocodedLocation[]> => {
  try {
    let url = `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=6`;
    if (
      biasCoords &&
      isValidLatLng(biasCoords.lat, biasCoords.lng) &&
      isCoordinateInIndonesia(biasCoords.lat, biasCoords.lng)
    ) {
      url += `&lat=${biasCoords.lat.toFixed(5)}&lon=${biasCoords.lng.toFixed(5)}`;
    }
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    if (!data || !Array.isArray(data.features)) return [];

    return data.features
      .map((f: any) => {
        const coords = f?.geometry?.coordinates;
        if (!Array.isArray(coords) || coords.length < 2) return null;
        const norm = normalizeCoordinates(Number(coords[1]), Number(coords[0]), NaN, NaN);
        if (!isValidLatLng(norm.lat, norm.lng) || !isCoordinateInIndonesia(norm.lat, norm.lng)) {
          return null;
        }
        const p = f.properties || {};
        const labelParts = [
          p.name,
          p.street,
          p.Subdistrict || p.suburb || p.locality,
          p.district || p.city || p.county,
          p.state,
          p.postcode,
        ]
          .filter((x) => typeof x === 'string' && x.trim().length > 0)
          .filter((val, idx, arr) => arr.indexOf(val) === idx);

        if (labelParts.length === 0) return null;
        return {
          displayName: labelParts.join(', '),
          lat: norm.lat,
          lng: norm.lng,
          matchedQuery: query,
        };
      })
      .filter((item: GeocodedLocation | null): item is GeocodedLocation => item !== null);
  } catch {
    return [];
  }
};

/**
 * Pencarian alamat / kelurahan / kecamatan / jalan menggunakan OpenStreetMap Nominatim + Photon Autocomplete
 */
export const searchAddressNominatim = async (
  query: string,
  biasCoords?: { lat: number; lng: number }
): Promise<GeocodedLocation[]> => {
  const cleaned = query.trim();
  if (cleaned.length < 2) return [];

  const directCoords = parseCoordinatesFromInput(cleaned);
  if (directCoords) {
    return [
      {
        displayName: `Titik Koordinat (${directCoords.lat.toFixed(5)}, ${directCoords.lng.toFixed(5)})`,
        lat: directCoords.lat,
        lng: directCoords.lng,
        matchedQuery: cleaned,
      },
    ];
  }

  const candidateQueries = buildIndonesianAddressQueries(cleaned);
  const collected: GeocodedLocation[] = [];

  const addUnique = (items: GeocodedLocation[]) => {
    for (const item of items) {
      const isDuplicate = collected.some(
        (existing) =>
          (Math.abs(existing.lat - item.lat) < 0.0008 &&
            Math.abs(existing.lng - item.lng) < 0.0008) ||
          existing.displayName.toLowerCase() === item.displayName.toLowerCase()
      );
      if (!isDuplicate) {
        collected.push(item);
      }
    }
  };

  // Jalankan pencarian Nominatim & Photon secara paralel untuk kueri utama agar rekomendasi cepat dan lengkap
  const primaryQuery = candidateQueries[0] || cleaned;
  const [nominatimPrimary, photonPrimary] = await Promise.all([
    fetchNominatimRaw(primaryQuery, biasCoords),
    fetchPhotonRaw(primaryQuery, biasCoords),
  ]);
  addUnique(nominatimPrimary);
  addUnique(photonPrimary);

  if (collected.length === 0 && candidateQueries.length > 1) {
    for (const candidate of candidateQueries.slice(1)) {
      const results = await fetchNominatimRaw(candidate, biasCoords);
      addUnique(results);
      if (collected.length >= 4) break;
    }
  }

  if (
    biasCoords &&
    isValidLatLng(biasCoords.lat, biasCoords.lng) &&
    isCoordinateInIndonesia(biasCoords.lat, biasCoords.lng) &&
    collected.length > 1
  ) {
    collected.sort((a, b) => {
      const distA = calculateHaversineDistanceKm(
        biasCoords.lat,
        biasCoords.lng,
        a.lat,
        a.lng
      );
      const distB = calculateHaversineDistanceKm(
        biasCoords.lat,
        biasCoords.lng,
        b.lat,
        b.lng
      );
      return distA - distB;
    });
  }

  return collected.slice(0, 6);
};

/**
 * Mengambil titik koordinat penjual (`storeLat`, `storeLng`) persis sesuai yang disetting di Pengaturan Toko
 */
export const resolveAccurateStoreCoordinates = async (
  settings?: StoreSettings
): Promise<{
  lat: number;
  lng: number;
  matchedAddress?: string;
  wasAutoSynced: boolean;
  coordSource: string;
  geocodedAddressLat?: number;
  geocodedAddressLng?: number;
  mismatchKm?: number;
}> => {
  const currentNorm = normalizeCoordinates(
    settings?.storeLat ?? DEFAULT_JAKARTA_LAT,
    settings?.storeLng ?? DEFAULT_JAKARTA_LNG
  );

  return {
    lat: currentNorm.lat,
    lng: currentNorm.lng,
    wasAutoSynced: false,
    coordSource: currentNorm.wasSwapped
      ? 'Pin Koordinat Pengaturan Toko (Lat/Lng Dibalik Otomatis)'
      : 'Pin Koordinat Pengaturan Toko',
  };
};

/**
 * Reverse Geocoding dari titik GPS (lat, lng) menjadi nama jalan / alamat
 */
export const reverseGeocodeNominatim = async (
  lat: number,
  lng: number
): Promise<string | null> => {
  try {
    const norm = normalizeCoordinates(lat, lng);
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${norm.lat}&lon=${norm.lng}&zoom=18&addressdetails=1`;
    const res = await fetch(url, {
      headers: {
        'Accept-Language': 'id,en',
      },
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data && data.display_name) {
      return String(data.display_name);
    }
    return null;
  } catch (e) {
    return null;
  }
};

/**
 * Buat link Google Maps ke koordinat tujuan
 */
export const getGoogleMapsPinUrl = (lat: number, lng: number): string => {
  const norm = normalizeCoordinates(lat, lng);
  return `https://www.google.com/maps?q=${norm.lat},${norm.lng}`;
};

/**
 * Buat link Google Maps Rute Pengantaran dari Penjual ke Pembeli
 */
export const getGoogleMapsDirectionsUrl = (
  storeLat: number,
  storeLng: number,
  buyerLat: number,
  buyerLng: number
): string => {
  const s = normalizeCoordinates(storeLat, storeLng);
  const b = normalizeCoordinates(buyerLat, buyerLng, s.lat, s.lng);
  return `https://www.google.com/maps/dir/?api=1&origin=${s.lat},${s.lng}&destination=${b.lat},${b.lng}&travelmode=driving`;
};
