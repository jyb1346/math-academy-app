/**
 * 🐛 20종 벌레 도감 마스터 카탈로그
 * - 모든 개체는 '진짜 곤충/벌레' 비주얼(🪲, 🐞, 🦗, 🐜, 🐝, 🪰, 🦋, 🕷️, 🦂)을 기반으로 하며,
 *   속성 및 보스(왕관 👑)는 장식 및 오라로 완벽하게 융합됩니다.
 */

export const BUG_TIERS = {
  COMMON: { label: '일반', color: 'text-emerald-700 bg-emerald-100 border-emerald-300', badgeBg: 'from-emerald-500 to-teal-600' },
  RARE: { label: '레어', color: 'text-blue-700 bg-blue-100 border-blue-300', badgeBg: 'from-blue-500 to-indigo-600' },
  EPIC: { label: '에픽', color: 'text-purple-700 bg-purple-100 border-purple-300', badgeBg: 'from-purple-500 to-pink-600' },
  LEGENDARY: { label: '전설', color: 'text-amber-700 bg-amber-100 border-amber-300', badgeBg: 'from-amber-500 to-yellow-400' },
  BOSS: { label: '보스 레이드', color: 'text-rose-700 bg-rose-100 border-rose-300', badgeBg: 'from-rose-600 to-red-700' },
};

export const BUG_CATALOG = [
  // 🟢 1. COMMON (일반 - 6종)
  {
    id: 'green_beetle',
    name: '초록 풍뎅이',
    emoji: '🪲',
    iconSymbol: '🌿',
    tier: 'COMMON',
    desc: '학원 주변 풀숲에 서식하는 친근한 풍뎅이. 신입 헌터들의 첫 번째 친구!',
    defaultSpeed: 'NORMAL',
    escapeGimmick: false,
    auraClass: 'bg-emerald-400/50',
    cardBorder: 'border-emerald-200',
  },
  {
    id: 'lucky_ladybug',
    name: '칠점 무당벌레',
    emoji: '🐞',
    iconSymbol: '🍀',
    tier: 'COMMON',
    desc: '등에 일곱 개의 점이 있는 행운의 상징. 만지면 수학 100점의 기운이 솟아납니다.',
    defaultSpeed: 'NORMAL',
    escapeGimmick: false,
    auraClass: 'bg-rose-400/50',
    cardBorder: 'border-rose-200',
  },
  {
    id: 'jumping_grasshopper',
    name: '촐랑 메뚜기',
    emoji: '🦗',
    iconSymbol: '🌾',
    tier: 'COMMON',
    desc: '스마트폰 화면을 통통 튀어다니는 개구쟁이 메뚜기. 집중해서 타이밍을 노리세요!',
    defaultSpeed: 'FAST',
    escapeGimmick: false,
    auraClass: 'bg-lime-400/50',
    cardBorder: 'border-lime-200',
  },
  {
    id: 'diligent_ant',
    name: '성실 개미',
    emoji: '🐜',
    iconSymbol: '📖',
    tier: 'COMMON',
    desc: '매일 수학 오답노트를 작성하듯 부지런하게 움직이는 일개미 요정.',
    defaultSpeed: 'NORMAL',
    escapeGimmick: false,
    auraClass: 'bg-amber-600/40',
    cardBorder: 'border-amber-200',
  },
  {
    id: 'honey_bee',
    name: '꿀벌 요정',
    emoji: '🐝',
    iconSymbol: '🍯',
    tier: 'COMMON',
    desc: '달콤한 간식 냄새를 맡고 날아온 꿀벌. 빙글빙글 비행 댄스를 춥니다.',
    defaultSpeed: 'NORMAL',
    escapeGimmick: false,
    auraClass: 'bg-yellow-400/50',
    cardBorder: 'border-yellow-200',
  },
  {
    id: 'agile_fly',
    name: '민첩 파리',
    emoji: '🪰',
    iconSymbol: '💨',
    tier: 'COMMON',
    desc: '잡으려고 하면 쉭쉭 방향을 바꾸는 날렵한 파리. 순발력 테스트에 제격!',
    defaultSpeed: 'FAST',
    escapeGimmick: true,
    auraClass: 'bg-slate-400/50',
    cardBorder: 'border-slate-200',
  },

  // 🔵 2. RARE (레어 - 5종)
  {
    id: 'gold_beetle',
    name: '황금 풍뎅이',
    emoji: '🪲',
    iconSymbol: '✨',
    tier: 'RARE',
    desc: '온몸이 눈부신 황금으로 도금된 전설의 길조 풍뎅이. 품수학 최고의 마스코트!',
    defaultSpeed: 'FAST',
    escapeGimmick: true,
    auraClass: 'bg-yellow-400/80',
    cardBorder: 'border-yellow-300',
    badgeText: 'GOLDEN',
  },
  {
    id: 'moonlight_firefly',
    name: '달빛 반딧불이',
    emoji: '🪰',
    iconSymbol: '🌙',
    tier: 'RARE',
    desc: '야간 자습 시간마다 은은한 달빛 오라를 뿜으며 학생들을 응원하는 반딧불이.',
    defaultSpeed: 'NORMAL',
    escapeGimmick: false,
    auraClass: 'bg-cyan-400/80',
    cardBorder: 'border-cyan-300',
    badgeText: 'LUMEN',
  },
  {
    id: 'frost_cicada',
    name: '얼음 매미',
    emoji: '🦗',
    iconSymbol: '❄️',
    tier: 'RARE',
    desc: '차가운 냉기를 뿜어내며 날아다니는 시원한 여름의 얼음 매미.',
    defaultSpeed: 'NORMAL',
    escapeGimmick: false,
    auraClass: 'bg-sky-400/80',
    cardBorder: 'border-sky-300',
    badgeText: 'FROST',
  },
  {
    id: 'lightning_tiger_beetle',
    name: '번개 길앞잡이',
    emoji: '🪲',
    iconSymbol: '⚡',
    tier: 'RARE',
    desc: '지그재그로 번개 치듯 질주하는 전격 풍뎅이. 눈 깜짝할 사이에 사라집니다.',
    defaultSpeed: 'EXTREME',
    escapeGimmick: true,
    auraClass: 'bg-amber-500/80',
    cardBorder: 'border-amber-300',
    badgeText: 'THUNDER',
  },
  {
    id: 'camo_stick_bug',
    name: '나뭇잎 대벌레',
    emoji: '🦗',
    iconSymbol: '🍃',
    tier: 'RARE',
    desc: '화면 배경과 똑같이 위장하는 은신술의 달인 벌레. 날카로운 관찰력이 필요합니다.',
    defaultSpeed: 'NORMAL',
    escapeGimmick: true,
    auraClass: 'bg-emerald-600/70',
    cardBorder: 'border-emerald-300',
    badgeText: 'CAMO',
  },

  // 🟣 3. EPIC (에픽 - 4종)
  {
    id: 'flame_mantis',
    name: '불꽃 사마귀',
    emoji: '🦗',
    iconSymbol: '🔥',
    tier: 'EPIC',
    desc: '손대면 화염을 내뿜으며 3번 도망치는 열정의 사마귀. 헥헥 지칠 때를 노려라!',
    defaultSpeed: 'FAST',
    escapeGimmick: true,
    auraClass: 'bg-orange-500/90',
    cardBorder: 'border-orange-300',
    badgeText: 'FLAME',
  },
  {
    id: 'sapphire_butterfly',
    name: '사파이어 나비',
    emoji: '🦋',
    iconSymbol: '💎',
    tier: 'EPIC',
    desc: '영롱한 푸른 보석 가루를 흩날리며 우아하게 활공하는 환상의 나비.',
    defaultSpeed: 'NORMAL',
    escapeGimmick: true,
    auraClass: 'bg-indigo-500/90',
    cardBorder: 'border-indigo-300',
    badgeText: 'SAPPHIRE',
  },
  {
    id: 'tempest_dragonfly',
    name: '질풍 잠자리',
    emoji: '🪰',
    iconSymbol: '🌪️',
    tier: 'EPIC',
    desc: '태풍을 가르며 화면 반대편으로 가로지르는 광속 잠자리. 순발력 랭커 전용!',
    defaultSpeed: 'EXTREME',
    escapeGimmick: true,
    auraClass: 'bg-teal-500/90',
    cardBorder: 'border-teal-300',
    badgeText: 'TEMPEST',
  },
  {
    id: 'warp_spider',
    name: '시공간 거미',
    emoji: '🕷️',
    iconSymbol: '🔮',
    tier: 'EPIC',
    desc: '포획하려는 순간 화면 모서리로 웜홀을 열고 순간이동하는 보랏빛 거미.',
    defaultSpeed: 'FAST',
    escapeGimmick: true,
    auraClass: 'bg-purple-600/90',
    cardBorder: 'border-purple-300',
    badgeText: 'WARP',
  },

  // 🟡 4. LEGENDARY (전설 - 3종)
  {
    id: 'rainbow_hercules',
    name: '무지개 헤라클레스',
    emoji: '🪲',
    iconSymbol: '🌈',
    tier: 'LEGENDARY',
    desc: '일곱 빛깔 찬란한 무지개 오라를 두른 세계 최강의 환상 장수풍뎅이.',
    defaultSpeed: 'EXTREME',
    escapeGimmick: true,
    auraClass: 'bg-gradient-to-r from-pink-500 via-amber-400 to-sky-400 opacity-95',
    cardBorder: 'border-yellow-400 shadow-yellow-200',
    badgeText: 'RAINBOW',
  },
  {
    id: 'cosmic_meteor_bug',
    name: '우주 운석벌레',
    emoji: '🪲',
    iconSymbol: '🪐',
    tier: 'LEGENDARY',
    desc: '우주 깊은 곳에서 별똥별 꼬리를 달고 날아온 신비한 외계 풍뎅이.',
    defaultSpeed: 'EXTREME',
    escapeGimmick: true,
    auraClass: 'bg-violet-600/95',
    cardBorder: 'border-violet-400 shadow-purple-200',
    badgeText: 'COSMIC',
  },
  {
    id: 'ancient_dragonfly',
    name: '드래곤 플라이',
    emoji: '🪰',
    iconSymbol: '🐲',
    tier: 'LEGENDARY',
    desc: '전설 속 붉은 용의 숨결을 품은 고대 비행 잠자리. 마스터 헌터의 상징!',
    defaultSpeed: 'EXTREME',
    escapeGimmick: true,
    auraClass: 'bg-rose-600/95',
    cardBorder: 'border-rose-400 shadow-rose-200',
    badgeText: 'DRAGON',
  },

  // 👑 5. BOSS (보스 레이드 - 2종)
  {
    id: 'boss_stag_beetle',
    name: '대왕 사슴벌레',
    emoji: '🪲',
    iconSymbol: '👑',
    tier: 'BOSS',
    desc: '머리에 황금 왕관을 쓴 거대한 전설의 대왕 사슴벌레! (반 협동 타격 레이드)',
    defaultSpeed: 'FAST',
    escapeGimmick: false,
    auraClass: 'bg-rose-700/95',
    cardBorder: 'border-red-500 shadow-red-300',
    defaultHp: 30,
    hasCrown: true,
  },
  {
    id: 'boss_titan_goliath',
    name: '고대 타이탄 골리앗',
    emoji: '🦂',
    iconSymbol: '👑',
    tier: 'BOSS',
    desc: '황금 왕관을 쓴 고대 타이탄 거대전갈 몬스터! 전교생 총력전 전용 최종 보스!',
    defaultSpeed: 'FAST',
    escapeGimmick: false,
    auraClass: 'bg-red-800/95',
    cardBorder: 'border-red-600 shadow-red-400',
    defaultHp: 50,
    hasCrown: true,
  },
];

export function getBugById(bugId) {
  return BUG_CATALOG.find((b) => b.id === bugId) || BUG_CATALOG[0];
}

export function getAllBugs() {
  return BUG_CATALOG;
}

export function getNormalBugs() {
  return BUG_CATALOG.filter((b) => b.tier !== 'BOSS');
}

export function getBossBugs() {
  return BUG_CATALOG.filter((b) => b.tier === 'BOSS');
}

export function getRandomBug(tierFilter = null) {
  let list = BUG_CATALOG.filter((b) => b.tier !== 'BOSS');
  if (tierFilter) {
    list = list.filter((b) => b.tier === tierFilter);
  }
  const idx = Math.floor(Math.random() * list.length);
  return list[idx];
}
