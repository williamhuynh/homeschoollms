#!/usr/bin/env python3
"""
Script to purge the CDN cache for specific files or patterns.
This is useful when you need to update files with the same name.
"""

import os
import sys
import argparse
import logging
import requests
import json

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def purge_cloudflare_cache(urls=None, patterns=None, purge_everything=False):
    """
    Purge Cloudflare cache for specific URLs, patterns, or everything.
    
    Args:
        urls (list): List of specific URLs to purge
        patterns (list): List of URL patterns to purge (e.g., "*.jpg")
        purge_everything (bool): Whether to purge the entire cache
        
    Returns:
        bool: True if successful, False otherwise
    """
    # Check for Cloudflare API credentials
    api_token = os.getenv('CLOUDFLARE_API_TOKEN')
    if not api_token:
        logger.error("CLOUDFLARE_API_TOKEN environment variable is not set")
        return False
    
    # Check for Cloudflare zone ID
    zone_id = os.getenv('CLOUDFLARE_ZONE_ID')
    if not zone_id:
        logger.error("CLOUDFLARE_ZONE_ID environment variable is not set")
        return False
    
    # Prepare the API endpoint
    api_url = f"https://api.cloudflare.com/client/v4/zones/{zone_id}/purge_cache"
    
    # Prepare the headers
    headers = {
        "Authorization": f"Bearer {api_token}",
        "Content-Type": "application/json"
    }
    
    # Prepare the data based on the purge type
    data = {}
    
    if purge_everything:
        logger.warning("Purging the entire cache. This may affect site performance temporarily.")
        data = {"purge_everything": True}
    elif urls:
        logger.info(f"Purging cache for {len(urls)} specific URLs")
        data = {"files": urls}
    elif patterns:
        logger.info(f"Purging cache for {len(patterns)} URL patterns")
        data = {"hosts": [os.getenv('CDN_URL', '').replace('https://', '').replace('http://', '')]}
        data["prefixes"] = patterns
    else:
        logger.error("No URLs, patterns, or purge_everything flag provided")
        return False
    
    try:
        # Make the API request
        response = requests.post(api_url, headers=headers, data=json.dumps(data))
        
        # Check the response
        if response.status_code == 200:
            result = response.json()
            if result.get('success'):
                logger.info("Cache purge request successful")
                return True
            else:
                logger.error(f"Cache purge request failed: {result.get('errors', 'Unknown error')}")
                return False
        else:
            logger.error(f"API request failed with status code {response.status_code}: {response.text}")
            return False
    
    except Exception as e:
        logger.error(f"Error during cache purge: {str(e)}")
        return False

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Purge Cloudflare CDN cache")
    
    # Create mutually exclusive group for purge options
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--urls", nargs="+", help="Specific URLs to purge from cache")
    group.add_argument("--patterns", nargs="+", help="URL patterns to purge (e.g., '*.jpg')")
    group.add_argument("--all", action="store_true", help="Purge the entire cache (use with caution)")
    
    args = parser.parse_args()
    
    if args.urls:
        success = purge_cloudflare_cache(urls=args.urls)
    elif args.patterns:
        success = purge_cloudflare_cache(patterns=args.patterns)
    elif args.all:
        success = purge_cloudflare_cache(purge_everything=True)
    
    if success:
        logger.info("Cache purge completed successfully")
        sys.exit(0)
    else:
        logger.error("Cache purge failed")
        sys.exit(1)