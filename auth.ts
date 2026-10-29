/**
 * Firebase Authentication service with localized Arabic error messages
 */

import {
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  User,
  onAuthStateChanged,
} from 'firebase/auth';
import { auth } from './firebase';

/**
 * تحويل أكواد أخطاء Firebase إلى رسائل عربية واضحة ومبسطة
 */
export function getArabicAuthError(errorCode: string): string {
  switch (errorCode) {
    case 'auth/invalid-email':
      return 'صيغة البريد الإلكتروني غير صحيحة';
    case 'auth/user-disabled':
      return 'تم تعطيل هذا الحساب. يرجى التواصل مع الإدارة';
    case 'auth/user-not-found':
      return 'لا يوجد حساب مسجل بهذا البريد الإلكتروني';
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'بيانات الدخول غير صحيحة (تحقق من البريد أو كلمة المرور)';
    case 'auth/too-many-requests':
      return 'تم حظر الدخول مؤقتاً لكثرة المحاولات الخاطئة. انتظر قليلاً';
    case 'auth/network-request-failed':
      return 'تعذر الاتصال بالشبكة. تأكد من اتصال الإنترنت';
    case 'auth/weak-password':
      return 'كلمة المرور ضعيفة، يجب أن تكون 6 أحرف على الأقل';
    default:
      return 'حدث خطأ أثناء تسجيل الدخول. حاول مجدداً';
  }
}

/**
 * تسجيل الدخول بالبريد وكلمة المرور
 */
export async function signIn(email: string, pass: string): Promise<User> {
  try {
    const cred = await signInWithEmailAndPassword(auth, email.trim(), pass);
    return cred.user;
  } catch (err: any) {
    const message = getArabicAuthError(err?.code || '');
    throw new Error(message);
  }
}

/**
 * تسجيل الخروج
 */
export async function signOut(): Promise<void> {
  await firebaseSignOut(auth);
}

/**
 * مراقبة حالة المصادقة
 */
export function subscribeToAuth(callback: (user: User | null) => void) {
  return onAuthStateChanged(auth, callback);
}
