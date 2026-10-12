import { cn } from "@/lib/utils";

/**
 * Tiny pixel-art sprites drawn as crisp SVG rects. Each sprite is a list of
 * rows where every character maps to a colour in PALETTE ("." is empty).
 */
const PALETTE: Record<string, string> = {
  K: "#15114a", // outline navy
  R: "#e8242a", // red
  r: "#a00a10", // dark red
  Y: "#ffcc11", // gold
  y: "#cc8400", // dark gold
  G: "#22bb22", // green
  g: "#0b7a0b", // dark green
  B: "#3344ee", // blue
  b: "#7a4a1e", // bark brown
  W: "#ffffff", // white
  w: "#c9c4e2", // snow shadow
  C: "#33dddd", // cyan
  O: "#ff7711", // orange
  M: "#e02ad6", // magenta
  s: "#ffcc99", // skin
};

export const SPRITES = {
  gift: [
    "....YY..YY..",
    "...Y..YY..Y.",
    "....YYYYYY..",
    "KKKKKKKKKKKK",
    "KRRRRYYRRRRK",
    "KRRRRYYRRRRK",
    "KKKKKKKKKKKK",
    ".KrRRYYRRrK.",
    ".KrRRYYRRrK.",
    ".KrRRYYRRrK.",
    ".KrRRYYRRrK.",
    ".KKKKKKKKKK.",
  ],
  treasure: [
    "....RR..RR..",
    "...R..RR..R.",
    "....RRRRRR..",
    "KKKKKKKKKKKK",
    "KGGGGRRGGGGK",
    "KGGGGRRGGGGK",
    "KKKKKKKKKKKK",
    ".KgGGRRGGgK.",
    ".KgGGRRGGgK.",
    ".KgGGRRGGgK.",
    ".KgGGRRGGgK.",
    ".KKKKKKKKKK.",
  ],
  tree: [
    "......Y......",
    ".....YYY.....",
    "......Y......",
    ".....GGG.....",
    "....GGRGG....",
    "...GGGGGgG...",
    "....GBGGG....",
    "...GGGGGYG...",
    "..GGRGGGGgG..",
    "...GGGYGGG...",
    "..GBGGGGRGG..",
    ".GGGRGGGGBgG.",
    "GGgGGGYGGGGgG",
    ".....bbb.....",
    ".....bbb.....",
  ],
  stocking: [
    "WWWWWW..",
    "WwWwWW..",
    ".RRRR...",
    ".RRRR...",
    ".RYRR...",
    ".RRRR...",
    ".RRRRR..",
    ".RRRRRRR",
    ".RRRRRRr",
    "..rRRRr.",
  ],
  star: [
    "...Y...",
    "...Y...",
    "YYYYYYY",
    ".YYyYY.",
    "..YYY..",
    ".YY.YY.",
    "YY...YY",
  ],
  snowflake: [
    "...W...",
    ".W.W.W.",
    "..WWW..",
    "WWWWWWW",
    "..WWW..",
    ".W.W.W.",
    "...W...",
  ],
  candle: [
    "..O..",
    "..Y..",
    ".RRR.",
    ".RWR.",
    ".RRR.",
    ".RRR.",
    ".RRr.",
    "GGgGG",
  ],
  heart: [
    ".RR.RR.",
    "RWRRRRR",
    "RRRRRRR",
    ".RRRRr.",
    "..RRr..",
    "...r...",
  ],
  robot: [
    "....Y....",
    "....K....",
    ".KKKKKKK.",
    ".KCCCCCK.",
    ".KCWCWCK.",
    ".KCCCCCK.",
    ".KCKKKCK.",
    ".KKKKKKK.",
    "..K...K..",
  ],
  calendar: [
    ".K.....K.",
    "KKKKKKKKK",
    "KRRRRRRRK",
    "KWWWWWWWK",
    "KWKWKWKWK",
    "KWWWWWWWK",
    "KWKWKWRWK",
    "KWWWWWWWK",
    "KKKKKKKKK",
  ],
  people: [
    "..ss....ss..",
    ".ssss..ssss.",
    ".ssss..ssss.",
    "..ss....ss..",
    ".BBBB..MMMM.",
    "BBBBBBMMMMMM",
    "BBBBBBMMMMMM",
    "BBBBBBMMMMMM",
  ],
  snowman: [
    "...KKK...",
    "...KKK...",
    "..KKKKK..",
    "...WWW...",
    "..WKWKW..",
    "..WWOOW..",
    "...WWw...",
    "..RRRRR..",
    ".WWWWWWw.",
    "WWWWKWWww",
    "WWWWWWWww",
    "WWWWKWWww",
    ".WWWWWww.",
  ],
  bag: [
    "...KKK...",
    "....Y....",
    "...RRR...",
    "..RRRRR..",
    ".RRRYRRR.",
    "RRRYRRRRR",
    "RRRRYRRRR",
    "RRRRRYRRR",
    "RRRYYRRRr",
    ".RRRRRRr.",
  ],
  fire: [
    ".....Y......",
    "....YO..Y...",
    "..Y.OOY.OY..",
    "..OYORYOOY..",
    ".OORRYROROO.",
    ".ORRYRRYRRO.",
    "bbbbbbbbbbbb",
    ".bb.bbbb.bb.",
  ],
  reindeer: [
    "...........b.b..",
    "............bb..",
    "...........bbbb.",
    "...........bbKbR",
    "..bbbbbbbbbbbb..",
    ".bbbbbbbbbbbb...",
    "bb.bWbbbbbbb....",
    "...b.b....b.b...",
    "..b...b..b...b..",
  ],
  sleigh: [
    ".....RRR..........",
    "....RRRRW.........",
    "....WsssW..GGG....",
    "....WWWWW.GGGGG...",
    "..RRRRRRRRRGGGG...",
    "YRRRRRRRRRRRRRRRR.",
    ".RRRRRYRRRRYRRRRR.",
    "..RRRRRRRRRRRRRR..",
    "...Y..........Y...",
    "..YYYYYYYYYYYYYYYY",
  ],
  cursor: [
    "K.....",
    "KK....",
    "KWK...",
    "KWWK..",
    "KWWWK.",
    "KWWWWK",
    "KWWKKK",
    "KKWK..",
    "...KK.",
  ],
} as const;

export type SpriteName = keyof typeof SPRITES;

interface PixelSpriteProps {
  name: SpriteName;
  /** Size of one pixel in CSS px. */
  scale?: number;
  className?: string;
  title?: string;
}

export function PixelSprite({ name, scale = 4, className, title }: PixelSpriteProps) {
  const rows = SPRITES[name];
  const width = rows[0].length;
  const height = rows.length;

  // Merge horizontal runs of the same colour to keep the DOM small.
  const rects: { x: number; y: number; w: number; fill: string }[] = [];
  rows.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const ch = row[x];
      let end = x + 1;
      while (end < row.length && row[end] === ch) end++;
      if (ch !== "." && PALETTE[ch]) rects.push({ x, y, w: end - x, fill: PALETTE[ch] });
      x = end;
    }
  });

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width * scale}
      height={height * scale}
      shapeRendering="crispEdges"
      className={cn("inline-block shrink-0", className)}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
    >
      {title && <title>{title}</title>}
      {rects.map((r, i) => (
        <rect key={i} x={r.x} y={r.y} width={r.w} height={1} fill={r.fill} />
      ))}
    </svg>
  );
}
