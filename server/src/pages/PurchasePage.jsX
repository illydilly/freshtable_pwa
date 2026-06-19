import { useState } from 'react';
import axios from 'axios';

const API_URL = 'https://freshtable-production-4cb3.up.railway.app';

export default function PurchasePage() {
  const [purchaseData, setPurchaseData] = useState({ itemName: '', price: 0, grams: 0, date: '', source: '직접입력' });
  const [keyword, setKeyword] = useState('');
  const [results, setResults] = useState([]);

  // 1. API 검색 기능 (돋보기)
  const handleSearch = async () => {
    if (!keyword) return alert('검색어를 입력해 주세요!');
    try {
      const res = await axios.get(`${API_URL}/api/search-food?keyword=${encodeURIComponent(keyword)}`);
      setResults(res.data);
    } catch (err) {
      alert('검색 실패! 서버 연결을 확인하세요.');
    }
  };

  // 2. 검색 결과 클릭 시 폼에 채우기
  const selectItem = (item) => {
    setPurchaseData({ ...purchaseData, itemName: item.name });
    setResults([]); // 리스트 닫기
  };

  return (
    <div style={{ padding: '20px' }}>
      <h2>구매내역 추가</h2>
      
      {/* 검색창 */}
      <div style={{ marginBottom: '15px' }}>
        <input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="식품명 검색 (예: 바나나)" />
        <button onClick={handleSearch}>🔍 돋보기</button>
      </div>

      {/* 검색 결과 리스트 */}
      {results.length > 0 && (
        <ul style={{ border: '1px solid #ccc', padding: '10px', listStyle: 'none', maxHeight: '15px', overflowY: 'auto' }}>
          {results.map((item, idx) => (
            <li key={idx} onClick={() => selectItem(item)} style={{ cursor: 'pointer', padding: '5px 0', borderBottom: '1px solid #eee' }}>
              {item.name} (칼로리: {item.calories}kcal)
            </li>
          ))}
        </ul>
      )}

      {/* 입력 폼 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxWidth: '300px', marginTop: '20px' }}>
        <label>품목명:</label>
        <input value={purchaseData.itemName} onChange={(e) => setPurchaseData({...purchaseData, itemName: e.target.value})} placeholder="품목명" />
        
        <label>중량(g):</label>
        <input type="number" value={purchaseData.grams} onChange={(e) => setPurchaseData({...purchaseData, grams: Number(e.target.value)})} placeholder="그램" />
        
        {/* 필요한 다른 입력 필드들 추가 가능 */}
      </div>
    </div>
  );
}