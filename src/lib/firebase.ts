import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = initializeFirestore(
  app,
  {
    experimentalAutoDetectLongPolling: true,
  },
  firebaseConfig.firestoreDatabaseId
);
export const auth = getAuth(app);

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Test cloud connection explicitly with timeout
export async function checkCloudConnection(timeoutMs = 8000): Promise<{ ok: boolean; message: string }> {
  try {
    const timeoutPromise = new Promise<{ ok: boolean; message: string }>((_, reject) =>
      setTimeout(() => reject(new Error('مهلت زمانی اتصال پایان یافت (احتمال اختلال اینترنت یا فیلترینگ)')), timeoutMs)
    );

    const checkPromise = (async () => {
      await getDocFromServer(doc(db, 'test', 'connection'));
      return { ok: true, message: 'اتصال به سرور ابری فایربیس برقرار است.' };
    })();

    return await Promise.race([checkPromise, timeoutPromise]);
  } catch (error: any) {
    const rawMsg = error?.message || String(error);
    if (rawMsg.includes('offline') || rawMsg.includes('مهلت زمانی') || rawMsg.includes('unavailable')) {
      return {
        ok: false,
        message: 'عدم دسترسی به سرور فایربیس (سرورهای گوگل). لطفاً اتصال اینترنت یا فعال بودن فیلترشکن را بررسی کنید.',
      };
    }
    return { ok: false, message: `خطا در ارتباط: ${rawMsg}` };
  }
}

// Connection test at boot
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firebase connection: client appears offline.');
    }
  }
}

testConnection();
