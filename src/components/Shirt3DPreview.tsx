import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useLoader } from '@react-three/fiber';
import { OrbitControls, Environment, ContactShadows } from '@react-three/drei';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import shirtModel from '@/assets/shirt-model.glb.asset.json';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { RotateCcw, Settings2 } from 'lucide-react';

interface Shirt3DPreviewProps {
  frontImage: string;
  backImage: string;
  fabricColor?: string;
  autoRotate?: boolean;
}

interface ProjectionAdjust {
  scaleX: number;
  scaleY: number;
  offsetX: number;
  offsetY: number;
}

const DEFAULT_ADJUST: ProjectionAdjust = {
  scaleX: 1.15,
  scaleY: 1.05,
  offsetX: 0,
  offsetY: 0,
};

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

type ProjUniforms = {
  uProjCenter: { value: THREE.Vector2 };
  uProjSize: { value: THREE.Vector2 };
};

function ShirtModel({
  frontImage,
  backImage,
  fabricColor,
  adjust,
}: {
  frontImage: string;
  backImage: string;
  fabricColor: string;
  adjust: ProjectionAdjust;
}) {
  const gltf = useLoader(GLTFLoader, shirtModel.url, (loader) => {
    (loader as GLTFLoader).setMeshoptDecoder(MeshoptDecoder);
  });

  const frontTex = useImageTexture(frontImage);
  const backTex = useImageTexture(backImage);

  const scene = useMemo(() => gltf.scene.clone(true), [gltf]);

  const { center, size } = useMemo(() => {
    const box = new THREE.Box3().setFromObject(scene);
    const c = new THREE.Vector3();
    const s = new THREE.Vector3();
    box.getCenter(c);
    box.getSize(s);
    return { center: c, size: s };
  }, [scene]);

  const uniformsListRef = useRef<ProjUniforms[]>([]);

  // Build materials once per scene/texture/color change.
  useEffect(() => {
    uniformsListRef.current = [];
    const color = new THREE.Color(fabricColor);

    scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!(mesh as any).isMesh) return;
      const mat = new THREE.MeshStandardMaterial({
        color,
        roughness: 0.88,
        metalness: 0.02,
      });
      mat.onBeforeCompile = (shader) => {
        const u: ProjUniforms = {
          uProjCenter: { value: new THREE.Vector2(center.x, center.y) },
          uProjSize: { value: new THREE.Vector2(size.x * 1.15, size.y * 1.05) },
        };
        shader.uniforms.uFrontTex = { value: frontTex };
        shader.uniforms.uBackTex = { value: backTex };
        shader.uniforms.uProjCenter = u.uProjCenter;
        shader.uniforms.uProjSize = u.uProjSize;
        uniformsListRef.current.push(u);

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

  // Cheap live updates: just patch existing uniforms when sliders move.
  useEffect(() => {
    const projW = size.x * adjust.scaleX;
    const projH = size.y * adjust.scaleY;
    const cx = center.x + size.x * adjust.offsetX;
    const cy = center.y + size.y * adjust.offsetY;
    for (const u of uniformsListRef.current) {
      u.uProjCenter.value.set(cx, cy);
      u.uProjSize.value.set(projW, projH);
    }
  }, [adjust, center, size]);

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
  const [adjust, setAdjust] = useState<ProjectionAdjust>(() => {
    try {
      const raw = localStorage.getItem('shirt3d.adjust');
      if (raw) return { ...DEFAULT_ADJUST, ...JSON.parse(raw) };
    } catch {}
    return DEFAULT_ADJUST;
  });
  const [showPanel, setShowPanel] = useState(false);
  const [rotating, setRotating] = useState(autoRotate);

  useEffect(() => {
    try {
      localStorage.setItem('shirt3d.adjust', JSON.stringify(adjust));
    } catch {}
  }, [adjust]);

  const update = (k: keyof ProjectionAdjust, v: number) =>
    setAdjust((prev) => ({ ...prev, [k]: v }));

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
          <ShirtModel
            frontImage={frontImage}
            backImage={backImage}
            fabricColor={fabricColor}
            adjust={adjust}
          />
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

      {/* Toggle config panel */}
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
          onClick={() => setShowPanel((v) => !v)}
        >
          <Settings2 className="h-4 w-4" />
          Ajustar arte
        </Button>
      </div>

      {showPanel && (
        <div className="absolute bottom-2 left-2 right-2 bg-background/95 backdrop-blur border rounded-lg p-3 shadow-lg space-y-3 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-semibold">Ajuste da estampa no 3D</span>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 gap-1"
              onClick={() => setAdjust(DEFAULT_ADJUST)}
            >
              <RotateCcw className="h-3 w-3" />
              Resetar
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <SliderRow
              label="Largura"
              value={adjust.scaleX}
              min={0.4}
              max={2}
              step={0.01}
              onChange={(v) => update('scaleX', v)}
              format={(v) => `${Math.round(v * 100)}%`}
            />
            <SliderRow
              label="Altura"
              value={adjust.scaleY}
              min={0.4}
              max={2}
              step={0.01}
              onChange={(v) => update('scaleY', v)}
              format={(v) => `${Math.round(v * 100)}%`}
            />
            <SliderRow
              label="Posição X"
              value={adjust.offsetX}
              min={-0.5}
              max={0.5}
              step={0.005}
              onChange={(v) => update('offsetX', v)}
              format={(v) => `${(v * 100).toFixed(0)}%`}
            />
            <SliderRow
              label="Posição Y"
              value={adjust.offsetY}
              min={-0.5}
              max={0.5}
              step={0.005}
              onChange={(v) => update('offsetY', v)}
              format={(v) => `${(v * 100).toFixed(0)}%`}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function SliderRow({
  label,
  value,
  min,
  max,
  step,
  onChange,
  format,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  format: (v: number) => string;
}) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-muted-foreground">
        <span>{label}</span>
        <span className="tabular-nums">{format(value)}</span>
      </div>
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={(vs) => onChange(vs[0])}
      />
    </div>
  );
}
