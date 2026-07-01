// client/src/components/IngredientAutocomplete.jsx
import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';

/**
 * 식재료명 자동완성 콤보박스
 * 글자를 입력하면 기존에 등록한 적 있는 식재료명을 드롭다운으로 추천하고,
 * 선택 시 단위(g/ml/kg/개수)와 영양정보(칼로리/탄단지)를 함께 콜백으로 전달한다.
 *
 * Props:
 *   value     : 현재 입력된 재료명 (string)
 *   onChange  : (name:string) => void  — 타이핑할 때마다 호출
 *   onSelect  : (item) => void         — 드롭다운에서 기존 항목 선택 시 호출
 *               item = { name, unitType, unitAmount, calories, carbs, protein, fat, sodium, sugar }
 *   placeholder, className : input 스타일 커스터마이즈
 */
export function IngredientAutocomplete({
  value,
  onChange,
  onSelect,
  placeholder = '재료명',
  className = 'input-base flex-1 text-sm',
}) {
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef(null);
  const wrapperRef = useRef(null);

  // 바깥 영역 클릭 시 드롭다운 닫기
  useEffect(() => {
    const handler = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const runSearch = (keyword) => {
    if (!keyword.trim()) { setResults([]); return; }
    setLoading(true);
    api.get('/ingredients/search', { params: { q: keyword.trim() } })
      .then((res) => setResults(res.data || []))
      .catch(() => setResults([]))
      .finally(() => setLoading(false));
  };

  const handleChange = (e) => {
    const v = e.target.value;
    onChange(v);
    setOpen(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => runSearch(v), 300); // 디바운스
  };

  const handleSelect = (item) => {
    onChange(item.name);
    setOpen(false);
    setResults([]);
    if (onSelect) onSelect(item);
  };

  return (
    <div ref={wrapperRef} className="relative min-w-0 flex-1">
      <input
        className={className}
        placeholder={placeholder}
        value={value}
        autoComplete="off"
        onChange={handleChange}
        onFocus={() => { if (value?.trim()) { setOpen(true); runSearch(value); } }}
      />
      {open && (loading || results.length > 0) && (
        <div className="absolute z-30 mt-1 max-h-48 w-full overflow-y-auto rounded-xl border border-border bg-white shadow-lg">
          {loading && <div className="px-3 py-2 text-xs text-slate-400">검색 중...</div>}
          {!loading && results.map((item) => (
            <button
              key={item.name}
              type="button"
              onClick={() => handleSelect(item)}
              className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-[#F4F8F1] transition-colors"
            >
              <span className="font-medium text-slate-800 truncate">{item.name}</span>
              <span className="ml-2 shrink-0 text-xs text-slate-400">
                {item.calories != null && `${item.calories}kcal`}
                {item.unitType && item.unitType !== 'g' && (
                  <span className="ml-1 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">
                    {item.unitType}
                  </span>
                )}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
