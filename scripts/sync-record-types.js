const fs = require('fs')
const path = require('path')

const root = path.join(__dirname, '..')
const source = path.join(root, 'shared/recordTypes.js')
const targets = [
  path.join(root, 'miniprogram/utils/recordTypes.js'),
  path.join(root, 'cloudfunctions/babyApi/lib/recordTypes.js')
]

const text = fs.readFileSync(source)
targets.forEach((target) => {
  fs.writeFileSync(target, text)
  console.log('synced', path.relative(root, target))
})
