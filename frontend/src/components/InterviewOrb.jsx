import React, {useEffect, useRef} from 'react';

const pointCount = 560;
const turn = Math.PI * (3 - Math.sqrt(5));
const points = Array.from({length: pointCount}, (_, index) => {
  const y = 1 - 2 * (index + .5) / pointCount;
  const radius = Math.sqrt(1 - y * y);
  const angle = index * turn;
  return {x: Math.cos(angle) * radius, y, z: Math.sin(angle) * radius, hue: index % 4};
});

export default function InterviewOrb({speaking}) {
  const canvas = useRef(null);
  const rotation = useRef(.27);

  useEffect(() => {
    const node = canvas.current;
    const context = node.getContext('2d');
    if (!context) return;
    const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0;
    let size = 0;
    let startedAt = 0;
    let lastTime = 0;

    function draw(pulse) {
      const center = size / 2;
      context.clearRect(0, 0, size, size);
      const sine = Math.sin(rotation.current);
      const cosine = Math.cos(rotation.current);
      const particles = points.map(point => {
        const x = point.x * cosine - point.z * sine;
        const z = point.x * sine + point.z * cosine;
        const y = point.y * .97 - z * .24;
        const depth = point.y * .24 + z * .97;
        return {x, y, depth, hue: point.hue};
      }).sort((a, b) => a.depth - b.depth);

      for (const {x, y, depth, hue} of particles) {
        const near = (depth + 1) / 2;
        const perspective = 2.9 / (3.22 - depth * .54);
        const distance = center * .73 * perspective * (1 + pulse * .20);
        const radius = size * (.0017 + .0035 * near) * (1 + pulse * .16);
        const lightness = 43 + 33 * near + pulse * 5;
        context.fillStyle = `hsla(${hue === 0 ? 194 : 216 + hue * 5}, 86%, ${lightness}%, ${.21 + near * .73})`;
        context.beginPath();
        context.arc(center + x * distance, center + y * distance, radius, 0, 2 * Math.PI);
        context.fill();
      }
    }

    function animate(time) {
      startedAt ||= time;
      const elapsed = (time - startedAt) / 1000;
      const delta = lastTime ? Math.min(40, time - lastTime) : 0;
      lastTime = time;
      rotation.current += delta * .00046;
      draw(Math.min(1, elapsed * 4) * (.54 + .34 * Math.sin(elapsed * 8) + .12 * Math.sin(elapsed * 13)));
      frame = requestAnimationFrame(animate);
    }

    function updateMotion() {
      cancelAnimationFrame(frame);
      lastTime = 0;
      startedAt = 0;
      if (speaking && !reduceMotion.matches) frame = requestAnimationFrame(animate);
      else draw(0);
    }

    const resize = () => {
      size = node.clientWidth;
      const ratio = Math.min(2, window.devicePixelRatio || 1);
      node.width = Math.round(size * ratio);
      node.height = node.width;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      draw(0);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(node);
    reduceMotion.addEventListener('change', updateMotion);
    resize();
    updateMotion();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      reduceMotion.removeEventListener('change', updateMotion);
    };
  }, [speaking]);

  return <canvas ref={canvas} className="practice-orb" data-state={speaking ? 'speaking' : 'idle'} aria-hidden="true"/>;
}
