import { cn } from '@/lib/utils';

const GRID_SIZE = 3;
const GRID_INDEX_HALVES = 2;
const GRID_INSET = 1.5;
const DESK_PITCH = 7.5;
const DESK_SIZE = 6;
const DESK_RADIUS = 1.25;
const DESK_STROKE = 1.5;
const EMPTY_DESK_OPACITY = 0.45;
const YOUR_SEAT_COLOR = 'var(--color-primary)';
const LAST_INDEX = GRID_SIZE - 1;
const MIDDLE_INDEX = Math.floor(GRID_SIZE / GRID_INDEX_HALVES);
/** Right column, middle row: the one desk that is yours. */
const YOUR_SEAT = { col: LAST_INDEX, row: MIDDLE_INDEX } as const;

type Desk = { readonly col: number; readonly row: number; readonly isYourSeat: boolean };

const GRID_INDICES: readonly number[] = Array.from({ length: GRID_SIZE }, (_, index) => index);

const DESKS: readonly Desk[] = GRID_INDICES.flatMap((row) =>
  GRID_INDICES.map((col) => ({
    col,
    row,
    isYourSeat: col === YOUR_SEAT.col && row === YOUR_SEAT.row,
  })),
);

/**
 * MECSeater mark: a 3×3 block of exam-hall desks with one desk filled in.
 * The filled desk, in pen blue, is "your seat". Drawn on a 24-unit grid so it stays crisp at 16px.
 */
export function LogoMark({ className }: { readonly className?: string }): React.JSX.Element {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={cn('h-6 w-6', className)}>
      {DESKS.map((desk) => (
        <rect
          key={`${desk.col}-${desk.row}`}
          x={GRID_INSET + desk.col * DESK_PITCH}
          y={GRID_INSET + desk.row * DESK_PITCH}
          width={DESK_SIZE}
          height={DESK_SIZE}
          rx={DESK_RADIUS}
          fill={desk.isYourSeat ? YOUR_SEAT_COLOR : 'none'}
          stroke={desk.isYourSeat ? YOUR_SEAT_COLOR : 'currentColor'}
          strokeOpacity={desk.isYourSeat ? 1 : EMPTY_DESK_OPACITY}
          strokeWidth={DESK_STROKE}
        />
      ))}
    </svg>
  );
}

export function Logo({ className }: { readonly className?: string }): React.JSX.Element {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <LogoMark className="h-[22px] w-[22px]" />
      <span className="font-semicondensed text-[17px] font-bold tracking-tight">MECSeater</span>
    </span>
  );
}
