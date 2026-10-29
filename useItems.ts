import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Item } from '../domain/types';

export interface ExtendedItem extends Item {
  code?: string;
  color?: string;
  size?: number | string;
  modelNo?: number;
  search?: string;
}

export function useItems() {
  const [items, setItems] = useState<ExtendedItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    const itemsRef = collection(db, 'items');
    // جلب الأصناف وترتيبها تنازلياً حسب تاريخ الإنشاء
    const q = query(itemsRef, orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const docs: ExtendedItem[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          docs.push({
            id: docSnap.id,
            barcode: data.barcode || data.code || '',
            code: data.code || data.barcode || '',
            sku: data.sku || '',
            name: data.name || '',
            categoryId: data.categoryId || data.category || '',
            categoryName: data.categoryName || data.category || '',
            costPrice: data.costPrice || 0,
            sellPrice: data.sellPrice || 0,
            wholesalePrice: data.wholesalePrice,
            currentStock: data.currentStock ?? 0,
            minStockAlert: data.minStockAlert ?? 5,
            unit: data.unit || 'قطعة',
            color: data.color || '',
            size: data.size || '',
            modelNo: data.modelNo,
            search: data.search || '',
            isActive: data.isActive !== false,
            createdAt: data.createdAt || 0,
            updatedAt: data.updatedAt || 0,
          });
        });

        // في حال لم يكن الفرز مدعوماً من الفايرستور أوفلاين، نقوم بالفرز محلياً
        docs.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

        setItems(docs);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.warn('Items listener error:', err);
        // محاولة جلب بديلة بدون فرز في حال عدم وجود index
        const fallbackSub = onSnapshot(
          itemsRef,
          (snap) => {
            const docs: ExtendedItem[] = [];
            snap.forEach((docSnap) => {
              const data = docSnap.data();
              docs.push({
                id: docSnap.id,
                barcode: data.barcode || data.code || '',
                code: data.code || data.barcode || '',
                sku: data.sku || '',
                name: data.name || '',
                categoryId: data.categoryId || data.category || '',
                categoryName: data.categoryName || data.category || '',
                costPrice: data.costPrice || 0,
                sellPrice: data.sellPrice || 0,
                wholesalePrice: data.wholesalePrice,
                currentStock: data.currentStock ?? 0,
                minStockAlert: data.minStockAlert ?? 5,
                unit: data.unit || 'قطعة',
                color: data.color || '',
                size: data.size || '',
                modelNo: data.modelNo,
                search: data.search || '',
                isActive: data.isActive !== false,
                createdAt: data.createdAt || 0,
                updatedAt: data.updatedAt || 0,
              });
            });
            docs.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
            setItems(docs);
            setLoading(false);
          },
          (fallbackErr) => {
            setError(fallbackErr.message);
            setLoading(false);
          }
        );
        return () => fallbackSub();
      }
    );

    return () => unsubscribe();
  }, []);

  return { items, loading, error };
}
