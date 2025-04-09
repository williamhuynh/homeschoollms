import google.generativeai as genai
import os
from dotenv import load_dotenv
from PIL import Image
import io
from fastapi import HTTPException, status

# Load environment variables from .env file
load_dotenv()

# Configure the Gemini API key
api_key = os.getenv("GOOGLE_API_KEY")
if not api_key:
    print("Warning: GOOGLE_API_KEY not found in environment variables.")
    # You might want to raise an error or handle this case differently
    # For now, we'll let genai.configure raise the error if it's truly missing
else:
    try:
        genai.configure(api_key=api_key)
    except Exception as e:
        print(f"Error configuring Google AI: {e}")
        # Decide how to handle configuration errors, e.g., raise an exception

# Initialize the Generative Model (using the latest flash model)
# Check available models if needed:
# for m in genai.list_models():
#   if 'generateContent' in m.supported_generation_methods:
#     print(m.name)
try:
    model = genai.GenerativeModel('gemini-1.5-flash-latest')
except Exception as e:
    print(f"Error initializing Gemini model: {e}")
    # Handle model initialization error, maybe raise a specific exception
    model = None # Ensure model is None if initialization fails

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
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Google AI API key is not configured."
        )
        
    if not model:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Gemini model failed to initialize."
        )

    try:
        # Prepare the image for the API
        img = Image.open(io.BytesIO(image_bytes))
        
        # Construct the prompt
        prompt = f"""You are a parent creating a short learning journal entry for your child. Look at the image provided and write exactly four concise sentences:

1. First, describe what your child is doing in the image.
2. Then, only if it clearly relates to the learning outcome below, explain how it connects.

Learning outcome: "{learning_outcome}"

Avoid vague or generic links. If no clear connection exists, just describe the photo.
Use a warm, reflective tone suited to early childhood learning."""

        # Prepare the content parts (prompt and image)
        content_parts = [
            prompt,
            img 
        ]

        # Generate content
        response = await model.generate_content_async(content_parts) # Use async version

        # Extract and clean the text
        generated_text = response.text.strip()
        
        # Basic validation (ensure it's roughly 4 sentences, though Gemini should handle this)
        # You could add more robust validation if needed
        if generated_text.count('.') < 2 or generated_text.count('.') > 6: 
             print(f"Warning: Generated text might not have exactly 4 sentences: {generated_text}")

        return generated_text

    except Exception as e:
        print(f"Error during Gemini API call: {e}")
        # Consider logging the full error details
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate description using AI: {str(e)}"
        )
