# CDN Integration Guide for Backblaze B2

This guide outlines the steps to set up a CDN in front of our Backblaze B2 storage to improve image delivery performance.

## Selected CDN Solution: Cloudflare

After evaluating different CDN options, we've selected Cloudflare for the following reasons:

1. **Native Backblaze B2 Integration**: Backblaze B2 has a native integration with Cloudflare, making setup straightforward.
2. **Free Tier Available**: Cloudflare offers a free tier with CDN capabilities.
3. **Global Network**: Cloudflare has a large global network of edge servers.
4. **Easy Configuration**: Simple DNS-based setup with minimal configuration.
5. **Zero Egress Fees**: Backblaze B2 has a partnership with Cloudflare that eliminates egress fees.

## Setup Instructions

### 1. Create a Cloudflare Account

1. Go to [Cloudflare's website](https://www.cloudflare.com/) and sign up for an account if you don't already have one.
2. Verify your email address.

### 2. Add Your Domain to Cloudflare

1. In the Cloudflare dashboard, click "Add a Site".
2. Enter your domain name and click "Add Site".
3. Select a plan (the Free plan is sufficient for our needs).
4. Cloudflare will scan your DNS records. Review them and click "Continue".
5. Update your domain's nameservers at your domain registrar to the ones provided by Cloudflare.
6. Wait for the nameserver change to propagate (can take up to 24 hours).

### 3. Configure Backblaze B2 for Cloudflare Integration

1. Log in to your Backblaze B2 account.
2. Go to the "Buckets" section.
3. Select the bucket containing your images.
4. Click "Bucket Settings".
5. Under "Lifecycle Settings", ensure that the bucket is set to "Public".
6. Under "CORS Rules", add the following CORS configuration:

```json
[
  {
    "AllowedOrigins": ["*"],
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "HEAD"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

7. Save the changes.

### 4. Create a Cloudflare DNS Record for B2

1. In the Cloudflare dashboard, go to the "DNS" section.
2. Click "Add Record".
3. Select "CNAME" as the record type.
4. For "Name", enter a subdomain (e.g., "images" or "cdn").
5. For "Target", enter your Backblaze B2 bucket endpoint (e.g., `f000.backblazeb2.com`).
6. Ensure the "Proxy status" is set to "Proxied" (orange cloud icon).
7. Click "Save".

### 5. Configure Cloudflare Cache Settings

1. In the Cloudflare dashboard, go to the "Caching" section.
2. Under "Configuration", set the following:
   - Browser Cache TTL: 4 hours
   - Edge Cache TTL: 7 days
3. Under "Cache Rules", create a new rule:
   - Name: "Image Caching"
   - If: Hostname is `cdn.yourdomain.com` (or whatever subdomain you chose)
   - And: File extension is one of jpg, jpeg, png, gif, webp, svg
   - Then: Cache Level: Cache Everything
   - Edge TTL: 7 days
4. Save the rule.

### 6. Configure Page Rules for Images

1. In the Cloudflare dashboard, go to the "Rules" > "Page Rules" section.
2. Click "Create Page Rule".
3. For the URL pattern, enter: `cdn.yourdomain.com/*` (adjust based on your subdomain).
4. Add the following settings:
   - Cache Level: Cache Everything
   - Edge Cache TTL: 7 days
   - Browser Cache TTL: 4 hours
5. Click "Save and Deploy".

## Updating the Application

After setting up the CDN, you need to update the application to use the CDN URLs instead of direct Backblaze B2 URLs.

### Backend Changes

Update the `file_storage_service.py` file to use the CDN URL for image URLs:

```python
# Add a CDN_URL environment variable
CDN_URL = os.getenv('CDN_URL', '')  # e.g., 'https://cdn.yourdomain.com'

# Update the upload_file method to return CDN URLs
def upload_file(...):
    # ...existing code...
    
    # Construct the file URL with CDN
    file_url = f"{self.bucket_name}/{file_path}"
    cdn_file_url = f"{CDN_URL}/{file_path}" if CDN_URL else file_url
    
    # Construct the thumbnail URL with CDN
    thumbnail_url = f"{self.bucket_name}/{thumbnail_path}"
    cdn_thumbnail_url = f"{CDN_URL}/{thumbnail_path}" if CDN_URL and thumbnail_url else thumbnail_url
    
    return {
        "file_url": cdn_file_url,
        "thumbnail_url": cdn_thumbnail_url
    }
```

### Frontend Changes

No changes are needed in the frontend components as they already use the URLs provided by the backend.

## Testing the CDN Integration

1. Upload a new image through the application.
2. Check the network tab in browser developer tools to verify the image is being served from the CDN.
3. Check the response headers to verify caching is working correctly.
4. Test image loading performance from different locations.

## Monitoring and Maintenance

1. Monitor CDN performance through Cloudflare Analytics.
2. Check cache hit rates to ensure efficient caching.
3. Periodically review and adjust cache settings based on usage patterns.
4. Set up alerts for any CDN-related issues.

## Troubleshooting

### Common Issues

1. **Images not loading**: Check CORS configuration and ensure the bucket is public.
2. **Caching not working**: Verify page rules and cache settings in Cloudflare.
3. **Slow performance**: Check if the CDN is properly proxying requests (orange cloud icon in DNS).
4. **Old images still showing**: You may need to purge the cache in Cloudflare.

### Purging the Cache

If you need to update an image with the same filename:

1. In the Cloudflare dashboard, go to the "Caching" section.
2. Click "Purge Cache".
3. Select "Custom Purge" and enter the URL of the image to purge.
4. Click "Purge".