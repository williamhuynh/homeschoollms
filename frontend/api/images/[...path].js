import { NextResponse } from 'next/server';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const signedUrl = searchParams.get('url');
    
    if (!signedUrl) {
      return new NextResponse('Missing signed URL', { status: 400 });
    }

    // Fetch the image from Backblaze using the signed URL
    const response = await fetch(signedUrl);
    
    if (!response.ok) {
      return new NextResponse('Failed to fetch image', { status: response.status });
    }

    // Get the content type from the response
    const contentType = response.headers.get('content-type');
    
    // Create a new response with the image data
    return new NextResponse(response.body, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (error) {
    console.error('Error proxying image:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
} 