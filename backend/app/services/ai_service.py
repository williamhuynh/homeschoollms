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
# Models supporting multiple images include gemini-1.5-flash-latest, gemini-1.5-pro-latest, gemini-2.5-flash-lite
# Using gemini-2.5-flash-lite for improved performance and cost efficiency.
model_name = 'gemini-2.5-flash-lite' 
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

        <Context Information> {context_description} </Context Information>

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

async def analyze_image_for_questions(images: List[Dict[str, Union[bytes, str]]]) -> List[Dict[str, Union[str, List[str]]]]:
    """
    Analyzes one or more images and generates contextual questions to better understand the learning activity.

    Args:
        images: A list of dictionaries, each containing 'bytes' and 'mime_type' for an image.

    Returns:
        A list of dictionaries representing questions with their types and options.

    Raises:
        HTTPException: If the API key is not configured, the model failed to initialize,
                       input validation fails, or the generation fails.
    """
    logger.info(f"Analyzing {len(images)} image(s) to generate contextual questions.")
    
    if not api_key:
        error_msg = "Google AI API key is not configured."
        logger.error(error_msg)
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=error_msg
        )
        
    if not model:
        error_msg = f"Gemini model '{model_name}' failed to initialize."
        logger.error(error_msg)
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=error_msg
        )
        
    if not images:
         raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="No valid images provided to analyze."
        )

    prepared_images = []
    try:
        # Validate and prepare images
        for i, image_data in enumerate(images):
            image_bytes = image_data.get("bytes")
            image_mime_type = image_data.get("mime_type")

            if not image_bytes or not image_mime_type:
                 logger.warning(f"Skipping image {i+1} due to missing data.")
                 continue

            if not image_mime_type.startswith('image/'):
                logger.warning(f"Skipping image {i+1} due to invalid MIME type: {image_mime_type}")
                continue

            try:
                img = Image.open(io.BytesIO(image_bytes))
                prepared_images.append(img)
                logger.debug(f"Successfully prepared image {i+1}: {img.format}, {img.size}")
            except Exception as img_error:
                logger.warning(f"Failed to process image {i+1}: {img_error}. Skipping.")
                continue 

        if not prepared_images:
            raise ValueError("No valid images could be processed.")
            
        # Construct the prompt for analyzing images and generating questions
        prompt = f"""You are an image analyst. Analyze the provided photo(s) and then ask me questions so you can better interpret what is happening from the context of education. 

        Based on what you see in the image(s), generate 4-6 specific questions that would help understand:
        - The type of learning activity taking place
        - The level of support or independence shown
        - The educational context and goals
        - Any specific skills being demonstrated

        Examples of good questions include:
        - Was the student reading aloud or silently?
        - What was the task type?
        - Was the text familiar or new?
        - What was the goal?
        - Was this independent, guided, or paired?

        Return your response as a JSON array where each question is an object with:
        - "question": the question text
        - "type": either "radio" or "text"
        - "options": array of options (only for radio type)

        Only ask questions that are relevant to what you can observe in the image(s). Do not make up details."""

        logger.info(f"Sending image analysis prompt to Gemini API")
        
        # Prepare the content parts (prompt followed by all images)
        content_parts = [prompt] + prepared_images

        # Generate content
        response = await model.generate_content_async(content_parts)
        logger.info("Received response from Gemini API for question generation")

        # Extract and clean the text
        generated_text = response.text.strip()
        logger.info(f"Generated questions text length: {len(generated_text)}")
        
        # Try to parse as JSON
        import json
        try:
            # Remove any markdown formatting if present
            if generated_text.startswith('```json'):
                generated_text = generated_text.replace('```json', '').replace('```', '').strip()
            elif generated_text.startswith('```'):
                generated_text = generated_text.replace('```', '').strip()
            
            questions_data = json.loads(generated_text)
            
            # Validate the structure
            if not isinstance(questions_data, list):
                raise ValueError("Response is not a list of questions")
            
            # Add IDs to questions and validate structure
            for i, question in enumerate(questions_data):
                question['id'] = f'ai_question_{i+1}'
                if 'question' not in question or 'type' not in question:
                    raise ValueError(f"Question {i+1} missing required fields")
                if question['type'] == 'radio' and 'options' not in question:
                    raise ValueError(f"Radio question {i+1} missing options")
            
            return questions_data
            
        except (json.JSONDecodeError, ValueError) as parse_error:
            logger.error(f"Failed to parse questions JSON: {parse_error}")
            logger.error(f"Raw response: {generated_text}")
            
            # Fallback to default questions if AI response can't be parsed
            fallback_questions = [
                {
                    "id": "task_type",
                    "question": "What type of learning activity is shown in the image?",
                    "type": "radio",
                    "options": ["Reading activity", "Writing task", "Math problem solving", "Creative activity", "Physical activity", "Group work"]
                },
                {
                    "id": "support_level",
                    "question": "What level of support did the student receive?",
                    "type": "radio",
                    "options": ["Independent work", "Guided support", "Paired work", "Group activity"]
                },
                {
                    "id": "learning_goal",
                    "question": "What was the main learning goal of this activity?",
                    "type": "text",
                    "placeholder": "Describe the intended learning outcome..."
                }
            ]
            logger.info("Using fallback questions due to parsing error")
            return fallback_questions

    except ValueError as ve:
        logger.error(f"Input validation error: {ve}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid input: {str(ve)}"
        )
    except Exception as e:
        logger.error(f"ERROR during Gemini API call for questions: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate questions using AI due to an internal error."
        )

async def suggest_learning_outcomes(
    images: List[Dict[str, Union[bytes, str]]], 
    question_answers: Dict[str, str], 
    curriculum_data: Dict,
    student_grade: str
) -> List[Dict[str, Union[str, int]]]:
    """
    Analyzes images and context answers to suggest appropriate learning outcomes with confidence scores.

    Args:
        images: A list of dictionaries, each containing 'bytes' and 'mime_type' for an image.
        question_answers: Dictionary of question IDs to answers from the context form.
        curriculum_data: The curriculum JSON data for the student's grade level.
        student_grade: The student's grade level (e.g., "Stage 1", "Early Stage 1").

    Returns:
        A list of dictionaries representing suggested learning outcomes with confidence scores.

    Raises:
        HTTPException: If the API key is not configured, the model failed to initialize,
                       input validation fails, or the generation fails.
    """
    logger.info(f"Suggesting learning outcomes for {len(images)} image(s) with grade {student_grade}")
    
    if not api_key:
        error_msg = "Google AI API key is not configured."
        logger.error(error_msg)
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=error_msg
        )
        
    if not model:
        error_msg = f"Gemini model '{model_name}' failed to initialize."
        logger.error(error_msg)
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=error_msg
        )
        
    if not images:
         raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="No valid images provided to analyze."
        )

    prepared_images = []
    try:
        # Validate and prepare images
        for i, image_data in enumerate(images):
            image_bytes = image_data.get("bytes")
            image_mime_type = image_data.get("mime_type")

            if not image_bytes or not image_mime_type:
                 logger.warning(f"Skipping image {i+1} due to missing data.")
                 continue

            if not image_mime_type.startswith('image/'):
                logger.warning(f"Skipping image {i+1} due to invalid MIME type: {image_mime_type}")
                continue

            try:
                img = Image.open(io.BytesIO(image_bytes))
                prepared_images.append(img)
                logger.debug(f"Successfully prepared image {i+1}: {img.format}, {img.size}")
            except Exception as img_error:
                logger.warning(f"Failed to process image {i+1}: {img_error}. Skipping.")
                continue 

        if not prepared_images:
            raise ValueError("No valid images could be processed.")
            
        # Format the context answers for the prompt
        context_text = "\n".join([f"{key}: {value}" for key, value in question_answers.items()])
        
        # Format curriculum data for the prompt
        import json
        curriculum_json = json.dumps(curriculum_data, indent=2)
        
        # Construct the prompt for suggesting learning outcomes
        prompt = f"""Given the image(s) and the additional information provided by the user, analyze the learning activity and suggest relevant Learning Outcomes with confidence percentages.

        CONTEXT INFORMATION PROVIDED BY USER:
        {context_text}

        AVAILABLE LEARNING OUTCOMES FOR {student_grade}:
        {curriculum_json}

        Instructions:
        1. Analyze the image(s) and context to understand what learning is taking place
        2. Match this to the most appropriate learning outcomes from the curriculum provided
        3. For each suggested outcome, provide a confidence percentage (0-100%)
        4. Include reasoning for why each outcome was suggested
        5. Only suggest outcomes where you have at least 50% confidence
        6. Rank outcomes by confidence level (highest first)

        Return your response as a JSON array where each suggestion is an object with:
        - "code": the learning outcome code (e.g., "EN1-RECOM-01")
        - "name": the learning outcome name
        - "description": the learning outcome description  
        - "confidence": confidence percentage as integer (50-100)
        - "reasoning": brief explanation of why this outcome matches the evidence

        If no outcomes reach 50% confidence, return an empty array."""

        logger.info(f"Sending outcome suggestion prompt to Gemini API")
        
        # Prepare the content parts (prompt followed by all images)
        content_parts = [prompt] + prepared_images

        # Generate content
        response = await model.generate_content_async(content_parts)
        logger.info("Received response from Gemini API for outcome suggestions")

        # Extract and clean the text
        generated_text = response.text.strip()
        logger.info(f"Generated outcomes text length: {len(generated_text)}")
        
        # Try to parse as JSON
        try:
            # Remove any markdown formatting if present
            if generated_text.startswith('```json'):
                generated_text = generated_text.replace('```json', '').replace('```', '').strip()
            elif generated_text.startswith('```'):
                generated_text = generated_text.replace('```', '').strip()
            
            outcomes_data = json.loads(generated_text)
            
            # Validate the structure
            if not isinstance(outcomes_data, list):
                raise ValueError("Response is not a list of outcomes")
            
            # Validate each outcome and filter by confidence
            valid_outcomes = []
            for outcome in outcomes_data:
                if all(key in outcome for key in ['code', 'name', 'description', 'confidence', 'reasoning']):
                    if isinstance(outcome['confidence'], int) and outcome['confidence'] >= 50:
                        valid_outcomes.append(outcome)
                    else:
                        logger.warning(f"Filtering out low confidence outcome: {outcome.get('code', 'unknown')} ({outcome.get('confidence', 0)}%)")
                else:
                    logger.warning(f"Outcome missing required fields: {outcome}")
            
            # Sort by confidence (highest first)
            valid_outcomes.sort(key=lambda x: x['confidence'], reverse=True)
            
            logger.info(f"Successfully generated {len(valid_outcomes)} valid outcome suggestions")
            return valid_outcomes
            
        except (json.JSONDecodeError, ValueError) as parse_error:
            logger.error(f"Failed to parse outcomes JSON: {parse_error}")
            logger.error(f"Raw response: {generated_text}")
            
            # Return empty array if parsing fails
            logger.info("Returning empty outcomes array due to parsing error")
            return []

    except ValueError as ve:
        logger.error(f"Input validation error: {ve}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid input: {str(ve)}"
        )
    except Exception as e:
        logger.error(f"ERROR during Gemini API call for outcomes: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to suggest learning outcomes using AI due to an internal error."
        )

async def generate_learning_area_report(
    student_id: str,
    learning_area_code: str,
    learning_area_name: str,
    evidence_items: List[Dict],
    report_period: str,
    grade_level: str,
    outcomes_data: List[Dict] = None,
    student_name: str = None
) -> str:
    """
    Generates a comprehensive, evidence-focused summary for a learning area.

    Args:
        student_id: The student's ID
        learning_area_code: Code of the learning area (e.g., "EN" for English)
        learning_area_name: Full name of the learning area
        evidence_items: List of evidence documents for this learning area
        report_period: The report period (annual, term_1, etc.)
        grade_level: The student's grade level
        outcomes_data: List of learning outcome definitions with code, name, description
        student_name: The student's first name for personalization

    Returns:
        A comprehensive narrative summary describing how the student achieved the learning outcomes.

    Raises:
        HTTPException: If the API key is not configured or generation fails.
    """
    logger.info(f"Generating learning area report for {learning_area_name} with {len(evidence_items)} evidence items")
    
    if not api_key:
        error_msg = "Google AI API key is not configured."
        logger.error(error_msg)
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=error_msg
        )
        
    if not model:
        error_msg = f"Gemini model '{model_name}' failed to initialize."
        logger.error(error_msg)
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=error_msg
        )
    
    try:
        # Build outcome lookup for enriching evidence with outcome details
        outcome_lookup = {}
        if outcomes_data:
            for outcome in outcomes_data:
                code = outcome.get("code", "").upper()
                outcome_lookup[code] = {
                    "name": outcome.get("name", ""),
                    "description": outcome.get("description", "")
                }
        
        # Extract key information from evidence with enriched outcome data
        evidence_summaries = []
        learning_outcomes_covered = set()
        
        for item in evidence_items[:12]:  # Use up to 12 most recent items for richer context
            # Build enriched outcome information
            enriched_outcomes = []
            for outcome_code in item.get("learning_outcome_codes", []):
                code_upper = outcome_code.upper()
                learning_outcomes_covered.add(code_upper)
                outcome_info = outcome_lookup.get(code_upper, {})
                enriched_outcomes.append({
                    "code": outcome_code,
                    "name": outcome_info.get("name", ""),
                    "description": outcome_info.get("description", "")
                })
            
            evidence_summaries.append({
                "title": item.get("title", ""),
                "description": item.get("description", ""),
                "date": str(item.get("uploaded_at", ""))[:10],
                "outcomes": enriched_outcomes
            })
        
        # Format evidence information with full outcome details
        evidence_text = ""
        for i, evidence in enumerate(evidence_summaries, 1):
            evidence_text += f"\n{i}. \"{evidence['title']}\" ({evidence['date']})"
            if evidence['description']:
                evidence_text += f"\n   Activity Description: {evidence['description']}"
            if evidence['outcomes']:
                evidence_text += f"\n   Learning Outcomes Demonstrated:"
                for outcome in evidence['outcomes']:
                    if outcome['name'] or outcome['description']:
                        evidence_text += f"\n   - {outcome['code']}: {outcome['name']}"
                        if outcome['description']:
                            evidence_text += f" - {outcome['description']}"
                    else:
                        evidence_text += f"\n   - {outcome['code']}"
            evidence_text += "\n"
        
        # Format available outcomes for context
        outcomes_text = ""
        if outcomes_data:
            outcomes_text = "\nLEARNING OUTCOMES FOR THIS AREA:\n"
            for outcome in outcomes_data[:15]:  # Limit to prevent prompt from being too long
                outcomes_text += f"- {outcome.get('code', '')}: {outcome.get('name', '')} - {outcome.get('description', '')}\n"
        
        # Map report period to human-readable text
        period_map = {
            "annual": "this academic year",
            "term_1": "Term 1",
            "term_2": "Term 2",
            "term_3": "Term 3",
            "term_4": "Term 4",
            "custom": "this period"
        }
        period_text = period_map.get(report_period, "this period")
        
        # Use student name or generic reference
        student_ref = student_name if student_name else "the student"
        
        # Construct the enhanced prompt
        prompt = f"""You are writing an educational progress report for a {grade_level} student's achievement in {learning_area_name}.

Write a comprehensive narrative that describes HOW {student_ref} has demonstrated achievement of learning outcomes, with specific references to evidence collected during {period_text}.

STRUCTURE YOUR RESPONSE AS FOLLOWS:

1. OPENING SUMMARY (2-3 sentences)
   - Provide an overview of {student_ref}'s engagement and progress in {learning_area_name}
   - Mention the breadth of learning outcomes addressed ({len(learning_outcomes_covered)} outcomes across {len(evidence_summaries)} documented activities)

2. EVIDENCE-BASED NARRATIVE (Main body - this is the most important section)
   For the most significant pieces of evidence, write about:
   - WHAT {student_ref} did (reference the specific activity by its title)
   - WHICH learning outcome(s) this demonstrates and HOW
   - WHY this evidence is meaningful in showing attainment of that outcome
   
   Use language like:
   - "In '[Evidence Title]', {student_ref} demonstrated [specific skill/outcome] by [what they did]..."
   - "This activity provides clear evidence of [outcome name] because..."
   - "The work shows {student_ref}'s ability to [outcome description]..."
   
   Cover at least 3-4 different pieces of evidence, explaining the connection between each activity and the learning outcomes it demonstrates.

3. CONCLUDING STATEMENT (1-2 sentences)
   - Summarize {student_ref}'s overall attainment and any areas of particular strength

EVIDENCE COLLECTED:
{evidence_text}
{outcomes_text}

IMPORTANT GUIDELINES:
- Be SPECIFIC - always cite evidence by its exact title in quotes
- EXPLAIN the significance - don't just list what was done, explain WHY it matters for the learning outcome
- CONNECT activities to curriculum outcomes explicitly
- Write in past tense as this is a period report
- Use warm, professional language suitable for parent-teacher communication
- Focus on demonstrated learning and achievement, not just participation
- Total length should be 1500-2500 characters (be thorough but concise)

Do not include any preamble like "Here is the report" - just provide the narrative directly."""

        logger.info(f"Sending enhanced report generation prompt to Gemini API")
        
        # Generate content
        response = await model.generate_content_async(prompt)
        logger.info("Received response from Gemini API for report generation")

        # Extract and clean the text
        generated_text = response.text.strip()
        
        # Basic length validation - allow longer responses now
        if len(generated_text) > 3000:
            # Truncate if too long
            generated_text = generated_text[:2997] + "..."
        
        logger.info(f"Generated report summary length: {len(generated_text)} characters")
        
        return generated_text

    except Exception as e:
        logger.error(f"ERROR during report generation: {e}", exc_info=True)
        # Return a more detailed fallback summary if generation fails
        evidence_titles = [item.get("title", "Untitled") for item in evidence_items[:5]]
        evidence_list = ", ".join(f'"{t}"' for t in evidence_titles)
        
        return (
            f"During {period_text}, {student_name or 'the student'} engaged in {len(evidence_items)} documented learning "
            f"activities in {learning_area_name}, addressing {len(learning_outcomes_covered)} different learning outcomes.\n\n"
            f"Key activities included: {evidence_list}. Each of these activities provided evidence of progress "
            f"toward the {grade_level} curriculum expectations for {learning_area_name}.\n\n"
            f"Please review the individual evidence items attached to this report for detailed insights into "
            f"specific skills demonstrated and learning achievements."
        )

async def generate_title_from_images(images: List[Dict[str, Union[bytes, str]]], context_description: str) -> str:
    """
    Generates a concise, factual title for one or more images based on provided context.

    Args:
        images: A list of dictionaries, each containing 'bytes' and 'mime_type' for an image.
        context_description: Contextual information related to the image(s).

    Returns:
        A short title string (aim for <= 60 characters).

    Raises:
        HTTPException: If configuration or validation fails, or generation fails.
    """
    logger.info(f"Generating title for {len(images)} image(s).")
    logger.info(f"Context: {context_description[:100]}{'...' if len(context_description) > 100 else ''}")

    if not api_key:
        error_msg = "Google AI API key is not configured."
        logger.error(error_msg)
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=error_msg)

    if not model:
        error_msg = f"Gemini model '{model_name}' failed to initialize."
        logger.error(error_msg)
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=error_msg)

    if not images:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="No valid images provided to generate title.")

    prepared_images = []
    try:
        for i, image_data in enumerate(images):
            image_bytes = image_data.get("bytes")
            image_mime_type = image_data.get("mime_type")

            if not image_bytes or not image_mime_type:
                logger.warning(f"Skipping image {i+1} due to missing data.")
                continue

            if not image_mime_type.startswith('image/'):
                logger.warning(f"Skipping image {i+1} due to invalid MIME type: {image_mime_type}")
                continue

            try:
                img = Image.open(io.BytesIO(image_bytes))
                prepared_images.append(img)
                logger.debug(f"Successfully prepared image {i+1}: {img.format}, {img.size}")
            except Exception as img_error:
                logger.warning(f"Failed to process image {i+1}: {img_error}. Skipping.")
                continue

        if not prepared_images:
            raise ValueError("No valid images could be processed.")

        if not context_description or len(context_description.strip()) == 0:
            raise ValueError("Context description cannot be empty")

        prompt = f"""You are titling an educational evidence entry for a child's learning journal. Using the images and context below, generate a concise, factual, neutral title.

Context: {context_description}

Guidelines:
- 4 to 8 words, maximum 60 characters
- No emojis or quotation marks
- Avoid overly emotive language
- Prefer action-oriented or noun phrase titles (e.g., "Measuring Volumes with Cups")
- If a clear learning area is evident from the context, you may include a short hint (e.g., "EN" for English) if it remains concise
- Output ONLY the title text, with no extra commentary
"""

        logger.info("Sending title generation prompt to Gemini API")
        content_parts = [prompt] + prepared_images
        response = await model.generate_content_async(content_parts)
        logger.info("Received response from Gemini API for title generation")

        generated_title = (response.text or "").strip()

        # Clean common wrappers
        if generated_title.startswith('```'):
            generated_title = generated_title.strip('`').strip()
        if generated_title.startswith('Title:'):
            generated_title = generated_title[len('Title:'):].strip()

        # Enforce basic length cap
        if len(generated_title) > 80:
            generated_title = generated_title[:77] + '...'

        return generated_title

    except ValueError as ve:
        logger.error(f"Input validation error (title): {ve}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=f"Invalid input: {str(ve)}")
    except Exception as e:
        logger.error(f"ERROR during Gemini API call for title: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to generate title using AI due to an internal error.")

async def chat_with_ai(messages: List[Dict[str, str]], system_context: str) -> str:
    """
    Conduct a chat turn with the AI model using the provided message history and a system context.

    Args:
        messages: List of dicts with shape {"role": "user"|"assistant", "content": str}
        system_context: A system instruction string that sets behavior and context (e.g., student info)

    Returns:
        The assistant reply text.

    Raises:
        HTTPException on validation or model errors
    """
    logger.info("Starting chat turn with %d prior messages", len(messages) if messages else 0)

    if not api_key:
        error_msg = "Google AI API key is not configured."
        logger.error(error_msg)
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=error_msg)

    if not model:
        error_msg = f"Gemini model '{model_name}' failed to initialize."
        logger.error(error_msg)
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=error_msg)

    if not isinstance(messages, list) or any(
        not isinstance(m, dict) or m.get("role") not in {"user", "assistant"} or not isinstance(m.get("content"), str)
        for m in messages
    ):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid messages format")

    if not system_context or not system_context.strip():
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="System context must be provided")

    try:
        # Convert to Gemini chat history format
        history = []
        # Prepend system context as a high-priority instruction
        # Since global model is created without system_instruction, include it as a first user message block
        history.append({
            "role": "user",
            "parts": [
                (
                    "You are an AI co-pilot helping a homeschooling parent. "
                    "Follow the System Context strictly. "
                    "System Context:\n" + system_context.strip()
                )
            ]
        })

        for m in messages[:-1]:  # all but the latest user message
            role = "user" if m["role"] == "user" else "model"
            history.append({"role": role, "parts": [m["content"]]})

        latest = messages[-1] if messages else {"role": "user", "content": "Hello"}
        if latest["role"] != "user":
            # Ensure the last message is a user turn to send
            history.append({"role": "model", "parts": [latest["content"]]})
            latest_to_send = "Please continue."
        else:
            latest_to_send = latest["content"]

        chat = model.start_chat(history=history)
        response = await chat.send_message_async(latest_to_send)
        reply_text = (response.text or "").strip()
        return reply_text
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Unexpected error during chat: %s", e, exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Chat generation failed")
