/**
 * Render a DOM element to a multi-page A4 PDF and download it.
 *
 * The previous implementation drew the whole element as one image on one
 * page, so anything past ~A4 height was clipped off the bottom of long
 * quotations. Here the canvas is sliced into A4-sized pages.
 */
export async function downloadElementAsPdf(element: HTMLElement, filename: string): Promise<void> {
  const [{ jsPDF }, html2canvas] = await Promise.all([
    import("jspdf"),
    import("html2canvas-pro").then(m => m.default),
  ])

  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    logging: false,
    backgroundColor: "#ffffff",
  })

  // compress: jsPDF stores page images uncompressed by default (~10 MB per A4 page).
  const pdf = new jsPDF({ orientation: "p", unit: "mm", format: "a4", compress: true })
  const pageWidthMm = pdf.internal.pageSize.getWidth()
  const pageHeightMm = pdf.internal.pageSize.getHeight()

  // How many canvas pixels fit on one A4 page at this width.
  const pagePx = Math.floor((canvas.width * pageHeightMm) / pageWidthMm)

  let offset = 0
  let first = true
  while (offset < canvas.height) {
    const sliceHeight = Math.min(pagePx, canvas.height - offset)
    const slice = document.createElement("canvas")
    slice.width = canvas.width
    slice.height = sliceHeight
    const ctx = slice.getContext("2d")
    if (!ctx) throw new Error("Could not create a PDF page")
    ctx.fillStyle = "#ffffff"
    ctx.fillRect(0, 0, slice.width, slice.height)
    ctx.drawImage(canvas, 0, offset, canvas.width, sliceHeight, 0, 0, canvas.width, sliceHeight)

    if (!first) pdf.addPage()
    pdf.addImage(
      slice.toDataURL("image/png"),
      "PNG",
      0,
      0,
      pageWidthMm,
      (sliceHeight * pageWidthMm) / canvas.width,
      undefined,
      "FAST",
    )

    first = false
    offset += sliceHeight
  }

  pdf.save(filename)
}

export function pdfFileName(refNo: string): string {
  return `Megatech_${refNo.replace(/[\\/:*?"<>|\s]+/g, "-")}.pdf`
}
