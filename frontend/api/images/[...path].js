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
  console.log('Edge Function Request:', {
    url: req.url,
    method: req.method,
    headers: Object.fromEntries(req.headers)
  });

  const url = new URL(req.url);
  console.log('Parsed URL:', {
    pathname: url.pathname,
    search: url.search,
    origin: url.origin
  });

  const pathSegments = url.pathname.split('/').filter(Boolean);
  const imagePath = pathSegments.slice(2).join('/');
  console.log('Image Path:', imagePath);
  
  if (!imagePath) {
    console.log('Error: No image path provided');
    return new Response('Image path is required', { status: 400 });
  }

  try {
    // Initialize backblazeUrl variable for use in catch block
    let backblazeUrl;
    
    // Log environment variables
    console.log('Environment Variables:', {
      backblazeEndpoint: process.env.BACKBLAZE_ENDPOINT || 'NOT SET',
      bucketName: process.env.BACKBLAZE_BUCKET_NAME || 'NOT SET'
    });

    // Parse the image path which includes the bucket name
    const [bucketName, ...remainingPath] = imagePath.split('/');
    const actualImagePath = remainingPath.join('/');

    console.log('Parsed Path:', {
      bucketName,
      actualImagePath
    });

    // Get environment variables
    const backblazeEndpoint = process.env.BACKBLAZE_ENDPOINT;
    const configuredBucketName = process.env.BACKBLAZE_BUCKET_NAME;

    if (!backblazeEndpoint || !configuredBucketName) {
      throw new Error('Missing required environment variables: BACKBLAZE_ENDPOINT or BACKBLAZE_BUCKET_NAME');
    }

    // Add detailed logging for bucket name comparison
    console.log('Detailed Bucket Comparison:', {
      urlBucketName: bucketName,
      configuredBucketName: configuredBucketName,
      areEqual: bucketName === configuredBucketName,
      urlBucketNameLength: bucketName.length,
      configuredBucketNameLength: configuredBucketName.length,
      urlBucketNameTrimmed: bucketName.trim(),
      configuredBucketNameTrimmed: configuredBucketName.trim()
    });

    // Verify bucket name matches configuration (case-insensitive)
    if (bucketName.toLowerCase().trim() !== configuredBucketName.toLowerCase().trim()) {
      console.log('Bucket Name Mismatch:', {
        urlBucketName: bucketName,
        configuredBucketName
      });
      throw new Error('Invalid bucket name in URL');
    }

    // Check if this is a thumbnail request (has width or height parameters)
    const isThumbnailRequest = url.searchParams.has('width') || url.searchParams.has('height');
    
    // Don't modify the image path - use it as provided
    let modifiedImagePath = actualImagePath;
    
    // Log the path for debugging
    console.log('Using image path:', modifiedImagePath);
    
    // Construct the Backblaze B2 URL
    backblazeUrl = `${backblazeEndpoint}/${configuredBucketName}/${modifiedImagePath}`;
    console.log('Constructed Backblaze URL:', backblazeUrl);

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

    // Log the final Vercel image URL
    console.log('Final Vercel Image URL:', vercelImageUrl.toString());

    // Redirect to the Vercel-optimized image URL
    return Response.redirect(vercelImageUrl.toString(), 307);
  } catch (error) {
    console.error('Error serving image:', {
      error: error.message,
      stack: error.stack,
      url: req.url,
      imagePath,
      isThumbnailRequest: url.searchParams.has('width') || url.searchParams.has('height')
    });
    
    // Try to fetch the image directly as a fallback
    try {
      // Only attempt fallback if backblazeUrl is defined
      if (!backblazeUrl) {
        console.log('Cannot attempt fallback: backblazeUrl is not defined');
        throw new Error('Backblaze URL not available for fallback');
      }
      
      console.log('Attempting direct fetch fallback for:', backblazeUrl);
      const response = await fetch(backblazeUrl);
      
      if (response.ok) {
        console.log('Direct fetch successful, returning image');
        const imageData = await response.arrayBuffer();
        const contentType = response.headers.get('content-type') || 'image/jpeg';
        
        return new Response(imageData, {
          status: 200,
          headers: {
            'Content-Type': contentType,
            'Cache-Control': 'public, max-age=31536000, immutable'
          }
        });
      } else {
        console.error('Direct fetch failed:', response.status, response.statusText);
      }
    } catch (fallbackError) {
      console.error('Fallback fetch failed:', fallbackError.message);
    }
    
    return new Response(JSON.stringify({
      error: error.message,
      details: {
        url: req.url,
        imagePath,
        backblazeEndpoint: process.env.BACKBLAZE_ENDPOINT ? 'SET' : 'NOT SET',
        bucketName: process.env.BACKBLAZE_BUCKET_NAME ? 'SET' : 'NOT SET',
        requestParams: Object.fromEntries(url.searchParams.entries())
      }
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
}