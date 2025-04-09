import google.generativeai as genai
import os
from dotenv import load_dotenv
from PIL import Image
import io
import sys
import traceback
from fastapi import HTTPException, status

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
        print(f"Google AI configured with API key: {api_key[:5]}...{api_key[-5:]}", file=sys.stderr)
    except Exception as e:
        print(f"ERROR configuring Google AI: {e}", file=sys.stderr)
        traceback.print_exc(file=sys.stderr)

# Initialize the Generative Model (using a stable model version instead of latest)
# Using a stable model version to avoid compatibility issues
model = None
try:
    # List available models for debugging
    print("Available models:", file=sys.stderr)
    for m in genai.list_models():
        if 'generateContent' in m.supported_generation_methods:
            print(f"- {m.name}", file=sys.stderr)
    
    # Use a more stable model version
    model_name = 'gemini-2.0-flash-lite'
    model = genai.GenerativeModel(model_name)
    print(f"Successfully initialized Gemini model: {model_name}", file=sys.stderr)
except Exception as e:
    print(f"ERROR initializing Gemini model: {e}", file=sys.stderr)
    traceback.print_exc(file=sys.stderr)
    # We'll let the endpoint handle this when it's called

async def generate_description_from_image(image_bytes: bytes, image_mime_type: str, learning_outcome: str) -> str:
    """
    Generates a four-sentence description for an image based on a learning outcome using Gemini.

    Args:
        image_bytes: The image file as bytes.
        image_mime_type: The MIME type of the image (e.g., 'image/jpeg', 'image/png').
        learning_outcome: The learning outcome text to potentially connect the image to.

    Returns:
        A string containing the generated four-sentence description.

    Raises:
        HTTPException: If the API key is not configured, the model failed to initialize,
                       or the generation fails.
    """
    # Log the request details for debugging
    print(f"Generating description for image of type: {image_mime_type}", file=sys.stderr)
    print(f"Learning outcome: {learning_outcome[:50]}{'...' if len(learning_outcome) > 50 else ''}", file=sys.stderr)
    print(f"Image size: {len(image_bytes)} bytes", file=sys.stderr)
    
    if not api_key:
        error_msg = "Google AI API key is not configured."
        print(f"ERROR: {error_msg}", file=sys.stderr)
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=error_msg
        )
        
    if not model:
        error_msg = "Gemini model failed to initialize."
        print(f"ERROR: {error_msg}", file=sys.stderr)
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=error_msg
        )

    try:
        # Validate image format
        if not image_mime_type.startswith('image/'):
            raise ValueError(f"Invalid image MIME type: {image_mime_type}")
            
        # Prepare the image for the API
        try:
            img = Image.open(io.BytesIO(image_bytes))
            print(f"Successfully opened image: {img.format}, {img.size}", file=sys.stderr)
        except Exception as img_error:
            print(f"ERROR opening image: {img_error}", file=sys.stderr)
            traceback.print_exc(file=sys.stderr)
            raise ValueError(f"Failed to process image: {str(img_error)}")
        
        # Validate learning outcome
        if not learning_outcome or len(learning_outcome.strip()) == 0:
            raise ValueError("Learning outcome cannot be empty")
        
        # Construct the prompt
        prompt = f"""You are a parent creating a short learning journal entry for your child. Look at the image provided and write exactly four concise sentences:

1. First, describe what your child is doing in the image.
2. Then, only if it clearly relates to the learning outcome below, explain how it connects, and reference the Learning Outcome.

Learning outcome: "{learning_outcome}"

If no clear connection exists, just describe the photo.
Use a warm, reflective tone suited to early childhood learning.
Avoid emotive language as the purpose of this is factual evidence of learning activity. 
Do not output any preamble such as 'the following is the journal entry', just output the entry itself."""

        print("Prompt prepared, sending to Gemini API...", file=sys.stderr)
        
        # Prepare the content parts (prompt and image)
        content_parts = [
            prompt,
            img 
        ]

        # Generate content
        print("Calling Gemini API...", file=sys.stderr)
        response = await model.generate_content_async(content_parts) # Use async version
        print("Received response from Gemini API", file=sys.stderr)

        # Extract and clean the text
        generated_text = response.text.strip()
        print(f"Generated text length: {len(generated_text)}", file=sys.stderr)
        
        # Basic validation (ensure it's roughly 4 sentences, though Gemini should handle this)
        if generated_text.count('.') < 2 or generated_text.count('.') > 6: 
             print(f"Warning: Generated text might not have exactly 4 sentences: {generated_text}", file=sys.stderr)

        return generated_text

    except ValueError as ve:
        # Client-side validation errors
        print(f"Validation error: {ve}", file=sys.stderr)
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid input: {str(ve)}"
        )
    except Exception as e:
        print(f"ERROR during Gemini API call: {e}", file=sys.stderr)
        traceback.print_exc(file=sys.stderr)
        # Return a more specific error code for API issues
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Failed to generate description using AI: {str(e)}"
        )
