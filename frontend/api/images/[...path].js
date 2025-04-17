// Vercel Edge Function for serving and optimizing images from Backblaze B2
// This file should be placed in the /api/images directory in your Vercel project

export const config = {
  runtime: 'edge',
};

/**
 * Creates an AWS v4 signature for Backblaze requests
 * 
 * @param {string} keyId - Backblaze application key ID
 * @param {string} applicationKey - Backblaze application key
 * @param {string} method - HTTP method (e.g., 'GET')
 * @param {string} host - Host to use for the request (e.g., 'bucket.s3.region.backblazeb2.com')
 * @param {string} path - Path to the resource (e.g., '/path/to/image.jpg')
 * @param {string} region - Backblaze region (default: 'us-east-005')
 * @param {Record<string,string>} [query={}] - Query parameters
 * @param {Record<string,string>} [headers={}] - Request headers
 * @returns {Promise<Record<string,string>>} - Headers to use for the request
 */
async function generateBackblazeHeaders(keyId, applicationKey, method, host, path, region = 'us-east-005', query = {}, headers = {}) {
  console.log('Generating AWS v4 signature for Backblaze with:', {
    method,
    host,
    path,
    region,
    keyIdPrefix: keyId.substring(0, 5) + '...'
  });

  // Current time in specific format required for AWS v4 signature
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);

  // Add required headers
  const signedHeaders = {
    'host': host,
    'x-amz-date': amzDate,
    'x-amz-content-sha256': 'UNSIGNED-PAYLOAD',
    ...headers
  };

  // Step 1: Create a canonical request
  const queryString = Object.keys(query).sort().map(key => 
    `${encodeURIComponent(key)}=${encodeURIComponent(query[key])}`
  ).join('&');

  const canonicalHeaders = Object.keys(signedHeaders).sort().map(key => 
    `${key.toLowerCase()}:${signedHeaders[key]}\n`
  ).join('');

  const signedHeadersString = Object.keys(signedHeaders).sort().join(';');

  const canonicalRequest = [
    method,
    path,
    queryString,
    canonicalHeaders,
    signedHeadersString,
    'UNSIGNED-PAYLOAD'
  ].join('\n');

  // Step 2: Create a string to sign
  const algorithm = 'AWS4-HMAC-SHA256';
  const credentialScope = `${dateStamp}/${region}/s3/aws4_request`;
  const stringToSign = [
    algorithm,
    amzDate,
    credentialScope,
    await sha256(canonicalRequest)
  ].join('\n');

  // Step 3: Calculate the signature
  const signingKey = await getSignatureKey(applicationKey, dateStamp, region, 's3');
  const signature = await hmacSha256(signingKey, stringToSign);

  // Step 4: Create authorization header
  const authorizationHeader = [
    `${algorithm} Credential=${keyId}/${credentialScope}`,
    `SignedHeaders=${signedHeadersString}`,
    `Signature=${signature}`
  ].join(', ');

  // Return complete set of headers
  return {
    ...signedHeaders,
    'Authorization': authorizationHeader
  };
}

// Helper function for SHA-256 hash
async function sha256(message) {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// Helper function for HMAC-SHA256
async function hmacSha256(key, message) {
  const keyBuffer = key instanceof ArrayBuffer ? key : 
    new TextEncoder().encode(key);
  const messageBuffer = new TextEncoder().encode(message);

  const importedKey = await crypto.subtle.importKey(
    'raw', 
    keyBuffer, 
    { name: 'HMAC', hash: 'SHA-256' }, 
    false, 
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', importedKey, messageBuffer);

  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// Helper function to derive the signing key
async function getSignatureKey(key, dateStamp, region, service) {
  const kDate = await hmacSha256(`AWS4${key}`, dateStamp);
  const kRegion = await hmacSha256(hexToArrayBuffer(kDate), region);
  const kService = await hmacSha256(hexToArrayBuffer(kRegion), service);
  const kSigning = await hmacSha256(hexToArrayBuffer(kService), 'aws4_request');
  return hexToArrayBuffer(kSigning);
}

// Helper to convert hex string to ArrayBuffer
function hexToArrayBuffer(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i/2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes.buffer;
}

/**
 * Edge function to proxy and optimize images from Backblaze B2 using Vercel's image optimization
 *
 * URL format: /api/images/[path]?width=300&height=200&quality=80
 */
export default async function handler(req) {
  // Add a clear marker to identify Edge Function logs
  console.log('🔄 EDGE FUNCTION EXECUTING 🔄');
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

  // Log all environment variables (excluding sensitive ones)
  console.log('Environment Variables:', {
    NODE_ENV: process.env.NODE_ENV,
    VERCEL_ENV: process.env.VERCEL_ENV,
    VERCEL_REGION: process.env.VERCEL_REGION,
    EDGE_DEBUG: process.env.EDGE_DEBUG,
    BACKBLAZE_ENDPOINT: process.env.BACKBLAZE_ENDPOINT ? 'SET' : 'NOT SET',
    BACKBLAZE_BUCKET_NAME: process.env.BACKBLAZE_BUCKET_NAME ? 'SET' : 'NOT SET'
  });

  const pathSegments = url.pathname.split('/').filter(Boolean);
  const imagePath = pathSegments.slice(2).join('/');
  console.log('Image Path:', imagePath);
  
  if (!imagePath) {
    console.log('Error: No image path provided');
    return new Response('Image path is required', { status: 400 });
  }

  // Initialize variables for use in both try and catch blocks
  let backblazeUrl;
  let backblazeEndpoint;
  let configuredBucketName;
  let authToken = null;
  let backblazeKeyId;
  let backblazeApplicationKey;
  let modifiedImagePath;
  let actualImagePath;
  
  try {
    // Log environment variables
    backblazeKeyId = process.env.BACKBLAZE_KEY_ID || '';
    backblazeApplicationKey = process.env.BACKBLAZE_APPLICATION_KEY || '';
    
    console.log('Environment Variables:', {
      backblazeEndpoint: process.env.BACKBLAZE_ENDPOINT || 'NOT SET',
      bucketName: process.env.BACKBLAZE_BUCKET_NAME || 'NOT SET',
      backblazeKeyId: backblazeKeyId ? `${backblazeKeyId.substring(0, 5)}...` : 'NOT SET',
      backblazeApplicationKey: backblazeApplicationKey ? 'SET (hidden)' : 'NOT SET'
    });

    // Parse the image path which includes the bucket name
    const [bucketName, ...remainingPath] = imagePath.split('/');
    const actualImagePath = remainingPath.join('/');

    console.log('Parsed Path:', {
      bucketName,
      actualImagePath
    });

    // Get environment variables or use hardcoded values for testing
    const backblazeEndpoint = process.env.BACKBLAZE_ENDPOINT || 'https://s3.us-east-005.backblazeb2.com';
    const configuredBucketName = process.env.BACKBLAZE_BUCKET_NAME || 'homeschoollms';

    console.log('Using Backblaze endpoint:', backblazeEndpoint);
    console.log('Using bucket name:', configuredBucketName);
    
    // Check for authentication token
    if (url.searchParams.has('auth_token')) {
      authToken = url.searchParams.get('auth_token');
      console.log('Auth token provided in URL');
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
    
    // For the Backblaze URL, we need to ensure we're using the full path
    // The URL structure should be: https://homeschoollms.s3.us-east-005.backblazeb2.com/evidence/...
    
    // We'll use the full modifiedImagePath which should already include the "evidence/" prefix
    console.log('Full image path for Backblaze:', modifiedImagePath);
    
    // Extract region from the backblaze endpoint
    const regionMatch = backblazeEndpoint.match(/s3\.([^.]+)\.backblazeb2\.com/);
    const region = regionMatch ? regionMatch[1] : 'us-east-005';
    
    // Construct the Backblaze B2 URL with bucket name as subdomain
    // Format: https://<bucket_name>.s3.us-east-005.backblazeb2.com/<path>
    const backblazeHost = backblazeEndpoint.replace('https://', '');
    const bucketHost = `${configuredBucketName}.${backblazeHost}`;
    console.log('Backblaze host:', backblazeHost);
    console.log('Configured bucket name:', configuredBucketName);
    backblazeUrl = `https://${bucketHost}/${modifiedImagePath}`;
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
    
    // Pass the auth token to the Vercel image optimization endpoint if available
    if (authToken) {
      vercelImageUrl.searchParams.set('auth_token', authToken);
      console.log('Adding auth_token to Vercel image URL');
    }

    // Log the final Vercel image URL and all the details
    console.log('Final Image URLs:', {
      originalUrl: req.url,
      backblazeUrl: backblazeUrl,
      vercelImageUrl: vercelImageUrl.toString(),
      pathSegments: pathSegments,
      bucketName: bucketName,
      actualImagePath: actualImagePath,
      fullImagePath: modifiedImagePath
    });

    // Helper function to fetch an image directly from Backblaze
    async function fetchImageFromBackblaze(imageUrl, path) {
      try {
        console.log('Attempting to fetch from Backblaze:', imageUrl);
        
        // Only try authentication if we have credentials
        let headers = new Headers();
        
        if (backblazeKeyId && backblazeApplicationKey) {
          try {
            // Parse URL to get host and path
            const parsedUrl = new URL(imageUrl);
            
            // Generate signed headers using AWS v4 signature
            const signedHeaders = await generateBackblazeHeaders(
              backblazeKeyId,
              backblazeApplicationKey,
              'GET',
              parsedUrl.host,
              parsedUrl.pathname,
              region
            );
            
            // Set headers for the request
            headers = new Headers(signedHeaders);
            console.log('Generated authenticated headers for Backblaze request');
          } catch (authError) {
            console.error('Error generating authenticated headers:', authError.message);
            // Continue with unauthenticated request as fallback
          }
        } else {
          console.log('Backblaze credentials not available, will try unauthenticated request');
        }
        
        // Make the request
        const response = await fetch(imageUrl, { headers });
        
        if (response.ok) {
          console.log('Fetch successful, returning image data');
          const imageData = await response.arrayBuffer();
          const contentType = response.headers.get('content-type') || 'image/jpeg';
          
          return {
            data: imageData,
            contentType,
            success: true
          };
        } else {
          console.error('Fetch failed:', response.status, response.statusText);
          let errorDetails = '';
          try {
            errorDetails = await response.text();
            console.error('Error details:', errorDetails);
          } catch (e) {
            console.error('Could not read error details');
          }
          
          return {
            success: false,
            status: response.status,
            statusText: response.statusText,
            errorDetails
          };
        }
      } catch (error) {
        console.error('Fetch error:', error.message);
        return {
          success: false,
          error: error.message
        };
      }
    }
    
    // Try to fetch the image directly from Backblaze with authentication
    const fetchResult = await fetchImageFromBackblaze(backblazeUrl, `/${modifiedImagePath}`);
    
    if (fetchResult.success) {
      return new Response(fetchResult.data, {
        status: 200,
        headers: {
          'Content-Type': fetchResult.contentType,
          'Cache-Control': 'public, max-age=31536000, immutable'
        }
      });
    }
    
    // If direct fetch failed, fall back to Vercel optimization
    console.log('Direct fetch failed, falling back to Vercel optimization:', vercelImageUrl.toString());
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
      // Only attempt fallback if we can construct a valid Backblaze URL
      if (!configuredBucketName || !backblazeEndpoint || !modifiedImagePath) {
        console.log('Cannot attempt fallback: missing required parameters for Backblaze URL');
        throw new Error('Missing parameters for Backblaze URL construction');
      }
      
      // Reconstruct the Backblaze URL for the fallback attempt
      const backblazeHost = backblazeEndpoint.replace('https://', '');
      backblazeUrl = `https://${configuredBucketName}.${backblazeHost}/${modifiedImagePath}`;
      console.log('Reconstructed Backblaze URL for fallback:', backblazeUrl);
      
      // Extract region from the backblaze endpoint
      const regionMatch = backblazeEndpoint.match(/s3\.([^.]+)\.backblazeb2\.com/);
      const region = regionMatch ? regionMatch[1] : 'us-east-005';
      
      // Try fetching directly from Backblaze with authentication as fallback
      const fallbackResult = await fetchImageFromBackblaze(backblazeUrl, `/${modifiedImagePath}`);
      
      if (fallbackResult.success) {
        return new Response(fallbackResult.data, {
          status: 200,
          headers: {
            'Content-Type': fallbackResult.contentType,
            'Cache-Control': 'public, max-age=31536000, immutable'
          }
        });
      }
      
      // All attempts failed, return detailed error information
      return new Response(JSON.stringify({
        error: error.message,
        details: {
          url: req.url,
          imagePath,
          backblazeEndpoint: backblazeEndpoint || (process.env.BACKBLAZE_ENDPOINT ? 'SET' : 'NOT SET'),
          bucketName: configuredBucketName || (process.env.BACKBLAZE_BUCKET_NAME ? 'SET' : 'NOT SET'),
          backblazeAuthAvailable: !!(backblazeKeyId && backblazeApplicationKey),
          actualImagePath: actualImagePath || 'NOT SET',
          modifiedImagePath: modifiedImagePath || 'NOT SET',
          constructedUrl: backblazeUrl || 'NOT CONSTRUCTED',
          requestParams: Object.fromEntries(url.searchParams.entries()),
          fetchResult: fallbackResult
        }
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    } catch (fallbackError) {
      console.error('Fallback fetch failed:', fallbackError.message, fallbackError.stack);
    }
    
    return new Response(JSON.stringify({
      error: error.message,
      details: {
        url: req.url,
        imagePath,
        backblazeEndpoint: backblazeEndpoint || (process.env.BACKBLAZE_ENDPOINT ? 'SET' : 'NOT SET'),
        bucketName: configuredBucketName || (process.env.BACKBLAZE_BUCKET_NAME ? 'SET' : 'NOT SET'),
        backblazeAuthAvailable: !!(backblazeKeyId && backblazeApplicationKey),
        actualImagePath: actualImagePath || 'NOT SET',
        modifiedImagePath: modifiedImagePath || 'NOT SET',
        constructedUrl: backblazeUrl || 'NOT CONSTRUCTED',
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