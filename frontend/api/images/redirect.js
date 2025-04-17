// This endpoint takes a file path and redirects to the signed URL
// It allows Vercel's image optimizer to use a much simpler URL parameter
module.exports = async function(req, res) {
  try {
    console.log("REDIRECT: Image redirect endpoint called");
    
    // Get the encoded path from query parameter
    const { path } = req.query;
    
    if (!path) {
      return res.status(400).json({ error: 'Path parameter is required' });
    }
    
    // Decode the path
    const decodedPath = decodeURIComponent(path);
    console.log(`REDIRECT: Requested image path: ${decodedPath}`);
    
    // Get the backend API URL from environment or use the default
    const backendUrl = process.env.BACKEND_API_URL || 'https://homeschoollms-server.onrender.com';
    
    // Get authorization header from the incoming request
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      console.error('No authorization header provided');
      return res.status(401).json({ detail: 'Authorization header is required' });
    }
    
    // Call the backend to get a signed URL for this path
    const apiUrl = `${backendUrl}/api/files/signed-url?file_path=${encodeURIComponent(decodedPath)}`;
    console.log(`REDIRECT: Fetching signed URL from: ${apiUrl}`);
    
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader
      }
    });
    
    if (!response.ok) {
      console.error(`REDIRECT ERROR: Backend returned ${response.status}`);
      const errorData = await response.json();
      return res.status(response.status).json(errorData);
    }
    
    const data = await response.json();
    
    if (!data.signed_url) {
      return res.status(500).json({ error: 'No signed URL returned from backend' });
    }
    
    console.log(`REDIRECT: Successfully got signed URL, redirecting`);
    
    // Redirect directly to the signed URL
    res.redirect(307, data.signed_url);
  } catch (error) {
    console.error('REDIRECT ERROR:', error);
    res.status(500).json({ error: 'Redirect failed', message: error.message });
  }
}; 