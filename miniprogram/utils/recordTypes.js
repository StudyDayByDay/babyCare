// 简单记录项的唯一目录。
// 喂奶、尿布、睡眠、用餐、里程碑、生病就医仍是各自的表单。
// 新增「一个数字，再加几个选项」时，只改这一份，然后运行：
//   node scripts/sync-record-types.js
// 小程序和云函数各有一份拷贝，上传后才能用到。不要只改其中一份。

const SIMPLE = [
  {
    key: 'temp',
    title: '体温',
    hint: '测到多少记多少',
    formTitle: '记体温',
    formHint: '只记测到的数字，不判断正不正常。',
    tone: 'temp',
    icon: 'temp',
    stages: [],
    fields: [
      {
        kind: 'stepper',
        key: 'celsius',
        label: '体温',
        unit: '℃',
        min: 34,
        max: 42,
        step: 0.1,
        fallback: 36.5,
        presets: [36.5, 37, 37.5, 38],
        headline: true
      }
    ]
  },
  {
    key: 'jaundice',
    title: '黄疸',
    hint: '照仪器上的数字记',
    formTitle: '记黄疸',
    formHint: '照仪器上的数字和单位记，不判断高不高。',
    tone: 'jaundice',
    icon: 'jaundice',
    stages: ['newborn', 'infant'],
    unitSwitch: { unitKey: 'unit', valueKey: 'value', umol: 'μmol/L', mg: 'mg/dL', factor: 17.1 },
    fields: [
      {
        kind: 'chips',
        key: 'unit',
        label: '仪器上的单位',
        options: ['μmol/L', 'mg/dL'],
        fallback: 'μmol/L'
      },
      {
        kind: 'stepper',
        key: 'value',
        label: '仪器上的数字',
        unitKey: 'unit',
        headline: true,
        positive: true,
        emptyMessage: '记下仪器上的数字',
        ranges: {
          'μmol/L': { min: 0, max: 500, step: 1, unit: 'μmol/L', fallback: 0, presets: [50, 100, 150, 200] },
          'mg/dL': { min: 0, max: 30, step: 0.1, unit: 'mg/dL', fallback: 0, presets: [5, 8, 12, 15] }
        }
      },
      {
        kind: 'chips',
        key: 'site',
        label: '测的位置，可不选',
        options: ['额头', '胸口', '腹部'],
        fallback: '',
        optional: true
      },
      {
        kind: 'text',
        key: 'note',
        label: '备注',
        placeholder: '可不填',
        max: 80,
        fallback: ''
      }
    ]
  }
]

function simpleByKey(key) {
  for (let i = 0; i < SIMPLE.length; i += 1) {
    if (SIMPLE[i].key === key) return SIMPLE[i]
  }
  return null
}

function simpleKeys() {
  return SIMPLE.map((item) => item.key)
}

function listSimple(stage) {
  return SIMPLE.filter((item) => !item.stages.length || item.stages.indexOf(stage) >= 0)
}

function rangeFor(field, values) {
  if (!field.ranges) return field
  const unit = values[field.unitKey]
  return field.ranges[unit] || field.ranges['μmol/L'] || field
}

function defaultValues(spec) {
  const values = {}
  spec.fields.forEach((field) => {
    if (field.kind === 'stepper' && field.ranges) {
      values[field.key] = rangeFor(field, values).fallback
      return
    }
    values[field.key] = field.fallback
  })
  return values
}

function viewOf(spec, values) {
  const src = values || defaultValues(spec)
  return {
    formHint: spec.formHint,
    fields: spec.fields.map((field) => {
      if (field.kind === 'stepper') {
        const range = rangeFor(field, src)
        return {
          kind: 'stepper',
          key: field.key,
          label: field.label,
          headline: !!field.headline,
          min: range.min,
          max: range.max,
          step: range.step,
          unit: range.unit || field.unit || '',
          presetText: (range.presets || []).join(',')
        }
      }
      if (field.kind === 'chips') {
        return {
          kind: 'chips',
          key: field.key,
          label: field.label,
          options: field.options,
          optional: !!field.optional
        }
      }
      return {
        kind: 'text',
        key: field.key,
        label: field.label,
        placeholder: field.placeholder || '',
        max: field.max || 80
      }
    })
  }
}

function convertUnit(value, from, to, sw) {
  const n = Number(value) || 0
  if (!n || from === to) return n
  if (from === sw.mg && to === sw.umol) return Math.round(n * sw.factor)
  if (from === sw.umol && to === sw.mg) return Math.round((n / sw.factor) * 10) / 10
  return n
}

function clampToRange(spec, values) {
  const next = Object.assign({}, values)
  spec.fields.forEach((field) => {
    if (field.kind !== 'stepper') return
    const range = rangeFor(field, next)
    let n = Number(next[field.key])
    if (!isFinite(n)) n = range.fallback
    if (n < range.min) n = range.min
    if (n > range.max) n = range.max
    next[field.key] = Math.round(n * 100) / 100
  })
  return next
}

function clientIssue(spec, values) {
  const src = values || {}
  for (let i = 0; i < spec.fields.length; i += 1) {
    const field = spec.fields[i]
    if (field.kind === 'stepper' && field.positive && !(Number(src[field.key]) > 0)) {
      return field.emptyMessage || '记下数字'
    }
    if (field.kind === 'text' && field.required && !String(src[field.key] || '').trim()) {
      return field.emptyMessage || '请填写'
    }
  }
  return ''
}

function payloadOf(spec, values) {
  const src = values || {}
  const out = {}
  spec.fields.forEach((field) => {
    if (field.kind === 'stepper') out[field.key] = Number(src[field.key])
    else out[field.key] = src[field.key] == null ? field.fallback : src[field.key]
  })
  return out
}

function badInput(message) {
  const err = new Error(message)
  err.code = 'BAD_INPUT'
  return err
}

function sanitizeSimple(spec, src, deps) {
  const num = deps.num
  const text = deps.text
  const oneOf = deps.oneOf
  const input = src || {}
  const out = {}
  spec.fields.forEach((field) => {
    if (field.kind === 'chips') {
      out[field.key] = oneOf(input[field.key], field.options, field.fallback)
      return
    }
    if (field.kind === 'text') {
      out[field.key] = text(input[field.key], field.max || 80)
      if (field.required && !out[field.key]) throw badInput(field.emptyMessage || '请填写')
      return
    }
    if (field.kind === 'stepper') {
      const range = rangeFor(field, out)
      const n = num(input[field.key], range.min, range.max)
      if (field.positive && !(n > 0)) throw badInput(field.emptyMessage || '记下数字')
      out[field.key] = n
    }
  })
  return out
}

function trimNum(n) {
  const x = Math.round(Number(n) * 100) / 100
  if (!isFinite(x)) return '0'
  return String(x)
}

function describeSimple(spec, payload) {
  const p = payload || {}
  let head = spec.title
  const bits = []
  spec.fields.forEach((field) => {
    if (field.kind === 'stepper') {
      const unit = field.ranges ? (p[field.unitKey] || '') : (field.unit || '')
      head = spec.title + trimNum(p[field.key]) + unit
    }
  })
  bits.push(head)
  spec.fields.forEach((field) => {
    if (field.kind === 'chips' && field.key !== 'unit' && p[field.key]) bits.push(p[field.key])
    if (field.kind === 'text' && p[field.key]) bits.push(p[field.key])
  })
  return bits.join('，')
}

module.exports = {
  SIMPLE,
  simpleByKey,
  simpleKeys,
  listSimple,
  defaultValues,
  viewOf,
  convertUnit,
  clampToRange,
  clientIssue,
  payloadOf,
  sanitizeSimple,
  describeSimple
}
