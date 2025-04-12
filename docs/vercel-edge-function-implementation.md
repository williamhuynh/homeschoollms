# Vercel Edge Function Implementation for Image Optimization

This document outlines the implementation of Vercel Edge Functions as a CDN-like layer for images stored in Backblaze B2.

## Overview

We've implemented Option 3 from the "Vercel-Compatible CDN Options" document, which involves:

1. Continuing to use Backblaze B2 for storage
2. Using Vercel Edge Functions to create a CDN-like layer
3. Leveraging Vercel's global edge network for content delivery

This approach provides several benefits:
- Maintains our existing Backblaze B2 storage
- Leverages Vercel's global edge network
- Provides image optimization capabilities
- Reduces costs compared to dedicated CDN services

## Implementation Components

### 1. Vercel Edge Function

The Edge Function is implemented in `frontend/api/images/[...path].js` and serves as a proxy between the client and Backblaze B2. It:

- Receives image requests
- Constructs the appropriate Backblaze URL
- Fetches the image from Backblaze
- Returns the image with proper caching headers
- Supports image transformations (width, height, format, quality)

### 2. Backend Integration

The backend `file_storage_service.py` has been updated to:

- Generate URLs that point to the Edge Function instead of directly to Backblaze B2
- Support the new URL format for both original images and thumbnails
- Fall back to CDN or direct Backblaze URLs if the Edge Function is not configured

### 3. Frontend Integration

The frontend components have been updated to:

- Work with the new URL format
- Request appropriate image transformations based on display requirements
- Support WebP format for browsers that support it
- Maintain progressive loading and lazy loading capabilities

## Configuration

To enable the Vercel Edge Function integration, you need to:

1. Deploy the Vercel Edge Function:
   - The function is located in `frontend/api/images/[...path].js`
   - Ensure the `@vercel/edge` package is installed

2. Configure environment variables:
   - In your Vercel project settings, add:
     - `BACKBLAZE_ENDPOINT`: Your Backblaze B2 endpoint
     - `BACKBLAZE_BUCKET_NAME`: Your Backblaze B2 bucket name

   - In your backend `.env` file, add:
     - `VERCEL_URL`: The URL of your Vercel deployment (e.g., `https://your-app.vercel.app`)
     - `EDGE_FUNCTION_PATH`: The path to the Edge Function (default: `/api/images`)

## Usage

### Basic Usage

Images will automatically be served through the Edge Function when:
1. The backend generates URLs for images
2. Frontend components display images

### Image Transformations

You can request image transformations by adding query parameters to the URL:

- `width`: Desired width in pixels
- `height`: Desired height in pixels
- `format`: Desired format (webp, jpeg, png)
- `quality`: Image quality (1-100)

Example:
```
https://your-app.vercel.app/api/images/path/to/image.jpg?width=300&height=200&format=webp&quality=80
```

### Automatic Transformations

The frontend components automatically request appropriate transformations based on:
- Container size
- Device pixel ratio
- Browser support for WebP

## Performance Considerations

- The Edge Function includes caching headers to ensure images are cached at the edge
- Images are served from the closest edge location to the user
- Image transformations reduce bandwidth usage
- WebP format is used when supported by the browser

## Monitoring and Troubleshooting

- Monitor Edge Function usage in your Vercel dashboard
- Check for errors in the Vercel Function logs
- Test image loading performance using browser developer tools

## Future Enhancements

Potential future enhancements include:
- Adding support for more image formats (AVIF, etc.)
- Implementing content-aware cropping
- Adding watermarking capabilities
- Implementing responsive image srcsets