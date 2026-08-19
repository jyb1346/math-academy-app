import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-50 text-gray-800">
      {/* 상단 네비게이션 바 */}
      <header className="bg-white shadow-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-blue-600">품수학 학원 관리 시스템</h1>
          <nav className="space-x-4">
            <a href="#about" className="hover:text-blue-600 font-medium">학원 소개</a>
            <a href="#teachers" className="hover:text-blue-600 font-medium">강사 소개</a>
            <Link 
              href="/login" 
              className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition"
            >
              학생/강사 로그인
            </Link>
          </nav>
        </div>
      </header>

      {/* 메인 히어로 섹션 */}
      <section className="bg-blue-600 text-white py-20 text-center px-4">
        <h2 className="text-4xl font-extrabold mb-4">체계적인 수학 학습 관리의 시작</h2>
        <p className="text-lg opacity-90 mb-8">
          개별 맞춤 숙제 관리, 출결 알림, 복습 영상까지 한곳에서 스마트하게 관리하세요.
        </p>
        <Link 
          href="/login" 
          className="bg-white text-blue-600 px-6 py-3 rounded-xl font-bold text-lg hover:bg-gray-100 transition shadow-lg"
        >
          내 강의실 접속하기
        </Link>
      </section>

      {/* 학원 소개 섹션 */}
      <section id="about" className="py-16 max-w-6xl mx-auto px-4">
        <h3 className="text-3xl font-bold text-center mb-12">학원 핵심 시스템</h3>
        <div className="grid md:grid-cols-3 gap-8">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 text-center">
            <div className="text-4xl mb-4">📱</div>
            <h4 className="text-xl font-bold mb-2">실시간 출결 관리</h4>
            <p className="text-gray-600">수업 시작 시 등원 체크 및 부모님 자동 문자 알림 지원</p>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 text-center">
            <div className="text-4xl mb-4">📚</div>
            <h4 className="text-xl font-bold mb-2">숙제 및 강의자료</h4>
            <p className="text-gray-600">매 수업별 숙제 안내, 온라인 제출, PDF 자료 다운로드</p>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 text-center">
            <div className="text-4xl mb-4">🎬</div>
            <h4 className="text-xl font-bold mb-2">복습 영상 제공</h4>
            <p className="text-gray-600">놓친 수업이나 복습이 필요할 때 언제든 다시보기 가능</p>
          </div>
        </div>
      </section>

      {/* 강사 소개 섹션 */}
      <section id="teachers" className="py-16 bg-white border-t border-gray-100">
        <div className="max-w-6xl mx-auto px-4">
          <h3 className="text-3xl font-bold text-center mb-12">강사진 소개</h3>
          <div className="max-w-md mx-auto bg-gray-50 rounded-2xl p-6 border border-gray-200 text-center">
            <div className="w-32 h-32 bg-blue-100 rounded-full mx-auto mb-4 flex items-center justify-center text-5xl">
              👨‍🏫
            </div>
            <h4 className="text-2xl font-bold">대표 강사</h4>
            <p className="text-blue-600 font-semibold mb-4">수학 전임 강사</p>
            <p className="text-gray-600 text-sm leading-relaxed">
              개념부터 심화까지 완벽한 1:1 맞춤 관리와 체계적인 피드백으로 만점을 이끌어냅니다.
            </p>
          </div>
        </div>
      </section>

      {/* 하단 푸터 */}
      <footer className="bg-gray-800 text-gray-400 py-8 text-center text-sm">
        <p>© 2026 수학학원 관리 시스템. All rights reserved.</p>
      </footer>
    </div>
  );
}