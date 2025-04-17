// This API route acts as a proxy for the backend's signed-url endpoint
module.exports = async function handler(req, res) {
  try {
    console.log('Signed URL proxy route called with query:', req.query);
    
    // Get authorization header from the incoming request
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      console.error('No authorization header provided');
      return res.status(401).json({ detail: 'Authorization header is required' });
    }
    
    // Get the backend API URL from environment variables or use a default
    const backendUrl = process.env.BACKEND_API_URL || 'https://api.homeschoollms.com';
    
    // Build the URL with query parameters
    const queryParams = new URLSearchParams(req.query).toString();
    const apiUrl = `${backendUrl}/api/files/signed-url?${queryParams}`;
    
    console.log(`Proxying request to backend: ${apiUrl}`);
    
    // Forward the request to the backend API
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader
      }
    });
    
    // Get the response data
    const data = await response.json();
    
    // If the response was not successful, throw an error
    if (!response.ok) {
      console.error('Backend API error:', data);
      return res.status(response.status).json(data);
    }
    
    // Return the successful response
    console.log('Successfully retrieved signed URL from backend');
    return res.status(200).json(data);
  } catch (error) {
    console.error('Error in signed-url proxy:', error);
    return res.status(500).json({ 
      detail: 'Failed to generate signed URL',
      error: error.message 
    });
  }
} 