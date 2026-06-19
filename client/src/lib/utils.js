import clsx from 'clsx';
import { format } from 'date-fns/format';
import { ko } from 'date-fns/locale/ko';

export function cn(...inputs) {
  return clsx(inputs);
}

export function formatCurrency(value) {
  return new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW', maximumFractionDigits: 0 }).format(value || 0);
}

export function formatDate(value, pattern = 'yyyy.MM.dd') {
  if (!value) return '-';
  return format(new Date(value), pattern, { locale: ko });
}

export function getStatusTone(status) {
  if (status === '신선') return 'bg-[#EDF7E7] text-[#4F8C3B]';
  if (status === '빨리 먹기') return 'bg-[#FFF5E8] text-[#E09032]';
  return 'bg-[#FFF0F0] text-coral';
}

export function getMealSlotTone(mealType) {
  return {
    아침: 'bg-[#FFF8EC] text-[#D48C2F]',
    점심: 'bg-[#EDF7E7] text-[#4F8C3B]',
    저녁: 'bg-[#F6F1FF] text-[#7C63C8]',
    간식: 'bg-[#FFF0F0] text-coral'
  }[mealType] || 'bg-slate-100 text-slate-600';
}
