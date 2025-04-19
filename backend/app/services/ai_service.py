import google.generativeai as genai
import os
from dotenv import load_dotenv
from PIL import Image
import io
import sys
import traceback
from fastapi import HTTPException, status
from typing import List, Dict, Union # Added List, Dict, Union
import logging # Added logging

# Configure logger
logger = logging.getLogger(__name__)
# logging.basicConfig(level=logging.INFO) # Uncomment for more detailed logs

# Load environment variables from .env file
load_dotenv()

# Configure the Gemini API key
api_key = os.getenv("GOOGLE_API_KEY")
if not api_key:
    print("ERROR: GOOGLE_API_KEY not found in environment variables.", file=sys.stderr)
    # We'll let the endpoint handle this when it's called
else:
    try:
        genai.configure(api_key=api_key)
        logger.info(f"Google AI configured with API key: {api_key[:5]}...{api_key[-5:]}")
    except Exception as e:
        logger.error(f"ERROR configuring Google AI: {e}", exc_info=True)

# Initialize the Generative Model (using a model that supports multiple images)
model = None
# Models supporting multiple images include gemini-1.5-flash-latest, gemini-1.5-pro-latest
# Let's use flash for speed/cost unless pro is needed for complexity.
model_name = 'gemini-1.5-flash-latest' 
try:
    # List available models for debugging
    logger.debug("Available models:")
    for m in genai.list_models():
        if 'generateContent' in m.supported_generation_methods:
            logger.debug(f"- {m.name}")
            
    model = genai.GenerativeModel(model_name)
    logger.info(f"Successfully initialized Gemini model: {model_name}")
except Exception as e:
    logger.error(f"ERROR initializing Gemini model '{model_name}': {e}", exc_info=True)
    # We'll let the endpoint handle this when it's called

async def generate_description_from_images(images: List[Dict[str, Union[bytes, str]]], context_description: str) -> str:
    """
    Generates a four-sentence description for one or more images based on provided context.

    Args:
        images: A list of dictionaries, each containing 'bytes' and 'mime_type' for an image.
        context_description: Contextual information to connect the image(s) to.

    Returns:
        A string containing the generated four-sentence description.

    Raises:
        HTTPException: If the API key is not configured, the model failed to initialize,
                       input validation fails, or the generation fails.
    """
    logger.info(f"Generating description for {len(images)} image(s).")
    logger.info(f"Context: {context_description[:100]}{'...' if len(context_description) > 100 else ''}")
    
    if not api_key:
        error_msg = "Google AI API key is not configured."
        logger.error(error_msg)
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, # 422 for config/validation issues
            detail=error_msg
        )
        
    if not model:
        error_msg = f"Gemini model '{model_name}' failed to initialize."
        logger.error(error_msg)
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, # 422 for config/validation issues
            detail=error_msg
        )
        
    if not images:
         raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="No valid images provided to generate description."
        )

    prepared_images = []
    try:
        # Validate and prepare images
        for i, image_data in enumerate(images):
            image_bytes = image_data.get("bytes")
            image_mime_type = image_data.get("mime_type")

            if not image_bytes or not image_mime_type:
                 logger.warning(f"Skipping image {i+1} due to missing data.")
                 continue # Skip incomplete image data

            if not image_mime_type.startswith('image/'):
                logger.warning(f"Skipping image {i+1} due to invalid MIME type: {image_mime_type}")
                continue # Skip non-image files

            try:
                img = Image.open(io.BytesIO(image_bytes))
                # Optional: Add validation like checking img.format, img.size if needed
                prepared_images.append(img)
                logger.debug(f"Successfully prepared image {i+1}: {img.format}, {img.size}")
            except Exception as img_error:
                logger.warning(f"Failed to process image {i+1}: {img_error}. Skipping.")
                # Decide if one bad image should stop the process or just be skipped
                continue 

        if not prepared_images:
            raise ValueError("No valid images could be processed.")
            
        # Validate context description
        if not context_description or len(context_description.strip()) == 0:
            raise ValueError("Context description cannot be empty")
        
        # Construct the prompt for multiple images
        prompt = f"""You are a parent creating a short learning journal entry for your child. Look at the images and context provided and describe the activity shown:

        Context Information: {context_description}

        1. First, describe what your child is doing, drawing connections between the images if there are more than one provided. Use any context details provided as input into the description.
        2. Then, if it clearly relates to the particular learning area and learning outcome, explain how the activity is evidence of achieving the learning outcome.

        If no clear connection exists, omit the linkage to the learning outcome and just describe the photos.
        Use a warm, reflective tone suited to early childhood learning.
        Avoid emotive language as the purpose of this is factual evidence of learning activity.
        Keep it to no more than 500 characters.
        DO NOT make up any additional details, only describe what is shown in the photos and provided context.
        Do NOT output any preamble such as 'the following is the journal entry', just output the entry itself."""

        logger.info(f"Prompt prepared for {len(prepared_images)} images. Sending to Gemini API the following prompt: {prompt}")
        
        # Prepare the content parts (prompt followed by all images)
        content_parts = [prompt] + prepared_images

        # Generate content
        response = await model.generate_content_async(content_parts) # Use async version
        logger.info("Received response from Gemini API")

        # Extract and clean the text
        generated_text = response.text.strip()
        logger.info(f"Generated text length: {len(generated_text)}")
        
        # Basic validation (optional)
        # if generated_text.count('.') < 2 or generated_text.count('.') > 6: 
        #      logger.warning(f"Generated text might not have exactly 4 sentences: {generated_text}")

        return generated_text

    except ValueError as ve:
        # Handle specific validation errors (e.g., no valid images, empty outcome)
        logger.error(f"Input validation error: {ve}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid input: {str(ve)}"
        )
    except Exception as e:
        # Handle errors during the Gemini API call or other unexpected issues
        logger.error(f"ERROR during Gemini API call: {e}", exc_info=True)
        # Check for specific API errors if possible, otherwise return a generic error
        # Example: Check if e is a specific genai API error type
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, # Use 500 for internal/API errors
            detail=f"Failed to generate description using AI due to an internal error."
        )
