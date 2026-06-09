import { useState, useEffect } from 'react';
import Shirt3DPreview from '../components/Shirt3DPreview';
import { useUvCompositor } from '@/hooks/useUvCompositor';

const Simulator = () => {
  const [textureUrl, setTextureUrl] = useState<string | null>(null);
  const [uvZonesActive, setUvZonesActive] = useState(true);
  
  // Exemplo de estados necessários para o useUvCompositor
  const [uvMapZones, setUvMapZones] = useState({});
  const [uvLayers, setUvLayers] = useState([]);
  const [uvMapDims, setUvMapDims] = useState({ w: 2048, h: 2048 });

  const uvComposite = useUvCompositor({
    baseUrl: textureUrl,
    zones: uvMapZones,
    layers: uvLayers,
    uvWidth: uvMapDims.w,
    uvHeight: uvMapDims.h,
  });

  return (
    <div className="flex flex-col h-screen">
      <div className="flex-1 relative">
        <Shirt3DPreview
          frontImage={textureUrl || ''}
          backImage={textureUrl || ''}
          uvMapUrl={uvZonesActive ? null : (textureUrl ?? null)}
          uvCanvas={uvZonesActive ? uvComposite.canvas : null}
          uvVersion={uvComposite.version}
          fabricColor="#ffffff"
          autoRotate={false}
        />
      </div>
    </div>
  );
};

export default Simulator;
