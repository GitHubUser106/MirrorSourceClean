// =============================================================================
// /app/api/og/route.tsx
// Dynamic OG image generation for shareable Intel Briefs
// =============================================================================

import { ImageResponse } from '@vercel/og';
import { NextRequest } from 'next/server';
import { getIntensityWord } from '@/lib/briefHash';

export const runtime = 'edge';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const topic = searchParams.get('topic') || 'News Analysis';
  const intensity = parseInt(searchParams.get('intensity') || '5', 10);
  const sourceCount = parseInt(searchParams.get('sources') || '0', 10);
  const intensityWord = getIntensityWord(intensity);

  // Color based on intensity
  const intensityColor = intensity <= 3 ? '#22c55e' : intensity <= 6 ? '#eab308' : intensity <= 8 ? '#f97316' : '#ef4444';
  const intensityBg = intensity <= 3 ? '#dcfce7' : intensity <= 6 ? '#fef9c3' : intensity <= 8 ? '#ffedd5' : '#fee2e2';

  // Calculate filled bars (out of 10)
  const filledBars = intensity;

  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: '#f8fafc',
          padding: '48px',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '48px',
              height: '48px',
              backgroundColor: '#2563eb',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            <span style={{ fontSize: '24px', fontWeight: 700, color: '#1e293b' }}>MirrorSource</span>
          </div>
          <span style={{ fontSize: '16px', color: '#64748b' }}>Compare the coverage</span>
        </div>

        {/* Topic/Headline */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <h1 style={{
            fontSize: topic.length > 60 ? '36px' : '48px',
            fontWeight: 800,
            color: '#0f172a',
            lineHeight: 1.2,
            marginBottom: '32px',
            maxWidth: '1000px',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            overflow: 'hidden',
          }}>
            {topic}
          </h1>

          {/* Emotional Intensity Bar */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            backgroundColor: intensityBg,
            padding: '16px 24px',
            borderRadius: '12px',
            marginBottom: '24px',
          }}>
            <span style={{ fontSize: '18px', fontWeight: 600, color: '#475569' }}>Emotional Intensity:</span>
            <div style={{ display: 'flex', gap: '6px' }}>
              {Array.from({ length: 10 }).map((_, i) => (
                <div
                  key={i}
                  style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '4px',
                    backgroundColor: i < filledBars ? intensityColor : '#e2e8f0',
                  }}
                />
              ))}
            </div>
            <span style={{ fontSize: '20px', fontWeight: 700, color: intensityColor }}>
              {intensity}/10 {intensityWord}
            </span>
          </div>

          {/* Source count */}
          {sourceCount > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '18px', color: '#64748b' }}>
                Compared {sourceCount} sources across the political spectrum
              </span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          paddingTop: '24px',
          borderTop: '1px solid #e2e8f0',
        }}>
          <span style={{ fontSize: '20px', color: '#64748b' }}>
            See the whole story at <span style={{ color: '#2563eb', fontWeight: 600 }}>mirrorsource.app</span>
          </span>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}
