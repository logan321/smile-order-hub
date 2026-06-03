import { Suspense, useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, RoundedBox, Environment, ContactShadows } from '@react-three/drei';
import * as THREE from 'three';

interface Shirt3DPreviewProps {
  frontImage: string;
  backImage: string;
  fabricColor?: string;
  autoRotate?: boolean;
}

function ShirtMesh({ frontImage, backImage, fabricColor }: { frontImage: string; backImage: string; fabricColor: string }) {
  const groupRef = useRef<THREE.Group>(null);

  // Load textures
  const frontTex = useMemo(() => {
    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin('anonymous');
    const t = loader.load(frontImage);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 16;
    return t;
  }, [frontImage]);

  const backTex = useMemo(() => {
    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin('anonymous');
    const t = loader.load(backImage);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 16;
    return t;
  }, [backImage]);

  // Six materials for box faces: [+x, -x, +y, -y, +z (front), -z (back)]
  const materials = useMemo(() => {
    const fabric = new THREE.MeshStandardMaterial({ color: fabricColor, roughness: 0.85, metalness: 0.05 });
    const front = new THREE.MeshStandardMaterial({ map: frontTex, color: fabricColor, roughness: 0.8, metalness: 0.05 });
    const back = new THREE.MeshStandardMaterial({ map: backTex, color: fabricColor, roughness: 0.8, metalness: 0.05 });
    // Back face needs to be flipped horizontally so it reads correctly from behind
    const backTexCloned = backTex.clone();
    backTexCloned.wrapS = THREE.RepeatWrapping;
    backTexCloned.repeat.x = -1;
    backTexCloned.offset.x = 1;
    backTexCloned.needsUpdate = true;
    back.map = backTexCloned;
    return [fabric, fabric.clone(), fabric.clone(), fabric.clone(), front, back];
  }, [frontTex, backTex, fabricColor]);

  return (
    <group ref={groupRef}>
      <RoundedBox args={[1.6, 2.0, 0.22]} radius={0.09} smoothness={6} material={materials} castShadow receiveShadow />
    </group>
  );
}

export default function Shirt3DPreview({ frontImage, backImage, fabricColor = '#ffffff', autoRotate = true }: Shirt3DPreviewProps) {
  return (
    <div className="w-full h-full bg-gradient-to-b from-muted/40 to-muted rounded-lg overflow-hidden">
      <Canvas
        shadows
        camera={{ position: [0, 0, 3.2], fov: 38 }}
        gl={{ antialias: true, preserveDrawingBuffer: true }}
        dpr={[1, 2]}
      >
        <color attach="background" args={['#f1f3f6']} />
        <ambientLight intensity={0.6} />
        <directionalLight position={[3, 4, 5]} intensity={1.2} castShadow shadow-mapSize={[1024, 1024]} />
        <directionalLight position={[-3, 2, -2]} intensity={0.4} />
        <Suspense fallback={null}>
          <ShirtMesh frontImage={frontImage} backImage={backImage} fabricColor={fabricColor} />
          <ContactShadows position={[0, -1.15, 0]} opacity={0.35} scale={5} blur={2.4} far={2} />
          <Environment preset="city" />
        </Suspense>
        <OrbitControls
          enablePan={false}
          autoRotate={autoRotate}
          autoRotateSpeed={1.2}
          minDistance={2}
          maxDistance={6}
          enableDamping
          dampingFactor={0.08}
        />
      </Canvas>
    </div>
  );
}