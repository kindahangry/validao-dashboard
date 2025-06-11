import React from 'react';
import './Background.css';

const Background = ({ image }) => {
  return (
    <div 
      className="background"
      style={{ 
        backgroundImage: `url(${image})`
      }}
    />
  );
};

export default Background; 