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
const CHUNK_SIZE = 150;

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

/**
 * Admin publishes the daily dataset archive to cloud for all visitors
 */
export async function publishAdminDatasetToCloud(
  listings: CarListing[],
  onProgress?: (percent: number, currentChunk: number, totalChunks: number) => void
): Promise<void> {
  const total = listings.length;
  const chunkCount = Math.ceil(total / CHUNK_SIZE);

  // 1. Write chunks
  for (let i = 0; i < chunkCount; i++) {
    const chunkItems = listings.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE).map((item) => ({
      ...item,
      source: 'admin',
    }));
    const chunkDoc = doc(db, 'admin_dataset', 'latest', 'chunks', `chunk_${i}`);
    try {
      await setDoc(chunkDoc, {
        chunkIndex: i,
        listings: chunkItems,
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `admin_dataset/latest/chunks/chunk_${i}`);
    }

    if (onProgress) {
      const percent = Math.round(((i + 1) / chunkCount) * 95);
      onProgress(percent, i + 1, chunkCount);
    }
  }

  // 2. Write metadata doc
  const metaDoc = doc(db, 'admin_dataset', 'latest');
  try {
    await setDoc(metaDoc, {
      id: 'latest',
      totalCount: total,
      chunkCount,
      publishedAt: new Date().toISOString(),
      publishedBy: 'مدیر سیستم',
      title: 'بانک اطلاعات روزانه خودروها',
    });
  } catch (err) {
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
    const metaSnap = await getDoc(metaDoc);
    if (!metaSnap.exists()) {
      return null;
    }

    const meta = metaSnap.data();
    const chunkCount = meta.chunkCount || 0;
    if (chunkCount === 0) return null;

    const allListings: CarListing[] = [];
    const chunksCol = collection(db, 'admin_dataset', 'latest', 'chunks');
    const chunksSnap = await getDocs(chunksCol);

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
    return null;
  }
}
