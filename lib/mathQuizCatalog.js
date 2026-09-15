/**
 * 📐 고등 수학 스피드 퀴즈 카탈로그
 * - 현재 활성화 단원: [고1 도형의 방정식] (평면좌표, 직선의 방정식, 원의 방정식, 도형의 이동)
 * - 3~5초 이내에 직관적 암산/개념으로 풀 수 있는 4지선다형 스피드 퀴즈 모음
 */

export const ACTIVE_MATH_CHAPTER = {
  id: 'GEOMETRY_EQUATIONS',
  title: '고1 도형의 방정식',
  subUnits: ['평면좌표', '직선의 방정식', '원의 방정식', '도형의 이동'],
};

export const MATH_QUIZ_BANK = [
  // 🟢 1. 평면좌표
  {
    id: 'geo_1',
    category: '평면좌표',
    question: '원점 (0, 0)과 점 (3, 4) 사이의 거리는?',
    options: ['4', '5', '6', '7'],
    answerIndex: 1, // '5'
    explanation: '√(3² + 4²) = √25 = 5',
  },
  {
    id: 'geo_2',
    category: '평면좌표',
    question: '두 점 A(1, 2)와 B(5, 6)의 중점의 좌표는?',
    options: ['(2, 3)', '(3, 4)', '(4, 5)', '(3, 5)'],
    answerIndex: 1, // '(3, 4)'
    explanation: '((1+5)/2, (2+6)/2) = (3, 4)',
  },
  {
    id: 'geo_3',
    category: '평면좌표',
    question: '세 점 (1, 2), (2, 4), (6, 3)으로 이루어진 삼각형의 무게중심 x좌표는?',
    options: ['2', '3', '4', '5'],
    answerIndex: 1, // '3'
    explanation: '(1 + 2 + 6) / 3 = 3',
  },
  {
    id: 'geo_4',
    category: '평면좌표',
    question: '두 점 (0, 0)과 (6, 8) 사이의 거리는?',
    options: ['8', '9', '10', '12'],
    answerIndex: 2, // '10'
    explanation: '√(6² + 8²) = √100 = 10',
  },
  {
    id: 'geo_5',
    category: '평면좌표',
    question: '두 점 (2, 0)과 (8, 0)의 1:2 내분점의 x좌표는?',
    options: ['3', '4', '5', '6'],
    answerIndex: 1, // '4'
    explanation: '(1×8 + 2×2) / (1+2) = 12/3 = 4',
  },

  // 🔵 2. 직선의 방정식
  {
    id: 'geo_6',
    category: '직선의 방정식',
    question: '직선 y = 2x + 1 에 수직인 직선의 기울기는?',
    options: ['2', '1/2', '-1/2', '-2'],
    answerIndex: 2, // '-1/2'
    explanation: '수직인 두 직선의 기울기의 곱은 -1이므로 -1/2',
  },
  {
    id: 'geo_7',
    category: '직선의 방정식',
    question: '직선 3x - y + 5 = 0 의 기울기는?',
    options: ['-3', '3', '1/3', '5'],
    answerIndex: 1, // '3'
    explanation: 'y = 3x + 5 이므로 기울기는 3',
  },
  {
    id: 'geo_8',
    category: '직선의 방정식',
    question: '원점 (0, 0)과 직선 3x + 4y - 10 = 0 사이의 거리는?',
    options: ['1', '2', '3', '5/2'],
    answerIndex: 1, // '2'
    explanation: '| -10 | / √(3² + 4²) = 10 / 5 = 2',
  },
  {
    id: 'geo_9',
    category: '직선의 방정식',
    question: '직선 y = 3x + 2 에 평행한 직선의 기울기는?',
    options: ['-3', '1/3', '3', '-1/3'],
    answerIndex: 2, // '3'
    explanation: '평행한 두 직선은 기울기가 서로 같습니다 (3)',
  },
  {
    id: 'geo_10',
    category: '직선의 방정식',
    question: '직선 2x + y - 4 = 0 의 y절편은?',
    options: ['2', '4', '-4', '-2'],
    answerIndex: 1, // '4'
    explanation: 'x = 0 일 때 y = 4',
  },

  // 🟣 3. 원의 방정식
  {
    id: 'geo_11',
    category: '원의 방정식',
    question: '원 (x - 2)² + (y + 3)² = 16 의 반지름의 길이는?',
    options: ['2', '4', '8', '16'],
    answerIndex: 1, // '4'
    explanation: 'r² = 16 이므로 반지름 r = 4',
  },
  {
    id: 'geo_12',
    category: '원의 방정식',
    question: '원 (x + 1)² + (y - 5)² = 9 의 중심의 좌표는?',
    options: ['(-1, 5)', '(1, -5)', '(-1, -5)', '(1, 5)'],
    answerIndex: 0, // '(-1, 5)'
    explanation: '중심은 (-1, 5)',
  },
  {
    id: 'geo_13',
    category: '원의 방정식',
    question: '원 x² + y² = 25 위의 점 (3, 4)에서의 접선의 방정식은?',
    options: ['3x + 4y = 25', '4x + 3y = 25', '3x - 4y = 25', 'x + y = 25'],
    answerIndex: 0, // '3x + 4y = 25'
    explanation: 'x₁x + y₁y = r² 공식에 의해 3x + 4y = 25',
  },
  {
    id: 'geo_14',
    category: '원의 방정식',
    question: '중심이 원점 (0, 0)이고 점 (0, 3)을 지나는 원의 방정식은?',
    options: ['x² + y² = 3', 'x² + y² = 6', 'x² + y² = 9', 'x² + y² = 18'],
    answerIndex: 2, // 'x² + y² = 9'
    explanation: '반지름이 3이므로 x² + y² = 3² = 9',
  },
  {
    id: 'geo_15',
    category: '원의 방정식',
    question: '원 x² + y² = 4 의 지름의 길이는?',
    options: ['2', '4', '8', '16'],
    answerIndex: 1, // '4'
    explanation: '반지름 r = 2 이므로 지름은 4',
  },

  // 🟡 4. 도형의 이동
  {
    id: 'geo_16',
    category: '도형의 이동',
    question: '점 (3, -2)를 x축에 대하여 대칭이동한 점의 좌표는?',
    options: ['(3, 2)', '(-3, -2)', '(-3, 2)', '(2, -3)'],
    answerIndex: 0, // '(3, 2)'
    explanation: 'x축 대칭은 y의 부호를 바꿉니다 -> (3, 2)',
  },
  {
    id: 'geo_17',
    category: '도형의 이동',
    question: '점 (4, 1)을 직선 y = x 에 대하여 대칭이동한 점의 좌표는?',
    options: ['(-4, -1)', '(1, 4)', '(-1, -4)', '(4, -1)'],
    answerIndex: 1, // '(1, 4)'
    explanation: 'y = x 대칭은 x와 y의 위치를 바꿉니다 -> (1, 4)',
  },
  {
    id: 'geo_18',
    category: '도형의 이동',
    question: '점 (2, 5)를 x축 방향으로 +1, y축 방향으로 -3 평행이동한 점은?',
    options: ['(1, 8)', '(3, 2)', '(3, 8)', '(1, 2)'],
    answerIndex: 1, // '(3, 2)'
    explanation: '(2 + 1, 5 - 3) = (3, 2)',
  },
  {
    id: 'geo_19',
    category: '도형의 이동',
    question: '점 (-2, 3)을 원점에 대하여 대칭이동한 점의 좌표는?',
    options: ['(2, -3)', '(-2, -3)', '(2, 3)', '(3, -2)'],
    answerIndex: 0, // '(2, -3)'
    explanation: '원점 대칭은 x, y 둘 다 부호를 바꿉니다 -> (2, -3)',
  },
  {
    id: 'geo_20',
    category: '도형의 이동',
    question: '점 (5, -1)을 y축에 대하여 대칭이동한 점의 좌표는?',
    options: ['(5, 1)', '(-5, -1)', '(-5, 1)', '(-1, 5)'],
    answerIndex: 1, // '(-5, -1)'
    explanation: 'y축 대칭은 x의 부호를 바꿉니다 -> (-5, -1)',
  },
];

/**
 * 🎲 무작위 스피드 퀴즈 추출기
 */
export function getRandomMathQuiz() {
  const idx = Math.floor(Math.random() * MATH_QUIZ_BANK.length);
  return MATH_QUIZ_BANK[idx];
}

