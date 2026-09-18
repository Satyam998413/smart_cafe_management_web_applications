import { NextResponse } from 'next/server';
import supabase from '@/lib/supabaseClient.js';
import logger from '@/lib/logger.js';
import { requireAuth } from '@/lib/auth.js';
import { serializeHardwareItem } from '@/lib/serializers.js';

// POST /api/admin/hardware-catalog/upload — Uploads 1 to 5 images for a hardware catalog item
// Storage bucket path: hardware/{id}/images/{filename}
export async function POST(request) {
  const auth = requireAuth(request);
  if (auth.error) return auth.error;

  const allowedRoles = ['master_admin', 'technician'];
  if (!auth.isMasterAdmin && !allowedRoles.includes(auth.userRole)) {
    return NextResponse.json({ message: 'Insufficient permissions' }, { status: 403 });
  }

  try {
    const formData = await request.formData();
    const hardwareId = formData.get('hardwareId');
    const imageUrlsParam = formData.get('imageUrls'); // JSON array of up to 5 URL strings if provided directly
    const files = formData.getAll('files'); // File blobs if uploading form files

    if (!hardwareId) {
      return NextResponse.json({ message: 'hardwareId is required' }, { status: 400 });
    }

    let uploadedUrls = [];

    // Parse existing or passed image URLs if available
    if (imageUrlsParam) {
      try {
        const parsed = JSON.parse(imageUrlsParam);
        if (Array.isArray(parsed)) uploadedUrls = parsed;
      } catch {
        uploadedUrls = [imageUrlsParam];
      }
    }

    // Process file uploads to bucket hardware/{id}/images/
    for (const file of files) {
      if (file && typeof file.arrayBuffer === 'function') {
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);
        const fileName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
        const filePath = `${hardwareId}/images/${fileName}`;

        // Attempt Supabase storage upload to bucket 'hardware'
        const { error: storageError } = await supabase.storage
          .from('hardware')
          .upload(filePath, buffer, {
            contentType: file.type || 'image/jpeg',
            upsert: true
          });

        if (!storageError) {
          const { data: publicUrlData } = supabase.storage.from('hardware').getPublicUrl(filePath);
          if (publicUrlData?.publicUrl) {
            uploadedUrls.push(publicUrlData.publicUrl);
          }
        } else {
          logger.warn('Storage upload fallback, converting to data URI', { error: storageError.message });
          const base64 = buffer.toString('base64');
          const mimeType = file.type || 'image/jpeg';
          uploadedUrls.push(`data:${mimeType};base64,${base64}`);
        }
      }
    }

    // Enforce 1 to 5 images limit
    if (uploadedUrls.length === 0) {
      return NextResponse.json({ message: 'At least 1 image is required (min 1, max 5 images).' }, { status: 400 });
    }
    if (uploadedUrls.length > 5) {
      uploadedUrls = uploadedUrls.slice(0, 5); // Cap at max 5 images
    }

    const imageUrlsJson = JSON.stringify(uploadedUrls);

    const { data: updatedItem, error } = await supabase
      .from('hardware_catalog')
      .update({
        image_url: imageUrlsJson
      })
      .eq('id', hardwareId)
      .select('*')
      .single();

    if (error) throw error;

    logger.info('Uploaded hardware catalog images', { hardwareId, count: uploadedUrls.length });
    return NextResponse.json(serializeHardwareItem(updatedItem));
  } catch (error) {
    logger.error('Failed to upload hardware images', { error: error.message });
    return NextResponse.json({ message: 'Server error uploading hardware images' }, { status: 500 });
  }
}
