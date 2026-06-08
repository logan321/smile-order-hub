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
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayTextureRef = useRef<THREE.CanvasTexture | null>(null);
  const animatingStateRef = useRef<any>(null);

  if (!overlayCanvasRef.current && typeof document !== 'undefined') {
    overlayCanvasRef.current = document.createElement('canvas');
    overlayCanvasRef.current.width = 1024;
    overlayCanvasRef.current.height = 1024;
    overlayTextureRef.current = new THREE.CanvasTexture(overlayCanvasRef.current);
    overlayTextureRef.current.flipY = false;
  }

  const scene = useMemo(() => gltf.scene.clone(true), [gltf]);

  useEffect(() => {
    animatingStateRef.current = animatingElement;
  }, [animatingElement]);

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

      mat.onBeforeCompile = (shader) => {
        shader.uniforms.tOverlay = { value: overlayTextureRef.current };
        shader.fragmentShader = `
          uniform sampler2D tOverlay;
          ${shader.fragmentShader.replace(
            '#include <map_fragment>',
            `
            #ifdef USE_MAP
              vec4 texelColor = texture2D( map, vMapUv );
              vec4 overlayColor = texture2D( tOverlay, vMapUv );
              texelColor = mix(texelColor, overlayColor, overlayColor.a);
              diffuseColor *= texelColor;
            #endif
            `
          )}
        `;
        mat.userData.shader = shader;
      };

      mesh.material = mat;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      (mat as any).envMapIntensity = 0.1;
    });
  }, [scene, uvTex, fabricColor]);

  useFrame((state, delta) => {
    const anim = animatingStateRef.current;
    const canvas = overlayCanvasRef.current;
    const texture = overlayTextureRef.current;
    if (!canvas || !texture) return;

    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (anim && anim.progress < 1) {
      anim.progress = Math.min(1, anim.progress + delta / 0.6); // 600ms
      
      const p = anim.progress;
      const t = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;

      const currentX = anim.fromUV.x + (anim.toUV.x - anim.fromUV.x) * t;
      const currentY = anim.fromUV.y + (anim.toUV.y - anim.fromUV.y) * t;
      const currentW = anim.fromUV.w + (anim.toUV.w - anim.fromUV.w) * t;
      const currentH = anim.fromUV.h + (anim.toUV.h - anim.fromUV.h) * t;

      // Desenha o elemento no overlay
      const x = currentX * canvas.width;
      const y = currentY * canvas.height;
      const w = currentW * canvas.width;
      const h = currentH * canvas.height;

      ctx.save();
      ctx.translate(x, y);
      
      const layer = anim.layer;
      if (layer.type === 'text') {
        ctx.fillStyle = layer.color || '#ffffff';
        const fontSize = (layer.fontSize || 50) * (canvas.width / 1024); // Ajuste proporcional ao canvas
        ctx.font = `${layer.fontWeight || 900} ${fontSize}px ${layer.fontFamily || 'Impact'}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(layer.content, 0, 0);
      } else if (layer.type === 'image') {
        // Para simplificar no overlay, vamos carregar a imagem se possível ou pular
        // Idealmente usaríamos uma cache, mas para o efeito de "texto deslizando" o foco é o texto
      }
      ctx.restore();
      
      texture.needsUpdate = true;

      if (anim.progress >= 1) {
        onAnimationComplete?.();
      }
    } else {
      texture.needsUpdate = true;
    }
  });

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
        gl={{ antialias: true, preserveDrawingBuffer: true, alpha: true }}
        dpr={[1, 2]}
        onError={(err) => console.error('R3F Canvas Error:', err)}
        style={{ background: '#f1f3f6' }}
      >
        <color attach="background" args={['#f1f3f6']} />
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
          <ShirtModel 
            uvImage={uvImage} 
            uvCanvas={uvCanvas} 
            uvVersion={uvVersion} 
            fabricColor={fabricColor} 
            animatingElement={animatingElement}
            onAnimationComplete={onAnimationComplete}
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
