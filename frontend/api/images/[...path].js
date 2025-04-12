// Vercel Edge Function for serving and optimizing images from Backblaze B2
// This file should be placed in the /api/images directory in your Vercel project

import { createClient } from '@vercel/edge';
import sharp from 'sharp';

// Cache configuration
const CACHE_CONTROL = {
  public: true,
  maxAge: 60 * 60 * 24 * 7, // 7 days
  staleWhileRevalidate: 60 * 60 * 24 * 30, // 30 days
};

export const config = {
  runtime: 'edge',
};

/**
 * Edge function to proxy and optimize images from Backblaze B2
 * 
 * URL format: /api/images/[path]?width=300&height=200&format=webp
 * 
 * Query parameters:
 * - width: desired width (optional)
 * - height: desired height (optional)
 * - format: desired format (webp, jpeg, png) (optional)
 * - quality: image quality (1-100) (optional, default: 80)
 */
export default async function handler(req) {
  // Get the image path from the URL
  const url = new URL(req.url);
  const pathSegments = url.pathname.split('/').filter(Boolean);
  
  // Remove 'api' and 'images' from the path
  const imagePath = pathSegments.slice(2).join('/');
  
  if (!imagePath) {
    return new Response('Image path is required', { status: 400 });
  }

  // Get query parameters for image transformations
  const width = parseInt(url.searchParams.get('width') || '0', 10);
  const height = parseInt(url.searchParams.get('height') || '0', 10);
  const format = url.searchParams.get('format');
  const quality = parseInt(url.searchParams.get('quality') || '80', 10);

  try {
    // Construct the Backblaze B2 URL
    const backblazeEndpoint = process.env.BACKBLAZE_ENDPOINT;
    const bucketName = process.env.BACKBLAZE_BUCKET_NAME;
    const backblazeUrl = `${backblazeEndpoint}/${bucketName}/${imagePath}`;

    // Fetch the image from Backblaze B2
    const response = await fetch(backblazeUrl);
    
    if (!response.ok) {
      return new Response(`Failed to fetch image: ${response.statusText}`, {
        status: response.status,
      });
    }

    // Get the image data
    const imageData = await response.arrayBuffer();
    
    // Set appropriate content type based on the image format or original content type
    let contentType = response.headers.get('content-type');
    
    // Check if we need to transform the image
    const needsTransformation = width > 0 || height > 0 || format;
    
    if (needsTransformation) {
      let transformer = sharp(Buffer.from(imageData));
      
      // Apply resize if width or height is specified
      if (width > 0 || height > 0) {
        transformer = transformer.resize(width || null, height || null, {
          fit: 'inside',
          withoutEnlargement: true,
        });
      }
      
      // Apply format conversion if specified
      if (format) {
        switch (format.toLowerCase()) {
          case 'webp':
            transformer = transformer.webp({ quality });
            contentType = 'image/webp';
            break;
          case 'jpeg':
          case 'jpg':
            transformer = transformer.jpeg({ quality });
            contentType = 'image/jpeg';
            break;
          case 'png':
            transformer = transformer.png({ quality });
            contentType = 'image/png';
            break;
          case 'avif':
            transformer = transformer.avif({ quality });
            contentType = 'image/avif';
            break;
        }
      }
      
      // Transform the image
      const transformedImageData = await transformer.toBuffer();
      
      return new Response(transformedImageData, {
        headers: {
          'Content-Type': contentType,
          'Cache-Control': `public, max-age=${CACHE_CONTROL.maxAge}, stale-while-revalidate=${CACHE_CONTROL.staleWhileRevalidate}`,
          'Content-Length': transformedImageData.byteLength.toString(),
          'Access-Control-Allow-Origin': '*',
        },
      });
    }
    
    // Return the original image with caching headers
    return new Response(imageData, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': `public, max-age=${CACHE_CONTROL.maxAge}, stale-while-revalidate=${CACHE_CONTROL.staleWhileRevalidate}`,
        'Content-Length': imageData.byteLength.toString(),
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    console.error('Error serving image:', error);
    return new Response(`Error serving image: ${error.message}`, {
      status: 500,
    });
  }
}