# Image Optimization Architecture

## Overview
This document outlines the image optimization system implemented in the Homeschool LMS application. The system uses a secure proxy endpoint in conjunction with Vercel's image optimization service and Backblaze B2 storage to deliver optimized images efficiently while maintaining security.

## Architecture

### Components
1. **Backblaze B2**
   - Primary storage for original images
   - Provides secure, scalable object storage
   - Accessible via pre-signed URLs only
   - Bucket MUST remain private (not publicly accessible)
   - All access must be authenticated via signed URLs

2. **Backend (FastAPI)**
   - Generates pre-signed URLs for Backblaze B2
   - Handles authentication and authorization
   - Constructs URLs for image optimization
   - Validates user permissions before generating URLs

3. **Proxy Endpoint (Vercel Edge Function)**
   - Handles secure image retrieval from Backblaze
   - Uses signed URLs to access Backblaze B2
   - Provides proper caching headers
   - Runs on Vercel's edge network

4. **Vercel Image Optimization**
   - Provides on-the-fly image optimization
   - Supports various formats (WebP, JPEG, PNG)
   - Handles resizing and quality adjustments
   - Caches optimized images at the edge
   - Uses proxy endpoint for secure access

### Flow Diagram
```
Frontend Request → Backend (signed URL) → Proxy Endpoint → Vercel Image Optimization → Client
```

## Implementation Details

### Backend (FastAPI)

#### URL Generation Endpoint
```python
@router.get("/files/signed-url")
async def get_signed_url(
    file_path: str,
    width: Optional[int] = None,
    height: Optional[int] = None,
    quality: Optional[int] = 80
):
    # Generate signed URL for Backblaze
    signed_url = generate_backblaze_signed_url(file_path)
    
    # If optimization requested, construct proxy URL
    if width or height:
        proxy_url = f"{vercel_url}/api/images?url={encoded_signed_url}"
        return construct_optimized_url(proxy_url, width, height, quality)
    
    return {"signed_url": signed_url}
```

### Proxy Endpoint (Edge Function)
```javascript
export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const signedUrl = searchParams.get('url');
    
    // Fetch image using signed URL
    const response = await fetch(signedUrl);
    
    return new NextResponse(response.body, {
        headers: {
            'Content-Type': response.headers.get('content-type'),
            'Cache-Control': 'public, max-age=31536000, immutable'
        }
    });
}
```

### Frontend Components

#### ResponsiveImage Component
```jsx
<ResponsiveImage
  image={imageObject}
  width={800}
  height={600}
  quality={80}
/>
```

#### LazyImage Component
```jsx
<LazyImage
  image={imageObject}
  width={800}
  height={600}
  quality={80}
/>
```

## URL Structure

### Original Backblaze URL (Signed)
```
https://<bucket>.s3.<region>.backblazeb2.com/<path>?X-Amz-Algorithm=...&X-Amz-Credential=...&X-Amz-Date=...&X-Amz-Expires=...&X-Amz-SignedHeaders=...&X-Amz-Signature=...
```

### Proxy URL
```
https://<vercel-domain>/api/images?url=<encoded-signed-url>
```

### Optimized Vercel URL
```
https://<vercel-domain>/_vercel/image?url=<proxy-url>&w=800&h=600&q=80
```

## Configuration

### Environment Variables

#### Backend
```env
BACKBLAZE_ENDPOINT=https://s3.region.backblazeb2.com
BACKBLAZE_KEY_ID=your-key-id
BACKBLAZE_APPLICATION_KEY=your-application-key
BACKBLAZE_BUCKET_NAME=your-bucket-name
```

#### Frontend
```env
VITE_USE_SIGNED_IMAGES=true
```

## Security Considerations

1. **URL Signing**
   - All Backblaze URLs are signed with expiration
   - Signatures generated server-side only
   - Expiration time configurable (default: 1 hour)
   - Bucket MUST remain private
   - No public access allowed to bucket

2. **Access Control**
   - Backend validates user permissions
   - File paths validated against user access
   - Rate limiting implemented on URL generation
   - Signed URLs required for all access
   - Proxy endpoint runs on edge network

3. **Bucket Configuration**
   - Bucket must be configured as private
   - No public access policies allowed
   - All access must be authenticated
   - Signed URLs required for all operations

4. **Proxy Security**
   - Runs on Vercel's edge network
   - Handles signed URLs securely
   - Implements proper caching
   - Validates responses

## Performance Optimizations

1. **Caching**
   - Vercel caches optimized images at edge locations
   - Browser caching headers properly set
   - Immutable cache for static images
   - Proxy responses cached appropriately

2. **Lazy Loading**
   - Images load only when entering viewport
   - Placeholder shown during loading
   - Progressive loading for larger images

3. **Responsive Sizing**
   - Automatic size detection based on container
   - Device pixel ratio considered
   - WebP format used when supported

## Best Practices

1. **Image Requests**
   - Always specify desired dimensions
   - Use appropriate quality settings
   - Include width and height attributes
   - Always use signed URLs
   - Never expose bucket publicly

2. **Error Handling**
   - Fallback images for errors
   - Retry logic for failed requests
   - User-friendly error messages
   - Log failed authentication attempts

3. **Maintenance**
   - Monitor URL expiration
   - Clean up unused images
   - Regular performance audits
   - Regular security audits
   - Verify bucket remains private

## Future Improvements

1. **Planned Enhancements**
   - Content-aware cropping
   - Automatic format selection
   - Background removal API
   - Watermarking capabilities
   - Enhanced security monitoring

2. **Monitoring**
   - Implementation of usage metrics
   - Performance tracking
   - Cost optimization analysis
   - Security audit logging

## Troubleshooting

### Common Issues

1. **404 Errors**
   - Check file path validity
   - Verify URL signing
   - Confirm Backblaze permissions
   - Verify bucket is private
   - Check signed URL expiration
   - Verify proxy endpoint configuration

2. **Performance Issues**
   - Verify image dimensions
   - Check quality settings
   - Monitor cache hit rates
   - Check signed URL generation
   - Monitor proxy response times

### Debug Tools
- Browser network inspector
- Backend logging
- Vercel deployment logs
- Backblaze access logs
- Proxy endpoint logs

## References

- [Vercel Image Optimization Docs](https://vercel.com/docs/concepts/image-optimization)
- [Backblaze B2 API Docs](https://www.backblaze.com/b2/docs/)
- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [Vercel Edge Functions](https://vercel.com/docs/concepts/functions/edge-functions) 