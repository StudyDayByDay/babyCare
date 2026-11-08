function stageLabel(stage) {
  return {
    newborn: '新生儿',
    infant: '满月到半岁',
    solid: '添加辅食',
    toddler: '1 到 3 岁',
    preschool: '3 到 6 岁'
  }[stage] || ''
}

function recordActions(stage) {
  return [
    { key: 'feed', title: '喂奶', hint: '母乳和配方一起记', tone: 'feed', icon: 'feed', show: stage !== 'preschool' },
    { key: 'diaper', title: '尿布', hint: '尿和便可以一起', tone: 'diaper', icon: 'diaper', show: stage !== 'preschool' },
    { key: 'sleep', title: '睡眠', hint: '起止和头朝向', tone: 'sleep', icon: 'sleep', show: true },
    { key: 'daily', title: '护理', hint: '补剂、清洁、早教', tone: 'care', icon: 'care', show: true },
    { key: 'temp', title: '体温', hint: '测到多少记多少', tone: 'temp', icon: 'temp', show: true },
    { key: 'solid', title: stage === 'solid' ? '辅食' : '用餐', hint: '吃了什么', tone: 'solid', icon: 'meal', show: stage === 'solid' || stage === 'toddler' || stage === 'preschool' },
    { key: 'milestone', title: '里程碑', hint: '只留纪念，不是评估', tone: 'mile', icon: 'mile', show: true },
    { key: 'note', title: '生病就医', hint: '症状和医生原话', tone: 'note', icon: 'note', show: true },
    { key: 'med', title: '用药', hint: '一天几次、一次几颗', tone: 'med', icon: 'med', show: true }
  ].filter((item) => item.show)
}

function hiddenCareActions(stage) {
  if (stage !== 'preschool') return []
  return [
    { key: 'feed', title: '喂奶', hint: '需要时再记', tone: 'feed', icon: 'feed' },
    { key: 'diaper', title: '尿布', hint: '需要时再记', tone: 'diaper', icon: 'diaper' }
  ]
}

function milestones(stage) {
  return {
    newborn: ['会注视人脸', '对声音有反应', '握住手指'],
    infant: ['社会性微笑', '抬头', '翻身', '俯卧更久'],
    solid: ['独坐', '爬', '扶站', '咿呀学语', '出牙'],
    toddler: ['独走', '叫爸爸或妈妈', '会说单个词', '自己用勺子'],
    preschool: ['上幼儿园', '说完整句子', '自己吃饭', '认识颜色']
  }[stage] || []
}

function showEarlyEdu(stage) {
  return stage === 'newborn' || stage === 'infant' || stage === 'solid'
}

function showNewbornCare(dayNo) {
  return dayNo > 0 && dayNo <= 42
}

function iconFor(type) {
  return {
    feed: 'feed',
    diaper: 'diaper',
    sleep: 'sleep',
    temp: 'temp',
    solid: 'meal',
    milestone: 'mile',
    note: 'note'
  }[type] || 'note'
}

module.exports = { stageLabel, recordActions, hiddenCareActions, milestones, showEarlyEdu, showNewbornCare, iconFor }
