import { Suspense, useEffect, useMemo, useState, useRef } from 'react';
import { cn } from '@/lib/utils';
import { Canvas, useLoader, useFrame } from '@react-three/fiber';
import { OrbitControls, ContactShadows, Environment, Html } from '@react-three/drei';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import shirtModel from '@/assets/shirt-model.glb.asset.json';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';




interface Shirt3DPreviewProps {
  frontImage: string;
  backImage: string;
  uvMapUrl?: string | null;
  uvCanvas?: HTMLCanvasElement | null;
  uvVersion?: number;
  fabricColor?: string;
  autoRotate?: boolean;
  cameraPosition?: [number, number, number];
  className?: string;
  animatingElement?: any;
  onAnimationComplete?: () => void;
  isUvReady?: boolean;
}

function useUvTexture(url: string | null, canvas: HTMLCanvasElement | null | undefined, version = 0) {
  return useMemo(() => {
    if (canvas) {
      console.log('3D Preview: Using canvas texture');
      const t = new THREE.CanvasTexture(canvas);
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 16;
      t.flipY = false;
      t.needsUpdate = true;
      return t;
    }
    if (!url) {
      console.log('3D Preview: No URL provided for texture');
      return null;
    }
    console.log('3D Preview: Loading texture from URL:', url);
    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin('anonymous');
    const t = loader.load(
      url,
      () => console.log('3D Preview: Texture loaded successfully'),
      undefined,
      (err) => console.error('3D Preview: Error loading texture:', err)
    );
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 16;
    t.flipY = false;
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.RepeatWrapping;
    t.needsUpdate = true;
    return t;
  }, [url, canvas, version]);
}

function ShirtModel({
  uvImage,
  uvCanvas,
  uvVersion,
  fabricColor,
  animatingElement,
  onAnimationComplete,
}: {
  uvImage: string | null;
  uvCanvas: HTMLCanvasElement | null | undefined;
  uvVersion?: number;
  fabricColor: string;
  animatingElement?: any;
  onAnimationComplete?: () => void;
}) {
  const gltf = useLoader(GLTFLoader, shirtModel.url, (loader) => {
    (loader as GLTFLoader).setMeshoptDecoder(MeshoptDecoder);
  });

  const uvTex = useUvTexture(uvImage, uvCanvas, uvVersion);
  const scene = useMemo(() => gltf.scene.clone(true), [gltf]);

  useEffect(() => {
    const color = new THREE.Color(fabricColor);
    
    scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!(mesh as any).isMesh) return;
      
      const mat = new THREE.MeshStandardMaterial({
        color: (uvTex && uvCanvas) ? new THREE.Color('#ffffff') : color,
        map: uvTex ?? null,
        roughness: 0.48,
        metalness: 0.0,
        side: THREE.DoubleSide,
        envMapIntensity: 0.6,
      });

      mesh.material = mat;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
    });
  }, [scene, uvTex, fabricColor]);

  const { center, size } = useMemo(() => {
    const box = new THREE.Box3().setFromObject(scene);
    const c = new THREE.Vector3();
    const s = new THREE.Vector3();
    box.getCenter(c);
    box.getSize(s);
    return { center: c, size: s };
  }, [scene]);

  const fitScale = 2.4 / Math.max(size.y, 0.0001);

  return (
    <group
      scale={fitScale}
      position={[-center.x * fitScale, -center.y * fitScale, -center.z * fitScale]}
    >
      <primitive object={scene} />
    </group>
  );
}

export default function Shirt3DPreview({
  frontImage,
  backImage,
  uvMapUrl,
  uvCanvas,
  uvVersion = 0,
  fabricColor = '#ffffff',
  autoRotate = true,
  cameraPosition = [0, 0.1, 5.2],
  className,
  animatingElement,
  onAnimationComplete,
  isUvReady = true,
}: Shirt3DPreviewProps) {
  const [rotating, setRotating] = useState(autoRotate);
  const orbitRef = useRef<any>(null);

  useEffect(() => {
    if (orbitRef.current) {
      const [x, y, z] = cameraPosition;
      orbitRef.current.object.position.set(x, y, z);
      orbitRef.current.update();
    }
  }, [cameraPosition]);
  const uvImage = uvMapUrl ?? null;
  const hasUv = !!uvImage || !!uvCanvas;

  console.log('Shirt3DPreview rendering, hasUv:', hasUv, 'uvMapUrl:', uvMapUrl);

  return (
    <div className={cn("w-full h-full bg-[#f1f3f6] rounded-lg overflow-hidden relative border border-border/20 shadow-inner", className)}>
      <Canvas
        shadows
        camera={{ position: cameraPosition, fov: 35 }}
        gl={{ 
          antialias: true, 
          preserveDrawingBuffer: true, 
          alpha: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.1
        }}
        dpr={[1, 2]}
        onError={(err) => console.error('R3F Canvas Error:', err)}
        style={{ background: '#f1f3f6' }}
      >
        <color attach="background" args={['#f1f3f6']} />
        <ambientLight intensity={0.85} />
        <directionalLight position={[3, 4, 2]} intensity={1.3} castShadow={false} />
        <directionalLight position={[-2, 1, -2]} intensity={0.4} />
        
        <Suspense fallback={
          <Html center>
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-xs font-medium text-muted-foreground">Carregando 3D...</p>
            </div>
          </Html>
        }>
          <ShirtModel 
            uvImage={uvImage} 
            uvCanvas={uvCanvas} 
            uvVersion={uvVersion} 
            fabricColor={fabricColor} 
            animatingElement={animatingElement}
            onAnimationComplete={onAnimationComplete}
          />
          <ContactShadows position={[0, -1.95, 0]} opacity={0.4} scale={6} blur={2.6} far={3} />
          <Environment preset="city" intensity={0.7} />
        </Suspense>

        <OrbitControls
          ref={orbitRef}
          enablePan={false}
          autoRotate={rotating}
          autoRotateSpeed={1.2}
          minDistance={3}
          maxDistance={8}
          enableDamping
          dampingFactor={0.08}
          makeDefault
        />
      </Canvas>

      <div className="absolute top-2 right-2 flex gap-2">
        <Button
          size="sm"
          variant="secondary"
          className="h-8 px-2 shadow-sm"
          onClick={() => setRotating((r) => !r)}
        >
          {rotating ? 'Pausar' : 'Girar'}
        </Button>
      </div>

      {!hasUv && (
        <div className="absolute bottom-2 left-2 right-2 bg-background/95 backdrop-blur border rounded-lg p-3 shadow-lg text-xs text-center text-muted-foreground">
          Esta camisa ainda não tem um <strong>molde UV</strong> configurado. Peça ao administrador para enviar o molde UV deste template para visualizar a estampa aplicada perfeitamente em 3D.
        </div>
      )}
    </div>
  );
}
