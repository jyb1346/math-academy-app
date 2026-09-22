// 특정 학생이 이 교사의 담당 범위(직속 teacher_id 또는 본인 반에 배정됨)에 있는지 확인
export async function isStudentInTeacherScope(db, teacherId, studentId) {
  const { data: student } = await db.from('users').select('id, teacher_id').eq('id', studentId).maybeSingle();
  if (!student) return false;
  if (student.teacher_id === teacherId) return true;

  const { data: myClasses } = await db.from('classes').select('id').eq('teacher_id', teacherId);
  const myClassIds = (myClasses || []).map((c) => c.id);
  if (myClassIds.length === 0) return false;

  const { data: enrolled } = await db
    .from('class_students')
    .select('class_id')
    .eq('student_id', studentId)
    .in('class_id', myClassIds);

  return Boolean(enrolled && enrolled.length > 0);
}
