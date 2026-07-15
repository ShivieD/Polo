/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

/*
 * The quiet 3D moment, not a 3D theme: four primary toy blocks drifting
 * in slow motion over the home header, dropping soft shadows on the
 * white canvas. Subtle enough to ignore; there when the eye wanders.
 */

const REDUCED =
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

interface BlockProps {
  color: string;
  position: [number, number, number];
  speed: number;
  offset: number;
  size: number;
}

const Block: React.FC<BlockProps> = ({ color, position, speed, offset, size }) => {
  const ref = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (!ref.current || REDUCED) return;
    const t = clock.getElapsedTime() * speed + offset;
    ref.current.rotation.x = t * 0.45;
    ref.current.rotation.y = t * 0.6;
    ref.current.position.y = position[1] + Math.sin(t) * 0.16;
  });

  return (
    <mesh ref={ref} position={position} rotation={[offset, offset * 1.3, 0]} castShadow>
      <boxGeometry args={[size, size, size]} />
      <meshStandardMaterial color={color} roughness={0.4} metalness={0} />
    </mesh>
  );
};

/* Color mode drifts the four playable primaries; Shapes mode swaps them
   for a charcoal family so the header stays true to the greyscale world. */
const PRIMARY = ["#ff4b3e", "#ffc400", "#2d6cf6", "#1fbf66"];
const CHARCOAL = ["#26262e", "#3a3a44", "#4e4e5a", "#1b1b21"];

export const AmbientBlocks: React.FC<{ charcoal?: boolean }> = ({ charcoal = false }) => {
  const colors = charcoal ? CHARCOAL : PRIMARY;
  return (
    <div className="hidden md:block absolute inset-y-0 right-0 w-1/2 pointer-events-none" aria-hidden="true">
      <Canvas
        shadows
        dpr={[1, 1.5]}
        camera={{ position: [0, 1.1, 5.2], fov: 34 }}
        gl={{ antialias: true, alpha: true }}
        style={{ background: "transparent" }}
      >
        <ambientLight intensity={1.15} />
        <directionalLight
          position={[3.5, 6, 4]}
          intensity={1.6}
          castShadow
          shadow-mapSize={[1024, 1024]}
          shadow-camera-left={-6}
          shadow-camera-right={6}
          shadow-camera-top={6}
          shadow-camera-bottom={-6}
        />
        <Block color={colors[0]} position={[-2.1, 0.45, -0.4]} speed={0.22} offset={0.8} size={0.72} />
        <Block color={colors[1]} position={[-0.7, 0.9, -1.2]} speed={0.27} offset={2.1} size={0.56} />
        <Block color={colors[2]} position={[0.9, 0.35, -0.6]} speed={0.19} offset={4.2} size={0.8} />
        <Block color={colors[3]} position={[2.3, 0.85, -1.4]} speed={0.25} offset={5.6} size={0.5} />
        {/* Soft catch-plane for the shadows on the canvas */}
        <mesh rotation-x={-Math.PI / 2} position={[0, -0.9, 0]} receiveShadow>
          <planeGeometry args={[24, 24]} />
          <shadowMaterial opacity={0.07} />
        </mesh>
      </Canvas>
    </div>
  );
};

export default AmbientBlocks;
