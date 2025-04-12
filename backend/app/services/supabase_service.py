import os
import json
import httpx
from jose import jwt
from ..config.settings import settings
from typing import Optional, Dict, Any
import logging # Import logging

class SupabaseService:
    """
    Service for interacting with Supabase, particularly for JWT verification.
    This implementation doesn't require the full Supabase Python SDK.
    """
    
    @staticmethod
    async def verify_token(token: str) -> Optional[Dict[str, Any]]:
        """
        Verify a Supabase JWT token and return the user data if valid.
        
        Args:
            token: The JWT token to verify
            
        Returns:
            The user data if the token is valid, None otherwise
        """
        try:
            # Get Supabase URL and JWT secret from settings
            supabase_url = settings.supabase_url
            supabase_jwt_secret = settings.supabase_jwt_secret
            
            if not supabase_url or not supabase_jwt_secret:
                print("Supabase URL or JWT secret not configured")
                return None
            
            # Decode the token without verification first to get the user ID
            unverified_payload = jwt.decode(
                token,
                key=None,  # Explicitly pass None for the key argument
                options={
                    "verify_signature": False,
                    "verify_aud": False  # Explicitly disable audience verification here too
                }
            )
            # Get the user ID from the token
            user_id = unverified_payload.get("sub")
            if not user_id:
                print("No user ID in token")
                return None
            
            # Verify the token signature
            logging.info(f"Attempting to decode Supabase token. Secret loaded: {'Yes' if supabase_jwt_secret else 'No'}")
            # Optionally log the first few chars of the secret for confirmation, but be careful!
            # logging.info(f"Supabase JWT Secret (first 5 chars): {supabase_jwt_secret[:5] if supabase_jwt_secret else 'None'}")
            try:
                payload = jwt.decode(
                    token,
                    supabase_jwt_secret, # This is the 'key' argument
                    algorithms=["HS256"],
                    options={"verify_aud": False}  # Skip audience verification
                )
            except Exception as e:
                logging.error(f"Token verification failed: {e}", exc_info=True) # Use logging.error
                return None
            
            # Get user data from Supabase
            logging.info(f"Token decoded successfully for user {user_id}. Fetching user data from Supabase.")
            user_data = await SupabaseService.get_user_by_id(user_id, supabase_url)
            if not user_data:
                logging.warning(f"User {user_id} not found in Supabase despite valid token.")
                return None
            
            # Return user data with token claims
            logging.info(f"Successfully verified Supabase token and fetched user data for {user_id}.")
            return {
                "id": user_id,
                "email": payload.get("email"),
                "app_metadata": payload.get("app_metadata", {}),
                "user_metadata": payload.get("user_metadata", {}),
                "aud": payload.get("aud"),
                "role": payload.get("role"),
                **user_data
            }
        except Exception as e:
            logging.error(f"Error verifying Supabase token: {e}", exc_info=True) # Use logging.error
            return None
    
    @staticmethod
    async def get_user_by_id(user_id: str, supabase_url: str) -> Optional[Dict[str, Any]]:
        """
        Get user data from Supabase by user ID.
        
        Args:
            user_id: The Supabase user ID
            supabase_url: The Supabase project URL
            
        Returns:
            The user data if found, None otherwise
        """
        try:
            # Get Supabase service key from settings
            service_key = settings.supabase_service_key
            
            if not service_key:
                logging.warning("Supabase service key not configured") # Use logging.warning
                return None
            
            # Make request to Supabase Auth API
            logging.info(f"Fetching user data for {user_id} from Supabase API.")
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{supabase_url}/auth/v1/admin/users/{user_id}",
                    headers={
                        "Authorization": f"Bearer {service_key}",
                        "apikey": service_key
                    }
                )
                
                if response.status_code != 200:
                    logging.error(f"Error getting user from Supabase: {response.status_code} {response.text}") # Use logging.error
                    return None
                
                user_data = response.json()
                logging.info(f"Successfully fetched user data for {user_id} from Supabase.")
                return user_data
        except Exception as e:
            logging.error(f"Error getting user from Supabase: {e}", exc_info=True) # Use logging.error
            return None
