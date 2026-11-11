const { fail, text, num, oneOf, clean, requireMember, ownBaby, memberLabel } = require('./auth')
const { dayKey, isDay } = require('./date')
const { fetchWhere, runBatches } = require('./query')
const records = require('./records')
const meds = require('./meds')
const health = require('./health')
const stats = require('./stats')
const exporter = require('./export')

const COLLECTIONS = [
  'families', 'familyMembers', 'babies', 'records', 'dailySheets',
  'medications', 'medDoses', 'subscriptions', 'growthMeasures', 'vaccines'
]

let collectionsReady = false

async function ensureCollections(db) {
  if (collectionsReady) return
  for (let i = 0; i < COLLECTIONS.length; i += 1) {
    try {
      await db.createCollection(COLLECTIONS[i])
    } catch (e) {
      // 集合已存在时云开发会抛错，忽略即可。
    }
  }
  collectionsReady = true
}

async function loadMember(db, openid) {
  const res = await db.collection('familyMembers').where({ openid }).limit(1).get()
  return res.data[0] || null
}

async function loadFamily(db, familyId) {
  try {
    return (await db.collection('families').doc(familyId).get()).data
  } catch (e) {
    return null
  }
}

function randomCode() {
  return String(Math.floor(100000 + Math.random() * 900000))
}

async function uniqueCode(db) {
  for (let i = 0; i < 6; i += 1) {
    const inviteCode = randomCode()
    const found = await db.collection('families').where({ inviteCode }).limit(1).get()
    if (!found.data.length) return inviteCode
  }
  throw fail('邀请码没有生成成功，请再试一次')
}

function presentBaby(baby) {
  if (!baby) return null
  return {
    _id: baby._id,
    nickname: baby.nickname,
    gender: baby.gender || '未填',
    birthday: baby.birthday,
    birthTime: baby.birthTime || '',
    gestationalWeeks: baby.gestationalWeeks || null,
    birthWeightG: baby.birthWeightG || null,
    birthLengthCm: baby.birthLengthCm || null,
    birthHeadCm: baby.birthHeadCm || null,
    delivery: baby.delivery || '未填',
    allergies: baby.allergies || '',
    notes: baby.notes || '',
    customSupplements: baby.customSupplements || []
  }
}

async function babiesOf(ctx) {
  const list = await fetchWhere(ctx.db, 'babies', { familyId: ctx.member.familyId }, 20)
  list.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))
  return list
}

function presentSession(ctx, babies) {
  const current = babies.find((baby) => baby._id === ctx.member.currentBabyId) || babies[0] || null
  return {
    member: {
      _id: ctx.member._id,
      roleName: ctx.member.roleName || '妈妈',
      displayName: ctx.member.displayName || '',
      elderMode: !!ctx.member.elderMode,
      label: memberLabel(ctx.member)
    },
    family: {
      _id: ctx.family._id,
      name: ctx.family.name || '我们家',
      inviteCode: ctx.family.inviteCode,
      isOwner: ctx.family.ownerOpenId === ctx.openid
    },
    baby: presentBaby(current),
    babies: babies.map(presentBaby)
  }
}

async function bootstrap(ctx) {
  if (!ctx.family) {
    const inviteCode = await uniqueCode(ctx.db)
    const familyAdd = await ctx.db.collection('families').add({
      data: {
        inviteCode,
        ownerOpenId: ctx.openid,
        name: '我们家',
        createdAt: ctx.now
      }
    })
    ctx.family = {
      _id: familyAdd._id,
      inviteCode,
      ownerOpenId: ctx.openid,
      name: '我们家'
    }
    if (!ctx.member) {
      const memberAdd = await ctx.db.collection('familyMembers').add({
        data: {
          openid: ctx.openid,
          familyId: familyAdd._id,
          roleName: '妈妈',
          displayName: '',
          elderMode: false,
          currentBabyId: '',
          createdAt: ctx.now
        }
      })
      ctx.member = {
        _id: memberAdd._id,
        openid: ctx.openid,
        familyId: familyAdd._id,
        roleName: '妈妈',
        displayName: '',
        elderMode: false,
        currentBabyId: ''
      }
    } else {
      await ctx.db.collection('familyMembers').doc(ctx.member._id).update({
        data: { familyId: familyAdd._id, currentBabyId: '' }
      })
      ctx.member.familyId = familyAdd._id
      ctx.member.currentBabyId = ''
    }
  }
  return presentSession(ctx, await babiesOf(ctx))
}

async function updateMember(ctx, data) {
  requireMember(ctx)
  const patch = clean({
    roleName: oneOf(data.roleName, ['妈妈', '爸爸', '奶奶', '爷爷', '外婆', '外公', '月嫂', '其他'], ctx.member.roleName || '妈妈'),
    displayName: text(data.displayName, 12),
    elderMode: !!data.elderMode,
    updatedAt: ctx.now
  })
  await ctx.db.collection('familyMembers').doc(ctx.member._id).update({ data: patch })
  ctx.member = Object.assign({}, ctx.member, patch)
  return presentSession(ctx, await babiesOf(ctx))
}

async function saveBaby(ctx, data) {
  requireMember(ctx)
  const nickname = text(data.nickname, 12)
  if (!nickname) throw fail('请写下宝宝怎么称呼')
  if (!isDay(data.birthday)) throw fail('请选择出生日')
  if (data.birthday > dayKey(ctx.now)) throw fail('出生日还没到')
  const customSupplements = []
  const source = Array.isArray(data.customSupplements) ? data.customSupplements : []
  source.forEach((item) => {
    const name = text(item, 8)
    if (name && customSupplements.indexOf(name) < 0 && customSupplements.length < 8) customSupplements.push(name)
  })
  const payload = {
    familyId: ctx.member.familyId,
    nickname,
    gender: oneOf(data.gender, ['女', '男', '未填'], '未填'),
    birthday: data.birthday,
    birthTime: /^([01]\d|2[0-3]):[0-5]\d$/.test(data.birthTime || '') ? data.birthTime : '',
    gestationalWeeks: data.gestationalWeeks ? num(data.gestationalWeeks, 22, 43) : null,
    birthWeightG: data.birthWeightG ? num(data.birthWeightG, 300, 8000) : null,
    birthLengthCm: data.birthLengthCm ? num(data.birthLengthCm, 20, 70) : null,
    birthHeadCm: data.birthHeadCm ? num(data.birthHeadCm, 20, 50) : null,
    delivery: oneOf(data.delivery, ['顺产', '剖宫产', '未填'], '未填'),
    allergies: text(data.allergies, 80),
    notes: text(data.notes, 200),
    customSupplements,
    updatedAt: ctx.now
  }
  let babyId = data._id
  if (babyId) {
    await ownBaby(ctx, babyId)
    await ctx.db.collection('babies').doc(babyId).update({ data: payload })
  } else {
    payload.createdAt = ctx.now
    const added = await ctx.db.collection('babies').add({ data: payload })
    babyId = added._id
  }
  await ctx.db.collection('familyMembers').doc(ctx.member._id).update({ data: { currentBabyId: babyId } })
  ctx.member.currentBabyId = babyId
  return presentSession(ctx, await babiesOf(ctx))
}

async function removeDocs(ctx, name, where) {
  const list = await fetchWhere(ctx.db, name, where)
  await runBatches(list, (item) => ctx.db.collection(name).doc(item._id).remove())
}

async function deleteBaby(ctx, data) {
  const baby = await ownBaby(ctx, data.babyId)
  if (ctx.family.ownerOpenId !== ctx.openid) throw fail('只有家庭创建人可以删除档案')
  const where = { babyId: baby._id, familyId: baby.familyId }
  await removeDocs(ctx, 'records', where)
  await removeDocs(ctx, 'dailySheets', where)
  await removeDocs(ctx, 'medDoses', where)
  await removeDocs(ctx, 'medications', where)
  await removeDocs(ctx, 'growthMeasures', where)
  await removeDocs(ctx, 'vaccines', where)
  await ctx.db.collection('babies').doc(baby._id).remove()
  const babies = (await babiesOf(ctx)).filter((item) => item._id !== baby._id)
  const nextId = babies[0] ? babies[0]._id : ''
  await ctx.db.collection('familyMembers').doc(ctx.member._id).update({ data: { currentBabyId: nextId } })
  ctx.member.currentBabyId = nextId
  return presentSession(ctx, babies)
}

async function switchBaby(ctx, data) {
  const baby = await ownBaby(ctx, data.babyId)
  await ctx.db.collection('familyMembers').doc(ctx.member._id).update({ data: { currentBabyId: baby._id } })
  ctx.member.currentBabyId = baby._id
  return presentSession(ctx, await babiesOf(ctx))
}

async function createInvite(ctx) {
  requireMember(ctx)
  if (ctx.family.ownerOpenId !== ctx.openid) throw fail('只有创建人可以更换邀请码')
  const inviteCode = await uniqueCode(ctx.db)
  await ctx.db.collection('families').doc(ctx.family._id).update({ data: { inviteCode } })
  ctx.family.inviteCode = inviteCode
  return presentSession(ctx, await babiesOf(ctx))
}

async function joinFamily(ctx, data) {
  requireMember(ctx)
  const inviteCode = text(data.inviteCode, 6)
  if (!/^\d{6}$/.test(inviteCode)) throw fail('请输入 6 位邀请码')
  const found = await ctx.db.collection('families').where({ inviteCode }).limit(1).get()
  if (!found.data.length) throw fail('没有这个邀请码')
  const target = found.data[0]
  if (target._id === ctx.member.familyId) throw fail('你已经在这个家庭里')
  const ownBabies = await babiesOf(ctx)
  if (ownBabies.length) throw fail('这个微信已经有宝宝档案。请把你的邀请码发给家人，让他们加入')
  await ctx.db.collection('familyMembers').doc(ctx.member._id).update({
    data: { familyId: target._id, currentBabyId: '', updatedAt: ctx.now }
  })
  ctx.member.familyId = target._id
  ctx.member.currentBabyId = ''
  ctx.family = target
  const babies = await babiesOf(ctx)
  if (babies[0]) {
    await ctx.db.collection('familyMembers').doc(ctx.member._id).update({ data: { currentBabyId: babies[0]._id } })
    ctx.member.currentBabyId = babies[0]._id
  }
  return presentSession(ctx, babies)
}

async function listMembers(ctx) {
  requireMember(ctx)
  const list = await fetchWhere(ctx.db, 'familyMembers', { familyId: ctx.member.familyId }, 30)
  return {
    list: list.map((item) => ({
      _id: item._id,
      roleName: item.roleName || '家人',
      displayName: item.displayName || '',
      label: memberLabel(item),
      isMe: item.openid === ctx.openid,
      isOwner: item.openid === ctx.family.ownerOpenId
    }))
  }
}

async function removeMember(ctx, data) {
  requireMember(ctx)
  if (ctx.family.ownerOpenId !== ctx.openid) throw fail('只有创建人可以移出家人')
  let target = null
  try {
    target = (await ctx.db.collection('familyMembers').doc(data.memberId).get()).data
  } catch (e) {
    target = null
  }
  if (!target || target.familyId !== ctx.member.familyId) throw fail('找不到这位家人', 'NOT_FOUND')
  if (target.openid === ctx.openid) throw fail('不能移出自己')
  await ctx.db.collection('familyMembers').doc(target._id).remove()
  return { ok: true }
}

async function leaveFamily(ctx) {
  requireMember(ctx)
  if (ctx.family.ownerOpenId === ctx.openid) throw fail('创建人留在这个家庭里。其他家人可以自己退出')
  await ctx.db.collection('familyMembers').doc(ctx.member._id).remove()
  ctx.member = null
  ctx.family = null
  return bootstrap(ctx)
}

async function addQuota(ctx, data) {
  requireMember(ctx)
  const templateId = text(data.templateId, 80)
  if (!templateId) throw fail('还没有配置提醒模板')
  const found = await ctx.db.collection('subscriptions').where({ openid: ctx.openid, templateId }).limit(1).get()
  if (!found.data.length) {
    await ctx.db.collection('subscriptions').add({
      data: { openid: ctx.openid, templateId, remainingQuota: 1, updatedAt: ctx.now }
    })
  } else {
    await ctx.db.collection('subscriptions').doc(found.data[0]._id).update({
      data: { remainingQuota: ctx._.inc(1), updatedAt: ctx.now }
    })
  }
  return { ok: true }
}

const actions = {
  bootstrap,
  updateMember,
  saveBaby,
  deleteBaby,
  switchBaby,
  createInvite,
  joinFamily,
  listMembers,
  removeMember,
  leaveFamily,
  addQuota,
  saveRecord: records.saveRecord,
  deleteRecord: records.deleteRecord,
  getRecord: records.getRecord,
  saveDaily: records.saveDaily,
  saveMedication: meds.saveMedication,
  stopMedication: meds.stopMedication,
  listMedications: meds.listMedications,
  getMedication: meds.getMedication,
  markDose: meds.markDose,
  addAsNeededDose: meds.addAsNeededDose,
  saveGrowth: health.saveGrowth,
  deleteGrowth: health.deleteGrowth,
  listGrowth: health.listGrowth,
  listVaccines: health.listVaccines,
  syncVaccines: health.syncVaccines,
  saveVaccine: health.saveVaccine,
  deleteVaccine: health.deleteVaccine,
  getDay: stats.getDay,
  getRange: stats.getRange,
  exportFile: exporter.exportFile
}

async function handle(action, data, env) {
  if (!actions[action]) throw fail('没有这个操作', 'UNKNOWN')
  await ensureCollections(env.db)
  const member = await loadMember(env.db, env.openid)
  const family = member ? await loadFamily(env.db, member.familyId) : null
  const ctx = {
    db: env.db,
    _: env._,
    cloud: env.cloud,
    openid: env.openid,
    member,
    family,
    now: Date.now()
  }
  return actions[action](ctx, data || {})
}

module.exports = { handle, exportRowsForTest: exporter.exportRows }
