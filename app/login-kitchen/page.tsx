'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function KitchenLogin() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = () => {
    console.log('=== LOGIN CHECK ===');
    console.log('username:', JSON.stringify(username), 'length:', username.length);
    console.log('password:', JSON.stringify(password), 'length:', password.length);
    console.log('trimmed username:', JSON.stringify(username.trim()));
    console.log('conditions:', {
      'username.trim() === "bep"': username.trim() === 'bep',
      'password === "1324"': password === '1324',
      'both true': username.trim() === 'bep' && password === '1324'
    });
    
    if (username.trim() === 'bep' && password === '1324') {
      localStorage.setItem('auth', JSON.stringify({ role: 'kitchen', username: 'bep' }));
      console.log('SUCCESS! Redirecting to /kitchen/orders');
      router.push('/kitchen/orders');
    } else {
      console.log('FAIL! Error conditions triggered');
      setError('로그인 실패: 아이디 또는 비밀번호가 틀립니다.\n(확인: username="' + username.trim() + '", password="' + password + '")');
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="text-6xl mb-4">🍳</div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">주방 디스플레이</h1>
          <p className="text-gray-600">주문 관리 시스템</p>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">아이디</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-lg"
              placeholder="아이디"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">비밀번호</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-lg"
              placeholder="비밀번호"
            />
          </div>
          {error && (
            <div className="bg-red-100 border-2 border-red-400 text-red-700 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}
          <button
            onClick={handleLogin}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-lg text-lg"
          >
            로그인
          </button>
          <div className="text-center text-sm text-gray-500 mt-4">
            계정: bep / 1324
          </div>
        </div>
      </div>
    </div>
  );
}
