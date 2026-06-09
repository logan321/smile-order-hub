import React, { useState, useEffect } from 'react';
import * as LucideIcons from 'lucide-react';

interface ConfigIconProps {
  icon: any;
  className?: string;
  style?: React.CSSProperties;
  fallback?: React.ReactNode;
}

export const ConfigIcon: React.FC<ConfigIconProps> = ({ icon, className, style, fallback }) => {
  const [svgContent, setSvgContent] = useState<string | null>(null);
  const [isUrl, setIsUrl] = useState(false);

  useEffect(() => {
    const checkIcon = async () => {
      if (typeof icon === 'string' && (icon.startsWith('http') || icon.startsWith('/storage/v1/object/public/'))) {
        setIsUrl(true);
        if (icon.toLowerCase().endsWith('.svg') || icon.includes('image/svg+xml')) {
          try {
            const response = await fetch(icon);
            const text = await response.text();
            if (text.includes('<svg')) {
              setSvgContent(text);
            } else {
              setSvgContent(null);
            }
          } catch (error) {
            console.error('Error fetching SVG:', error);
            setSvgContent(null);
          }
        } else {
          setSvgContent(null);
        }
      } else {
        setIsUrl(false);
        setSvgContent(null);
      }
    };

    checkIcon();
  }, [icon]);

  if (!icon) return fallback || null;

  // If we have fetched SVG content, render it inline for better control and reliability
  if (svgContent) {
    return (
      <div 
        className={`${className} flex items-center justify-center`} 
        style={{ 
          ...style, 
          width: style?.width || '100%', 
          height: style?.height || '100%',
          overflow: 'hidden'
        }} 
        dangerouslySetInnerHTML={{ __html: svgContent }} 
      />
    );
  }

  // If it's a URL string but not a fetched SVG (e.g. PNG, JPG or failed SVG fetch)
  if (isUrl) {
    return (
      <img 
        src={icon} 
        alt="icon" 
        className={className} 
        style={{ ...style, objectFit: 'contain' }} 
        onError={() => console.error('Error loading image icon:', icon)}
      />
    );
  }

  // If it's a lucide icon name
  if (typeof icon === 'string' && icon in LucideIcons) {
    const IconComponent = (LucideIcons as any)[icon];
    return <IconComponent className={className} style={style} />;
  }

  // If it's already a component or Lucide icon
  if (typeof icon === 'function' || (typeof icon === 'object' && icon !== null)) {
    const IconComponent = icon;
    return <IconComponent className={className} style={style} />;
  }

  // If it's raw SVG string (basic check)
  if (typeof icon === 'string' && icon.includes('<svg')) {
    return <div className={className} style={style} dangerouslySetInnerHTML={{ __html: icon }} />;
  }

  return fallback || null;
};
