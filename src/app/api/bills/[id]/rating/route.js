import { NextResponse } from 'next/server';
import supabase from '@/lib/supabaseClient.js';
import logger from '@/lib/logger.js';
import { serializeRating } from '@/lib/serializers.js';
import { requireAuth } from '@/lib/auth.js';

// POST /api/bills/[id]/rating — ported from billingController.js's
// submitRating. The "smart screen with emojis" (vision doc §5), gated on
// the bill actually being paid.
export async function POST(request, { params }) {
  const auth = requireAuth(request);
  if (auth.error) return auth.error;

  try {
    const { id } = await params;
    const { foodRating, serviceRating, suggestion } = await request.json();
    if (foodRating === undefined && serviceRating === undefined) {
      return NextResponse.json({ message: 'foodRating and/or serviceRating is required' }, { status: 400 });
    }

    const { data: bill, error: billError } = await supabase.from('bills').select('id, status').eq('id', id).maybeSingle();
    if (billError) throw billError;
    if (!bill) return NextResponse.json({ message: 'Bill not found' }, { status: 404 });
    if (bill.status !== 'paid') {
      return NextResponse.json({ message: 'Rating is only available after payment is confirmed' }, { status: 400 });
    }

    const { data: rating, error } = await supabase
      .from('ratings')
      .insert({
        bill_id: id,
        customer_id: auth.userId,
        food_rating: foodRating ?? null,
        service_rating: serviceRating ?? null,
        suggestion: suggestion || null
      })
      .select('*')
      .single();
    if (error) throw error;

    return NextResponse.json(serializeRating(rating), { status: 201 });
  } catch (error) {
    logger.error('Failed to submit rating', { error: error.message });
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}
