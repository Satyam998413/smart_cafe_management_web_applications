import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import supabase from '@/lib/supabaseClient.js';
import logger from '@/lib/logger.js';
import { requireAuth } from '@/lib/auth.js';

const GST_RATE = 0.18; // 18% GST

// POST /api/sales/onboard-cart (Salesman Tenant Onboarding & Hardware Purchase)
export async function POST(request) {
  const auth = requireAuth(request);
  if (auth.error) return auth.error;

  const allowedRoles = ['master_admin', 'salesman'];
  if (!auth.isMasterAdmin && !allowedRoles.includes(auth.userRole)) {
    return NextResponse.json({ message: 'Insufficient permissions' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const {
      orgName,
      premiseType,
      contactEmail,
      address,
      gstin,
      themePreset,
      ownerName,
      ownerEmail,
      ownerPassword,
      items,
      couponCode,
      paymentMode // 'cash' | 'online' | 'cheque'
    } = body;

    if (!orgName || !premiseType || !contactEmail || !items || !Array.isArray(items)) {
      return NextResponse.json(
        { message: 'orgName, premiseType, contactEmail, and items array are required' },
        { status: 400 }
      );
    }

    // 1. Calculate Subtotal
    let subtotal = 0;
    const itemDetails = items.map((item) => {
      const price = parseFloat(item.unit_price || 0);
      const qty = parseInt(item.quantity || 1, 10);
      subtotal += price * qty;
      return {
        hardware_id: item.id || null,
        name: item.name,
        category: item.category,
        unit_price: price,
        quantity: qty,
        line_total: price * qty
      };
    });

    // 2. Coupon Validation & Discount
    let discountAmount = 0;
    if (couponCode) {
      const { data: coupon } = await supabase
        .from('coupons')
        .select('*')
        .eq('code', couponCode.toUpperCase())
        .eq('is_active', true)
        .maybeSingle();

      if (coupon) {
        if (coupon.discount_type === 'percentage') {
          discountAmount = (subtotal * parseFloat(coupon.discount_value)) / 100;
          if (coupon.max_discount_amount && discountAmount > parseFloat(coupon.max_discount_amount)) {
            discountAmount = parseFloat(coupon.max_discount_amount);
          }
        } else {
          discountAmount = parseFloat(coupon.discount_value);
        }
      }
    }

    const discountedSubtotal = Math.max(0, subtotal - discountAmount);
    const gstAmount = Math.round(discountedSubtotal * GST_RATE * 100) / 100;
    const totalAmount = Math.round((discountedSubtotal + gstAmount) * 100) / 100;

    // 3. Create Tenant Organization
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .insert({
        name: orgName,
        premise_type: premiseType,
        contact_email: contactEmail,
        theme: { preset: themePreset || 'ocean', address, gstin }
      })
      .select('*')
      .single();

    if (orgError) throw orgError;

    // 4. Create Owner user account if provided
    let owner = null;
    if (ownerName && ownerEmail && ownerPassword) {
      const { data: ownerUser } = await supabase
        .from('users')
        .insert({
          name: ownerName,
          email: ownerEmail,
          role: 'owner',
          org_id: org.id,
          password_hash: bcrypt.hashSync(ownerPassword, 10)
        })
        .select('id, name, email')
        .single();
      owner = ownerUser;
    }

    // 5. Pick an available Technician
    const { data: technicians } = await supabase
      .from('users')
      .select('id')
      .eq('role', 'technician')
      .limit(1);

    const assignedTechnicianId = technicians?.[0]?.id || null;

    // 6. Record Sales Order
    const { data: salesOrder, error: salesError } = await supabase
      .from('sales_orders')
      .insert({
        salesman_id: auth.userId,
        org_name: orgName,
        premise_type: premiseType,
        contact_email: contactEmail,
        address: address || null,
        gstin: gstin || null,
        theme_preset: themePreset || 'ocean',
        items: itemDetails,
        subtotal,
        gst_amount: gstAmount,
        discount_amount: discountAmount,
        total_amount: totalAmount,
        coupon_code: couponCode || null,
        payment_mode: paymentMode || 'cash',
        payment_status: 'completed',
        created_org_id: org.id,
        assigned_technician_id: assignedTechnicianId
      })
      .select('*')
      .single();

    if (salesError) throw salesError;

    logger.info('Salesman onboarded organization with hardware quote', {
      orderId: salesOrder.id,
      orgId: org.id,
      salesmanId: auth.userId,
      totalAmount
    });

    return NextResponse.json(
      {
        order: salesOrder,
        organization: org,
        owner,
        summary: {
          subtotal,
          discountAmount,
          gstAmount,
          totalAmount,
          paymentMode: paymentMode || 'cash'
        }
      },
      { status: 201 }
    );
  } catch (error) {
    logger.error('Failed salesman onboarding order', { error: error.message });
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}
