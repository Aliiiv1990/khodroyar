import { CarListing } from '../types/car';
import { getListingImage } from './imageHelper';
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
export async function checkLiaraHealth(timeoutMs = 6000): Promise<{
  ok: boolean;
  data?: LiaraHealthResponse;
  message: string;
}> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

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
export async function fetchListingsFromLiara(timeoutMs = 9000): Promise<CarListing[] | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

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

/**
 * Publishes/Syncs car listings to Liara Cloud centralized database
 * Sends in optimized batches of 100 items to avoid Nginx proxy body limit (413)
 * and provide real-time progress updates so the UI never hangs or spins infinitely!
 */
export async function publishListingsToLiara(
  listings: CarListing[],
  append = false,
  publishedBy = 'مدیر سیستم',
  onProgress?: (percent: number, currentBatch: number, totalBatches: number) => void
): Promise<{ success: boolean; message: string; count?: number }> {
  try {
    if (listings.length === 0) {
      return { success: false, message: 'هیچ آگهی برای ارسال انتخاب نشده است.' };
    }

    const BATCH_SIZE = 100;
    const totalBatches = Math.ceil(listings.length / BATCH_SIZE);

    // Keep payload lightweight to ensure lightning-fast upload
    const sanitizedListings = listings.map((item) => ({
      id: item.id,
      rowIndex: item.rowIndex,
      model: item.model,
      year: item.year,
      color: item.color,
      mileage: item.mileage,
      price: item.price,
      phoneNumber: item.phoneNumber,
      type: item.type || 'sale',
      description: item.description,
      fileDescription: item.fileDescription,
      imageFileName: item.imageFileName,
      status: item.status || 'success',
      createdAt: item.createdAt || new Date().toISOString(),
      source: item.source || 'admin',
      isTextOnly: item.isTextOnly,
      // Retain custom photo if user actually attached one; otherwise omit so server/client falls back to SVG
      imageThumbnailBase64: item.imageThumbnailBase64 || undefined,
      imageFullBase64: item.imageFullBase64 || undefined,
    }));

    let totalSaved = 0;

    for (let i = 0; i < totalBatches; i++) {
      const batch = sanitizedListings.slice(i * BATCH_SIZE, (i + 1) * BATCH_SIZE);
      const isFirst = i === 0;
      // First batch clears if append is false; subsequent batches always append to complete the set
      const batchAppend = isFirst ? append : true;

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 25000);

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
      clearTimeout(timer);

      if (!resp.ok) {
        const errorText = await resp.text();
        throw new Error(`خطای سرور (${resp.status}): ${errorText.slice(0, 100)}`);
      }

      const result = await resp.json();
      totalSaved = result.total || result.count || totalSaved + batch.length;

      if (onProgress) {
        const percent = Math.round(((i + 1) / totalBatches) * 100);
        onProgress(percent, i + 1, totalBatches);
      }
    }

    return {
      success: true,
      message: `تمامی ${totalSaved} خودرو با موفقیت در دیتابیس پایدار لیارا ثبت گردید و برای تمام دستگاه‌ها همگام شد.`,
      count: totalSaved,
    };
  } catch (err: any) {
    return {
      success: false,
      message: `خطا در ذخیره‌سازی در لیارا: ${err.message || 'مشکل ارتباط با سرور یا پایان زمان انتظار'}`,
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
