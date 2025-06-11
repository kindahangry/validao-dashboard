import React, { useState, useEffect } from 'react';
import './Background.css';

const Background = ({ image }) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [currentImage, setCurrentImage] = useState(null);

  useEffect(() => {
    const baseName = image.split('/').pop().replace('.png', '');
    const optimizedPath = `/src/assets/optimized/${baseName}`;
    
    // Create image element for preloading
    const img = new Image();
    
    // Set up responsive image loading
    const updateImage = () => {
      const width = window.innerWidth;
      let suffix = '@1x';
      
      if (width >= 1920) {
        suffix = '@2x';
      } else if (width <= 480) {
        suffix = '@small';
      }
      
      const newSrc = `${optimizedPath}${suffix}.webp`;
      if (newSrc !== currentImage) {
        setCurrentImage(newSrc);
        img.src = newSrc;
      }
    };

    // Initial load
    updateImage();

    // Update on resize
    const handleResize = () => {
      updateImage();
    };

    window.addEventListener('resize', handleResize);

    img.onload = () => {
      setIsLoaded(true);
    };

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [image]);

  return (
    <div 
      className={`background ${isLoaded ? 'loaded' : 'loading'}`}
      style={{ 
        backgroundImage: currentImage ? `url(${currentImage})` : 'none',
      }}
    />
  );
};

export default Background; 