'use client';
import React from 'react';

const TOOLS = [
  { label: '분수(a/b)', insert: '$\\frac{a}{b}$' },
  { label: '거듭제곱', insert: '$x^2$' },
  { label: '루트', insert: '$\\sqrt{x}$' },
  { label: '인테그랄', insert: '$\\int_{a}^{b} x dx$' },
  { label: '시그마', insert: '$\\sum_{i=1}^{n} x_i$' },
  { label: '리미트', insert: '$\\lim_{x \\to \\infty}$' },
  { label: '근의 공식', insert: '$$x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$$' },
];

export default function MathToolbar({ onInsert }) {
  return (
    <div className="flex flex-wrap gap-2 mb-2 p-2 bg-gray-50 rounded-md border border-gray-200">
      <span className="text-sm text-gray-600 font-medium my-auto mr-2">수식 입력기:</span>
      {TOOLS.map((tool, idx) => (
        <button
          key={idx}
          type="button"
          onClick={() => onInsert(tool.insert)}
          className="px-2 py-1 bg-white border border-gray-300 rounded text-xs font-semibold hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-300 transition-colors"
        >
          {tool.label}
        </button>
      ))}
      <span className="text-xs text-gray-400 my-auto ml-auto hidden sm:inline">
        수식 기호를 클릭하면 커서 위치에 텍스트가 삽입됩니다.
      </span>
    </div>
  );
}
