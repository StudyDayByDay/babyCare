const { durationText } = require('./date.js')

function statusText(status) {
  if (status === 'taken') return '已吃'
  if (status === 'skipped') return '没吃'
  return '待吃'
}

function buildVisitText(baby, range) {
  const lines = []
  lines.push((baby.nickname || '宝宝') + ' 成长记录')
  lines.push(range.startDay + ' 至 ' + range.endDay)
  lines.push('以下是家里自己记的账，给就诊时参考，不是诊断。')
  lines.push('')
  ;(range.days || []).forEach((day) => {
    lines.push(day.day)
    lines.push('喂养 ' + day.feedCount + ' 次，亲喂 ' + day.breastMin + ' 分钟，配方 ' + day.formulaMl + ' 毫升，瓶喂母乳 ' + day.bottleBreastMl + ' 毫升')
    const poop = day.poopBits && day.poopBits.length ? '（' + day.poopBits.join('、') + '）' : ''
    lines.push('尿布 ' + day.diaperCount + ' 次，小便 ' + day.peeCount + ' 次，大便 ' + day.poopCount + ' 次' + poop)
    lines.push('睡眠 ' + durationText(day.sleepMin) + '，用药 ' + day.medTaken + '/' + day.medTotal)
    lines.push('')
  })
  if (range.medLines && range.medLines.length) {
    lines.push('用药明细')
    range.medLines.forEach((line) => {
      lines.push(line.day + ' ' + line.time + ' ' + line.name + ' ' + line.planText + ' ' + statusText(line.status) + (line.note ? ' ' + line.note : ''))
    })
  }
  return lines.join('\n')
}

function milkView(summary) {
  const bottle = Number(summary.formulaMl || 0) + Number(summary.bottleBreastMl || 0)
  const breast = Number(summary.breastMin || 0)
  if (bottle && breast) return { num: bottle + '毫升', sub: '亲喂 ' + breast + ' 分钟' }
  if (bottle) return { num: bottle + '毫升', sub: '瓶喂合计' }
  if (breast) return { num: breast + '分钟', sub: '亲喂时长' }
  return { num: '0', sub: '还没记喂奶' }
}

function groupDoses(doses) {
  const groups = []
  ;(doses || []).forEach((dose) => {
    let group = null
    groups.forEach((item) => {
      if (item.time === dose.slotTime) group = item
    })
    if (!group) {
      group = { time: dose.slotTime, items: [], pending: false, done: true }
      groups.push(group)
    }
    group.items.push(Object.assign({ statusText: statusText(dose.status) }, dose))
    if (dose.status === 'pending') group.pending = true
    if (dose.status !== 'taken') group.done = false
  })
  let nextGroup = null
  groups.forEach((group) => {
    if (!nextGroup && group.pending) nextGroup = group
  })
  return { groups, nextGroup }
}

module.exports = { statusText, buildVisitText, milkView, groupDoses }
