const { fail, text, num, oneOf, ownBaby, memberLabel } = require('./auth')
const { dayKey, isDay, addDays, toTs, timeKey } = require('./date')
const { planDoses, planText, doseLabel } = require('./medPlan')
const { fetchWhere, runBatches } = require('./query')

const UNITS = ['颗', '片', '粒', '毫升', '滴', '袋', '支', '克', '勺']

function normalizeSlots(data, amount, unit) {
  const slots = Array.isArray(data.slots) ? data.slots : []
  return slots.slice(0, 6).map((slot) => ({
    time: /^([01]\d|2[0-3]):[0-5]\d$/.test(slot.time) ? slot.time : '08:00',
    doseAmount: num(slot.doseAmount != null ? slot.doseAmount : amount, 0.25, 1000),
    doseUnit: oneOf(slot.doseUnit, UNITS, unit)
  }))
}

function readCourse(data) {
  const name = text(data.name, 40)
  if (!name) throw fail('请写下药名')
  const frequencyType = oneOf(data.frequencyType, ['timesPerDay', 'intervalHours', 'asNeeded'], 'timesPerDay')
  const doseUnit = oneOf(data.doseUnit, UNITS, '颗')
  const doseAmount = num(data.doseAmount, 0.25, 1000)
  if (!data.doseAmount || doseAmount <= 0) throw fail('请写下一次吃多少')
  const timesPerDay = num(data.timesPerDay, 1, 6)
  const intervalHours = num(data.intervalHours, 1, 24)
  const startDay = isDay(data.startDay) ? data.startDay : dayKey(Date.now())
  const days = num(data.days, 1, 31)
  const endDay = addDays(startDay, days - 1)
  const slots = frequencyType === 'timesPerDay' ? normalizeSlots(data, doseAmount, doseUnit) : normalizeSlots(data, doseAmount, doseUnit).slice(0, 1)
  if (frequencyType === 'timesPerDay' && !slots.length) throw fail('请设置每一顿的时间')
  const course = {
    name,
    form: text(data.form, 12),
    frequencyType,
    timesPerDay: slots.length || timesPerDay,
    intervalHours,
    doseAmount,
    doseUnit,
    slots,
    mealNote: oneOf(data.mealNote, ['', '饭前', '饭后', '与奶隔开'], ''),
    startDay,
    endDay,
    days,
    remind: data.remind !== false,
    planText: ''
  }
  course.planText = planText(course)
  return course
}

function presentMed(med) {
  return {
    _id: med._id,
    name: med.name,
    frequencyType: med.frequencyType,
    timesPerDay: med.timesPerDay,
    intervalHours: med.intervalHours,
    doseAmount: med.doseAmount,
    doseUnit: med.doseUnit,
    slots: med.slots || [],
    mealNote: med.mealNote || '',
    startDay: med.startDay,
    endDay: med.endDay,
    days: med.days,
    remind: med.remind !== false,
    planText: med.planText || planText(med),
    status: med.status
  }
}

function presentDose(dose, name) {
  return {
    _id: dose._id,
    medicationId: dose.medicationId,
    name: name || '用药',
    day: dose.day,
    planAt: dose.planAt,
    slotTime: dose.slotTime || timeKey(dose.planAt),
    doseAmount: dose.doseAmount,
    doseUnit: dose.doseUnit,
    status: dose.status,
    takenAt: dose.takenAt || null,
    actualAmount: dose.actualAmount == null ? null : dose.actualAmount,
    note: dose.note || '',
    memberName: dose.memberName || '',
    planDoseText: doseLabel(dose.doseAmount, dose.doseUnit)
  }
}

async function saveMedication(ctx, data) {
  const baby = await ownBaby(ctx, data.babyId)
  const course = readCourse(data)
  const now = ctx.now
  let medId = data._id
  if (medId) {
    let old = null
    try {
      old = (await ctx.db.collection('medications').doc(medId).get()).data
    } catch (e) {
      old = null
    }
    if (!old || old.familyId !== baby.familyId || old.babyId !== baby._id) throw fail('找不到这个疗程', 'NOT_FOUND')
    await ctx.db.collection('medications').doc(medId).update({
      data: Object.assign({ status: 'active', updatedAt: now }, course)
    })
  } else {
    const added = await ctx.db.collection('medications').add({
      data: Object.assign({
        familyId: baby.familyId,
        babyId: baby._id,
        status: 'active',
        createdAt: now,
        updatedAt: now
      }, course)
    })
    medId = added._id
  }

  const todayStart = toTs(dayKey(now), '00:00')
  const existing = await fetchWhere(ctx.db, 'medDoses', { medicationId: medId, familyId: baby.familyId })
  const keptAt = {}
  const removing = []
  existing.forEach((dose) => {
    const pendingToday = dose.status === 'pending' && dose.planAt >= todayStart
    if (pendingToday) removing.push(dose._id)
    else if (dose.planAt >= todayStart) keptAt[dose.planAt] = true
  })
  await runBatches(removing, (id) => ctx.db.collection('medDoses').doc(id).remove())
  const planned = planDoses(course).filter((dose) => dose.planAt >= todayStart && !keptAt[dose.planAt])
  await runBatches(planned, (dose) => ctx.db.collection('medDoses').add({
    data: {
      familyId: baby.familyId,
      babyId: baby._id,
      medicationId: medId,
      day: dose.day,
      planAt: dose.planAt,
      slotTime: dose.slotTime,
      doseAmount: dose.doseAmount,
      doseUnit: dose.doseUnit,
      status: 'pending',
      reminded: false,
      note: '',
      createdAt: now
    }
  }))
  return { _id: medId, planText: course.planText }
}

async function stopMedication(ctx, data) {
  const baby = await ownBaby(ctx, data.babyId)
  let med = null
  try {
    med = (await ctx.db.collection('medications').doc(data._id).get()).data
  } catch (e) {
    med = null
  }
  if (!med || med.familyId !== baby.familyId) throw fail('找不到这个疗程', 'NOT_FOUND')
  await ctx.db.collection('medications').doc(med._id).update({
    data: { status: 'finished', updatedAt: ctx.now }
  })
  const doses = await fetchWhere(ctx.db, 'medDoses', { medicationId: med._id, familyId: baby.familyId })
  for (let i = 0; i < doses.length; i += 1) {
    if (doses[i].status === 'pending' && doses[i].planAt >= ctx.now) {
      await ctx.db.collection('medDoses').doc(doses[i]._id).remove()
    }
  }
  return { ok: true }
}

async function listMedications(ctx, data) {
  const baby = await ownBaby(ctx, data.babyId)
  const meds = await fetchWhere(ctx.db, 'medications', { babyId: baby._id, familyId: baby.familyId, status: 'active' })
  meds.sort((a, b) => a.createdAt - b.createdAt)
  return { list: meds.map(presentMed) }
}

async function getMedication(ctx, data) {
  const baby = await ownBaby(ctx, data.babyId)
  let med = null
  try {
    med = (await ctx.db.collection('medications').doc(data._id).get()).data
  } catch (e) {
    med = null
  }
  if (!med || med.familyId !== baby.familyId) throw fail('找不到这个疗程', 'NOT_FOUND')
  return presentMed(med)
}

async function markDose(ctx, data) {
  await ownBaby(ctx, data.babyId)
  let dose = null
  try {
    dose = (await ctx.db.collection('medDoses').doc(data._id).get()).data
  } catch (e) {
    dose = null
  }
  if (!dose || dose.familyId !== ctx.member.familyId) throw fail('找不到这一顿', 'NOT_FOUND')
  const status = oneOf(data.status, ['taken', 'skipped', 'pending'], 'taken')
  const patch = {
    status,
    memberId: ctx.member._id,
    memberName: memberLabel(ctx.member),
    updatedAt: ctx.now,
    note: text(data.note, 80)
  }
  if (status === 'taken') {
    patch.takenAt = data.when === 'plan' ? dose.planAt : (Number(data.takenAt) || ctx.now)
    patch.actualAmount = data.actualAmount == null ? dose.doseAmount : num(data.actualAmount, 0, 1000)
  } else {
    patch.takenAt = 0
    patch.actualAmount = 0
  }
  await ctx.db.collection('medDoses').doc(dose._id).update({ data: patch })
  return { ok: true }
}

async function addAsNeededDose(ctx, data) {
  const baby = await ownBaby(ctx, data.babyId)
  let med = null
  try {
    med = (await ctx.db.collection('medications').doc(data.medicationId).get()).data
  } catch (e) {
    med = null
  }
  if (!med || med.familyId !== baby.familyId || med.frequencyType !== 'asNeeded') throw fail('这不是按需吃的药', 'NOT_FOUND')
  const takenAt = Number(data.takenAt) || ctx.now
  const added = await ctx.db.collection('medDoses').add({
    data: {
      familyId: baby.familyId,
      babyId: baby._id,
      medicationId: med._id,
      day: dayKey(takenAt),
      planAt: takenAt,
      slotTime: timeKey(takenAt),
      doseAmount: med.doseAmount,
      doseUnit: med.doseUnit,
      status: 'taken',
      takenAt,
      actualAmount: data.actualAmount == null ? med.doseAmount : num(data.actualAmount, 0, 1000),
      reminded: true,
      note: text(data.note, 80),
      memberId: ctx.member._id,
      memberName: memberLabel(ctx.member),
      createdAt: ctx.now
    }
  })
  return { _id: added._id }
}

module.exports = {
  saveMedication,
  stopMedication,
  listMedications,
  getMedication,
  markDose,
  addAsNeededDose,
  presentDose
}
