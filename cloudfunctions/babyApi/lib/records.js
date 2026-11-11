const { fail, text, num, oneOf, clean, ownBaby, memberLabel } = require('./auth')
const { dayKey, isDay } = require('./date')
const { describeRecord } = require('./describe')
const { simpleKeys, simpleByKey, sanitizeSimple } = require('./recordTypes')

const TYPES = ['feed', 'diaper', 'sleep', 'solid', 'milestone', 'note'].concat(simpleKeys())

function resolveSleep(startAt, endAt) {
  let end = Number(endAt)
  const start = Number(startAt)
  if (!isFinite(start) || !isFinite(end)) return null
  if (end <= start) end += 24 * 60 * 60 * 1000
  const durationMin = Math.round((end - start) / 60000)
  return { startAt: start, endAt: end, durationMin }
}

function sanitizePayload(type, payload) {
  const src = payload || {}
  const simple = simpleByKey(type)
  if (simple) return sanitizeSimple(simple, src, { num, text, oneOf })
  if (type === 'feed') {
    const data = {
      leftMin: num(src.leftMin, 0, 180),
      rightMin: num(src.rightMin, 0, 180),
      bottleBreastMl: num(src.bottleBreastMl, 0, 500),
      formulaMl: num(src.formulaMl, 0, 500),
      spit: oneOf(src.spit, ['无', '少', '多'], '无'),
      note: text(src.note, 80)
    }
    if (!data.leftMin && !data.rightMin && !data.bottleBreastMl && !data.formulaMl) {
      throw fail('请记下左侧、右侧或奶量')
    }
    return data
  }
  if (type === 'diaper') {
    const data = {
      pee: !!src.pee,
      poop: !!src.poop,
      color: oneOf(src.color, ['胎便', '黄', '绿', '棕', '白陶土', '血丝'], '黄'),
      texture: oneOf(src.texture, ['糊', '稀', '干', '黏液', '颗粒'], '糊'),
      amount: oneOf(src.amount, ['少', '中', '多'], '中'),
      note: text(src.note, 80)
    }
    if (!data.pee && !data.poop) throw fail('请选择小便、大便，或两者都有')
    if (!data.poop) {
      data.color = ''
      data.texture = ''
      data.amount = ''
    }
    return data
  }
  if (type === 'sleep') {
    const resolved = resolveSleep(src.startAt, src.endAt)
    if (!resolved || resolved.durationMin <= 0 || resolved.durationMin > 18 * 60) {
      throw fail('睡眠时间看起来不对，请改一下起止时间')
    }
    return {
      startAt: resolved.startAt,
      endAt: resolved.endAt,
      durationMin: resolved.durationMin,
      direction: oneOf(src.direction, ['左', '右', '仰'], '仰'),
      note: text(src.note, 80)
    }
  }
  if (type === 'solid') {
    const name = text(src.name, 40)
    if (!name) throw fail('请写下吃了什么')
    return {
      name,
      texture: oneOf(src.texture, ['泥', '碎末', '手指食物', '正餐'], '泥'),
      amountText: text(src.amountText, 20),
      isNew: !!src.isNew,
      reaction: oneOf(src.reaction, ['爱吃', '一般', '拒', '未填'], '未填'),
      note: text(src.note, 80)
    }
  }
  if (type === 'milestone') {
    const name = text(src.name, 40)
    if (!name) throw fail('请写下这一次里程碑')
    return { name }
  }
  if (type === 'note') {
    const body = text(src.text, 200)
    if (!body) throw fail('请写下要记的话')
    return { category: oneOf(src.category, ['生病', '就医', '其他'], '其他'), text: body }
  }
  throw fail('不认识这种记录')
}

function presentRecord(rec) {
  return {
    _id: rec._id,
    type: rec.type,
    happenedAt: rec.happenedAt,
    day: rec.day,
    payload: rec.payload,
    memberName: rec.memberName || '',
    text: describeRecord(rec)
  }
}

async function saveRecord(ctx, data) {
  const baby = await ownBaby(ctx, data.babyId)
  const type = oneOf(data.type, TYPES, '')
  if (!type) throw fail('不认识这种记录')
  const happenedAt = Number(data.happenedAt)
  if (!isFinite(happenedAt) || happenedAt < Date.UTC(2020, 0, 1) || happenedAt > Date.UTC(2100, 0, 1)) {
    throw fail('时间不对')
  }
  const payload = sanitizePayload(type, data.payload)
  const now = ctx.now
  const base = clean({
    familyId: baby.familyId,
    babyId: baby._id,
    type,
    happenedAt: type === 'sleep' ? payload.startAt : happenedAt,
    day: dayKey(type === 'sleep' ? payload.startAt : happenedAt),
    payload,
    memberId: ctx.member._id,
    memberName: memberLabel(ctx.member),
    updatedAt: now
  })
  if (data._id) {
    let old = null
    try {
      old = (await ctx.db.collection('records').doc(data._id).get()).data
    } catch (e) {
      old = null
    }
    if (!old || old.familyId !== ctx.member.familyId || old.babyId !== baby._id) throw fail('找不到这条记录', 'NOT_FOUND')
    if (old.type !== type) throw fail('不能改成另一种记录')
    await ctx.db.collection('records').doc(data._id).update({ data: base })
    return { _id: data._id }
  }
  base.createdAt = now
  const added = await ctx.db.collection('records').add({ data: base })
  return { _id: added._id }
}

async function deleteRecord(ctx, data) {
  await ownBaby(ctx, data.babyId)
  let old = null
  try {
    old = (await ctx.db.collection('records').doc(data._id).get()).data
  } catch (e) {
    old = null
  }
  if (!old || old.familyId !== ctx.member.familyId) throw fail('找不到这条记录', 'NOT_FOUND')
  await ctx.db.collection('records').doc(data._id).remove()
  return { ok: true }
}

function emptyCare() {
  return { face: false, nose: false, hands: false, nails: false, bath: false, moisture: false }
}

function emptyEdu() {
  return { visual: false, auditory: false, gross: false, fine: false }
}

function sanitizeDaily(data, customNames) {
  const src = data || {}
  const care = emptyCare()
  const edu = emptyEdu()
  Object.keys(care).forEach((key) => { care[key] = !!(src.care && src.care[key]) })
  Object.keys(edu).forEach((key) => { edu[key] = !!(src.earlyEdu && src.earlyEdu[key]) })
  const custom = {}
  ;(customNames || []).forEach((name) => {
    custom[name] = !!(src.supplements && src.supplements.custom && src.supplements.custom[name])
  })
  return {
    mood: oneOf(src.mood, ['好', '一般', '较差', ''], ''),
    weather: text(src.weather, 12),
    note: text(src.note, 200),
    supplements: {
      vd: !!(src.supplements && src.supplements.vd),
      ad: !!(src.supplements && src.supplements.ad),
      custom
    },
    care,
    earlyEdu: edu,
    jaundice: oneOf(src.jaundice, ['无', '轻', '明显', ''], ''),
    umbilical: oneOf(src.umbilical, ['干燥', '渗出', '脱落', ''], ''),
    tummyMin: num(src.tummyMin, 0, 180)
  }
}

async function saveDaily(ctx, data) {
  const baby = await ownBaby(ctx, data.babyId)
  if (!isDay(data.day)) throw fail('日期不对')
  const sheet = sanitizeDaily(data.sheet, baby.customSupplements || [])
  const now = ctx.now
  const existing = await ctx.db.collection('dailySheets').where({
    familyId: baby.familyId,
    babyId: baby._id,
    day: data.day
  }).limit(1).get()
  const payload = Object.assign({
    familyId: baby.familyId,
    babyId: baby._id,
    day: data.day,
    memberName: memberLabel(ctx.member),
    updatedAt: now
  }, sheet)
  if (existing.data.length) {
    await ctx.db.collection('dailySheets').doc(existing.data[0]._id).update({ data: payload })
    return { _id: existing.data[0]._id }
  }
  payload.createdAt = now
  const added = await ctx.db.collection('dailySheets').add({ data: payload })
  return { _id: added._id }
}

async function getRecord(ctx, data) {
  await ownBaby(ctx, data.babyId)
  let rec = null
  try {
    rec = (await ctx.db.collection('records').doc(data._id).get()).data
  } catch (e) {
    rec = null
  }
  if (!rec || rec.familyId !== ctx.member.familyId) throw fail('找不到这条记录', 'NOT_FOUND')
  return presentRecord(rec)
}

module.exports = {
  TYPES,
  resolveSleep,
  sanitizePayload,
  presentRecord,
  saveRecord,
  deleteRecord,
  getRecord,
  saveDaily,
  sanitizeDaily
}
