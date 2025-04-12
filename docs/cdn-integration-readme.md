# CDN Integration for Image Optimization

This document provides a quick reference for the CDN integration with Backblaze B2 for image optimization.

## Overview

We've integrated a CDN (Cloudflare) with our Backblaze B2 storage to improve image delivery performance. This integration:

1. Reduces image load times by serving content from edge locations closer to users
2. Decreases bandwidth costs through caching
3. Improves application performance by offloading image serving from our servers

## Configuration

The CDN integration uses the following environment variables:

```
CDN_URL=https://cdn.yourdomain.com
CLOUDFLARE_API_TOKEN=your-cloudflare-api-token
CLOUDFLARE_ZONE_ID=your-cloudflare-zone-id
```

These should be set in your `.env` file and are passed to the application through Docker Compose.

## How It Works

1. Images are uploaded to Backblaze B2 as before
2. Thumbnails are generated during upload
3. The file URLs returned by the backend now use the CDN domain instead of direct Backblaze B2 URLs
4. The CDN caches the images, serving them from edge locations

## Testing the CDN Integration

You can test the CDN integration using the provided script:

```bash
# From the backend directory
python -m app.scripts.test_cdn_integration
```

This script:
- Creates and uploads a test image
- Tests direct access to the image
- Tests access through the CDN
- Compares response times
- Checks cache headers

## Purging the CDN Cache

If you need to update an image with the same filename, you'll need to purge the CDN cache:

```bash
# Purge specific URLs
python -m app.scripts.purge_cdn_cache --urls https://cdn.yourdomain.com/path/to/image.jpg

# Purge by pattern
python -m app.scripts.purge_cdn_cache --patterns "*/thumbnails/*"

# Purge everything (use with caution)
python -m app.scripts.purge_cdn_cache --all
```

## Troubleshooting

### Common Issues

1. **Images not loading**: Check CORS configuration and ensure the bucket is public.
2. **Caching not working**: Verify page rules and cache settings in Cloudflare.
3. **Slow performance**: Check if the CDN is properly proxying requests (orange cloud icon in DNS).
4. **Old images still showing**: You may need to purge the cache in Cloudflare.

### Checking CDN Status

You can check if an image is being served from the CDN by looking at the response headers:

- `CF-Cache-Status`: Shows cache status (HIT, MISS, EXPIRED, etc.)
- `Age`: Indicates how long the resource has been in the cache
- `Cache-Control`: Shows caching directives

## Detailed Setup Documentation

For detailed setup instructions, see [cdn-integration-guide.md](./cdn-integration-guide.md).