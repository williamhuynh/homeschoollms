#!/usr/bin/env python3
"""
Script to test thumbnail generation functionality.
This script uploads a test image and verifies that thumbnails are correctly generated.
"""

import os
import sys
import time
import requests
from PIL import Image
import io
import argparse
import logging
import json

# Add the parent directory to the path so we can import from app
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from app.services.file_storage_service import file_storage_service

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def create_test_image(width=800, height=600, color=(255, 0, 0), text="Test Image"):
    """Create a test image with text."""
    from PIL import ImageDraw, ImageFont
    
    # Create a new image with the specified color
    img = Image.new('RGB', (width, height), color=color)
    draw = ImageDraw.Draw(img)
    
    # Add text to the image
    try:
        font = ImageFont.truetype("arial.ttf", 36)
    except IOError:
        # Use default font if arial is not available
        font = ImageFont.load_default()
    
    # Draw text in the center of the image
    text_width, text_height = draw.textsize(text, font=font) if hasattr(draw, 'textsize') else (200, 36)
    position = ((width - text_width) // 2, (height - text_height) // 2)
    draw.text(position, text, fill=(255, 255, 255), font=font)
    
    # Add a timestamp to make the image unique
    timestamp = time.strftime("%Y-%m-%d %H:%M:%S")
    draw.text((10, height - 30), timestamp, fill=(255, 255, 255), font=font)
    
    # Save to buffer
    buffer = io.BytesIO()
    img.save(buffer, format='PNG')
    buffer.seek(0)
    return buffer

def test_thumbnail_generation():
    """Test thumbnail generation by uploading a test image and verifying thumbnails."""
    logger.info("Starting thumbnail generation test")
    
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
    file_path = f"test/thumbnail_test_{timestamp}.png"
    
    try:
        # Upload the test image with thumbnail generation
        logger.info(f"Uploading test image to path: {file_path}")
        import asyncio
        result = asyncio.run(file_storage_service.upload_file(
            file=mock_file,
            file_path=file_path,
            generate_thumbnail=True
        ))
        
        logger.info("Upload successful")
        logger.info(f"File URL: {result['file_url']}")
        
        # Check if thumbnail URL is returned
        if result.get('thumbnail_url'):
            logger.info(f"Thumbnail URL: {result['thumbnail_url']}")
            logger.info("✅ Thumbnail URL was returned")
        else:
            logger.error("❌ No thumbnail URL was returned")
            return False
        
        # Verify the thumbnail exists by downloading it
        try:
            # Extract the thumbnail path
            thumbnail_path = file_path.split('.')
            thumbnail_path = f"{thumbnail_path[0]}_thumb.{thumbnail_path[1]}"
            
            # Construct direct URL to the thumbnail
            direct_thumbnail_url = f"{os.getenv('BACKBLAZE_ENDPOINT')}/{os.getenv('BACKBLAZE_BUCKET_NAME')}/{thumbnail_path}"
            
            # Download the thumbnail
            logger.info(f"Downloading thumbnail from: {direct_thumbnail_url}")
            thumbnail_response = requests.get(direct_thumbnail_url)
            
            if thumbnail_response.status_code == 200:
                logger.info("✅ Thumbnail download successful")
                
                # Verify the thumbnail dimensions
                thumbnail_img = Image.open(io.BytesIO(thumbnail_response.content))
                logger.info(f"Thumbnail dimensions: {thumbnail_img.size}")
                
                # Check if dimensions are as expected (should be around 200x200 or maintain aspect ratio)
                max_dimension = max(thumbnail_img.size)
                if max_dimension <= 200:
                    logger.info("✅ Thumbnail dimensions are correct")
                else:
                    logger.warning(f"⚠️ Thumbnail dimensions ({max_dimension}px) exceed expected size (200px)")
                
                # Save the test results
                test_results = {
                    "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
                    "original_url": result['file_url'],
                    "thumbnail_url": result['thumbnail_url'],
                    "original_size": mock_file.size,
                    "thumbnail_size": len(thumbnail_response.content),
                    "size_reduction_percent": round((1 - len(thumbnail_response.content) / mock_file.size) * 100, 2),
                    "thumbnail_dimensions": thumbnail_img.size
                }
                
                # Save results to a JSON file
                results_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "test_results")
                os.makedirs(results_dir, exist_ok=True)
                results_file = os.path.join(results_dir, f"thumbnail_test_{timestamp}.json")
                
                with open(results_file, 'w') as f:
                    json.dump(test_results, f, indent=2)
                
                logger.info(f"Test results saved to: {results_file}")
                logger.info(f"Size reduction: {test_results['size_reduction_percent']}%")
                
                return True
            else:
                logger.error(f"❌ Failed to download thumbnail. Status code: {thumbnail_response.status_code}")
                return False
                
        except Exception as e:
            logger.error(f"Error verifying thumbnail: {str(e)}")
            return False
    
    except Exception as e:
        logger.error(f"Error during thumbnail generation test: {str(e)}")
        return False

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Test thumbnail generation functionality")
    args = parser.parse_args()
    
    success = test_thumbnail_generation()
    
    if success:
        logger.info("✅ Thumbnail generation test completed successfully")
    else:
        logger.error("❌ Thumbnail generation test failed")
        sys.exit(1)