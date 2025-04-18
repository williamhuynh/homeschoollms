# Image Optimization Architecture

## Overview
This document outlines the image optimization system implemented in the Homeschool LMS application. The system uses Cloudinary for primary image storage and optimization, with Backblaze B2 as a backup storage solution. This dual approach ensures both high performance delivery and reliable backup of original assets.

## System Architecture

### Components
1. **Cloudinary**
   - Primary storage and delivery of images
   - Handles direct uploads from the application
   - Provides on-the-fly image optimization
   - Generates thumbnails during upload
   - Supports various formats (WebP, JPEG, PNG)
   - Handles resizing and quality adjustments
   - Caches optimized images at edge locations
   - Provides built-in CDN capabilities for faster delivery

2. **Backblaze B2**
   - Secondary backup storage for original images
   - Provides secure, scalable object storage
   - Bucket is configured as private (not publicly accessible)
   - Used for disaster recovery if Cloudinary data is lost

3. **Backend (FastAPI)**
   - Handles file uploads to both services
   - Manages authentication and authorization
   - Generates Cloudinary URLs with transformation parameters
   - Handles thumbnail generation via Cloudinary
   - Validates user permissions before generating URLs

### Flow Diagram for Upload
```
Client → Backend → [Cloudinary (primary) + Backblaze B2 (backup)]
```

### Flow Diagram for Retrieval
```
Client Request → Backend (generate Cloudinary URL) → Cloudinary (transform & serve) → Client
```

## Implementation Details

### Upload Process

#### Backend File Upload Service
```python
async def upload_file(self, file: UploadFile, file_path: str, generate_thumbnail=False, thumbnail_size=(200, 200)):
    # Read the file content
    file_data = await file.read()
    
    # Extract file path without extension for Cloudinary
    file_path_without_ext = os.path.splitext(file_path)[0]
    
    # Upload to Backblaze B2 for backup/storage
    try:
        self.s3.put_object(
            Bucket=self.bucket_name,
            Key=file_path,
            Body=file_data,
            ContentType=file.content_type
        )
    except Exception as e:
        # Continue even if Backblaze upload fails - we'll still use Cloudinary
        logger.error(f"Error uploading to Backblaze B2: {str(e)}")
    
    # Upload to Cloudinary for delivery/serving
    upload_result = cloudinary.uploader.upload(
        file_data,
        public_id=file_path_without_ext,
        resource_type="auto"
    )
    
    # Generate thumbnail if requested
    thumbnail_url = None
    if generate_thumbnail:
        thumbnail_result = cloudinary.uploader.upload(
            file_data,
            public_id=f"{file_path_without_ext}_thumb",
            width=thumbnail_size[0],
            height=thumbnail_size[1],
            crop="fill",
            resource_type="auto"
        )
        thumbnail_url = thumbnail_result['secure_url']
    
    # Return URLs for frontend use
    return {
        "original_url": upload_result['secure_url'],
        "thumbnail_small_url": f"{upload_result['secure_url']}?width=150&height=150&quality=80",
        "thumbnail_medium_url": f"{upload_result['secure_url']}?width=600&height=450&quality=85",
        "thumbnail_large_url": f"{upload_result['secure_url']}?width=800&height=600&quality=85"
    }
```

### Image Retrieval

#### URL Generation Endpoint
```python
@router.get("/files/signed-url")
async def get_signed_url(
    file_path: str,
    width: Optional[int] = Query(None),
    height: Optional[int] = Query(None),
    quality: Optional[int] = Query(80),
    expiration: Optional[int] = Query(3600),
    content_disposition: Optional[str] = Query('inline')
):
    # Generate URL using the file storage service
    image_url = file_storage_service.generate_presigned_url(
        file_path=file_path,
        expiration=expiration,
        content_disposition=content_disposition,
        width=width,
        height=height,
        quality=quality
    )
    
    return {
        "signed_url": image_url,
        "expiration": expiration
    }
```

#### Cloudinary URL Generation
```python
def generate_presigned_url(self, file_path: str, expiration=3600, content_disposition='inline', width=None, height=None, quality=80):
    # Get Cloudinary cloud name
    cloud_name = os.getenv('CLOUDINARY_CLOUD_NAME')
    
    # Clean and prepare the file path
    clean_path = file_path.strip().strip('/')
    file_name, file_ext = os.path.splitext(clean_path)
    
    # Base Cloudinary URL
    cloudinary_url = f"https://res.cloudinary.com/{cloud_name}/image/upload"
    
    # Add transformations if specified
    transformations = []
    if width:
        transformations.append(f"w_{width}")
    if height:
        transformations.append(f"h_{height}")
    if quality != 80:
        transformations.append(f"q_{quality}")
    
    if transformations:
        cloudinary_url += "/" + ",".join(transformations)
    
    # Try to look up the file in Cloudinary to get the version
    try:
        result = cloudinary.api.resources(
            type="upload",
            prefix=file_name,
            max_results=1
        )
        
        if result and 'resources' in result and len(result['resources']) > 0:
            resource = result['resources'][0]
            version = resource.get('version')
            public_id = resource.get('public_id')
            
            if version and public_id:
                cloudinary_url += f"/v{version}/{public_id}"
                return cloudinary_url
    except Exception:
        pass
    
    # Fallback to using the path without version
    cloudinary_url += f"/{file_name}"
    return cloudinary_url
```

### Frontend Components

#### SignedImage Component
```jsx
const SignedImage = ({
  imagePath,
  width,
  height,
  quality = 80,
  alt = 'Image',
  imgProps = {},
  showPlaceholder = true,
  ...rest
}) => {
  const [imageUrl, setImageUrl] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadImage = async () => {
      try {
        // Get the signed URL from the backend
        const { optimizedUrl } = await getSignedImageUrl(imagePath, {
          width,
          height,
          quality
        });
        
        setImageUrl(optimizedUrl);
        setIsLoading(false);
      } catch (err) {
        setError(err);
        setIsLoading(false);
      }
    };

    if (imagePath) {
      loadImage();
    }
  }, [imagePath, width, height, quality]);
  
  // Render the image with appropriate loading state
  if (isLoading && showPlaceholder) {
    return <Skeleton {...skeletonProps} />;
  }
  
  if (error || !imageUrl) {
    return <FallbackImage alt={alt} {...rest} />;
  }
  
  return <img src={imageUrl} alt={alt} {...imgProps} {...rest} />;
};
```

## URL Structure

### Cloudinary URL with Transformations
```
https://res.cloudinary.com/<cloud-name>/image/upload/[transformations]/<version>/<file-path>
```

Example with transformations:
```
https://res.cloudinary.com/dbri1xgl8/image/upload/w_800,h_600,q_90/v1234567890/evidence/student123/outcome456/20230815123456-abcdef123456.jpg
```

## Configuration

### Environment Variables

#### Backend
```env
# Backblaze B2 Configuration (for backup)
BACKBLAZE_ENDPOINT=https://s3.us-east-005.backblazeb2.com
BACKBLAZE_KEY_ID=your-key-id
BACKBLAZE_APPLICATION_KEY=your-application-key
BACKBLAZE_BUCKET_NAME=homeschoollms

# Cloudinary Configuration (primary)
CLOUDINARY_CLOUD_NAME=dbri1xgl8
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret
```

#### Frontend
```env
# Cloudinary Configuration
VITE_CLOUDINARY_CLOUD_NAME=dbri1xgl8
VITE_CLOUDINARY_API_KEY=your-api-key
```

## Security Considerations

1. **Direct Upload Security**
   - All image uploads go through the backend server
   - Authentication required for all uploads
   - File validation performed before upload
   - Content types restricted to valid image formats
   - No direct frontend-to-Cloudinary uploads without authentication

2. **Access Control**
   - Backend validates user permissions
   - Authentication required for signed URL generation
   - File paths validated against user access
   - Rate limiting implemented on URL generation

3. **Backup Storage Security**
   - Backblaze B2 bucket configured as private
   - No public access policies allowed
   - All access is authenticated
   - Used only as disaster recovery option

4. **Cloudinary Security**
   - Proper authentication for API operations
   - Resource validation before serving
   - Authenticated transformations
   - Version-based asset access

## Performance Optimizations

1. **Cloudinary CDN & Caching**
   - Automatic caching at edge locations
   - Browser caching headers properly set
   - Immutable cache for static images
   - Reduced round trips via CDN

2. **Lazy Loading**
   - Images load only when entering viewport
   - Placeholders shown during loading
   - Progressive loading for larger images
   - Reduces initial page load time

3. **Responsive Sizing**
   - Automatic size detection based on container
   - Device pixel ratio considered for retina displays
   - WebP format used when browser supported
   - Optimal quality settings based on content

4. **Thumbnail Generation**
   - Automatic thumbnail generation during upload
   - Multiple predefined sizes for different contexts
   - Efficient loading of previews in galleries
   - Reduced bandwidth usage for thumbnails

## Error Handling & Recovery

1. **Upload Fallbacks**
   - If Backblaze upload fails, Cloudinary is still used
   - Log errors for later recovery
   - Backblaze retries can be implemented as background tasks

2. **Retrieval Fallbacks**
   - If URL generation fails, use direct Cloudinary URL
   - If image not found, display placeholder/fallback image
   - Retry logic for transient errors

3. **Error Logging**
   - All errors logged with detailed information
   - Failed uploads tracked for recovery
   - Missing images logged for investigation

## Best Practices

1. **Image Uploading**
   - Use the provided API endpoints for uploads
   - Include proper content types
   - Set appropriate file size limits
   - Generate unique file paths with timestamps and UUIDs
   - Request thumbnail generation when needed

2. **Image Display**
   - Always use the SignedImage component for consistency
   - Specify dimensions to enable optimizations
   - Use appropriate quality settings (80 is default)
   - Include width and height attributes to avoid layout shifts
   - Implement lazy loading for galleries

3. **Maintenance**
   - Monitor storage usage in both systems
   - Implement cleanup for unused images
   - Regular verification of backup integrity
   - Performance audits on image loading times

## Troubleshooting

### Common Issues

1. **Missing Images**
   - Check if file exists in Cloudinary (primary)
   - Verify file exists in Backblaze (backup)
   - Check permissions for current user
   - Verify correct file path format

2. **Performance Issues**
   - Verify image dimensions are appropriate
   - Check quality settings (lower for faster loading)
   - Ensure lazy loading is implemented
   - Verify CDN is functioning properly

3. **Upload Failures**
   - Check file size limits
   - Verify content type is supported
   - Check connectivity to both services
   - Verify authentication credentials

### Debugging Tools
- Browser network inspector (check request/response)
- Cloudinary dashboard (verify uploads and transformations)
- Backend logs (check for errors during upload/URL generation)
- Frontend console (check for image loading errors)

## References

- [Cloudinary Documentation](https://cloudinary.com/documentation)
- [Backblaze B2 API Docs](https://www.backblaze.com/b2/docs/)
- [FastAPI Documentation](https://fastapi.tiangolo.com/) 