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
  image,
  src, 
  alt, 
  className = "",
  quality = 80,
  ...props 
}) => {
  // Determine the source URL from either image object or direct src prop
  const imageSource = image?.original_url || src;

  return (
    <div className={`responsive-image-container ${className}`}>
      <SignedImage
        src={imageSource}
        alt={alt}
        quality={quality}
        className="responsive-image"
        style={{
          width: '100%',
          height: 'auto',
          display: 'block',
          ...props.style
        }}
        {...props}
      />
    </div>
  );
};

export default ResponsiveImage;