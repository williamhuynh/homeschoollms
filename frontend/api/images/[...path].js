// Vercel Edge Function for serving and optimizing images from Backblaze B2
// This file should be placed in the /api/images directory in your Vercel project

export const config = {
  runtime: 'edge',
};

/**
 * Edge function to proxy and optimize images from Backblaze B2 using Vercel's image optimization
 *
 * URL format: /api/images/[path]?width=300&height=200&quality=80
 */
export default async function handler(req) {
  const url = new URL(req.url);
  const pathSegments = url.pathname.split('/').filter(Boolean);
  const imagePath = pathSegments.slice(2).join('/');
  
  if (!imagePath) {
    return new Response('Image path is required', { status: 400 });
  }

  try {
    // Construct the Backblaze B2 URL
    const backblazeEndpoint = process.env.BACKBLAZE_ENDPOINT;
    const bucketName = process.env.BACKBLAZE_BUCKET_NAME;
    const backblazeUrl = `${backblazeEndpoint}/${bucketName}/${imagePath}`;

    // Redirect to Vercel's image optimization endpoint
    const vercelImageUrl = new URL('/_vercel/image', url.origin);
    vercelImageUrl.searchParams.set('url', backblazeUrl);
    
    // Copy any transformation parameters
    if (url.searchParams.has('width')) {
      vercelImageUrl.searchParams.set('w', url.searchParams.get('width'));
    }
    if (url.searchParams.has('height')) {
      vercelImageUrl.searchParams.set('h', url.searchParams.get('height'));
    }
    if (url.searchParams.has('quality')) {
      vercelImageUrl.searchParams.set('q', url.searchParams.get('quality'));
    }

    // Set default quality if not specified
    if (!url.searchParams.has('quality')) {
      vercelImageUrl.searchParams.set('q', '80');
    }

    // Redirect to the Vercel-optimized image URL
    return Response.redirect(vercelImageUrl.toString(), 307);
  } catch (error) {
    console.error('Error serving image:', error);
    return new Response(`Error serving image: ${error.message}`, {
      status: 500,
    });
  }
}