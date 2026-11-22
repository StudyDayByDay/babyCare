const { durationText, timeKey } = require('./date.js')
const { iconFor, toneFor } = require('./stage.js')

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

function agoText(ts, now) {
  const min = Math.max(0, Math.round((Number(now) - Number(ts)) / 60000))
  if (min < 1) return '刚刚'
  if (min < 60) return min + '分钟前'
  const h = Math.floor(min / 60)
  const m = min % 60
  if (!m) return h + '小时前'
  return h + '小时' + m + '分前'
}

function sinceList(records, now) {
  const latest = {}
  ;(records || []).forEach((rec) => {
    let ts = rec.happenedAt
    if (rec.type === 'sleep' && rec.payload && rec.payload.endAt) ts = rec.payload.endAt
    if (!latest[rec.type] || ts > latest[rec.type].ts) latest[rec.type] = { ts, rec }
  })
  const rows = []
  if (latest.feed) {
    rows.push({
      label: '上次喂奶',
      text: agoText(latest.feed.ts, now),
      icon: 'feed',
      tone: 'feed',
      type: 'feed',
      id: latest.feed.rec._id,
      canRepeat: true
    })
  }
  if (latest.diaper) {
    rows.push({
      label: '上次换尿布',
      text: agoText(latest.diaper.ts, now),
      icon: 'diaper',
      tone: 'diaper',
      type: 'diaper',
      id: latest.diaper.rec._id,
      canRepeat: true
    })
  }
  if (latest.sleep) {
    rows.push({
      label: '上次睡醒',
      text: agoText(latest.sleep.ts, now),
      icon: 'sleep',
      tone: 'sleep',
      type: 'sleep',
      canRepeat: false
    })
  }
  return rows
}

function ledgerRows(records, doses) {
  const rows = []
  ;(records || []).forEach((item) => {
    rows.push({
      key: 'rec-' + item._id,
      kind: 'record',
      sortAt: item.happenedAt || 0,
      timeText: timeKey(item.happenedAt),
      icon: iconFor(item.type),
      tone: toneFor(item.type),
      text: item.text,
      memberName: item.memberName || '',
      id: item._id,
      type: item.type
    })
  })
  ;(doses || []).forEach((dose) => {
    rows.push({
      key: 'dose-' + dose._id,
      kind: 'dose',
      sortAt: dose.planAt || 0,
      timeText: dose.slotTime || timeKey(dose.planAt),
      icon: 'med',
      tone: 'med',
      text: (dose.name || '用药') + ' ' + (dose.planDoseText || ''),
      memberName: statusText(dose.status),
      id: dose._id,
      type: ''
    })
  })
  rows.sort((a, b) => b.sortAt - a.sortAt)
  return rows
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

module.exports = { statusText, buildVisitText, milkView, groupDoses, sinceList, agoText, ledgerRows }
