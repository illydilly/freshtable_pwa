import { useEffect, useMemo, useState } from 'react';
import { Bell, BellRing, RefreshCcw } from 'lucide-react';
import { api } from '../lib/api';
import { PageHeader } from '../components/PageHeader';

const defaultSettings = {
  expiringIngredientsEnabled: true,
  mealDiaryReminderEnabled: true,
  browserNotificationsEnabled: true,
  reminderHour: 20,
  checkIntervalMinutes: 30
};

function ToggleRow({ title, description, checked, onChange }) {
  return (
    <label className="flex items-start justify-between gap-4 rounded-[24px] border border-border bg-[#FCFCFC] px-5 py-4">
      <div>
        <div className="font-semibold text-slate-900">{title}</div>
        <div className="mt-1 text-sm leading-6 text-slate-500">{description}</div>
      </div>
      <input type="checkbox" className="mt-1 h-5 w-5 accent-[#7FB069]" checked={checked} onChange={(event) => onChange(event.target.checked)} />
    </label>
  );
}

export function NotificationSettingsPage() {
  const [settings, setSettings] = useState(defaultSettings);
  const [notifications, setNotifications] = useState([]);
  const [permission, setPermission] = useState(typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'unsupported');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [settingsRes, checkRes] = await Promise.all([
        api.get('/settings/notifications'),
        api.get('/notifications/check')
      ]);
      setSettings(settingsRes.data);
      setNotifications(checkRes.data.notifications || []);
      if (typeof window !== 'undefined' && 'Notification' in window) {
        setPermission(Notification.permission);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const saveSettings = async (nextSettings) => {
    setSaving(true);
    try {
      const { data } = await api.put('/settings/notifications', nextSettings);
      setSettings(data);
      window.dispatchEvent(new Event('notification-settings-changed'));
    } finally {
      setSaving(false);
    }
  };

  const permissionLabel = useMemo(() => {
    if (permission === 'unsupported') return '브라우저 미지원';
    if (permission === 'granted') return '허용됨';
    if (permission === 'denied') return '차단됨';
    return '아직 요청 전';
  }, [permission]);

  const requestPermission = async () => {
    if (!("Notification" in window)) return;
    const result = await Notification.requestPermission();
    setPermission(result);
    const nextSettings = { ...settings, browserNotificationsEnabled: result === 'granted' };
    setSettings(nextSettings);
    await saveSettings(nextSettings);
  };

  return (
    <div>
      <PageHeader
        title="알림 & 리마인더"
        subtitle="브라우저 Notification API를 사용해 임박 식재료와 식단 일기 미작성 상태를 알려드려요."
        action={
          <div className="flex items-center gap-3">
            <button onClick={load} className="rounded-2xl border border-border bg-white px-4 py-3 text-sm font-semibold text-slate-600">
              <RefreshCcw size={16} className="mr-2 inline" /> 지금 점검
            </button>
            <button onClick={requestPermission} className="rounded-2xl bg-sage px-4 py-3 text-sm font-semibold text-white">
              알림 권한 요청
            </button>
          </div>
        }
      />

      <div className="grid gap-5 xl:grid-cols-[1.05fr,0.95fr]">
        <section className="soft-card p-6">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#EDF7E7] text-sage">
              <BellRing size={20} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">알림 설정</h2>
              <p className="text-sm text-slate-500">체크 주기와 리마인더 종류를 직접 제어할 수 있어요.</p>
            </div>
          </div>

          <div className="space-y-4">
            <ToggleRow
              title="임박 식재료 알림"
              description="구매 후 14일 이상 지난 식재료가 있고 재고가 남아 있으면 알려드려요."
              checked={settings.expiringIngredientsEnabled}
              onChange={(checked) => setSettings((prev) => ({ ...prev, expiringIngredientsEnabled: checked }))}
            />
            <ToggleRow
              title="식단 일기 미작성 알림"
              description="오늘 식단 일기가 하나도 없을 때 리마인더를 보냅니다."
              checked={settings.mealDiaryReminderEnabled}
              onChange={(checked) => setSettings((prev) => ({ ...prev, mealDiaryReminderEnabled: checked }))}
            />
            <ToggleRow
              title="브라우저 푸시 사용"
              description="권한이 허용된 경우 백그라운드에서 브라우저 알림을 띄웁니다."
              checked={settings.browserNotificationsEnabled}
              onChange={(checked) => setSettings((prev) => ({ ...prev, browserNotificationsEnabled: checked }))}
            />
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <label className="rounded-[24px] bg-[#FCFCFC] p-4 text-sm text-slate-600">
              <div className="mb-2 font-semibold text-slate-900">리마인더 기준 시각</div>
              <input
                type="number"
                min="0"
                max="23"
                value={settings.reminderHour}
                onChange={(event) => setSettings((prev) => ({ ...prev, reminderHour: Number(event.target.value) }))}
                className="input-base"
              />
            </label>
            <label className="rounded-[24px] bg-[#FCFCFC] p-4 text-sm text-slate-600">
              <div className="mb-2 font-semibold text-slate-900">자동 점검 주기 (분)</div>
              <input
                type="number"
                min="5"
                max="180"
                step="5"
                value={settings.checkIntervalMinutes}
                onChange={(event) => setSettings((prev) => ({ ...prev, checkIntervalMinutes: Number(event.target.value) }))}
                className="input-base"
              />
            </label>
          </div>

          <div className="mt-5 flex items-center justify-between rounded-[24px] bg-[#F4F8F1] p-4 text-sm text-slate-600">
            <div>브라우저 권한 상태: <span className="font-semibold text-slate-900">{permissionLabel}</span></div>
            <button onClick={() => saveSettings(settings)} disabled={saving} className="rounded-2xl bg-sage px-4 py-3 font-semibold text-white disabled:opacity-60">
              {saving ? '저장 중...' : '설정 저장'}
            </button>
          </div>
        </section>

        <section className="soft-card p-6">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#FFF6F6] text-coral">
              <Bell size={20} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">현재 감지된 알림</h2>
              <p className="text-sm text-slate-500">API 점검 결과를 카드로 미리 볼 수 있어요.</p>
            </div>
          </div>

          {loading ? (
            <div className="rounded-[24px] bg-[#FCFCFC] p-5 text-sm text-slate-500">알림 상태를 불러오는 중이에요...</div>
          ) : notifications.length === 0 ? (
            <div className="rounded-[24px] bg-[#FCFCFC] p-5 text-sm text-slate-500">지금은 새 알림이 없어요. 아주 좋습니다!</div>
          ) : (
            <div className="space-y-4">
              {notifications.map((item) => {
                const styleMap = {
                  expired: { bg: 'bg-red-950 border-red-800', icon: 'bg-red-800 text-white', text: 'text-red-100', sub: 'text-red-300' },
                  danger: { bg: 'bg-red-50 border-red-300', icon: 'bg-red-500 text-white', text: 'text-red-900', sub: 'text-red-600' },
                  warning: { bg: 'bg-amber-50 border-amber-300', icon: 'bg-amber-400 text-amber-900', text: 'text-amber-900', sub: 'text-amber-700' },
                  expiring: { bg: 'bg-[#FFF0F0] border-border', icon: 'bg-[#FFF0F0] text-coral', text: 'text-slate-900', sub: 'text-slate-500' },
                  'meal-diary': { bg: 'bg-[#EDF7E7] border-border', icon: 'bg-[#EDF7E7] text-sage', text: 'text-slate-900', sub: 'text-slate-500' }
                };
                const s = styleMap[item.type] || styleMap['expiring'];
                return (
                  <div key={item.id} className={`rounded-[24px] border p-5 ${s.bg}`}>
                    <div className="flex items-start gap-3">
                      <div className={`mt-1 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl text-base ${s.icon}`}>
                        {item.type === 'expired' ? '🚨' : item.type === 'danger' ? '🔴' : item.type === 'warning' ? '⚠️' : item.type === 'meal-diary' ? '📔' : '🕐'}
                      </div>
                      <div>
                        <div className={`font-semibold ${s.text}`}>{item.title}</div>
                        <div className={`mt-1.5 text-sm leading-6 ${s.sub}`}>{item.message}</div>
                        {item.urgency === 'critical' && (
                          <div className="mt-2 inline-flex rounded-full bg-red-700 px-2.5 py-0.5 text-xs font-bold text-white">즉시 확인 필요</div>
                        )}
                        {item.urgency === 'high' && (
                          <div className="mt-2 inline-flex rounded-full bg-red-500 px-2.5 py-0.5 text-xs font-bold text-white">오늘 사용 요망</div>
                        )}
                        {item.urgency === 'medium' && (
                          <div className="mt-2 inline-flex rounded-full bg-amber-500 px-2.5 py-0.5 text-xs font-bold text-white">내일까지 사용</div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
