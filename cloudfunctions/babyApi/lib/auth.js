function fail(message, code) {
  const err = new Error(message)
  err.code = code || 'BAD_INPUT'
  return err
}

function text(value, max) {
  return String(value == null ? '' : value).trim().slice(0, max)
}

function num(value, min, max) {
  let n = Number(value)
  if (!isFinite(n)) n = min
  if (n < min) n = min
  if (n > max) n = max
  return Math.round(n * 100) / 100
}

function oneOf(value, list, fallback) {
  return list.indexOf(value) >= 0 ? value : fallback
}

function clean(obj) {
  const out = {}
  Object.keys(obj).forEach((key) => {
    if (obj[key] !== undefined) out[key] = obj[key]
  })
  return out
}

function requireMember(ctx) {
  if (!ctx.member || !ctx.family) throw fail('请先打开小程序，建立家庭', 'NO_MEMBER')
  return ctx.member
}

async function ownBaby(ctx, babyId) {
  requireMember(ctx)
  if (!babyId) throw fail('还没有宝宝档案', 'NO_BABY')
  let baby = null
  try {
    baby = (await ctx.db.collection('babies').doc(babyId).get()).data
  } catch (e) {
    baby = null
  }
  if (!baby || baby.familyId !== ctx.member.familyId) throw fail('找不到宝宝档案', 'NOT_FOUND')
  return baby
}

function memberLabel(member) {
  if (!member) return ''
  return member.displayName || member.roleName || '家人'
}

module.exports = { fail, text, num, oneOf, clean, requireMember, ownBaby, memberLabel }
