import { GroundingSource } from '../types';

interface ResultsDisplayProps {
  results: GroundingSource[] | null;
}

export default function ResultsDisplay({ results }: ResultsDisplayProps) {
  if (!results || results.length === 0) {
    return null;
  }

  return (
    <div className="mt-6 space-y-4">
      {results.map((item, index) => (
        <article
          key={index}
          className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
        >
          <a
            href={item.uri}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 font-semibold hover:underline"
          >
            {item.title}
          </a>
          
          <p className="text-sm text-slate-500 mt-1">
            {(() => {
              try {
                return new URL(item.uri).hostname.replace(/^www\./, '');
              } catch {
                return 'source.com';
              }
            })()}
          </p>
        </article>
      ))}
    </div>
  );
}