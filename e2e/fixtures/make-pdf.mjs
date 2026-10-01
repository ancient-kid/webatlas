// Regenerates e2e/fixtures/site/doc.pdf: a one-page PDF with real text and a valid xref table.
// Run: node e2e/fixtures/make-pdf.mjs
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const text = [
  'Urban adaptation finance: a working paper',
  'Cities fund sea walls, drainage and water squares through bonds,',
  'national transfers and insurance pools. This fixture exists for tests.'
]
const stream =
  'BT /F1 14 Tf 72 720 Td 18 TL ' +
  text.map((line) => `(${line.replace(/[()\\]/g, '\\$&')}) Tj T*`).join(' ') +
  ' ET'

const objects = [
  '<< /Type /Catalog /Pages 2 0 R >>',
  '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
  '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
  `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
  '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  '<< /Title (Urban adaptation finance) >>'
]

let pdf = '%PDF-1.4\n'
const offsets = []
objects.forEach((body, i) => {
  offsets.push(Buffer.byteLength(pdf))
  pdf += `${i + 1} 0 obj\n${body}\nendobj\n`
})
const xref = Buffer.byteLength(pdf)
pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
pdf += offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')
pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R /Info 6 0 R >>\nstartxref\n${xref}\n%%EOF\n`

writeFileSync(fileURLToPath(new URL('./site/doc.pdf', import.meta.url)), pdf, 'latin1')
console.log('wrote doc.pdf', Buffer.byteLength(pdf), 'bytes')
