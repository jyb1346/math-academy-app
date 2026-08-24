'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export default function BoardPage() {
  const [user, setUser] = useState(null);
  const [classes, setClasses] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  
  // 숙제 관련 상태
  const [homeworks, setHomeworks] = useState([]);
  const [hwTitle, setHwTitle] = useState('');
  const [hwContent, setHwContent] = useState('');
  const [hwDueDate, setHwDueDate] = useState('');

  // 공지사항 관련 상태
  const [notices, setNotices] = useState([]);
  const [noticeTitle, setNoticeTitle] = useState('');
  const [noticeContent, setNoticeContent] = useState('');

  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (!userData) {
      router.push('/login');
      return;
    }
    try {
      const parsedUser = JSON.parse(userData);
      setUser(parsedUser);
      fetchClasses(parsedUser);
    } catch (e) {
      router.push('/login');
    }
  }, []);

  // 반 목록 조회
  const fetchClasses = async (currentUser) => {
    try {
      let query = supabase.from('classes').select('*');
      if (currentUser.role === 'TEACHER') {
        query = query.eq('teacher_id', currentUser.id);
      }
      const { data } = await query;
      const classList = data || [];
      setClasses(classList);

      if (classList.length > 0) {
        setSelectedClassId(classList[0].id.toString());
        fetchBoardItems(classList[0].id);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // 반 변경 시 숙제/공지사항 조회
  const handleClassChange = (classId) => {
    setSelectedClassId(classId);
    fetchBoardItems(classId);
  };

  const fetchBoardItems = async (classId) => {
    // 1. 숙제 목록 조회
    const { data: hwData } = await supabase
      .from('homeworks')
      .select('*')
      .eq('class_id', parseInt(classId))
      .order('created_at', { ascending: false });
    setHomeworks(hwData || []);

    // 2. 공지사항 목록 조회
    const { data: nData } = await supabase
      .from('notices')
      .select('*')
      .eq('class_id', parseInt(classId))
      .order('created_at', { ascending: false });
    setNotices(nData || []);
  };

  // 1️⃣ 숙제 등록 (맨 위 위치)
  const handleCreateHomework = async (e) => {
    e.preventDefault();
    if (!hwTitle.trim() || !selectedClassId) {
      return alert('숙제 제목과 반을 선택해 주세요.');
    }

    try {
      const { error } = await supabase.from('homeworks').insert([
        {
          title: hwTitle.trim(),
          content: hwContent.trim(),
          due_date: hwDueDate || null,
          class_id: parseInt(selectedClassId),
          teacher_id: user.id,
        },
      ]);
      if (error) throw error;

      alert('숙제 알림이 등록되었습니다!');
      setHwTitle('');
      setHwContent('');
      setHwDueDate('');
      fetchBoardItems(selectedClassId);
    } catch (err) {
      alert(`숙제 등록 실패: ${err.message}`);
    }
  };

  // 숙제 삭제
  const handleDeleteHomework = async (hwId) => {
    if (!confirm('해당 숙제를 삭제하시겠습니까?')) return;
    try {
      const { error } = await supabase.from('homeworks').delete().eq('id', hwId);
      if (error) throw error;
      fetchBoardItems(selectedClassId);
    } catch (err) {
      alert(`삭제 실패: ${err.message}`);
    }
  };

  // 2️⃣ 공지사항 등록 (두 번째 위치)
  const handleCreateNotice = async (e) => {
    e.preventDefault();
    if (!noticeTitle.trim() || !selectedClassId) {
      return alert('공지 제목과 반을 선택해 주세요.');
    }

    try {
      const { error } = await supabase.from('notices').insert([
        {
          title: noticeTitle.trim(),
          content: noticeContent.trim(),
          class_id: parseInt(selectedClassId),
          teacher_id: user.id,
        },
      ]);
      if (error) throw error;

      alert('공지사항이 등록되었습니다!');
      setNoticeTitle('');
      setNoticeContent('');
      fetchBoardItems(selectedClassId);
    } catch (err) {
      alert(`공지 등록 실패: ${err.message}`);
    }
  };

  // 공지사항 삭제
  const handleDeleteNotice = async (noticeId) => {
    if (!confirm('해당 공지사항을 삭제하시겠습니까?')) return;
    try {
      const { error } = await supabase.from('notices').delete().eq('id', noticeId);
      if (error) throw error;
      fetchBoardItems(selectedClassId);
    } catch (err) {
      alert(`삭제 실패: ${err.message}`);
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center font-bold text-slate-600">
      게시판 로딩 중...
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-100/70 pb-20 font-sans text-slate-800">
      
      {/* 헤더 */}
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-200/80 sticky top-0 z-30 px-6 py-4 flex justify-between items-center shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-black text-lg shadow-md shadow-blue-500/20 cursor-pointer" onClick={() => router.push('/')}>
            품
          </div>
          <div>
            <h1 onClick={() => router.push('/')} className="text-base font-extrabold text-slate-800 cursor-pointer leading-tight">
              반별 공지 및 숙제 관리
            </h1>
            <p className="text-[11px] text-slate-400 font-semibold mt-0.5">
              학생들에게 숙제 알림과 학원 공지사항을 공유하세요.
            </p>
          </div>
        </div>

        <button
          onClick={() => router.back()}
          className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-3.5 py-2 rounded-xl transition border border-slate-200"
        >
          ← 이전 화면으로
        </button>
      </header>

      <main className="max-w-4xl mx-auto px-4 mt-8 space-y-8">

        {/* 🏫 대상 반 선택 셀렉터 */}
        <section className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <label className="text-sm font-extrabold text-slate-800 flex items-center gap-2">
            <span>📘</span> 관리할 반 선택:
          </label>
          <select
            value={selectedClassId}
            onChange={(e) => handleClassChange(e.target.value)}
            className="p-3 bg-slate-50 border border-slate-200/80 rounded-2xl text-xs font-bold text-indigo-700 focus:outline-none focus:border-indigo-500 transition min-w-[200px]"
          >
            {classes.length === 0 ? (
              <option value="">개설된 반이 없습니다</option>
            ) : (
              classes.map((cls) => (
                <option key={cls.id} value={cls.id}>
                  📘 {cls.name}
                </option>
              ))
            )}
          </select>
        </section>

        {/* 🎯 1위: 숙제 알림 작성 및 목록 (최상단 배치) */}
        <section className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-6">
          <div className="border-b border-slate-100 pb-4 flex justify-between items-center">
            <div>
              <h2 className="text-base font-extrabold text-slate-800 flex items-center gap-2">
                <span>📝</span> 오늘/이번 주 숙제 등록
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">학생들이 확인할 숙제와 마감일을 작성해 주세요.</p>
            </div>
            <span className="bg-indigo-50 text-indigo-700 font-bold text-xs px-3 py-1 rounded-full border border-indigo-100">
              숙제 {homeworks.length}건
            </span>
          </div>

          {/* 숙제 작성 폼 */}
          <form onSubmit={handleCreateHomework} className="space-y-3 bg-slate-50/80 p-4 rounded-2xl border border-slate-200/80">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-[11px] font-bold text-slate-600 mb-1">숙제 제목</label>
                <input
                  type="text"
                  placeholder="예: 개념원리 p.45~50 유제 풀이"
                  value={hwTitle}
                  onChange={(e) => setHwTitle(e.target.value)}
                  className="w-full p-2.5 bg-white border border-slate-200/80 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-indigo-500 transition"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">제출 마감일</label>
                <input
                  type="date"
                  value={hwDueDate}
                  onChange={(e) => setHwDueDate(e.target.value)}
                  className="w-full p-2.5 bg-white border border-slate-200/80 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-indigo-500 transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">상세 안내 사항 (선택)</label>
              <textarea
                placeholder="오답 노트 작성 필수, 풀이 과정 제출 등"
                value={hwContent}
                onChange={(e) => setHwContent(e.target.value)}
                className="w-full p-2.5 bg-white border border-slate-200/80 rounded-xl text-xs h-20 font-medium text-slate-800 focus:outline-none focus:border-indigo-500 transition"
              />
            </div>

            <button
              type="submit"
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl text-xs shadow-sm transition"
            >
              + 숙제 알림 등록하기
            </button>
          </form>

          {/* 숙제 리스트 */}
          <div className="space-y-3 pt-2">
            <h3 className="text-xs font-extrabold text-slate-700">📋 등록된 숙제 목록</h3>
            {homeworks.length === 0 ? (
              <p className="text-center py-8 text-slate-400 text-xs font-bold">등록된 숙제가 없습니다.</p>
            ) : (
              homeworks.map((hw) => (
                <div key={hw.id} className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 flex justify-between items-start gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-sm text-slate-800">{hw.title}</span>
                      {hw.due_date && (
                        <span className="bg-amber-100 text-amber-900 border border-amber-200 px-2.5 py-0.5 rounded-full font-bold text-[10px]">
                          📅 마감일: {hw.due_date}
                        </span>
                      )}
                    </div>
                    {hw.content && <p className="text-xs text-slate-600 leading-relaxed">{hw.content}</p>}
                  </div>

                  <button
                    onClick={() => handleDeleteHomework(hw.id)}
                    className="text-rose-500 hover:underline font-bold text-xs whitespace-nowrap"
                  >
                    삭제
                  </button>
                </div>
              ))
            )}
          </div>
        </section>

        {/* 📢 2위: 반별 공지사항 작성 및 목록 (두 번째 배치) */}
        <section className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-6">
          <div className="border-b border-slate-100 pb-4 flex justify-between items-center">
            <div>
              <h2 className="text-base font-extrabold text-slate-800 flex items-center gap-2">
                <span>📢</span> 반별 공지사항 등록
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">시험 일정, 휴강 및 보강 등 중요 공지를 작성해 주세요.</p>
            </div>
            <span className="bg-slate-100 text-slate-700 font-bold text-xs px-3 py-1 rounded-full">
              공지 {notices.length}건
            </span>
          </div>

          {/* 공지사항 작성 폼 */}
          <form onSubmit={handleCreateNotice} className="space-y-3 bg-slate-50/80 p-4 rounded-2xl border border-slate-200/80">
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">공지 제목</label>
              <input
                type="text"
                placeholder="예: 다음 주 중간고사 대비 보강 안내"
                value={noticeTitle}
                onChange={(e) => setNoticeTitle(e.target.value)}
                className="w-full p-2.5 bg-white border border-slate-200/80 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-slate-500 transition"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">공지 상세 내용</label>
              <textarea
                placeholder="공지 내용을 자세히 작성해 주세요."
                value={noticeContent}
                onChange={(e) => setNoticeContent(e.target.value)}
                className="w-full p-2.5 bg-white border border-slate-200/80 rounded-xl text-xs h-24 font-medium text-slate-800 focus:outline-none focus:border-slate-500 transition"
              />
            </div>

            <button
              type="submit"
              className="w-full bg-slate-800 hover:bg-slate-900 text-white font-bold py-3 rounded-xl text-xs shadow-sm transition"
            >
              + 공지사항 등록하기
            </button>
          </form>

          {/* 공지사항 리스트 */}
          <div className="space-y-3 pt-2">
            <h3 className="text-xs font-extrabold text-slate-700">📢 등록된 공지사항 목록</h3>
            {notices.length === 0 ? (
              <p className="text-center py-8 text-slate-400 text-xs font-bold">등록된 공지사항이 없습니다.</p>
            ) : (
              notices.map((n) => (
                <div key={n.id} className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 flex justify-between items-start gap-4">
                  <div className="space-y-1">
                    <span className="font-extrabold text-sm text-slate-800 block">{n.title}</span>
                    {n.content && <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-line">{n.content}</p>}
                  </div>

                  <button
                    onClick={() => handleDeleteNotice(n.id)}
                    className="text-rose-500 hover:underline font-bold text-xs whitespace-nowrap"
                  >
                    삭제
                  </button>
                </div>
              ))
            )}
          </div>
        </section>

      </main>

    </div>
  );
}