'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function StudentManagementSection({ teacherId, onRefresh }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('1234'); // 기본 비밀번호
  const [parentPhone, setParentPhone] = useState(''); // 🎯 학부모 연락처 상태 추가

  const [students, setStudents] = useState([]);
  const [editingStudent, setEditingStudent] = useState(null);

  // 개별 학생 신규 등록
  const handleCreateStudent = async (e) => {
    e.preventDefault();
    if (!name || !email) return alert('학생 이름과 이메일/아이디를 입력해주세요.');

    try {
      const payload = {
        name,
        email,
        password,
        role: 'STUDENT',
        teacher_id: teacherId,
        parent_phone: parentPhone.replace(/[^0-9]/g, ''), // 🎯 숫만 추출 저장 (예: 01012345678)
      };

      const { error } = await supabase.from('users').insert([payload]);
      if (error) throw error;

      alert(`[${name}] 학생이 등록되었습니다.`);
      setName('');
      setEmail('');
      setParentPhone('');
      if (onRefresh) onRefresh();
    } catch (err) {
      alert(`등록 실패: ${err.message}`);
    }
  };

  // 학생 정보 수정 (학부모 연락처 수정 포함)
  const handleUpdateStudent = async (e) => {
    e.preventDefault();
    if (!editingStudent) return;

    try {
      const { error } = await supabase
        .from('users')
        .update({
          name: editingStudent.name,
          email: editingStudent.email,
          parent_phone: editingStudent.parent_phone ? editingStudent.parent_phone.replace(/[^0-9]/g, '') : '',
        })
        .eq('id', editingStudent.id);

      if (error) throw error;

      alert('학생 정보 및 학부모 연락처가 수정되었습니다.');
      setEditingStudent(null);
      if (onRefresh) onRefresh();
    } catch (err) {
      alert(`수정 실패: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* 📝 학생 신규 등록 폼 */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
          <span>👤</span> 신규 학생 등록 (학부모 연락처 포함)
        </h3>

        <form onSubmit={handleCreateStudent} className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">학생 이름</label>
            <input
              type="text"
              placeholder="예: 홍길동"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full p-2.5 border rounded-xl text-xs font-semibold"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">학생 아이디/이메일</label>
            <input
              type="text"
              placeholder="예: hong12"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-2.5 border rounded-xl text-xs font-semibold"
            />
          </div>

          {/* 🎯 학부모 연락처 입력 필드 */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">📱 학부모 연락처 (알림톡용)</label>
            <input
              type="tel"
              placeholder="010-1234-5678"
              value={parentPhone}
              onChange={(e) => setParentPhone(e.target.value)}
              className="w-full p-2.5 border rounded-xl text-xs font-semibold bg-amber-50/50 border-amber-200"
            />
          </div>

          <div className="flex items-end">
            <button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded-xl text-xs transition shadow-sm"
            >
              + 학생 등록하기
            </button>
          </div>
        </form>
      </div>

      {/* ✏️ 학생 수정 모달 (학부모 연락처 수정 포함) */}
      {editingStudent && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white p-6 rounded-2xl w-full max-w-md space-y-4 shadow-xl">
            <h4 className="text-sm font-bold text-slate-800">✏️ 학생 정보 수정</h4>
            
            <form onSubmit={handleUpdateStudent} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">학생 이름</label>
                <input
                  type="text"
                  value={editingStudent.name || ''}
                  onChange={(e) => setEditingStudent({ ...editingStudent, name: e.target.value })}
                  className="w-full p-2.5 border rounded-xl text-xs font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">아이디/이메일</label>
                <input
                  type="text"
                  value={editingStudent.email || ''}
                  onChange={(e) => setEditingStudent({ ...editingStudent, email: e.target.value })}
                  className="w-full p-2.5 border rounded-xl text-xs font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">📱 학부모 연락처</label>
                <input
                  type="tel"
                  placeholder="010-1234-5678"
                  value={editingStudent.parent_phone || ''}
                  onChange={(e) => setEditingStudent({ ...editingStudent, parent_phone: e.target.value })}
                  className="w-full p-2.5 border rounded-xl text-xs font-semibold bg-amber-50/50 border-amber-200"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingStudent(null)}
                  className="w-1/2 bg-slate-100 text-slate-600 py-2.5 rounded-xl text-xs font-bold"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="w-1/2 bg-blue-600 text-white py-2.5 rounded-xl text-xs font-bold shadow"
                >
                  저장하기
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}