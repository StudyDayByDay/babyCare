const { ownBaby, fail } = require('./auth')
const { isDay, addDays } = require('./date')
const { fetchWhere } = require('./query')
const { presentDose } = require('./meds')
const { presentRecord } = require('./records')
const { doseLabel } = require('./medPlan')

function failRange(startDay, endDay) {
  if (!isDay(startDay) || !isDay(endDay) || startDay > endDay) {
    throw fail('日期范围不对')
  }
  let count = 1
  let cursor = startDay
  while (cursor < endDay) {
    cursor = addDays(cursor, 1)
    count += 1
    if (count > 31) throw fail('一次最多看 31 天')
  }
}

function emptyDay(day) {
  return {
    day,
    feedCount: 0,
    breastMin: 0,
    formulaMl: 0,
    bottleBreastMl: 0,
    diaperCount: 0,
    peeCount: 0,
    poopCount: 0,
    sleepMin: 0,
    medTaken: 0,
    medTotal: 0,
    poopBits: []
  }
}

function addRecord(bucket, rec) {
  const p = rec.payload || {}
  if (rec.type === 'feed') {
    bucket.feedCount += 1
    bucket.breastMin += Number(p.leftMin || 0) + Number(p.rightMin || 0)
    bucket.formulaMl += Number(p.formulaMl || 0)
    bucket.bottleBreastMl += Number(p.bottleBreastMl || 0)
  } else if (rec.type === 'diaper') {
    bucket.diaperCount += 1
    if (p.pee) bucket.peeCount += 1
    if (p.poop) {
      bucket.poopCount += 1
      const bit = (p.color || '') + (p.texture || '')
      if (bit && bucket.poopBits.indexOf(bit) < 0) bucket.poopBits.push(bit)
    }
  } else if (rec.type === 'sleep') {
    bucket.sleepMin += Number(p.durationMin || 0)
  }
}

function sumDays(days) {
  const totals = emptyDay('total')
  days.forEach((day) => {
    ;['feedCount', 'breastMin', 'formulaMl', 'bottleBreastMl', 'diaperCount', 'peeCount', 'poopCount', 'sleepMin', 'medTaken', 'medTotal'].forEach((key) => {
      totals[key] += day[key]
    })
  })
  return totals
}

async function collectRange(ctx, baby, startDay, endDay) {
  failRange(startDay, endDay)
  const _ = ctx._
  const whereDay = _.and(_.gte(startDay), _.lte(endDay))
  const base = { babyId: baby._id, familyId: baby.familyId, day: whereDay }
  const records = await fetchWhere(ctx.db, 'records', base)
  const sheets = await fetchWhere(ctx.db, 'dailySheets', base)
  const doses = await fetchWhere(ctx.db, 'medDoses', base)
  const meds = await fetchWhere(ctx.db, 'medications', { babyId: baby._id, familyId: baby.familyId })
  const names = {}
  meds.forEach((med) => { names[med._id] = med.name })
  const map = {}
  let cursor = startDay
  while (cursor <= endDay) {
    map[cursor] = emptyDay(cursor)
    cursor = addDays(cursor, 1)
  }
  records.forEach((rec) => { if (map[rec.day]) addRecord(map[rec.day], rec) })
  const medLines = doses.map((dose) => {
    if (map[dose.day]) {
      map[dose.day].medTotal += 1
      if (dose.status === 'taken') map[dose.day].medTaken += 1
    }
    const view = presentDose(dose, names[dose.medicationId])
    return {
      day: view.day,
      time: view.slotTime,
      name: view.name,
      planText: view.planDoseText,
      status: view.status,
      actualText: view.status === 'taken' ? doseLabel(view.actualAmount != null ? view.actualAmount : view.doseAmount, view.doseUnit) : '',
      note: view.note,
      memberName: view.memberName
    }
  })
  medLines.sort((a, b) => (a.day + a.time).localeCompare(b.day + b.time))
  const days = Object.keys(map).sort().map((key) => map[key])
  records.sort((a, b) => a.happenedAt - b.happenedAt)
  return { days, totals: sumDays(days), medLines, records, sheets, doses, meds }
}

async function getDay(ctx, data) {
  const baby = await ownBaby(ctx, data.babyId)
  if (!isDay(data.day)) throw fail('日期不对')
  const where = { babyId: baby._id, familyId: baby.familyId, day: data.day }
  const records = await fetchWhere(ctx.db, 'records', where)
  const sheets = await fetchWhere(ctx.db, 'dailySheets', where)
  const doses = await fetchWhere(ctx.db, 'medDoses', where)
  const meds = await fetchWhere(ctx.db, 'medications', { babyId: baby._id, familyId: baby.familyId })
  const names = {}
  meds.forEach((med) => { names[med._id] = med.name })
  records.sort((a, b) => a.happenedAt - b.happenedAt)
  doses.sort((a, b) => a.planAt - b.planAt)
  const summary = emptyDay(data.day)
  records.forEach((rec) => addRecord(summary, rec))
  doses.forEach((dose) => {
    summary.medTotal += 1
    if (dose.status === 'taken') summary.medTaken += 1
  })
  return {
    day: data.day,
    records: records.map(presentRecord),
    daily: sheets[0] || null,
    doses: doses.map((dose) => presentDose(dose, names[dose.medicationId])),
    summary
  }
}

async function getRange(ctx, data) {
  const baby = await ownBaby(ctx, data.babyId)
  const collected = await collectRange(ctx, baby, data.startDay, data.endDay)
  return {
    startDay: data.startDay,
    endDay: data.endDay,
    days: collected.days,
    totals: collected.totals,
    medLines: collected.medLines
  }
}

module.exports = { collectRange, getRange, getDay, emptyDay, addRecord }
