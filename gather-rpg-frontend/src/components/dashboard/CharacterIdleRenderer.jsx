import { useEffect, useRef, useState } from 'react';
import { animationsByCharacter } from '../../../public/characters/_animationsByCharacter_generated.js';

export const CharacterIdleRenderer = ({ characterId = '1', scale = 2.5, className = '' }) => {
  const canvasRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    let animationFrameId = null;
    let lastTime = 0;
    let currentFrameIndex = 0;

    const charConfig = animationsByCharacter[characterId];
    if (!charConfig || !charConfig.idle) {
      setError(`No idle animation config found for character ID ${characterId}`);
      setLoading(false);
      return;
    }

    const { frames: animationFrames, frameRate } = charConfig.idle;
    const interval = 1000 / frameRate;

    // Load sprite sheet and JSON atlas
    const imageUrl = `/characters/${characterId}a.png`;
    const jsonUrl = `/characters/${characterId}a.json`;

    setLoading(true);
    setError(null);

    Promise.all([
      fetch(jsonUrl).then(res => {
        if (!res.ok) throw new Error('Failed to load character atlas JSON');
        return res.json();
      }),
      new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('Failed to load character spritesheet image'));
        img.src = imageUrl;
      })
    ])
      .then(([json, image]) => {
        if (!active) return;
        setLoading(false);

        // Find frame configurations
        const framesData = animationFrames
          .map(frameName => json.frames.find(f => f.filename === frameName))
          .filter(Boolean);

        if (framesData.length === 0) {
          throw new Error('No valid frames found in the atlas for idle animation');
        }

        // Calculate bounding box and offsets to prevent clipping and jitter
        const minX = Math.min(0, ...framesData.map(f => f.spriteSourceSize?.x || 0));
        const minY = Math.min(0, ...framesData.map(f => f.spriteSourceSize?.y || 0));

        const virtualW = Math.max(...framesData.map(f => (f.spriteSourceSize?.x || 0) + f.frame.w)) - minX;
        const virtualH = Math.max(...framesData.map(f => (f.spriteSourceSize?.y || 0) + f.frame.h)) - minY;

        const canvas = canvasRef.current;
        if (!canvas) return;

        // Set canvas size based on bounding box and scale
        canvas.width = virtualW * scale;
        canvas.height = virtualH * scale;

        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;

        const render = (time) => {
          if (!active) return;

          if (time - lastTime >= interval) {
            lastTime = time;
            currentFrameIndex = (currentFrameIndex + 1) % framesData.length;

            const frameObj = framesData[currentFrameIndex];
            const { x, y, w, h } = frameObj.frame;
            
            // Apply scale and offsets to align frames properly
            const xOffset = (frameObj.spriteSourceSize?.x || 0) - minX;
            const yOffset = (frameObj.spriteSourceSize?.y || 0) - minY;

            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(
              image,
              x, y, w, h,
              xOffset * scale,
              yOffset * scale,
              w * scale,
              h * scale
            );
          }

          animationFrameId = requestAnimationFrame(render);
        };

        lastTime = performance.now();
        animationFrameId = requestAnimationFrame(render);
      })
      .catch(err => {
        if (!active) return;
        console.error(err);
        setError(err.message);
        setLoading(false);
      });

    return () => {
      active = false;
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [characterId, scale]);

  return (
    <div className={`flex flex-col items-center justify-center relative select-none ${className}`}>
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900/50 rounded-lg">
          <div className="w-10 h-10 border-4 border-yellow-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      )}
      {error ? (
        <div className="text-red-500 text-xs text-center p-4">
          <p>⚠️ Error rendering character</p>
          <p className="opacity-75 mt-1">{error}</p>
        </div>
      ) : (
        <canvas ref={canvasRef} className="pixelated drop-shadow-[0_10px_15px_rgba(0,0,0,0.6)]" />
      )}
    </div>
  );
};
