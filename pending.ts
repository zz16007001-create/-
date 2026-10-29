/**
 * عدّاد العمليات التي لم يؤكدها السيرفر بعد (تُحفظ محلياً وتُرفع عند عودة الإنترنت).
 */
let count = 0;
const subs = new Set<() => void>();

const emit = () => subs.forEach((f) => f());

export const getPendingCount = () => count;

export function subscribePending(fn: () => void): () => void {
  subs.add(fn);
  return () => {
    subs.delete(fn);
  };
}

export function trackPending(p: Promise<unknown>): void {
  count++;
  emit();
  p.then(
    () => {
      count--;
      emit();
    },
    () => {
      count--;
      emit();
    }
  );
}
