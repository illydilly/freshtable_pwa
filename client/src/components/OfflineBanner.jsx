import { useEffect, useState } from 'react';
import { Wifi, WifiOff } from 'lucide-react';

export function OfflineBanner() {
  const [isOnline, setIsOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);
  const [showOnlineToast, setShowOnlineToast] = useState(false);

  useEffect(() => {
    let timeoutId;

    const handleOnline = () => {
      setIsOnline(true);
      setShowOnlineToast(true);
      window.clearTimeout(timeoutId);
      timeoutId = window.setTimeout(() => setShowOnlineToast(false), 2600);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowOnlineToast(false);
      window.clearTimeout(timeoutId);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.clearTimeout(timeoutId);
    };
  }, []);

  if (!isOnline) {
    return (
      <div className="mb-4 flex items-center gap-3 rounded-[24px] border border-[#E9D38B] bg-[#FFF8DB] px-4 py-3 text-sm font-medium text-[#7C5A07] shadow-sm">
        <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/80 text-[#B88408]">
          <WifiOff size={18} />
        </span>
        <div>
          <div className="font-semibold">오프라인 모드입니다</div>
          <div className="text-xs text-[#8B6A10]">캐시된 화면은 계속 사용할 수 있고, 연결되면 최신 데이터가 다시 동기화됩니다.</div>
        </div>
      </div>
    );
  }

  if (showOnlineToast) {
    return (
      <div className="mb-4 flex items-center gap-3 rounded-[24px] border border-[#CFE5C5] bg-[#EDF7E7] px-4 py-3 text-sm font-medium text-[#335F27] shadow-sm">
        <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/80 text-sage">
          <Wifi size={18} />
        </span>
        <div>
          <div className="font-semibold">다시 온라인 상태예요</div>
          <div className="text-xs text-[#4F8C3B]">새로운 데이터와 변경 사항을 동기화하고 있습니다.</div>
        </div>
      </div>
    );
  }

  return null;
}
