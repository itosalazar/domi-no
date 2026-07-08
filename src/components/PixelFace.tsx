/**
 * Pixel smiley system — the app's icon language, derived from the modular
 * pixel-icon reference: chunky square modules, white + one grey step, on a
 * near-black chip. Faces live on a 12×12 grid.
 */

type Px = [number, number]

interface FaceDef {
  /** primary (white) pixels */
  main: Px[]
  /** secondary (grey) pixels — tears, horns, sweat */
  sub?: Px[]
}

const EYES: Px[] = [
  [2, 3], [3, 3], [2, 4], [3, 4],
  [8, 3], [9, 3], [8, 4], [9, 4],
]

const SMILE: Px[] = [[3, 7], [8, 7], [4, 8], [5, 8], [6, 8], [7, 8]]
const GRIN: Px[] = [[2, 7], [9, 7], [3, 8], [8, 8], [4, 9], [5, 9], [6, 9], [7, 9], [4, 8], [5, 8], [6, 8], [7, 8]]
const FROWN: Px[] = [[3, 9], [8, 9], [4, 8], [5, 8], [6, 8], [7, 8]]

export const FACES: Record<string, FaceDef> = {
  // dragging with plenty of options
  grin: { main: [...EYES, ...GRIN] },
  // two options
  smile: { main: [...EYES, ...SMILE] },
  // one option — not so sure
  unsure: {
    main: [[2, 4], [3, 4], [8, 4], [9, 4], [3, 8], [4, 8], [5, 8], [6, 8], [7, 8], [8, 8]],
    sub: [[10, 1], [10, 2]],
  },
  // forced draws, escalating
  mad: {
    main: [[2, 2], [3, 3], [9, 2], [8, 3], [2, 4], [3, 4], [8, 4], [9, 4], ...FROWN],
  },
  madder: {
    main: [
      [2, 2], [3, 3], [9, 2], [8, 3], [2, 4], [3, 4], [8, 4], [9, 4],
      [4, 7], [5, 7], [6, 7], [7, 7], [4, 8], [5, 8], [6, 8], [7, 8], [4, 9], [5, 9], [6, 9], [7, 9],
    ],
  },
  desperate: {
    main: [
      [3, 3], [2, 4], [3, 5], [8, 3], [9, 4], [8, 5],
      [5, 7], [6, 7], [4, 8], [5, 8], [6, 8], [7, 8], [5, 9], [6, 9],
    ],
    sub: [[1, 6], [10, 6]],
  },
  // opponent stuck drawing — mocking little devil
  devil: {
    main: [
      [2, 4], [3, 4], [8, 4], [9, 4],
      ...GRIN,
    ],
    sub: [[1, 0], [2, 1], [10, 0], [9, 1]],
  },
  // results
  win: {
    main: [
      [2, 3], [3, 3], [1, 4], [4, 4], [8, 3], [9, 3], [7, 4], [10, 4],
      ...GRIN,
    ],
  },
  cry: {
    main: [...EYES, ...FROWN],
    sub: [[2, 5], [2, 6], [9, 5], [9, 6]],
  },
  flat: { main: [...EYES, [4, 8], [5, 8], [6, 8], [7, 8]] },
}

export const FACE_NAMES = Object.keys(FACES)

interface PixelFaceProps {
  face: string
  /** primary pixel color (defaults to paper-white for use on an ink chip) */
  fg?: string
  sub?: string
  className?: string
}

export function PixelFace({ face, fg = '#F7F8F9', sub = '#8E9196', className = '' }: PixelFaceProps) {
  const def = FACES[face] ?? FACES.grin
  return (
    <svg viewBox="0 0 12 12" className={`pixelface ${className}`} aria-hidden>
      {def.main.map(([x, y], i) => (
        <rect key={`m${i}`} x={x + 0.06} y={y + 0.06} width={0.88} height={0.88} fill={fg} />
      ))}
      {def.sub?.map(([x, y], i) => (
        <rect key={`s${i}`} x={x + 0.06} y={y + 0.06} width={0.88} height={0.88} fill={sub} />
      ))}
    </svg>
  )
}
