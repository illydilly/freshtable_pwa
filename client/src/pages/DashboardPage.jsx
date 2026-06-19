import { useEffect, useState } from 'react';
import { AlertTriangle, Clock3, RefreshCcw, Star, LogOut } from 'lucide-react';
import { api } from '../lib/api';
import { PageHeader } from '../components/PageHeader';
import { StatCard } from '../components/StatCard';
import { LoadingCard } from '../components/LoadingCard';
import { InstallPromptButton } from '../components/InstallPromptButton';
import { formatCurrency } from '../lib/utils';

export function DashboardPage({ userName, onLogout }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);

  const loadDashboard = async () => {
    setLoading(true);
    try {
      const res = await api.get('/dashboard');
      setData(res.data);
      setLastUpdated(new Date());
    } catch (error) {
      console.error('dashboard load error', error);
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
    // #16: 30초마다 자동 새로고침
    const interval = setInterval(loadDashboard, 30000);
    return () => clearInterval(interval);
  }, []);

  const displayName = userName || '사용자';

  return (
    <div>
      <PageHeader
        title={`Hello, ${displayName}님`}
        subtitle="오늘의 구매와 식단 흐름을 한눈에 확인해보세요."
        action={
          <div className="flex flex-col items-end gap-3 md:flex-row md:items-center">
            <InstallPromptButton />
            
            {/* 안전하게 로그아웃 버튼 배치 */}
            <button
              onClick={loadDashboard}
              disabled={loading}
              className="flex items-center gap-1.5 rounded-full bg-[#F4F8F1] hover:bg-[#EDF7E7] px-4 py-2 text-sm font-bold text-sage transition-all shadow-sm disabled:opacity-50"
              title={lastUpdated ? `마지막 업데이트: ${lastUpdated.toLocaleTimeString('ko-KR')}` : '새로고침'}
            >
              <RefreshCcw size={14} className={loading ? 'animate-spin' : ''} />
              새로고침
            </button>
            <button
              onClick={onLogout}
              className="flex items-center gap-1.5 rounded-full bg-slate-100 hover:bg-slate-200 px-4 py-2 text-sm font-bold text-slate-600 hover:text-slate-900 transition-all shadow-sm"
            >
              <LogOut size={15} />
              로그아웃
            </button>
          </div>
        }
      />

      {loading ? (
        <div className="grid gap-4 xl:grid-cols-5 md:grid-cols-2">
          {Array.from({ length: 5 }).map((_, index) => (
            <LoadingCard key={index} />
          ))}
        </div>
      ) : !data ? (
        <div className="soft-card p-8 text-center text-slate-400">대시보드 데이터를 불러오지 못했습니다. 서버 상태를 확인해 주세요.</div>
      ) : (
        <>
          <div className="grid gap-4 xl:grid-cols-5 md:grid-cols-2">
            <StatCard title="보유 중인 식재료" value={`${data.ingredients_count || 0}종`} description="유통기한 관리가 필요해요" />
            <StatCard title="등록된 총 레시피" value={`${data.recipes_count || 0}개`} description="다양한 메뉴 조리 가능" />
            <StatCard title="오늘 먹은 칼로리" value={`${data.today_calories || 0} kcal`} description="목표 칼로리 준수 확인" />
            <StatCard title="구매 예정 품목" value={`${data.shopping_list_count || 0}개`} description="장보기 리스트 체크" />
            <StatCard title="소비 지출 금액" value={formatCurrency(data.monthly_total || 0)} description="이번 달 누적 지출" />
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-3">
            <div className="soft-card p-6 lg:col-span-2">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#FFF0F0] text-coral">
                  <AlertTriangle size={20} />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-900">유통기한 임박 식재료</h2>
                  <p className="text-sm text-slate-500 font-medium">빨리 섭취해야 하는 재고 리스트입니다.</p>
                </div>
              </div>
              <div className="divide-y divide-border">
                {!data.expiring_ingredients || data.expiring_ingredients.length === 0 ? (
                  <div className="py-6 text-center text-sm text-slate-400">유통기한이 임박한 식재료가 없습니다. 안심하세요!</div>
                ) : data.expiring_ingredients.map((item) => (
                  <div key={item.id} className="flex items-center justify-between py-4">
                    <div>
                      <span className="font-bold text-slate-900">{item.itemName}</span>
                      <span className="ml-2 text-xs text-slate-400">{item.grams}g 남음</span>
                    </div>
                    <span className="rounded-xl bg-[#FFF0F0] px-3 py-1 text-xs font-bold text-coral">
                      D-{item.daysLeft}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="soft-card p-6">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#EDF7E7] text-sage">
                  <Clock3 size={20} />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-900">최근 등록된 메뉴</h2>
                  <p className="text-sm text-slate-500 font-medium">가장 최근 조리했거나 저장한 레시피입니다.</p>
                </div>
              </div>

              <div className="space-y-4">
                {!data.recent_recipes || data.recent_recipes.length === 0 ? (
                  <div className="rounded-[24px] bg-[#FCFCFC] px-5 py-4 text-sm text-slate-500">최근 등록된 메뉴가 없어요.</div>
                ) : data.recent_recipes.map((recipe) => (
                  <div key={recipe.id} className="overflow-hidden rounded-[24px] border border-border bg-[#FCFCFC]">
                    {/* 실제 썸네일이 있을 때만 img 렌더링, 없으면 이모지 폴백 */}
                    {recipe.thumbnailUrl ? (
                      <img
                        src={recipe.thumbnailUrl}
                        alt=""
                        className="h-36 w-full object-cover"
                        onError={e => { e.currentTarget.style.display = 'none'; e.currentTarget.nextElementSibling.style.display = 'flex'; }}
                      />
                    ) : null}
                    <div
                      className="h-36 w-full items-center justify-center bg-gradient-to-br from-[#EDF7E7] to-[#C8E4B8]"
                      style={{ display: recipe.thumbnailUrl ? 'none' : 'flex' }}
                    >
                      <span className="text-4xl">🍽️</span>
                    </div>
                    <div className="p-4">
                      {/* 이름은 카드 하단 텍스트 영역에만 표시 — 썸네일 안에 절대 넣지 않음 */}
                      <div className="text-sm font-bold text-slate-900 leading-snug" style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}>{recipe.name}</div>
                      <div className="mt-2 flex items-center justify-between text-sm text-slate-500">
                        <span>{recipe.calories} kcal</span>
                        <span className="flex items-center gap-1 text-[#F59E0B]">
                          {Array.from({ length: recipe.satisfaction || 0 }).map((_, index) => (
                            <Star key={index} size={14} fill="currentColor" />
                          ))}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-5 rounded-[24px] bg-[#F4F8F1] p-4 text-sm leading-6 text-slate-600">
                이번 달 누적 구매 비용은 <span className="font-bold text-slate-900">{formatCurrency(data.monthly_total || 0)}</span>, 이번 주는 <span className="font-bold text-slate-900">{formatCurrency(data.weekly_total || 0)}</span> 사용 중이에요.
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}