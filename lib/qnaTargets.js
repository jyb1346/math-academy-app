// 학생이 질문을 보낼 수 있는 담당 선생님 목록 계산 (반 배정 기반 + 직접 지정 teacher_id + 예외 fallback)
export async function computeAvailableTargets(db, student) {
  const [{ data: uData }, { data: csData }, { data: clsData }] = await Promise.all([
    db.from('users').select('id, name, role, teacher_id'),
    db.from('class_students').select('class_id').eq('student_id', student.id),
    db.from('classes').select('id, name, teacher_id'),
  ]);

  const tList = (uData || []).filter((u) => u.role === 'TEACHER' || u.role === 'HEAD_TEACHER');
  const teacherNameMap = {};
  tList.forEach((t) => { teacherNameMap[t.id] = t.name; });

  const classMap = {};
  (clsData || []).forEach((c) => { classMap[c.id] = c; });

  const targets = [];
  const seenKeys = new Set();

  (csData || []).forEach((cs) => {
    const cls = classMap[cs.class_id];
    if (cls && cls.teacher_id && teacherNameMap[cls.teacher_id]) {
      const key = `cls_${cls.id}`;
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        targets.push({
          key,
          teacherId: cls.teacher_id,
          teacherName: teacherNameMap[cls.teacher_id],
          classId: cls.id,
          className: cls.name,
          label: `${teacherNameMap[cls.teacher_id]} 선생님 (${cls.name})`,
        });
      }
    }
  });

  if (student.teacher_id && teacherNameMap[student.teacher_id]) {
    const key = `tch_${student.teacher_id}`;
    const alreadyHasTeacher = targets.some((t) => t.teacherId === student.teacher_id);
    if (!alreadyHasTeacher && !seenKeys.has(key)) {
      seenKeys.add(key);
      targets.push({
        key,
        teacherId: student.teacher_id,
        teacherName: teacherNameMap[student.teacher_id],
        classId: null,
        className: null,
        label: `${teacherNameMap[student.teacher_id]} 선생님 (담당 강사)`,
      });
    }
  }

  if (targets.length === 0 && tList.length > 0) {
    tList.forEach((t) => {
      targets.push({
        key: `all_tch_${t.id}`,
        teacherId: t.id,
        teacherName: t.name,
        classId: null,
        className: null,
        label: `${t.name} 선생님`,
      });
    });
  }

  return { targets, teachersList: tList.map((t) => ({ id: t.id, name: t.name })) };
}
