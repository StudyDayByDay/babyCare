const fs = require('fs')
const https = require('https')
const path = require('path')
const { Resvg } = require('/tmp/resvg-tool/node_modules/@resvg/resvg-js')

const OUT = path.join(__dirname, '../miniprogram/images/icons')

const ICONS = [
  // tab bar: inactive / active
  ['today', 'calendar_today', '#6F6368'],
  ['today-on', 'calendar_today', '#B06A75'],
  ['record', 'edit_note', '#6F6368'],
  ['record-on', 'edit_note', '#B06A75'],
  ['stats', 'bar_chart', '#6F6368'],
  ['stats-on', 'bar_chart', '#B06A75'],
  ['mine', 'person', '#6F6368'],
  ['mine-on', 'person', '#B06A75'],
  // record categories
  ['feed', 'water_bottle', '#3E6E85'],
  ['diaper', 'baby_changing_station', '#94652F'],
  ['sleep', 'bedtime', '#6E5A7E'],
  ['care', 'clean_hands', '#B05E46'],
  ['temp', 'thermometer', '#9A4E63'],
  ['jaundice', 'water_drop', '#A97820'],
  ['meal', 'rice_bowl', '#6B743F'],
  ['mile', 'star', '#A47C22'],
  ['note', 'sticky_note_2', '#7A6248'],
  ['med', 'medication', '#8F5F12'],
  // secondary pages
  ['growth', 'height', '#3F5F44'],
  ['vaccine', 'vaccines', '#416D86'],
  ['family', 'family_restroom', '#7A5C83'],
  ['export', 'download', '#6B625B'],
  ['baby', 'child_care', '#8C4553'],
  ['stool', 'gastroenterology', '#94652F']
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
      fitTo: { mode: 'width', value: 128 },
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
