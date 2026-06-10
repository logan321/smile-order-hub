import { Suspense, useEffect, useRef, useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Canvas, useLoader } from '@react-three/fiber';
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
  canvasBg?: string;
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

  const scene = useMemo(() => gltf.scene.clone(true), [gltf]);
  const texRef = useRef<THREE.CanvasTexture | null>(null);

  useEffect(() => {
    const color = new THREE.Color(fabricColor);

    let tex: THREE.Texture | null = null;

    if (uvCanvas && uvCanvas.width > 0 && uvCanvas.height > 0) {
      // Sempre recria CanvasTexture — é o mais compatível mobile/desktop
      if (texRef.current) {
        texRef.current.dispose();
        texRef.current = null;
      }
      const ct = new THREE.CanvasTexture(uvCanvas);
      ct.colorSpace = THREE.SRGBColorSpace;
      ct.flipY = false;
      ct.anisotropy = 2; // Reduzido para mobile performance
      ct.generateMipmaps = true;
      ct.minFilter = THREE.LinearMipmapLinearFilter;
      ct.needsUpdate = true;
      texRef.current = ct;
      tex = ct;
    } else if (uvImage) {
      const loader = new THREE.TextureLoader();
      loader.setCrossOrigin('anonymous');
      tex = loader.load(uvImage);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.flipY = false;
      tex.needsUpdate = true;
    }

    scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!(mesh as any).isMesh) return;
      
      // CORREÇÃO 2 — Liberar memória no Shirt3DPreview
      if (mesh.material) {
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach(m => m.dispose());
        } else {
          mesh.material.dispose();
        }
      }

      const mat = new THREE.MeshStandardMaterial({
        color: tex ? new THREE.Color('#ffffff') : color,
        map: tex ?? null,
        roughness: 0.88,
        metalness: 0.02,
        side: THREE.DoubleSide,
      });
      mesh.material = mat;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
    });
  }, [scene, uvCanvas, uvVersion, uvImage, fabricColor]);

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
  isUvReady,
  canvasBg = '#f1f3f6',
}: Shirt3DPreviewProps) {
  const [rotating, setRotating] = useState(autoRotate);
  const [webglFailed, setWebglFailed] = useState(false);
  const orbitRef = useRef<any>(null);

  const isMobile = useMemo(() => {
    if (typeof navigator === 'undefined') return false;
    return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  }, []);

  useEffect(() => {
    if (orbitRef.current) {
      const [x, y, z] = cameraPosition;
      orbitRef.current.object.position.set(x, y, z);
      orbitRef.current.update();
    }
  }, [cameraPosition]);

  const uvImage = uvMapUrl ?? null;
  const hasUv = !!uvImage || !!uvCanvas;

  if (webglFailed) {
    return (
      <div className={cn('w-full h-full rounded-lg flex items-center justify-center p-6 text-center bg-muted', className)}>
        <p className="text-sm text-muted-foreground">
          Seu dispositivo não suporta visualização 3D ou o contexto WebGL foi perdido. 
          Tente recarregar a página ou usar outro navegador.
        </p>
      </div>
    );
  }

  return (
    <div
      className={cn('w-full h-full rounded-lg overflow-hidden relative border border-border/20 shadow-inner', className)}
      style={{ background: canvasBg }}
    >
      <Canvas
        shadows
        camera={{ position: cameraPosition, fov: 35 }}
        gl={{ 
          antialias: !isMobile,
          preserveDrawingBuffer: true, 
          alpha: true,
          powerPreference: isMobile ? 'low-power' : 'high-performance'
        }}
        onCreated={(state) => {
          state.gl.domElement.addEventListener(
            'webglcontextlost', 
            () => setWebglFailed(true)
          );
        }}
        dpr={[1, 1.5]}
        style={{ background: canvasBg }}
      >
        <color attach="background" args={[canvasBg]} />
        <ambientLight intensity={0.8} />
        <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} intensity={1} castShadow />
        <directionalLight position={[3, 4, 5]} intensity={1.5} castShadow shadow-mapSize={[512, 512]} />
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
          <ShirtModel
            uvImage={uvImage}
            uvCanvas={uvCanvas}
            uvVersion={uvVersion}
            fabricColor={fabricColor}
          />
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

      <div className="absolute top-2 right-2 flex gap-2">
        <Button size="sm" variant="secondary" className="h-8 px-2 shadow-sm"
          onClick={() => setRotating((r) => !r)}>
          {rotating ? 'Pausar' : 'Girar'}
        </Button>
      </div>

      {!hasUv && (
        <div className="absolute bottom-2 left-2 right-2 bg-background/95 backdrop-blur border rounded-lg p-3 shadow-lg text-xs text-center text-muted-foreground">
          Esta camisa ainda não tem um <strong>molde UV</strong> configurado.
        </div>
      )}
    </div>
  );
}