import type { Area } from "react-easy-crop";

const MAX_OUTPUT_WIDTH = 1920;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener("load", () => resolve(image));
    image.addEventListener("error", reject);
    image.crossOrigin = "anonymous";
    image.src = src;
  });
}

export async function cropCoverImage(
  imageSrc: string,
  pixelCrop: Area,
  mimeType: "image/jpeg" | "image/webp" = "image/jpeg",
): Promise<Blob> {
  const image = await loadImage(imageSrc);
  let outputWidth = pixelCrop.width;
  let outputHeight = pixelCrop.height;

  if (outputWidth > MAX_OUTPUT_WIDTH) {
    outputHeight = Math.round((outputHeight * MAX_OUTPUT_WIDTH) / outputWidth);
    outputWidth = MAX_OUTPUT_WIDTH;
  }

  const canvas = document.createElement("canvas");
  canvas.width = outputWidth;
  canvas.height = outputHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not create canvas context.");

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    outputWidth,
    outputHeight,
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Could not export cropped image."));
      },
      mimeType,
      0.9,
    );
  });
}
