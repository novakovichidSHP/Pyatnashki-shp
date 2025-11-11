const BACKGROUND_FILES = [
  "cars.png",
  "cup.png",
  "ferris wheel.jpg",
  "gear.png",
  "queue.png",
  "roller.jpg",
  "roller_right.png",
];

function formatLabel(filename) {
  const withoutExtension = filename.replace(/\.[^.]+$/, "");
  const cleaned = withoutExtension.replace(/[_-]+/g, " ");
  return cleaned
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export const TILE_BACKGROUNDS = BACKGROUND_FILES.map((file) => ({
  id: file,
  label: formatLabel(file),
}));

export function normalizeTileBackground(value) {
  if (typeof value !== "string") {
    return "";
  }
  return BACKGROUND_FILES.includes(value) ? value : "";
}

export function sanitizeTileBackgrounds(values, expectedLength) {
  if (!Array.isArray(values) || values.length !== expectedLength) {
    return Array.from({ length: expectedLength }, () => "");
  }
  return values.map((value) => normalizeTileBackground(value));
}

export function hasTileBackgrounds(values) {
  return Array.isArray(values) && values.some((value) => Boolean(value));
}
