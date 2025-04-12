/**
 * Utility for testing image loading performance
 * This module provides functions to measure and report on image loading performance
 */

/**
 * Measures the loading performance of images on the current page
 * @returns {Promise<Object>} Performance metrics
 */
export const measureImageLoadingPerformance = async () => {
  console.log('Starting image loading performance measurement...');
  
  // Get all ResponsiveImage and LazyImage components
  const responsiveImages = Array.from(document.querySelectorAll('[data-testid="responsive-image"]'));
  const lazyImages = Array.from(document.querySelectorAll('[data-testid="lazy-image"]'));
  
  console.log(`Found ${responsiveImages.length} ResponsiveImage components`);
  console.log(`Found ${lazyImages.length} LazyImage components`);
  
  // Get all image elements
  const allImages = Array.from(document.querySelectorAll('img'));
  console.log(`Found ${allImages.length} total image elements`);
  
  // Analyze image sources to determine thumbnail usage
  const imageSources = allImages.map(img => img.src);
  const thumbnailCount = imageSources.filter(src => src.includes('_thumb')).length;
  const smallThumbnailCount = imageSources.filter(src => src.includes('_small')).length;
  const mediumThumbnailCount = imageSources.filter(src => src.includes('_medium')).length;
  const largeThumbnailCount = imageSources.filter(src => src.includes('_large')).length;
  
  console.log(`Images using thumbnails: ${thumbnailCount}`);
  console.log(`Images using small thumbnails: ${smallThumbnailCount}`);
  console.log(`Images using medium thumbnails: ${mediumThumbnailCount}`);
  console.log(`Images using large thumbnails: ${largeThumbnailCount}`);
  
  // Get performance metrics from Navigation Timing API
  const performanceEntries = performance.getEntriesByType('navigation');
  const navigationTiming = performanceEntries.length > 0 ? performanceEntries[0] : null;
  
  // Get resource timing for images
  const imageResources = performance.getEntriesByType('resource')
    .filter(entry => entry.initiatorType === 'img' || entry.name.match(/\.(jpg|jpeg|png|gif|webp)$/i));
  
  // Calculate total image download size
  const totalImageSize = imageResources.reduce((total, resource) => total + resource.transferSize, 0);
  console.log(`Total image download size: ${(totalImageSize / 1024).toFixed(2)} KB`);
  
  // Calculate average image load time
  const averageImageLoadTime = imageResources.length > 0 
    ? imageResources.reduce((total, resource) => total + resource.duration, 0) / imageResources.length
    : 0;
  console.log(`Average image load time: ${averageImageLoadTime.toFixed(2)} ms`);
  
  // Check for lazy loading effectiveness
  const viewportHeight = window.innerHeight;
  const imagesInViewport = allImages.filter(img => {
    const rect = img.getBoundingClientRect();
    return rect.top < viewportHeight && rect.bottom > 0;
  }).length;
  
  console.log(`Images in initial viewport: ${imagesInViewport}`);
  console.log(`Images outside initial viewport: ${allImages.length - imagesInViewport}`);
  
  // Collect metrics
  const metrics = {
    timestamp: new Date().toISOString(),
    totalImages: allImages.length,
    responsiveImageComponents: responsiveImages.length,
    lazyImageComponents: lazyImages.length,
    thumbnailUsage: {
      total: thumbnailCount,
      small: smallThumbnailCount,
      medium: mediumThumbnailCount,
      large: largeThumbnailCount
    },
    performance: {
      totalImageSize: totalImageSize,
      totalImageSizeKB: (totalImageSize / 1024).toFixed(2),
      averageImageLoadTime: averageImageLoadTime.toFixed(2),
      domContentLoaded: navigationTiming ? navigationTiming.domContentLoadedEventEnd - navigationTiming.domContentLoadedEventStart : null,
      loadEvent: navigationTiming ? navigationTiming.loadEventEnd - navigationTiming.loadEventStart : null
    },
    lazyLoading: {
      imagesInViewport: imagesInViewport,
      imagesOutsideViewport: allImages.length - imagesInViewport
    }
  };
  
  console.log('Performance measurement complete', metrics);
  return metrics;
};

/**
 * Compares current performance with baseline measurements
 * @param {Object} currentMetrics - Current performance metrics
 * @param {Object} baselineMetrics - Baseline performance metrics for comparison
 * @returns {Object} Comparison results with improvement percentages
 */
export const compareWithBaseline = (currentMetrics, baselineMetrics) => {
  if (!baselineMetrics) {
    console.warn('No baseline metrics provided for comparison');
    return null;
  }
  
  const calculateImprovement = (current, baseline) => {
    if (baseline === 0) return 0;
    return ((baseline - current) / baseline * 100).toFixed(2);
  };
  
  const comparison = {
    timestamp: new Date().toISOString(),
    imageSizeImprovement: calculateImprovement(
      currentMetrics.performance.totalImageSize,
      baselineMetrics.performance.totalImageSize
    ),
    loadTimeImprovement: calculateImprovement(
      currentMetrics.performance.averageImageLoadTime,
      baselineMetrics.performance.averageImageLoadTime
    ),
    domContentLoadedImprovement: calculateImprovement(
      currentMetrics.performance.domContentLoaded,
      baselineMetrics.performance.domContentLoaded
    ),
    loadEventImprovement: calculateImprovement(
      currentMetrics.performance.loadEvent,
      baselineMetrics.performance.loadEvent
    )
  };
  
  console.log('Performance comparison:', comparison);
  return comparison;
};

/**
 * Saves performance metrics to localStorage for later comparison
 * @param {Object} metrics - Performance metrics to save
 */
export const savePerformanceBaseline = (metrics) => {
  localStorage.setItem('imagePerformanceBaseline', JSON.stringify(metrics));
  console.log('Performance baseline saved to localStorage');
};

/**
 * Loads performance baseline from localStorage
 * @returns {Object|null} Saved baseline metrics or null if not found
 */
export const loadPerformanceBaseline = () => {
  const saved = localStorage.getItem('imagePerformanceBaseline');
  if (!saved) {
    console.warn('No performance baseline found in localStorage');
    return null;
  }
  return JSON.parse(saved);
};

/**
 * Runs a complete performance test and compares with baseline if available
 * @returns {Promise<Object>} Test results
 */
export const runImagePerformanceTest = async () => {
  // Measure current performance
  const currentMetrics = await measureImageLoadingPerformance();
  
  // Load baseline if available
  const baseline = loadPerformanceBaseline();
  
  // Compare with baseline if available
  const comparison = baseline ? compareWithBaseline(currentMetrics, baseline) : null;
  
  // If no baseline exists, save current metrics as baseline
  if (!baseline) {
    savePerformanceBaseline(currentMetrics);
  }
  
  return {
    currentMetrics,
    baseline,
    comparison
  };
};

/**
 * Helper function to add test attributes to image components for testing
 * This should be called early in your application initialization
 */
export const setupImagePerformanceTesting = () => {
  // Add a MutationObserver to add data-testid attributes to image components
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === 'childList') {
        // Find ResponsiveImage components
        const responsiveImageContainers = document.querySelectorAll('.responsive-image-container');
        responsiveImageContainers.forEach(container => {
          if (!container.hasAttribute('data-testid')) {
            container.setAttribute('data-testid', 'responsive-image');
          }
        });
        
        // Find LazyImage components
        const lazyImageContainers = document.querySelectorAll('.lazy-image-container');
        lazyImageContainers.forEach(container => {
          if (!container.hasAttribute('data-testid')) {
            container.setAttribute('data-testid', 'lazy-image');
          }
        });
      }
    }
  });
  
  // Start observing
  observer.observe(document.body, { childList: true, subtree: true });
  
  console.log('Image performance testing setup complete');
  return observer; // Return observer so it can be disconnected if needed
};