'use client';
import { compressImage } from '@/lib/imageCompressor';

import { useState, useEffect, Suspense } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter, useSearchParams } from 'next/navigation';
import CategoryTabs from './components/CategoryTabs';
import PostCreateForm from './components/PostCreateForm';
import PostEditModal from './components/PostEditModal';

function getYouTubeId(url) {
  if (!url) return null;
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
  return match ? match[1] : null;
}

// 🔍 첨부파일(URL 및 원본 파일명) 추출 헬퍼
function extractAttachment(text) {
  if (!text) return null;
  const match = text.match(/📎 첨부파일(?: 링크)?:\s*(\S+)(?:\s*\|\s*([^\n]+))?/);
  if (match) {
    const url = match[1];
    let name = match[2]?.trim();
    if (!name || name.startsWith('.') || name === '첨부파일') {
      const rawName = decodeURIComponent(url.split('/').pop() || '');
      const ext = rawName.split('.').pop() || 'pdf';
      const stripped = rawName.replace(/^\d+_[a-z0-9]+_/, '').replace(/^\d+_/, '').replace(/\.[^/.]+$/, '');
      if (stripped && !/^[a-z0-9]{8,15}$/i.test(stripped)) {
        name = `${stripped}.${ext}`;
      } else {
        name = `첨부파일.${ext}`;
      }
    }
    return { url, name };
  }
  const driveMatch = text.match(/(https?:\/\/drive\.google\.com\/\S+)/);
  if (driveMatch) return { url: driveMatch[1], name: '구글 드라이브 수업자료' };
  return null;
}

function extractFileUrl(text) {
  const att = extractAttachment(text);
  return att ? att.url : null;
}

// 🔍 구글 폼 URL 추출 헬퍼
function extractGoogleFormUrl(text) {
  if (!text) return null;
  const match = text.match(/📋 구글 폼 링크:\s*(\S+)/);
  if (match) return match[1];
  const formsMatch = text.match(/(https?:\/\/(?:docs\.google\.com\/forms|forms\.gle)\S*)/);
  if (formsMatch) return formsMatch[1];
  return null;
}

// 🔍 첨부파일 및 구글폼 링크, 빈 메모를 제거한 깔끔한 본문 렌더링 헬퍼
function cleanContentForDisplay(text) {
  if (!text) return '';
  let cleaned = text
    .replace(/📎 첨부파일(?: 링크)?:\s*\S+(?:\s*\|\s*[^\n]+)?/g, '')
    .replace(/📋 구글 폼 링크:\s*\S+/g, '')
    .replace(/📝 메모:\s*$/g, '')
    .replace(/📝 메모:\s*\n\s*$/g, '')
    .trim();

  if (cleaned.endsWith('📝 메모:')) {
    cleaned = cleaned.replace(/\n*📝 메모:$/, '').trim();
  }
  return cleaned;
}

function BoardMain() {
  const [classes, setClasses] = useState([]);
  const [myClasses, setMyClasses] = useState([]);
  const [myClassIds, setMyClassIds] = useState([]);
  const [allStudents, setAllStudents] = useState([]);
  const [classStudents, setClassStudents] = useState([]);
  
  const [targetClassId, setTargetClassId] = useState('');
  const [selectedClassId, setSelectedClassId] = useState('PUBLIC');
  const [category, setCategory] = useState('ALL');
  const [newCategory, setNewCategory] = useState('HOMEWORK');
  const [dueDate, setDueDate] = useState('');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [posts, setPosts] = useState([]);
  const [googleFormUrl, setGoogleFormUrl] = useState('');
  const [homeworkList, setHomeworkList] = useState([{ bookTitle: '', range: '' }]);
  const [attachedFile, setAttachedFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  // 🎯 읽음 확인 (post_confirmations) 상태
  const [confirmations, setConfirmations] = useState({}); // post_id -> Set of student_id
  const [confirmationDates, setConfirmationDates] = useState({}); // post_id -> { student_id: created_at }
  const [activeConfirmModalPost, setActiveConfirmModalPost] = useState(null); // 모달로 열린 게시글

  // 수정 모달 상태
  const [editingPost, setEditingPost] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editCategory, setEditCategory] = useState('HOMEWORK');
  const [editTargetClassId, setEditTargetClassId] = useState('');
  const [editDueDate, setEditDueDate] = useState('');
  const [editGoogleFormUrl, setEditGoogleFormUrl] = useState('');
  const [editYoutubeUrl, setEditYoutubeUrl] = useState('');
  const [editHomeworkList, setEditHomeworkList] = useState([]);
  const [editExistingAttachment, setEditExistingAttachment] = useState(null);
  const [editNewFile, setEditNewFile] = useState(null);
  const [editUploading, setEditUploading] = useState(false);

  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const router = useRouter();

  const searchParams = useSearchParams();

  useEffect(() => {
    const catParam = searchParams.get('category');
    if (catParam === 'HOMEWORK' || catParam === 'NOTICE' || catParam === 'NOTICE_HOMEWORK') {
      setCategory('NOTICE_HOMEWORK');
    } else if (catParam === 'VIDEO') {
      setCategory('VIDEO');
    } else if (catParam === 'MATERIAL') {
      setCategory('MATERIAL');
    } else if (catParam === 'ALL') {
      setCategory('ALL');
    }
  }, [searchParams]);

  useEffect(() => {
    setDueDate(new Date().toISOString().split('T')[0]);

    const userData = localStorage.getItem('user');
    if (!userData) {
      router.push('/login');
      return;
    }

    try {
      const parsedUser = JSON.parse(userData);
      setUser(parsedUser);
      initData(parsedUser);
    } catch (e) {
      console.error(e);
      router.push('/login');
    }
  }, []);

  const initData = async (currentUser) => {
    try {
      // 1. 전체 반 & 배정 정보 & 전체 학생 정보 로드
      const { data: cData } = await supabase.from('classes').select('*');
      const allC = cData || [];
      setClasses(allC);

      const { data: csData } = await supabase.from('class_students').select('*');
      setClassStudents(csData || []);

      const { data: stData } = await supabase.from('users').select('id, name, email').eq('role', 'STUDENT');
      setAllStudents(stData || []);

      // 2. 사용자 권한별 담당/소속 반 분기
      // 💡 요구사항: 원장님(HEAD_TEACHER)도 직접 수업을 담당하므로 일반 선생님과 동일하게 본인 담당 반만 노출!
      if (currentUser.role !== 'STUDENT') {
        const myC = allC.filter((c) => c.teacher_id === currentUser.id);
        setMyClasses(myC);

        if (myC.length > 0) {
          setSelectedClassId(String(myC[0].id));
          setTargetClassId(String(myC[0].id));
        } else {
          setSelectedClassId('PUBLIC');
          setTargetClassId('ALL_STUDENTS');
        }
      } else {
        const myEnrolledIds = (csData || [])
          .filter((cs) => cs.student_id === currentUser.id)
          .map((cs) => cs.class_id);
        setMyClassIds(myEnrolledIds);

        const studentMyClasses = allC.filter((c) => myEnrolledIds.includes(c.id));
        setMyClasses(studentMyClasses);

        if (studentMyClasses.length > 0) {
          setSelectedClassId(String(studentMyClasses[0].id));
        } else {
          setSelectedClassId('PUBLIC');
        }
      }

      await fetchPosts();
      await fetchConfirmations();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchPosts = async () => {
    try {
      const { data, error } = await supabase
        .from('posts')
        .select('*, users!posts_author_id_fkey(name), classes(name, teacher_id)')
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('Post fetch error, fallback:', error);
        const { data: fbData } = await supabase.from('posts').select('*').order('created_at', { ascending: false });
        setPosts(fbData || []);
      } else {
        const filtered = (data || []).filter((p) => {
          try {
            const m = JSON.parse(p.content || '{}');
            return !m.isLuckyEvent;
          } catch {
            return true;
          }
        });
        setPosts(filtered);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // 🎯 읽음 확인 데이터 패칭
  const fetchConfirmations = async () => {
    try {
      const { data, error } = await supabase.from('post_confirmations').select('*');
      if (!error && data) {
        const confirmMap = {};
        const dateMap = {};
        data.forEach((item) => {
          if (!confirmMap[item.post_id]) {
            confirmMap[item.post_id] = new Set();
            dateMap[item.post_id] = {};
          }
          confirmMap[item.post_id].add(item.student_id);
          dateMap[item.post_id][item.student_id] = item.created_at;
        });
        setConfirmations(confirmMap);
        setConfirmationDates(dateMap);
      }
    } catch (e) {
      console.warn('Error fetching confirmations:', e);
    }
  };

  // 🎯 학생: 게시글 [확인했습니다] 토글
  const handleToggleConfirm = async (postId) => {
    if (!user || user.role !== 'STUDENT') return;

    const isConfirmed = confirmations[postId]?.has(user.id);

    try {
      if (isConfirmed) {
        const { error } = await supabase
          .from('post_confirmations')
          .delete()
          .eq('post_id', postId)
          .eq('student_id', user.id);

        if (!error) {
          setConfirmations((prev) => {
            const next = { ...prev };
            if (next[postId]) {
              next[postId] = new Set(next[postId]);
              next[postId].delete(user.id);
            }
            return next;
          });
        }
      } else {
        const { error } = await supabase
          .from('post_confirmations')
          .insert([{ post_id: postId, student_id: user.id }]);

        if (!error) {
          const nowStr = new Date().toISOString();
          setConfirmations((prev) => {
            const next = { ...prev };
            const s = new Set(next[postId] || []);
            s.add(user.id);
            next[postId] = s;
            return next;
          });
          setConfirmationDates((prev) => ({
            ...prev,
            [postId]: { ...(prev[postId] || {}), [user.id]: nowStr }
          }));
        }
      }
    } catch (err) {
      alert('확인 상태 변경에 실패했습니다: ' + err.message);
    }
  };

  const handleAddBook = () => setHomeworkList([...homeworkList, { bookTitle: '', range: '' }]);
  const handleRemoveBook = (index) => setHomeworkList(homeworkList.filter((_, i) => i !== index));
  const handleBookChange = (index, field, value) => {
    const updated = [...homeworkList];
    updated[index][field] = value;
    setHomeworkList(updated);
  };

  const handleEditAddBook = () => setEditHomeworkList([...editHomeworkList, { bookTitle: '', range: '' }]);
  const handleEditRemoveBook = (index) => setEditHomeworkList(editHomeworkList.filter((_, i) => i !== index));
  const handleEditBookChange = (index, field, value) => {
    const updated = [...editHomeworkList];
    updated[index][field] = value;
    setEditHomeworkList(updated);
  };

  // ⏰ 숙제 마감 임박 알림 수동 발송 (선생님 전용)
  const handleSendManualReminder = async (post) => {
    if (!confirm(`[${post.title}] 숙제 마감 알림을 해당 반 학생들에게 지금 즉시 발송하시겠습니까?`)) return;

    try {
      let targetUserIds = [];
      if (post.class_id) {
        targetUserIds = classStudents
          .filter((cs) => String(cs.class_id) === String(post.class_id))
          .map((cs) => cs.student_id);
      } else {
        targetUserIds = allStudents.map((s) => s.id);
      }

      if (targetUserIds.length === 0) {
        return alert('발송 대상 학생이 없습니다.');
      }

      const res = await fetch('/api/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userIds: targetUserIds,
          title: `🚨 [숙제 마감 알림] ${post.title}`,
          message: `제출 마감일: ${post.due_date || '기한 미지정'}. 잊지 말고 숙제를 확인해 주세요!`,
          url: '/board?category=NOTICE_HOMEWORK',
        }),
      });

      const data = await res.json();
      alert(`📲 해당 반 학생들에게 마감 리마인드 알림이 발송되었습니다! (수신 기기: ${data.count || 0}대)`);
    } catch (err) {
      alert('알림 발송 실패: ' + err.message);
    }
  };

  const handleCreatePost = async (e) => {
    e.preventDefault();
    if (!title.trim()) return alert('제목을 입력해 주세요.');

    try {
      setUploading(true);
      let filePublicUrl = null;

      if (attachedFile) {
        try {
          const fileToUpload = await compressImage(attachedFile);
          const fileExt = attachedFile.name.split('.').pop();
          const fileName = `${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExt}`;
          const filePath = `board_files/${fileName}`;

          const { error: uploadError } = await supabase.storage
            .from('attachments')
            .upload(filePath, fileToUpload);

          if (!uploadError) {
            const { data: urlData } = supabase.storage
              .from('attachments')
              .getPublicUrl(filePath);
            filePublicUrl = urlData?.publicUrl;
          }
        } catch (storageErr) {
          console.warn('Storage upload warning:', storageErr);
        }
      }

      let finalContent = content;
      if (newCategory === 'HOMEWORK') {
        const bookDetails = homeworkList
          .filter((item) => item.bookTitle.trim() !== '')
          .map((item) => `📘 [${item.bookTitle}] ${item.range}`)
          .join('\n');

        const formLinkText = googleFormUrl.trim() ? `\n\n📋 구글 폼 링크: ${googleFormUrl.trim()}` : '';
        const memoText = content.trim() ? `\n\n📝 메모:\n${content.trim()}` : '';
        finalContent = `${bookDetails}${formLinkText}${memoText}`.trim();
      }

      if (filePublicUrl) {
        finalContent += `\n\n📎 첨부파일: ${filePublicUrl} | ${attachedFile.name}`;
      }

      // 💡 UUID 안전 매핑: classes에 존재하는 ID만 전달
      const matchedClass = myClasses.find((c) => String(c.id) === String(targetClassId)) ||
                           classes.find((c) => String(c.id) === String(targetClassId));
      const validClassId = (targetClassId === 'ALL_STUDENTS' || !matchedClass) ? null : matchedClass.id;

      const postData = {
        title: title.trim(),
        content: finalContent,
        category: newCategory,
        author_id: user.id,
        class_id: validClassId,
        due_date: newCategory === 'HOMEWORK' ? dueDate : null,
      };

      const { error } = await supabase.from('posts').insert([postData]);
      if (error) throw error;

      // 🔔 실시간 웹 푸시 알림 발송 (백그라운드)
      try {
        let targetUserIds = [];
        if (validClassId) {
          targetUserIds = (classStudents || [])
            .filter((cs) => String(cs.class_id) === String(validClassId))
            .map((cs) => cs.student_id);
        } else {
          targetUserIds = (allStudents || []).map((st) => st.id);
        }

        if (targetUserIds.length > 0) {
          fetch('/api/push/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userIds: targetUserIds,
              title: `[품수학 ${matchedClass ? matchedClass.name : '학원공지'}] ${title.trim()}`,
              message: newCategory === 'HOMEWORK' ? '새로운 숙제가 등록되었습니다. 기한을 확인하세요.' : '새로운 공지사항이 등록되었습니다.',
              url: '/board',
            }),
          }).catch((err) => console.warn('Push send warning:', err));
        }
      } catch (pushErr) {
        console.warn('Push dispatch error:', pushErr);
      }

      setTitle('');
      setContent('');
      setGoogleFormUrl('');
      setAttachedFile(null);
      setHomeworkList([{ bookTitle: '', range: '' }]);
      fetchPosts();
      alert(`${matchedClass ? `[${matchedClass.name}] 반` : '학원 전체'} 게시글이 성공적으로 등록되었습니다!`);
    } catch (err) {
      console.error(err);
      alert('등록 실패: ' + err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleOpenEdit = (post) => {
    setEditingPost(post);
    setEditTitle(post.title || '');
    setEditCategory(post.category || 'HOMEWORK');
    setEditTargetClassId(post.class_id ? String(post.class_id) : 'ALL_STUDENTS');
    setEditDueDate(post.due_date || new Date().toISOString().split('T')[0]);

    const postContent = post.content || '';

    // 1. 구글 폼 링크 추출
    const formMatch = postContent.match(/📋 구글 폼 링크:\s*(\S+)/);
    setEditGoogleFormUrl(formMatch ? formMatch[1] : '');

    // 2. 유튜브 영상 링크 추출
    const ytMatch = postContent.match(/(https?:\/\/(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/|v\/)|youtu\.be\/)[\w-]{11}[^\s]*)/);
    setEditYoutubeUrl(ytMatch ? ytMatch[1] : '');

    // 3. 첨부파일 추출
    const att = extractAttachment(postContent);
    setEditExistingAttachment(att);
    setEditNewFile(null);

    // 4. 숙제 교재 목록 파싱
    const lines = postContent.split('\n');
    const parsedBooks = [];
    lines.forEach((line) => {
      if (line.startsWith('📘 [')) {
        const match = line.match(/📘 \[(.*?)\] (.*)/);
        if (match) {
          parsedBooks.push({ bookTitle: match[1], range: match[2] });
        }
      }
    });
    setEditHomeworkList(parsedBooks.length > 0 ? parsedBooks : [{ bookTitle: '', range: '' }]);

    // 5. 순수 본문 내용/메모 추출
    let pureContent = cleanContentForDisplay(postContent);
    
    // 유튜브 URL 제거
    if (ytMatch) {
      pureContent = pureContent.replace(ytMatch[1], '').trim();
    }

    const memoIndex = pureContent.indexOf('📝 메모:\n');
    if (memoIndex !== -1) {
      setEditContent(pureContent.substring(memoIndex + 7));
    } else if (parsedBooks.length > 0) {
      setEditContent('');
    } else {
      setEditContent(pureContent);
    }
  };

  const handleUpdatePost = async (e) => {
    e.preventDefault();
    if (!editTitle.trim()) return alert('제목을 입력해 주세요.');

    try {
      setEditUploading(true);

      // 1. 새 첨부파일이 선택된 경우 업로드 진행
      let filePublicUrl = null;
      let originalFileName = '';

      if (editNewFile) {
        const fileToUpload = await compressImage(editNewFile);
        const fileExt = editNewFile.name.split('.').pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExt}`;
        const filePath = `board_files/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('attachments')
          .upload(filePath, fileToUpload);

        if (uploadError) {
          throw new Error('첨부파일 업로드 실패: ' + uploadError.message);
        }

        const { data: urlData } = supabase.storage.from('attachments').getPublicUrl(filePath);
        filePublicUrl = urlData?.publicUrl;
        originalFileName = editNewFile.name;
      } else if (editExistingAttachment) {
        filePublicUrl = editExistingAttachment.url;
        originalFileName = editExistingAttachment.name;
      }

      let finalContent = '';

      if (editCategory === 'HOMEWORK') {
        const bookDetails = editHomeworkList
          .filter((item) => item.bookTitle.trim() !== '')
          .map((item) => `📘 [${item.bookTitle}] ${item.range}`)
          .join('\n');

        const formLinkText = editGoogleFormUrl.trim() ? `\n\n📋 구글 폼 링크: ${editGoogleFormUrl.trim()}` : '';
        const memoText = editContent.trim() ? `\n\n📝 메모:\n${editContent.trim()}` : '';
        finalContent = `${bookDetails}${formLinkText}${memoText}`.trim();
      } else if (editCategory === 'VIDEO') {
        const ytLink = editYoutubeUrl.trim();
        const descText = editContent.trim() ? `\n\n${editContent.trim()}` : '';
        finalContent = `${ytLink}${descText}`.trim();
      } else {
        // NOTICE 또는 MATERIAL
        finalContent = editContent.trim();
      }

      if (filePublicUrl) {
        finalContent += `\n\n📎 첨부파일: ${filePublicUrl} | ${originalFileName}`;
      }

      const matchedClass = classes.find((c) => String(c.id) === String(editTargetClassId));
      const validClassId = (editTargetClassId === 'ALL_STUDENTS' || !matchedClass) ? null : matchedClass.id;

      const updateData = {
        title: editTitle.trim(),
        content: finalContent,
        category: editCategory,
        class_id: validClassId,
        due_date: editCategory === 'HOMEWORK' ? editDueDate : null,
      };

      const { error } = await supabase.from('posts').update(updateData).eq('id', editingPost.id);
      if (error) throw error;

      alert('게시글이 성공적으로 수정되었습니다.');
      setEditingPost(null);
      fetchPosts();
    } catch (err) {
      alert(`수정 실패: ${err.message}`);
    } finally {
      setEditUploading(false);
    }
  };

  const handleDeletePost = async (postId, postTitle) => {
    if (!confirm(`[${postTitle}] 게시글을 삭제하시겠습니까?`)) return;
    try {
      const { error } = await supabase.from('posts').delete().eq('id', postId);
      if (error) throw error;
      fetchPosts();
      alert('삭제되었습니다.');
    } catch (err) {
      alert(`삭제 실패: ${err.message}`);
    }
  };

  // 🎯 카테고리 & 반별 정밀 필터링 로직
  const visiblePosts = posts.filter((post) => {
    // 1. 접근 권한 필터
    if (user?.role === 'STUDENT') {
      // 학생은 학원 전체 공지(class_id === null) 또는 본인이 소속된 반의 글만 허용
      if (post.class_id !== null && !myClassIds.includes(post.class_id)) {
        return false;
      }
    } else {
      // 선생님(원장님 포함)은 학원 전체 공지 또는 본인 담당 반의 글만 허용
      const myClassIdList = myClasses.map((c) => c.id);
      if (post.class_id !== null && !myClassIdList.includes(post.class_id)) {
        return false;
      }
    }

    // 2. 반 탭 필터 (전체 반 탭 없음: [🌐 학원 전체 공지] vs [🎯 특정 반])
    if (selectedClassId === 'PUBLIC') {
      if (post.class_id !== null) return false;
    } else {
      if (String(post.class_id) !== String(selectedClassId)) return false;
    }

    // 3. 상단 3대 카테고리 필터
    if (category === 'NOTICE_HOMEWORK') {
      return post.category === 'HOMEWORK' || post.category === 'NOTICE';
    } else if (category === 'VIDEO') {
      return post.category === 'VIDEO';
    } else if (category === 'MATERIAL') {
      return post.category === 'MATERIAL';
    }

    return true;
  });

  // 🎯 특정 게시글의 확인자 및 미확인자 목록 계산
  const getPostConfirmStats = (post) => {
    let targetStudents = [];
    if (post.class_id) {
      const enrolledStudentIds = classStudents
        .filter((cs) => String(cs.class_id) === String(post.class_id))
        .map((cs) => cs.student_id);
      targetStudents = allStudents.filter((st) => enrolledStudentIds.includes(st.id));
    } else {
      targetStudents = allStudents;
    }

    const confirmedSet = confirmations[post.id] || new Set();
    const confirmedList = targetStudents.filter((st) => confirmedSet.has(st.id));
    const unconfirmedList = targetStudents.filter((st) => !confirmedSet.has(st.id));

    return { targetStudents, confirmedList, unconfirmedList };
  };

  if (loading) return <div className="p-8 text-center font-bold text-slate-500">게시판 로딩 중...</div>;

  return (
    <div className="min-h-screen bg-gray-50 pb-32 font-sans text-slate-800">
      
      {/* 헤더 */}
      <header className="bg-white border-b py-4 px-6 shadow-xs flex justify-between items-center sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <div
            onClick={() => router.push(user?.role === 'STUDENT' ? '/student/dashboard' : '/teacher/dashboard')}
            className="w-9 h-9 rounded-2xl bg-blue-600 text-white flex items-center justify-center text-sm font-black shadow-md shadow-blue-500/20 cursor-pointer"
          >
            품
          </div>
          <div>
            <h1
              onClick={() => router.push(user?.role === 'STUDENT' ? '/student/dashboard' : '/teacher/dashboard')}
              className="text-base font-black text-slate-800 cursor-pointer hover:text-blue-600 transition"
            >
              품수학 학원 게시판
            </h1>
            <p className="text-[11px] text-slate-400 font-semibold mt-0.5">
              {user?.role === 'STUDENT' ? '소속 반 공지 및 숙제를 확인하세요.' : `${user?.name} 선생님 담당 반 공지사항`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* 1:1 Q&A 바로가기 버튼 */}
          <button
            onClick={() => router.push('/qna')}
            className="text-xs bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 font-bold px-3.5 py-2 rounded-xl transition flex items-center gap-1.5"
          >
            <span>💬</span>
            <span className="hidden sm:inline">1:1 질의응답</span>
          </button>

          <button
            onClick={() => router.back()}
            className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-3 py-2 rounded-xl transition border border-slate-200"
          >
            ← 뒤로가기
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 mt-6 space-y-6">
        
        {/* 상단 탭 (스크롤 시에도 화면 상단에 착 붙어 유지되는 Sticky 탭 바) */}
        <div className="sticky top-[68px] z-20 bg-white/95 backdrop-blur-md p-3.5 sm:p-4 rounded-2xl border border-slate-200/90 shadow-md shadow-slate-900/5">
          <CategoryTabs
            category={category}
            setCategory={setCategory}
            selectedClassId={selectedClassId}
            setSelectedClassId={(clsId) => {
              setSelectedClassId(clsId);
              if (clsId === 'PUBLIC') {
                setTargetClassId('ALL_STUDENTS');
              } else {
                setTargetClassId(clsId);
              }
            }}
            myClasses={myClasses}
          />
        </div>

        {/* 선생님용 게시글 작성 폼 */}
        {user?.role !== 'STUDENT' && (
          <PostCreateForm
            user={user}
            myClasses={myClasses}
            targetClassId={targetClassId}
            setTargetClassId={setTargetClassId}
            newCategory={newCategory}
            setNewCategory={setNewCategory}
            dueDate={dueDate}
            setDueDate={setDueDate}
            title={title}
            setTitle={setTitle}
            content={content}
            setContent={setContent}
            googleFormUrl={googleFormUrl}
            setGoogleFormUrl={setGoogleFormUrl}
            homeworkList={homeworkList}
            handleAddBook={handleAddBook}
            handleRemoveBook={handleRemoveBook}
            handleBookChange={handleBookChange}
            setAttachedFile={setAttachedFile}
            handleCreatePost={handleCreatePost}
            uploading={uploading}
          />
        )}

        {/* 게시글 목록 */}
        <div className="space-y-4">
          {visiblePosts.length === 0 ? (
            <div className="bg-white p-12 rounded-2xl text-center border border-slate-200 shadow-xs space-y-2">
              <span className="text-3xl">📭</span>
              <p className="text-sm font-bold text-slate-700">해당 조건의 게시글이 없습니다.</p>
              <p className="text-xs text-slate-400">새로운 공지나 숙제가 등록되면 여기에 표시됩니다.</p>
            </div>
          ) : (
            visiblePosts.map((post) => {
              const matchedClassName = post.classes?.name || classes.find((c) => String(c.id) === String(post.class_id))?.name || '학원 전체 공지';
              const isPublic = !post.class_id;
              const authorName = post.users?.name || '선생님';
              const rawContent = post.content || '';
              const ytId = getYouTubeId(rawContent);
              const attachment = extractAttachment(rawContent);

              const { confirmedList, unconfirmedList } = getPostConfirmStats(post);
              const isStudentConfirmed = user?.role === 'STUDENT' && confirmations[post.id]?.has(user.id);

              return (
                <div key={post.id} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                  <div className="flex justify-between items-start gap-2">
                    <div className="space-y-1 flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={isPublic ? 'text-xs sm:text-sm font-black px-3.5 py-1 rounded-full border bg-slate-100 text-slate-700 border-slate-200 whitespace-nowrap' : 'text-xs sm:text-sm font-black px-3.5 py-1 rounded-full border bg-indigo-50 text-indigo-700 border-indigo-100 whitespace-nowrap'}>
                          {isPublic ? '🌐 학원 전체 공지' : ('🎯 [' + matchedClassName + ']')}
                        </span>
                        <span className="bg-slate-100 text-slate-600 text-xs sm:text-sm font-black px-3.5 py-1 rounded-full whitespace-nowrap">
                          {post.category === 'NOTICE' && '📢 일반 공지'}
                          {post.category === 'HOMEWORK' && '📝 숙제 공지'}
                          {post.category === 'VIDEO' && '🎥 복습 영상'}
                          {post.category === 'MATERIAL' && '📁 수업 자료'}
                        </span>
                        <span className="text-xs sm:text-sm text-slate-500 font-bold ml-1 whitespace-nowrap">
                          작성자: {authorName} • {new Date(post.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <h3 className="text-lg sm:text-2xl font-black text-slate-900 pt-1 leading-snug tracking-tight break-words">{post.title}</h3>
                    </div>

                    {user?.role !== 'STUDENT' && (
                      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 whitespace-nowrap">
                        {post.category === 'HOMEWORK' && (
                          <button
                            onClick={() => handleSendManualReminder(post)}
                            className="text-xs bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 font-bold px-2.5 py-1 rounded-lg transition flex items-center gap-1 shadow-2xs shrink-0 whitespace-nowrap"
                            title="해당 반 학생들에게 마감 리마인드 알림 발송"
                          >
                            <span>⏰</span>
                            <span className="hidden sm:inline">마감 알림 전송</span>
                          </button>
                        )}
                        <button
                          onClick={() => handleOpenEdit(post)}
                          className="text-xs text-slate-600 hover:text-indigo-600 font-bold px-2.5 py-1 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 shrink-0 whitespace-nowrap transition"
                        >
                          수정
                        </button>
                        <button
                          onClick={() => handleDeletePost(post.id, post.title)}
                          className="text-xs text-rose-500 hover:text-rose-700 font-bold px-2 py-1 shrink-0 whitespace-nowrap transition"
                        >
                          삭제
                        </button>
                      </div>
                    )}
                  </div>

                  {/* 🎯 구글 폼 제출 대형 바로가기 버튼 */}
                  {extractGoogleFormUrl(rawContent) && (
                    <div className="pt-1">
                      <a
                        href={extractGoogleFormUrl(rawContent)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2.5 bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 hover:from-purple-700 hover:to-indigo-700 text-white px-5 py-3 rounded-2xl font-black text-sm sm:text-base shadow-md shadow-purple-600/20 transition transform hover:scale-[1.01]"
                      >
                        <span className="text-lg">📋</span>
                        <span>구글 폼으로 숙제 제출하기</span>
                        <span className="text-xs opacity-80">↗</span>
                      </a>
                    </div>
                  )}

                  {/* 🎯 빈 메모 및 링크가 깔끔하게 정리된 본문 */}
                  {cleanContentForDisplay(rawContent) && (
                    <div className="text-base sm:text-lg text-slate-800 leading-relaxed sm:leading-loose whitespace-pre-wrap bg-slate-50/90 p-5 sm:p-6 rounded-2xl border border-slate-200 font-semibold">
                      {cleanContentForDisplay(rawContent)}
                    </div>
                  )}

                  {/* 🎬 유튜브 영상 자동 임베드 */}
                  {ytId && (
                    <div className="aspect-video w-full rounded-xl overflow-hidden shadow-xs border border-slate-200 bg-black">
                      <iframe
                        src={'https://www.youtube.com/embed/' + ytId}
                        title="수업 복습 영상"
                        className="w-full h-full border-0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      ></iframe>
                    </div>
                  )}

                  {/* 마감일 & 자료 다운로드 링크 & 읽음 확인 영역 */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
                    <div className="flex flex-wrap items-center gap-2.5 text-xs">
                      {post.due_date && (
                        <span className="bg-amber-50 text-amber-800 border border-amber-200 px-3 py-1 rounded-xl font-bold">
                          ⏰ 제출 마감일: {post.due_date}
                        </span>
                      )}

                      {attachment && (
                        <a
                          href={attachment.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-300 px-3.5 py-2 rounded-xl font-black transition text-xs sm:text-sm shadow-xs group max-w-full"
                          title="클릭하여 파일 다운로드 / 열기"
                        >
                          <span className="text-base">📄</span>
                          <span className="truncate max-w-[170px] sm:max-w-[280px] text-emerald-950 underline underline-offset-2">
                            {attachment.name}
                          </span>
                          <span className="bg-emerald-200/80 text-emerald-900 text-[10px] sm:text-[11px] px-2 py-0.5 rounded-lg shrink-0 font-bold">
                            받기 ⬇️
                          </span>
                        </a>
                      )}
                    </div>

                    {/* 🎯 3번 요구사항: 게시글 읽음 확인 UI */}
                    <div>
                      {user?.role === 'STUDENT' ? (
                        /* 학생: [확인했습니다] 토글 버튼 */
                        <button
                          onClick={() => handleToggleConfirm(post.id)}
                          className={`text-sm sm:text-base font-black px-5 py-2.5 rounded-2xl transition flex items-center gap-2 shadow-sm ${
                            isStudentConfirmed
                              ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm'
                              : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200'
                          }`}
                        >
                          <span>{isStudentConfirmed ? '✅ 확인 완료' : '⬜'}</span>
                          <span>{isStudentConfirmed ? '(클릭 시 취소)' : '확인했습니다'}</span>
                        </button>
                      ) : (
                        /* 선생님: [확인 N명 / 미확인 N명] 클릭 시 상세 명단 모달 */
                        <button
                          onClick={() => setActiveConfirmModalPost(post)}
                          className="text-sm bg-slate-100 hover:bg-slate-200 text-slate-800 font-black px-4 py-2.5 rounded-2xl transition border border-slate-200 flex items-center gap-2"
                        >
                          <span>👀 읽음 현황:</span>
                          <span className="text-emerald-700 font-extrabold">확인 {confirmedList.length}명</span>
                          <span className="text-slate-300">/</span>
                          <span className="text-rose-600 font-extrabold">미확인 {unconfirmedList.length}명</span>
                          <span className="text-[10px] text-slate-400">상세보기 ↗</span>
                        </button>
                      )}
                    </div>

                  </div>
                </div>
              );
            })
          )}
        </div>

      </main>

      {/* 🎯 3번 요구사항: 선생님용 확인/미확인 학생 명단 모달 */}
      {activeConfirmModalPost && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-3xl p-6 w-full max-w-lg space-y-5 shadow-2xl animate-in fade-in zoom-in-95 my-8">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div>
                <span className="text-[10px] font-bold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md">
                  {activeConfirmModalPost.class_id ? '반별 공지' : '학원 전체 공지'}
                </span>
                <h3 className="text-base font-black text-slate-800 pt-1">
                  [{activeConfirmModalPost.title}] 읽음 확인 현황
                </h3>
              </div>
              <button
                onClick={() => setActiveConfirmModalPost(null)}
                className="text-slate-400 hover:text-slate-600 font-bold text-xs"
              >
                ✕ 닫기
              </button>
            </div>

            {(() => {
              const { confirmedList, unconfirmedList } = getPostConfirmStats(activeConfirmModalPost);
              const postDates = confirmationDates[activeConfirmModalPost.id] || {};

              return (
                <div className="space-y-4">
                  {/* 확인한 학생 목록 */}
                  <div className="bg-emerald-50/70 p-4 rounded-2xl border border-emerald-200/80 space-y-2">
                    <h4 className="text-xs font-black text-emerald-900 flex items-center justify-between">
                      <span>✅ 공지를 확인한 학생</span>
                      <span className="bg-emerald-200 text-emerald-900 px-2 py-0.5 rounded-full text-[10px]">
                        {confirmedList.length}명
                      </span>
                    </h4>
                    {confirmedList.length === 0 ? (
                      <p className="text-xs text-emerald-700/80 py-2 text-center">아직 확인한 학생이 없습니다.</p>
                    ) : (
                      <div className="grid grid-cols-2 gap-2 pt-1 max-h-36 overflow-y-auto">
                        {confirmedList.map((st) => (
                          <div key={st.id} className="bg-white p-2 rounded-xl border border-emerald-100 text-xs font-bold text-slate-800 flex justify-between items-center">
                            <span>👤 {st.name}</span>
                            <span className="text-[10px] text-emerald-600 font-medium">
                              {postDates[st.id] ? new Date(postDates[st.id]).toLocaleDateString() : '확인됨'}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* 미확인 학생 목록 */}
                  <div className="bg-rose-50/70 p-4 rounded-2xl border border-rose-200/80 space-y-2">
                    <h4 className="text-xs font-black text-rose-900 flex items-center justify-between">
                      <span>⏳ 아직 확인하지 않은 학생</span>
                      <span className="bg-rose-200 text-rose-900 px-2 py-0.5 rounded-full text-[10px]">
                        {unconfirmedList.length}명
                      </span>
                    </h4>
                    {unconfirmedList.length === 0 ? (
                      <p className="text-xs text-emerald-700 py-2 text-center font-bold">🎉 모든 대상 학생이 확인했습니다!</p>
                    ) : (
                      <div className="grid grid-cols-2 gap-2 pt-1 max-h-36 overflow-y-auto">
                        {unconfirmedList.map((st) => (
                          <div key={st.id} className="bg-white p-2 rounded-xl border border-rose-100 text-xs font-bold text-slate-800 flex items-center gap-1.5">
                            <span className="text-rose-500">⚪</span>
                            <span>{st.name}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            <button
              onClick={() => setActiveConfirmModalPost(null)}
              className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 py-2.5 rounded-2xl text-xs font-bold transition"
            >
              닫기
            </button>
          </div>
        </div>
      )}

      {/* 수정 모달 */}
      {editingPost && (
        <PostEditModal
          editingPost={editingPost}
          setEditingPost={setEditingPost}
          myClasses={myClasses}
          editTargetClassId={editTargetClassId}
          setEditTargetClassId={setEditTargetClassId}
          editCategory={editCategory}
          setEditCategory={setEditCategory}
          editDueDate={editDueDate}
          setEditDueDate={setEditDueDate}
          editTitle={editTitle}
          setEditTitle={setEditTitle}
          editContent={editContent}
          setEditContent={setEditContent}
          editYoutubeUrl={editYoutubeUrl}
          setEditYoutubeUrl={setEditYoutubeUrl}
          editGoogleFormUrl={editGoogleFormUrl}
          setEditGoogleFormUrl={setEditGoogleFormUrl}
          editHomeworkList={editHomeworkList}
          handleEditAddBook={handleEditAddBook}
          handleEditRemoveBook={handleEditRemoveBook}
          handleEditBookChange={handleEditBookChange}
          editExistingAttachment={editExistingAttachment}
          setEditExistingAttachment={setEditExistingAttachment}
          editNewFile={editNewFile}
          setEditNewFile={setEditNewFile}
          editUploading={editUploading}
          handleUpdatePost={handleUpdatePost}
        />
      )}
    </div>
  );
}


export default function BoardPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center font-bold text-slate-500">게시판 로딩 중...</div>}>
      <BoardMain />
    </Suspense>
  );
}
