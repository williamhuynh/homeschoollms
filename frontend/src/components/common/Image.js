import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { getSignedImageUrl, getResponsiveSrcset, getResponsiveSizes, isCloudinaryUrl } from '../../utils/imageUtils';
import { logger } from '../../utils/logger';

const Image = ({
  src,
  alt,
  width,
  height,
  quality = 80,
  className = '',
  style = {},
  loading = 'lazy',
  sizes,
  breakpoints = {},
  onError,
  onLoad,
  ...props
}) => {
  const [imageUrl, setImageUrl] = useState('');
  const [srcset, setSrcset] = useState('');
  const [sizesAttr, setSizesAttr] = useState('');
  const [error, setError] = useState(false);

  useEffect(() => {
    const loadImage = async () => {
      try {
        // If it's already a Cloudinary URL, use it directly
        if (isCloudinaryUrl(src)) {
          setImageUrl(src);
          return;
        }

        // Get the optimized URL
        const url = await getSignedImageUrl(src, { width, height, quality });
        setImageUrl(url);

        // Generate srcset if sizes are provided
        if (sizes) {
          const srcsetStr = await getResponsiveSrcset(src, { quality });
          setSrcset(srcsetStr);
          
          const sizesStr = getResponsiveSizes(sizes, breakpoints);
          setSizesAttr(sizesStr);
        }
      } catch (err) {
        logger.error('Error loading image', err);
        setError(true);
        if (onError) onError(err);
      }
    };

    loadImage();
  }, [src, width, height, quality, sizes, breakpoints, onError]);

  if (error) {
    return (
      <div className={`image-error ${className}`} style={style}>
        <span>Failed to load image</span>
      </div>
    );
  }

  return (
    <img
      src={imageUrl}
      alt={alt}
      width={width}
      height={height}
      className={className}
      style={style}
      loading={loading}
      srcSet={srcset || undefined}
      sizes={sizesAttr || undefined}
      onError={(e) => {
        setError(true);
        if (onError) onError(e);
      }}
      onLoad={onLoad}
      {...props}
    />
  );
};

Image.propTypes = {
  src: PropTypes.string.isRequired,
  alt: PropTypes.string.isRequired,
  width: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  height: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  quality: PropTypes.number,
  className: PropTypes.string,
  style: PropTypes.object,
  loading: PropTypes.oneOf(['lazy', 'eager']),
  sizes: PropTypes.string,
  breakpoints: PropTypes.object,
  onError: PropTypes.func,
  onLoad: PropTypes.func,
};

export default Image; 