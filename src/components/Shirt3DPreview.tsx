import { Suspense, useEffect, useMemo, useState, useRef } from 'react';
import { Canvas, useLoader } from '@react-three/fiber';
import { OrbitControls, ContactShadows, Environment, Html } from '@react-three/drei';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import shirtModel from '@/assets/shirt-model.glb.asset.json';
import { Button } from '@/components/ui/button';
import { Loader2, Plus, Minus, RotateCcw, Maximize } from 'lucide-react';




interface Shirt3DPreviewProps {
  frontImage: string;
  backImage: string;
  uvMapUrl?: string | null;
  uvCanvas?: HTMLCanvasElement | null;
  uvVersion?: number;
  fabricColor?: string;
  autoRotate?: boolean;
  cameraPosition?: [number, number, number];
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
}: {
  uvImage: string | null;
  uvCanvas: HTMLCanvasElement | null | undefined;
  uvVersion?: number;
  fabricColor: string;
}) {
  const gltf = useLoader(GLTFLoader, shirtModel.url, (loader) => {
    (loader as GLTFLoader).setMeshoptDecoder(MeshoptDecoder);
  });

  const uvTex = useUvTexture(uvImage, uvCanvas, uvVersion);

  const scene = useMemo(() => gltf.scene.clone(true), [gltf]);

  const { center, size } = useMemo(() => {
    const box = new THREE.Box3().setFromObject(scene);
    const c = new THREE.Vector3();
    const s = new THREE.Vector3();
    box.getCenter(c);
    box.getSize(s);
    return { center: c, size: s };
  }, [scene]);

  useEffect(() => {
    const color = new THREE.Color(fabricColor);
    scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!(mesh as any).isMesh) return;
      const mat = new THREE.MeshStandardMaterial({
        color: uvTex ? new THREE.Color('#ffffff') : color,
        map: uvTex ?? null,
        roughness: 0.88,
        metalness: 0.02,
        side: THREE.DoubleSide,
      });
      mesh.material = mat;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      (mat as any).envMapIntensity = 0.1;
    });
  }, [scene, uvTex, fabricColor]);

  const fitScale = 3.5 / Math.max(size.y, 0.0001);

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
  cameraPosition = [0, 0.1, 4.0],
}: Shirt3DPreviewProps) {
  const [rotating, setRotating] = useState(autoRotate);
  const orbitRef = useRef<any>(null);

  const handleZoomIn = () => {
    if (orbitRef.current) {
      orbitRef.current.dollyIn(1.2);
      orbitRef.current.update();
    }
  };

  const handleZoomOut = () => {
    if (orbitRef.current) {
      orbitRef.current.dollyOut(1.2);
      orbitRef.current.update();
    }
  };

  const handleReset = () => {
    if (orbitRef.current) {
      const [x, y, z] = cameraPosition;
      orbitRef.current.object.position.set(x, y, z);
      orbitRef.current.target.set(0, 0, 0);
      orbitRef.current.update();
    }
  };

  const handleFullscreen = () => {
    const container = orbitRef.current?.domElement?.parentElement;
    if (container) {
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else {
        container.requestFullscreen();
      }
    }
  };

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
    <div className="w-full h-full bg-gradient-to-b from-sky-100/50 to-green-100/30 rounded-lg overflow-hidden relative border border-border/20 shadow-inner">
      <Canvas
        shadows
        camera={{ position: cameraPosition, fov: 35 }}
        gl={{ antialias: true, preserveDrawingBuffer: true, alpha: true }}
        dpr={[1, 2]}
        onError={(err) => console.error('R3F Canvas Error:', err)}
        className="w-full h-full"
      >
        <ambientLight intensity={0.8} />
        <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} intensity={1} castShadow />
        <directionalLight position={[3, 4, 5]} intensity={1.5} castShadow shadow-mapSize={[1024, 1024]} />
        <directionalLight position={[-3, 2, -2]} intensity={0.5} />
        <pointLight position={[0, 5, 0]} intensity={0.5} />
        
        <Suspense fallback={
          <Html center>
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-xs font-medium text-muted-foreground">Carregando 3D...</p>
            </div>
          </Html>
        }>
          <ShirtModel uvImage={uvImage} uvCanvas={uvCanvas} uvVersion={uvVersion} fabricColor={fabricColor} />
          <ContactShadows position={[0, -1.95, 0]} opacity={0.4} scale={6} blur={2.6} far={3} />
          <Environment preset="city" />
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

      <div className="absolute right-4 top-1/2 -translate-y-1/2 flex flex-col gap-2 z-10">
        <button 
          onClick={handleZoomIn}
          className="w-10 h-10 rounded-full bg-white shadow-lg flex items-center justify-center hover:bg-gray-50 transition-colors"
          title="Aumentar Zoom"
        >
          <Plus className="h-5 w-5 text-slate-600" />
        </button>
        <button 
          onClick={handleZoomOut}
          className="w-10 h-10 rounded-full bg-white shadow-lg flex items-center justify-center hover:bg-gray-50 transition-colors"
          title="Diminuir Zoom"
        >
          <Minus className="h-5 w-5 text-slate-600" />
        </button>
        <button 
          onClick={handleReset}
          className="w-10 h-10 rounded-full bg-white shadow-lg flex items-center justify-center hover:bg-gray-50 transition-colors"
          title="Resetar Câmera"
        >
          <RotateCcw className="h-5 w-5 text-slate-600" />
        </button>
        <button 
          onClick={handleFullscreen}
          className="w-10 h-10 rounded-full bg-white shadow-lg flex items-center justify-center hover:bg-gray-50 transition-colors"
          title="Tela Cheia"
        >
          <Maximize className="h-5 w-5 text-slate-600" />
        </button>
      </div>

      <div className="absolute top-2 right-2 flex gap-2">
        <Button
          size="sm"
          variant="secondary"
          className="h-8 px-2 shadow-sm bg-white/80 backdrop-blur-sm"
          onClick={() => setRotating((r) => !r)}
        >
          {rotating ? 'Pausar Rotação' : 'Girar Camisa'}
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
