const { toTs, addDays, dayKey, timeKey, trimNum } = require('./date')

const DEFAULT_TIMES = {
  1: ['08:00'],
  2: ['08:00', '20:00'],
  3: ['08:00', '14:00', '20:00'],
  4: ['08:00', '12:00', '16:00', '20:00'],
  5: ['08:00', '11:00', '14:00', '17:00', '20:00'],
  6: ['07:00', '10:00', '13:00', '16:00', '19:00', '22:00']
}

function doseLabel(amount, unit) {
  return trimNum(amount) + (unit || '')
}

function planText(med) {
  const dose = doseLabel(med.doseAmount, med.doseUnit)
  if (med.frequencyType === 'asNeeded') return '按需，一次' + dose
  if (med.frequencyType === 'intervalHours') return '每' + med.intervalHours + '小时一次，一次' + dose
  const slots = med.slots || []
  const count = slots.length || med.timesPerDay || 0
  const base = '一天' + count + '次'
  const same = !slots.length || slots.every((slot) => Number(slot.doseAmount) === Number(med.doseAmount))
  if (same) return base + '，一次' + dose
  return base + '，' + slots.map((slot) => slot.time + ' ' + doseLabel(slot.doseAmount, slot.doseUnit || med.doseUnit)).join(' ')
}

function planDoses(input) {
  const amount = Math.round(Number(input.doseAmount) * 100) / 100
  const unit = input.doseUnit
  const doses = []
  if (input.frequencyType === 'asNeeded') return doses

  if (input.frequencyType === 'intervalHours') {
    const hours = Number(input.intervalHours)
    if (!hours || hours <= 0) return doses
    const firstTime = input.slots && input.slots[0] && input.slots[0].time ? input.slots[0].time : '08:00'
    let cursor = toTs(input.startDay, firstTime)
    const end = toTs(input.endDay, '23:59')
    const step = hours * 60 * 60 * 1000
    let guard = 0
    while (cursor <= end && guard < 200) {
      doses.push({
        day: dayKey(cursor),
        planAt: cursor,
        slotTime: timeKey(cursor),
        doseAmount: amount,
        doseUnit: unit
      })
      cursor += step
      guard += 1
    }
    return doses
  }

  const fallback = DEFAULT_TIMES[input.timesPerDay] || DEFAULT_TIMES[3]
  const slots = input.slots && input.slots.length
    ? input.slots
    : fallback.map((time) => ({ time, doseAmount: amount, doseUnit: unit }))
  let day = input.startDay
  let guard = 0
  while (day <= input.endDay && guard < 40) {
    slots.forEach((slot) => {
      doses.push({
        day,
        planAt: toTs(day, slot.time),
        slotTime: slot.time,
        doseAmount: Math.round(Number(slot.doseAmount != null ? slot.doseAmount : amount) * 100) / 100,
        doseUnit: slot.doseUnit || unit
      })
    })
    day = addDays(day, 1)
    guard += 1
  }
  return doses
}

module.exports = { DEFAULT_TIMES, doseLabel, planText, planDoses }
