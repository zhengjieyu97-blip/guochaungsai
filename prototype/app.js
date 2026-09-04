(function () {
  "use strict";

  var STORAGE_KEY = "neighbor-care-prototype-v3";

  var roles = {
    FAMILY: { label: "家属/监护人", userId: "U-FAMILY-LC", avatar: "李", avatarClass: "avatar-amber" },
    COMMUNITY_WORKER: { label: "社区工作人员", userId: "U-CW-ZM", avatar: "赵", avatarClass: "avatar-teal" },
    RESPONDER: { label: "社区响应人", userId: "U-RESP-ZS", avatar: "张", avatarClass: "avatar-blue" },
    ADMIN: { label: "社区管理员", userId: "U-ADMIN", avatar: "管", avatarClass: "avatar-purple" }
  };

  var pageTitles = {
    events: "事件中心",
    people: "照护对象",
    simulator: "模拟事件台",
    dashboard: "社区看板"
  };

  var riskMeta = {
    P0: { label: "紧急", className: "p0" },
    P1: { label: "高风险", className: "p1" },
    P2: { label: "一般", className: "p2" }
  };

  var statusMeta = {
    PENDING: { label: "待处理", className: "pending" },
    ASSIGNED: { label: "已派单", className: "assigned" },
    IN_PROGRESS: { label: "处理中", className: "in-progress" },
    WAITING_CONFIRM: { label: "待确认", className: "waiting-confirm" },
    CLOSED: { label: "已关闭", className: "closed" },
    CANCELLED: { label: "已取消", className: "cancelled" }
  };

  var eventTypeMeta = {
    ELDER_MISSED_CHECKIN: {
      label: "老人长时间未签到",
      shortLabel: "未签到",
      icon: "clock-3",
      color: "amber",
      baseLevel: "P1",
      minLevel: "P1",
      baseScore: 60
    },
    ELDER_HELP: {
      label: "老人主动求助",
      shortLabel: "老人求助",
      icon: "hand-heart",
      color: "teal",
      baseLevel: "P1",
      minLevel: "P1",
      baseScore: 60
    },
    ELDER_SUSPECTED_FALL: {
      label: "疑似老人跌倒或突发异常",
      shortLabel: "疑似异常",
      icon: "triangle-alert",
      color: "red",
      baseLevel: "P1",
      minLevel: "P1",
      baseScore: 60
    },
    CHILD_PICKUP_TIMEOUT: {
      label: "儿童接送未确认",
      shortLabel: "接送未确认",
      icon: "bus-front",
      color: "blue",
      baseLevel: "P1",
      minLevel: "P1",
      baseScore: 60
    },
    CHILD_CARE_CHECKIN_ABNORMAL: {
      label: "儿童托管签到异常",
      shortLabel: "托管异常",
      icon: "clipboard-x",
      color: "blue",
      baseLevel: "P1",
      minLevel: "P1",
      baseScore: 60
    },
    CHILD_HELP: {
      label: "儿童主动求助",
      shortLabel: "儿童求助",
      icon: "life-buoy",
      color: "red",
      baseLevel: "P0",
      minLevel: "P0",
      baseScore: 90
    }
  };

  var actionMeta = {
    CALL: "电话联系",
    ARRIVE_CHECK: "到场查看",
    ASSIST_SERVICE: "协助服务",
    CONTACT_GUARDIAN: "联系家属/监护人",
    FALSE_REPORT: "误报说明",
    OTHER: "其他"
  };

  var ui = {
    view: "events",
    drawerMode: null,
    activeEventId: null,
    activeSubjectId: null,
    notificationsOpen: false,
    filters: {
      search: "",
      status: "ALL",
      risk: "ALL",
      subjectType: "ALL",
      type: "ALL",
      assignee: "ALL"
    }
  };

  function h(parts) {
    return parts.join("");
  }

  // Keep the icon language local so the prototype stays portable and every action uses the same stroke system.
  var iconPaths = {
    "activity": "<path d='M3 12h4l3-9 4 18 3-9h4'></path>",
    "arrow-right": "<path d='M5 12h14'></path><path d='m13 6 6 6-6 6'></path>",
    "arrow-up-right": "<path d='M7 17 17 7'></path><path d='M7 7h10v10'></path>",
    "bell": "<path d='M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9'></path><path d='M10 21h4'></path>",
    "bus-front": "<path d='M4 16V5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v11'></path><path d='M4 11h16'></path><path d='M6 16v3'></path><path d='M18 16v3'></path><path d='M7 19h10'></path><path d='M7 7h4'></path><path d='M13 7h4'></path><circle cx='7.5' cy='14.5' r='1'></circle><circle cx='16.5' cy='14.5' r='1'></circle>",
    "chart-no-axes-combined": "<path d='M12 16v5'></path><path d='M16 14v7'></path><path d='M20 10v11'></path><path d='M4 4v17'></path><path d='M4 4h16'></path><path d='m4 14 4-4 4 3 4-6 4 3'></path>",
    "check": "<path d='m5 12 4 4L19 6'></path>",
    "clipboard-check": "<rect width='14' height='17' x='5' y='4' rx='2'></rect><path d='M9 4.5V3h6v1.5'></path><path d='m9 12 2 2 4-4'></path>",
    "clipboard-list": "<rect width='14' height='17' x='5' y='4' rx='2'></rect><path d='M9 4.5V3h6v1.5'></path><path d='M9 10h6'></path><path d='M9 14h4'></path>",
    "clipboard-x": "<rect width='14' height='17' x='5' y='4' rx='2'></rect><path d='M9 4.5V3h6v1.5'></path><path d='m10 10 4 4'></path><path d='m14 10-4 4'></path>",
    "clock-3": "<circle cx='12' cy='12' r='9'></circle><path d='M12 7v5l3 2'></path>",
    "heart-hand": "<path d='M11.2 20.2a2.2 2.2 0 0 1-3.1 0L3 15.1a2.8 2.8 0 0 1 4-4l.7.7.7-.7a2.8 2.8 0 0 1 4 0l.5.5'></path><path d='m14 13 1.3-1.3a2.1 2.1 0 0 1 3 3L13 20'></path><path d='m9 13 1.6 1.6a2 2 0 0 0 2.8 0l3.8-3.8'></path><path d='M13 8.5 14.4 7a2.8 2.8 0 0 1 4 4l-4.1 4.1'></path>",
    "hand-heart": "<path d='M11.5 20.5 4 13a3.2 3.2 0 0 1 4.5-4.5l3 3 3-3A3.2 3.2 0 0 1 19 13l-7.5 7.5Z'></path><path d='M12 11.5c.8-1.1 2.8-.4 2.8.9 0 1.4-2.8 2.8-2.8 2.8s-2.8-1.4-2.8-2.8c0-1.3 2-2 2.8-.9Z'></path>",
    "layout-dashboard": "<rect width='7' height='9' x='3' y='3' rx='1'></rect><rect width='7' height='5' x='14' y='3' rx='1'></rect><rect width='7' height='9' x='14' y='12' rx='1'></rect><rect width='7' height='5' x='3' y='16' rx='1'></rect>",
    "life-buoy": "<circle cx='12' cy='12' r='9'></circle><circle cx='12' cy='12' r='3'></circle><path d='m4.9 4.9 4.2 4.2'></path><path d='m14.9 14.9 4.2 4.2'></path><path d='m14.9 9.1 4.2-4.2'></path><path d='m4.9 19.1 4.2-4.2'></path>",
    "plus": "<path d='M12 5v14'></path><path d='M5 12h14'></path>",
    "refresh-cw": "<path d='M21 12a9 9 0 0 0-15.3-6.4L3 8'></path><path d='M3 3v5h5'></path><path d='M3 12a9 9 0 0 0 15.3 6.4L21 16'></path><path d='M16 16h5v5'></path>",
    "rotate-ccw": "<path d='M3 12a9 9 0 1 0 3-6.7L3 8'></path><path d='M3 3v5h5'></path>",
    "search-x": "<circle cx='11' cy='11' r='7'></circle><path d='m20 20-4-4'></path><path d='m8.5 8.5 5 5'></path><path d='m13.5 8.5-5 5'></path>",
    "triangle-alert": "<path d='m21.7 18-8.2-14a1.7 1.7 0 0 0-3 0L4.3 18a1.7 1.7 0 0 0 1.5 2.5h14.4a1.7 1.7 0 0 0 1.5-2.5Z'></path><path d='M12 9v4'></path><path d='M12 17h.01'></path>",
    "users-round": "<path d='M18 21a8 8 0 0 0-12 0'></path><circle cx='12' cy='7' r='4'></circle><path d='M22 20a6 6 0 0 0-3-5.2'></path><path d='M19 3.2a4 4 0 0 1 0 7.6'></path>",
    "wand-sparkles": "<path d='m15 4-1 1'></path><path d='m18 7 1-1'></path><path d='m14 10-1 1'></path><path d='m5 5 14 14'></path><path d='m3 21 6-6'></path><path d='M17 3v4'></path><path d='M19 5h-4'></path><path d='M5 3v4'></path><path d='M7 5H3'></path>",
    "x": "<path d='M18 6 6 18'></path><path d='m6 6 12 12'></path>"
  };

  function icon(name, className) {
    var paths = iconPaths[name] || iconPaths.activity;
    return "<svg class='icon" + (className ? " " + className : "") + "' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round' aria-hidden='true' focusable='false'>" + paths + "</svg>";
  }

  function hydrateIcons() {
    document.querySelectorAll("[data-icon]").forEach(function (node) {
      node.innerHTML = icon(node.getAttribute("data-icon"));
      node.removeAttribute("data-icon");
    });
  }

  function nowIso(offsetMinutes) {
    return new Date(Date.now() + (offsetMinutes || 0) * 60000).toISOString();
  }

  function pad(value) {
    return String(value).padStart(2, "0");
  }

  function eventNumber() {
    var date = new Date();
    var suffix = String(Date.now()).slice(-3);
    return "CARE-" + String(date.getFullYear()).slice(-2) + pad(date.getMonth() + 1) + pad(date.getDate()) + "-" + suffix;
  }

  function timeline(time, tone, title, body, actor) {
    return {
      time: time,
      tone: tone || "teal",
      title: title,
      body: body,
      actor: actor || "系统"
    };
  }

  function seedState() {
    return {
      currentRole: "COMMUNITY_WORKER",
      currentUserId: "U-CW-ZM",
      users: [
        { id: "U-FAMILY-LC", name: "李晨", role: "FAMILY", title: "家属", phoneMasked: "139****1208", subjectIds: ["SUBJECT-001"] },
        { id: "U-FAMILY-CL", name: "陈琳", role: "FAMILY", title: "监护人", phoneMasked: "138****6712", subjectIds: ["SUBJECT-003"] },
        { id: "U-CW-ZM", name: "赵敏", role: "COMMUNITY_WORKER", title: "社区工作人员", phoneMasked: "136****8802", subjectIds: [] },
        { id: "U-RESP-ZS", name: "张师傅", role: "RESPONDER", title: "社区响应人", phoneMasked: "137****4586", subjectIds: [] },
        { id: "U-RESP-ZL", name: "赵老师", role: "RESPONDER", title: "接送响应人", phoneMasked: "135****9031", subjectIds: ["SUBJECT-003"] },
        { id: "U-ADMIN", name: "社区管理员", role: "ADMIN", title: "演示管理员", phoneMasked: "138****0000", subjectIds: [] }
      ],
      subjects: [
        {
          id: "SUBJECT-001",
          name: "李秀梅",
          type: "ELDER",
          age: 78,
          gender: "女",
          household: "宁安里 · 2 栋",
          location: "2 栋 2 单元",
          phoneMasked: "138****2481",
          riskTags: ["独居", "高龄"],
          lastCheckInAt: nowIso(-137),
          checkInPlan: "每日 08:00 / 18:00",
          contactIds: ["U-FAMILY-LC"],
          careNote: "家属优先确认；超时后由社区工作人员介入",
          pickupPlan: "不适用"
        },
        {
          id: "SUBJECT-002",
          name: "王建国",
          type: "ELDER",
          age: 82,
          gender: "男",
          household: "宁安里 · 5 栋",
          location: "5 栋 1 单元",
          phoneMasked: "139****5346",
          riskTags: ["高龄"],
          lastCheckInAt: nowIso(-47),
          checkInPlan: "每日 09:00 / 19:00",
          contactIds: ["U-FAMILY-LC"],
          careNote: "已登记助餐服务偏好",
          pickupPlan: "不适用"
        },
        {
          id: "SUBJECT-003",
          name: "陈小雨",
          type: "CHILD",
          age: 8,
          gender: "女",
          household: "宁安里 · 8 栋",
          location: "8 栋 3 单元",
          phoneMasked: "137****6110",
          riskTags: ["接送授权已备案"],
          lastCheckInAt: nowIso(-24),
          checkInPlan: "托管点每日签到",
          contactIds: ["U-FAMILY-CL", "U-RESP-ZL"],
          careNote: "监护人陈琳；接送授权人赵老师",
          pickupPlan: "工作日 17:40 前完成接送确认"
        },
        {
          id: "SUBJECT-004",
          name: "周子涵",
          type: "CHILD",
          age: 6,
          gender: "男",
          household: "宁安里 · 6 栋",
          location: "6 栋 2 单元",
          phoneMasked: "136****7422",
          riskTags: ["托管中"],
          lastCheckInAt: nowIso(-70),
          checkInPlan: "托管点每日签到",
          contactIds: ["U-FAMILY-CL"],
          careNote: "托管点：阳光托管班",
          pickupPlan: "工作日 18:00 前完成接送确认"
        }
      ],
      events: [
        {
          id: "EVENT-001",
          eventNo: "CARE-260904-001",
          subjectId: "SUBJECT-001",
          eventType: "ELDER_MISSED_CHECKIN",
          source: "SIMULATOR",
          riskLevel: "P1",
          riskScore: 75,
          riskReasons: [
            { label: "老人长时间未签到", delta: 60 },
            { label: "独居", delta: 10 },
            { label: "高龄", delta: 10 },
            { label: "已有家属确认链", delta: -5 }
          ],
          status: "ASSIGNED",
          description: "李秀梅已连续 4 小时未提交平安签到，系统建议先由家属确认当前平安。",
          occurredAt: nowIso(-11),
          createdAt: nowIso(-8),
          firstResponseDueAt: nowIso(2),
          escalationDueAt: nowIso(7),
          currentAssigneeId: "U-FAMILY-LC",
          escalationLevel: 0,
          overdue: false,
          closedAt: null,
          closedBy: null,
          closeReason: null,
          timeline: [
            timeline(nowIso(-8), "blue", "事件创建", "收到模拟签到异常，生成照护事件 CARE-260904-001。", "系统"),
            timeline(nowIso(-8), "amber", "完成风险分级", "风险分：75，当前等级为 P1 高风险。", "系统"),
            timeline(nowIso(-7), "teal", "已通知家属", "已通知家属李晨，等待确认当前平安。", "系统")
          ]
        },
        {
          id: "EVENT-002",
          eventNo: "CARE-260904-002",
          subjectId: "SUBJECT-003",
          eventType: "CHILD_PICKUP_TIMEOUT",
          source: "MANUAL",
          riskLevel: "P1",
          riskScore: 65,
          riskReasons: [
            { label: "儿童接送未确认", delta: 60 },
            { label: "已超过约定接送时间", delta: 5 }
          ],
          status: "ASSIGNED",
          description: "约定接送时间已过，托管点仍未收到监护人接送确认。",
          occurredAt: nowIso(-28),
          createdAt: nowIso(-25),
          firstResponseDueAt: nowIso(-20),
          escalationDueAt: nowIso(-15),
          currentAssigneeId: "U-CW-ZM",
          escalationLevel: 1,
          overdue: true,
          closedAt: null,
          closedBy: null,
          closeReason: null,
          timeline: [
            timeline(nowIso(-25), "blue", "事件创建", "托管点创建儿童接送未确认事件。", "林老师"),
            timeline(nowIso(-24), "amber", "已通知监护人", "已通知监护人陈琳与托管响应人赵老师。", "系统"),
            timeline(nowIso(-15), "red", "响应超时，已升级", "监护人未在首次响应时限内确认，事件升级至社区工作人员赵敏。", "系统")
          ]
        },
        {
          id: "EVENT-003",
          eventNo: "CARE-260904-003",
          subjectId: "SUBJECT-002",
          eventType: "ELDER_HELP",
          source: "MANUAL",
          riskLevel: "P2",
          riskScore: 30,
          riskReasons: [
            { label: "普通助餐需求", delta: 30 }
          ],
          status: "CLOSED",
          description: "已登记今日助餐需求，社区服务资源完成协助。",
          occurredAt: nowIso(-178),
          createdAt: nowIso(-174),
          firstResponseDueAt: nowIso(-144),
          escalationDueAt: nowIso(-84),
          currentAssigneeId: "U-RESP-ZS",
          escalationLevel: 0,
          overdue: false,
          acceptedAt: nowIso(-160),
          closedAt: nowIso(-136),
          closedBy: "U-FAMILY-LC",
          closeReason: "家属确认服务已完成",
          timeline: [
            timeline(nowIso(-174), "blue", "事件创建", "提交普通助餐需求。", "李晨"),
            timeline(nowIso(-166), "teal", "已接单", "社区响应人张师傅已接单。", "张师傅"),
            timeline(nowIso(-151), "teal", "完成协助服务", "已将晚餐送至 5 栋，现场确认无其他需求。", "张师傅"),
            timeline(nowIso(-136), "purple", "家属确认关闭", "家属李晨确认服务已完成，事件关闭。", "李晨")
          ]
        }
      ],
      notifications: [
        {
          id: "NOTICE-001",
          recipientId: "U-CW-ZM",
          eventId: "EVENT-002",
          type: "ESCALATION",
          title: "儿童接送事件已升级",
          content: "CARE-260904-002 未在首次响应时限内确认，请及时接单。",
          createdAt: nowIso(-13),
          readAt: null
        },
        {
          id: "NOTICE-002",
          recipientId: "U-FAMILY-LC",
          eventId: "EVENT-001",
          type: "EVENT",
          title: "请确认李秀梅当前平安",
          content: "李秀梅已连续 4 小时未签到，请确认当前状态。",
          createdAt: nowIso(-7),
          readAt: null
        },
        {
          id: "NOTICE-003",
          recipientId: "U-FAMILY-CL",
          eventId: "EVENT-002",
          type: "EVENT",
          title: "儿童接送尚未确认",
          content: "陈小雨的约定接送时间已过，请尽快确认。",
          createdAt: nowIso(-24),
          readAt: nowIso(-23)
        }
      ]
    };
  }

  function loadState() {
    try {
      var saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) {
        var parsed = JSON.parse(saved);
        if (parsed && Array.isArray(parsed.events) && Array.isArray(parsed.subjects) && Array.isArray(parsed.users)) {
          return parsed;
        }
      }
    } catch (error) {
      return seedState();
    }
    return seedState();
  }

  var state = loadState();

  function saveState() {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      showToast("浏览器未能保存本地演示数据。", "warning");
    }
  }

  function getUser(id) {
    return state.users.find(function (user) {
      return user.id === id;
    }) || { id: "", name: "待分配", role: "", title: "" };
  }

  function getSubject(id) {
    return state.subjects.find(function (subject) {
      return subject.id === id;
    });
  }

  function getEvent(id) {
    return state.events.find(function (event) {
      return event.id === id;
    });
  }

  function currentUser() {
    return getUser(state.currentUserId);
  }

  function isManager() {
    return state.currentRole === "COMMUNITY_WORKER" || state.currentRole === "ADMIN";
  }

  function isFamilyOf(subjectId) {
    return currentUser().subjectIds && currentUser().subjectIds.indexOf(subjectId) !== -1;
  }

  function visibleEvents() {
    if (isManager()) {
      return state.events.slice();
    }
    if (state.currentRole === "FAMILY") {
      return state.events.filter(function (event) {
        return isFamilyOf(event.subjectId) || event.currentAssigneeId === state.currentUserId;
      });
    }
    return state.events.filter(function (event) {
      return event.currentAssigneeId === state.currentUserId;
    });
  }

  function visibleSubjects() {
    if (isManager()) {
      return state.subjects.slice();
    }
    var ids = currentUser().subjectIds || [];
    if (state.currentRole === "FAMILY") {
      return state.subjects.filter(function (subject) {
        return ids.indexOf(subject.id) !== -1;
      });
    }
    var assignedIds = visibleEvents().map(function (event) {
      return event.subjectId;
    });
    return state.subjects.filter(function (subject) {
      return assignedIds.indexOf(subject.id) !== -1;
    });
  }

  function visibleNotifications() {
    if (state.currentRole === "ADMIN") {
      return state.notifications.slice();
    }
    return state.notifications.filter(function (notice) {
      return notice.recipientId === state.currentUserId;
    });
  }

  function riskRank(level) {
    return level === "P0" ? 3 : level === "P1" ? 2 : 1;
  }

  function riskFromScore(score, minimum) {
    var level = score >= 80 ? "P0" : score >= 50 ? "P1" : "P2";
    if (riskRank(level) < riskRank(minimum)) {
      return minimum;
    }
    return level;
  }

  function isOverdue(event) {
    if (event.overdue) {
      return true;
    }
    if (event.status === "ASSIGNED" && event.firstResponseDueAt) {
      return new Date(event.firstResponseDueAt).getTime() < Date.now();
    }
    return false;
  }

  function formatDateTime(value) {
    if (!value) {
      return "-";
    }
    var date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }
    return date.toLocaleString("zh-CN", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    });
  }

  function formatTime(value) {
    if (!value) {
      return "-";
    }
    var date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }
    return date.toLocaleTimeString("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    });
  }

  function formatDue(event) {
    if (event.status === "CLOSED" || event.status === "CANCELLED") {
      return "已结束";
    }
    if (event.status === "WAITING_CONFIRM") {
      return "等待确认";
    }
    if (isOverdue(event)) {
      return "已超时";
    }
    var due = new Date(event.firstResponseDueAt).getTime();
    var minutes = Math.max(1, Math.ceil((due - Date.now()) / 60000));
    return "剩余 " + minutes + " 分钟";
  }

  function formatDueSubtext(event) {
    if (event.escalationLevel > 0) {
      return "已升级 " + event.escalationLevel + " 次";
    }
    if (event.status === "IN_PROGRESS") {
      return "首次接单已完成";
    }
    return "首次响应时限";
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function riskBadge(level, score) {
    var meta = riskMeta[level] || riskMeta.P2;
    return h([
      "<span class='risk-badge " + meta.className + "'><b>" + escapeHtml(level) + "</b><span>" + escapeHtml(meta.label) + "</span></span>",
      score == null ? "" : "<span class='risk-score'>" + escapeHtml(score) + " 分</span>"
    ]);
  }

  function statusBadge(status) {
    var meta = statusMeta[status] || statusMeta.PENDING;
    return "<span class='status-badge " + meta.className + "'>" + escapeHtml(meta.label) + "</span>";
  }

  function subjectTypeBadge(subject) {
    if (!subject) {
      return "";
    }
    var isElder = subject.type === "ELDER";
    return "<span class='subject-type " + (isElder ? "elder" : "child") + "'>" + (isElder ? "老人" : "儿童") + "</span>";
  }

  function tagList(tags) {
    return h((tags || []).map(function (tag, index) {
      return "<span class='tag " + (index === 0 ? "highlight" : "") + "'>" + escapeHtml(tag) + "</span>";
    }));
  }

  function renderMetric(iconName, label, value, note, color) {
    return h([
      "<div class='metric-card'>",
      "<div class='metric-copy'>",
      "<span class='metric-label'>" + escapeHtml(label) + "</span>",
      "<strong class='metric-value'>" + escapeHtml(value) + "</strong>",
      "<span class='metric-note'>" + escapeHtml(note) + "</span>",
      "</div>",
      "<span class='metric-icon " + color + "' aria-hidden='true'>" + icon(iconName) + "</span>",
      "</div>"
    ]);
  }

  function openEventsCount(events) {
    return events.filter(function (event) {
      return event.status !== "CLOSED" && event.status !== "CANCELLED";
    }).length;
  }

  function getFilteredEvents() {
    var search = ui.filters.search.trim().toLowerCase();
    return visibleEvents().filter(function (event) {
      var subject = getSubject(event.subjectId);
      var typeMatch = ui.filters.type === "ALL" || event.eventType === ui.filters.type;
      var riskMatch = ui.filters.risk === "ALL" || event.riskLevel === ui.filters.risk;
      var statusMatch = ui.filters.status === "ALL" || event.status === ui.filters.status;
      var subjectTypeMatch = ui.filters.subjectType === "ALL" || (subject && subject.type === ui.filters.subjectType);
      var assigneeMatch = ui.filters.assignee === "ALL" || event.currentAssigneeId === ui.filters.assignee;
      var searchMatch = !search || [
        event.eventNo,
        event.description,
        subject ? subject.name : "",
        eventTypeMeta[event.eventType] ? eventTypeMeta[event.eventType].label : ""
      ].join(" ").toLowerCase().indexOf(search) !== -1;
      return typeMatch && riskMatch && statusMatch && subjectTypeMatch && assigneeMatch && searchMatch;
    }).sort(function (a, b) {
      if (a.status === "CLOSED" && b.status !== "CLOSED") {
        return 1;
      }
      if (a.status !== "CLOSED" && b.status === "CLOSED") {
        return -1;
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }

  function renderEventRows(events) {
    if (!events.length) {
      return "<div class='empty-state'><div><div class='empty-symbol'>" + icon("search-x") + "</div><strong>暂时没有匹配事件</strong><span>调整筛选条件，或从模拟事件台创建一条新的照护事件。</span></div></div>";
    }
    return h(events.map(function (event) {
      var subject = getSubject(event.subjectId);
      var meta = eventTypeMeta[event.eventType];
      var assignee = getUser(event.currentAssigneeId);
      var overdue = isOverdue(event);
      var actions = "";
      if (event.status === "ASSIGNED" && canAcceptEvent(event)) {
        actions += "<button class='small-button primary' type='button' data-accept-event='" + event.id + "'>" + icon("check", "button-icon") + "接单</button>";
      }
      if (event.status !== "CLOSED" && event.status !== "CANCELLED") {
        actions += "<button class='small-button warning' type='button' data-timeout-event='" + event.id + "' title='直接生成一条超时升级记录'>" + icon("arrow-up-right", "button-icon") + "超时</button>";
      }
      actions += "<button class='small-button' type='button' data-open-event='" + event.id + "'>详情 " + icon("arrow-right", "button-icon") + "</button>";
      return h([
        "<div class='table-row event-row' data-open-event='" + event.id + "'>",
        "<div class='cell event-main' data-label='事件'>",
        "<span class='event-symbol " + meta.color + "'>" + icon(meta.icon) + "</span>",
        "<div class='cell-stack'><span class='cell-primary'>" + escapeHtml(meta.label) + "</span><span class='cell-secondary'>" + escapeHtml(event.eventNo) + "</span></div>",
        "</div>",
        "<div class='cell' data-label='照护对象'><div class='cell-stack'><span class='cell-primary'>" + escapeHtml(subject ? subject.name : "未知对象") + "</span><span class='cell-secondary'>" + (subject ? escapeHtml(subject.age + " 岁 · " + (subject.type === "ELDER" ? "老人" : "儿童")) : "-") + "</span></div></div>",
        "<div class='cell' data-label='对象类型'>" + subjectTypeBadge(subject) + "</div>",
        "<div class='cell' data-label='风险'>" + riskBadge(event.riskLevel, event.riskScore) + "</div>",
        "<div class='cell' data-label='状态'>" + statusBadge(event.status) + "</div>",
        "<div class='cell' data-label='当前责任人'><div class='cell-stack'><span class='cell-primary'>" + escapeHtml(assignee.name) + "</span><span class='cell-secondary'>" + escapeHtml(assignee.title || "待分配") + "</span></div></div>",
        "<div class='cell' data-label='响应状态'><div class='sla-text " + (overdue ? "overdue" : "") + "'><strong>" + escapeHtml(formatDue(event)) + "</strong><span>" + escapeHtml(formatDueSubtext(event)) + "</span></div></div>",
        "<div class='cell row-actions' data-label='操作'>" + actions + "</div>",
        "</div>"
      ]);
    }));
  }

  function renderEvents() {
    var events = visibleEvents();
    var filtered = getFilteredEvents();
    var pending = events.filter(function (event) {
      return event.status === "PENDING" || event.status === "ASSIGNED";
    }).length;
    var inProgress = events.filter(function (event) {
      return event.status === "IN_PROGRESS" || event.status === "WAITING_CONFIRM";
    }).length;
    var overdue = events.filter(isOverdue).length;
    var closedToday = events.filter(function (event) {
      return event.status === "CLOSED" && event.closedAt && new Date(event.closedAt).toDateString() === new Date().toDateString();
    }).length;

    return h([
      "<div class='page-heading'>",
      "<div class='page-heading-copy'><div class='eyebrow'>事件闭环</div><h2>社区事件中心</h2><p>把每一次需要关注的异常，交给合适的人并跟踪到确认关闭。</p></div>",
      "<div class='heading-actions'><button class='button button-secondary' type='button' data-view='simulator'>" + icon("wand-sparkles", "button-icon") + "模拟事件台</button><button class='button button-primary' type='button' data-create-event>" + icon("plus", "button-icon") + "创建照护事件</button></div>",
      "</div>",
      "<div class='metric-grid'>",
      renderMetric("clipboard-list", "待处理", pending, "等待接单或确认", "amber"),
      renderMetric("activity", "处理中", inProgress, "已有人开始处置", "teal"),
      renderMetric("arrow-up-right", "已超时", overdue, "需要关注升级链", "red"),
      renderMetric("check", "今日已关闭", closedToday, "保留完整时间线", "blue"),
      "</div>",
      "<section class='section-panel'>",
      "<div class='panel-header'><div class='panel-heading'><span class='panel-title'>照护事件</span><span class='panel-subtitle'>优先关注 P0 / P1 和已经进入升级链的事件</span></div><span class='panel-count'>共 " + filtered.length + " 条</span></div>",
      "<div class='filter-bar'>",
      "<label class='field'><span class='field-label'>搜索事件或照护对象</span><input class='input' id='eventSearch' value='" + escapeHtml(ui.filters.search) + "' placeholder='姓名、事件编号或事件类型'></label>",
      "<label class='field'><span class='field-label'>状态</span><select class='select' id='eventStatusFilter'><option value='ALL'>全部状态</option>" + filterOptions(statusMeta, ui.filters.status) + "</select></label>",
      "<label class='field'><span class='field-label'>风险等级</span><select class='select' id='eventRiskFilter'><option value='ALL'>全部等级</option>" + filterOptions(riskMeta, ui.filters.risk, true) + "</select></label>",
      "<label class='field'><span class='field-label'>老人 / 儿童</span><select class='select' id='eventSubjectTypeFilter'><option value='ALL'>全部对象</option>" + subjectTypeOptions(ui.filters.subjectType) + "</select></label>",
      "<label class='field'><span class='field-label'>事件类型</span><select class='select' id='eventTypeFilter'><option value='ALL'>全部事件类型</option>" + eventTypeOptions(ui.filters.type) + "</select></label>",
      "<label class='field'><span class='field-label'>当前责任人</span><select class='select' id='eventAssigneeFilter'><option value='ALL'>全部责任人</option>" + assigneeOptions(ui.filters.assignee) + "</select></label>",
      "</div>",
      "<div class='data-table'>",
      "<div class='table-head'><span>事件</span><span>照护对象</span><span>对象类型</span><span>风险</span><span>状态</span><span>当前责任人</span><span>响应状态</span><span>操作</span></div>",
      renderEventRows(filtered),
      "</div>",
      "</section>"
    ]);
  }

  function filterOptions(meta, selected, isRisk) {
    return Object.keys(meta).map(function (key) {
      var label = isRisk ? key + " " + meta[key].label : meta[key].label;
      return "<option value='" + key + "'" + (selected === key ? " selected" : "") + ">" + escapeHtml(label) + "</option>";
    }).join("");
  }

  function eventTypeOptions(selected) {
    return Object.keys(eventTypeMeta).map(function (key) {
      return "<option value='" + key + "'" + (selected === key ? " selected" : "") + ">" + escapeHtml(eventTypeMeta[key].label) + "</option>";
    }).join("");
  }

  function subjectTypeOptions(selected) {
    return h([
      "<option value='ELDER'" + (selected === "ELDER" ? " selected" : "") + ">老人</option>",
      "<option value='CHILD'" + (selected === "CHILD" ? " selected" : "") + ">儿童</option>"
    ]);
  }

  function assigneeOptions(selected) {
    return state.users.filter(function (user) {
      return user.role !== "ADMIN";
    }).map(function (user) {
      return "<option value='" + user.id + "'" + (selected === user.id ? " selected" : "") + ">" + escapeHtml(user.name) + "</option>";
    }).join("");
  }

  function renderPeopleRows(subjects) {
    if (!subjects.length) {
      return "<div class='empty-state'><div><div class='empty-symbol'>" + icon("users-round") + "</div><strong>暂时没有可查看的照护对象</strong><span>当前角色还没有被分配照护对象。</span></div></div>";
    }
    return h(subjects.map(function (subject) {
      var subjectEvents = state.events.filter(function (event) {
        return event.subjectId === subject.id;
      });
      var openCount = openEventsCount(subjectEvents);
      var isElder = subject.type === "ELDER";
      return h([
        "<div class='table-row' data-open-subject='" + subject.id + "'>",
        "<div class='cell person-cell' data-label='照护对象'><span class='person-avatar " + (isElder ? "elder" : "child") + "'>" + escapeHtml(subject.name.slice(0, 1)) + "</span><div class='cell-stack'><span class='cell-primary'>" + escapeHtml(subject.name) + "</span><span class='cell-secondary'>" + escapeHtml(subject.gender + " · " + subject.age + " 岁") + "</span></div></div>",
        "<div class='cell' data-label='类型'>" + subjectTypeBadge(subject) + "</div>",
        "<div class='cell' data-label='家庭'><div class='cell-stack'><span class='cell-primary'>" + escapeHtml(subject.household) + "</span><span class='cell-secondary'>" + escapeHtml(subject.location) + "</span></div></div>",
        "<div class='cell' data-label='风险标签'><div class='tag-list'>" + tagList(subject.riskTags) + "</div></div>",
        "<div class='cell' data-label='最近签到'><div class='checkin-state'><strong>" + escapeHtml(formatDateTime(subject.lastCheckInAt)) + "</strong><span>" + escapeHtml(subject.checkInPlan) + "</span></div></div>",
        "<div class='cell' data-label='未关闭事件'><span class='status-badge " + (openCount ? "assigned" : "closed") + "'>" + openCount + " 条</span></div>",
        "<div class='cell' data-label='照护联系人'><div class='cell-stack'><span class='cell-primary'>" + escapeHtml((subject.contactIds || []).map(function (id) { return getUser(id).name; }).join("、")) + "</span><span class='cell-secondary'>已授权联系人</span></div></div>",
        "<div class='cell person-actions' data-label='操作'><button class='small-button' type='button' data-checkin-subject='" + subject.id + "'>" + icon("check", "button-icon") + "签到</button><button class='small-button' type='button' data-open-subject='" + subject.id + "'>档案 " + icon("arrow-right", "button-icon") + "</button></div>",
        "</div>"
      ]);
    }));
  }

  function renderPeople() {
    var subjects = visibleSubjects();
    var elders = subjects.filter(function (subject) { return subject.type === "ELDER"; }).length;
    var children = subjects.filter(function (subject) { return subject.type === "CHILD"; }).length;
    var open = subjects.reduce(function (count, subject) {
      return count + openEventsCount(state.events.filter(function (event) { return event.subjectId === subject.id; }));
    }, 0);

    return h([
      "<div class='page-heading'><div class='page-heading-copy'><div class='eyebrow'>照护对象</div><h2>照护对象</h2><p>只展示完成当前照护任务所需的信息，保留风险标签、联系人和历史事件。</p></div><div class='heading-actions'><button class='button button-primary' type='button' data-create-event>" + icon("plus", "button-icon") + "发起照护事件</button></div></div>",
      "<div class='metric-grid'>",
      renderMetric("users-round", "照护对象", subjects.length, "当前视角可查看", "teal"),
      renderMetric("heart-hand", "老人", elders, "已纳入签到关注", "amber"),
      renderMetric("users-round", "儿童", children, "含接送与托管场景", "blue"),
      renderMetric("clipboard-list", "未关闭事件", open, "按对象聚合", "red"),
      "</div>",
      "<section class='section-panel people-table'><div class='panel-header'><div class='panel-heading'><span class='panel-title'>对象档案</span><span class='panel-subtitle'>脱敏信息仅用于本地演示</span></div><span class='panel-count'>" + subjects.length + " 位</span></div><div class='data-table'><div class='table-head'><span>照护对象</span><span>类型</span><span>家庭</span><span>风险标签</span><span>最近签到</span><span>未关闭事件</span><span>照护联系人</span><span>操作</span></div>" + renderPeopleRows(subjects) + "</div></section>"
    ]);
  }

  function scenarioData() {
    return [
      { key: "missed", icon: "clock-3", color: "amber", level: "P1", title: "老人 4 小时未签到", subject: "李秀梅", description: "模拟签到计划未完成", type: "ELDER_MISSED_CHECKIN" },
      { key: "elderHelp", icon: "hand-heart", color: "teal", level: "P1", title: "老人主动求助", subject: "王建国", description: "模拟普通助餐需求", type: "ELDER_HELP" },
      { key: "fall", icon: "triangle-alert", color: "red", level: "P1", title: "疑似老人跌倒", subject: "李秀梅", description: "需要人工确认当前状态", type: "ELDER_SUSPECTED_FALL" },
      { key: "pickup", icon: "bus-front", color: "amber", level: "P1", title: "儿童接送超时", subject: "陈小雨", description: "约定时间未完成接送确认", type: "CHILD_PICKUP_TIMEOUT" },
      { key: "childCheckin", icon: "clipboard-x", color: "blue", level: "P1", title: "托管签到异常", subject: "周子涵", description: "模拟应到未到场景", type: "CHILD_CARE_CHECKIN_ABNORMAL" },
      { key: "childHelp", icon: "life-buoy", color: "red", level: "P0", title: "儿童主动求助", subject: "周子涵", description: "同时通知监护人与社区", type: "CHILD_HELP" },
      { key: "noResponse", icon: "arrow-up-right", color: "red", level: "P1", title: "家属未响应并升级", subject: "李秀梅", description: "创建事件后立即生成升级记录", type: "ELDER_MISSED_CHECKIN" }
    ];
  }

  function renderSimulator() {
    var scenarios = scenarioData();
    return h([
      "<div class='page-heading'><div class='page-heading-copy'><div class='eyebrow'>场景演示</div><h2>模拟事件台</h2><p>用真实的事件记录复现六类照护场景，事件会进入列表、通知和时间线。</p></div><div class='heading-actions'><span class='status-badge in-progress'>无需硬件</span><span class='status-badge closed'>数据本地保存</span></div></div>",
      "<div class='simulator-layout'>",
      "<section class='section-panel'><div class='panel-header'><div class='panel-heading'><span class='panel-title'>快捷场景</span><span class='panel-subtitle'>选择一个场景开始完整闭环</span></div><span class='panel-count'>7 个演示入口</span></div><div class='scenario-grid'>",
      h(scenarios.map(function (scenario) {
        return h([
          "<button class='scenario-tile' type='button' data-scenario='" + scenario.key + "'>",
          "<div class='scenario-top'><span class='scenario-icon " + scenario.color + "'>" + icon(scenario.icon) + "</span><span class='scenario-level " + scenario.level.toLowerCase() + "'>" + scenario.level + "</span></div>",
          "<span class='scenario-copy'><strong>" + escapeHtml(scenario.title) + "</strong><span>" + escapeHtml(scenario.subject + " · " + scenario.description) + "</span></span>",
          icon("plus", "button-icon"),
          "</button>"
        ]);
      })),
      "</div></section>",
      "<section class='section-panel'><div class='panel-header'><div class='panel-heading'><span class='panel-title'>一条演示路径</span><span class='panel-subtitle'>从异常发现到事件关闭</span></div></div><div class='demo-steps'>",
      "<div class='demo-step'><span class='step-number'>1</span><div><strong>发现异常</strong><span>由模拟按钮生成一条真实照护事件。</span></div></div>",
      "<div class='demo-step'><span class='step-number'>2</span><div><strong>分级通知</strong><span>风险分和计算原因同步写入时间线。</span></div></div>",
      "<div class='demo-step'><span class='step-number'>3</span><div><strong>派单处置</strong><span>切换角色完成接单、转派和反馈。</span></div></div>",
      "<div class='demo-step'><span class='step-number'>4</span><div><strong>超时升级</strong><span>一键推进响应时限并通知下一级人员。</span></div></div>",
      "<div class='demo-step'><span class='step-number'>5</span><div><strong>确认关闭</strong><span>由家属或授权社区人员完成关闭确认。</span></div></div>",
      "</div><div class='reset-panel'><p>恢复后会清除当前浏览器中的演示操作，回到初始事件。</p><button class='button button-danger' type='button' data-reset>" + icon("rotate-ccw", "button-icon") + "重置演示数据</button></div></section>",
      "</div>"
    ]);
  }

  function renderDashboard() {
    var events = visibleEvents();
    var total = events.length;
    var p0 = events.filter(function (event) { return event.riskLevel === "P0"; }).length;
    var p1 = events.filter(function (event) { return event.riskLevel === "P1"; }).length;
    var p2 = events.filter(function (event) { return event.riskLevel === "P2"; }).length;
    var overdue = events.filter(isOverdue).length;
    var accepted = events.filter(function (event) { return event.acceptedAt; });
    var avgResponse = accepted.length ? Math.round(accepted.reduce(function (sum, event) {
      return sum + Math.max(1, (new Date(event.acceptedAt).getTime() - new Date(event.createdAt).getTime()) / 60000);
    }, 0) / accepted.length) : 0;
    var elderCount = events.filter(function (event) { return getSubject(event.subjectId).type === "ELDER"; }).length;
    var childCount = total - elderCount;
    var typeCounts = Object.keys(eventTypeMeta).map(function (type) {
      return { label: eventTypeMeta[type].shortLabel, count: events.filter(function (event) { return event.eventType === type; }).length };
    }).filter(function (item) { return item.count; }).sort(function (a, b) { return b.count - a.count; }).slice(0, 5);
    var maxType = Math.max.apply(null, typeCounts.map(function (item) { return item.count; }).concat([1]));
    var recent = events.slice().sort(function (a, b) {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    }).slice(0, 5);
    var trend = [1, 2, 1, 3, 2, Math.max(2, total - 1), total];

    return h([
      "<div class='page-heading'><div class='page-heading-copy'><div class='eyebrow'>运行看板</div><h2>社区看板</h2><p>用少量关键指标判断当前响应压力和一老一小事件分布。</p></div><div class='heading-actions'><span class='status-badge closed'>更新于 " + escapeHtml(formatTime(new Date().toISOString())) + "</span></div></div>",
      "<div class='metric-grid'>",
      renderMetric("clipboard-list", "今日事件总数", total, "当前角色可见范围", "teal"),
      renderMetric("clock-3", "平均首次响应", avgResponse + " 分钟", "基于已接单事件", "amber"),
      renderMetric("arrow-up-right", "超时率", total ? Math.round(overdue / total * 100) + "%" : "0%", "已进入升级链", "red"),
      renderMetric("check", "今日关闭", events.filter(function (event) { return event.status === "CLOSED"; }).length, "可回溯处置记录", "blue"),
      "</div>",
      "<div class='dashboard-grid'>",
      "<section class='section-panel chart-panel'><div class='panel-header'><div class='panel-heading'><span class='panel-title'>事件类型分布</span><span class='panel-subtitle'>按当前事件类型统计</span></div></div><div class='chart-body'><div class='bar-chart'>" + (typeCounts.length ? h(typeCounts.map(function (item, index) {
        var colors = ["teal", "amber", "blue", "red", "teal"];
        return "<div class='bar-row'><span class='bar-label'>" + escapeHtml(item.label) + "</span><span class='bar-track'><span class='bar-fill " + colors[index] + "' style='width:" + Math.max(12, Math.round(item.count / maxType * 100)) + "%'></span></span><span class='bar-value'>" + item.count + "</span></div>";
      })) : "<div class='empty-state'><div><strong>暂无事件数据</strong></div></div>") + "</div></div></section>",
      "<section class='section-panel chart-panel'><div class='panel-header'><div class='panel-heading'><span class='panel-title'>最近 7 天关闭趋势</span><span class='panel-subtitle'>用于观察闭环节奏</span></div></div><div class='chart-body'><div class='trend-chart'>" + h(trend.map(function (count, index) {
        var day = new Date(Date.now() - (6 - index) * 86400000);
        var height = Math.min(90, Math.max(12, count * 17));
        return "<div class='trend-column'><span class='trend-count'>" + count + "</span><span class='trend-bar' style='height:" + height + "%'></span><span class='trend-date'>" + pad(day.getMonth() + 1) + "/" + pad(day.getDate()) + "</span></div>";
      })) + "</div></div></section>",
      "<section class='section-panel'><div class='panel-header'><div class='panel-heading'><span class='panel-title'>风险结构</span><span class='panel-subtitle'>当前事件优先级分布</span></div></div><div class='insight-list'><div class='insight-row'><span class='insight-label'>P0 紧急事件</span><strong class='insight-value'>" + p0 + " 条</strong></div><div class='insight-row'><span class='insight-label'>P1 高风险事件</span><strong class='insight-value'>" + p1 + " 条</strong></div><div class='insight-row'><span class='insight-label'>P2 一般事件</span><strong class='insight-value'>" + p2 + " 条</strong></div><div class='insight-row'><span class='insight-label'>老人 / 儿童事件</span><strong class='insight-value'>" + elderCount + " / " + childCount + "</strong></div></div></section>",
      "<section class='section-panel'><div class='panel-header'><div class='panel-heading'><span class='panel-title'>最近事件</span><span class='panel-subtitle'>点击进入处置详情</span></div></div><div class='recent-list'>" + h(recent.map(function (event) {
        var subject = getSubject(event.subjectId);
        var meta = eventTypeMeta[event.eventType];
        return "<div class='recent-item' data-open-event='" + event.id + "'><span class='recent-marker " + riskMeta[event.riskLevel].className + "'></span><div class='cell-stack'><span class='cell-primary'>" + escapeHtml(subject.name + " · " + meta.shortLabel) + "</span><span class='cell-secondary'>" + escapeHtml(event.eventNo + " · " + formatDateTime(event.createdAt)) + "</span></div><span class='recent-spacer'></span>" + statusBadge(event.status) + "</div>";
      })) + "</div></section>",
      "</div>"
    ]);
  }

  function renderView() {
    if (ui.view === "people") {
      return renderPeople();
    }
    if (ui.view === "simulator") {
      return renderSimulator();
    }
    if (ui.view === "dashboard") {
      return renderDashboard();
    }
    return renderEvents();
  }

  function updateShell() {
    document.getElementById("pageTitle").textContent = pageTitles[ui.view];
    var config = roles[state.currentRole] || roles.COMMUNITY_WORKER;
    var user = currentUser();
    var sidebar = document.getElementById("sidebarUser");
    sidebar.innerHTML = h([
      "<div class='avatar " + config.avatarClass + "'>" + escapeHtml(config.avatar) + "</div>",
      "<div class='sidebar-user-copy'><strong>" + escapeHtml(user.name) + "</strong><span>" + escapeHtml(config.label) + "</span></div>",
      "<span class='online-dot' title='当前角色在线'></span>"
    ]);
    document.getElementById("roleSelect").value = state.currentRole;
    var openCount = visibleEvents().filter(function (event) {
      return event.status !== "CLOSED" && event.status !== "CANCELLED";
    }).length;
    document.getElementById("navEventCount").textContent = String(openCount);
    var unread = visibleNotifications().filter(function (notice) { return !notice.readAt; }).length;
    document.getElementById("notificationCount").textContent = String(unread);
    document.querySelectorAll(".nav-item").forEach(function (item) {
      item.classList.toggle("active", item.getAttribute("data-view") === ui.view);
    });
  }

  function render() {
    var activeId = document.activeElement && document.activeElement.id;
    var selectionStart = document.activeElement && typeof document.activeElement.selectionStart === "number" ? document.activeElement.selectionStart : null;
    document.getElementById("pageRoot").innerHTML = renderView();
    updateShell();
    hydrateIcons();
    renderDrawer();
    if (ui.notificationsOpen) {
      renderNotifications();
    }
    if (activeId) {
      var next = document.getElementById(activeId);
      if (next) {
        next.focus();
        if (selectionStart !== null && typeof next.setSelectionRange === "function") {
          next.setSelectionRange(selectionStart, selectionStart);
        }
      }
    }
  }

  function canAcceptEvent(event) {
    return event.status === "ASSIGNED" && (isManager() || event.currentAssigneeId === state.currentUserId);
  }

  function canRecordEvent(event) {
    return event.status !== "CLOSED" && event.status !== "CANCELLED" && (isManager() || event.currentAssigneeId === state.currentUserId);
  }

  function appendTimeline(event, title, body, tone) {
    event.timeline = event.timeline || [];
    event.timeline.push(timeline(new Date().toISOString(), tone || "teal", title, body, currentUser().name));
  }

  function notify(event, recipientIds, title, content, type) {
    var unique = [];
    recipientIds.forEach(function (id) {
      if (id && unique.indexOf(id) === -1) {
        unique.push(id);
      }
    });
    unique.forEach(function (recipientId) {
      state.notifications.unshift({
        id: "NOTICE-" + Date.now() + "-" + Math.random().toString(16).slice(2, 7),
        recipientId: recipientId,
        eventId: event.id,
        type: type || "EVENT",
        title: title,
        content: content,
        createdAt: new Date().toISOString(),
        readAt: null
      });
    });
  }

  function notifyForEvent(event) {
    var subject = getSubject(event.subjectId);
    var recipients = (subject.contactIds || []).slice();
    if (event.currentAssigneeId) {
      recipients.push(event.currentAssigneeId);
    }
    if (event.riskLevel === "P0" || event.riskLevel === "P1") {
      recipients.push("U-CW-ZM");
    }
    var meta = eventTypeMeta[event.eventType];
    notify(event, recipients, meta.label + "需要关注", subject.name + "产生" + meta.label + "，请查看事件详情。", "EVENT");
  }

  function calculateRisk(subject, type, urgency) {
    var meta = eventTypeMeta[type];
    var score = meta.baseScore;
    var reasons = [{ label: meta.label, delta: meta.baseScore }];
    if (urgency === "URGENT") {
      score = 90;
      reasons = [{ label: "选择紧急求助", delta: 90 }];
    } else {
      var tags = (subject.riskTags || []).filter(function (tag) {
        return ["独居", "高龄", "失能", "无人监护"].indexOf(tag) !== -1;
      }).slice(0, 2);
      tags.forEach(function (tag) {
        score += 10;
        reasons.push({ label: tag, delta: 10 });
      });
    }
    return {
      score: Math.min(99, score),
      level: riskFromScore(Math.min(99, score), meta.minLevel),
      reasons: reasons
    };
  }

  function initialAssignee(subject, type) {
    if (["ELDER_MISSED_CHECKIN", "CHILD_PICKUP_TIMEOUT", "CHILD_CARE_CHECKIN_ABNORMAL"].indexOf(type) !== -1 && subject.contactIds && subject.contactIds.length) {
      return subject.contactIds[0];
    }
    return "U-CW-ZM";
  }

  function buildEvent(subjectId, type, description, source, urgency) {
    var subject = getSubject(subjectId);
    var meta = eventTypeMeta[type];
    var risk = calculateRisk(subject, type, urgency);
    var created = new Date();
    var no = eventNumber();
    var responseMinutes = risk.level === "P0" ? 1 : risk.level === "P1" ? 5 : 30;
    var escalationMinutes = risk.level === "P0" ? 3 : risk.level === "P1" ? 10 : 60;
    var assigneeId = initialAssignee(subject, type);
    var event = {
      id: "EVENT-" + Date.now() + "-" + Math.random().toString(16).slice(2, 7),
      eventNo: no,
      subjectId: subjectId,
      eventType: type,
      source: source || "MANUAL",
      riskLevel: risk.level,
      riskScore: risk.score,
      riskReasons: risk.reasons,
      status: "ASSIGNED",
      description: description,
      occurredAt: created.toISOString(),
      createdAt: created.toISOString(),
      firstResponseDueAt: new Date(created.getTime() + responseMinutes * 60000).toISOString(),
      escalationDueAt: new Date(created.getTime() + escalationMinutes * 60000).toISOString(),
      currentAssigneeId: assigneeId,
      escalationLevel: 0,
      overdue: false,
      closedAt: null,
      closedBy: null,
      closeReason: null,
      timeline: [
        timeline(created.toISOString(), "blue", "事件创建", "收到" + meta.label + "，生成照护事件 " + no + "。", currentUser().name),
        timeline(new Date(created.getTime() + 300).toISOString(), risk.level === "P0" ? "red" : "amber", "完成风险分级", "风险分：" + risk.score + "，当前等级为 " + risk.level + " " + riskMeta[risk.level].label + "。", "系统"),
        timeline(new Date(created.getTime() + 600).toISOString(), "teal", "已生成初始任务", "已通知" + getUser(assigneeId).name + "，等待首次响应。", "系统")
      ]
    };
    notifyForEvent(event);
    return event;
  }

  function acceptEvent(id) {
    var event = getEvent(id);
    if (!event || !canAcceptEvent(event)) {
      showToast("当前角色暂时不能接单。", "warning");
      return;
    }
    event.status = "IN_PROGRESS";
    event.acceptedAt = new Date().toISOString();
    event.currentAssigneeId = state.currentUserId;
    appendTimeline(event, "已接单", currentUser().name + "已接单，开始处理该照护事件。", "teal");
    saveState();
    render();
    showToast("已接单，事件进入处理中。");
  }

  function simulateTimeout(id, silent) {
    var event = getEvent(id);
    if (!event || event.status === "CLOSED" || event.status === "CANCELLED") {
      showToast("已结束事件不能继续升级。", "warning");
      return;
    }
    event.overdue = true;
    event.escalationLevel = (event.escalationLevel || 0) + 1;
    if (!(event.riskReasons || []).some(function (reason) { return reason.label === "超过响应时限"; })) {
      event.riskReasons.push({ label: "超过响应时限", delta: 10 });
      event.riskScore = Math.min(99, event.riskScore + 10);
      event.riskLevel = riskFromScore(event.riskScore, eventTypeMeta[event.eventType].minLevel);
    }
    var nextAssignee = event.escalationLevel === 1 ? "U-CW-ZM" : "U-RESP-ZS";
    event.currentAssigneeId = nextAssignee;
    event.status = event.status === "PENDING" ? "ASSIGNED" : event.status;
    var nextUser = getUser(nextAssignee);
    appendTimeline(event, "响应超时，已升级", "未在规定时间内完成响应，事件升级至" + nextUser.name + "。", "red");
    notify(event, [nextAssignee], "事件已升级，请及时响应", event.eventNo + " 已超时，请查看并接单。", "ESCALATION");
    saveState();
    render();
    if (!silent) {
      showToast("已生成超时升级记录，并通知下一响应人。", "warning");
    }
  }

  function updateRiskAfterCheckIn(event) {
    if (!(event.riskReasons || []).some(function (reason) { return reason.label === "已完成平安确认"; })) {
      event.riskReasons.push({ label: "已完成平安确认", delta: -20 });
      event.riskScore = Math.max(0, event.riskScore - 20);
      event.riskLevel = riskFromScore(event.riskScore, eventTypeMeta[event.eventType].minLevel);
    }
  }

  function checkInEvent(id) {
    var event = getEvent(id);
    if (!event || event.status === "CLOSED" || event.status === "CANCELLED") {
      showToast("该事件已经结束。", "warning");
      return;
    }
    var subject = getSubject(event.subjectId);
    subject.lastCheckInAt = new Date().toISOString();
    updateRiskAfterCheckIn(event);
    event.status = "WAITING_CONFIRM";
    appendTimeline(event, "平安签到已记录", currentUser().name + "确认" + subject.name + "当前平安，等待事件关闭确认。", "teal");
    notify(event, ["U-CW-ZM"], "照护对象已确认平安", subject.name + "已完成平安签到，请继续完成事件确认。", "EVENT");
    saveState();
    render();
    showToast("已记录平安签到，事件进入待确认。");
  }

  function recordSubjectCheckIn(id) {
    var subject = getSubject(id);
    if (!subject) {
      return;
    }
    subject.lastCheckInAt = new Date().toISOString();
    var related = state.events.filter(function (event) {
      return event.subjectId === id && event.eventType === "ELDER_MISSED_CHECKIN" && event.status !== "CLOSED" && event.status !== "CANCELLED";
    });
    related.forEach(function (event) {
      updateRiskAfterCheckIn(event);
      event.status = "WAITING_CONFIRM";
      appendTimeline(event, "平安签到已记录", currentUser().name + "补充记录" + subject.name + "当前平安。", "teal");
    });
    saveState();
    render();
    showToast(related.length ? "已签到，相关未签到事件进入待确认。" : "已更新最近平安签到时间。");
  }

  function transferEvent(id, assigneeId, reason) {
    var event = getEvent(id);
    if (!event || event.status === "CLOSED" || event.status === "CANCELLED") {
      return;
    }
    var previous = getUser(event.currentAssigneeId);
    var next = getUser(assigneeId);
    event.currentAssigneeId = assigneeId;
    event.status = "ASSIGNED";
    event.transferredAt = new Date().toISOString();
    event.transferReason = reason;
    appendTimeline(event, "已转派", previous.name + "转派给" + next.name + "，原因：" + reason, "amber");
    notify(event, [assigneeId], "收到新的照护任务", event.eventNo + " 已转派给你，请及时接单。", "ASSIGNMENT");
    saveState();
    render();
    showToast("已转派给" + next.name + "。");
  }

  function recordAction(id, actionType, content, complete) {
    var event = getEvent(id);
    if (!event || !canRecordEvent(event)) {
      showToast("当前角色暂时不能记录处置。", "warning");
      return;
    }
    event.status = complete ? "WAITING_CONFIRM" : "IN_PROGRESS";
    appendTimeline(event, actionMeta[actionType] || "处置反馈", content, complete ? "purple" : "teal");
    saveState();
    render();
    showToast(complete ? "处置已记录，事件等待确认。" : "处置反馈已写入时间线。");
  }

  function closeEvent(id, reason, familyConfirm) {
    var event = getEvent(id);
    if (!event || event.status === "CLOSED" || event.status === "CANCELLED") {
      return;
    }
    event.status = "CLOSED";
    event.closedAt = new Date().toISOString();
    event.closedBy = state.currentUserId;
    event.closeReason = reason;
    appendTimeline(event, familyConfirm ? "家属确认关闭" : "授权社区人员关闭", reason, "purple");
    saveState();
    render();
    showToast("事件已关闭，时间线已保留。");
  }

  function openEvent(id) {
    if (!getEvent(id)) {
      return;
    }
    ui.drawerMode = "event";
    ui.activeEventId = id;
    ui.activeSubjectId = null;
    ui.notificationsOpen = false;
    render();
  }

  function openSubject(id) {
    if (!getSubject(id)) {
      return;
    }
    ui.drawerMode = "subject";
    ui.activeSubjectId = id;
    ui.activeEventId = null;
    ui.notificationsOpen = false;
    render();
  }

  function closeDrawer() {
    ui.drawerMode = null;
    ui.activeEventId = null;
    ui.activeSubjectId = null;
    render();
  }

  function renderTimeline(event) {
    var items = (event.timeline || []).slice().sort(function (a, b) {
      return new Date(b.time).getTime() - new Date(a.time).getTime();
    });
    return h(items.map(function (item) {
      return h([
        "<li class='timeline-item'><span class='timeline-dot " + escapeHtml(item.tone || "teal") + "'></span><div class='timeline-copy'><div class='timeline-meta'><span>" + escapeHtml(formatDateTime(item.time)) + "</span><span>" + escapeHtml(item.actor) + "</span></div><strong>" + escapeHtml(item.title) + "</strong><p>" + escapeHtml(item.body) + "</p></div></li>"
      ]);
    }));
  }

  function renderEventActions(event) {
    var actions = [];
    if (canAcceptEvent(event)) {
      actions.push("<button class='button button-primary' type='button' data-accept-event='" + event.id + "'>" + icon("check", "button-icon") + "接单</button>");
    }
    if (canRecordEvent(event)) {
      actions.push("<button class='button button-secondary' type='button' data-record-action='" + event.id + "'>" + icon("plus", "button-icon") + "记录处置</button>");
    }
    if (event.status !== "CLOSED" && event.status !== "CANCELLED" && (isManager() || event.currentAssigneeId === state.currentUserId)) {
      actions.push("<button class='button button-secondary' type='button' data-transfer-event='" + event.id + "'>" + icon("arrow-up-right", "button-icon") + "转派</button>");
    }
    if (event.status !== "CLOSED" && event.status !== "CANCELLED") {
      actions.push("<button class='button button-secondary' type='button' data-timeout-event='" + event.id + "'>" + icon("clock-3", "button-icon") + "模拟超时</button>");
    }
    if (state.currentRole === "FAMILY" && isFamilyOf(event.subjectId) && event.status !== "CLOSED" && event.status !== "CANCELLED" && event.eventType === "ELDER_MISSED_CHECKIN") {
      actions.push("<button class='button button-secondary' type='button' data-checkin-event='" + event.id + "'>" + icon("check", "button-icon") + "确认平安</button>");
    }
    if (state.currentRole === "FAMILY" && isFamilyOf(event.subjectId) && event.status === "WAITING_CONFIRM") {
      actions.push("<button class='button button-primary' type='button' data-confirm-close='" + event.id + "'>" + icon("check", "button-icon") + "确认已解决</button>");
    }
    if (isManager() && event.status === "WAITING_CONFIRM") {
      actions.push("<button class='button button-primary' type='button' data-force-close='" + event.id + "'>" + icon("check", "button-icon") + "授权关闭</button>");
    }
    return actions.length ? actions.join("") : "<span class='panel-subtitle'>当前角色暂无可执行操作</span>";
  }

  function renderEventDrawer(event) {
    var subject = getSubject(event.subjectId);
    var meta = eventTypeMeta[event.eventType];
    var assignee = getUser(event.currentAssigneeId);
    var overdue = isOverdue(event);
    var reasonsTotal = (event.riskReasons || []).reduce(function (sum, reason) { return sum + reason.delta; }, 0);
    return h([
       "<div class='drawer-header'><div class='drawer-title-copy'><div class='drawer-kicker'>" + escapeHtml(event.eventNo) + "</div><h2>" + escapeHtml(meta.label) + "</h2><div class='drawer-header-meta'>" + riskBadge(event.riskLevel, event.riskScore) + statusBadge(event.status) + "</div></div><button class='icon-button drawer-close' type='button' data-close-drawer title='关闭详情' aria-label='关闭详情'>" + icon("x") + "</button></div>",
      "<div class='drawer-scroll'>",
      "<div class='drawer-actions'>" + renderEventActions(event) + "</div>",
       "<div class='subject-banner'><span class='person-avatar " + (subject.type === "ELDER" ? "elder" : "child") + "'>" + escapeHtml(subject.name.slice(0, 1)) + "</span><div class='subject-banner-copy'><strong>" + escapeHtml(subject.name) + " · " + escapeHtml(subject.age + " 岁") + "</strong><span>" + subjectTypeBadge(subject) + " " + escapeHtml(subject.household) + "</span></div><button class='small-button subject-banner-action' type='button' data-open-subject='" + subject.id + "'>查看档案 " + icon("arrow-right", "button-icon") + "</button></div>",
      "<div class='drawer-layout'><div>",
      "<section class='detail-section'><div class='detail-section-title'>事件说明</div><p class='drawer-text'>" + escapeHtml(event.description) + "</p></section>",
      "<section class='detail-section'><div class='detail-section-title'>风险分级与计算原因</div><div class='risk-summary'><strong class='risk-score-large'>" + escapeHtml(event.riskScore) + "<span>当前风险分</span></strong><div>" + riskBadge(event.riskLevel) + "<div class='panel-subtitle' style='margin-top:6px'>计算结果：" + escapeHtml(reasonsTotal) + " 分</div></div></div><div class='risk-reasons'>" + h((event.riskReasons || []).map(function (reason) { var positive = reason.delta >= 0; return "<div class='reason-row'><span class='reason-label'>" + escapeHtml(reason.label) + "</span><span class='reason-value " + (positive ? "positive" : "negative") + "'>" + (positive ? "+" : "") + escapeHtml(reason.delta) + "</span></div>"; })) + "</div></section>",
      "<section class='detail-section'><div class='detail-section-title'>处置时间线</div><ol class='timeline'>" + renderTimeline(event) + "</ol></section>",
      "</div><div>",
      "<section class='detail-section'><div class='detail-section-title'>当前责任</div><div class='info-list'><div class='info-line'><span>责任人</span><strong>" + escapeHtml(assignee.name) + "</strong></div><div class='info-line'><span>角色</span><strong>" + escapeHtml(assignee.title || "待分配") + "</strong></div><div class='info-line'><span>升级次数</span><strong>" + escapeHtml(event.escalationLevel || 0) + " 次</strong></div></div></section>",
      "<section class='detail-section'><div class='detail-section-title'>响应时限</div><div class='sla-block'><div class='sla-line'><span>首次接单</span><strong class='" + (overdue ? "overdue" : "") + "'>" + escapeHtml(formatDue(event)) + "</strong></div><div class='sla-line'><span>创建时间</span><strong>" + escapeHtml(formatDateTime(event.createdAt)) + "</strong></div><div class='sla-line'><span>事件来源</span><strong>" + escapeHtml(event.source === "SIMULATOR" ? "模拟事件台" : "人工创建") + "</strong></div></div></section>",
      "<section class='detail-section'><div class='detail-section-title'>照护对象信息</div><div class='info-list'><div class='info-line'><span>最近签到</span><strong>" + escapeHtml(formatDateTime(subject.lastCheckInAt)) + "</strong></div><div class='info-line'><span>风险标签</span><strong>" + escapeHtml((subject.riskTags || []).join("、")) + "</strong></div><div class='info-line'><span>联系电话</span><strong>" + escapeHtml(subject.phoneMasked) + "</strong></div></div></section>",
      "</div></div></div>"
    ]);
  }

  function renderSubjectDrawer(subject) {
    var subjectEvents = state.events.filter(function (event) { return event.subjectId === subject.id; }).sort(function (a, b) { return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(); });
    var open = subjectEvents.filter(function (event) { return event.status !== "CLOSED" && event.status !== "CANCELLED"; });
    return h([
       "<div class='drawer-header'><div class='drawer-title-copy'><div class='drawer-kicker'>照护对象档案</div><h2>" + escapeHtml(subject.name) + "</h2><div class='drawer-header-meta'>" + subjectTypeBadge(subject) + "<span class='tag'>" + escapeHtml(subject.age + " 岁") + "</span></div></div><button class='icon-button drawer-close' type='button' data-close-drawer title='关闭档案' aria-label='关闭档案'>" + icon("x") + "</button></div>",
       "<div class='drawer-scroll'><div class='drawer-actions'><button class='button button-secondary' type='button' data-checkin-subject='" + subject.id + "'>" + icon("check", "button-icon") + "记录平安签到</button><button class='button button-primary' type='button' data-create-for-subject='" + subject.id + "'>" + icon("plus", "button-icon") + "发起照护事件</button></div>",
      "<section class='detail-section'><div class='detail-section-title'>基本信息</div><div class='profile-grid'><div class='profile-item'><span>姓名</span><strong>" + escapeHtml(subject.name) + "</strong></div><div class='profile-item'><span>性别 / 年龄</span><strong>" + escapeHtml(subject.gender + " / " + subject.age + " 岁") + "</strong></div><div class='profile-item'><span>家庭</span><strong>" + escapeHtml(subject.household) + "</strong></div><div class='profile-item'><span>位置</span><strong>" + escapeHtml(subject.location) + "</strong></div><div class='profile-item'><span>脱敏联系电话</span><strong>" + escapeHtml(subject.phoneMasked) + "</strong></div><div class='profile-item'><span>最近平安签到</span><strong>" + escapeHtml(formatDateTime(subject.lastCheckInAt)) + "</strong></div></div></section>",
      "<section class='detail-section'><div class='detail-section-title'>照护信息</div><div class='profile-grid'><div class='profile-item profile-wide'><span>风险标签</span><div class='tag-list'>" + tagList(subject.riskTags) + "</div></div><div class='profile-item'><span>签到计划</span><strong>" + escapeHtml(subject.checkInPlan) + "</strong></div><div class='profile-item'><span>接送计划</span><strong>" + escapeHtml(subject.pickupPlan) + "</strong></div><div class='profile-item profile-wide'><span>联系人 / 授权关系</span><strong>" + escapeHtml((subject.contactIds || []).map(function (id) { return getUser(id).name + "（" + getUser(id).title + "）"; }).join("、")) + "</strong></div><div class='profile-item profile-wide'><span>安全备注</span><strong>" + escapeHtml(subject.careNote) + "</strong></div></div></section>",
      "<section class='detail-section'><div class='detail-section-title'>未关闭事件 <span class='panel-subtitle'>（" + open.length + "）</span></div><div class='history-list'>" + (open.length ? h(open.map(historyRow)) : "<div class='empty-state'><div><strong>当前没有未关闭事件</strong><span>照护对象状态保持正常。</span></div></div>") + "</div></section>",
      "<section class='detail-section'><div class='detail-section-title'>历史事件</div><div class='history-list'>" + (subjectEvents.length ? h(subjectEvents.map(historyRow)) : "<div class='empty-state'><div><strong>暂时没有历史记录</strong></div></div>") + "</div></section>",
      "</div>"
    ]);
  }

  function historyRow(event) {
    var meta = eventTypeMeta[event.eventType];
    return "<div class='history-row' data-open-event='" + event.id + "'><div class='history-copy'><strong>" + escapeHtml(meta.label) + "</strong><span>" + escapeHtml(event.eventNo + " · " + formatDateTime(event.createdAt)) + "</span></div>" + statusBadge(event.status) + "</div>";
  }

  function renderDrawer() {
    var drawer = document.getElementById("detailDrawer");
    var overlay = document.getElementById("drawerOverlay");
    if (!ui.drawerMode) {
      drawer.classList.remove("open");
      overlay.classList.remove("open");
      drawer.setAttribute("aria-hidden", "true");
      drawer.innerHTML = "";
      return;
    }
    drawer.classList.add("open");
    overlay.classList.add("open");
    drawer.setAttribute("aria-hidden", "false");
    if (ui.drawerMode === "subject") {
      drawer.innerHTML = renderSubjectDrawer(getSubject(ui.activeSubjectId));
      return;
    }
    drawer.innerHTML = renderEventDrawer(getEvent(ui.activeEventId));
  }

  function renderNotifications() {
    var panel = document.getElementById("notificationPanel");
    var notices = visibleNotifications().sort(function (a, b) {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
    panel.classList.add("is-open");
    panel.setAttribute("aria-hidden", "false");
    panel.innerHTML = h([
      "<div class='notification-header'><strong>站内通知</strong><button class='small-button' type='button' data-mark-all-notifications>全部已读</button></div>",
      "<div class='notification-list'>",
      notices.length ? h(notices.map(function (notice) {
        return "<div class='notification-item " + (notice.readAt ? "read" : "unread") + "' data-open-notification='" + notice.id + "'><span class='notification-dot'></span><div class='notification-copy'><strong>" + escapeHtml(notice.title) + "</strong><p>" + escapeHtml(notice.content) + "</p><time>" + escapeHtml(formatDateTime(notice.createdAt)) + "</time></div></div>";
       })) : "<div class='empty-state'><div><div class='empty-symbol'>" + icon("bell") + "</div><strong>暂无通知</strong><span>当前角色没有新的站内消息。</span></div></div>",
      "</div>"
    ]);
  }

  function closeNotifications() {
    ui.notificationsOpen = false;
    var panel = document.getElementById("notificationPanel");
    panel.classList.remove("is-open");
    panel.setAttribute("aria-hidden", "true");
  }

  function toggleNotifications() {
    ui.notificationsOpen = !ui.notificationsOpen;
    if (ui.notificationsOpen) {
      renderNotifications();
    } else {
      closeNotifications();
    }
  }

  function modalShell(title, description, body, footer) {
    return h([
      "<div class='modal' role='dialog' aria-modal='true'><div class='modal-header'><div><h3>" + escapeHtml(title) + "</h3><p>" + escapeHtml(description) + "</p></div><button class='icon-button' type='button' data-close-modal title='关闭' aria-label='关闭'>" + icon("x") + "</button></div>",
      body,
      "<div class='modal-footer'>" + footer + "</div></div>"
    ]);
  }

  function openModal(content) {
    var root = document.getElementById("modalRoot");
    root.innerHTML = content;
    root.classList.add("open");
  }

  function closeModal() {
    var root = document.getElementById("modalRoot");
    root.classList.remove("open");
    root.innerHTML = "";
  }

  function openCreateModal(subjectId) {
    var subjects = visibleSubjects();
    if (!subjects.length) {
      subjects = state.subjects.slice();
    }
    var subjectOptions = subjects.map(function (subject) {
      return "<option value='" + subject.id + "'" + (subject.id === subjectId ? " selected" : "") + ">" + escapeHtml(subject.name + " · " + (subject.type === "ELDER" ? "老人" : "儿童")) + "</option>";
    }).join("");
    var typeOptions = Object.keys(eventTypeMeta).map(function (type) {
      return "<option value='" + type + "'>" + escapeHtml(eventTypeMeta[type].label) + "</option>";
    }).join("");
    openModal(modalShell(
      "创建照护事件",
      "使用虚构数据创建一条可继续处置的事件。",
      h([
        "<form id='createEventForm'><div class='modal-body'>",
        "<label class='field'><span class='field-label'>照护对象</span><select class='select' name='subjectId' required>" + subjectOptions + "</select></label>",
        "<label class='field'><span class='field-label'>事件类型</span><select class='select' name='eventType' required>" + typeOptions + "</select></label>",
        "<label class='field'><span class='field-label'>求助紧急程度</span><select class='select' name='urgency'><option value='NORMAL'>普通</option><option value='URGENT'>紧急</option></select></label>",
        "<label class='field'><span class='field-label'>事件说明</span><textarea class='textarea' name='description' placeholder='请输入需要跟踪处理的事实说明' required></textarea></label>",
        "<div class='form-error' id='createEventError'>请补充事件说明。</div>",
         "</div><div class='modal-footer'><button class='button button-secondary' type='button' data-close-modal>取消</button><button class='button button-primary' type='submit'>" + icon("plus", "button-icon") + "创建事件</button></div></form>"
      ]),
      ""
    ).replace("<div class='modal-footer'></div>", ""));
  }

  function openActionModal(id) {
    openModal(modalShell(
      "记录处置反馈",
      "每条记录都要留下动作类型和事实说明。",
      h([
        "<form id='actionForm' data-event-id='" + id + "'><div class='modal-body'>",
        "<label class='field'><span class='field-label'>处置类型</span><select class='select' name='actionType'>" + Object.keys(actionMeta).map(function (key) { return "<option value='" + key + "'>" + escapeHtml(actionMeta[key]) + "</option>"; }).join("") + "</select></label>",
        "<label class='field'><span class='field-label'>事实说明</span><textarea class='textarea' name='content' placeholder='例如：已电话联系家属，确认老人正在休息。' required></textarea></label>",
        "<label class='checkbox-row'><input type='checkbox' name='complete'>本次处置已完成，事件进入待确认</label>",
        "<div class='form-error' id='actionError'>说明不能为空。</div>",
         "</div><div class='modal-footer'><button class='button button-secondary' type='button' data-close-modal>取消</button><button class='button button-primary' type='submit'>" + icon("check", "button-icon") + "保存处置</button></div></form>"
      ]),
      ""
    ).replace("<div class='modal-footer'></div>", ""));
  }

  function openTransferModal(id) {
    var event = getEvent(id);
    var options = state.users.filter(function (user) {
      return user.id !== event.currentAssigneeId && user.role !== "ADMIN";
    }).map(function (user) {
      return "<option value='" + user.id + "'>" + escapeHtml(user.name + " · " + user.title) + "</option>";
    }).join("");
    openModal(modalShell(
      "转派照护任务",
      "转派后由新的责任人继续处理，原责任人和原因会留在时间线。",
      h([
        "<form id='transferForm' data-event-id='" + id + "'><div class='modal-body'>",
        "<label class='field'><span class='field-label'>新的责任人</span><select class='select' name='assigneeId' required>" + options + "</select></label>",
        "<label class='field'><span class='field-label'>转派原因</span><textarea class='textarea' name='reason' placeholder='请说明为什么需要新的响应人接手。' required></textarea></label>",
        "<div class='form-error' id='transferError'>请选择责任人并填写转派原因。</div>",
         "</div><div class='modal-footer'><button class='button button-secondary' type='button' data-close-modal>取消</button><button class='button button-primary' type='submit'>" + icon("arrow-up-right", "button-icon") + "确认转派</button></div></form>"
      ]),
      ""
    ).replace("<div class='modal-footer'></div>", ""));
  }

  function openCloseModal(id) {
    openModal(modalShell(
      "授权关闭事件",
      "关闭前请填写本次事件的处理结果。",
      h([
        "<form id='closeForm' data-event-id='" + id + "'><div class='modal-body'>",
        "<label class='field'><span class='field-label'>关闭说明</span><textarea class='textarea' name='reason' placeholder='例如：已到场查看，老人安全，家属确认无其他需求。' required></textarea></label>",
        "<div class='form-error' id='closeError'>关闭说明不能为空。</div>",
         "</div><div class='modal-footer'><button class='button button-secondary' type='button' data-close-modal>取消</button><button class='button button-primary' type='submit'>" + icon("check", "button-icon") + "确认关闭</button></div></form>"
      ]),
      ""
    ).replace("<div class='modal-footer'></div>", ""));
  }

  function createEventFromForm(form) {
    var subjectId = form.elements.subjectId.value;
    var type = form.elements.eventType.value;
    var urgency = form.elements.urgency.value;
    var description = form.elements.description.value.trim();
    var error = document.getElementById("createEventError");
    if (!description) {
      error.classList.add("show");
      return;
    }
    var event = buildEvent(subjectId, type, description, "MANUAL", urgency);
    state.events.unshift(event);
    saveState();
    closeModal();
    ui.view = "events";
    ui.drawerMode = "event";
    ui.activeEventId = event.id;
    render();
    showToast("事件已创建，已进入事件详情。");
  }

  function createScenario(key) {
    var scenario = scenarioData().find(function (item) { return item.key === key; });
    if (!scenario) {
      return;
    }
    var subject = state.subjects.find(function (item) { return item.name === scenario.subject; });
    var descriptions = {
      missed: "模拟：连续 4 小时未提交平安签到，建议家属先确认当前平安。",
      elderHelp: "模拟：需要社区协助安排今日助餐服务。",
      fall: "模拟：疑似在卧室发生跌倒或突发异常，需要人工确认。",
      pickup: "模拟：约定接送时间已过，暂未收到监护人确认。",
      childCheckin: "模拟：儿童应到托管点但未完成签到，需要联系监护人。",
      childHelp: "模拟：儿童发起主动求助，同时通知监护人和社区工作人员。",
      noResponse: "模拟：家属在首次响应时限内未回应，系统立即推进升级。"
    };
    var event = buildEvent(subject.id, scenario.type, descriptions[key], "SIMULATOR", key === "childHelp" ? "URGENT" : "NORMAL");
    state.events.unshift(event);
    if (key === "noResponse") {
      simulateTimeout(event.id, true);
    } else {
      saveState();
      render();
    }
    ui.view = "events";
    ui.drawerMode = "event";
    ui.activeEventId = event.id;
    render();
    showToast("已生成" + scenario.title + "事件。");
  }

  function showToast(message, tone) {
    var root = document.getElementById("toastRoot");
    var toast = document.createElement("div");
    toast.className = "toast " + (tone || "");
    toast.innerHTML = icon(tone === "warning" ? "triangle-alert" : "check", "button-icon") + "<span>" + escapeHtml(message) + "</span>";
    root.appendChild(toast);
    window.setTimeout(function () {
      toast.remove();
    }, 3200);
  }

  function resetDemo() {
    if (!window.confirm("确定要恢复初始演示数据吗？当前浏览器中的演示操作会被清除。")) {
      return;
    }
    state = seedState();
    saveState();
    ui.view = "events";
    ui.drawerMode = null;
    ui.activeEventId = null;
    ui.activeSubjectId = null;
    ui.filters = { search: "", status: "ALL", risk: "ALL", subjectType: "ALL", type: "ALL", assignee: "ALL" };
    closeNotifications();
    render();
    showToast("演示数据已恢复。");
  }

  document.addEventListener("click", function (event) {
    var target = event.target;
    var viewButton = target.closest("[data-view]");
    if (viewButton && !target.closest(".table-row")) {
      ui.view = viewButton.getAttribute("data-view");
      ui.drawerMode = null;
      ui.activeEventId = null;
      ui.activeSubjectId = null;
      closeNotifications();
      render();
      window.scrollTo(0, 0);
      window.requestAnimationFrame(function () {
        window.scrollTo(0, 0);
      });
      return;
    }

    if (target.closest("#notificationButton")) {
      toggleNotifications();
      return;
    }
    if (target.closest("[data-close-drawer]") || target.id === "drawerOverlay") {
      closeDrawer();
      return;
    }
    if (target.closest("[data-close-modal]")) {
      closeModal();
      return;
    }
    if (target.closest("[data-create-event]")) {
      openCreateModal();
      return;
    }
    var createFor = target.closest("[data-create-for-subject]");
    if (createFor) {
      openCreateModal(createFor.getAttribute("data-create-for-subject"));
      return;
    }
    var accept = target.closest("[data-accept-event]");
    if (accept) {
      acceptEvent(accept.getAttribute("data-accept-event"));
      return;
    }
    var timeout = target.closest("[data-timeout-event]");
    if (timeout) {
      simulateTimeout(timeout.getAttribute("data-timeout-event"));
      return;
    }
    var checkinEvent = target.closest("[data-checkin-event]");
    if (checkinEvent) {
      checkInEvent(checkinEvent.getAttribute("data-checkin-event"));
      return;
    }
    var checkinSubject = target.closest("[data-checkin-subject]");
    if (checkinSubject) {
      recordSubjectCheckIn(checkinSubject.getAttribute("data-checkin-subject"));
      return;
    }
    var recordActionButton = target.closest("[data-record-action]");
    if (recordActionButton) {
      openActionModal(recordActionButton.getAttribute("data-record-action"));
      return;
    }
    var transferButton = target.closest("[data-transfer-event]");
    if (transferButton) {
      openTransferModal(transferButton.getAttribute("data-transfer-event"));
      return;
    }
    var confirmClose = target.closest("[data-confirm-close]");
    if (confirmClose) {
      closeEvent(confirmClose.getAttribute("data-confirm-close"), "家属确认照护对象当前平安，事件已得到处理。", true);
      return;
    }
    var forceClose = target.closest("[data-force-close]");
    if (forceClose) {
      openCloseModal(forceClose.getAttribute("data-force-close"));
      return;
    }
    var reset = target.closest("[data-reset]");
    if (reset) {
      resetDemo();
      return;
    }
    var scenario = target.closest("[data-scenario]");
    if (scenario) {
      createScenario(scenario.getAttribute("data-scenario"));
      return;
    }
    var markAll = target.closest("[data-mark-all-notifications]");
    if (markAll) {
      state.notifications.forEach(function (notice) {
        if (state.currentRole === "ADMIN" || notice.recipientId === state.currentUserId) {
          notice.readAt = new Date().toISOString();
        }
      });
      saveState();
      render();
      showToast("通知已全部标记为已读。");
      return;
    }
    var notice = target.closest("[data-open-notification]");
    if (notice) {
      var noticeItem = state.notifications.find(function (item) { return item.id === notice.getAttribute("data-open-notification"); });
      if (noticeItem) {
        noticeItem.readAt = new Date().toISOString();
        saveState();
        closeNotifications();
        if (noticeItem.eventId) {
          openEvent(noticeItem.eventId);
        } else {
          render();
        }
      }
      return;
    }
    var subjectButton = target.closest("[data-open-subject]");
    if (subjectButton) {
      openSubject(subjectButton.getAttribute("data-open-subject"));
      return;
    }
    var eventButton = target.closest("[data-open-event]");
    if (eventButton) {
      openEvent(eventButton.getAttribute("data-open-event"));
    }
  });

  document.addEventListener("change", function (event) {
    if (event.target.id === "roleSelect") {
      var role = event.target.value;
      state.currentRole = role;
      state.currentUserId = roles[role].userId;
      ui.drawerMode = null;
      ui.activeEventId = null;
      ui.activeSubjectId = null;
      closeNotifications();
      saveState();
      render();
      showToast("已切换到" + roles[role].label + "视角。");
      return;
    }
    if (event.target.id === "eventStatusFilter") {
      ui.filters.status = event.target.value;
      render();
      return;
    }
    if (event.target.id === "eventRiskFilter") {
      ui.filters.risk = event.target.value;
      render();
      return;
    }
    if (event.target.id === "eventSubjectTypeFilter") {
      ui.filters.subjectType = event.target.value;
      render();
      return;
    }
    if (event.target.id === "eventTypeFilter") {
      ui.filters.type = event.target.value;
      render();
      return;
    }
    if (event.target.id === "eventAssigneeFilter") {
      ui.filters.assignee = event.target.value;
      render();
    }
  });

  document.addEventListener("input", function (event) {
    if (event.target.id !== "eventSearch") {
      return;
    }
    ui.filters.search = event.target.value;
    window.clearTimeout(window.__neighborCareSearchTimer);
    window.__neighborCareSearchTimer = window.setTimeout(render, 180);
  });

  document.addEventListener("submit", function (event) {
    event.preventDefault();
    var form = event.target;
    if (form.id === "createEventForm") {
      createEventFromForm(form);
      return;
    }
    if (form.id === "actionForm") {
      var content = form.elements.content.value.trim();
      var error = document.getElementById("actionError");
      if (!content) {
        error.classList.add("show");
        return;
      }
      recordAction(form.getAttribute("data-event-id"), form.elements.actionType.value, content, form.elements.complete.checked);
      closeModal();
      return;
    }
    if (form.id === "transferForm") {
      var reason = form.elements.reason.value.trim();
      var transferError = document.getElementById("transferError");
      if (!reason || !form.elements.assigneeId.value) {
        transferError.classList.add("show");
        return;
      }
      transferEvent(form.getAttribute("data-event-id"), form.elements.assigneeId.value, reason);
      closeModal();
      return;
    }
    if (form.id === "closeForm") {
      var closeReason = form.elements.reason.value.trim();
      var closeError = document.getElementById("closeError");
      if (!closeReason) {
        closeError.classList.add("show");
        return;
      }
      closeEvent(form.getAttribute("data-event-id"), closeReason, false);
      closeModal();
    }
  });

  document.addEventListener("keydown", function (event) {
    if (event.key !== "Escape") {
      return;
    }
    if (document.getElementById("modalRoot").classList.contains("open")) {
      closeModal();
      return;
    }
    if (ui.drawerMode) {
      closeDrawer();
      return;
    }
    if (ui.notificationsOpen) {
      closeNotifications();
    }
  });

  render();
})();
