# 宝宝记录

给家里记喂养、尿布、睡眠、护理、用药和儿保数据的微信小程序。只记录、提醒和导出，不算剂量，也不判断正不正常。

后端是微信云开发。小程序不直接读写数据库，一律走云函数 `babyApi`，并校验当前用户是不是这个家庭的成员。

## 第一次运行

1. 用微信开发者工具打开本项目，开通云开发。
2. 上传并部署云函数 `babyApi`、`medRemind`，选择云端安装依赖。
3. 第一次打开小程序时，`babyApi` 会创建这些集合：`families`、`familyMembers`、`babies`、`records`、`dailySheets`、`medications`、`medDoses`、`subscriptions`、`growthMeasures`、`vaccines`。
4. 在云开发控制台把以上集合的权限改成「所有用户不可读写」。云函数不受这个规则限制，这样别人改不了小程序去直接读孩子的数据。
5. 数据变多之后，建议加索引：`familyMembers.openid`，`families.inviteCode`，`records` / `dailySheets` / `medDoses` 的 `babyId + day`。

`miniprogram/config.js` 的 `envId` 可以留空，开发者工具会用当前选中的云环境。

## 吃药提醒

小程序关着的时候不能像闹钟那样自己响。到点提醒走微信订阅消息，用户每点一次「允许」才能发一条。同一分钟要吃的几种药会合成一条，省次数。

没配置模板时，用药记录和今天的清单仍然可用，只是不会推到服务通知。

1. 在微信公众平台给小程序选一个「用药提醒」类模板，字段用 `thing1`、`time2`、`thing3`。若模板字段不同，改 `cloudfunctions/medRemind/remind.config.js` 里的 `buildData`。
2. 把模板 ID 填到 `miniprogram/config.js` 和 `cloudfunctions/medRemind/remind.config.js`。
3. 上传 `medRemind`。它带每 5 分钟一次的定时触发器。
4. 开发阶段把 `miniprogramState` 改成 `developer`，体验版用 `trial`，上线用 `formal`。

一天 3 次、吃 7 天，大约需要 21 次授权。打开小程序时点「允许吃药提醒」可以继续攒次数。

## 导出

「我的 → 导出打印」可以复制近 7 天或 30 天的文字，或生成 xlsx。表格在微信里打开后转发到电脑再打印。
