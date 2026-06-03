import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useLoader } from '@react-three/fiber';
import { OrbitControls, Environment, ContactShadows } from '@react-three/drei';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import shirtModel from '@/assets/shirt-model.glb.asset.json';
import { Button } from '@/components/ui/button';
import { Upload, X } from 'lucide-react';

interface Shirt3DPreviewProps {
  frontImage: string;
  backImage: string;
  fabricColor?: string;
  autoRotate?: boolean;
}

function useUvTexture(url: string | null) {
  return useMemo(() => {
    if (!url) return null;
    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin('anonymous');
    const t = loader.load(url);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 16;
    // GLTF expects UVs without Y flip
    t.flipY = false;
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.RepeatWrapping;
    t.needsUpdate = true;
    return t;
  }, [url]);
}

function ShirtModel({
  uvImage,
  fabricColor,
}: {
  uvImage: string | null;
  fabricColor: string;
}) {
  const gltf = useLoader(GLTFLoader, shirtModel.url, (loader) => {
    (loader as GLTFLoader).setMeshoptDecoder(MeshoptDecoder);
  });

  const uvTex = useUvTexture(uvImage);

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
    });
  }, [scene, uvTex, fabricColor]);

  const fitScale = 3.2 / Math.max(size.y, 0.0001);

  return (
    <group
      scale={fitScale}
      position={[-center.x * fitScale, -center.y * fitScale + 0.2, -center.z * fitScale]}
    >
      <primitive object={scene} />
    </group>
  );
}

export default function Shirt3DPreview({
  frontImage,
  backImage,
  fabricColor = '#ffffff',
  autoRotate = true,
}: Shirt3DPreviewProps) {
  const [uvImage, setUvImage] = useState<string | null>(null);
  const [rotating, setRotating] = useState(autoRotate);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const onPickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setUvImage(reader.result as string);
    reader.readAsDataURL(file);
  };

  return (
    <div className="w-full h-full bg-gradient-to-b from-muted/40 to-muted rounded-lg overflow-hidden relative">
      <Canvas
        shadows
        camera={{ position: [0, 0.1, 5.2], fov: 35 }}
        gl={{ antialias: true, preserveDrawingBuffer: true }}
        dpr={[1, 2]}
      >
        <color attach="background" args={['#f1f3f6']} />
        <ambientLight intensity={0.6} />
        <directionalLight position={[3, 4, 5]} intensity={1.2} castShadow shadow-mapSize={[1024, 1024]} />
        <directionalLight position={[-3, 2, -2]} intensity={0.4} />
        <Suspense fallback={null}>
          <ShirtModel uvImage={uvImage} fabricColor={fabricColor} />
          <ContactShadows position={[0, -1.95, 0]} opacity={0.4} scale={6} blur={2.6} far={3} />
          <Environment preset="studio" />
        </Suspense>
        <OrbitControls
          enablePan={false}
          autoRotate={rotating}
          autoRotateSpeed={1.2}
          minDistance={3}
          maxDistance={8}
          enableDamping
          dampingFactor={0.08}
        />
      </Canvas>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={onPickFile}
      />

      <div className="absolute top-2 right-2 flex gap-2">
        <Button
          size="sm"
          variant="secondary"
          className="h-8 px-2 shadow-sm"
          onClick={() => setRotating((r) => !r)}
        >
          {rotating ? 'Pausar' : 'Girar'}
        </Button>
        <Button
          size="sm"
          variant="secondary"
          className="h-8 px-2 shadow-sm gap-1"
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload className="h-4 w-4" />
          {uvImage ? 'Trocar molde' : 'Carregar molde UV'}
        </Button>
        {uvImage && (
          <Button
            size="sm"
            variant="secondary"
            className="h-8 px-2 shadow-sm"
            onClick={() => setUvImage(null)}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {!uvImage && (
        <div className="absolute bottom-2 left-2 right-2 bg-background/95 backdrop-blur border rounded-lg p-3 shadow-lg text-xs text-center text-muted-foreground">
          Faça upload do <strong>molde UV completo</strong> (frente + costas + mangas + gola na mesma imagem, igual ao layout exportado do CLO3D) para visualizar a sublimação aplicada perfeitamente na camisa.
        </div>
      )}
    </div>
  );
}
