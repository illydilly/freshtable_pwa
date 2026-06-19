import { useState } from 'react';
import axios from 'axios';

const API_URL = 'https://freshtable-production-4cb3.up.railway.app'; // 첫 번째 사진의 Railway 도메인 URL

export default function LoginPage({ onLoginSuccess }) {
  const [formData, setFormData] = useState({ name: '', phoneLast: '' });

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      // 내 컴퓨터 주소가 아닌 Railway 서버 주소로 요청을 보냅니다!
      const res = await axios.post(`${API_URL}/api/login`, formData);
      localStorage.setItem('userName', res.data.name); 
      alert(`${res.data.name}님 환영합니다!`);
      if (onLoginSuccess) onLoginSuccess(res.data.name); 
    } catch (err) {
      alert('사용자를 찾을 수 없어요. 다시 확인해 주세요!');
    }
  };

  return (
    <form onSubmit={handleLogin} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '10px', maxWidth: '300px' }}>
      <h2>FreshTable 로그인</h2>
      <input placeholder="이름" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} />
      <input placeholder="전화번호 뒷자리" value={formData.phoneLast} onChange={(e) => setFormData({...formData, phoneLast: e.target.value})} />
      <button type="submit">로그인</button>
    </form>
  );
}