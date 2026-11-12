const cloud = require('wx-server-sdk')
const remind = require('./remind.config')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command
const OFFSET = 8 * 60 * 60 * 1000

function pad(n) {
  return n < 10 ? '0' + n : '' + n
}

function parts(ts) {
  const d = new Date(Number(ts) + OFFSET)
  return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate(), hh: d.getUTCHours(), mm: d.getUTCMinutes() }
}

function dayKey(ts) {
  const p = parts(ts)
  return p.y + '-' + pad(p.m) + '-' + pad(p.d)
}

function cnDateTime(ts) {
  const p = parts(ts)
  return p.y + '年' + p.m + '月' + p.d + '日 ' + pad(p.hh) + ':' + pad(p.mm)
}

function clip(value, max) {
  const text = String(value || '').replace(/\s+/g, ' ').trim()
  return text ? text.slice(0, max) : '用药提醒'
}

exports.main = async () => {
  try {
    await cloud.callFunction({ name: 'babyApi', data: { action: 'extendMeds' } })
  } catch (err) {
    console.error('extend meds', err)
  }
  if (!remind.templateId) return { ok: true, skipped: 'NO_TEMPLATE' }
  const now = Date.now()
  const start = now - 10 * 60 * 1000
  const found = await db.collection('medDoses').where({
    status: 'pending',
    reminded: false,
    planAt: _.and(_.gte(start), _.lte(now))
  }).limit(100).get()
  const groups = {}
  found.data.forEach((dose) => {
    const key = dose.familyId + '|' + Math.floor(dose.planAt / 60000)
    if (!groups[key]) groups[key] = []
    groups[key].push(dose)
  })
  const keys = Object.keys(groups)
  for (let i = 0; i < keys.length; i += 1) {
    const doses = groups[keys[i]]
    for (let d = 0; d < doses.length; d += 1) {
      await db.collection('medDoses').doc(doses[d]._id).update({ data: { reminded: true } })
    }
    const meds = await db.collection('medications').where({ familyId: doses[0].familyId, remind: true, status: 'active' }).limit(50).get()
    const allow = {}
    meds.data.forEach((med) => { allow[med._id] = med })
    const due = doses.filter((dose) => allow[dose.medicationId])
    if (!due.length) continue
    const names = {}
    const nameList = await db.collection('medications').where({ familyId: doses[0].familyId }).limit(50).get()
    nameList.data.forEach((med) => { names[med._id] = med.name })
    const text = due.map((dose) => (names[dose.medicationId] || '用药') + (dose.doseAmount || '') + (dose.doseUnit || '')).join('、')
    const members = await db.collection('familyMembers').where({ familyId: doses[0].familyId }).limit(20).get()
    for (let m = 0; m < members.data.length; m += 1) {
      const openid = members.data[m].openid
      const quota = await db.collection('subscriptions').where({
        openid,
        templateId: remind.templateId,
        remainingQuota: _.gt(0)
      }).limit(1).get()
      if (!quota.data.length) continue
      const quotaDoc = quota.data[0]
      try {
        await cloud.openapi.subscribeMessage.send({
          touser: openid,
          templateId: remind.templateId,
          page: 'pages/today/index',
          miniprogramState: remind.miniprogramState || 'formal',
          lang: 'zh_CN',
          data: remind.buildData({
            text: clip(text, 20),
            timeText: cnDateTime(due[0].planAt)
          })
        })
        await db.collection('subscriptions').doc(quotaDoc._id).update({
          data: { remainingQuota: _.inc(-1), updatedAt: now }
        })
      } catch (err) {
        console.error('subscribe send failed', openid, err)
      }
    }
  }
  return { ok: true, groups: keys.length, day: dayKey(now) }
}
