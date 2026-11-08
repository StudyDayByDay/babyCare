const { ownBaby } = require('./auth')
const { timeKey } = require('./date')
const { collectRange } = require('./stats')
const { describeRecord, typeName, describeDaily, doseStatus } = require('./describe')
const { workbook } = require('./zip')

function exportRows(baby, collected, startDay, endDay) {
  const info = [
    ['宝宝', baby.nickname || ''],
    ['出生日', baby.birthday || ''],
    ['区间', startDay + ' 至 ' + endDay],
    ['说明', '家庭自己记的账，供就诊时参考，不是诊断。']
  ]
  const summary = info.concat([[], ['日期', '喂养次数', '亲喂分钟', '配方毫升', '瓶喂母乳毫升', '尿布次数', '小便次数', '大便次数', '大便情况', '睡眠分钟', '用药已吃', '用药应吃']])
  collected.days.forEach((day) => {
    summary.push([
      day.day, day.feedCount, day.breastMin, day.formulaMl, day.bottleBreastMl,
      day.diaperCount, day.peeCount, day.poopCount, (day.poopBits || []).join('、'),
      day.sleepMin, day.medTaken, day.medTotal
    ])
  })
  const detail = [['日期', '时间', '类型', '内容', '记录人']]
  collected.records.forEach((rec) => {
    detail.push([rec.day, timeKey(rec.happenedAt), typeName(rec.type), describeRecord(rec), rec.memberName || ''])
  })
  collected.sheets.forEach((sheet) => {
    const text = describeDaily(sheet)
    if (text) detail.push([sheet.day, '', '护理补剂', text, sheet.memberName || ''])
  })
  const medRows = [['日期', '时间', '药名', '计划剂量', '状态', '实际剂量', '备注', '记录人']]
  collected.medLines.forEach((line) => {
    medRows.push([line.day, line.time, line.name, line.planText, doseStatus(line.status), line.actualText, line.note, line.memberName])
  })
  return [
    { name: '每日汇总', rows: summary },
    { name: '日常明细', rows: detail },
    { name: '用药', rows: medRows }
  ]
}

function growthSheet(list) {
  const rows = [['日期', '体重克', '身长厘米', '头围厘米', '备注']]
  list.forEach((item) => rows.push([item.day, item.weightG || '', item.heightCm || '', item.headCm || '', item.note || '']))
  return rows
}

function vaccineSheet(list) {
  const rows = [['名称', '应核对日期', '状态', '实际日期', '备注']]
  list.forEach((item) => rows.push([
    item.name,
    item.dueDay,
    item.status === 'done' ? '已接种' : (item.status === 'skipped' ? '不做了' : '待核对'),
    item.doneDay || '',
    item.note || ''
  ]))
  return rows
}

async function exportFileFull(ctx, data) {
  const baby = await ownBaby(ctx, data.babyId)
  const collected = await collectRange(ctx, baby, data.startDay, data.endDay)
  const { fetchWhere } = require('./query')
  const growth = await fetchWhere(ctx.db, 'growthMeasures', { babyId: baby._id, familyId: baby.familyId })
  const vaccines = await fetchWhere(ctx.db, 'vaccines', { babyId: baby._id, familyId: baby.familyId })
  growth.sort((a, b) => (a.day > b.day ? 1 : -1))
  vaccines.sort((a, b) => (a.dueDay > b.dueDay ? 1 : -1))
  const sheets = exportRows(baby, collected, data.startDay, data.endDay)
  sheets.push({ name: '生长', rows: growthSheet(growth) })
  sheets.push({ name: '疫苗', rows: vaccineSheet(vaccines) })
  const buffer = workbook(sheets)
  const fileName = (baby.nickname || '宝宝') + '-' + data.startDay + '-' + data.endDay + '.xlsx'
  const uploaded = await ctx.cloud.uploadFile({
    cloudPath: 'exports/' + baby.familyId + '/' + Date.now() + '.xlsx',
    fileContent: buffer
  })
  return { fileID: uploaded.fileID, fileName }
}

module.exports = { exportRows, exportFile: exportFileFull }
