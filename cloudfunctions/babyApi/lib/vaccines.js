const { addMonths } = require('./date')

const SCHEDULE = [
  { key: 'bcg', name: '卡介苗', months: 0 },
  { key: 'hepb-1', name: '乙肝疫苗 第1剂', months: 0 },
  { key: 'hepb-2', name: '乙肝疫苗 第2剂', months: 1 },
  { key: 'ipv-1', name: '脊灰灭活疫苗 第1剂', months: 2 },
  { key: 'dtap-1', name: '百白破疫苗 第1剂', months: 2 },
  { key: 'ipv-2', name: '脊灰灭活疫苗 第2剂', months: 3 },
  { key: 'bopv-1', name: '脊灰减毒活疫苗 第1剂', months: 4 },
  { key: 'dtap-2', name: '百白破疫苗 第2剂', months: 4 },
  { key: 'hepb-3', name: '乙肝疫苗 第3剂', months: 6 },
  { key: 'dtap-3', name: '百白破疫苗 第3剂', months: 6 },
  { key: 'mpsv-a-1', name: 'A群流脑多糖疫苗 第1剂', months: 6 },
  { key: 'mmr-1', name: '麻腮风疫苗 第1剂', months: 8 },
  { key: 'je-1', name: '乙脑减毒活疫苗 第1剂', months: 8 },
  { key: 'mpsv-a-2', name: 'A群流脑多糖疫苗 第2剂', months: 9 },
  { key: 'mmr-2', name: '麻腮风疫苗 第2剂', months: 18 },
  { key: 'dtap-4', name: '百白破疫苗 第4剂', months: 18 },
  { key: 'hepa', name: '甲肝减毒活疫苗', months: 18 },
  { key: 'je-2', name: '乙脑减毒活疫苗 第2剂', months: 24 },
  { key: 'mpsv-ac-1', name: 'A群C群流脑多糖疫苗 第1剂', months: 36 },
  { key: 'bopv-2', name: '脊灰减毒活疫苗 第2剂', months: 48 },
  { key: 'dtap-5', name: '百白破疫苗 第5剂', months: 72 },
  { key: 'mpsv-ac-2', name: 'A群C群流脑多糖疫苗 第2剂', months: 72 }
]

function dueDays(birthday) {
  return SCHEDULE.map((item) => ({
    scheduleKey: item.key,
    name: item.name,
    dueDay: addMonths(birthday, item.months),
    source: 'schedule',
    status: 'pending'
  }))
}

module.exports = { SCHEDULE, dueDays }
