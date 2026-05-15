// components/templates/AppImage.jsx
'use client';

import { useState, memo } from 'react';
import { CldImage } from 'next-cloudinary';

const PLACEHOLDER = '/placeholder-application.png';

const AppImage = memo(
  ({ src, alt, width, height, className, loading, crop, quality, format }) => {
    const [hasError, setHasError] = useState(false);

    if (hasError) {
      return (
        <img
          src={PLACEHOLDER}
          alt={alt}
          width={width}
          height={height}
          className={className}
        />
      );
    }

    return (
      <CldImage
        src={src}
        alt={alt}
        width={width}
        height={height}
        className={className}
        loading={loading || 'lazy'}
        quality={quality || 'auto'}
        format={format || 'auto'}
        crop={crop || { type: 'fit', gravity: 'auto' }}
        onError={() => setHasError(true)}
      />
    );
  },
);

AppImage.displayName = 'AppImage';

export default AppImage;
