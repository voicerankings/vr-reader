/**
 * Extracts OpenGraph image URL from the current page
 * @returns {Object} Object containing image URL and metadata
 */
function getOpenGraphImage() {
  const result = {
    url: null,
    secureUrl: null,
    type: null,
    width: null,
    height: null,
    alt: null
  };

  // Try to get og:image first (primary image)
  const ogImage = document.querySelector('meta[property="og:image"]');
  if (ogImage) {
    result.url = ogImage.getAttribute('content');
  }

  // Try og:image:url as fallback
  if (!result.url) {
    const ogImageUrl = document.querySelector('meta[property="og:image:url"]');
    if (ogImageUrl) {
      result.url = ogImageUrl.getAttribute('content');
    }
  }

  // Get secure URL if available
  const ogImageSecure = document.querySelector('meta[property="og:image:secure_url"]');
  if (ogImageSecure) {
    result.secureUrl = ogImageSecure.getAttribute('content');
  }

  // Get additional metadata
  const ogImageType = document.querySelector('meta[property="og:image:type"]');
  if (ogImageType) {
    result.type = ogImageType.getAttribute('content');
  }

  const ogImageWidth = document.querySelector('meta[property="og:image:width"]');
  if (ogImageWidth) {
    result.width = parseInt(ogImageWidth.getAttribute('content'), 10);
  }

  const ogImageHeight = document.querySelector('meta[property="og:image:height"]');
  if (ogImageHeight) {
    result.height = parseInt(ogImageHeight.getAttribute('content'), 10);
  }

  const ogImageAlt = document.querySelector('meta[property="og:image:alt"]');
  if (ogImageAlt) {
    result.alt = ogImageAlt.getAttribute('content');
  }

  // Convert relative URLs to absolute
  if (result.url && !result.url.startsWith('http')) {
    result.url = new URL(result.url, window.location.href).href;
  }
  if (result.secureUrl && !result.secureUrl.startsWith('http')) {
    result.secureUrl = new URL(result.secureUrl, window.location.href).href;
  }

  return result;
}

/**
 * Gets all OpenGraph images (handles multiple images)
 * @returns {Array} Array of image objects
 */
function getAllOpenGraphImages() {
  const images = [];
  const ogImageTags = document.querySelectorAll('meta[property="og:image"], meta[property="og:image:url"]');
  
  ogImageTags.forEach(tag => {
    const url = tag.getAttribute('content');
    if (url) {
      const absoluteUrl = url.startsWith('http') 
        ? url 
        : new URL(url, window.location.href).href;
      
      if (!images.includes(absoluteUrl)) {
        images.push(absoluteUrl);
      }
    }
  });

  return images;
}

/**
 * Gets OpenGraph image with fallbacks to other meta tags
 * @returns {string|null} Image URL or null
 */
export function getOpenGraphImageWithFallbacks() {
  // Try OpenGraph first
  let imageUrl = getOpenGraphImage().url;
  
  // Fallback to Twitter Card image
  if (!imageUrl) {
    const twitterImage = document.querySelector('meta[name="twitter:image"], meta[property="twitter:image"]');
    if (twitterImage) {
      imageUrl = twitterImage.getAttribute('content');
    }
  }

  // Fallback to Twitter Card image:src
  if (!imageUrl) {
    const twitterImageSrc = document.querySelector('meta[name="twitter:image:src"], meta[property="twitter:image:src"]');
    if (twitterImageSrc) {
      imageUrl = twitterImageSrc.getAttribute('content');
    }
  }

  // Fallback to standard meta image
  if (!imageUrl) {
    const metaImage = document.querySelector('meta[itemprop="image"]');
    if (metaImage) {
      imageUrl = metaImage.getAttribute('content');
    }
  }

  // Fallback to link rel="image_src"
  if (!imageUrl) {
    const linkImage = document.querySelector('link[rel="image_src"]');
    if (linkImage) {
      imageUrl = linkImage.getAttribute('href');
    }
  }

  // Convert to absolute URL
  if (imageUrl && !imageUrl.startsWith('http')) {
    imageUrl = new URL(imageUrl, window.location.href).href;
  }

  return imageUrl;
}