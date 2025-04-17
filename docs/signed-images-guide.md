# Signed Images Guide

This guide explains how to use the new backend-generated signed URLs for images in the Homeschool LMS application.

## Overview

We've implemented a new approach for serving images from Backblaze B2 storage:

1. Instead of attempting complex AWS v4 signature generation in Vercel Edge Functions, we now use the backend to generate signed URLs
2. The backend has direct access to the Backblaze credentials and can generate properly signed URLs
3. These signed URLs can then be used directly or passed to Vercel's image optimization

## Benefits

- **Security**: Private Backblaze bucket remains secure
- **Simplicity**: No complex authentication code in Edge Functions 
- **Reliability**: Backend-generated signatures are more reliable than in Edge Functions
- **Optimization**: Still leverages Vercel's image optimization for resizing and format conversion
- **Performance**: Eliminates authentication errors that were causing slow image loads

## Backend Implementation

A new API endpoint has been created to generate signed URLs:

```
GET /api/files/signed-url
```

### Query Parameters

- `file_path` (required): Path to the file in Backblaze storage
- `width` (optional): Desired width for image resizing
- `height` (optional): Desired height for image resizing
- `quality` (optional): Image quality (1-100, default: 80)
- `expiration` (optional): URL expiration time in seconds (default: 3600)
- `content_disposition` (optional): How file should be presented - 'inline' or 'attachment' (default: inline)

### Response

```json
{
  "signed_url": "https://backblaze-url-with-signature...",
  "optimized_url": "https://your-site.vercel.app/_vercel/image?url=encoded-signed-url&w=500&h=300&q=80",
  "expiration": 3600
}
```

## Frontend Implementation

### 1. Using the SignedImage Component

The simplest way to use the new system is with the `SignedImage` component:

```jsx
import SignedImage from '../../components/common/SignedImage';

// In your component
<SignedImage
  imagePath="evidence/student123/outcome456/image.jpg"
  width={300}
  height={200}
  quality={80}
  alt="Description of image"
/>
```

The `imagePath` should be the path portion of the file in Backblaze, without the bucket name prefix.

### 2. Using the getSignedImageUrl Utility

For more control, you can use the utility function:

```jsx
import { getSignedImageUrl } from '../../utils/imageUtils';

// In your component
useEffect(() => {
  async function loadImage() {
    try {
      const { optimizedUrl } = await getSignedImageUrl('evidence/student123/image.jpg', {
        width: 500,
        height: 300,
        quality: 80
      });
      setImageUrl(optimizedUrl);
    } catch (error) {
      console.error('Error loading image:', error);
    }
  }
  
  loadImage();
}, []);
```

### 3. Feature Flag for Gradual Migration

We've implemented a feature flag to enable gradual migration:

```javascript
// Default feature flag in various components
const USE_SIGNED_IMAGES = process.env.REACT_APP_USE_SIGNED_IMAGES === 'true' || true;
```

Set this environment variable to control the rollout:

- In `.env.development`: `REACT_APP_USE_SIGNED_IMAGES=true`
- In `.env.production`: Initially set to `false` and then to `true` when fully tested

### 4. Extracting Image Paths from URLs

When migrating existing code, you'll need to extract the actual file path from URLs:

```javascript
const extractImagePath = (url) => {
  if (!url) return null;
  
  // For URLs that use our API format, extract the path part
  const apiPathMatch = url.match(/\/api\/images\/[^\/]+\/(.+)/);
  if (apiPathMatch && apiPathMatch[1]) {
    return apiPathMatch[1];
  }
  
  // For direct Backblaze URLs, extract the path after the domain
  const backblazeMatch = url.match(/backblazeb2\.com\/(.+)/);
  if (backblazeMatch && backblazeMatch[1]) {
    return backblazeMatch[1];
  }
  
  // Use the full URL as fallback
  return url;
};
```

## Debugging

### Backend Logging

The backend logs detailed information about signed URL generation:

```
INFO - Generating signed URL for file: evidence/student123/image.jpg
INFO - Parameters - Expiration: 3600s, Disposition: inline
INFO - Determined content type: image/jpeg
INFO - Generating presigned URL with params: {...}
INFO - Successfully generated presigned URL (expires in 3600s)
```

### Frontend Logging

The frontend also logs detailed information when debugging is enabled:

```
Getting signed URL for image: evidence/student123/image.jpg
Calling API: /api/files/signed-url?file_path=evidence%2Fstudent123%2Fimage.jpg&width=500&height=300&quality=80
Received signed URL response: {signed_url: "...", optimized_url: "...", expiration: 3600}
```

## Migration Checklist

When migrating components to use signed URLs:

1. Import the `SignedImage` component or `getSignedImageUrl` utility
2. Extract the file path from existing image URLs
3. Replace the old image component with `SignedImage` or direct image element
4. If necessary, add the feature flag parameter to enable gradual rollout
5. Test thoroughly in development before enabling in production

## Troubleshooting

### Common Issues

1. **403 Forbidden errors**: Check the backend logs to ensure proper authentication with Backblaze.
2. **Missing images**: Verify that the image path extraction is correctly parsing URLs.
3. **Expiration too short**: If images expire too quickly, increase the `expiration` parameter.

### Fallback Options

If issues persist, you can:

1. Increase the backend logging level to see more details
2. Set the feature flag to `false` to temporarily revert to the old behavior
3. Check the backend environment variables for correct Backblaze credentials 