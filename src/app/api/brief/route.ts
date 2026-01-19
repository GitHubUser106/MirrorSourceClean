// =============================================================================
// /app/api/brief/route.ts
// Create and retrieve shareable Intel Briefs
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { generateBriefHash } from '@/lib/briefHash';

// Lazy initialization of Supabase client (avoids build-time errors)
let supabase: SupabaseClient | null = null;

function getSupabaseClient(): SupabaseClient {
  if (!supabase) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase environment variables');
    }

    supabase = createClient(supabaseUrl, supabaseServiceKey);
  }
  return supabase;
}

// POST: Create a new shareable brief
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      originalUrl,
      topic,
      summary,
      commonGround,
      keyDifferences,
      provenance,
      narrative,
      sources,
      emotionalIntensity,
      narrativeType,
    } = body;

    // Validation
    if (!originalUrl || !topic) {
      return NextResponse.json(
        { success: false, message: 'originalUrl and topic are required' },
        { status: 400 }
      );
    }

    // Generate unique hash
    const hash = generateBriefHash();

    // Insert into database
    const { data, error } = await getSupabaseClient()
      .from('shared_briefs')
      .insert({
        hash,
        original_url: originalUrl,
        topic,
        summary,
        common_ground: commonGround,
        key_differences: keyDifferences,
        provenance,
        narrative,
        sources,
        emotional_intensity: emotionalIntensity,
        narrative_type: narrativeType,
      })
      .select()
      .single();

    if (error) {
      console.error('Supabase insert error:', error);
      return NextResponse.json(
        { success: false, message: 'Failed to create shareable brief' },
        { status: 500 }
      );
    }

    // Construct share URL
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://mirrorsource.app';
    const shareUrl = `${baseUrl}/brief/${hash}`;

    return NextResponse.json({
      success: true,
      hash,
      shareUrl,
    });

  } catch (error) {
    console.error('Brief API error:', error);
    return NextResponse.json(
      { success: false, message: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}

// GET: Retrieve a brief by hash
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const hash = searchParams.get('hash');

    if (!hash) {
      return NextResponse.json(
        { success: false, message: 'hash parameter is required' },
        { status: 400 }
      );
    }

    // Fetch from database
    const { data, error } = await getSupabaseClient()
      .from('shared_briefs')
      .select('*')
      .eq('hash', hash)
      .single();

    if (error || !data) {
      return NextResponse.json(
        { success: false, message: 'Brief not found' },
        { status: 404 }
      );
    }

    // Increment view count (fire and forget)
    getSupabaseClient()
      .from('shared_briefs')
      .update({ view_count: (data.view_count || 0) + 1 })
      .eq('hash', hash)
      .then(() => {});

    return NextResponse.json({
      success: true,
      brief: {
        hash: data.hash,
        originalUrl: data.original_url,
        topic: data.topic,
        summary: data.summary,
        commonGround: data.common_ground,
        keyDifferences: data.key_differences,
        provenance: data.provenance,
        narrative: data.narrative,
        sources: data.sources,
        emotionalIntensity: data.emotional_intensity,
        narrativeType: data.narrative_type,
        createdAt: data.created_at,
        viewCount: data.view_count,
      },
    });

  } catch (error) {
    console.error('Brief GET error:', error);
    return NextResponse.json(
      { success: false, message: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}
