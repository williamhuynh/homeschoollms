// This is a simple image proxy for S3 signed URLs
// It fetches images from S3 and serves them directly
module.exports = async function(req, res) {
  try {
    // Get the URL parameter from the query string
    const { url } = req.query;
    
    if (!url) {
      return res.status(400).json({ error: 'URL parameter is required' });
    }
    
    console.log(`S3 image proxy called for URL: ${url.substring(0, 50)}...`);
    
    // Decode the URL to get the original S3 signed URL
    const decodedUrl = decodeURIComponent(url);
    
    // Fetch the image from S3
    const imageResponse = await fetch(decodedUrl, {
      method: 'GET',
    });
    
    if (!imageResponse.ok) {
      console.error(`Failed to fetch image from S3: ${imageResponse.status} ${imageResponse.statusText}`);
      return res.status(imageResponse.status).json({ 
        error: `Failed to fetch image: ${imageResponse.statusText}` 
      });
    }
    
    // Get the content type from the response headers
    const contentType = imageResponse.headers.get('content-type') || 'image/jpeg';
    
    // Get the image data as a buffer
    const imageBuffer = await imageResponse.arrayBuffer();
    
    // Set cache headers to improve performance
    res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 1 day
    res.setHeader('Content-Type', contentType);
    
    // Send the image data
    res.status(200).send(Buffer.from(imageBuffer));
  } catch (error) {
    console.error('Error in image proxy:', error);
    res.status(500).json({ error: 'Failed to proxy image' });
  }
}; 