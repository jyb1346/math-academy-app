'use client';
import { useState, useEffect } from 'react';

export default function PushSubscribersModal({ onClose }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({ totalStudents: 0, subscribedCount: 0, list: [] });
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch('/api/admin/push-subscribers');
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || '조회 실패');
        setData(json);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-white w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
        
        {/* Header */}
        <div className="bg-indigo-600 px-5 py-4 flex justify-between items-center text-white shrink-0">
          <div>
            <h2 className="text-lg font-black flex items-center gap-2">
              <span>🔔</span> 알림 설정 학생 명단
            </h2>
            <p className="text-indigo-200 text-xs mt-1 font-bold">
              푸시 알림을 켜둔 학생들을 실시간으로 확인합니다.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-white/70 hover:text-white bg-white/10 hover:bg-white/20 rounded-full p-2 transition"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-5 flex-1 overflow-y-auto bg-slate-50">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-10 text-slate-400 gap-3">
              <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
              <p className="text-sm font-bold animate-pulse">명단을 불러오는 중...</p>
            </div>
          ) : error ? (
            <div className="bg-rose-50 text-rose-600 p-4 rounded-2xl text-sm font-bold text-center border border-rose-100">
              {error}
            </div>
          ) : (
            <div className="space-y-4">
              
              {/* Summary */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-500 font-bold mb-0.5">전체 학생 대비 가입률</p>
                  <p className="text-lg font-black text-slate-800">
                    <span className="text-indigo-600 text-2xl">{data.subscribedCount}</span> 명 / {data.totalStudents}명
                  </p>
                </div>
                <div className="bg-indigo-50 text-indigo-700 font-black text-xl px-4 py-2 rounded-xl border border-indigo-100">
                  {data.totalStudents > 0 
                    ? Math.round((data.subscribedCount / data.totalStudents) * 100) 
                    : 0}%
                </div>
              </div>

              {/* List */}
              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                <div className="bg-slate-100 px-4 py-2 border-b border-slate-200 text-xs font-black text-slate-500">
                  명단 ({data.list.length}명)
                </div>
                {data.list.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 text-sm font-bold">
                    아직 알림을 등록한 학생이 없습니다.
                  </div>
                ) : (
                  <ul className="divide-y divide-slate-100 max-h-[40vh] overflow-y-auto">
                    {data.list.map((student, idx) => {
                      const dateStr = new Date(student.subscribedAt).toLocaleString('ko-KR', {
                        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                      });
                      return (
                        <li key={student.id} className="p-3 px-4 flex items-center justify-between hover:bg-slate-50 transition">
                          <div className="flex items-center gap-3">
                            <span className="text-xs font-bold text-slate-400 w-4">{idx + 1}.</span>
                            <div>
                              <p className="text-sm font-extrabold text-slate-800">{student.name}</p>
                              {student.school && <p className="text-[10px] text-slate-500 font-bold mt-0.5">{student.school}</p>}
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="inline-block bg-emerald-100 text-emerald-700 text-[10px] font-black px-2 py-0.5 rounded-md border border-emerald-200 mb-1">
                              정상 수신중
                            </span>
                            <p className="text-[10px] text-slate-400 font-bold">등록: {dateStr}</p>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-white border-t border-slate-100 shrink-0">
          <button
            onClick={onClose}
            className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 py-3 rounded-2xl text-sm font-bold transition"
          >
            닫기
          </button>
        </div>

      </div>
    </div>
  );
}

