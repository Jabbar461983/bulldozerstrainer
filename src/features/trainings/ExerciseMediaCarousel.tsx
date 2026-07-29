import { useState } from 'react';
import type { TouchEvent } from 'react';
import clsx from 'clsx';
import type { ExerciseMediaView } from '../exercises/api';

interface ExerciseMediaCarouselProps {
  media: ExerciseMediaView[];
}

export function ExerciseMediaCarousel({ media }: ExerciseMediaCarouselProps) {
  const [index, setIndex] = useState(0);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const current = media[Math.min(index, media.length - 1)];

  function handleTouchStart(e: TouchEvent<HTMLDivElement>) {
    e.stopPropagation();
    setTouchStartX(e.touches[0].clientX);
  }

  function handleTouchEnd(e: TouchEvent<HTMLDivElement>) {
    e.stopPropagation();
    if (touchStartX === null) return;
    const deltaX = e.changedTouches[0].clientX - touchStartX;
    if (Math.abs(deltaX) > 40) {
      if (deltaX < 0) setIndex((i) => Math.min(media.length - 1, i + 1));
      else setIndex((i) => Math.max(0, i - 1));
    }
    setTouchStartX(null);
  }

  if (!current) return null;

  return (
    <div className="flex flex-col gap-2" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
      <div className="overflow-hidden rounded-xl border border-border bg-surface-alt">
        {current.type === 'image' ? (
          <img src={current.url ?? ''} alt="" className="max-h-80 w-full object-contain" />
        ) : (
          <video src={current.url ?? ''} controls className="max-h-80 w-full" />
        )}
      </div>
      {media.length > 1 && (
        <div className="flex justify-center gap-1.5">
          {media.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIndex(i);
              }}
              aria-label={`Bild ${i + 1}`}
              className={clsx('size-2 rounded-full', i === index ? 'bg-accent' : 'bg-border')}
            />
          ))}
        </div>
      )}
    </div>
  );
}
