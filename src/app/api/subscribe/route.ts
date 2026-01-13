// =============================================================================
// /app/api/subscribe/route.ts
// Email subscription endpoint for MirrorSource
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

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

// Email validation regex
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body = await request.json();
    const { email, marketingOptIn, timestamp, source } = body;

    // ===================
    // Validation
    // ===================

    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { success: false, message: 'Email is required' },
        { status: 400 }
      );
    }

    const normalizedEmail = email.trim().toLowerCase();

    if (!EMAIL_REGEX.test(normalizedEmail)) {
      return NextResponse.json(
        { success: false, message: 'Please enter a valid email address' },
        { status: 400 }
      );
    }

    // Block disposable email domains (basic list - expand as needed)
    const disposableDomains = [
      'tempmail.com', 'throwaway.com', 'mailinator.com',
      'guerrillamail.com', '10minutemail.com', 'temp-mail.org'
    ];
    const emailDomain = normalizedEmail.split('@')[1];
    if (disposableDomains.includes(emailDomain)) {
      return NextResponse.json(
        { success: false, message: 'Please use a permanent email address' },
        { status: 400 }
      );
    }

    // ===================
    // Database Insert
    // ===================

    const { data, error } = await getSupabaseClient()
      .from('subscribers')
      .upsert({
        email: normalizedEmail,
        marketing_opt_in: Boolean(marketingOptIn),
        source: source || 'email_gate',
        created_at: timestamp || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'email',
        ignoreDuplicates: false, // Update existing record
      })
      .select()
      .single();

    if (error) {
      console.error('Supabase insert error:', error);

      // Handle specific errors
      if (error.code === '23505') {
        // Duplicate email - this shouldn't happen with upsert, but handle gracefully
        return NextResponse.json({
          success: true,
          message: 'Email already registered',
          isExisting: true
        });
      }

      return NextResponse.json(
        { success: false, message: 'Failed to save subscription. Please try again.' },
        { status: 500 }
      );
    }

    // ===================
    // Success Response
    // ===================

    console.log(`New subscriber: ${normalizedEmail} (marketing: ${marketingOptIn})`);

    return NextResponse.json({
      success: true,
      message: 'Successfully subscribed',
      isExisting: false,
    });

  } catch (error) {
    console.error('Subscribe API error:', error);

    return NextResponse.json(
      { success: false, message: 'An unexpected error occurred. Please try again.' },
      { status: 500 }
    );
  }
}

// ===================
// Health check endpoint (optional)
// ===================
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    endpoint: '/api/subscribe',
    method: 'POST',
    requiredFields: ['email'],
    optionalFields: ['marketingOptIn', 'timestamp', 'source']
  });
}
