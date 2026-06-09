import React from 'react';
import * as LucideIcons from 'lucide-react';

interface ConfigIconProps {
  icon: any;
  className?: string;
  style?: React.CSSProperties;
  fallback?: React.ReactNode;
}

export const ConfigIcon: React.FC<ConfigIconProps> = ({ icon, className, style, fallback }) => {
  if (!icon) return fallback || null;

  // If it's a URL string
  if (typeof icon === 'string' && (icon.startsWith('http') || icon.startsWith('/storage/v1/object/public/'))) {
    return <img src={icon} alt="icon" className={className} style={{ ...style, objectFit: 'contain' }} />;
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
