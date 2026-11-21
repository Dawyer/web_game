/**
 * levels.mjs — 房间内容数据（唯一内容源，与 RULES.md 对齐）
 * 纯数据，无 DOM、无副作用。engine / controller / view / tests 共用。
 */

export const CONTENT_VERSION = '1.0.0';

/** 正确授权码（唯一解）。测试与引擎都从这里读，避免两处写死不一致。 */
export const AUTHORIZATION_CODE = '418250';

/** 三件道具：各有唯一用途，无摆设。 */
export const ITEMS = {
  battery: {
    id: 'battery',
    name: '应急电池',
    glyph: '▮',
    foundIn: 'locker',
    useOn: 'nav',
    desc: '一块还有余电的应急电池，标签写着「导航终端专用」。'
  },
  starchart: {
    id: 'starchart',
    name: '星图仪',
    glyph: '✧',
    foundIn: 'seat',
    useOn: 'porthole',
    desc: '手持星图仪，可对准舷窗识别信标星并读出其编号。'
  },
  fuse: {
    id: 'fuse',
    name: '保险丝',
    glyph: '⌁',
    foundIn: 'toolbox',
    useOn: 'lifesupport',
    desc: '一枚完好的备用保险丝，规格与生命维持面板匹配。'
  }
};

/** 有效组合：item > target。 */
export const COMBINATIONS = {
  'battery>nav': {
    flag: 'navPowered',
    event: 'nav-on',
    text: '电池卡入槽位，导航终端嗡地亮起。屏幕上跳出轨道警告。'
  },
  'starchart>porthole': {
    flag: 'starchartUsed',
    event: 'starchart-on',
    text: '星图仪对准舷窗，叠加层浮现，三颗信标星被依次圈出。'
  },
  'fuse>lifesupport': {
    flag: 'fuseFixed',
    event: 'power-on',
    text: '保险丝复位，生命维持面板的读数区亮了起来。一段被切断的录音自动播放。'
  }
};

/** 热点定义。text(state) 返回当前应显示的描述；clues 列出该热点可发现的线索 id。 */
export const HOTSPOTS = {
  locker: {
    id: 'locker', name: '储物柜', zone: 'left',
    label: '储物柜', yields: 'battery',
    text: (s) => {
      if (!s.flags.introSeen) return '柜门虚掩着。里面似乎有东西。';
      if (!s.inventory.includes('battery')) return '柜门虚掩着。里面放着一块应急电池，还有一张船员名单。';
      return '柜子空了。名单你已经读过。';
    }
  },
  seat: {
    id: 'seat', name: '逃生舱座椅', zone: 'center',
    label: '座椅', yields: 'starchart',
    text: (s) => {
      if (!s.inventory.includes('starchart')) return '你的座椅。下方检修格没关严，卡着一件仪器。';
      return '座椅下方检修格已经空了。';
    }
  },
  toolbox: {
    id: 'toolbox', name: '工具箱', zone: 'right',
    label: '工具箱', yields: 'fuse',
    text: (s) => {
      if (!s.inventory.includes('fuse')) return '打开的工具箱。里面有一枚备用保险丝，箱盖内侧贴着维护日志。';
      return '工具箱里只剩几件普通工具。维护日志你已经读过。';
    }
  },
  nav: {
    id: 'nav', name: '导航终端', zone: 'left',
    label: '导航终端',
    text: (s) => {
      if (!s.flags.navPowered) return '导航终端黑着屏。电池槽是空的。';
      return '导航终端：「轨道偏离警告。渡鸦-7 正以 0.3 AU/日 接近最近恒星。定位信标：舷窗方向。请用星图仪读取坐标。」';
    }
  },
  porthole: {
    id: 'porthole', name: '舷窗', zone: 'center',
    label: '舷窗',
    text: (s) => {
      if (!s.flags.starchartUsed) return '舷窗外是沉默的星海。几颗亮星格外显眼，但你看不出编号。';
      return '星图叠加层：最亮的信标星编号 4，次亮 1，最暗 8。按维护日志，读取顺序为亮度由高到低。';
    }
  },
  lifesupport: {
    id: 'lifesupport', name: '生命维持面板', zone: 'right',
    label: '生命维持',
    text: (s) => {
      if (!s.flags.fuseFixed) return '生命维持面板读数区是黑的，保险丝位空着。';
      return '面板亮起：O₂ 浓度 26%，舱压 5 kPa。贴纸写着「取氧气十位与舱压个位」。船员体征：六人全部休眠，林澈的曲线显示他在清醒状态下被主动关入。';
    }
  },
  console: {
    id: 'console', name: '发射控制台', zone: 'center',
    label: '控制台',
    text: (s) => {
      if (s.flags.escaped) return '控制台归于沉寂。授权已完成。';
      return '发射控制台：「发射码校验失败，需三组授权。」屏保一行小字：「校验位 = 前五位之和的个位。」';
    }
  },
  door: {
    id: 'door', name: '逃生舱门', zone: 'center',
    label: '舱门',
    text: (s) => {
      if (s.flags.escaped) return '舱门已经弹开。星光涌进来。';
      return '逃生舱门紧闭。门侧红灯闪烁：需先在控制台完成三组授权。';
    }
  }
};

/** 线索簿条目：id → { title, text, when }。when(state) 为真时该线索可见。 */
export const CLUES = {
  crewList: {
    title: '船员名单',
    text: '林澈（船长）、周岚、陈默、苏叶、何舟、你（小满）。最后一条日志停在 11 个月前：「例行值守，一切正常。」',
    when: (s) => s.inventory.includes('battery')
  },
  navWarning: {
    title: '导航警告',
    text: '渡鸦-7 已偏离轨道，正以 0.3 AU/日 接近最近恒星。定位信标在舷窗方向，需用星图仪读取坐标。',
    when: (s) => s.flags.navPowered
  },
  logRule: {
    title: '维护日志',
    text: '信标星按亮度由高到低读取。（箱盖内侧手写）',
    when: (s) => s.inventory.includes('fuse')
  },
  beacons: {
    title: '信标星编号',
    text: '最亮 → 4，次亮 → 1，最暗 → 8。按亮度由高到低：坐标段 = 418。',
    when: (s) => s.flags.starchartUsed
  },
  lifeReadings: {
    title: '生命维持读数',
    text: 'O₂ 浓度 26%，舱压 5 kPa。取氧气十位与舱压个位：生维段 = 25。',
    when: (s) => s.flags.fuseFixed
  },
  crewStatus: {
    title: '船员体征',
    text: '六人全部休眠。林澈的曲线显示他在清醒状态下被主动关入休眠 —— 不是撤离。',
    when: (s) => s.flags.fuseFixed
  },
  checksumRule: {
    title: '屏保公式',
    text: '校验位 = 前五位之和的个位。',
    when: () => true
  }
};

/** 叙事文本（逐字锁定，与 RULES.md 一致）。 */
export const NARRATIVE = {
  intro: '你在逃生舱座椅上醒来，后脑一阵钝痛。广播循环着同一句话：「轨道衰减，脱离窗口关闭中。」通讯全断，六名船员不见踪影。中控屏跳出一行红字：发射码校验失败，需三组授权。',
  recording: '「如果你听到这段录音，说明你还活着，而且还没被感染。我把他们送进休眠，切断了通讯，把渡鸦-7 导向恒星。跟着信号上船的那个东西，烧掉它，才能彻底干净。你是唯一没被它碰过的 —— 事发前你就在休眠里。锁住你的安全协议是我下的最后一道命令：别出去，等我安排好逃生舱。输入三组授权，门会开。对不起。」',
  ending: '授权通过。舱门弹开。渡鸦-7 在身后烧成一道光。屏幕最后一行字，是林澈留给你的私人留言：「小满，替我看看那边的天。」'
};

/** 提示阶梯：按进度给出当前目标的 id。 */
export const GOAL_STEPS = [
  { goal: 'locker', done: (s) => s.inventory.includes('battery') },
  { goal: 'useBattery', done: (s) => s.flags.navPowered },
  { goal: 'seat', done: (s) => s.inventory.includes('starchart') },
  { goal: 'useStarchart', done: (s) => s.flags.starchartUsed },
  { goal: 'toolbox', done: (s) => s.inventory.includes('fuse') },
  { goal: 'useFuse', done: (s) => s.flags.fuseFixed },
  { goal: 'code', done: (s) => s.flags.escaped },
  { goal: 'done', done: () => true }
];

/** 三层提示文案（与 RULES.md 表格一致）。 */
export const HINTS = {
  locker: ['房间左侧的储物柜好像没锁严。', '点开储物柜，看看里面有什么。', '点储物柜拿走应急电池，它能给导航终端供电。'],
  useBattery: ['导航终端黑着屏，它在等电。', '选中应急电池，再点导航终端。', '点物品栏的应急电池选中，再点导航终端使用。'],
  seat: ['座椅底下似乎卡着什么东西。', '点座椅，查看下方检修格。', '点座椅拿走星图仪，它是读舷窗信标用的。'],
  useStarchart: ['导航终端让你去舷窗定位信标。', '选中星图仪，再点舷窗。', '点星图仪选中再点舷窗，叠加层圈出三颗信标星，按亮度由高到低读数字。'],
  toolbox: ['工具箱里应该还有能用的东西。', '点工具箱，看看里面。', '点工具箱拿走保险丝，箱盖内侧的维护日志写着信标星读取顺序。'],
  useFuse: ['生命维持面板没电，读数区是黑的。', '选中保险丝，再点生命维持面板。', '点保险丝选中再点生命维持面板，供电恢复后会播放船长录音，面板显示生维段 25。'],
  code: ['三组授权分别藏在导航定位、生命读数和屏保公式里。', '坐标 418，生维 25，校验位是前五位之和的个位。', '4+1+8+2+5=20，个位是 0，在控制台输入 418250。'],
  done: ['你已经逃出来了。', '你已经逃出来了。', '你已经逃出来了。']
};

/** 根据状态返回当前提示目标 id。 */
export function currentGoal(state) {
  for (const step of GOAL_STEPS) {
    if (!step.done(state)) return step.goal;
  }
  return 'done';
}
