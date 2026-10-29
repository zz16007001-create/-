/**
 * Firebase Client Setup with Offline Persistence for «محلي»
 */

import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyCP_-D93vlgEwGAhd4Qjug5jpvhGozTUs8",
  authDomain: "mahally-clude-tasheh.firebaseapp.com",
  projectId: "mahally-clude-tasheh",
  storageBucket: "mahally-clude-tasheh.firebasestorage.app",
  messagingSenderId: "848025031186",
  appId: "1:848025031186:web:a2e31b65ad88edfa1ffecb"
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// تفعيل العمل بدون اتصال (Offline Persistence) مع إدارة التبويبات المتعددة
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager(),
  }),
});

export const auth = getAuth(app);
export { app };
