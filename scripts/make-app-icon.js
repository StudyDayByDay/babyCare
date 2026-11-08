const fs = require('fs')
const path = require('path')
const { Resvg } = require('/tmp/resvg-tool/node_modules/@resvg/resvg-js')

const svgPath = path.join(__dirname, '../design/app-icon.svg')
const outDir = path.join(__dirname, '../design')
const svg = fs.readFileSync(svgPath, 'utf8')

const sizes = [1024, 512, 256, 144]
sizes.forEach((size) => {
  const png = new Resvg(svg, {
    fitTo: { mode: 'width', value: size },
    background: 'rgba(0,0,0,0)'
  }).render().asPng()
  const out = path.join(outDir, 'app-icon-' + size + '.png')
  fs.writeFileSync(out, png)
  console.log(out)
})
