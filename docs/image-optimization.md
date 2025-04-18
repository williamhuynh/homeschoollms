# Image Optimization Architecture

## Overview
This document outlines the image optimization system implemented in the Homeschool LMS application. The system uses Vercel's built-in image optimization service in conjunction with Backblaze B2 storage to deliver optimized images efficiently.

## Architecture

### Components
1. **Backblaze B2**
   - Primary storage for original images
   - Provides secure, scalable object storage
   - Accessible via pre-signed URLs

2. **Backend (FastAPI)**
   - Generates pre-signed URLs for Backblaze B2
   - Handles authentication and authorization
   - Constructs URLs for Vercel's image optimization

3. **Vercel Image Optimization**
   - Provides on-the-fly image optimization
   - Supports various formats (WebP, JPEG, PNG)
   - Handles resizing and quality adjustments
   - Caches optimized images at the edge

### Flow Diagram
```
Frontend Request → Backend (signed URL) → Vercel Image Optimization → Backblaze B2 → Client
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
    
    # If optimization requested, wrap with Vercel optimization
    if width or height:
        return construct_optimized_url(signed_url, width, height, quality)
    
    return {"signed_url": signed_url}
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

### Original Backblaze URL
```
https://<bucket>.s3.<region>.backblazeb2.com/<path>
```

### Optimized Vercel URL
```
https://<vercel-domain>/_vercel/image?url=<encoded-backblaze-url>&w=800&h=600&q=80
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

2. **Access Control**
   - Backend validates user permissions
   - File paths validated against user access
   - Rate limiting implemented on URL generation

## Performance Optimizations

1. **Caching**
   - Vercel caches optimized images at edge locations
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

2. **Error Handling**
   - Fallback images for errors
   - Retry logic for failed requests
   - User-friendly error messages

3. **Maintenance**
   - Monitor URL expiration
   - Clean up unused images
   - Regular performance audits

## Future Improvements

1. **Planned Enhancements**
   - Content-aware cropping
   - Automatic format selection
   - Background removal API
   - Watermarking capabilities

2. **Monitoring**
   - Implementation of usage metrics
   - Performance tracking
   - Cost optimization analysis

## Troubleshooting

### Common Issues

1. **404 Errors**
   - Check file path validity
   - Verify URL signing
   - Confirm Backblaze permissions

2. **Performance Issues**
   - Verify image dimensions
   - Check quality settings
   - Monitor cache hit rates

### Debug Tools
- Browser network inspector
- Backend logging
- Vercel deployment logs

## References

- [Vercel Image Optimization Docs](https://vercel.com/docs/concepts/image-optimization)
- [Backblaze B2 API Docs](https://www.backblaze.com/b2/docs/)
- [FastAPI Documentation](https://fastapi.tiangolo.com/) 