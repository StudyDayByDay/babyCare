const { timeKey } = require('./date')
const { doseLabel } = require('./medPlan')
const { simpleByKey, describeSimple } = require('./recordTypes')

function describeRecord(rec) {
  const p = rec.payload || {}
  if (rec.type === 'feed') {
    const bits = []
    if (p.leftMin) bits.push('左' + p.leftMin + '分钟')
    if (p.rightMin) bits.push('右' + p.rightMin + '分钟')
    if (p.bottleBreastMl) bits.push('瓶喂母乳' + p.bottleBreastMl + '毫升')
    if (p.formulaMl) bits.push('配方' + p.formulaMl + '毫升')
    if (!bits.length) bits.push('喂奶')
    if (p.spit && p.spit !== '无') bits.push('吐奶' + p.spit)
    if (p.note) bits.push(p.note)
    return bits.join('，')
  }
  if (rec.type === 'diaper') {
    const bits = []
    if (p.pee) bits.push('小便')
    if (p.poop) bits.push('大便' + (p.color || '') + (p.texture || '') + (p.amount ? '，量' + p.amount : ''))
    if (!bits.length) bits.push('尿布')
    if (p.note) bits.push(p.note)
    return bits.join('，')
  }
  if (rec.type === 'sleep') {
    const bits = ['睡了' + (p.durationMin || 0) + '分钟']
    if (p.direction) bits.push('头朝' + p.direction)
    if (p.note) bits.push(p.note)
    return bits.join('，')
  }
  const simple = simpleByKey(rec.type)
  if (simple) return describeSimple(simple, p)
  if (rec.type === 'solid') {
    const bits = [p.name || '用餐']
    if (p.texture) bits.push(p.texture)
    if (p.amountText) bits.push(p.amountText)
    if (p.isNew) bits.push('新食物')
    if (p.reaction && p.reaction !== '未填') bits.push(p.reaction)
    if (p.note) bits.push(p.note)
    return bits.join('，')
  }
  if (rec.type === 'milestone') return '里程碑：' + (p.name || '')
  if (rec.type === 'note') return (p.category || '备注') + '：' + (p.text || '')
  return rec.type || '记录'
}

function typeName(type) {
  const simple = simpleByKey(type)
  if (simple) return simple.title
  return {
    feed: '喂养',
    diaper: '尿布',
    sleep: '睡眠',
    solid: '用餐',
    milestone: '里程碑',
    note: '备注'
  }[type] || '记录'
}

function describeDaily(sheet) {
  if (!sheet) return ''
  const bits = []
  const careMap = { face: '洗脸', nose: '鼻腔', hands: '洗手', nails: '剪指甲', bath: '洗澡', moisture: '保湿' }
  const eduMap = { visual: '视觉', auditory: '听觉', gross: '大动作', fine: '精细动作' }
  Object.keys(careMap).forEach((key) => { if (sheet.care && sheet.care[key]) bits.push(careMap[key]) })
  Object.keys(eduMap).forEach((key) => { if (sheet.earlyEdu && sheet.earlyEdu[key]) bits.push(eduMap[key]) })
  if (sheet.supplements) {
    if (sheet.supplements.vd) bits.push('维生素D')
    if (sheet.supplements.ad) bits.push('AD')
    const custom = sheet.supplements.custom || {}
    Object.keys(custom).forEach((name) => { if (custom[name]) bits.push(name) })
  }
  if (sheet.jaundice) bits.push('黄疸' + sheet.jaundice)
  if (sheet.umbilical) bits.push('脐带' + sheet.umbilical)
  if (sheet.tummyMin) bits.push('俯卧' + sheet.tummyMin + '分钟')
  if (sheet.mood) bits.push('精神' + sheet.mood)
  if (sheet.weather) bits.push(sheet.weather)
  if (sheet.note) bits.push(sheet.note)
  return bits.join('，')
}

function doseStatus(status) {
  if (status === 'taken') return '已吃'
  if (status === 'skipped') return '没吃'
  return '待吃'
}

function describeDose(dose) {
  const plan = doseLabel(dose.doseAmount, dose.doseUnit)
  const actual = dose.status === 'taken'
    ? doseLabel(dose.actualAmount != null ? dose.actualAmount : dose.doseAmount, dose.doseUnit)
    : ''
  return {
    time: dose.slotTime || timeKey(dose.planAt),
    plan,
    actual,
    status: doseStatus(dose.status)
  }
}

module.exports = { describeRecord, typeName, describeDaily, doseStatus, describeDose }
