const { fail, text, num, oneOf, ownBaby } = require('./auth')
const { isDay, dayKey } = require('./date')
const { dueDays } = require('./vaccines')
const { fetchWhere } = require('./query')

async function saveGrowth(ctx, data) {
  const baby = await ownBaby(ctx, data.babyId)
  const day = isDay(data.day) ? data.day : dayKey(ctx.now)
  const weightG = data.weightG ? num(data.weightG, 300, 50000) : null
  const heightCm = data.heightCm ? num(data.heightCm, 20, 160) : null
  const headCm = data.headCm ? num(data.headCm, 20, 80) : null
  if (!weightG && !heightCm && !headCm) throw fail('请至少记下体重、身长或头围')
  const payload = {
    familyId: baby.familyId,
    babyId: baby._id,
    day,
    weightG,
    heightCm,
    headCm,
    note: text(data.note, 80),
    updatedAt: ctx.now
  }
  if (data._id) {
    let old = null
    try { old = (await ctx.db.collection('growthMeasures').doc(data._id).get()).data } catch (e) { old = null }
    if (!old || old.familyId !== baby.familyId) throw fail('找不到这次测量', 'NOT_FOUND')
    await ctx.db.collection('growthMeasures').doc(data._id).update({ data: payload })
    return { _id: data._id }
  }
  payload.createdAt = ctx.now
  const added = await ctx.db.collection('growthMeasures').add({ data: payload })
  return { _id: added._id }
}

async function deleteGrowth(ctx, data) {
  await ownBaby(ctx, data.babyId)
  let old = null
  try { old = (await ctx.db.collection('growthMeasures').doc(data._id).get()).data } catch (e) { old = null }
  if (!old || old.familyId !== ctx.member.familyId) throw fail('找不到这次测量', 'NOT_FOUND')
  await ctx.db.collection('growthMeasures').doc(data._id).remove()
  return { ok: true }
}

async function listGrowth(ctx, data) {
  const baby = await ownBaby(ctx, data.babyId)
  const list = await fetchWhere(ctx.db, 'growthMeasures', { babyId: baby._id, familyId: baby.familyId })
  list.sort((a, b) => (a.day < b.day ? 1 : -1))
  return {
    list: list.map((item) => ({
      _id: item._id,
      day: item.day,
      weightG: item.weightG,
      heightCm: item.heightCm,
      headCm: item.headCm,
      note: item.note || ''
    }))
  }
}

function presentVaccine(item) {
  return {
    _id: item._id,
    name: item.name,
    dueDay: item.dueDay,
    status: item.status,
    doneDay: item.doneDay || '',
    source: item.source || 'manual',
    scheduleKey: item.scheduleKey || '',
    note: item.note || ''
  }
}

async function listVaccines(ctx, data) {
  const baby = await ownBaby(ctx, data.babyId)
  const list = await fetchWhere(ctx.db, 'vaccines', { babyId: baby._id, familyId: baby.familyId })
  list.sort((a, b) => (a.dueDay > b.dueDay ? 1 : -1))
  return { list: list.map(presentVaccine) }
}

async function syncVaccines(ctx, data) {
  const baby = await ownBaby(ctx, data.babyId)
  if (!baby.birthday) throw fail('请先填写出生日')
  const existing = await fetchWhere(ctx.db, 'vaccines', { babyId: baby._id, familyId: baby.familyId })
  const plan = dueDays(baby.birthday)
  const planByKey = {}
  plan.forEach((item) => { planByKey[item.scheduleKey] = item })
  for (let i = 0; i < existing.length; i += 1) {
    const item = existing[i]
    if (!item.scheduleKey) continue
    const next = planByKey[item.scheduleKey]
    if (!next) {
      if (item.status === 'pending') await ctx.db.collection('vaccines').doc(item._id).remove()
      continue
    }
    if (item.status === 'pending' && (item.name !== next.name || item.dueDay !== next.dueDay)) {
      await ctx.db.collection('vaccines').doc(item._id).update({
        data: { name: next.name, dueDay: next.dueDay, updatedAt: ctx.now }
      })
    }
  }
  const fresh = await fetchWhere(ctx.db, 'vaccines', { babyId: baby._id, familyId: baby.familyId })
  const keys = {}
  fresh.forEach((item) => { if (item.scheduleKey) keys[item.scheduleKey] = true })
  for (let i = 0; i < plan.length; i += 1) {
    if (keys[plan[i].scheduleKey]) continue
    await ctx.db.collection('vaccines').add({
      data: {
        familyId: baby.familyId,
        babyId: baby._id,
        scheduleKey: plan[i].scheduleKey,
        name: plan[i].name,
        dueDay: plan[i].dueDay,
        source: 'schedule',
        status: 'pending',
        doneDay: '',
        note: '',
        createdAt: ctx.now
      }
    })
  }
  return listVaccines(ctx, data)
}

async function saveVaccine(ctx, data) {
  const baby = await ownBaby(ctx, data.babyId)
  const status = oneOf(data.status, ['pending', 'done', 'skipped'], 'pending')
  if (data._id) {
    let old = null
    try { old = (await ctx.db.collection('vaccines').doc(data._id).get()).data } catch (e) { old = null }
    if (!old || old.familyId !== baby.familyId) throw fail('找不到这项', 'NOT_FOUND')
    const name = text(data.name, 40)
    const patch = {
      status,
      note: data.note == null ? (old.note || '') : text(data.note, 80),
      updatedAt: ctx.now
    }
    if (name) patch.name = name
    if (isDay(data.dueDay)) patch.dueDay = data.dueDay
    patch.doneDay = status === 'done'
      ? (isDay(data.doneDay) ? data.doneDay : (isDay(old.doneDay) ? old.doneDay : dayKey(ctx.now)))
      : ''
    await ctx.db.collection('vaccines').doc(data._id).update({ data: patch })
    return { _id: data._id }
  }
  const name = text(data.name, 40)
  if (!name) throw fail('请写下疫苗名称')
  if (!isDay(data.dueDay)) throw fail('请选择日期')
  const added = await ctx.db.collection('vaccines').add({
    data: {
      familyId: baby.familyId,
      babyId: baby._id,
      scheduleKey: '',
      name,
      dueDay: data.dueDay,
      source: 'manual',
      status,
      doneDay: status === 'done' ? dayKey(ctx.now) : '',
      note: text(data.note, 80),
      createdAt: ctx.now
    }
  })
  return { _id: added._id }
}

async function deleteVaccine(ctx, data) {
  const baby = await ownBaby(ctx, data.babyId)
  let old = null
  try { old = (await ctx.db.collection('vaccines').doc(data._id).get()).data } catch (e) { old = null }
  if (!old || old.familyId !== baby.familyId) throw fail('找不到这项', 'NOT_FOUND')
  await ctx.db.collection('vaccines').doc(data._id).remove()
  return { ok: true }
}

module.exports = { saveGrowth, deleteGrowth, listGrowth, listVaccines, syncVaccines, saveVaccine, deleteVaccine }
