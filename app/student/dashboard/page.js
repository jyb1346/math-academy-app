{/* 게시판 메뉴 목록 */}
<section className="grid grid-cols-2 sm:grid-cols-4 gap-4">
  {/* 1. 공지사항 바로가기 */}
  <div 
    onClick={() => router.push('/board?category=NOTICE')}
    className="bg-white p-5 rounded-xl border border-gray-200 text-center font-bold text-gray-700 shadow-sm cursor-pointer hover:border-blue-500 hover:shadow-md transition flex flex-col items-center gap-2"
  >
    <span className="text-2xl">📢</span>
    <span>공지사항</span>
  </div>

  {/* 2. 숙제 확인/제출 바로가기 */}
  <div 
    onClick={() => router.push('/board?category=HOMEWORK')}
    className="bg-white p-5 rounded-xl border border-gray-200 text-center font-bold text-gray-700 shadow-sm cursor-pointer hover:border-blue-500 hover:shadow-md transition flex flex-col items-center gap-2"
  >
    <span className="text-2xl">📝</span>
    <span>숙제 확인/제출</span>
  </div>

  {/* 3. 복습 영상 바로가기 */}
  <div 
    onClick={() => router.push('/board?category=VIDEO')}
    className="bg-white p-5 rounded-xl border border-gray-200 text-center font-bold text-gray-700 shadow-sm cursor-pointer hover:border-blue-500 hover:shadow-md transition flex flex-col items-center gap-2"
  >
    <span className="text-2xl">🎬</span>
    <span>복습 영상</span>
  </div>

  {/* 4. 1:1 Q&A 질문 바로가기 */}
  <div 
    onClick={() => router.push('/qna')}
    className="bg-white p-5 rounded-xl border border-gray-200 text-center font-bold text-gray-700 shadow-sm cursor-pointer hover:border-blue-500 hover:shadow-md transition flex flex-col items-center gap-2"
  >
    <span className="text-2xl">❓</span>
    <span>1:1 Q&A 질문</span>
  </div>
</section>