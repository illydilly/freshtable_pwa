import LoginPage from './pages/LoginPage';

import { useState, useEffect } from 'react';
import PurchasePage from './pages/PurchasePage'; // 구매 페이지 컴포넌트 임포트 경로 확인 필요

function App() {
  const [user, setUser] = useState(null);

  // 이미 로그인한 이력이 로컬스토리지에 있는지 확인
  useEffect(() => {
    const savedUser = localStorage.getItem('userName');
    if (savedUser) {
      setUser(savedUser);
    }
  }, []);

  const handleLoginSuccess = (userName) => {
    setUser(userName);
  };

  return (
    <div className="App">
      {user ? (
        <div>
          <header style={{ padding: '10px 20px', background: '#eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span><strong>{user}</strong>님 로그인 중</span>
            <button onClick={() => {
              localStorage.removeItem('userName');
              setUser(null);
            }}>로그아웃</button>
          </header>
          <PurchasePage />
        </div>
      ) : (
        <LoginPage onLoginSuccess={handleLoginSuccess} />
      )}
    </div>
  );
}

export default App;