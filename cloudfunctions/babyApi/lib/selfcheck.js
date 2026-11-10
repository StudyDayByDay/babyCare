const { dayKey, toTs, addDays, diffDays, dayNumber, addMonths, stageOf } = require('./date')
const { planDoses } = require('./medPlan')
const { resolveSleep, sanitizePayload } = require('./records')
const { workbook } = require('./zip')
const { dueDays } = require('./vaccines')
const { exportRows } = require('./export')

function assert(cond, message) {
  if (!cond) throw new Error(message)
}

const birthday = '2026-11-01'
assert(dayKey(toTs('2026-11-08', '00:00')) === '2026-11-08', 'dayKey 北京时间零点')
assert(dayNumber(birthday, birthday) === 1, '出生日是第 1 天')
assert(dayNumber(birthday, '2026-11-08') === 8, '第 8 天')
assert(addMonths('2026-01-31', 1) === '2026-02-28', '月末加一个月')
assert(addDays('2026-11-08', 2) === '2026-11-10', '加两天')
assert(diffDays('2026-11-08', '2026-11-10') === 3, '含首尾三天')
assert(stageOf(birthday, '2026-11-10') === 'newborn', '新生儿阶段')
assert(stageOf(birthday, '2026-12-20') === 'infant', '满月后')
assert(stageOf('2024-01-01', '2026-11-08') === 'toddler', '幼儿')

const doses = planDoses({
  frequencyType: 'timesPerDay',
  doseAmount: 2,
  doseUnit: '颗',
  timesPerDay: 3,
  startDay: '2026-11-08',
  endDay: '2026-11-09',
  slots: [
    { time: '08:00', doseAmount: 2, doseUnit: '颗' },
    { time: '14:00', doseAmount: 2, doseUnit: '颗' },
    { time: '20:00', doseAmount: 1, doseUnit: '颗' }
  ]
})
assert(doses.length === 6, '两天三次应有 6 顿')
assert(doses[2].doseAmount === 1 && doses[2].slotTime === '20:00', '晚上单独 1 颗')
assert(doses[0].day === '2026-11-08', '第一顿日期')

const interval = planDoses({
  frequencyType: 'intervalHours',
  doseAmount: 2.5,
  doseUnit: '毫升',
  intervalHours: 8,
  startDay: '2026-11-08',
  endDay: '2026-11-08',
  slots: [{ time: '08:00' }]
})
assert(interval.length === 2, '一天内每 8 小时从 8 点起有两顿')
assert(interval[1].slotTime === '16:00', '第二顿 16 点')
assert(planDoses({ frequencyType: 'asNeeded', doseAmount: 1, doseUnit: '片', startDay: '2026-11-08', endDay: '2026-11-08' }).length === 0, '按需不预排')

const sleep = resolveSleep(toTs('2026-11-08', '20:00'), toTs('2026-11-08', '07:00'))
assert(sleep.durationMin === 11 * 60, '结束早于开始按第二天')
const feed = sanitizePayload('feed', { leftMin: 8, rightMin: 6, formulaMl: 30, spit: '少' })
assert(feed.leftMin === 8 && feed.formulaMl === 30 && feed.spit === '少', '混合喂养一次保存')
const temp = sanitizePayload('temp', { celsius: 36.56 })
assert(temp.celsius === 36.56, '体温保留小数')
const jaundice = sanitizePayload('jaundice', { value: 171, unit: 'μmol/L', site: '额头', note: '出院时' })
assert(jaundice.value === 171 && jaundice.unit === 'μmol/L' && jaundice.site === '额头', '黄疸记数字和部位')
let rejected = false
try { sanitizePayload('jaundice', { value: 0, unit: 'mg/dL' }) } catch (err) { rejected = err.message.indexOf('数字') >= 0 }
assert(rejected, '黄疸没有数字时不保存')
const fs = require('fs')
const path = require('path')
const catalog = fs.readFileSync(path.join(__dirname, 'recordTypes.js'))
assert(catalog.equals(fs.readFileSync(path.join(__dirname, '../../../shared/recordTypes.js'))), '记录项目录和 shared 不一致')
assert(catalog.equals(fs.readFileSync(path.join(__dirname, '../../../miniprogram/utils/recordTypes.js'))), '记录项目录和小程序不一致')

const plan = dueDays('2026-11-08')
assert(plan[0].dueDay === '2026-11-08', '卡介苗出生日')
assert(plan.some((item) => item.name.indexOf('百白破') >= 0 && item.dueDay === '2027-01-08'), '百白破第一剂满 2 月')

const buffer = workbook(exportRows(
  { nickname: '小禾', birthday: '2026-11-08' },
  {
    days: [{ day: '2026-11-08', feedCount: 1, breastMin: 10, formulaMl: 30, bottleBreastMl: 0, diaperCount: 1, peeCount: 1, poopCount: 1, poopBits: ['黄糊'], sleepMin: 60, medTaken: 1, medTotal: 3 }],
    records: [{ day: '2026-11-08', happenedAt: toTs('2026-11-08', '09:00'), type: 'feed', payload: feed, memberName: '妈妈' }],
    sheets: [],
    medLines: [{ day: '2026-11-08', time: '08:00', name: '示例药', planText: '2颗', status: 'taken', actualText: '2颗', note: '', memberName: '奶奶' }]
  },
  '2026-11-08',
  '2026-11-08'
))
assert(buffer.readUInt32LE(0) === 0x04034b50, 'xlsx 是 zip')
assert(buffer.indexOf(Buffer.from('家庭自己记的账')) >= 0, '汇总说明写进表格')
assert(buffer.indexOf(Buffer.from('示例药')) >= 0, '用药写进表格')

console.log('selfcheck ok', doses.length, 'doses', buffer.length, 'bytes')
