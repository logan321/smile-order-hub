import { Suspense, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment, ContactShadows } from '@react-three/drei';
import * as THREE from 'three';

interface Shirt3DPreviewProps {
  frontImage: string;
  backImage: string;
  fabricColor?: string;
  autoRotate?: boolean;
}

/**
 * Build a 2D t-shirt silhouette (body + sleeves + V neckline) as THREE.Shape.
 * Coordinates are roughly centered around (0, 0). Width ~3.2, height ~3.6.
 */
function buildShirtShape(): { shape: THREE.Shape; width: number; height: number; cx: number; cy: number } {
  const s = new THREE.Shape();
  // Start at left sleeve outer top, go clockwise around the shirt outline.
  // y up is shirt-up.
  s.moveTo(-1.6, 0.9);            // left sleeve top-outer
  s.lineTo(-0.9, 1.3);            // left shoulder top, going inward
  s.lineTo(-0.25, 1.3);           // start of neck (left)
  s.bezierCurveTo(-0.25, 1.0, 0.25, 1.0, 0.25, 1.3); // neckline curve (V/round)
  s.lineTo(0.9, 1.3);             // right shoulder top
  s.lineTo(1.6, 0.9);             // right sleeve top-outer
  s.lineTo(1.6, 0.35);            // right sleeve outer-bottom
  s.lineTo(0.85, 0.5);            // right armpit
  s.lineTo(0.95, -1.7);           // right side body to hem
  s.quadraticCurveTo(0, -1.8, -0.95, -1.7); // bottom hem curve
  s.lineTo(-0.85, 0.5);           // left armpit
  s.lineTo(-1.6, 0.35);           // left sleeve outer-bottom
  s.closePath();
  return { shape: s, width: 3.2, height: 3.1, cx: 0, cy: -0.2 };
}

function useTexture(url: string, flipX = false) {
  return useMemo(() => {
    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin('anonymous');
    const t = loader.load(url);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 16;
    if (flipX) {
      t.wrapS = THREE.RepeatWrapping;
      t.repeat.x = -1;
      t.offset.x = 1;
    }
    t.needsUpdate = true;
    return t;
  }, [url, flipX]);
}

/** Build a ShapeGeometry and remap its UVs so the texture maps to the shape's bounding box. */
function buildShapeGeometryWithBoxUV(shape: THREE.Shape) {
  const geo = new THREE.ShapeGeometry(shape, 32);
  geo.computeBoundingBox();
  const bb = geo.boundingBox!;
  const sizeX = bb.max.x - bb.min.x;
  const sizeY = bb.max.y - bb.min.y;
  const pos = geo.attributes.position;
  const uv: number[] = [];
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    uv.push((x - bb.min.x) / sizeX, (y - bb.min.y) / sizeY);
  }
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  return geo;
}

function ShirtMesh({ frontImage, backImage, fabricColor }: { frontImage: string; backImage: string; fabricColor: string }) {
  const { shape } = useMemo(buildShirtShape, []);
  const frontTex = useTexture(frontImage);
  const backTex = useTexture(backImage, true);

  const depth = 0.18;

  // Side/rim mesh: extruded fabric body, slightly smaller depth, no caps shown (we cover them).
  const sideGeometry = useMemo(() => {
    const g = new THREE.ExtrudeGeometry(shape, {
      depth,
      bevelEnabled: true,
      bevelThickness: 0.04,
      bevelSize: 0.04,
      bevelSegments: 4,
      curveSegments: 32,
    });
    g.translate(0, 0, -depth / 2);
    g.computeVertexNormals();
    return g;
  }, [shape]);

  // Front and back planar geometries with UVs across the shape bounding box.
  const frontGeometry = useMemo(() => {
    const g = buildShapeGeometryWithBoxUV(shape);
    g.translate(0, 0, depth / 2 + 0.005);
    return g;
  }, [shape]);

  const backGeometry = useMemo(() => {
    const g = buildShapeGeometryWithBoxUV(shape);
    g.translate(0, 0, -depth / 2 - 0.005);
    // Flip to face -Z so it's visible from behind
    g.rotateY(Math.PI);
    return g;
  }, [shape]);

  const fabricMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: fabricColor, roughness: 0.92, metalness: 0.02,
  }), [fabricColor]);

  const frontMat = useMemo(() => new THREE.MeshStandardMaterial({
    map: frontTex, color: fabricColor, roughness: 0.85, metalness: 0.02, transparent: true,
  }), [frontTex, fabricColor]);

  const backMat = useMemo(() => new THREE.MeshStandardMaterial({
    map: backTex, color: fabricColor, roughness: 0.85, metalness: 0.02, transparent: true,
  }), [backTex, fabricColor]);

  return (
    <group rotation={[0, 0, 0]} position={[0, 0.1, 0]}>
      <mesh geometry={sideGeometry} material={fabricMat} castShadow receiveShadow />
      <mesh geometry={frontGeometry} material={frontMat} castShadow />
      <mesh geometry={backGeometry} material={backMat} castShadow />
    </group>
  );
}

export default function Shirt3DPreview({ frontImage, backImage, fabricColor = '#ffffff', autoRotate = true }: Shirt3DPreviewProps) {
  return (
    <div className="w-full h-full bg-gradient-to-b from-muted/40 to-muted rounded-lg overflow-hidden">
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
          <ShirtMesh frontImage={frontImage} backImage={backImage} fabricColor={fabricColor} />
          <ContactShadows position={[0, -1.95, 0]} opacity={0.4} scale={6} blur={2.6} far={3} />
          <Environment preset="studio" />
        </Suspense>
        <OrbitControls
          enablePan={false}
          autoRotate={autoRotate}
          autoRotateSpeed={1.2}
          minDistance={3}
          maxDistance={8}
          enableDamping
          dampingFactor={0.08}
        />
      </Canvas>
    </div>
  );
}