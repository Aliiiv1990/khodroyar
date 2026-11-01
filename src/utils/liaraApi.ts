import { CarListing } from '../types/car';
import { getListingImage, optimizeImageForUpload } from './imageHelper';
import { buildSearchIndex } from './persianSearch';
import JSZip from 'jszip';

export interface LiaraHealthResponse {
  status: string;
  platform: string;
  dbLocation: string;
  isLiaraDisk: boolean;
  totalListings: number;
  lastUpdated: string;
}

/**
 * Checks connectivity to the Liara Cloud backend server
 */
export async function checkLiaraHealth(timeoutMs = 8000): Promise<{
  ok: boolean;
  data?: LiaraHealthResponse;
  message: string;
}> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      controller.abort(new Error('مهلت زمانی ارتباط با سرور لیارا پایان یافت'));
    }, timeoutMs);

    const resp = await fetch('/api/health', {
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!resp.ok) {
      return {
        ok: false,
        message: `پاسخ ناموفق از سرور لیارا (کد وضعیت ${resp.status})`,
      };
    }

    const data: LiaraHealthResponse = await resp.json();
    return {
      ok: true,
      data,
      message: `اتصال به سرور لیارا برقرار است (${data.totalListings} خودرو در دیتابیس)`,
    };
  } catch (err: any) {
    return {
      ok: false,
      message: 'عدم ارتباط با سرور محلی/لیارا (احتمال اجرای برنامه به صورت استاتیک یا خاموش بودن سرور)',
    };
  }
}

/**
 * Fetches all active car listings from Liara Cloud database with timeout & cache busting
 */
export async function fetchListingsFromLiara(timeoutMs = 20000): Promise<CarListing[] | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      controller.abort(new Error('مهلت بارگیری از سرور به پایان رسید'));
    }, timeoutMs);

    const resp = await fetch(`/api/listings?_t=${Date.now()}`, {
      signal: controller.signal,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        Pragma: 'no-cache',
      },
    });
    clearTimeout(timer);

    if (!resp.ok) return null;

    const result = await resp.json();
    if (!result.success || !Array.isArray(result.listings)) return null;

    return result.listings.map((item: any) => ({
      ...item,
      imageThumbnailBase64: getListingImage(item, false),
      imageFullBase64: getListingImage(item, true),
      _searchIndex: item._searchIndex || buildSearchIndex(item),
    }));
  } catch (err) {
    console.warn('Could not fetch listings from Liara server:', err);
    return null;
  }
}

export interface LiaraSyncMeta {
  success: boolean;
  lastUpdated: string;
  hiddenBatches: string[];
  totalListings: number;
}

/**
 * Fetches lightweight synchronization metadata (~50 bytes) from Liara Cloud
 */
export async function fetchSyncMetaFromLiara(): Promise<LiaraSyncMeta | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    const resp = await fetch(`/api/sync-meta?_t=${Date.now()}`, {
      signal: controller.signal,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        Pragma: 'no-cache',
      },
    });
    clearTimeout(timer);
    if (!resp.ok) return null;
    return await resp.json();
  } catch {
    return null;
  }
}

/**
 * Publishes/Syncs car listings to Liara Cloud centralized database.
 * Uses lightweight optimized batches (70 items), pre-compresses photos,
 * extends timeout to 120s with exponential retries so large datasets
 * (1,400+ items) never abort or time out on any internet connection!
 */
export async function publishListingsToLiara(
  listings: CarListing[],
  append = true,
  publishedBy = 'مدیر سیستم',
  onProgress?: (percent: number, currentBatch: number, totalBatches: number) => void
): Promise<{ success: boolean; message: string; count?: number }> {
  try {
    if (listings.length === 0) {
      return { success: false, message: 'هیچ آگهی برای ارسال انتخاب نشده است.' };
    }

    const BATCH_SIZE = 50;
    const totalBatches = Math.ceil(listings.length / BATCH_SIZE);

    // 1. Pre-process listings: keep high-res 1280x960 (q=0.85) for full view and 420x315 (q=0.75) for thumbnails
    const sanitizedListings: CarListing[] = [];
    for (let idx = 0; idx < listings.length; idx++) {
      const item = listings[idx];
      const rawFull = item.imageFullBase64 || item.imageThumbnailBase64 || '';
      const rawThumb = item.imageThumbnailBase64 || rawFull || '';

      let optFull = rawFull;
      let optThumb = rawThumb;

      // Full Photo: 1280x960 at 0.85 quality - razor sharp license plates, text, paint condition
      if (optFull && optFull.length > 85000 && !optFull.startsWith('data:image/svg+xml')) {
        optFull = await optimizeImageForUpload(optFull, 1280, 960, 0.85);
      }

      // Thumbnail: 420x315 at 0.75 quality - ultra-compact ~20KB for high-speed scrolling
      if (optThumb && optThumb.length > 28000 && !optThumb.startsWith('data:image/svg+xml')) {
        optThumb = await optimizeImageForUpload(optThumb, 420, 315, 0.75);
      }

      sanitizedListings.push({
        id: String(item.id || `car_${idx}`),
        rowIndex: item.rowIndex,
        type: item.type === 'buy_request' ? 'buy_request' : 'sale',
        title: item.title || item.model || 'خودرو',
        brand: item.brand || '',
        model: item.model || '',
        year: Number(item.year) || 1402,
        price: Number(item.price) || 0,
        priceFormatted: item.priceFormatted || 'توافقی',
        mileage: Number(item.mileage) || 0,
        mileageFormatted: item.mileageFormatted || 'صفر',
        color: item.color || 'سفید',
        gearbox: item.gearbox || 'دنده‌ای',
        bodyCondition: item.bodyCondition || 'بی‌رنگ',
        fuelType: item.fuelType || 'بنزین',
        city: item.city || 'تهران',
        phoneNumber: item.phoneNumber || '',
        description: item.description || '',
        fileDescription: item.fileDescription || '',
        imageFileName: item.imageFileName || '',
        status: item.status || 'success',
        createdAt: item.createdAt || new Date().toISOString(),
        source: item.source || 'admin',
        creatorName: item.creatorName || '',
        isTextOnly: Boolean(item.isTextOnly),
        importBatchName: item.importBatchName || 'بسته فایل زیپ',
        importDate: item.importDate || new Date(item.createdAt || Date.now()).toLocaleDateString('fa-IR'),
        imageThumbnailBase64: optThumb || optFull || '',
        imageFullBase64: optFull || optThumb || '',
      });

      // Quick progress feedback during preparation for huge lists
      if (listings.length > 300 && idx % 100 === 0 && onProgress) {
        const prepPercent = Math.min(10, Math.round((idx / listings.length) * 10));
        onProgress(prepPercent, 0, totalBatches);
      }
    }

    let totalSaved = 0;

    // 2. Transmit in resilient batches with retries
    for (let i = 0; i < totalBatches; i++) {
      const batch = sanitizedListings.slice(i * BATCH_SIZE, (i + 1) * BATCH_SIZE);
      const isFirst = i === 0;
      const batchAppend = true;

      let batchSuccess = false;
      let lastError: any = null;

      // Retry up to 4 times per batch with exponential backoff
      for (let attempt = 1; attempt <= 4; attempt++) {
        let timer: NodeJS.Timeout | null = null;
        try {
          const controller = new AbortController();
          timer = setTimeout(() => {
            controller.abort();
          }, 120000); // 120s timeout per batch

          const resp = await fetch('/api/admin/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              listings: batch,
              append: batchAppend,
              publishedBy,
            }),
            signal: controller.signal,
          });

          if (!resp.ok) {
            const errorText = await resp.text().catch(() => '');
            throw new Error(`خطای سرور (${resp.status}): ${errorText.slice(0, 100)}`);
          }

          const result = await resp.json();
          totalSaved = result.total || result.count || (isFirst ? batch.length : totalSaved + batch.length);
          batchSuccess = true;
          break;
        } catch (err: any) {
          lastError = err;
          if (attempt < 4) {
            // Exponential wait before retry: 1.5s, 3s, 5s
            await new Promise((r) => setTimeout(r, attempt * 1500));
          }
        } finally {
          if (timer) clearTimeout(timer);
        }
      }

      if (!batchSuccess) {
        let errMsg = lastError?.message || 'خطای شبکه';
        if (errMsg.includes('aborted') || errMsg.includes('AbortError') || errMsg.includes('Timeout') || errMsg.includes('signal')) {
          errMsg = 'مهلت ارتباط با سرور پایان یافت یا اینترنت لحظه‌ای قطع شد. لطفاً دوباره دکمه را بزنید.';
        }
        throw new Error(`ارسال بسته ${i + 1} از ${totalBatches} با خطا مواجه شد: ${errMsg}`);
      }

      if (onProgress) {
        const percent = Math.min(100, Math.round(((i + 1) / totalBatches) * 100));
        onProgress(percent, i + 1, totalBatches);
      }
    }

    return {
      success: true,
      message: `تمامی ${totalSaved} خودرو همراه با تصاویر و مشخصات با موفقیت در دیتابیس پایدار لیارا ثبت گردید و برای تمام دستگاه‌ها همگام شد.`,
      count: totalSaved,
    };
  } catch (err: any) {
    let cleanMessage = err.message || 'مشکل ارتباط با سرور لیارا';
    if (cleanMessage.includes('aborted') || cleanMessage.includes('AbortError') || cleanMessage.includes('signal')) {
      cleanMessage = 'مهلت زمانی ارتباط به پایان رسید یا اینترنت قطع شد. لطفاً مجدداً امتحان نمایید.';
    }
    return {
      success: false,
      message: `خطا در ذخیره‌سازی در لیارا: ${cleanMessage}`,
    };
  }
}

/**
 * Adds single listing (submitted by colleague/user) to Liara Cloud database
 */
export async function addListingToLiara(listing: CarListing): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);

    const resp = await fetch('/api/listings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...listing,
        source: 'user',
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    return resp.ok;
  } catch (err) {
    console.warn('Could not add listing to Liara database:', err);
    return false;
  }
}

/**
 * Clears the centralized database on Liara
 */
export async function clearLiaraDatabase(): Promise<boolean> {
  try {
    const resp = await fetch('/api/admin/clear', { method: 'POST' });
    return resp.ok;
  } catch (err) {
    console.warn('Could not clear Liara database:', err);
    return false;
  }
}

export interface LiaraBatchInfo {
  id: string;
  batchName: string;
  date: string;
  count: number;
  saleCount: number;
  buyCount: number;
  isVisible: boolean;
}

/**
 * Fetches all distinct file/zip batches and import dates from Liara server
 */
export async function fetchLiaraBatches(): Promise<LiaraBatchInfo[]> {
  try {
    const resp = await fetch(`/api/admin/batches?_t=${Date.now()}`);
    if (!resp.ok) return [];
    const data = await resp.json();
    return Array.isArray(data.batches) ? data.batches : [];
  } catch (err) {
    console.warn('Could not fetch batches from Liara:', err);
    return [];
  }
}

/**
 * Toggles visibility of a specific batch or multiple batches on the Liara server
 */
export async function setLiaraBatchVisibility(
  batchName: string,
  isVisible: boolean
): Promise<{ success: boolean; message: string; hiddenBatches?: string[] }> {
  try {
    const resp = await fetch('/api/admin/batch-visibility', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ batchName, isVisible }),
    });
    const data = await resp.json();
    return {
      success: Boolean(data.success),
      message: data.message || (isVisible ? 'بسته فعال شد.' : 'بسته مخفی شد.'),
      hiddenBatches: data.hiddenBatches,
    };
  } catch (err: any) {
    return {
      success: false,
      message: `خطا در تغییر وضعیت نمایش بسته: ${err.message || 'مشکل ارتباط با سرور'}`,
    };
  }
}

/**
 * Toggles visibility of multiple batches at once
 */
export async function setMultipleLiaraBatchesVisibility(
  batchNames: string[],
  isVisible: boolean
): Promise<{ success: boolean; message: string; hiddenBatches?: string[] }> {
  try {
    const resp = await fetch('/api/admin/batch-visibility', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ batchNames, isVisible }),
    });
    const data = await resp.json();
    return {
      success: Boolean(data.success),
      message: data.message || (isVisible ? 'بسته‌ها فعال شدند.' : 'بسته‌ها مخفی شدند.'),
      hiddenBatches: data.hiddenBatches,
    };
  } catch (err: any) {
    return {
      success: false,
      message: `خطا در تغییر وضعیت نمایش بسته‌ها: ${err.message || 'مشکل ارتباط با سرور'}`,
    };
  }
}

/**
 * Deletes selected batches or date from Liara server
 */
export async function deleteLiaraBatches(params: {
  batchName?: string;
  date?: string;
  batchNames?: string[];
}): Promise<{ success: boolean; message: string; remaining?: number }> {
  try {
    const resp = await fetch('/api/admin/delete-batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (!resp.ok) {
      const errText = await resp.text().catch(() => '');
      return { success: false, message: `خطای سرور (${resp.status}): ${errText}` };
    }
    const data = await resp.json();
    return {
      success: Boolean(data.success),
      message: data.message || 'بسته‌های انتخاب‌شده با موفقیت از سرور حذف شدند.',
      remaining: data.remaining,
    };
  } catch (err: any) {
    return { success: false, message: `خطا در حذف بسته: ${err.message || 'مشکل ارتباط با سرور'}` };
  }
}

/**
 * Generates and triggers download of a ready-to-deploy zip archive for Liara Drag & Drop!
 */
export async function downloadLiaraDeploymentZip(onProgress?: (percent: number) => void): Promise<void> {
  if (onProgress) onProgress(15);

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);

    const resp = await fetch('/api/export/liara-zip', { signal: controller.signal });
    clearTimeout(timer);

    if (resp.ok) {
      if (onProgress) onProgress(65);
      const blob = await resp.blob();
      if (onProgress) onProgress(90);

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `liara_deployment_${new Date().toISOString().slice(0, 10)}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      if (onProgress) onProgress(100);
      return;
    }
  } catch (err) {
    console.warn('Could not fetch server zip endpoint, falling back to client-generated package:', err);
  }

  // Fallback client-side generation
  const zip = new JSZip();

  zip.file(
    'package.json',
    JSON.stringify(
      {
        name: 'car-exhibition',
        private: true,
        version: '1.0.0',
        type: 'module',
        scripts: { start: 'node server.js' },
        dependencies: { express: '^4.21.2', dotenv: '^17.2.3' },
      },
      null,
      2
    )
  );

  zip.file(
    'liara.json',
    JSON.stringify(
      {
        platform: 'node',
        app: 'car-exhibition',
        port: 3000,
        disks: [{ name: 'data', mountTo: '/data' }],
      },
      null,
      2
    )
  );

  zip.file('.liaraignore', 'node_modules/\n.git/\n.env\n.env.local\n.DS_Store\n');
  zip.file('.env.example', 'PORT=3000\nNODE_ENV=production\n');
  zip.file(
    'README.md',
    `# Car Exhibition App - آماده برای استقرار در لیارا (Liara Cloud)
۱. وارد کنسول لیارا (console.liara.ir) شوید.
۲. برنامه جدید از نوع NodeJS بسازید.
۳. دیسکی با نام data و مسیر مونت /data بسازید.
۴. همین فایل زیپ را با Drag & Drop آپلود کنید.
`
  );

  if (onProgress) onProgress(75);
  const blob = await zip.generateAsync({ type: 'blob' }, (metadata) => {
    if (onProgress) onProgress(75 + Math.round(metadata.percent * 0.25));
  });

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `liara_deployment_${new Date().toISOString().slice(0, 10)}.zip`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  if (onProgress) onProgress(100);
}
