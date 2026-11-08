const OFFSET = 8 * 60 * 60 * 1000
const DAY = 24 * 60 * 60 * 1000
const WEEKS = ['日', '一', '二', '三', '四', '五', '六']

function pad(n) {
  return n < 10 ? '0' + n : '' + n
}

function parts(ts) {
  const d = new Date(Number(ts) + OFFSET)
  return {
    y: d.getUTCFullYear(),
    m: d.getUTCMonth() + 1,
    d: d.getUTCDate(),
    hh: d.getUTCHours(),
    mm: d.getUTCMinutes(),
    week: d.getUTCDay()
  }
}

function dayKey(ts) {
  const p = parts(ts == null ? Date.now() : ts)
  return p.y + '-' + pad(p.m) + '-' + pad(p.d)
}

function timeKey(ts) {
  const p = parts(ts)
  return pad(p.hh) + ':' + pad(p.mm)
}

function toTs(day, time) {
  const bits = String(day || '').split('-').map(Number)
  const clock = String(time || '00:00').split(':').map(Number)
  return Date.UTC(bits[0], bits[1] - 1, bits[2], clock[0] - 8, clock[1] || 0, 0, 0)
}

function addDays(day, n) {
  return dayKey(toTs(day, '12:00') + n * DAY)
}

function diffDays(startDay, endDay) {
  return Math.round((toTs(endDay, '12:00') - toTs(startDay, '12:00')) / DAY) + 1
}

function dayNumber(birthday, today) {
  return diffDays(birthday, today)
}

function addMonths(day, months) {
  const bits = String(day).split('-').map(Number)
  const first = new Date(Date.UTC(bits[0], bits[1] - 1 + months, 1))
  const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate()
  const dd = Math.min(bits[2], last)
  return first.getUTCFullYear() + '-' + pad(first.getUTCMonth() + 1) + '-' + pad(dd)
}

function ageMonths(birthday, today) {
  const a = String(birthday).split('-').map(Number)
  const b = String(today).split('-').map(Number)
  let months = (b[0] - a[0]) * 12 + (b[1] - a[1])
  if (b[2] < a[2]) months -= 1
  return months < 0 ? 0 : months
}

function stageOf(birthday, today) {
  const day = dayNumber(birthday, today)
  const months = ageMonths(birthday, today)
  if (day <= 28) return 'newborn'
  if (months < 6) return 'infant'
  if (months < 12) return 'solid'
  if (months < 36) return 'toddler'
  return 'preschool'
}

function prettyDay(day) {
  const p = parts(toTs(day, '12:00'))
  return p.m + '月' + p.d + '日 周' + WEEKS[p.week]
}

function ageText(birthday, today) {
  const n = dayNumber(birthday, today)
  if (n <= 0) return '还没到出生日'
  if (n <= 28) return '第 ' + n + ' 天'
  const months = ageMonths(birthday, today)
  const anchor = addMonths(birthday, months)
  const extra = Math.max(0, dayNumber(anchor, today) - 1)
  if (!months) return '第 ' + n + ' 天'
  return months + '个月' + (extra ? extra + '天' : '')
}

function durationText(min) {
  const value = Math.round(Number(min) || 0)
  const h = Math.floor(value / 60)
  const m = value % 60
  if (h && m) return h + '小时' + m + '分'
  if (h) return h + '小时'
  return m + '分钟'
}

function weightText(g) {
  if (!g) return ''
  return g + ' 克，约 ' + (g / 500).toFixed(2) + ' 斤'
}

module.exports = {
  dayKey, timeKey, toTs, addDays, diffDays, dayNumber, addMonths, ageMonths,
  stageOf, prettyDay, ageText, durationText, weightText, parts
}
