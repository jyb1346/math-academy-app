/**
 * 📐 고등 수학 스피드 퀴즈 카탈로그
 * 📐 고등 수학 스피드 퀴즈 카탈로그 (총 40제)
 * - 현재 활성화 단원: [고1 도형의 방정식] (평면좌표, 직선의 방정식, 원의 방정식, 도형의 이동)
 * - 3~5초 이내에 직관적 암산/개념으로 풀 수 있는 4지선다형 스피드 퀴즈 모음
 * - Level 1 (기초 개념 20제): 정답 시 2배 크리티컬 데미지 (multiplier: 2)
 * - Level 2 (응용 직관 20제): 정답 시 3배 슈퍼 크리티컬 데미지 (multiplier: 3)
 */

export const ACTIVE_MATH_CHAPTER = {
  id: 'GEOMETRY_EQUATIONS',
  title: '고1 도형의 방정식',
  subUnits: ['평면좌표', '직선의 방정식', '원의 방정식', '도형의 이동'],
};

export const MATH_QUIZ_BANK = [
  // 🟢 1. 평면좌표
  // ==========================================
  // ⚡ [Level 1] 기초 개념 암산 퀴즈 (2배 데미지) - 20제
  // ==========================================

  // 🟢 1. 평면좌표 (기초 5제)
  {
    id: 'geo_1',
    category: '평면좌표',
    level: 1,
    multiplier: 2,
    difficulty: '기초',
    question: '원점 (0, 0)과 점 (3, 4) 사이의 거리는?',
    options: ['4', '5', '6', '7'],
    answerIndex: 1, // '5'
    explanation: '√(3² + 4²) = √25 = 5',
  },
  {
    id: 'geo_2',
    category: '평면좌표',
    level: 1,
    multiplier: 2,
    difficulty: '기초',
    question: '두 점 A(1, 2)와 B(5, 6)의 중점의 좌표는?',
    options: ['(2, 3)', '(3, 4)', '(4, 5)', '(3, 5)'],
    answerIndex: 1, // '(3, 4)'
    explanation: '((1+5)/2, (2+6)/2) = (3, 4)',
  },
  {
    id: 'geo_3',
    category: '평면좌표',
    level: 1,
    multiplier: 2,
    difficulty: '기초',
    question: '세 점 (1, 2), (2, 4), (6, 3)으로 이루어진 삼각형의 무게중심 x좌표는?',
    options: ['2', '3', '4', '5'],
    answerIndex: 1, // '3'
    explanation: '(1 + 2 + 6) / 3 = 3',
  },
  {
    id: 'geo_4',
    category: '평면좌표',
    level: 1,
    multiplier: 2,
    difficulty: '기초',
    question: '두 점 (0, 0)과 (6, 8) 사이의 거리는?',
    options: ['8', '9', '10', '12'],
    answerIndex: 2, // '10'
    explanation: '√(6² + 8²) = √100 = 10',
  },
  {
    id: 'geo_5',
    category: '평면좌표',
    level: 1,
    multiplier: 2,
    difficulty: '기초',
    question: '두 점 (2, 0)과 (8, 0)의 1:2 내분점의 x좌표는?',
    options: ['3', '4', '5', '6'],
    answerIndex: 1, // '4'
    explanation: '(1×8 + 2×2) / (1+2) = 12/3 = 4',
  },

  // 🔵 2. 직선의 방정식
  // 🔵 2. 직선의 방정식 (기초 5제)
  {
    id: 'geo_6',
    category: '직선의 방정식',
    level: 1,
    multiplier: 2,
    difficulty: '기초',
    question: '직선 y = 2x + 1 에 수직인 직선의 기울기는?',
    options: ['2', '1/2', '-1/2', '-2'],
    answerIndex: 2, // '-1/2'
    explanation: '수직인 두 직선의 기울기의 곱은 -1이므로 -1/2',
  },
  {
    id: 'geo_7',
    category: '직선의 방정식',
    level: 1,
    multiplier: 2,
    difficulty: '기초',
    question: '직선 3x - y + 5 = 0 의 기울기는?',
    options: ['-3', '3', '1/3', '5'],
    answerIndex: 1, // '3'
    explanation: 'y = 3x + 5 이므로 기울기는 3',
  },
  {
    id: 'geo_8',
    category: '직선의 방정식',
    level: 1,
    multiplier: 2,
    difficulty: '기초',
    question: '원점 (0, 0)과 직선 3x + 4y - 10 = 0 사이의 거리는?',
    options: ['1', '2', '3', '5/2'],
    answerIndex: 1, // '2'
    explanation: '| -10 | / √(3² + 4²) = 10 / 5 = 2',
  },
  {
    id: 'geo_9',
    category: '직선의 방정식',
    level: 1,
    multiplier: 2,
    difficulty: '기초',
    question: '직선 y = 3x + 2 에 평행한 직선의 기울기는?',
    options: ['-3', '1/3', '3', '-1/3'],
    answerIndex: 2, // '3'
    explanation: '평행한 두 직선은 기울기가 서로 같습니다 (3)',
  },
  {
    id: 'geo_10',
    category: '직선의 방정식',
    level: 1,
    multiplier: 2,
    difficulty: '기초',
    question: '직선 2x + y - 4 = 0 의 y절편은?',
    options: ['2', '4', '-4', '-2'],
    answerIndex: 1, // '4'
    explanation: 'x = 0 일 때 y = 4',
  },

  // 🟣 3. 원의 방정식
  // 🟣 3. 원의 방정식 (기초 5제)
  {
    id: 'geo_11',
    category: '원의 방정식',
    level: 1,
    multiplier: 2,
    difficulty: '기초',
    question: '원 (x - 2)² + (y + 3)² = 16 의 반지름의 길이는?',
    options: ['2', '4', '8', '16'],
    answerIndex: 1, // '4'
    explanation: 'r² = 16 이므로 반지름 r = 4',
  },
  {
    id: 'geo_12',
    category: '원의 방정식',
    level: 1,
    multiplier: 2,
    difficulty: '기초',
    question: '원 (x + 1)² + (y - 5)² = 9 의 중심의 좌표는?',
    options: ['(-1, 5)', '(1, -5)', '(-1, -5)', '(1, 5)'],
    answerIndex: 0, // '(-1, 5)'
    explanation: '중심은 (-1, 5)',
  },
  {
    id: 'geo_13',
    category: '원의 방정식',
    level: 1,
    multiplier: 2,
    difficulty: '기초',
    question: '원 x² + y² = 25 위의 점 (3, 4)에서의 접선의 방정식은?',
    options: ['3x + 4y = 25', '4x + 3y = 25', '3x - 4y = 25', 'x + y = 25'],
    answerIndex: 0, // '3x + 4y = 25'
    explanation: 'x₁x + y₁y = r² 공식에 의해 3x + 4y = 25',
  },
  {
    id: 'geo_14',
    category: '원의 방정식',
    level: 1,
    multiplier: 2,
    difficulty: '기초',
    question: '중심이 원점 (0, 0)이고 점 (0, 3)을 지나는 원의 방정식은?',
    options: ['x² + y² = 3', 'x² + y² = 6', 'x² + y² = 9', 'x² + y² = 18'],
    answerIndex: 2, // 'x² + y² = 9'
    explanation: '반지름이 3이므로 x² + y² = 3² = 9',
  },
  {
    id: 'geo_15',
    category: '원의 방정식',
    level: 1,
    multiplier: 2,
    difficulty: '기초',
    question: '원 x² + y² = 4 의 지름의 길이는?',
    options: ['2', '4', '8', '16'],
    answerIndex: 1, // '4'
    explanation: '반지름 r = 2 이므로 지름은 4',
  },

  // 🟡 4. 도형의 이동
  // 🟡 4. 도형의 이동 (기초 5제)
  {
    id: 'geo_16',
    category: '도형의 이동',
    level: 1,
    multiplier: 2,
    difficulty: '기초',
    question: '점 (3, -2)를 x축에 대하여 대칭이동한 점의 좌표는?',
    options: ['(3, 2)', '(-3, -2)', '(-3, 2)', '(2, -3)'],
    answerIndex: 0, // '(3, 2)'
    explanation: 'x축 대칭은 y의 부호를 바꿉니다 -> (3, 2)',
  },
  {
    id: 'geo_17',
    category: '도형의 이동',
    level: 1,
    multiplier: 2,
    difficulty: '기초',
    question: '점 (4, 1)을 직선 y = x 에 대하여 대칭이동한 점의 좌표는?',
    options: ['(-4, -1)', '(1, 4)', '(-1, -4)', '(4, -1)'],
    answerIndex: 1, // '(1, 4)'
    explanation: 'y = x 대칭은 x와 y의 위치를 바꿉니다 -> (1, 4)',
  },
  {
    id: 'geo_18',
    category: '도형의 이동',
    level: 1,
    multiplier: 2,
    difficulty: '기초',
    question: '점 (2, 5)를 x축 방향으로 +1, y축 방향으로 -3 평행이동한 점은?',
    options: ['(1, 8)', '(3, 2)', '(3, 8)', '(1, 2)'],
    answerIndex: 1, // '(3, 2)'
    explanation: '(2 + 1, 5 - 3) = (3, 2)',
  },
  {
    id: 'geo_19',
    category: '도형의 이동',
    level: 1,
    multiplier: 2,
    difficulty: '기초',
    question: '점 (-2, 3)을 원점에 대하여 대칭이동한 점의 좌표는?',
    options: ['(2, -3)', '(-2, -3)', '(2, 3)', '(3, -2)'],
    answerIndex: 0, // '(2, -3)'
    explanation: '원점 대칭은 x, y 둘 다 부호를 바꿉니다 -> (2, -3)',
  },
  {
    id: 'geo_20',
    category: '도형의 이동',
    level: 1,
    multiplier: 2,
    difficulty: '기초',
    question: '점 (5, -1)을 y축에 대하여 대칭이동한 점의 좌표는?',
    options: ['(5, 1)', '(-5, -1)', '(-5, 1)', '(-1, 5)'],
    answerIndex: 1, // '(-5, -1)'
    explanation: 'y축 대칭은 x의 부호를 바꿉니다 -> (-5, -1)',
  },

  // ==========================================
  // 🔥 [Level 2] 응용 직관 계산 퀴즈 (3배 슈퍼 크리티컬 데미지) - 20제
  // ==========================================

  // 🟢 1. 평면좌표 (응용 5제)
  {
    id: 'geo_app_1',
    category: '평면좌표',
    level: 2,
    multiplier: 3,
    difficulty: '응용',
    question: '두 점 A(-1, 2)와 B(3, 10)을 3:1로 외분하는 점의 x좌표는?',
    options: ['4', '5', '6', '7'],
    answerIndex: 1, // '5'
    explanation: '(3×3 - 1×(-1)) / (3-1) = 10 / 2 = 5',
  },
  {
    id: 'geo_app_2',
    category: '평면좌표',
    level: 2,
    multiplier: 3,
    difficulty: '응용',
    question: '두 점 A(2, 4), B(6, 8)을 이은 선분 AB의 수직이등분선의 기울기는?',
    options: ['-1', '1', '-1/2', '2'],
    answerIndex: 0, // '-1'
    explanation: 'AB의 기울기가 1이므로 수직인 직선의 기울기는 -1',
  },
  {
    id: 'geo_app_3',
    category: '평면좌표',
    level: 2,
    multiplier: 3,
    difficulty: '응용',
    question: '두 점 (1, 1)과 (4, 5) 사이의 거리는?',
    options: ['4', '5', '6', '√41'],
    answerIndex: 1, // '5'
    explanation: '√((4-1)² + (5-1)²) = √(3² + 4²) = 5',
  },
  {
    id: 'geo_app_4',
    category: '평면좌표',
    level: 2,
    multiplier: 3,
    difficulty: '응용',
    question: '두 점 A(a, 2)와 B(3, 6) 사이의 거리가 5일 때, 양수 a의 값은?',
    options: ['4', '5', '6', '7'],
    answerIndex: 2, // '6'
    explanation: '(3-a)² + 4² = 5² → (3-a)² = 9 → 3-a = -3 (양수 a) → a = 6',
  },
  {
    id: 'geo_app_5',
    category: '평면좌표',
    level: 2,
    multiplier: 3,
    difficulty: '응용',
    question: '세 점 A(2, 3), B(4, 7), C(x, y)의 무게중심이 (3, 4)일 때, 꼭짓점 C의 좌표는?',
    options: ['(3, 2)', '(2, 3)', '(3, 3)', '(1, 2)'],
    answerIndex: 0, // '(3, 2)'
    explanation: 'x = 3×3 - (2+4) = 3, y = 3×4 - (3+7) = 2 → (3, 2)',
  },

  // 🔵 2. 직선의 방정식 (응용 5제)
  {
    id: 'geo_app_6',
    category: '직선의 방정식',
    level: 2,
    multiplier: 3,
    difficulty: '응용',
    question: '점 (1, 2)를 지나고 직선 2x - y + 3 = 0 에 평행한 직선의 방정식은?',
    options: ['2x - y = 0', '2x - y + 1 = 0', 'x - 2y + 3 = 0', '2x + y - 4 = 0'],
    answerIndex: 0, // '2x - y = 0'
    explanation: '기울기가 2이고 (1, 2)를 대입하면 2(1) - 2 = 0 성립 → 2x - y = 0',
  },
  {
    id: 'geo_app_7',
    category: '직선의 방정식',
    level: 2,
    multiplier: 3,
    difficulty: '응용',
    question: '직선 ax + 2y - 4 = 0 과 직선 2x + 3y + 1 = 0 이 서로 수직일 때 상수 a의 값은?',
    options: ['-3', '3', '-2', '2/3'],
    answerIndex: 0, // '-3'
    explanation: '수직 조건 a₁a₂ + b₁b₂ = 0 → 2a + 6 = 0 → a = -3',
  },
  {
    id: 'geo_app_8',
    category: '직선의 방정식',
    level: 2,
    multiplier: 3,
    difficulty: '응용',
    question: '점 (2, 3)과 직선 4x - 3y + 6 = 0 사이의 거리는?',
    options: ['1', '2', '3', '5'],
    answerIndex: 0, // '1'
    explanation: '|4(2) - 3(3) + 6| / √(4² + 3²) = |8 - 9 + 6| / 5 = 5 / 5 = 1',
  },
  {
    id: 'geo_app_9',
    category: '직선의 방정식',
    level: 2,
    multiplier: 3,
    difficulty: '응용',
    question: '두 평행한 직선 2x + y - 1 = 0 과 2x + y + 9 = 0 사이의 거리는?',
    options: ['2', '√5', '2√5', '10'],
    answerIndex: 2, // '2√5'
    explanation: '|9 - (-1)| / √(2² + 1²) = 10 / √5 = 2√5',
  },
  {
    id: 'geo_app_10',
    category: '직선의 방정식',
    level: 2,
    multiplier: 3,
    difficulty: '응용',
    question: '직선 x/3 + y/4 = 1 의 x절편과 y절편의 합은?',
    options: ['5', '6', '7', '12'],
    answerIndex: 2, // '7'
    explanation: 'x절편은 3, y절편은 4 이므로 합은 3 + 4 = 7',
  },

  // 🟣 3. 원의 방정식 (응용 5제)
  {
    id: 'geo_app_11',
    category: '원의 방정식',
    level: 2,
    multiplier: 3,
    difficulty: '응용',
    question: '원 x² + y² - 4x + 6y - 3 = 0 의 반지름의 길이는?',
    options: ['2', '4', '8', '16'],
    answerIndex: 1, // '4'
    explanation: '(x - 2)² + (y + 3)² = 3 + 4 + 9 = 16 이므로 반지름 r = 4',
  },
  {
    id: 'geo_app_12',
    category: '원의 방정식',
    level: 2,
    multiplier: 3,
    difficulty: '응용',
    question: '중심이 (2, 3)이고 x축에 접하는 원의 반지름의 길이는?',
    options: ['2', '3', '4', '9'],
    answerIndex: 1, // '3'
    explanation: 'x축에 접하는 원의 반지름은 중심의 y좌표 절댓값 |3| = 3',
  },
  {
    id: 'geo_app_13',
    category: '원의 방정식',
    level: 2,
    multiplier: 3,
    difficulty: '응용',
    question: '원 x² + y² = 10 과 직선 y = 3x + k 가 접할 때, 양수 k의 값은?',
    options: ['√10', '5', '10', '20'],
    answerIndex: 2, // '10'
    explanation: 'd = |k| / √(3² + (-1)²) = √10 → |k| = 10 → 양수 k = 10',
  },
  {
    id: 'geo_app_14',
    category: '원의 방정식',
    level: 2,
    multiplier: 3,
    difficulty: '응용',
    question: '두 점 A(0, 0)과 B(4, 6)을 지름의 양 끝점으로 하는 원의 중심의 좌표는?',
    options: ['(1, 2)', '(2, 3)', '(3, 2)', '(4, 6)'],
    answerIndex: 1, // '(2, 3)'
    explanation: '지름의 양 끝점의 중점이 원의 중심이므로 ((0+4)/2, (0+6)/2) = (2, 3)',
  },
  {
    id: 'geo_app_15',
    category: '원의 방정식',
    level: 2,
    multiplier: 3,
    difficulty: '응용',
    question: '원 x² + y² = 20 위의 점 (-2, 4)에서의 접선의 기울기는?',
    options: ['-2', '-1/2', '1/2', '2'],
    answerIndex: 2, // '1/2'
    explanation: '접선의 방정식 -2x + 4y = 20 → 4y = 2x + 20 → y = (1/2)x + 5 이므로 기울기는 1/2',
  },

  // 🟡 4. 도형의 이동 (응용 5제)
  {
    id: 'geo_app_16',
    category: '도형의 이동',
    level: 2,
    multiplier: 3,
    difficulty: '응용',
    question: '직선 2x - y + 1 = 0 을 x축에 대하여 대칭이동한 직선의 방정식은?',
    options: ['2x + y + 1 = 0', '-2x - y + 1 = 0', '2x + y - 1 = 0', 'x - 2y + 1 = 0'],
    answerIndex: 0, // '2x + y + 1 = 0'
    explanation: 'x축 대칭은 y 대신 -y 대입 → 2x - (-y) + 1 = 0 → 2x + y + 1 = 0',
  },
  {
    id: 'geo_app_17',
    category: '도형의 이동',
    level: 2,
    multiplier: 3,
    difficulty: '응용',
    question: '원 (x - 1)² + (y + 2)² = 5 를 직선 y = x 에 대하여 대칭이동한 원의 중심의 좌표는?',
    options: ['(-1, 2)', '(-2, 1)', '(2, -1)', '(1, -2)'],
    answerIndex: 1, // '(-2, 1)'
    explanation: '원래 중심 (1, -2)를 y = x 에 대칭이동하면 (-2, 1)',
  },
  {
    id: 'geo_app_18',
    category: '도형의 이동',
    level: 2,
    multiplier: 3,
    difficulty: '응용',
    question: '직선 y = 3x - 2 를 x축 방향으로 +1, y축 방향으로 +2 평행이동한 직선의 y절편은?',
    options: ['-3', '-2', '1', '3'],
    answerIndex: 0, // '-3'
    explanation: 'y - 2 = 3(x - 1) - 2 → y = 3x - 3 이므로 y절편은 -3',
  },
  {
    id: 'geo_app_19',
    category: '도형의 이동',
    level: 2,
    multiplier: 3,
    difficulty: '응용',
    question: '점 (3, 4)를 점 (1, 1)에 대하여 점대칭이동한 점의 좌표는?',
    options: ['(-1, -2)', '(-2, -1)', '(2, 3)', '(0, 0)'],
    answerIndex: 0, // '(-1, -2)'
    explanation: '2×(1, 1) - (3, 4) = (2 - 3, 2 - 4) = (-1, -2)',
  },
  {
    id: 'geo_app_20',
    category: '도형의 이동',
    level: 2,
    multiplier: 3,
    difficulty: '응용',
    question: '원 x² + y² = 4 를 원점에 대하여 대칭이동한 원의 넓이는?',
    options: ['2π', '4π', '8π', '16π'],
    answerIndex: 1, // '4π'
    explanation: '대칭이동을 해도 반지름(r=2)은 불변이므로 넓이는 πr² = 4π',
  },
];

/**
 * 🎲 무작위 스피드 퀴즈 추출기
 */
export function getRandomMathQuiz() {
  const idx = Math.floor(Math.random() * MATH_QUIZ_BANK.length);
  return MATH_QUIZ_BANK[idx];
}

