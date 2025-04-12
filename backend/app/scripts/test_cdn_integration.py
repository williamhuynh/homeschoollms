#!/usr/bin/env python3
"""
Script to test CDN integration with Backblaze B2.
This script uploads a test image to Backblaze B2 and verifies that it can be accessed through the CDN.
"""

import os
import sys
import time
import requests
from PIL import Image
import io
import argparse
import logging

# Add the parent directory to the path so we can import from app
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from app.services.file_storage_service import file_storage_service

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def create_test_image(width=200, height=200, color=(255, 0, 0)):
    """Create a simple test image."""
    img = Image.new('RGB', (width, height), color=color)
    buffer = io.BytesIO()
    img.save(buffer, format='PNG')
    buffer.seek(0)
    return buffer

def test_cdn_integration(generate_thumbnail=True):
    """Test CDN integration by uploading a test image and checking access."""
    logger.info("Starting CDN integration test")
    
    # Check if CDN_URL is configured
    cdn_url = os.getenv('CDN_URL')
    if not cdn_url:
        logger.warning("CDN_URL environment variable is not set. CDN integration will not be tested.")
    else:
        logger.info(f"Using CDN URL: {cdn_url}")
    
    # Create a test image
    logger.info("Creating test image")
    test_image_buffer = create_test_image()
    
    # Create a mock UploadFile object
    class MockUploadFile:
        def __init__(self, buffer):
            self.file = buffer
            self.filename = "test_image.png"
            self.content_type = "image/png"
            self.size = buffer.getbuffer().nbytes
        
        async def read(self):
            self.file.seek(0)
            return self.file.read()
        
        async def seek(self, position):
            self.file.seek(position)
    
    mock_file = MockUploadFile(test_image_buffer)
    
    # Generate a unique file path
    timestamp = int(time.time())
    file_path = f"test/cdn_test_{timestamp}.png"
    
    try:
        # Upload the test image
        logger.info(f"Uploading test image to path: {file_path}")
        import asyncio
        result = asyncio.run(file_storage_service.upload_file(
            file=mock_file,
            file_path=file_path,
            generate_thumbnail=generate_thumbnail
        ))
        
        logger.info("Upload successful")
        logger.info(f"File URL: {result['file_url']}")
        
        if generate_thumbnail and result.get('thumbnail_url'):
            logger.info(f"Thumbnail URL: {result['thumbnail_url']}")
        
        # Test accessing the file directly
        logger.info("Testing direct file access...")
        direct_url = f"{os.getenv('BACKBLAZE_ENDPOINT')}/{os.getenv('BACKBLAZE_BUCKET_NAME')}/{file_path}"
        direct_response = requests.get(direct_url)
        logger.info(f"Direct access status code: {direct_response.status_code}")
        
        # Test accessing the file through CDN if CDN_URL is set
        if cdn_url:
            logger.info("Testing CDN access...")
            cdn_file_url = f"{cdn_url}/{file_path}"
            
            # Wait a moment for CDN propagation
            logger.info("Waiting 5 seconds for CDN propagation...")
            time.sleep(5)
            
            cdn_response = requests.get(cdn_file_url)
            logger.info(f"CDN access status code: {cdn_response.status_code}")
            
            # Check response headers for caching information
            logger.info("CDN Response Headers:")
            for header, value in cdn_response.headers.items():
                if header.lower() in ('cache-control', 'expires', 'age', 'cf-cache-status', 'x-cache'):
                    logger.info(f"  {header}: {value}")
            
            # Compare response times
            if direct_response.status_code == 200 and cdn_response.status_code == 200:
                # Test response time for direct access (average of 3 requests)
                direct_times = []
                for _ in range(3):
                    start = time.time()
                    requests.get(direct_url)
                    direct_times.append(time.time() - start)
                avg_direct_time = sum(direct_times) / len(direct_times)
                
                # Test response time for CDN access (average of 3 requests)
                cdn_times = []
                for _ in range(3):
                    start = time.time()
                    requests.get(cdn_file_url)
                    cdn_times.append(time.time() - start)
                avg_cdn_time = sum(cdn_times) / len(cdn_times)
                
                logger.info(f"Average direct access time: {avg_direct_time:.4f} seconds")
                logger.info(f"Average CDN access time: {avg_cdn_time:.4f} seconds")
                
                if avg_cdn_time < avg_direct_time:
                    logger.info("CDN is faster than direct access! ✅")
                    improvement = ((avg_direct_time - avg_cdn_time) / avg_direct_time) * 100
                    logger.info(f"Performance improvement: {improvement:.2f}%")
                else:
                    logger.warning("Direct access is currently faster than CDN. This might be due to:")
                    logger.warning("- CDN cache not yet warmed up")
                    logger.warning("- Testing from a location close to the origin server")
                    logger.warning("- CDN not properly configured")
            
            # Test thumbnail access if available
            if generate_thumbnail and result.get('thumbnail_url'):
                logger.info("Testing thumbnail access through CDN...")
                thumbnail_path = file_path.split('.')
                thumbnail_path = f"{thumbnail_path[0]}_thumb.{thumbnail_path[1]}"
                cdn_thumbnail_url = f"{cdn_url}/{thumbnail_path}"
                
                thumbnail_response = requests.get(cdn_thumbnail_url)
                logger.info(f"Thumbnail CDN access status code: {thumbnail_response.status_code}")
        
        return True
    
    except Exception as e:
        logger.error(f"Error during CDN integration test: {str(e)}")
        return False

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Test CDN integration with Backblaze B2")
    parser.add_argument("--no-thumbnail", action="store_true", help="Disable thumbnail generation")
    args = parser.parse_args()
    
    success = test_cdn_integration(generate_thumbnail=not args.no_thumbnail)
    
    if success:
        logger.info("CDN integration test completed successfully")
    else:
        logger.error("CDN integration test failed")
        sys.exit(1)