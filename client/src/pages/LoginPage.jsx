import { useState } from 'react';
import { LogIn, Mail, Phone, User, UserPlus } from 'lucide-react';
import { api } from '../lib/api';

export default function LoginPage({ onLoginSuccess }) {
  const [mode, setMode] = useState('login');
  const [name, setName] = useState('');
  const [phoneLast, setPhoneLast] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const isSignup = mode === 'signup';

  const switchMode = (nextMode) => {
    setMode(nextMode);
    setError('');
    setMessage('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');

    const trimmedName = name.trim();
    const trimmedPhoneLast = phoneLast.trim();
    const trimmedEmail = email.trim();

    if (!trimmedName || !trimmedPhoneLast) {
      setError('이름과 전화번호 뒷자리를 모두 입력해 주세요.');
      return;
    }

    if (isSignup && !trimmedEmail) {
      setError('회원가입을 위해 이메일을 입력해 주세요.');
      return;
    }

    try {
      setLoading(true);
      const response = await api.post(isSignup ? '/register' : '/login', {
        name: trimmedName,
        phoneLast: trimmedPhoneLast,
        email: trimmedEmail
      });

      const loggedInName = response.data?.name;

      if (!loggedInName) {
        setError('사용자 정보를 불러오지 못했습니다. 다시 시도해 주세요.');
        return;
      }

      localStorage.setItem('userName', loggedInName);
      onLoginSuccess(loggedInName);
    } catch (err) {
      console.error('Login error:', err);
      setError(err.response?.data?.message || `${isSignup ? '회원가입' : '로그인'}에 실패했습니다. 입력 정보를 확인해 주세요.`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F8FAF7] px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-7 rounded-[32px] border border-slate-100 bg-white p-8 shadow-sm">
        <div className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#EDF7E7] text-[#6B8E63]">
            {isSignup ? <UserPlus size={28} /> : <LogIn size={28} />}
          </div>
          <h2 className="mt-6 text-3xl font-extrabold tracking-tight text-slate-900">
            FreshTable 시작하기
          </h2>
          <p className="mt-2 text-sm font-medium text-slate-500">
            {isSignup ? '새 계정을 만든 뒤 바로 시작할 수 있어요.' : '등록된 이름과 전화번호 뒷자리로 로그인해 주세요.'}
          </p>
        </div>

        <div className="grid grid-cols-2 rounded-2xl bg-[#F4F8F1] p-1">
          <button
            type="button"
            onClick={() => switchMode('login')}
            className={`rounded-xl px-4 py-2.5 text-sm font-bold transition-all ${!isSignup ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
          >
            로그인
          </button>
          <button
            type="button"
            onClick={() => switchMode('signup')}
            className={`rounded-xl px-4 py-2.5 text-sm font-bold transition-all ${isSignup ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
          >
            회원가입
          </button>
        </div>

        {message && (
          <div className="rounded-xl bg-[#EDF7E7] p-3 text-center text-sm font-semibold text-sage">
            {message}
          </div>
        )}

        {error && (
          <div className="rounded-xl bg-[#FFF0F0] p-3 text-center text-sm font-semibold text-coral">
            {error}
          </div>
        )}

        <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-700">
                이름
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400">
                  <User size={18} />
                </div>
                <input
                  type="text"
                  required
                  disabled={loading}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="block w-full rounded-2xl border border-slate-200 bg-[#FCFCFC] py-3 pl-11 pr-3 text-slate-900 transition-all focus:border-[#6B8E63] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#6B8E63] disabled:opacity-60 sm:text-sm"
                  placeholder="이름을 입력하세요"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-700">
                전화번호 뒷자리
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400">
                  <Phone size={18} />
                </div>
                <input
                  type="text"
                  inputMode="numeric"
                  required
                  disabled={loading}
                  value={phoneLast}
                  onChange={(e) => setPhoneLast(e.target.value)}
                  className="block w-full rounded-2xl border border-slate-200 bg-[#FCFCFC] py-3 pl-11 pr-3 text-slate-900 transition-all focus:border-[#6B8E63] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#6B8E63] disabled:opacity-60 sm:text-sm"
                  placeholder="예: 1234"
                />
              </div>
            </div>

            {isSignup && (
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-700">
                  이메일
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400">
                    <Mail size={18} />
                  </div>
                  <input
                    type="email"
                    required
                    disabled={loading}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="block w-full rounded-2xl border border-slate-200 bg-[#FCFCFC] py-3 pl-11 pr-3 text-slate-900 transition-all focus:border-[#6B8E63] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#6B8E63] disabled:opacity-60 sm:text-sm"
                    placeholder="you@example.com"
                  />
                </div>
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="flex w-full justify-center rounded-2xl bg-[#6B8E63] px-4 py-3.5 text-sm font-bold text-white shadow-sm transition-all hover:bg-[#587551] focus:outline-none focus:ring-2 focus:ring-[#6B8E63] disabled:bg-slate-400"
          >
            {loading ? (isSignup ? '가입 중...' : '로그인 중...') : (isSignup ? '회원가입' : '로그인')}
          </button>
        </form>
      </div>
    </div>
  );
}
