import { GroundingSource } from '../types';
import { ExternalLink } from 'lucide-react'; // Optional: icon for clarity

interface ResultsDisplayProps {
  results: GroundingSource[] | null;
}

export default function ResultsDisplay({ results }: ResultsDisplayProps) {
  if (!results || results.length === 0) {
    return null;
  }

  return (
    <div className="mt-6 space-y-4">
      {results.map((item, index) => {
        // The logs confirm:
        // item.uri = the working (but ugly) redirect link.
        // item.title = "forbes.com" (the clean source name).
        
        return (
          <article
            key={index}
            className="flex flex-col items-start rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
          >
            {/* Main Link using the clean Title from API */}
            <a
              href={item.uri}
              target="_blank"
              rel="noopener noreferrer"
              className="text-lg font-semibold text-blue-700 leading-snug hover:underline flex items-center gap-2"
            >
              {item.title}
              <ExternalLink size={14} className="text-slate-400" />
            </a>
            
            {/* Helper text explaining it's an external source */}
            <p className="text-xs text-slate-500 mt-1">
              Source: {item.title}
            </p>
          </article>
        );
      })}
    </div>
  );
}