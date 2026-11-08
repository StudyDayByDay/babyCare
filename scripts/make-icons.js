const fs = require('fs')
const https = require('https')
const path = require('path')
const { Resvg } = require('/tmp/resvg-tool/node_modules/@resvg/resvg-js')

const OUT = path.join(__dirname, '../miniprogram/images/icons')

const ICONS = [
  ['today', 'calendar_today', '#3E6B58'],
  ['record', 'edit_note', '#3E6B58'],
  ['stats', 'bar_chart', '#3E6B58'],
  ['mine', 'person', '#3E6B58'],
  ['feed', 'water_bottle', '#3D6E8C'],
  ['diaper', 'baby_changing_station', '#A56B2B'],
  ['sleep', 'bedtime', '#3E6B58'],
  ['care', 'clean_hands', '#C47A64'],
  ['temp', 'thermometer', '#8C4D62'],
  ['meal', 'rice_bowl', '#6A7040'],
  ['mile', 'star', '#3D5A73'],
  ['note', 'sticky_note_2', '#7A6248'],
  ['med', 'medication', '#B4533A'],
  ['growth', 'height', '#3E6B58'],
  ['vaccine', 'vaccines', '#3D6E8C'],
  ['family', 'family_restroom', '#3E6B58'],
  ['export', 'download', '#3E6B58'],
  ['baby', 'child_care', '#3E6B58'],
  ['stool', 'gastroenterology', '#A56B2B']
]

function fetchText(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(res.statusCode + ' ' + url))
        res.resume()
        return
      }
      const chunks = []
      res.on('data', (chunk) => chunks.push(chunk))
      res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    }).on('error', reject)
  })
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true })
  for (const [name, symbol, color] of ICONS) {
    const url = 'https://fonts.gstatic.com/s/i/short-term/release/materialsymbolsoutlined/' + symbol + '/default/48px.svg'
    const raw = await fetchText(url)
    const svg = raw.replace('<svg ', '<svg fill="' + color + '" ')
    const png = new Resvg(svg, {
      fitTo: { mode: 'width', value: 96 },
      background: 'rgba(0,0,0,0)'
    }).render().asPng()
    fs.writeFileSync(path.join(OUT, name + '.png'), png)
    console.log(name, symbol)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
