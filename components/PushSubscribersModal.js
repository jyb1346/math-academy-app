'use client';
import { useState, useEffect, useMemo } from 'react';

export default function PushSubscribersModal({ onClose }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({
    totalStudents: 0,
    subscribedCount: 0,
    unsubscribedCount: 0,
    subscribedList: [],
    unsubscribedList: [],
  });
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('SUBSCRIBED'); // 'SUBSCRIBED' | 'UNSUBSCRIBED'
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch('/api/admin/push-subscribers');
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || '조회 실패');
        setData({
          totalStudents: json.totalStudents || 0,
          subscribedCount: json.subscribedCount || 0,
          unsubscribedCount: json.unsubscribedCount || 0,
          subscribedList: json.subscribedList || json.list || [],
          unsubscribedList: json.unsubscribedList || [],
        });
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const currentList = activeTab === 'SUBSCRIBED' ? data.subscribedList : data.unsubscribedList;

  const filteredList = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return currentList;
    return currentList.filter(
      (s) =>
        (s.name && s.name.toLowerCase().includes(term)) ||
        (s.email && s.email.toLowerCase().includes(term)) ||
        (s.teacherName && s.teacherName.toLowerCase().includes(term)) ||
        (s.parent_phone && s.parent_phone.includes(term))
    );
  }, [currentList, searchTerm]);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4 animate-in fade-in">
      <div className="bg-white w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[88vh]">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 px-5 py-4 flex justify-between items-center text-white shrink-0">
          <div>
            <h2 className="text-base sm:text-lg font-black flex items-center gap-2">
              <span>🔔</span> 학생 앱 푸시 알림 현황
            </h2>
            <p className="text-indigo-200 text-xs mt-0.5 font-bold">
              알림을 켠 학생과 아직 안 켠 학생을 실시간으로 확인합니다.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white bg-white/10 hover:bg-white/20 rounded-full p-2 transition cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-5 flex-1 overflow-y-auto bg-slate-50 space-y-3.5">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400 gap-3">
              <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
              <p className="text-xs sm:text-sm font-bold animate-pulse">학생 알림 구독 현황을 불러오는 중...</p>
            </div>
          ) : error ? (
            <div className="bg-rose-50 text-rose-600 p-4 rounded-2xl text-xs sm:text-sm font-bold text-center border border-rose-100">
              오류: {error}
            </div>
          ) : (
            <>
              {/* 요약 대시보드 카드 */}
              <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] text-slate-400 font-extrabold mb-0.5">전체 학생 앱 푸시 수신율</p>
                  <p className="text-base sm:text-lg font-black text-slate-800">
                    <span className="text-indigo-600 text-xl sm:text-2xl">{data.subscribedCount}</span>
                    <span className="text-slate-400 text-sm font-bold"> / {data.totalStudents}명</span>
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-right">
                    <span className="text-[10px] text-rose-500 font-bold block">
                      미수신: {data.unsubscribedCount}명
                    </span>
                    <span className="text-[10px] text-emerald-600 font-bold block">
                      수신중: {data.subscribedCount}명
                    </span>
                  </div>
                  <div className="bg-indigo-50 text-indigo-700 font-black text-lg sm:text-xl px-3.5 py-2 rounded-xl border border-indigo-100 shrink-0">
                    {data.totalStudents > 0
                      ? Math.round((data.subscribedCount / data.totalStudents) * 100)
                      : 0}
                    %
                  </div>
                </div>
              </div>

              {/* 탭 전환 버튼 */}
              <div className="flex rounded-xl bg-slate-200/70 p-1 text-xs font-black">
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('SUBSCRIBED');
                    setSearchTerm('');
                  }}
                  className={`flex-1 py-2 rounded-lg transition flex items-center justify-center gap-1.5 cursor-pointer ${
                    activeTab === 'SUBSCRIBED'
                      ? 'bg-white text-emerald-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span>🟢 알림 켠 학생</span>
                  <span className="bg-emerald-100 text-emerald-800 text-[10px] px-1.5 py-0.2 rounded-full font-black">
                    {data.subscribedCount}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('UNSUBSCRIBED');
                    setSearchTerm('');
                  }}
                  className={`flex-1 py-2 rounded-lg transition flex items-center justify-center gap-1.5 cursor-pointer ${
                    activeTab === 'UNSUBSCRIBED'
                      ? 'bg-white text-rose-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span>⚪ 아직 안 켠 학생</span>
                  <span className="bg-rose-100 text-rose-800 text-[10px] px-1.5 py-0.2 rounded-full font-black">
                    {data.unsubscribedCount}
                  </span>
                </button>
              </div>

              {/* 검색창 */}
              <div className="relative">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder={
                    activeTab === 'SUBSCRIBED'
                      ? '알림 켠 학생 이름/선생님 검색...'
                      : '미수신 학생 이름/선생님/학부모연락처 검색...'
                  }
                  className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500 shadow-2xs"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* 명단 리스트 */}
              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
                <div className="bg-slate-100/80 px-4 py-2 border-b border-slate-200 text-[11px] font-black text-slate-500 flex justify-between items-center">
                  <span>
                    {activeTab === 'SUBSCRIBED' ? '정상 수신 학생 명단' : '알림 미등록 학생 명단'}
                    {searchTerm && ' (검색결과)'}
                  </span>
                  <span>총 {filteredList.length}명</span>
                </div>

                {filteredList.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 text-xs font-bold">
                    {searchTerm
                      ? '검색된 학생이 없습니다.'
                      : activeTab === 'SUBSCRIBED'
                      ? '아직 알림을 켠 학생이 없습니다.'
                      : '모든 학생이 알림을 켰습니다! 🎉'}
                  </div>
                ) : (
                  <ul className="divide-y divide-slate-100 max-h-[38vh] overflow-y-auto">
                    {filteredList.map((student, idx) => {
                      const dateStr = student.subscribedAt
                        ? new Date(student.subscribedAt).toLocaleString('ko-KR', {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : null;

                      return (
                        <li
                          key={student.id}
                          className="p-3 px-4 flex items-center justify-between hover:bg-slate-50 transition"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className="text-[11px] font-bold text-slate-400 w-5 shrink-0">
                              {idx + 1}.
                            </span>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-xs sm:text-sm font-black text-slate-900">
                                  {student.name}
                                </span>
                                {student.teacherName && (
                                  <span className="text-[10px] bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded font-bold border border-indigo-100">
                                    {student.teacherName}T
                                  </span>
                                )}
                              </div>
                              <p className="text-[10px] text-slate-400 font-medium truncate mt-0.5">
                                {student.email}
                                {activeTab === 'UNSUBSCRIBED' && student.parent_phone && (
                                  <span className="text-slate-500 font-bold ml-1.5">
                                    · 학부모: {student.parent_phone}
                                  </span>
                                )}
                              </p>
                            </div>
                          </div>

                          <div className="text-right shrink-0 pl-2">
                            {activeTab === 'SUBSCRIBED' ? (
                              <>
                                <span className="inline-block bg-emerald-100 text-emerald-800 text-[10px] font-black px-2 py-0.5 rounded-md border border-emerald-200">
                                  정상 수신중
                                </span>
                                {dateStr && (
                                  <p className="text-[9.5px] text-slate-400 font-medium mt-0.5">
                                    {dateStr}
                                  </p>
                                )}
                              </>
                            ) : (
                              <span className="inline-block bg-slate-100 text-slate-600 text-[10px] font-black px-2 py-0.5 rounded-md border border-slate-200">
                                미등록 (알림 꺼짐)
                              </span>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-3.5 bg-white border-t border-slate-100 shrink-0">
          <button
            onClick={onClose}
            className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 py-3 rounded-2xl text-xs sm:text-sm font-bold transition cursor-pointer"
          >
            닫기
          </button>
        </div>

      </div>
    </div>
  );
}
