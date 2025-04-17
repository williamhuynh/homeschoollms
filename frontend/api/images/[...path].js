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
    
    // Construct the Backblaze B2 URL with bucket name as subdomain
    // Format: https://<bucket_name>.s3.us-east-005.backblazeb2.com/<path>
    const backblazeHost = backblazeEndpoint.replace('https://', '');
    console.log('Backblaze host:', backblazeHost);
    console.log('Configured bucket name:', configuredBucketName);
    backblazeUrl = `https://${configuredBucketName}.${backblazeHost}/${modifiedImagePath}`;
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

    // For debugging, let's try to fetch the image directly from Backblaze first
    try {
      // Prepare headers for the fetch request
      const headers = new Headers();
      
      // Add Backblaze authentication if credentials are available
      if (backblazeKeyId && backblazeApplicationKey) {
        // Create Base64 encoded credentials (keyId:applicationKey)
        const credentials = `${backblazeKeyId}:${backblazeApplicationKey}`;
        
        // Log the credential format (without revealing full credentials)
        console.log('Credential format check:', {
          format: 'keyId:applicationKey',
          keyIdLength: backblazeKeyId.length,
          applicationKeyLength: backblazeApplicationKey.length,
          keyIdFirstFive: backblazeKeyId.substring(0, 5) + '...',
          totalLength: credentials.length,
          containsColon: credentials.includes(':'),
          colonPosition: credentials.indexOf(':')
        });
        
        // Fix: Use btoa instead of Buffer.from for more reliable Base64 encoding in Edge runtime
        // btoa is more widely supported in browser-like environments like Edge
        let encodedCredentials;
        try {
          // First try using btoa which is more reliable in edge environments
          encodedCredentials = btoa(credentials);
          console.log('Using btoa for encoding credentials');
        } catch (e) {
          // Fall back to Buffer if btoa is not available
          try {
            encodedCredentials = Buffer.from(credentials).toString('base64');
            console.log('Falling back to Buffer.from for encoding credentials');
          } catch (bufferError) {
            console.error('Both encoding methods failed:', bufferError.message);
            console.log('Attempting fetch without authentication');
            encodedCredentials = null;
          }
        }
        
        // Only add authentication header if encoding succeeded
        if (encodedCredentials) {
          // Add detailed debugging for authentication
          console.log('Auth debugging:', {
            credentialsLength: credentials.length,
            encodedCredentialsLength: encodedCredentials.length,
            // Log first few chars of encoded string (safe to log partial)
            encodedCredentialsStart: encodedCredentials.substring(0, 10) + '...',
            authHeaderFormat: `Basic ${encodedCredentials.substring(0, 10)}...`
          });
          
          // Set the authorization header
          headers.append('Authorization', `Basic ${encodedCredentials}`);
          console.log('Adding Backblaze authentication to fetch request');
        }
      } else {
        console.log('Backblaze credentials not available, attempting fetch without authentication');
      }
      
      console.log('Attempting direct fetch from Backblaze:', backblazeUrl);
      const response = await fetch(backblazeUrl, { headers });
      
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
        
        // Try to get more details about the error
        try {
          const errorText = await response.text();
          console.error('Backblaze error details:', errorText);
          
          // Additional debugging for auth errors
          if (errorText.includes('Authorization') || errorText.includes('Auth')) {
            console.error('Auth error detected. Headers sent:', {
              authHeader: headers.get('Authorization')?.replace(/Basic\s+(.{10}).*/, 'Basic $1...'),
              contentType: headers.get('Content-Type'),
              accept: headers.get('Accept'),
              // Log all headers for debugging
              allHeaders: [...headers.entries()].map(([key, value]) =>
                key.toLowerCase() === 'authorization'
                  ? `${key}: Basic ***`
                  : `${key}: ${value}`
              )
            });
            
            // Try without authentication in case the bucket is public
            console.log('Attempting fetch without authentication as fallback');
            const publicHeaders = new Headers();
            const publicResponse = await fetch(backblazeUrl, { headers: publicHeaders });
            
            if (publicResponse.ok) {
              console.log('Public fetch successful, bucket might be public');
              const imageData = await publicResponse.arrayBuffer();
              const contentType = publicResponse.headers.get('content-type') || 'image/jpeg';
              
              return new Response(imageData, {
                status: 200,
                headers: {
                  'Content-Type': contentType,
                  'Cache-Control': 'public, max-age=31536000, immutable'
                }
              });
            } else {
              console.error('Public fetch also failed:', publicResponse.status, publicResponse.statusText);
            }
          }
        } catch (textError) {
          console.error('Could not read error details:', textError.message);
        }
        
        // Fall back to Vercel optimization
      }
    } catch (directFetchError) {
      console.error('Direct fetch error:', directFetchError.message, directFetchError.stack);
      // Fall back to Vercel optimization
    }

    // Redirect to the Vercel-optimized image URL as fallback
    console.log('Falling back to Vercel optimization:', vercelImageUrl.toString());
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
      
      // Prepare headers for the fetch request
      const headers = new Headers();
      
      // Add Backblaze authentication if credentials are available
      if (backblazeKeyId && backblazeApplicationKey) {
        try {
          // Create Base64 encoded credentials (keyId:applicationKey)
          const credentials = `${backblazeKeyId}:${backblazeApplicationKey}`;
          
          // Log the credential format (without revealing full credentials)
          console.log('Credential format check:', {
            format: 'keyId:applicationKey',
            keyIdLength: backblazeKeyId.length,
            applicationKeyLength: backblazeApplicationKey.length,
            keyIdFirstFive: backblazeKeyId.substring(0, 5) + '...',
            totalLength: credentials.length,
            containsColon: credentials.includes(':'),
            colonPosition: credentials.indexOf(':')
          });
          
          // Fix: Use btoa instead of Buffer.from for more reliable Base64 encoding in Edge runtime
          let encodedCredentials;
          try {
            // First try using btoa which is more reliable in edge environments
            encodedCredentials = btoa(credentials);
            console.log('Using btoa for encoding credentials');
          } catch (e) {
            // Fall back to Buffer if btoa is not available
            try {
              encodedCredentials = Buffer.from(credentials).toString('base64');
              console.log('Falling back to Buffer.from for encoding credentials');
            } catch (bufferError) {
              console.error('Both encoding methods failed:', bufferError.message);
              console.log('Attempting fetch without authentication');
              encodedCredentials = null;
            }
          }
          
          console.log('Auth fallback debugging:', {
            credentialsLength: credentials.length,
            encodedCredentialsLength: encodedCredentials.length,
            // Log first few chars (safe to log partial)
            encodedCredentialsStart: encodedCredentials.substring(0, 10) + '...'
          });
          
          headers.append('Authorization', `Basic ${encodedCredentials}`);
          console.log('Adding Backblaze authentication to fallback fetch request');
        } catch (authError) {
          console.error('Error creating auth header:', authError.message);
          console.log('Attempting fallback fetch without authentication');
        }
      } else {
        console.log('Backblaze credentials not available, attempting fallback fetch without authentication');
      }
      
      console.log('Attempting direct fetch fallback for:', backblazeUrl);
      const response = await fetch(backblazeUrl, { headers });
      
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
        console.error('Fallback fetch failed:', response.status, response.statusText);
        
        // Try to get more details about the error
        try {
          const errorText = await response.text();
          console.error('Backblaze fallback error details:', errorText);
        } catch (textError) {
          console.error('Could not read fallback error details:', textError.message);
        }
      }
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