const OFFSET = 8 * 60 * 60 * 1000
const DAY = 24 * 60 * 60 * 1000

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

function cnDateTime(ts) {
  const p = parts(ts)
  return p.y + '年' + p.m + '月' + p.d + '日 ' + pad(p.hh) + ':' + pad(p.mm)
}

function isDay(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))
}

function trimNum(n) {
  const x = Math.round(Number(n) * 100) / 100
  if (!isFinite(x)) return '0'
  return String(x)
}

module.exports = {
  DAY,
  pad,
  parts,
  dayKey,
  timeKey,
  toTs,
  addDays,
  diffDays,
  dayNumber,
  addMonths,
  ageMonths,
  stageOf,
  cnDateTime,
  isDay,
  trimNum
}
