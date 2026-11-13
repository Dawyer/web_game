export const CONTENT_VERSION = '2026.11.12.1';
export const CHAPTERS = [
  { id: 1, title: '初识球桌', description: '认箭头、数六拍，学会在稳定局面思考。' },
  { id: 2, title: '借力台边', description: '反向不等于退路，留心每一拍。' },
  { id: 3, title: '接力之间', description: '选中的是起点，入袋的可以是另一颗球。' },
  { id: 4, title: '镜中转角', description: '四向行走，直角转弯。' },
  { id: 5, title: '多色交织', description: '先后顺序改变彼此的路。' },
  { id: 6, title: '球桌回响', description: '综合安排，给每颗球留下出口。' }
];
export const LEVELS = [
  { id: '01', version: '1', chapter: 1, title: '看准箭头', intent: '点红球，让 A 球走向 A 袋。', tutorial: '直接点红球：沿箭头前进，同色才入袋。一击最多六拍。', hints: ['沿箭头向右，黑色袋口上的 A 对应红球。'], w: 3, h: 3, balls: [{ id: 'a', x: 0, y: 1, dir: 'E', color: 'red' }], blocks: [], mirrors: [], exits: [{ edge: 'E', index: 1, color: 'red' }], par: 1, limit: 5 },
  { id: '02', version: '1', chapter: 1, title: '借一次反弹', intent: '先撞台边，再回到同色袋。', tutorial: '撞墙原地反向，也会消耗一拍。无需抢点，球会在六拍后停稳。', w: 4, h: 3, balls: [{ id: 'a', x: 2, y: 1, dir: 'E', color: 'red' }], blocks: [], mirrors: [], exits: [{ edge: 'W', index: 1, color: 'red' }], par: 1, limit: 5 },
  { id: '03', version: '1', chapter: 1, title: '把余拍传下去', intent: '红球撞蓝球，冲量接力；红球下次再出发。', tutorial: '碰球会把余拍交给对方；来球停下并反向。先让红球推动蓝球。', w: 5, h: 3, balls: [{ id: 'a', x: 0, y: 1, dir: 'E', color: 'red' }, { id: 'b', x: 2, y: 1, dir: 'N', color: 'blue' }], blocks: [], mirrors: [], exits: [{ edge: 'E', index: 1, color: 'blue' }, { edge: 'W', index: 1, color: 'red' }], par: 2, limit: 6 },
  { id: '04', version: '1', chapter: 1, title: '镜子转直角', intent: '进入斜镜，向北转弯。', tutorial: '/ 镜将向右的球转向上；镜面只在进入格子时触发。', w: 3, h: 3, balls: [{ id: 'a', x: 0, y: 1, dir: 'E', color: 'red' }], blocks: [], mirrors: [{ x: 1, y: 1, kind: '/' }], exits: [{ edge: 'N', index: 1, color: 'red' }], par: 1, limit: 5 }
];