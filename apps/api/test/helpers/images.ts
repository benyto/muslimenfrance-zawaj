import sharp from "sharp";

const solid = (width: number, height: number) =>
  sharp({ create: { width, height, channels: 3, background: { r: 90, g: 120, b: 200 } } });

export const jpeg = (width = 200, height = 300) => solid(width, height).jpeg().toBuffer();
export const largeJpeg = () => solid(3000, 2000).jpeg({ quality: 95 }).toBuffer();

/** A phone-style photo: landscape pixels tagged "rotate 90°", plus camera and GPS EXIF. */
export const exifJpeg = () =>
  solid(1200, 800)
    .jpeg()
    .withMetadata({
      orientation: 6,
      exif: {
        IFD0: { Copyright: "test", Make: "TestCamera" },
        IFD3: { GPSLatitudeRef: "N", GPSLatitude: "48/1 51/1 24/1", GPSLongitudeRef: "E", GPSLongitude: "2/1 21/1 8/1" },
      },
    })
    .toBuffer();

export const svg = () =>
  Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10"/></svg>');
