import React, { useState, useEffect } from 'react';
import { Wifi, WifiOff } from 'lucide-react';
import { getPendingCount, subscribePending } from '../../lib/pending';

export const SyncIndicator: React.FC = () => {
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    return typeof navigator !== 'undefined' ? navigator.onLine : true;
  });

  const [pending, setPending] = useState<number>(getPendingCount());
  useEffect(() => subscribePending(() => setPending(getPendingCount())), []);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <div
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border select-none transition-colors ${
        isOnline
          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
          : 'bg-amber-50 text-amber-700 border-amber-200'
      }`}
      title={isOnline ? 'النظام متصل بالإنترنت' : 'يعمل النظام أوفلاين في الذاكرة المحلية'}
    >
      <span
        className={`w-2 h-2 rounded-full ${
          isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
        }`}
      />
      {isOnline ? (
        <>
          <Wifi className="w-3.5 h-3.5" />
          <span>متصل{pending > 0 ? ` • ${pending} لم يُرفع` : ''}</span>
        </>
      ) : (
        <>
          <WifiOff className="w-3.5 h-3.5" />
          <span>بدون إنترنت{pending > 0 ? ` • ${pending} لم يُرفع` : ''}</span>
        </>
      )}
    </div>
  );
};
