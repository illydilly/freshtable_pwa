import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Download, Share2, Smartphone } from 'lucide-react';

function isStandaloneMode() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

function isIosSafari() {
  if (typeof window === 'undefined') return false;
  const ua = window.navigator.userAgent;
  const iOS = /iPad|iPhone|iPod/.test(ua);
  const webkit = /WebKit/.test(ua);
  const otherBrowser = /CriOS|FxiOS|OPiOS|EdgiOS/.test(ua);
  return iOS && webkit && !otherBrowser;
}

export function InstallPromptButton() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [installed, setInstalled] = useState(isStandaloneMode());
  const [showIosHint, setShowIosHint] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (event) => {
      event.preventDefault();
      setDeferredPrompt(event);
    };

    const handleInstalled = () => {
      setInstalled(true);
      setDeferredPrompt(null);
      setShowIosHint(false);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, []);

  const buttonLabel = useMemo(() => {
    if (installed) return '설치 완료';
    if (deferredPrompt) return '앱 설치하기';
    if (isIosSafari() && !installed) return '홈 화면에 추가';
    return '설치 준비 중';
  }, [deferredPrompt, installed]);

  const handleInstall = async () => {
    if (installed) return;

    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setInstalled(true);
      }
      setDeferredPrompt(null);
      return;
    }

    if (isIosSafari()) {
      setShowIosHint((prev) => !prev);
    }
  };

  if (installed) {
    return (
      <div className="inline-flex items-center gap-2 rounded-full border border-[#CFE5C5] bg-[#EDF7E7] px-4 py-2 text-sm font-semibold text-[#335F27]">
        <CheckCircle2 size={16} />
        앱 설치 완료
      </div>
    );
  }

  if (!deferredPrompt && !isIosSafari()) {
    return null;
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        type="button"
        onClick={handleInstall}
        className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-sage px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-95 focus:outline-none focus:ring-4 focus:ring-[#7FB069]/25"
      >
        {deferredPrompt ? <Download size={16} /> : <Smartphone size={16} />}
        {buttonLabel}
      </button>

      {showIosHint && (
        <div className="max-w-[280px] rounded-[24px] border border-border bg-white px-4 py-3 text-left text-xs leading-5 text-slate-600 shadow-card">
          <div className="mb-1 font-semibold text-slate-900">iPhone 설치 안내</div>
          Safari 하단의{' '}
          <span className="inline-flex items-center gap-1 font-semibold text-slate-900">
            <Share2 size={12} />
            공유
          </span>{' '}
          버튼을 누른 뒤 <span className="font-semibold text-slate-900">홈 화면에 추가</span>를 선택하세요.
        </div>
      )}
    </div>
  );
}
