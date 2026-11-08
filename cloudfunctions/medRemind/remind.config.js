function clip(value, max) {
  const text = String(value || '').trim()
  return text ? text.slice(0, max) : '用药提醒'
}

module.exports = {
  // 在微信公众平台选用「用药提醒」一类模板后，把模板 ID 填到这里，并与 miniprogram/config.js 保持一致。
  templateId: 'AAy4ahEnq8Z0p-ZGEkkHlcQ1GVn_mB-TLXDZ-lLqBZ4',
  // 开发版联调改成 developer，体验版改成 trial，正式版用 formal。
  miniprogramState: 'formal',
  buildData({ text, timeText }) {
    return {
      thing1: { value: clip(text, 20) },
      time2: { value: timeText },
      thing3: { value: '请按家里的医嘱服用' }
    }
  }
}
