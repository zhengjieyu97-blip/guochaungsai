# “邻里智护”GitHub 与官方文档研究笔记

研究对象：邻里智护——面向完整社区“一老一小”的智能照护与应急协同平台  
研究日期：2026-09-04（维护日期按 GitHub 返回的 UTC 时间理解）  
资料范围：GitHub 官方仓库、README、官方文档、官方发布页，以及 OpenHarmony 官方文档。未使用博客、媒体文章或二手测评作为事实依据。

## 先说结论

GitHub 上暂未发现一个成熟、活跃、同时覆盖“老人 + 儿童 + 社区服务调度 + 物联网告警”的开源成品。此次 GitHub 官方仓库搜索中，elderly care iot、home care caregiver、fall detection open source 等结果的前列多数是个人项目、课程项目或单点算法示例；这只是本次查询样本，不是对 GitHub 全站的统计结论。

- [elderly care iot 仓库搜索](https://github.com/search?q=elderly+care+iot&type=repositories)
- [home care caregiver 仓库搜索](https://github.com/search?q=home+care+caregiver&type=repositories)
- [fall detection open source 仓库搜索](https://github.com/search?q=fall+detection+open+source&type=repositories)

因此，最合理的路线不是寻找一个可以直接换皮的“完整竞品”，而是组合成熟底座，并把真正有竞争力的部分放在“社区照护业务模型、告警升级与闭环处置、老人/儿童差异化交互、隐私和可解释性”上。

## 推荐的技术拼装关系

| 层次 | 可参考项目 | 适合借鉴的内容 | 不应直接照搬 |
|---|---|---|---|
| 照护业务原型 | Haiven | 日常活动基线、状态分级、照护圈、告警升级 | 它面向单个老人家庭，且明确声明不是医疗系统 |
| 家庭自动化 | Home Assistant | 设备/实体/自动化/通知/本地部署 | 它不是社区工单和多角色协同系统 |
| 社区级 IoT 资产 | OpenRemote | 资产、用户角色、租户、规则、协议代理、边缘网关 | AGPL-3.0 与较重的部署复杂度 |
| 设备数据与告警后端 | ThingsBoard | 设备/资产关系、遥测、规则链、告警、仪表盘 | 工业 IoT 语义不能直接当作照护语义 |
| 事件编排 | Node-RED | 可视化事件流、分支、定时、外部服务连接 | 不能替代权限、审计、幂等和工单状态机 |
| 视觉安全证据 | Frigate | 摄像头事件、目标检测、区域、录像留存、MQTT | 不是医疗级跌倒判断，且涉及隐私与算力 |
| 低成本传感器接入 | Zigbee2MQTT | Zigbee 设备接入、设备状态、MQTT 事件 | GPL-3.0、射频稳定性和适配器兼容性 |
| 消息传输 | Mosquitto | MQTT Broker、认证、TLS、持久化 | 只有传输能力，没有照护告警语义 |
| 鸿蒙多端协同 | OpenHarmony DSoftBus | 设备发现、连接、近场通信、RPC/数据传输 | 主要解决设备间通信，不解决社区云端业务 |
| 横向竞品/建模参考 | openHAB | Thing/Channel/Binding/Item/Link 模型和规则框架 | openHAB Core 本身不是完整产品 |

## 1. Haiven：最直接的照护场景参考

### 官方来源

- [GitHub 仓库](https://github.com/hazzap123/haiven)
- [README](https://github.com/hazzap123/haiven/blob/main/README.md)
- [项目文档目录](https://github.com/hazzap123/haiven/tree/main/docs)
- [MIT License](https://github.com/hazzap123/haiven/blob/main/LICENSE)
- [最新提交：重写 bedtime detection](https://github.com/hazzap123/haiven/commit/29b6ab38dda0c9d690755c374c82e5ad342654fc)
- [提交历史](https://github.com/hazzap123/haiven/commits/main/)

### 主要能力

README 描述它是 Home Assistant 上的老人照护监测项目：使用运动/存在传感器跟踪起床、就寝和房间间活动，计算每日活动分数和五级状态，生成面向照护者的早/午/晚摘要，针对未起床、长时间不活动、异常浴室活动等情况告警，并支持照护圈、最近照护者追踪、实时状态面板、活动时间线和周趋势。

它的公开架构很适合做领域建模参考：自动化逻辑、模板传感器、通知脚本、阈值和状态机、照护圈输入、人员与地理区域、Lovelace 面板分别组织。

### 活跃度或最近维护信号

GitHub 官方仓库元数据在 2026-09-04 查询时显示：最近一次代码推送为 2026-03-27，仓库没有可识别的 GitHub 最新 Release；最新提交仍在修正就寝检测逻辑。仓库规模信号较小（查询时 3 stars、1 fork），所以这里把它视为“高相关的个人项目参考”，不是成熟生产底座。

### 可复用模块

- 以“日常行为基线”判断偏离，而不是只靠一个阈值；
- 将状态分成正常、关注、严重等等级，并设置升级路径；
- 把联系人组织成照护圈，告警时按距离或角色通知；
- 将阈值、状态机、通知和展示拆成独立模块；
- 用时间线和趋势图给照护者解释“为什么触发告警”。

### 与邻里智护的差异和风险

- Haiven 主要是单个老人、单个家庭、Home Assistant 配置文件场景，没有儿童接送/离区/监护人授权，也没有社区工作人员、志愿者、物业或服务商的协同工单；
- README 明确声明“不是医疗系统”、是个人项目、无保证，不能替代人工照护；
- 传感器数量和房间假设较强，直接用于社区需要抽象出统一设备模型；
- 其近期提交历史本身暴露了值得提前设计的风险：误报、午夜状态重置、告警升级、多联系人通知和活动数据隐私。此前提交曾修正“活动日志暴露到公共仓库”和“只通知一个联系人”等问题；
- MIT 许可对代码复用较友好，但仍需保留许可和版权信息，并审查依赖。

## 2. Home Assistant：家庭自动化与本地事件底座

### 官方来源

- [GitHub 核心仓库](https://github.com/home-assistant/core)
- [README](https://github.com/home-assistant/core/blob/dev/README.rst)
- [自动化官方文档](https://www.home-assistant.io/docs/automation/)
- [架构文档](https://developers.home-assistant.io/docs/architecture_index/)
- [自定义组件文档](https://developers.home-assistant.io/docs/creating_component_index/)
- [最近提交](https://github.com/home-assistant/core/commit/917fcadd12b8c29be6388abe9d6a8e25c98d375c)
- [最新 Release：2026.9.0](https://github.com/home-assistant/core/releases/tag/2026.9.0)

### 主要能力

README 将它定义为强调本地控制和隐私的开源家庭自动化系统，可运行在 Raspberry Pi 或本地服务器。系统采用模块化方式接入设备或动作。官方自动化文档说明，自动化由触发条件和动作组成，并可以通过可视化编辑器配置；官方开发者文档提供架构和自定义组件入口。

### 活跃度或最近维护信号

2026-09-04 查询时，GitHub 官方元数据显示仓库未归档，最近推送为 2026-09-04，最新提交为 2026-09-03，最新 Release 为 2026.9.0（2026-09-02）。GitHub 仓库元数据报告 Apache-2.0。

### 可复用模块

- 设备、实体、服务和自动化的事件模型；
- 集成适配器模式；
- 本地部署和本地优先的数据处理方式；
- 自动化触发、条件、动作、定时和通知；
- 面板、状态展示和设备控制的交互范式。

### 与邻里智护的差异和风险

- Home Assistant 的核心目标是家庭自动化，不是社区照护、服务派单、响应确认或照护记录；
- 需要在它之上新增老人/儿童档案、监护关系、同意范围、照护圈、事件工单、升级策略和审计日志；
- 设备集成多并不等于照护判断可靠，必须处理传感器离线、重复事件、时间漂移和误报；
- 如果只把 Home Assistant 当作后端，权限、多租户和数据隔离要由邻里智护自己负责；
- 复用核心代码时要核对 Apache-2.0 要求；具体第三方集成和插件的许可不能由核心仓库的许可替代。

## 3. OpenRemote：社区/楼宇级 IoT 资产与多租户参考

### 官方来源

- [GitHub 仓库](https://github.com/openremote/openremote)
- [README](https://github.com/openremote/openremote/blob/master/README.md)
- [官方文档](https://docs.openremote.io/)
- [Manager UI 文档](https://docs.openremote.io/docs/user-guide/manager-ui/)
- [自定义项目文档](https://docs.openremote.io/docs/developer-guide/creating-a-custom-project)
- [最近提交](https://github.com/openremote/openremote/commit/600a9296d1cb4e5bbf9b8635168abfb8d9416f63)
- [最新 Release：1.30.0](https://github.com/openremote/openremote/releases/tag/1.30.0)
- [仓库许可证文件](https://github.com/openremote/openremote/blob/master/LICENSE.txt)

### 主要能力

README 将 OpenRemote 定义为开源 IoT 平台，能力包括设备管理和自动配置、资产类型定制、when-then/flow/JavaScript/Groovy 规则、数据分析、多种协议代理和 MQTT/HTTP/REST/WebSocket 管理接口、多租户 realm、用户和角色、边缘网关、前端组件、控制台以及 Insights 仪表盘构建器。README 还说明持久化数据使用 PostgreSQL。

### 活跃度或最近维护信号

2026-09-04 查询时，仓库未归档，最近推送为 2026-09-03，最新提交为 2026-09-03，最新 Release 为 1.30.0（2026-09-02）。GitHub 仓库元数据的 license 字段为 NOASSERTION，但仓库 LICENSE.txt 明确写明 AGPL-3.0；因此许可证应以仓库许可证文件和具体模块文件为准。

### 可复用模块

- 社区、楼栋、房间、设备和服务点的资产层级；
- realm、用户、角色和权限的多租户思路；
- 规则、协议代理、管理 API 和边缘网关的分层；
- 仪表盘和历史数据的展示方式；
- 将设备侧能力抽象为资产属性，而不是把业务逻辑写死在某种传感器上。

### 与邻里智护的差异和风险

- OpenRemote 是通用 IoT/智能城市平台，未提供老人、儿童、照护圈或社区服务工单的现成语义；
- AGPL-3.0 的复用、修改、部署和分发义务需要老师/学校或项目团队进行许可证评估，不能只看“100% open source”的宣传语；
- Java、Groovy、TypeScript、Gradle、Docker、PostgreSQL 和多协议代理会带来较重的部署和维护成本；
- 如果只需要一个比赛演示原型，完整引入可能过度；可以先借鉴资产/角色/规则模型，再用轻量自研服务实现。

## 4. ThingsBoard：设备遥测、规则链、告警和仪表盘

### 官方来源

- [GitHub 仓库](https://github.com/thingsboard/thingsboard)
- [README](https://github.com/thingsboard/thingsboard/blob/master/README.md)
- [规则引擎官方文档](https://thingsboard.io/docs/user-guide/rule-engine-2-0/re-getting-started/)
- [告警官方文档](https://thingsboard.io/docs/user-guide/alarms/)
- [最近提交](https://github.com/thingsboard/thingsboard/commit/3f2f6a1a0a474bb222e5a983b55b5641452b8777)
- [最新 Release：v4.3.1.4](https://github.com/thingsboard/thingsboard/releases/tag/v4.3.1.4)

### 主要能力

README 将它定义为用于数据采集、处理、可视化和设备管理的开源 IoT 平台。入门流程覆盖设备连接、数据推送、实时仪表盘、Customer 与仪表盘分配、阈值和告警、邮件/SMS/移动端或第三方通知。README 还描述设备和资产管理、实体关系、遥测存储、实时仪表盘、规则链，以及由遥测事件、属性更新、设备不活动和用户动作触发告警。

### 活跃度或最近维护信号

2026-09-04 查询时，仓库未归档，最近推送为 2026-09-03，最新提交为 2026-09-02，最新 Release 为 v4.3.1.4（2026-08-27）。GitHub 仓库元数据报告 Apache-2.0。

### 可复用模块

- 设备、资产、用户/Customer 的关系模型；
- 遥测数据和属性数据的接收、存储和可视化；
- 规则链中的清洗、转换、阈值判断、告警和通知；
- 告警状态、仪表盘和多角色视图的实现参考；
- 设备无关的接入方式，便于把 Zigbee、摄像头、可穿戴设备统一到资产模型。

### 与邻里智护的差异和风险

- ThingsBoard 的中心是 IoT 遥测和设备运维，“告警”不等于经过人工确认的照护事件；
- 需要自定义老人/儿童、监护人、社工、志愿者和服务商之间的关系，以及告警接收、接单、到场、处理、复盘状态；
- 不能把阈值告警包装成医疗诊断或安全保证；
- ThingsBoard 官方站点导航/场景页面展示了 health care/smart assisted living 等入口，但这不能证明社区照护业务已在开源核心中实现；
- 具体发行版、部署模式和可用功能需要按选定版本核查，README 不足以证明所有产品版本边界。

## 5. Node-RED：事件驱动流程编排

### 官方来源

- [GitHub 仓库](https://github.com/node-red/node-red)
- [README](https://github.com/node-red/node-red/blob/main/README.md)
- [用户文档](https://nodered.org/docs/user-guide/)
- [自定义节点文档](https://nodered.org/docs/creating-nodes/)
- [最近提交](https://github.com/node-red/node-red/commit/260402832a64373473009188ac01439534c13b36)
- [最新 Release：5.0.6](https://github.com/node-red/node-red/releases/tag/5.0.6)

### 主要能力

README 将 Node-RED 定义为面向事件驱动应用的低代码编程工具，提供可视化 flow、节点、节点集合和共享流程库，并支持自定义节点与集成。

### 活跃度或最近维护信号

2026-09-04 查询时，仓库未归档，最近推送和最新提交均为 2026-09-01，最新 Release 为 5.0.6（2026-09-01）。README 标明 Apache-2.0。

### 可复用模块

- 把“传感器事件 → 判定 → 通知 → 等待确认 → 升级”画成可解释流程；
- 连接 MQTT、HTTP、数据库和消息通知服务的适配层；
- 定时任务、超时、分支和异常路径的可视化表达；
- 比较适合比赛演示中的规则编排和快速改动。

### 与邻里智护的差异和风险

- Node-RED 是流程编排工具，不是人员档案、权限系统、事件账本或多租户社区平台；
- 不能只依赖 flow 画布保证告警不丢失，必须自研事件 ID、幂等、重试、去重、超时和审计；
- 流程数量增长后会出现版本、测试和维护困难，关键安全逻辑应沉淀为可测试的后端服务；
- 运行时权限、凭据管理和自定义函数节点需要严格隔离，不能把它直接暴露给普通社区用户。

## 6. Frigate：本地摄像头事件与视觉证据

### 官方来源

- [GitHub 仓库](https://github.com/blakeblackshear/frigate)
- [README](https://github.com/blakeblackshear/frigate/blob/dev/README.md)
- [官方文档](https://docs.frigate.video/)
- [Home Assistant 集成文档](https://docs.frigate.video/integrations/home-assistant)
- [目标检测器文档](https://docs.frigate.video/configuration/object_detectors/)
- [最近提交](https://github.com/blakeblackshear/frigate/commit/287fc4240423f624beb62f3e78a4f92132d194d8)
- [最新 Release：v0.17.2](https://github.com/blakeblackshear/frigate/releases/tag/v0.17.2)

### 主要能力

README 将 Frigate 定义为面向 IP 摄像头的本地 NVR 和实时目标检测系统，使用 OpenCV/TensorFlow 在本地检测目标。它与 Home Assistant 有紧密集成，通过 MQTT 与其他系统通信，利用低开销运动检测决定何时运行目标检测，支持基于目标的录像保留和 RTSP 重流。

### 活跃度或最近维护信号

2026-09-04 查询时，仓库未归档，最近推送为 2026-09-04，最新提交为 2026-09-03，最新 Release 为 v0.17.2（2026-06-28）。README 标明 MIT，但同时特别说明 Frigate 名称、品牌和 Logo 是商标，不包含在 MIT 许可中。

### 可复用模块

- 摄像头接入、运动触发、目标检测和事件记录；
- 区域/掩码/摄像头分组等场景配置；
- 录像、快照、事件时间线和 MQTT 事件出口；
- 作为“告警证据”提供短视频或截图，而不是直接给出医疗结论。

### 与邻里智护的差异和风险

- Frigate 解决的是摄像头 NVR 和目标检测，不是老人/儿童照护，也没有社区服务派单；
- 官方文档建议使用 GPU 或 AI 加速器，CPU 检测更适合测试；社区部署的成本和算力差异要单独评估；
- 摄像头涉及家庭和儿童隐私，必须设计最小采集、区域遮罩、留存期限、访问审计和脱敏；
- 目标检测、跌倒判断和人员身份识别存在误报/漏报，不能将单次视觉结果作为唯一的紧急处置依据；
- 使用时要区分 MIT 代码许可、模型/依赖许可和 Frigate 商标限制。

## 7. Zigbee2MQTT：低成本传感器接入层

### 官方来源

- [GitHub 仓库](https://github.com/Koenkk/zigbee2mqtt)
- [README](https://github.com/Koenkk/zigbee2mqtt/blob/master/README.md)
- [官方文档](https://www.zigbee2mqtt.io/)
- [使用与集成文档](https://www.zigbee2mqtt.io/guide/usage/)
- [支持设备列表](https://www.zigbee2mqtt.io/supported-devices/)
- [最近提交](https://github.com/Koenkk/zigbee2mqtt/commit/3c3d8c1a71cabb31f1b97ad268681dd3f747ce19)
- [最新 Release：2.14.1](https://github.com/Koenkk/zigbee2mqtt/releases/tag/2.14.1)

### 主要能力

README 说明 Zigbee2MQTT 允许设备脱离厂商桥接器或网关运行，通过 MQTT 转发事件并控制 Zigbee 设备。其架构包含 Zigbee 适配器通信、设备型号到 Zigbee cluster 的转换，以及 Zigbee 消息到 MQTT 消息的映射；它还保存连接设备和能力状态，并提供网页界面用于监控和配置。

### 活跃度或最近维护信号

2026-09-04 查询时，仓库未归档，最近推送和最新提交均为 2026-09-03，最新 Release 为 2.14.1（2026-09-03）。GitHub 仓库元数据报告 GPL-3.0。

### 可复用模块

- Zigbee 设备发现、配对、设备状态和可用性；
- 统一的传感器事件和控制消息出口；
- 设备型号转换器与支持设备目录；
- MQTT 与 Home Assistant、Node-RED 等系统的连接方式；
- 对老人房间、公共活动室、儿童接送点等位置的传感器接入。

### 与邻里智护的差异和风险

- Zigbee2MQTT 只负责设备桥接，不负责人员关系、告警升级、服务调度或责任确认；
- 需要协调器、适配器和稳定的 Zigbee 网络，墙体、距离、供电和路由设备都会影响可靠性；
- 支持设备列表不等于每个设备都适合照护场景，必须验证离线、低电量、丢包和恢复行为；
- GPL-3.0 代码直接整合进项目发布物时的义务需要做许可证评估；
- 普通运动/存在传感器是生活辅助数据，不是医疗级生命体征或安全保证。

## 8. Eclipse Mosquitto：消息传输层

### 官方来源

- [GitHub 仓库](https://github.com/eclipse-mosquitto/mosquitto)
- [README](https://github.com/eclipse-mosquitto/mosquitto/blob/master/README.md)
- [官方文档](https://mosquitto.org/documentation/)
- [动态安全文档](https://mosquitto.org/documentation/dynamic-security/)
- [最近提交](https://github.com/eclipse-mosquitto/mosquitto/commit/6aaba32614eb1160ddbfeafd616f9f67e7914a41)
- [许可证文件](https://github.com/eclipse-mosquitto/mosquitto/blob/master/LICENSE.txt)

### 主要能力

README 说明 Mosquitto 是 MQTT 5.0、3.1.1 和 3.1 的开源 Broker，同时提供 C/C++ 客户端库和发布、订阅、管理等命令行工具。官方文档覆盖 listener、认证、动态安全、TLS、持久化和客户端 API。

### 活跃度或最近维护信号

2026-09-04 查询时，仓库未归档，最近推送和最新提交均为 2026-09-03；本次官方 API 查询没有返回 GitHub 最新 Release，因此发布信号未知。LICENSE.txt 明确写明项目采用 Eclipse Public License 2.0 或 Eclipse Distribution License 1.0 的双许可表述；具体组件和依赖仍应以许可证文件为准。

### 可复用模块

- 传感器、告警、确认和设备状态的异步消息总线；
- 按主题组织社区、楼栋、房间、设备和事件；
- 认证、TLS、ACL 和动态安全的基础设施；
- Broker 持久化和客户端库，便于与 JavaScript、Python、Java 或 C/C++ 服务连接。

### 与邻里智护的差异和风险

- Mosquitto 只负责消息传输，不知道“跌倒”“接送”“已到场”或“告警已确认”的业务含义；
- 必须定义主题命名、消息版本、事件 ID、保留时长、重放策略、去重和离线补发；
- README 的快速启动方式允许本地匿名访问，但公开部署不能沿用匿名配置；社区场景至少需要认证、TLS、ACL 和审计；
- “消息送达”不等于“责任人收到并处理”，必须由上层照护事件服务维护确认状态。

## 9. OpenHarmony DSoftBus：鸿蒙多设备近场协同

### 官方来源

- [GitHub 仓库](https://github.com/openharmony/communication_dsoftbus)
- [GitHub README](https://github.com/openharmony/communication_dsoftbus/blob/master/README.md)
- [OpenHarmony 官方 DSoftBus 文档](https://gitee.com/openharmony/docs/raw/master/en/readme/dsoftbus.md)
- [最近提交](https://github.com/openharmony/communication_dsoftbus/commit/49010f1af061ad6671be7d302ecede5b56693f6d)

### 主要能力

README 说明 DSoftBus 为 OpenHarmony 提供统一的分布式通信能力，包括设备发现、连接、组网和数据传输，并抽象 WLAN、Bluetooth 等通信方式。官方文档还说明其可用于设备间 RPC，并提供设备状态监听、socket 传输和会话管理。

### 活跃度或最近维护信号

2026-09-04 查询时，仓库未归档，最近推送为 2026-09-03，最新提交为 2026-09-03；本次官方 API 查询没有返回 GitHub 最新 Release，因此发布信号未知。GitHub 仓库元数据报告 Apache-2.0。

### 可复用模块

- 老人端、家属端、社区大屏、门禁/接送终端之间的设备发现；
- 近场数据传输和设备在线/离线状态；
- 通过 RPC 或 socket 共享紧急事件、设备能力和确认结果；
- 在 OpenHarmony 设备上实现“同一事件在多个终端同步呈现”。

### 与邻里智护的差异和风险

- 官方文档约束设备需要在同一 LAN，README 还强调近场范围、设备绑定、权限和会话关闭；
- DSoftBus 是设备通信底座，不是云端社区业务、身份系统、消息推送或工单系统；
- 不能假设社区大屏和家属手机始终在线，必须有云端/服务端兜底和离线重试；
- 会引入 OpenHarmony 平台耦合、权限申请和多设备测试成本；
- 适合做“鸿蒙端协同亮点”，不适合承担整个邻里智护后端。

## 10. openHAB Core：另一种成熟智能家居建模参考

### 官方来源

- [GitHub 仓库](https://github.com/openhab/openhab-core)
- [README](https://github.com/openhab/openhab-core/blob/main/README.md)
- [官方概念文档](https://www.openhab.org/docs/concepts/)
- [最近提交](https://github.com/openhab/openhab-core/commit/c02dbc1f710d585e71bc5f94319c09f0960bf44f)
- [许可证文件](https://github.com/openhab/openhab-core/blob/main/LICENSE)

### 主要能力

README 明确说明 openHAB Core 包含 openHAB 运行时的核心 bundles，但 Core 本身不是产品，而是供完整 openHAB distribution 使用的框架。官方概念文档把系统拆成 Thing、Channel、Binding、Item 和 Link：Thing 可代表物理设备或其他可管理资源，Binding 负责把设备能力接入系统，Item 表示应用或自动化可以使用的能力。

### 活跃度或最近维护信号

2026-09-04 查询时，仓库未归档，最近推送和最新提交均为 2026-09-01；本次官方 API 查询没有返回 Core 仓库的 GitHub 最新 Release。仓库 LICENSE 为 Eclipse Public License 2.0。

### 可复用模块

- “设备能力”和“业务可用能力”分离的领域建模；
- Thing/Channel/Binding/Item/Link 的抽象，可用于定义传感器、房间、事件和服务；
- 规则和设备适配器的分层方式；
- 让同一能力可以被多个界面或自动化复用。

### 与邻里智护的差异和风险

- 需要额外使用完整 distribution 和 add-ons，Core 单独不能直接组成邻里智护；
- openHAB 的语义仍偏智能家居，不含社区照护档案、工单、告警接单和儿童监护；
- OSGi、Java、Maven 和 add-on 体系对学生团队有一定学习与维护成本；
- EPL-2.0 的复用和分发要求需要按实际集成方式评估；
- 更适合借鉴其领域模型，而不是把整个 Core 当作邻里智护后端。

## 直接场景项目的补充观察

本次搜索还看到 [abhi-4/Elderly-Care](https://github.com/abhi-4/Elderly-Care)，其官方仓库描述为基于 Arduino、XBee、智能穿戴和智能家居设备的老人监测与紧急报告系统；GitHub 官方元数据显示其最近一次代码推送为 2018-09-30。由于公开维护信号较旧，且场景更像早期硬件原型，本笔记不把它列为可直接复用的技术底座，只把它当作“穿戴设备 + 家庭传感器 + 应急报告”这一早期方案的对照。

## 对邻里智护的实际启示

1. MVP 不要一开始做“全社区智慧养老平台”。优先做一条可以演示、可以测量、可以闭环的链路：传感器事件 → 风险判定 → 分级告警 → 家属/社区人员接单 → 处理结果回写 → 复盘趋势。
2. 老人和儿童要使用不同事件模型。老人重点是活动异常、跌倒疑似、离床/夜间异常、服药提醒；儿童重点是接送确认、越界、未到校/未回家、临时托管和紧急联系人。
3. 技术上可以采用“Zigbee2MQTT + Mosquitto + 自研事件服务 + Web/移动端”，再按需要接入 Frigate；Home Assistant、ThingsBoard、Node-RED 和 OpenRemote 更适合做原型验证或参考模块。
4. 比赛的差异化不要放在“我们也能采集传感器数据”，而要放在：告警置信度、可解释原因、多人协同、超时升级、处置闭环、隐私分级和低门槛交互。
5. 对比赛原型，建议把摄像头设为可选证据源，把毫米波/运动/门磁/定位等低侵入传感器作为主线；任何疑似跌倒或异常都应显示为“需要人工确认”，不要宣称医疗诊断或绝对安全。
6. 许可证必须在代码落地前确认：Haiven MIT、Home Assistant/ThingsBoard/Node-RED/DSoftBus 的仓库元数据或 README 信息、OpenRemote 的 AGPL-3.0、Zigbee2MQTT 的 GPL-3.0，以及 Mosquitto 的双许可文件不能混为一谈。

## 研究限制

- 本笔记只记录已从官方仓库、README、官方文档或官方发布信息中确认的内容；
- GitHub stars、issues 和更新时间是活动信号，不代表质量、可靠性或适合生产；
- 没有把“有医疗、养老、社区”等关键词的仓库自动当成竞品，低维护或缺乏可验证文档的项目被排除；
- 对告警准确率、跌倒识别率、误报率、部署成本和合规性，官方资料没有给出可直接迁移到邻里智护的统一结论，均应在自己的原型中重新实测。
