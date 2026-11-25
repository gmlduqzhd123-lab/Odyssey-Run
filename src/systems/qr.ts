import qrcode from 'qrcode-generator';
// QR codes for share links, drawn as SVG. Only the pages that show one load this (and the library).
export function qrSvg(text: string) {
  const qr = qrcode(0, 'L');
  qr.addData(text, 'Byte');
  qr.make();
  return qr.createSvgTag({cellSize: 4, margin: 2, scalable: true});
}
