/**
 * Shapes raw Supabase/PostgREST rows (snake_case columns) into the JSON
 * contract clients were built against (camelCase keys, nested `_id`).
 *
 * Ported incrementally from server/src/utils/serializers.js as each
 * resource migrates to this Next.js app (plan Phase 10) — serializeUser
 * (auth), the menu serializers, the order serializers, and serializeSite/
 * serializeSpace exist so far. Add the rest (serializeBill, ...) here as
 * their owning routes/controllers are ported, not all at once up front.
 */

const toNumber = (value) => (value === null || value === undefined ? value : Number(value));

// Whitelist by construction — never spread raw `user` here, so a new
// sensitive column (e.g. password_hash) can't leak into API responses just
// by being added to the table.
export const serializeUser = (user) => {
  if (!user) return null;
  return {
    _id: user.id,
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    hiveId: user.hive_id,
    role: user.role || 'customer',
    authProvider: user.auth_provider || 'password',
    // Staff's site/space assignment (plan Phase 2c) — not sensitive, and the
    // Staff page needs it to show/edit who's assigned where without a
    // second round-trip per row.
    spaceId: user.space_id ?? null,
    // Grantable flags (canResetStaffPassword, canControlIot) — only ever
    // meaningful for a Manager, empty object for everyone else. Not
    // sensitive; the Staff page needs it to render an Owner's permission
    // toggles without a second round-trip per row.
    permissions: user.permissions || {},
    preferences: { orderCount: user.order_count ?? 0 },
    createdAt: user.created_at
  };
};

export const serializeMenuItemOptionChoice = (choice) => {
  if (!choice) return null;
  return {
    id: choice.id,
    label: choice.label,
    priceDelta: toNumber(choice.price_delta),
    isDefault: choice.is_default
  };
};

export const serializeMenuItemOptionGroup = (group) => {
  if (!group) return null;
  return {
    id: group.id,
    name: group.name,
    selectionType: group.selection_type,
    isRequired: group.is_required,
    choices: (group.choices || []).map(serializeMenuItemOptionChoice)
  };
};

export const serializeMenuItem = (menuItem) => {
  if (!menuItem) return null;
  return {
    _id: menuItem.id,
    id: menuItem.id,
    name: menuItem.name,
    category: menuItem.category,
    price: toNumber(menuItem.price),
    description: menuItem.description,
    imageUrl: menuItem.image_url,
    isAvailable: menuItem.is_available,
    createdAt: menuItem.created_at,
    optionGroups: (menuItem.optionGroups || []).map(serializeMenuItemOptionGroup)
  };
};

export const serializeOrderItemOption = (option) => {
  if (!option) return null;
  return {
    id: option.id,
    choiceId: option.choice_id,
    groupLabel: option.group_label,
    choiceLabel: option.choice_label,
    priceDelta: toNumber(option.price_delta)
  };
};

export const serializeOrderMessage = (message) => {
  if (!message) return null;
  return {
    id: message.id,
    userId: message.user_id,
    orderId: message.order_id,
    senderId: message.sender_id,
    body: message.body,
    createdAt: message.created_at,
    readAt: message.read_at
  };
};

export const serializeManagerCookMessage = (message) => {
  if (!message) return null;
  return {
    id: message.id,
    managerId: message.manager_id,
    cookId: message.cook_id,
    senderId: message.sender_id,
    body: message.body,
    createdAt: message.created_at,
    readAt: message.read_at
  };
};

export const serializeSite = (site) => {
  if (!site) return null;
  return {
    id: site.id,
    name: site.name,
    address: site.address,
    lat: toNumber(site.lat),
    lng: toNumber(site.lng),
    googleBusinessProfileUrl: site.google_business_profile_url,
    createdAt: site.created_at
  };
};

export const serializeSpace = (space) => {
  if (!space) return null;
  return {
    id: space.id,
    siteId: space.site_id,
    parentSpaceId: space.parent_space_id,
    kind: space.kind,
    label: space.label,
    number: space.number,
    isBookable: space.is_bookable,
    iotEnabled: space.iot_enabled,
    sortOrder: space.sort_order,
    // Room-specific (hotel premise) — null/unused for every other kind.
    pricePerNight: toNumber(space.price_per_night),
    description: space.description ?? null,
    maxOccupancy: space.max_occupancy ?? null,
    // Present only when the caller's query joined space_images (see
    // GET /api/spaces's `?includeImages=1`) — undefined otherwise, so this
    // key is simply absent rather than always null on every response.
    images: space.space_images ? space.space_images.map(serializeSpaceImage) : undefined
  };
};

export const serializeSpaceImage = (image) => {
  if (!image) return null;
  return {
    id: image.id,
    spaceId: image.space_id,
    imageUrl: image.image_url,
    sortOrder: image.sort_order,
    createdAt: image.created_at
  };
};

export const serializeBooking = (booking) => {
  if (!booking) return null;
  return {
    id: booking.id,
    orgId: booking.org_id,
    siteId: booking.site_id,
    spaceId: booking.space_id,
    customerId: booking.customer_id,
    checkIn: booking.check_in,
    checkOut: booking.check_out,
    numGuests: booking.num_guests,
    nightlyRate: toNumber(booking.nightly_rate),
    totalPrice: toNumber(booking.total_price),
    status: booking.status,
    paymentMethod: booking.payment_method,
    razorpayOrderId: booking.razorpay_order_id,
    cashCollectedBy: booking.cash_collected_by,
    cashCollectedAt: booking.cash_collected_at,
    specialRequests: booking.special_requests,
    createdAt: booking.created_at,
    paidAt: booking.paid_at,
    // Present when the query joined spaces/sites (see GET /api/bookings).
    space: booking.space ? serializeSpace(booking.space) : undefined,
    site: booking.site ? { id: booking.site.id, name: booking.site.name } : undefined
  };
};

export const serializeOrder = (order) => {
  if (!order) return null;
  return {
    _id: order.id,
    id: order.id,
    user: order.user ? serializeUser(order.user) : order.user_id,
    items: (order.items || []).map((item) => ({
      menuItem: item.menuItem ? serializeMenuItem(item.menuItem) : item.menu_item_id,
      quantity: item.quantity,
      priceAtPurchase: toNumber(item.price_at_purchase),
      selectedOptions: (item.orderItemOptions || []).map(serializeOrderItemOption)
    })),
    totalAmount: toNumber(order.total_amount),
    status: order.status,
    orderTime: order.order_time,
    mealType: order.meal_type,
    orderType: order.order_type,
    tableNumber: order.table_number,
    deliveryAddress: order.delivery_address,
    deliveryLat: toNumber(order.delivery_lat),
    deliveryLng: toNumber(order.delivery_lng),
    deliveryPincode: order.delivery_pincode,
    assignedCookId: order.assigned_cook_id || null,
    assignedCook: order.assignedCook ? serializeUser(order.assignedCook) : null,
    assignedRiderId: order.assigned_rider_id || null,
    deliveryStatus: order.delivery_status || null,
    spaceId: order.space_id || null
  };
};

export const serializeBill = (bill) => {
  if (!bill) return null;
  return {
    id: bill.id,
    siteId: bill.site_id,
    spaceId: bill.space_id,
    customerId: bill.customer_id,
    status: bill.status,
    paymentMethod: bill.payment_method,
    totalAmount: toNumber(bill.total_amount),
    couponCodeId: bill.coupon_code_id,
    razorpayOrderId: bill.razorpay_order_id,
    cashCollectedBy: bill.cash_collected_by,
    cashCollectedAt: bill.cash_collected_at,
    createdAt: bill.created_at,
    paidAt: bill.paid_at,
    orderIds: (bill.orders || []).map((o) => o.id)
  };
};

export const serializeRating = (rating) => {
  if (!rating) return null;
  return {
    id: rating.id,
    billId: rating.bill_id,
    foodRating: rating.food_rating,
    serviceRating: rating.service_rating,
    suggestion: rating.suggestion,
    createdAt: rating.created_at
  };
};

export const serializeDevice = (device) => {
  if (!device) return null;
  const deviceState = Array.isArray(device.deviceState) ? device.deviceState[0] : device.deviceState;
  return {
    id: device.id,
    spaceId: device.space_id,
    deviceNo: device.device_no,
    // Human-facing id, e.g. "DEV-0007" — formatting lives here, not stored,
    // so the DB only ever holds the raw per-org sequential integer.
    deviceCode: `DEV-${String(device.device_no).padStart(4, '0')}`,
    name: device.name,
    type: device.type,
    vendor: device.vendor,
    externalDeviceId: device.external_device_id,
    capabilities: device.capabilities || [],
    posX: toNumber(device.pos_x),
    posY: toNumber(device.pos_y),
    state: deviceState?.state ?? {},
    stateUpdatedAt: deviceState?.updated_at ?? null
  };
};

export const serializeWalletTransaction = (tx) => {
  if (!tx) return null;
  return {
    id: tx.id,
    type: tx.type,
    amount: tx.amount,
    balanceAfter: tx.balance_after,
    referenceType: tx.reference_type,
    referenceId: tx.reference_id,
    createdAt: tx.created_at
  };
};

export const serializeWallet = (wallet, transactions = []) => {
  if (!wallet) return null;
  return {
    balanceCoins: wallet.balance_coins,
    lowBalanceThreshold: wallet.low_balance_threshold,
    recentTransactions: transactions.map(serializeWalletTransaction)
  };
};

export const serializeCoinPurchase = (purchase) => {
  if (!purchase) return null;
  return {
    id: purchase.id,
    orgId: purchase.org_id,
    coinPlanId: purchase.coin_plan_id,
    pricePaid: toNumber(purchase.price_paid),
    coinsCredited: purchase.coins_credited,
    couponCodeId: purchase.coupon_code_id,
    razorpayOrderId: purchase.razorpay_order_id,
    razorpayPaymentId: purchase.razorpay_payment_id,
    status: purchase.status,
    createdAt: purchase.created_at
  };
};

export const serializeCoinPlan = (plan) => {
  if (!plan) return null;
  return {
    id: plan.id,
    name: plan.name,
    priceInr: toNumber(plan.price_inr),
    coinsGranted: plan.coins_granted,
    bonusCoins: plan.bonus_coins,
    isActive: plan.is_active,
    sortOrder: plan.sort_order,
    createdAt: plan.created_at
  };
};

export const serializeCoupon = (coupon) => {
  if (!coupon) return null;
  return {
    id: coupon.id,
    code: coupon.code,
    scope: coupon.scope,
    discountType: coupon.discount_type,
    discountValue: toNumber(coupon.discount_value),
    maxUsesTotal: coupon.max_uses_total,
    maxUsesPerOrg: coupon.max_uses_per_org,
    validFrom: coupon.valid_from,
    validUntil: coupon.valid_until,
    isActive: coupon.is_active,
    createdBy: coupon.created_by,
    createdAt: coupon.created_at
  };
};

export const serializeOffer = (offer) => {
  if (!offer) return null;
  return {
    id: offer.id,
    name: offer.name,
    description: offer.description,
    bonusType: offer.bonus_type,
    bonusValue: toNumber(offer.bonus_value),
    appliesTo: offer.applies_to,
    startsAt: offer.starts_at,
    endsAt: offer.ends_at,
    isActive: offer.is_active,
    createdAt: offer.created_at
  };
};

export const serializeAuditLogEntry = (entry) => {
  if (!entry) return null;
  return {
    id: entry.id,
    orgId: entry.org_id,
    actorId: entry.actor_id,
    actorRole: entry.actor_role,
    action: entry.action,
    targetType: entry.target_type,
    targetId: entry.target_id,
    metadata: entry.metadata,
    createdAt: entry.created_at
  };
};

export const serializeOrganization = (org) => {
  if (!org) return null;
  return {
    id: org.id,
    name: org.name,
    premiseType: org.premise_type,
    contactEmail: org.contact_email,
    logoUrl: org.logo_url,
    theme: org.theme,
    planTier: org.plan_tier,
    dataPlaneType: org.data_plane_type,
    customDomain: org.custom_domain,
    allowAiCrawlers: org.allow_ai_crawlers,
    accountingWebhookUrl: org.accounting_webhook_url,
    createdAt: org.created_at
  };
};

export const serializeDeliveryRider = (rider) => {
  if (!rider) return null;
  return {
    id: rider.id,
    userId: rider.user_id,
    name: rider.name,
    phone: rider.phone,
    isActive: rider.is_active
  };
};

export const serializeNotification = (notification) => {
  if (!notification) return null;
  return {
    id: notification.id,
    orgId: notification.org_id,
    targetRole: notification.target_role,
    targetUserId: notification.target_user_id,
    type: notification.type,
    message: notification.message,
    isRead: notification.is_read,
    createdAt: notification.created_at
  };
};

export const serializeDeliveryZone = (zone) => {
  if (!zone) return null;
  return {
    id: zone.id,
    siteId: zone.site_id,
    pincode: zone.pincode,
    deliveryFee: toNumber(zone.delivery_fee),
    etaMinutes: zone.eta_minutes
  };
};
