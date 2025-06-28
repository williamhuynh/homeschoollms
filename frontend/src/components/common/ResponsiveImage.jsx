import React from 'react';
import SignedImage from './SignedImage';

/**
 * A responsive image component that uses thumbnails, lazy loading, and progressive loading
 * 
 * @component
 * @example
 * return (
 *   <ResponsiveImage 
 *     image={{
 *       original_url: "https://example.com/images/original/image-123.jpg",
 *       thumbnail_small_url: "https://example.com/images/thumbnails/small/image-123.webp",
 *       thumbnail_medium_url: "https://example.com/images/thumbnails/medium/image-123.webp",
 *       thumbnail_large_url: "https://example.com/images/thumbnails/large/image-123.webp",
 *     }}
 *     alt="Description of image"
 *     width="300px"
 *     height="200px"
 *   />
 * )
 */
const ResponsiveImage = ({ 
  src, 
  alt, 
  sizes = "100vw",
  className = "",
  quality = 80,
  ...props 
}) => {
  // Generate responsive image sources
  const generateSrcSet = (imageSrc, quality) => {
    if (!imageSrc) return '';
    
    // Different sizes for responsive images
    const sizes = [320, 640, 960, 1280, 1920];
    
    return sizes.map(size => {
      // If it's already a full URL, use it as-is for legacy support
      if (imageSrc.startsWith('http')) {
        return `${imageSrc} ${size}w`;
      }
      
      // For new images, we'll rely on SignedImage to handle the URL generation
      return `${imageSrc}?w=${size}&q=${quality} ${size}w`;
    }).join(', ');
  };

  return (
    <div className={`responsive-image-container ${className}`}>
      <SignedImage
        src={src}
        alt={alt}
        quality={quality}
        className="responsive-image"
        style={{
          width: '100%',
          height: 'auto',
          display: 'block'
        }}
        {...props}
      />
    </div>
  );
};

export default ResponsiveImage;