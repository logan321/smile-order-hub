import { Suspense, useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { Canvas, useLoader, useThree, ThreeEvent } from '@react-three/fiber';
import { OrbitControls, ContactShadows, Environment } from '@react-three/drei';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { DecalGeometry } from 'three/examples/jsm/geometries/DecalGeometry.js';
import shirtModel from '@/assets/shirt-model.glb.asset.json';
import { Button } from '@/components/ui/button';

// A decal is a sticker projected onto the shirt mesh. Position/normal are in
// the LOCAL coordinate space of the shirt scene (after the model is loaded),
// so they stay valid no matter how the wrapper group is scaled/centered for display.
export interface Decal3D {
  id: string;
  textureUrl: string;     // PNG/JPG (transparent PNG recommended)
  position: [number, number, number];
  normal: [number, number, number];
  size: [number, number, number]; // width, height, depth (projection depth)
  rotation?: number;      // radians around the normal
  opacity?: number;
}

interface Shirt3DEditorProps {
  decals?: Decal3D[];
  fabricColor?: string;
  autoRotate?: boolean;
  // When set, clicking the shirt fires this with the hit position + normal in local space.
  // Use it to place new decals or to capture zone presets in the admin.
  onPick?: (hit: { position: [number, number, number]; normal: [number, number, number] }) => void;
  pickEnabled?: boolean;
  // Optional preview marker — shows a small sphere at the hit point (used during admin pick).
  pickPreview?: { position: [number, number, number]; normal: [number, number, number] } | null;
  className?: string;
}

// Força CORS adicionando cache-bust só na primeira vez por URL
const corsUrlCache = new Set<string>();
function toCorsUrl(url: string): string {
  // Se a imagem já vem do nosso proxy, não precisamos de cache-bust extra
  if (url.includes('/functions/v1/r?')) return url;
  
  if (corsUrlCache.has(url)) return url;
  corsUrlCache.add(url);
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}cb=${Date.now()}`;
}

function useDecalTexture(url: string) {
  const [tex, setTex] = useState<THREE.Texture | null>(null);
  useEffect(() => {
    let cancelled = false;
    const loader = new THREE.TextureLoader();
    
    // Configura o loader para mobile compatibility
    loader.setCrossOrigin('anonymous');
    
    const safeUrl = toCorsUrl(url);
    
    loader.load(
      safeUrl,
      (t) => {
        if (cancelled) return;
        t.colorSpace = THREE.SRGBColorSpace;
        t.anisotropy = 16;
        t.minFilter = THREE.LinearMipmapLinearFilter;
        t.magFilter = THREE.LinearFilter;
        t.needsUpdate = true;
        setTex(t);
      },
      undefined,
      (err) => {
        console.warn('Decal texture load failed with CORS, trying fallback...', err);
        // Fallback sem crossOrigin (algumas imagens podem não suportar)
        const fallbackLoader = new THREE.TextureLoader();
        fallbackLoader.load(url, (t) => {
          if (cancelled) return;
          t.colorSpace = THREE.SRGBColorSpace;
          setTex(t);
        });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [url]);
  return tex;
}

function DecalMesh({ decal, targetMesh }: { decal: Decal3D; targetMesh: THREE.Mesh | null }) {
  const tex = useDecalTexture(decal.textureUrl);

  const geometry = useMemo(() => {
    if (!targetMesh || !tex) return null;
    const position = new THREE.Vector3(...decal.position);
    const normal = new THREE.Vector3(...decal.normal).normalize();
    // DecalGeometry needs an Euler. Build a basis aligned with the surface normal
    // and then apply the user's roll around that normal.
    const up = Math.abs(normal.y) < 0.95
      ? new THREE.Vector3(0, 1, 0)
      : new THREE.Vector3(0, 0, 1);
    const tangent = new THREE.Vector3().crossVectors(up, normal).normalize();
    const bitangent = new THREE.Vector3().crossVectors(normal, tangent).normalize();
    const basis = new THREE.Matrix4().makeBasis(tangent, bitangent, normal);
    const euler = new THREE.Euler().setFromRotationMatrix(basis);
    if (decal.rotation) {
      // Re-apply roll around the normal
      const q = new THREE.Quaternion().setFromAxisAngle(normal, decal.rotation);
      const qBase = new THREE.Quaternion().setFromEuler(euler);
      qBase.multiply(q);
      euler.setFromQuaternion(qBase);
    }
    const size = new THREE.Vector3(...decal.size);
    try {
      return new DecalGeometry(targetMesh, position, euler, size);
    } catch (e) {
      console.warn('Decal generation failed', e);
      return null;
    }
  }, [targetMesh, decal.position, decal.normal, decal.size, decal.rotation, tex]);

  if (!geometry || !tex) return null;

  return (
    <mesh geometry={geometry} renderOrder={2}>
      <meshStandardMaterial
        map={tex}
        transparent
        opacity={decal.opacity ?? 1}
        depthTest
        depthWrite={false}
        polygonOffset
        polygonOffsetFactor={-4}
        roughness={0.7}
        metalness={0.05}
      />
    </mesh>
  );
}

function ShirtModel({
  decals,
  fabricColor,
  onPick,
  pickEnabled,
  pickPreview,
}: {
  decals: Decal3D[];
  fabricColor: string;
  onPick?: Shirt3DEditorProps['onPick'];
  pickEnabled?: boolean;
  pickPreview?: Shirt3DEditorProps['pickPreview'];
}) {
  const gltf = useLoader(GLTFLoader, shirtModel.url, (loader) => {
    (loader as GLTFLoader).setMeshoptDecoder(MeshoptDecoder);
  });

  const scene = useMemo(() => gltf.scene.clone(true), [gltf]);
  const [targetMesh, setTargetMesh] = useState<THREE.Mesh | null>(null);

  useEffect(() => {
    const color = new THREE.Color(fabricColor);
    let firstMesh: THREE.Mesh | null = null;
    scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!(mesh as any).isMesh) return;
      if (!firstMesh) firstMesh = mesh;
      const mat = new THREE.MeshStandardMaterial({
        color,
        roughness: 0.88,
        metalness: 0.02,
        side: THREE.DoubleSide,
      });
      mesh.material = mat;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      (mat as any).envMapIntensity = 0.1;
    });
    setTargetMesh(firstMesh);
  }, [scene, fabricColor]);

  const { center, size } = useMemo(() => {
    const box = new THREE.Box3().setFromObject(scene);
    const c = new THREE.Vector3();
    const s = new THREE.Vector3();
    box.getCenter(c);
    box.getSize(s);
    return { center: c, size: s };
  }, [scene]);

  const fitScale = 3.2 / Math.max(size.y, 0.0001);

  const groupRef = useRef<THREE.Group>(null);

  const handlePointerDown = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      if (!pickEnabled || !onPick) return;
      // Find the hit on the actual shirt mesh; ignore decals (they're separate meshes).
      if (e.object !== targetMesh) return;
      e.stopPropagation();
      const point = e.point.clone();
      const normalWorld = (e.face?.normal ?? new THREE.Vector3(0, 0, 1)).clone();
      // Convert world hit into the target mesh's LOCAL space, so we store invariant values.
      const inv = new THREE.Matrix4().copy(targetMesh.matrixWorld).invert();
      const localPoint = point.applyMatrix4(inv);
      const normalMatrix = new THREE.Matrix3().getNormalMatrix(targetMesh.matrixWorld);
      const invNormalMatrix = new THREE.Matrix3().copy(normalMatrix).invert();
      const localNormal = normalWorld.applyMatrix3(invNormalMatrix).normalize();
      onPick({
        position: [localPoint.x, localPoint.y, localPoint.z],
        normal: [localNormal.x, localNormal.y, localNormal.z],
      });
    },
    [pickEnabled, onPick, targetMesh],
  );

  return (
    <group
      ref={groupRef}
      scale={fitScale}
      position={[-center.x * fitScale, -center.y * fitScale + 0.2, -center.z * fitScale]}
      onPointerDown={handlePointerDown}
    >
      <primitive object={scene} />
      {targetMesh && (
        <group>
          {decals.map((d) => (
            <DecalMesh key={d.id} decal={d} targetMesh={targetMesh} />
          ))}
        </group>
      )}
      {pickPreview && (
        <mesh position={pickPreview.position}>
          <sphereGeometry args={[0.015, 16, 16]} />
          <meshBasicMaterial color="#f59e0b" />
        </mesh>
      )}
    </group>
  );
}

export default function Shirt3DEditor({
  decals = [],
  fabricColor = '#ffffff',
  autoRotate = false,
  onPick,
  pickEnabled = false,
  pickPreview = null,
  className,
}: Shirt3DEditorProps) {
  const [rotating, setRotating] = useState(autoRotate);

  return (
    <div className={`w-full h-full bg-gradient-to-b from-muted/40 to-muted rounded-lg overflow-hidden relative ${className ?? ''}`}>
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
          <ShirtModel
            decals={decals}
            fabricColor={fabricColor}
            onPick={onPick}
            pickEnabled={pickEnabled}
            pickPreview={pickPreview}
          />
          <ContactShadows position={[0, -1.95, 0]} opacity={0.4} scale={6} blur={2.6} far={3} />
          <Environment preset="studio" background={false} />
        </Suspense>
        <OrbitControls
          enablePan={false}
          autoRotate={rotating && !pickEnabled}
          autoRotateSpeed={1.2}
          minDistance={3}
          maxDistance={8}
          enableDamping
          dampingFactor={0.08}
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

      {pickEnabled && (
        <div className="absolute bottom-2 left-2 right-2 bg-amber-500/95 text-white rounded-lg p-2 text-center text-xs font-medium shadow-lg">
          Clique no ponto da camisa onde a zona deve ficar
        </div>
      )}
    </div>
  );
}