import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  limit,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { CarListing } from '../types/car';
import { buildSearchIndex } from './persianSearch';

const USER_LISTINGS_COLLECTION = 'user_listings';
const ADMIN_DATASET_DOC = 'admin_dataset/latest';
const CHUNKS_COLLECTION = 'admin_dataset/latest/chunks';

/**
 * Subscribe to real-time car listings submitted by users & colleagues
 */
export function subscribeToUserListings(
  onUpdate: (listings: CarListing[]) => void,
  onError?: (err: any) => void
): () => void {
  const colRef = collection(db, USER_LISTINGS_COLLECTION);
  const q = query(colRef, limit(200));

  return onSnapshot(
    q,
    (snapshot) => {
      const userListings: CarListing[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as CarListing;
        const completeListing: CarListing = {
          ...data,
          source: 'user',
          _searchIndex: data._searchIndex || buildSearchIndex(data),
        };
        userListings.push(completeListing);
      });
      // Sort newest first
      userListings.sort((a, b) => {
        const timeA = new Date(a.createdAt || 0).getTime();
        const timeB = new Date(b.createdAt || 0).getTime();
        return timeB - timeA;
      });
      onUpdate(userListings);
    },
    (error) => {
      console.warn('Real-time listener warning for user_listings:', error);
      if (onError) onError(error);
      try {
        handleFirestoreError(error, OperationType.LIST, USER_LISTINGS_COLLECTION);
      } catch {
        // Logged
      }
    }
  );
}

/**
 * Save a newly added car listing by a user/colleague to the cloud
 */
export async function addListingToCloud(listing: CarListing): Promise<void> {
  const sanitizedId = listing.id.replace(/[^a-zA-Z0-9_-]/g, '_');
  const targetDoc = doc(db, USER_LISTINGS_COLLECTION, sanitizedId);
  const payload: any = {
    id: sanitizedId,
    type: listing.type,
    title: listing.title || listing.model,
    brand: listing.brand || '',
    model: listing.model,
    year: Number(listing.year) || 1402,
    price: Number(listing.price) || 0,
    priceFormatted: listing.priceFormatted || 'توافقی',
    mileage: Number(listing.mileage) || 0,
    mileageFormatted: listing.mileageFormatted || 'صفر',
    color: listing.color || 'سفید',
    gearbox: listing.gearbox || 'دنده‌ای',
    bodyCondition: listing.bodyCondition || 'بدون رنگ',
    fuelType: listing.fuelType || 'بنزین',
    city: listing.city || 'تهران',
    phoneNumber: listing.phoneNumber || '',
    description: (listing.description || '').slice(0, 2000),
    createdAt: listing.createdAt || new Date().toISOString(),
    source: 'user',
    creatorName: (listing.creatorName || 'همکار').slice(0, 100),
    isTextOnly: Boolean(listing.isTextOnly),
    fileDescription: (listing.fileDescription || '').slice(0, 2000),
    imageThumbnailBase64: (listing.imageThumbnailBase64 || '').slice(0, 300000),
    imageFullBase64: (listing.imageFullBase64 || '').slice(0, 450000),
  };

  try {
    await setDoc(targetDoc, payload);
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `${USER_LISTINGS_COLLECTION}/${sanitizedId}`);
  }
}

const CHUNK_SIZE = 100;

function withTimeout<T>(promise: Promise<T>, ms: number, errorMsg: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(errorMsg)), ms)),
  ]);
}

function sanitizeListingForCloudChunk(item: CarListing) {
  return {
    id: String(item.id || ''),
    type: item.type === 'buy_request' ? 'buy_request' : 'sale',
    title: String(item.title || item.model || ''),
    brand: String(item.brand || ''),
    model: String(item.model || ''),
    year: Number(item.year) || 1402,
    price: Number(item.price) || 0,
    priceFormatted: String(item.priceFormatted || 'توافقی'),
    mileage: Number(item.mileage) || 0,
    mileageFormatted: String(item.mileageFormatted || 'صفر'),
    color: String(item.color || 'سفید'),
    gearbox: String(item.gearbox || 'دنده‌ای'),
    bodyCondition: String(item.bodyCondition || 'بی‌رنگ'),
    fuelType: String(item.fuelType || 'بنزین'),
    city: String(item.city || 'تهران'),
    phoneNumber: String(item.phoneNumber || ''),
    description: String(item.description || '').slice(0, 1500),
    fileDescription: String(item.fileDescription || '').slice(0, 1500),
    isTextOnly: Boolean(item.isTextOnly),
    createdAt: item.createdAt || new Date().toISOString(),
    source: 'admin' as const,
    creatorName: String(item.creatorName || ''),
    // Only keep compact thumbnails (< 25KB) to guarantee chunk stays far below Firestore 1MB document limit
    imageThumbnailBase64:
      item.imageThumbnailBase64 && item.imageThumbnailBase64.length < 25000
        ? item.imageThumbnailBase64
        : '',
  };
}

/**
 * Admin publishes the daily dataset archive to cloud for all visitors
 */
export async function publishAdminDatasetToCloud(
  listings: CarListing[],
  onProgress?: (percent: number, currentChunk: number, totalChunks: number) => void
): Promise<void> {
  const total = listings.length;
  if (total === 0) return;

  const chunkCount = Math.ceil(total / CHUNK_SIZE);
  if (onProgress) onProgress(1, 0, chunkCount);

  // 1. Write chunks in batches
  for (let i = 0; i < chunkCount; i++) {
    const rawChunk = listings.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
    const chunkItems = rawChunk.map(sanitizeListingForCloudChunk);

    const chunkDoc = doc(db, 'admin_dataset', 'latest', 'chunks', `chunk_${i}`);
    try {
      await withTimeout(
        setDoc(chunkDoc, {
          chunkIndex: i,
          listings: chunkItems,
        }),
        20000,
        `مهلت ارسال بسته ${i + 1} از ${chunkCount} به پایان رسید. لطفاً وضعیت اینترنت یا فیلترشکن را بررسی کنید.`
      );
    } catch (err: any) {
      handleFirestoreError(err, OperationType.WRITE, `admin_dataset/latest/chunks/chunk_${i}`);
    }

    if (onProgress) {
      const percent = Math.min(95, Math.round(((i + 1) / chunkCount) * 95));
      onProgress(percent, i + 1, chunkCount);
    }
  }

  // 2. Write metadata doc
  const metaDoc = doc(db, 'admin_dataset', 'latest');
  try {
    await withTimeout(
      setDoc(metaDoc, {
        id: 'latest',
        totalCount: total,
        chunkCount,
        publishedAt: new Date().toISOString(),
        publishedBy: 'مدیر سیستم',
        title: 'بانک اطلاعات روزانه خودروها',
      }),
      15000,
      'مهلت ثبت فراداده پایانی به پایان رسید.'
    );
  } catch (err: any) {
    handleFirestoreError(err, OperationType.WRITE, ADMIN_DATASET_DOC);
  }

  if (onProgress) {
    onProgress(100, chunkCount, chunkCount);
  }
}

/**
 * Fetch the latest admin dataset from cloud
 */
export async function fetchAdminDatasetFromCloud(
  onProgress?: (percent: number) => void
): Promise<CarListing[] | null> {
  try {
    const metaDoc = doc(db, 'admin_dataset', 'latest');
    const metaSnap = await withTimeout(
      getDoc(metaDoc),
      15000,
      'پایان مهلت بررسی اطلاعات ابر. لطفاً اتصال اینترنت یا فیلترشکن را بررسی نمایید.'
    );

    if (!metaSnap.exists()) {
      return null;
    }

    const meta = metaSnap.data();
    const chunkCount = meta.chunkCount || 0;
    if (chunkCount === 0) return null;

    const allListings: CarListing[] = [];
    const chunksCol = collection(db, 'admin_dataset', 'latest', 'chunks');
    const chunksSnap = await withTimeout(
      getDocs(chunksCol),
      25000,
      'پایان مهلت بارگیری بسته‌های اطلاعاتی از سرور ابری.'
    );

    const sortedDocs = chunksSnap.docs.sort((a, b) => {
      const idxA = a.data().chunkIndex ?? 0;
      const idxB = b.data().chunkIndex ?? 0;
      return idxA - idxB;
    });

    let loaded = 0;
    for (const snap of sortedDocs) {
      const data = snap.data();
      if (Array.isArray(data.listings)) {
        for (const item of data.listings) {
          allListings.push({
            ...item,
            source: 'admin',
            _searchIndex: item._searchIndex || buildSearchIndex(item),
          });
        }
      }
      loaded++;
      if (onProgress) {
        onProgress(Math.round((loaded / sortedDocs.length) * 100));
      }
    }

    return allListings;
  } catch (err) {
    console.warn('Could not fetch admin dataset from cloud:', err);
    throw err;
  }
}
