import { Suspense, useEffect, useMemo, useRef } from 'react';
import { Canvas, useLoader } from '@react-three/fiber';
import { OrbitControls, Environment, ContactShadows } from '@react-three/drei';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import shirtModel from '@/assets/shirt-model.glb.asset.json';

interface Shirt3DPreviewProps {
  frontImage: string;
  backImage: string;
  fabricColor?: string;
  autoRotate?: boolean;
}

function useImageTexture(url: string) {
  return useMemo(() => {
    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin('anonymous');
    const t = loader.load(url);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 16;
    t.wrapS = THREE.ClampToEdgeWrapping;
    t.wrapT = THREE.ClampToEdgeWrapping;
    t.needsUpdate = true;
    return t;
  }, [url]);
}

/**
 * Load the CLO3D-exported t-shirt GLB and re-skin it:
 * - White fabric base
 * - Two user-supplied images projected onto the chest (front) and back along Z.
 */
function ShirtModel({
  frontImage,
  backImage,
  fabricColor,
}: {
  frontImage: string;
  backImage: string;
  fabricColor: string;
}) {
  const gltf = useLoader(GLTFLoader, shirtModel.url, (loader) => {
    (loader as GLTFLoader).setMeshoptDecoder(MeshoptDecoder);
  });

  const frontTex = useImageTexture(frontImage);
  const backTex = useImageTexture(backImage);
  const groupRef = useRef<THREE.Group>(null);

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
    // The user's front/back images already contain the full shirt artwork
    // (silhouette + design). Project them to cover the entire bbox so the
    // design fills the whole 3D garment instead of sitting as a tiny decal.
    const projW = size.x * 1.15;
    const projH = size.y * 1.05;
    const projCenterX = center.x;
    const projCenterY = center.y;

    scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!(mesh as any).isMesh) return;
      const mat = new THREE.MeshStandardMaterial({
        color,
        roughness: 0.88,
        metalness: 0.02,
      });
      mat.onBeforeCompile = (shader) => {
        shader.uniforms.uFrontTex = { value: frontTex };
        shader.uniforms.uBackTex = { value: backTex };
        shader.uniforms.uProjCenter = { value: new THREE.Vector2(projCenterX, projCenterY) };
        shader.uniforms.uProjSize = { value: new THREE.Vector2(projW, projH) };

        shader.vertexShader = shader.vertexShader
          .replace(
            '#include <common>',
            `#include <common>
             varying vec3 vWorldPosCustom;
             varying vec3 vWorldNormalCustom;`
          )
          .replace(
            '#include <worldpos_vertex>',
            `#include <worldpos_vertex>
             vWorldPosCustom = (modelMatrix * vec4(transformed, 1.0)).xyz;
             vWorldNormalCustom = normalize(mat3(modelMatrix) * objectNormal);`
          );

        shader.fragmentShader = shader.fragmentShader
          .replace(
            '#include <common>',
            `#include <common>
             uniform sampler2D uFrontTex;
             uniform sampler2D uBackTex;
             uniform vec2 uProjCenter;
             uniform vec2 uProjSize;
             varying vec3 vWorldPosCustom;
             varying vec3 vWorldNormalCustom;`
          )
          .replace(
            '#include <color_fragment>',
            `#include <color_fragment>
             vec2 rel = (vWorldPosCustom.xy - uProjCenter) / uProjSize + 0.5;
             bool isFront = vWorldNormalCustom.z > 0.0;
             vec2 uv = vec2(isFront ? rel.x : 1.0 - rel.x, rel.y);
             if (rel.x > 0.0 && rel.x < 1.0 && rel.y > 0.0 && rel.y < 1.0) {
               vec4 decal = isFront ? texture2D(uFrontTex, uv) : texture2D(uBackTex, uv);
               diffuseColor.rgb = mix(diffuseColor.rgb, decal.rgb, decal.a);
             }`
          );
      };
      mesh.material = mat;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
    });
  }, [scene, frontTex, backTex, fabricColor, center, size]);

  const fitScale = 3.2 / Math.max(size.y, 0.0001);

  return (
    <group
      ref={groupRef}
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
          <ShirtModel frontImage={frontImage} backImage={backImage} fabricColor={fabricColor} />
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
