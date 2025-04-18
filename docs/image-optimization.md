# Image Optimization Architecture

## Overview
This document outlines the image optimization system implemented in the Homeschool LMS application. The system uses Cloudinary's image optimization service in conjunction with Backblaze B2 storage to deliver optimized images efficiently while maintaining security.

## Architecture

### Components
1. **Backblaze B2**
   - Primary storage for original images
   - Provides secure, scalable object storage
   - Bucket MUST remain private (not publicly accessible)
   - All access must be authenticated via signed URLs

2. **Cloudinary**
   - Provides on-the-fly image optimization
   - Handles secure fetching from Backblaze B2
   - Supports various formats (WebP, JPEG, PNG)
   - Handles resizing and quality adjustments
   - Caches optimized images at the edge
   - Uses signed URLs for secure access

3. **Backend (FastAPI)**
   - Generates pre-signed URLs for Backblaze B2
   - Handles authentication and authorization
   - Constructs Cloudinary fetch URLs
   - Validates user permissions before generating URLs

### Flow Diagram
```
Frontend Request → Backend (signed URL) → Cloudinary (fetch + optimize) → Client
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
    
    # Construct Cloudinary fetch URL with optimizations
    cloudinary_url = construct_cloudinary_url(signed_url, width, height, quality)
    
    return {"url": cloudinary_url}
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

### Cloudinary Fetch URL
```
https://res.cloudinary.com/<cloud-name>/image/fetch/<transformation>/https://<bucket>.s3.<region>.backblazeb2.com/<path>?<auth-params>
```

## Configuration

### Environment Variables

#### Backend
```env
BACKBLAZE_ENDPOINT=https://s3.region.backblazeb2.com
BACKBLAZE_KEY_ID=your-key-id
BACKBLAZE_APPLICATION_KEY=your-application-key
BACKBLAZE_BUCKET_NAME=your-bucket-name
CLOUDINARY_CLOUD_NAME=your-cloud-name
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

3. **Bucket Configuration**
   - Bucket must be configured as private
   - No public access policies allowed
   - All access must be authenticated
   - Signed URLs required for all operations

4. **Cloudinary Security**
   - Allowed fetch domains properly configured
   - Secure URL signing maintained
   - Private bucket access preserved
   - Proper authentication flow

## Performance Optimizations

1. **Caching**
   - Cloudinary caches optimized images at edge locations
   - Browser caching headers properly set
   - Immutable cache for static images

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
   - Verify Cloudinary fetch settings

2. **Performance Issues**
   - Verify image dimensions
   - Check quality settings
   - Monitor cache hit rates
   - Check signed URL generation
   - Monitor Cloudinary response times

### Debug Tools
- Browser network inspector
- Backend logging
- Cloudinary dashboard
- Backblaze access logs

## References

- [Cloudinary Documentation](https://cloudinary.com/documentation)
- [Backblaze B2 API Docs](https://www.backblaze.com/b2/docs/)
- [FastAPI Documentation](https://fastapi.tiangolo.com/) 