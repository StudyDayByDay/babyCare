function call(action, data) {
  return new Promise((resolve, reject) => {
    wx.cloud.callFunction({
      name: 'babyApi',
      data: { action, data: data || {} },
      success(res) {
        const result = res.result
        if (!result || result.ok !== true) {
          reject(new Error((result && result.message) || '没有完成'))
          return
        }
        resolve(result.data)
      },
      fail(err) {
        const msg = (err && err.errMsg) || ''
        if (msg.indexOf('FUNCTION_NOT_FOUND') >= 0 || msg.indexOf('-501000') >= 0) {
          reject(new Error('云函数 babyApi 还没上传'))
        } else if (msg.indexOf('Environment not found') >= 0 || msg.indexOf('-601034') >= 0) {
          reject(new Error('云环境还没准备好。请在开发者工具开通云开发，并上传云函数'))
        } else {
          reject(new Error('云服务没有连上'))
        }
      }
    })
  })
}

module.exports = {
  bootstrap: () => call('bootstrap'),
  updateMember: (data) => call('updateMember', data),
  saveBaby: (data) => call('saveBaby', data),
  deleteBaby: (data) => call('deleteBaby', data),
  switchBaby: (data) => call('switchBaby', data),
  createInvite: () => call('createInvite'),
  joinFamily: (data) => call('joinFamily', data),
  listMembers: () => call('listMembers'),
  removeMember: (data) => call('removeMember', data),
  leaveFamily: () => call('leaveFamily'),
  addQuota: (data) => call('addQuota', data),
  saveRecord: (data) => call('saveRecord', data),
  deleteRecord: (data) => call('deleteRecord', data),
  getRecord: (data) => call('getRecord', data),
  saveDaily: (data) => call('saveDaily', data),
  getDay: (data) => call('getDay', data),
  getRange: (data) => call('getRange', data),
  saveMedication: (data) => call('saveMedication', data),
  stopMedication: (data) => call('stopMedication', data),
  listMedications: (data) => call('listMedications', data),
  getMedication: (data) => call('getMedication', data),
  markDose: (data) => call('markDose', data),
  addAsNeededDose: (data) => call('addAsNeededDose', data),
  saveGrowth: (data) => call('saveGrowth', data),
  deleteGrowth: (data) => call('deleteGrowth', data),
  listGrowth: (data) => call('listGrowth', data),
  listVaccines: (data) => call('listVaccines', data),
  syncVaccines: (data) => call('syncVaccines', data),
  saveVaccine: (data) => call('saveVaccine', data),
  exportFile: (data) => call('exportFile', data)
}
