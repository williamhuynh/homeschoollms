# Cloudinary Private Image Migration Guide

## Overview

This guide walks you through migrating from public Cloudinary image delivery to private/authenticated image delivery while maintaining Backblaze as backup storage.

## Architecture Changes

### Before Migration
- **Upload**: Images → Cloudinary (public) + Backblaze B2 (backup)
- **Delivery**: Public Cloudinary URLs accessible to anyone
- **Security**: No access control

### After Migration
- **Upload**: Images → Cloudinary (authenticated) + Backblaze B2 (backup)
- **Delivery**: Signed/authenticated Cloudinary URLs with expiration
- **Security**: User-based access control with time-limited URLs

## Environment Variables Setup

### Required Environment Variables (Render Backend)

Add these to your Render service environment:

```bash
# Existing Cloudinary config
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# New migration control variable
CLOUDINARY_MIGRATION_MODE=hybrid

# Optional: For advanced token-based auth
CLOUDINARY_AUTH_KEY=your_auth_token_key
```

### Migration Modes

1. **`public`** (Legacy)
   - All images served publicly
   - Original behavior

2. **`hybrid`** (Recommended for migration)
   - New uploads go to private/authenticated storage
   - Legacy images remain public
   - Fallback support for smooth transition

3. **`private`** (Final state)
   - All images require authentication
   - Maximum security

## Migration Process

### Phase 1: Deploy with Hybrid Mode

1. **Deploy backend changes to Render**:
   ```bash
   # Set environment variable in Render dashboard
   CLOUDINARY_MIGRATION_MODE=hybrid
   ```

2. **Deploy frontend changes to Vercel**:
   - No additional environment variables needed
   - Frontend will automatically adapt to new API

3. **Verify deployment**:
   - Test image uploads (should go to private storage)
   - Test existing image viewing (should still work)

### Phase 2: Use Migration Tools

1. **Access Admin Panel**:
   - Go to `/admin` in your app
   - Navigate to "Image Migration" tab

2. **Check Migration Status**:
   - View public vs private image counts
   - Verify current migration mode

3. **Migrate Images**:
   - **Option A**: Bulk migrate all public images
   - **Option B**: Migrate individual images
   - **Option C**: Let migration happen naturally over time

### Phase 3: Switch to Private Mode

1. **After migration is complete**:
   ```bash
   # Update environment variable in Render
   CLOUDINARY_MIGRATION_MODE=private
   ```

2. **Test thoroughly**:
   - Verify all images load correctly
   - Check user access permissions
   - Test image upload functionality

## API Endpoints

### New Endpoints Added

- `POST /files/signed-url` - Generate signed URLs for private images
- `GET /files/migration/status` - Get migration status
- `GET /files/migration/images` - List images by type
- `POST /files/migration/migrate-image` - Migrate single image
- `POST /files/migration/bulk-migrate` - Migrate multiple images
- `POST /files/migration/set-mode` - Set migration mode

### Frontend Changes

- **SignedImage**: Updated to handle private images
- **ResponsiveImage**: Now uses SignedImage internally
- **LazyImage**: Enhanced with proper lazy loading
- **ImageMigrationManager**: New admin component

## Testing

### Test Private Image Access

```javascript
// Test API directly
const response = await fetch('/api/files/signed-url', {
  method: 'POST',
  headers: { 
    'Content-Type': 'application/json',
    'Authorization': 'Bearer YOUR_TOKEN'
  },
  body: JSON.stringify({
    file_path: 'evidence/user123/image.jpg',
    width: 800,
    height: 600,
    quality: 85
  })
});

const { signed_url } = await response.json();
console.log('Signed URL:', signed_url);
```

### Test Image Upload

1. Upload a new image through the app
2. Verify it appears in private images section
3. Confirm it's accessible via signed URL
4. Test URL expiration (should fail after 1 hour)

## Troubleshooting

### Common Issues

1. **Images not loading**:
   ```bash
   # Check migration mode
   echo $CLOUDINARY_MIGRATION_MODE
   
   # Verify Cloudinary credentials
   echo $CLOUDINARY_CLOUD_NAME
   ```

2. **403 Forbidden errors**:
   - Check user authentication
   - Verify access permissions in `_verify_user_access`
   - Confirm file path matches user permissions

3. **Migration API errors**:
   - Ensure user has admin permissions
   - Check Cloudinary API limits
   - Verify network connectivity to Cloudinary

### Rollback Plan

If issues occur, rollback by setting:
```bash
CLOUDINARY_MIGRATION_MODE=public
```

This will revert to original public image serving.

### Performance Considerations

1. **Signed URL Caching**:
   - URLs are valid for 1 hour by default
   - Frontend should cache signed URLs
   - Consider implementing client-side refresh logic

2. **Migration Batch Size**:
   - Bulk migration limited to 10 images at a time
   - Avoid overwhelming Cloudinary API
   - Monitor API usage during migration

3. **Network Overhead**:
   - Each image view requires signed URL generation
   - Consider longer expiration times for frequently accessed images
   - Implement proper error handling for URL generation failures

## Security Benefits

### Before Migration
- ❌ Images accessible via direct URLs
- ❌ No access control
- ❌ URLs never expire
- ❌ Easy to share/leak image URLs

### After Migration
- ✅ Images require authentication
- ✅ User-based access control
- ✅ Time-limited URLs (1 hour)
- ✅ Difficult to share unauthorized access

## Monitoring

### Key Metrics to Watch

1. **Image Load Times**:
   - Monitor signed URL generation speed
   - Track image delivery performance

2. **Error Rates**:
   - 403 authentication errors
   - 404 file not found errors
   - Cloudinary API errors

3. **Migration Progress**:
   - Public vs private image counts
   - Migration success rate
   - Failed migrations

### Logging

Enhanced logging has been added to track:
- Migration mode usage
- Signed URL generation
- Image access attempts
- Migration operations

Check your Render logs for detailed information.

## Support

For issues or questions:
1. Check Render service logs
2. Review Cloudinary dashboard for API usage
3. Test migration endpoints via admin panel
4. Verify environment variables are set correctly

## Next Steps

After successful migration:
1. Consider implementing image access analytics
2. Add more granular user permissions
3. Implement image usage monitoring
4. Consider adding image watermarking for sensitive content 