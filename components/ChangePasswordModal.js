'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function ChangePasswordModal({ user, onClose, onPasswordUpdated }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChangePassword = async (e) => {
    e.preventDefault();

    if (!currentPassword || !newPassword || !confirmPassword) {
      return alert(' 모든 비밀번호 입력란을 채워주세요.');
    }

    if (newPassword !== confirmPassword) {
      return alert('새 비밀번호와 비밀번호 확인이 일치하지 않습니다.');
    }

    if (newPassword.length < 4) {
      return alert('새 비밀번호는 최소 4자리 이상이어야 합니다.');
    }

    setLoading(true);

    try {
      // 1. 현재 비밀번호 검증
      const { data: dbUser, error: checkError } = await supabase
        .from('users')
        .select('password')
        .eq('id', user.id)
        .single();

      if (checkError || !dbUser) throw new Error('사용자 정보를 찾을 수 없습니다.');

      if (dbUser.password !== currentPassword) {
        setLoading(false);
        return alert('현재 비밀번호가 일치하지 않습니다.');
      }

      // 2. 새 비밀번호로 업데이트
      const { error: updateError } = await supabase
        .from('users')
        .update({ password: newPassword })
        .eq('id', user.id);

      if (updateError) throw updateError;

      // 3. localStorage 정보 갱신
      const updatedUser = { ...user, password: newPassword };
      localStorage.setItem('user', JSON.stringify(updatedUser));

      alert('비밀번호가 성공적으로 변경되었습니다!');
      if (onPasswordUpdated) onPasswordUpdated(updatedUser);
      onClose();
    } catch (err) {
      alert(`비밀번호 변경 실패: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-3xl p-6 w-full max-w-md space-y-5 shadow-2xl animate-in fade-in zoom-in-95 my-8">
        <div className="flex justify-between items-center border-b border-slate-100 pb-3">
          <h3 className="text-base font-extrabold text-slate-800 flex items-center gap-2">
            <span>🔒</span> 비밀번호 변경
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 font-bold text-xs">✕</button>
        </div>

        <form onSubmit={handleChangePassword} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">현재 비밀번호</label>
            <input
              type="password"
              placeholder="현재 비밀번호 (예: 1234)"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full p-3 bg-slate-50 border border-slate-200/80 rounded-2xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-indigo-500 transition"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">새 비밀번호</label>
            <input
              type="password"
              placeholder="바꿀 새 비밀번호 입력"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full p-3 bg-slate-50 border border-slate-200/80 rounded-2xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-indigo-500 transition"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">새 비밀번호 확인</label>
            <input
              type="password"
              placeholder="새 비밀번호 다시 입력"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full p-3 bg-slate-50 border border-slate-200/80 rounded-2xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-indigo-500 transition"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="w-1/2 bg-slate-100 text-slate-600 py-3 rounded-2xl text-xs font-bold"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={loading}
              className="w-1/2 bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-2xl text-xs font-bold shadow-md transition disabled:bg-slate-300"
            >
              {loading ? '변경 중...' : '비밀번호 변경'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}