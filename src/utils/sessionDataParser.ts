import JSZip from 'jszip';
import { CarListing, CarListingType } from '../types/car';
import { normalizePersianText, buildSearchIndex } from './persianSearch';
import { toPersianDigits, formatTomanPrice } from './dataPruner';
import { formatIranianPhone, extractIranianPhone, parseCarYear, extractCarAttributes, detectBrand } from './sellerDataParser';

export interface RawSellerRecord {
  id: string;
  rowIndex?: number;
  imageFileName?: string;
  اسم_ماشین?: string;
  سال_ساخت?: string | number;
  رنگ?: string;
  کارکرد_کیلومتر?: string | number;
  قیمت_تومان?: string | number;
  اسم_فروشنده?: string;
  status?: string;
  errorMessage?: string;
  [key: string]: any;
}

export interface RawBuyerRecord {
  id: string;
  rowIndex?: number;
  imageFileName?: string;
  اسم_مشتری?: string;
  اسم_ماشین?: string;
  سال_ساخت?: string | number;
  رنگ?: string;
  بودجه_تقریبی_تومان?: string | number;
  توضیحات_بیشتر?: string;
  status?: string;
  [key: string]: any;
}

export interface NormalizationRule {
  id: string;
  targetName: string;
  aliases: string[];
}

export interface SessionJsonRoot {
  version?: number;
  sellers?: RawSellerRecord[];
  buyers?: RawBuyerRecord[];
  normalizationRules?: NormalizationRule[];
  dominantKeywords?: string[];
  referenceCarNames?: string[];
  [key: string]: any;
}

/**
 * Extracts and cleans meaningful text from filename or raw notes.
 * e.g. "989121769442_1268_۲۰۷_پانا_۴۰۳_سفید_۴۰_تا_کار._اتومات.jpg" -> "۲۰۷ پانا ۴۰۳ سفید ۴۰ تا کار. اتومات"
 */
export function extractCleanFileDescription(
  fileName?: string,
  rawColor?: string,
  customNote?: string
): string {
  if (customNote && customNote.trim()) return customNote.trim();

  // If color contains details (e.g. "۲۰۷ پانا ۴۰۳ سفید ۴۰ تا کار. اتومات")
  if (
    rawColor &&
    rawColor.trim().length > 3 &&
    !/^(سفید|مشکی|قرمز|آبی|نقره‌ای|خاکستری|دلفینی)$/.test(rawColor.trim())
  ) {
    return rawColor.trim();
  }

  if (!fileName || fileName === 'ورودی دستی') {
    return rawColor?.trim() || '';
  }

  // Strip extension and the exact filename metadata convention:
  // phone number + underscore + four-digit random code + optional caption.
  let cleaned = fileName.split(/[\\/]/).pop() || fileName;
  cleaned = cleaned.replace(/\.[a-zA-Z0-9]+$/i, '');
  const hasPhoneAndFourDigitCode = /^\d+_\d{4}(?:_|$)/.test(cleaned);
  if (hasPhoneAndFourDigitCode) {
    cleaned = cleaned.replace(/^\d+_\d{4}(?:_|$)/, '');
  } else {
    // Backward compatibility for older files that used a non-four-digit suffix.
    cleaned = cleaned.replace(/^\d+_\d+_/, '').replace(/^\d+_/, '');
  }
  // Replace underscores with spaces
  cleaned = cleaned.replace(/_/g, ' ').replace(/\s+/g, ' ').trim();

  if (/^\d+$/.test(cleaned)) return '';

  // A filename containing only phone + random code has no caption; never expose metadata.
  return cleaned;
}

/**
 * Parses numeric price or mileage value from string or number with Persian/English digits,
 * commas, or words.
 */
export function parseNumericValue(val: string | number | undefined | null): number {
  if (val === undefined || val === null || val === '') return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;

  const normalized = normalizePersianText(val.toString());
  if (/توافقی|تماس|نامشخص/.test(normalized)) return 0;

  let multiplier = 1;
  if (/میلیارد/.test(normalized)) {
    multiplier = 1_000_000_000;
  } else if (/میلیون|تومان/.test(normalized) && !/\d{6,}/.test(normalized)) {
    multiplier = 1_000_000;
  }

  const cleanedDigits = normalized.replace(/[^\d.]/g, '');
  const parsed = parseFloat(cleanedDigits);
  if (isNaN(parsed)) return 0;

  return Math.round(parsed * (parsed < 1000 && multiplier > 1 ? multiplier : 1));
}

/**
 * Standardizes car name based on session normalizationRules
 */
export function applyNormalizationRules(carName: string, rules?: NormalizationRule[]): string {
  if (!rules || rules.length === 0 || !carName) return carName;
  const normName = normalizePersianText(carName);

  for (const rule of rules) {
    if (rule.aliases && Array.isArray(rule.aliases)) {
      for (const alias of rule.aliases) {
        if (normName.includes(normalizePersianText(alias))) {
          return rule.targetName;
        }
      }
    }
  }

  return carName;
}

/**
 * Generates an SVG Data URI placeholder for items without attached images
 */
function createCarPlaceholder(colorHex: string, modelName: string, isFull: boolean): string {
  const width = isFull ? 800 : 160;
  const height = isFull ? 480 : 160;
  const strokeColor = '#1e293b';

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
    <defs>
      <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#f8fafc"/>
        <stop offset="100%" stop-color="#e2e8f0"/>
      </linearGradient>
    </defs>
    <rect width="${width}" height="${height}" fill="url(#bg)"/>
    <ellipse cx="${width * 0.5}" cy="${height * 0.76}" rx="${width * 0.42}" ry="${height * 0.08}" fill="#0f172a" fill-opacity="0.18" />
    <path d="M ${width * 0.28} ${height * 0.52} C ${width * 0.34} ${height * 0.32}, ${width * 0.62} ${height * 0.30}, ${width * 0.72} ${height * 0.52} Z" fill="#334155" />
    <path d="M ${width * 0.31} ${height * 0.50} C ${width * 0.36} ${height * 0.35}, ${width * 0.60} ${height * 0.34}, ${width * 0.69} ${height * 0.50} Z" fill="#93c5fd" opacity="0.85" />
    <line x1="${width * 0.50}" y1="${height * 0.35}" x2="${width * 0.50}" y2="${height * 0.50}" stroke="#1e293b" stroke-width="${isFull ? 4 : 2}"/>
    <path d="M ${width * 0.12} ${height * 0.62} C ${width * 0.12} ${height * 0.52}, ${width * 0.20} ${height * 0.50}, ${width * 0.28} ${height * 0.52} L ${width * 0.72} ${height * 0.52} C ${width * 0.80} ${height * 0.52}, ${width * 0.88} ${height * 0.55}, ${width * 0.88} ${height * 0.64} C ${width * 0.88} ${height * 0.70}, ${width * 0.82} ${height * 0.72}, ${width * 0.76} ${height * 0.72} L ${width * 0.24} ${height * 0.72} C ${width * 0.16} ${height * 0.72}, ${width * 0.12} ${height * 0.68}, ${width * 0.12} ${height * 0.62} Z" fill="${colorHex}" stroke="${strokeColor}" stroke-width="${isFull ? 3 : 1.5}" />
    <circle cx="${width * 0.84}" cy="${height * 0.58}" r="${isFull ? 10 : 3}" fill="#fef08a" />
    <circle cx="${width * 0.16}" cy="${height * 0.58}" r="${isFull ? 8 : 2.5}" fill="#ef4444" />
    <circle cx="${width * 0.28}" cy="${height * 0.72}" r="${height * 0.12}" fill="#0f172a"/>
    <circle cx="${width * 0.28}" cy="${height * 0.72}" r="${height * 0.07}" fill="#94a3b8"/>
    <circle cx="${width * 0.72}" cy="${height * 0.72}" r="${height * 0.12}" fill="#0f172a"/>
    <circle cx="${width * 0.72}" cy="${height * 0.72}" r="${height * 0.07}" fill="#94a3b8"/>
    <rect x="${width * 0.42}" y="${height * (isFull ? 0.90 : 0.88)}" width="${width * 0.16}" height="${isFull ? 4 : 2}" rx="${isFull ? 2 : 1}" fill="#94a3b8" />
  </svg>`;

  if (typeof btoa === 'function') {
    return 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)));
  }
  return 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64');
}

/**
 * Parses full session.json object along with an optional map of image files and text files from data/{id}
 */
export function parseSessionJson(
  sessionData: SessionJsonRoot,
  imageMap: Map<string, string> = new Map(),
  textMap: Map<string, string> = new Map(),
  batchName = 'فایل زیپ'
): {
  listings: CarListing[];
  sellersCount: number;
  buyersCount: number;
  errorsCount: number;
  retainedErrorRowsCount: number;
} {
  const listings: CarListing[] = [];
  let sellersCount = 0;
  let buyersCount = 0;
  let errorsCount = 0;
  let retainedErrorRowsCount = 0;
  const now = Date.now();
  const currentDateFa = new Date().toLocaleDateString('fa-IR');

  const rules = sessionData.normalizationRules || [];

  // 1. Process sellers
  if (Array.isArray(sessionData.sellers)) {
    for (let i = 0; i < sessionData.sellers.length; i++) {
      const item = sessionData.sellers[i];
      if (!item) continue;

      // Preserve error-marked source rows when any source identity is still available.
      // Keep a separate counter so recovered rows are not confused with clean rows.
      if (item.status === 'error') {
        const hasSourceIdentity = Boolean(
          item.imageFileName || item.اسم_فروشنده || item.فروشنده ||
          item.شماره_تماس || item.تلفن || item.phone || item.mobile
        );
        if (!hasSourceIdentity) {
          errorsCount++;
          continue;
        }
        retainedErrorRowsCount++;
      }

      const rawCarName = (
        item.اسم_ماشین ||
        item.ماشین ||
        item.خودرو ||
        item.مدل ||
        item.نام_ماشین ||
        item.عنوان ||
        item.title ||
        item.carName ||
        item.model ||
        item.name ||
        ''
      ).toString().trim();

      if (!rawCarName && !item.imageFileName && !item.اسم_فروشنده && !item.فروشنده &&
          !item.شماره_تماس && !item.تلفن && !item.phone && !item.mobile) {
        errorsCount++;
        continue;
      }

      const standardCarName = applyNormalizationRules(rawCarName || 'خودرو فروشی', rules);
      const year = parseCarYear(item.سال_ساخت || item.سال || item.year);
      const brand = detectBrand(standardCarName);
      const sellerPhone = extractIranianPhone(
        item.imageFileName,
        item.اسم_فروشنده,
        item.فروشنده,
        item.شماره_تماس,
        item.تلفن,
        item.phone,
        item.mobile,
        item.id,
        item.توضیحات,
        item.توضیحات_بیشتر
      );

      const attrs = extractCarAttributes(item.imageFileName || '', item.رنگ || '');
      const rawPrice = parseNumericValue(item.قیمت_تومان || item.قیمت || item.مبلغ || item.price);
      const priceFormatted = rawPrice > 0 ? formatTomanPrice(rawPrice) : 'توافقی';

      const mileage = parseNumericValue(item.کارکرد_کیلومتر || item.کارکرد || item.کیلومتر || item.mileage);
      const mileageFormatted = mileage > 0 ? `${toPersianDigits(mileage.toLocaleString('en-US'))} کیلومتر` : 'کارشناسی نشده';

      const title = `${standardCarName} - مدل ${toPersianDigits(year)}`;

      // Check if text-only file content is available from data/{id} or imageFileName
      const id = item.id || `seller-${i}`;
      const attachedText =
        textMap.get(id) ||
        textMap.get(item.imageFileName || '') ||
        textMap.get((item.imageFileName || '').replace(/\.[^/.]+$/, ''));
      const isTextOnly = Boolean(
        attachedText ||
        item.imageFileName?.toLowerCase().endsWith('.txt') ||
        item.imageFileName === 'ورودی دستی'
      );

      // Clean file description text (e.g. ۲۰۷ پانا ۴۰۳ سفید ۴۰ تا کار اتومات)
      const filenameCaption = extractCleanFileDescription(
        item.imageFileName,
        item.رنگ,
        ''
      );
      const fileDescription = isTextOnly && attachedText?.trim()
        ? attachedText.trim()
        : (filenameCaption || attachedText?.trim() || item.توضیحات || item.توضیحات_بیشتر || '');

      // Resolve image: look up in imageMap by id or imageFileName
      let imageSrc = imageMap.get(id) || imageMap.get(item.imageFileName || '');
      if (!imageSrc) {
        imageSrc = createCarPlaceholder(attrs.colorHex, standardCarName, false);
      }

      // Keep filename phone/code metadata out of the visible ad text.
      const description = fileDescription;

      const listing: CarListing = {
        id: id,
        type: 'sale',
        title,
        brand,
        model: standardCarName,
        year,
        price: rawPrice,
        priceFormatted,
        mileage,
        mileageFormatted,
        color: item.رنگ || attrs.color,
        gearbox: attrs.gearbox,
        bodyCondition: attrs.bodyCondition,
        fuelType: 'بنزین',
        city: 'تهران',
        phoneNumber: sellerPhone,
        description,
        fileDescription,
        isTextOnly,
        rowIndex: item.rowIndex,
        imageFileName: item.imageFileName,
        status: item.status || 'success',
        importBatchName: batchName,
        importDate: currentDateFa,
        createdAt: new Date(now - (i % 4) * 3600000 * 8).toISOString(),
        imageThumbnailBase64: imageSrc,
        imageFullBase64: imageSrc,
      };

      listing._searchIndex = buildSearchIndex(listing);
      listings.push(listing);
      sellersCount++;
    }
  }

  // 2. Process buyers (Comprehensively parses every buyer row with complete key aliases)
  if (Array.isArray(sessionData.buyers)) {
    for (let i = 0; i < sessionData.buyers.length; i++) {
      const item = sessionData.buyers[i];
      if (!item) continue;

      const rawCarName = (
        item.اسم_ماشین ||
        item.ماشین ||
        item.خودرو ||
        item.مدل ||
        item.نام_ماشین ||
        item.عنوان ||
        item.title ||
        item.carName ||
        item.model ||
        item.name ||
        item.توضیحات_بیشتر ||
        item.description ||
        ''
      ).toString().trim();

      const customerRaw = (
        item.اسم_مشتری ||
        item.مشتری ||
        item.خریدار ||
        item.شماره_تماس ||
        item.تلفن ||
        item.phone ||
        item.mobile ||
        ''
      ).toString().trim();

      // If both car name and customer are completely blank, record error and skip
      if (!rawCarName && !customerRaw && !item.imageFileName) {
        errorsCount++;
        continue;
      }

      const standardCarName = applyNormalizationRules(rawCarName || 'خودرو درخواستی', rules);
      const year = parseCarYear(item.سال_ساخت || item.سال || item.year);
      const brand = detectBrand(standardCarName);
      const buyerPhone = extractIranianPhone(
        customerRaw,
        item.اسم_مشتری,
        item.مشتری,
        item.خریدار,
        item.شماره_تماس,
        item.تلفن,
        item.phone,
        item.mobile,
        item.imageFileName,
        item.id,
        item.توضیحات_بیشتر,
        item.description
      );

      const budget = parseNumericValue(
        item.بودجه_تقریبی_تومان || item.بودجه || item.قیمت || item.مبلغ || item.budget || item.price
      );
      const budgetFormatted = budget > 0 ? formatTomanPrice(budget) : 'بودجه توافقی';

      const yearDisplay = item.سال_ساخت || item.سال || item.year || 'توافقی';
      const title = `خریدار ${standardCarName} - مدل ${toPersianDigits(yearDisplay)}`;

      const id = item.id || `buyer-${i}`;
      const attachedText = textMap.get(id) || textMap.get(item.imageFileName || '');
      const isTextOnly = Boolean(
        attachedText ||
        item.imageFileName?.endsWith('.txt') ||
        item.imageFileName === 'ورودی دستی' ||
        !imageMap.has(id)
      );

      const fileDescription =
        attachedText ||
        item.توضیحات_بیشتر ||
        item.توضیحات ||
        item.description ||
        extractCleanFileDescription(item.imageFileName, item.رنگ);

      let imageSrc = imageMap.get(id) || imageMap.get(item.imageFileName || '');
      if (!imageSrc) {
        imageSrc = createCarPlaceholder('#059669', standardCarName, false);
      }

      const description = [
        fileDescription,
        item.رنگ ? `رنگ‌های مدنظر: ${item.رنگ}` : '',
        item.imageFileName && item.imageFileName !== 'ورودی دستی' ? `منبع: ${item.imageFileName}` : '',
      ]
        .filter(Boolean)
        .join('\n');

      const listing: CarListing = {
        id: id,
        type: 'buy_request',
        title,
        brand,
        model: standardCarName,
        year,
        price: budget,
        priceFormatted: budgetFormatted,
        mileage: 0,
        mileageFormatted: 'مهم نیست',
        color: item.رنگ || 'رنگ دلخواه',
        gearbox: 'اتوماتیک',
        bodyCondition: 'سالم و بی‌رنگ',
        fuelType: 'بنزین',
        city: 'تهران',
        phoneNumber: buyerPhone,
        description,
        fileDescription,
        isTextOnly,
        importBatchName: batchName,
        importDate: currentDateFa,
        createdAt: new Date(now - (i % 4) * 3600000 * 6).toISOString(),
        imageThumbnailBase64: imageSrc,
        imageFullBase64: imageSrc,
      };

      listing._searchIndex = buildSearchIndex(listing);
      listings.push(listing);
      buyersCount++;
    }
  }

  return { listings, sellersCount, buyersCount, errorsCount, retainedErrorRowsCount };
}

/**
 * Extracts and parses a Car Exhibition ZIP archive (.zip)
 * Finds session.json and maps all media files in data/{id}
 */
export async function parseZipArchive(
  file: File | Blob | ArrayBuffer | Uint8Array,
  customBatchName?: string
): Promise<{
  listings: CarListing[];
  sellersCount: number;
  buyersCount: number;
  errorsCount: number;
  extractedImagesCount: number;
  extractedTextFilesCount: number;
  retainedErrorRowsCount: number;
  orphanMediaFilesCount: number;
  orphanMediaFileNames: string[];
}> {
  const zip = new JSZip();
  const loadedZip = await zip.loadAsync(file);

  const imageMap = new Map<string, string>();
  const textMap = new Map<string, string>();
  const jsonFiles: JSZip.JSZipObject[] = [];
  const extensionlessDataEntries: JSZip.JSZipObject[] = [];
  const archiveMediaFileNames: string[] = [];
  let extractedImagesCount = 0;
  let extractedTextFilesCount = 0;
  const fileNames = Object.keys(loadedZip.files);

  for (const name of fileNames) {
    const entry = loadedZip.files[name];
    if (entry.dir) continue;

    const baseName = name.split('/').pop() || name;

    // Check for JSON files
    if (baseName.toLowerCase().endsWith('.json')) {
      jsonFiles.push(entry);
      continue;
    }

    const idWithoutExt = baseName.replace(/\.[^/.]+$/, '');

    // Check for text files in data/ or root
    if (baseName.toLowerCase().endsWith('.txt')) {
      try {
        const textContent = await entry.async('string');
        textMap.set(idWithoutExt, textContent);
        textMap.set(baseName, textContent);
        extractedTextFilesCount++;
        archiveMediaFileNames.push(name);
      } catch (err) {
        console.warn('Failed to extract text entry from zip:', name, err);
      }
      continue;
    }

    // Keep extensionless data/{id} entries until session.json tells us whether
    // each one is an image or the attached text body of a TXT-only listing.
    const normalizedZipPath = name.replace(/\\/g, '/');
    const isDataPath = normalizedZipPath.split('/').includes('data');
    const hasFileExtension = /\.[^/.]+$/.test(baseName);
    if (isDataPath && !hasFileExtension) {
      extensionlessDataEntries.push(entry);
      continue;
    }

    // Extract only recognized image formats; do not treat every file in data/ as an image.
    if (/\.(jpg|jpeg|png|webp|svg)$/i.test(baseName)) {
      try {
        const ext = baseName.split('.').pop()?.toLowerCase() || 'jpg';
        const mimeType = ext === 'png' ? 'image/png' : ext === 'svg' ? 'image/svg+xml' : 'image/jpeg';
        const base64 = await entry.async('base64');
        const dataUrl = `data:${mimeType};base64,${base64}`;

        imageMap.set(idWithoutExt, dataUrl);
        imageMap.set(baseName, dataUrl);
        extractedImagesCount++;
        archiveMediaFileNames.push(name);
      } catch (err) {
        console.warn('Failed to extract image entry from zip:', name, err);
      }
    }
  }

  if (jsonFiles.length === 0) {
    throw new Error('هیچ فایل JSON یا دیتایی در آرشیو فشرده ZIP یافت نشد. لطفاً ساختار زیپ را بررسی فرمایید.');
  }

  // Sort so session.json is processed first if present
  jsonFiles.sort((a, b) => {
    const aName = a.name.split('/').pop()?.toLowerCase() || '';
    const bName = b.name.split('/').pop()?.toLowerCase() || '';
    if (aName === 'session.json') return -1;
    if (bName === 'session.json') return 1;
    return 0;
  });

  const sessionObj: SessionJsonRoot = { sellers: [], buyers: [] };

  for (const jFile of jsonFiles) {
    try {
      const sessionContent = await jFile.async('string');
      const parsed = JSON.parse(sessionContent);

      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          if (item.اسم_مشتری || item.مشتری || item.بودجه_تقریبی_تومان || item.type === 'buy_request') {
            sessionObj.buyers = sessionObj.buyers || [];
            sessionObj.buyers.push(item);
          } else {
            sessionObj.sellers = sessionObj.sellers || [];
            sessionObj.sellers.push(item);
          }
        }
      } else if (parsed && typeof parsed === 'object') {
        if (Array.isArray(parsed.sellers)) {
          sessionObj.sellers = sessionObj.sellers || [];
          sessionObj.sellers.push(...parsed.sellers);
        }
        if (Array.isArray(parsed.buyers)) {
          sessionObj.buyers = sessionObj.buyers || [];
          sessionObj.buyers.push(...parsed.buyers);
        }
        if (parsed.normalizationRules) {
          sessionObj.normalizationRules = parsed.normalizationRules;
        }
      }
    } catch (err) {
      console.warn('Failed to parse json file from zip:', jFile.name, err);
    }
  }

  // Resolve extensionless data/{id} payloads using the source record type.
  // TXT-only records may store their text body under data/{id} without a .txt extension.
  const textOnlyRecordIds = new Set<string>();
  for (const item of [...(sessionObj.sellers || []), ...(sessionObj.buyers || [])]) {
    if (!item.imageFileName?.toLowerCase().endsWith('.txt')) continue;
    if (item.id) textOnlyRecordIds.add(item.id);
    const sourceFileName = item.imageFileName.split(/[\\/]/).pop() || item.imageFileName;
    const sourceFileStem = sourceFileName.replace(/\.[^/.]+$/, '');
    if (sourceFileStem) textOnlyRecordIds.add(sourceFileStem);
  }

  for (const entry of extensionlessDataEntries) {
    const baseName = entry.name.replace(/\\/g, '/').split('/').pop() || entry.name;
    try {
      if (textOnlyRecordIds.has(baseName)) {
        const textContent = await entry.async('string');
        textMap.set(baseName, textContent);
        extractedTextFilesCount++;
      } else {
        const base64 = await entry.async('base64');
        const dataUrl = `data:image/jpeg;base64,${base64}`;
        imageMap.set(baseName, dataUrl);
        extractedImagesCount++;
      }
      archiveMediaFileNames.push(entry.name);
    } catch (err) {
      console.warn('Failed to extract extensionless data entry from zip:', entry.name, err);
    }
  }

  // Detect media files that have no matching seller/buyer record in session.json.
  const referencedSourceKeys = new Set<string>();
  const addSourceReference = (sourceName?: string) => {
    if (!sourceName) return;
    const normalized = sourceName.replace(/\\/g, '/');
    const baseName = normalized.split('/').pop() || normalized;
    const stem = baseName.replace(/\.[^/.]+$/, '');
    if (baseName) referencedSourceKeys.add(baseName);
    if (stem) referencedSourceKeys.add(stem);
  };

  for (const item of [...(sessionObj.sellers || []), ...(sessionObj.buyers || [])]) {
    if (item.id) referencedSourceKeys.add(item.id);
    addSourceReference(item.imageFileName);
  }

  const orphanMediaFileNames = archiveMediaFileNames.filter((filePath) => {
    const baseName = filePath.replace(/\\/g, '/').split('/').pop() || filePath;
    const stem = baseName.replace(/\.[^/.]+$/, '');
    return !referencedSourceKeys.has(baseName) && !referencedSourceKeys.has(stem);
  });

  const batchName = customBatchName || (file && 'name' in file && typeof (file as any).name === 'string' ? (file as any).name : 'بسته فایل زیپ');
  const result = parseSessionJson(sessionObj, imageMap, textMap, batchName);

  return {
    ...result,
    extractedImagesCount,
    extractedTextFilesCount,
    retainedErrorRowsCount: result.retainedErrorRowsCount,
    orphanMediaFilesCount: orphanMediaFileNames.length,
    orphanMediaFileNames: orphanMediaFileNames.slice(0, 20),
  };
}

/**
 * Parses CSV export files (sellers or buyers)
 */
export function parseCarCsv(csvContent: string, customBatchName = 'فایل CSV'): CarListing[] {
  const cleaned = csvContent.replace(/^\uFEFF/, '').trim();
  const lines = cleaned.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length < 2) return [];

  const header = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''));
  const isBuyer = header.some((h) => h.includes('مشتری') || h.includes('بودجه'));

  const listings: CarListing[] = [];
  const now = Date.now();
  const currentDateFa = new Date().toLocaleDateString('fa-IR');

  for (let i = 1; i < lines.length; i++) {
    const row = lines[i].split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
    if (row.length < 3) continue;

    if (isBuyer) {
      const customer = row[0] || 'مشتری';
      const carName = row[1] || 'خودرو درخواستی';
      const year = parseCarYear(row[2]);
      const color = row[3] || 'توافقی';
      const budget = parseNumericValue(row[4]);
      const notes = row[5] || '';
      const phone = extractIranianPhone(customer, row[0], row[5], row[1], row[3]);

      const listing: CarListing = {
        id: `csv-buyer-${i}`,
        type: 'buy_request',
        title: `خریدار ${carName} - مدل ${toPersianDigits(row[2] || 'توافقی')}`,
        brand: detectBrand(carName),
        model: carName,
        year,
        price: budget,
        priceFormatted: budget > 0 ? formatTomanPrice(budget) : 'بودجه توافقی',
        mileage: 0,
        mileageFormatted: 'مهم نیست',
        color,
        gearbox: 'اتوماتیک',
        bodyCondition: 'سالم',
        fuelType: 'بنزین',
        city: 'تهران',
        phoneNumber: phone,
        description: notes,
        fileDescription: notes,
        isTextOnly: true,
        importBatchName: customBatchName,
        importDate: currentDateFa,
        createdAt: new Date(now - i * 3600000).toISOString(),
        imageThumbnailBase64: createCarPlaceholder('#059669', carName, false),
        imageFullBase64: createCarPlaceholder('#059669', carName, true),
      };
      listing._searchIndex = buildSearchIndex(listing);
      listings.push(listing);
    } else {
      const carName = row[1] || 'خودرو فروشی';
      const year = parseCarYear(row[2]);
      const color = row[3] || 'سفید';
      const mileage = parseNumericValue(row[4]);
      const price = parseNumericValue(row[5]);
      const seller = row[6] || 'فروشنده';
      const filename = row[7] || '';
      const phone = extractIranianPhone(seller, filename, row[6], row[7], row[0], row[1]);

      const attrs = extractCarAttributes(filename, color);
      const fileDescription = extractCleanFileDescription(filename, color, attrs.notes);

      const listing: CarListing = {
        id: `csv-seller-${i}`,
        type: 'sale',
        title: `${carName} - مدل ${toPersianDigits(year)}`,
        brand: detectBrand(carName),
        model: carName,
        year,
        price: price,
        priceFormatted: price > 0 ? formatTomanPrice(price) : 'توافقی',
        mileage,
        mileageFormatted: mileage > 0 ? `${toPersianDigits(mileage.toLocaleString('en-US'))} کیلومتر` : 'کارشناسی نشده',
        color,
        gearbox: attrs.gearbox,
        bodyCondition: attrs.bodyCondition,
        fuelType: 'بنزین',
        city: 'تهران',
        phoneNumber: phone,
        description: fileDescription,
        fileDescription,
        isTextOnly: filename.endsWith('.txt'),
        importBatchName: customBatchName,
        importDate: currentDateFa,
        createdAt: new Date(now - i * 3600000).toISOString(),
        imageThumbnailBase64: createCarPlaceholder(attrs.colorHex, carName, false),
        imageFullBase64: createCarPlaceholder(attrs.colorHex, carName, true),
      };
      listing._searchIndex = buildSearchIndex(listing);
      listings.push(listing);
    }
  }

  return listings;
}
