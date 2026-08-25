'use client';

export default function FormattedContent({ text }) {
  if (!text) return null;
  const urlRegex = /(https?:\/\/[^\s]+)/g;

  const parts = text.split(urlRegex);

  return (
    <p className="text-sm text-gray-600 whitespace-pre-wrap leading-relaxed">
      {parts.map((part, i) => {
        if (part.match(urlRegex)) {
          return (
            <a
              key={i}
              href={part}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 font-bold hover:underline break-all inline-flex items-center gap-1 my-0.5"
            >
              🔗 {part} ↗
            </a>
          );
        }
        return part;
      })}
    </p>
  );
}