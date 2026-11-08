function describeDaily(sheet) {
  if (!sheet) return ''
  const bits = []
  const careMap = { face: '洗脸', nose: '鼻腔', hands: '洗手', nails: '剪指甲', bath: '洗澡', moisture: '保湿' }
  const eduMap = { visual: '视觉', auditory: '听觉', gross: '大动作', fine: '精细' }
  Object.keys(careMap).forEach((key) => {
    if (sheet.care && sheet.care[key]) bits.push(careMap[key])
  })
  Object.keys(eduMap).forEach((key) => {
    if (sheet.earlyEdu && sheet.earlyEdu[key]) bits.push(eduMap[key])
  })
  if (sheet.supplements && sheet.supplements.vd) bits.push('维生素D')
  if (sheet.supplements && sheet.supplements.ad) bits.push('AD')
  if (sheet.mood) bits.push(sheet.mood)
  return bits.join('、')
}

module.exports = { describeDaily }
