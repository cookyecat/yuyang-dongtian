// 世界数据：游线、六个区、十三个景点舞台、人物与台词。
// 坐标：x 沿画卷方向（画面右端 = +x，卷首 IMG_1271 在 x≈+330），-z 是画面深处，y 向上，单位米。
// 游览方向按手卷惯例自右向左，即从 +x 走向 -x。

// 游线控制点 [x, z, 地面高]
export const PATH = [
  [360, 4, 6], [330, 4, 6], [300, 6, 6], [272, 1, 7], [245, -1, 8], [220, 4, 5],
  [195, 6, 3], [175, 2, 2.2], [155, -1, 2], [135, 2, 2.4], [115, 4, 3], [95, 6, 4],
  [72, 5, 4.4], [50, 3, 4.5], [32, 3, 4.5], [14, 6, 4.6], [-6, 5, 6], [-28, 1, 9.5],
  [-50, -1, 12.5], [-64, -2, 14], [-86, -5, 19, { next: [-110, -7, 24] }],
  // v34 琪樹峡一段按原画石阶走：从峡口沿峡底的石阶上来，在白衣人处往里拐一道，再出来接超然亭（第 4 项是邻段插值用的旧邻点，前后两段游线不动）
  [-97, -6.8, 20.6], [-104.5, -9, 22.5], [-112, -15, 24.2], [-119, -11.5, 25.4], [-136, -6, 28, { prev: [-110, -7, 24] }],
  [-148, -21, 31], [-163, -27, 31.2], [-178, -27.5, 29], [-197, -12, 21], // v30：超然亭一段按原画改道——从右边上来走到亭侧，绕到亭后，再从亭左的瘦树后面下山
  [-215, 0, 14], [-236, 2, 8], [-255, 4, 3.2],
  [-276, 2, 5], [-296, 0, 8], [-316, 2, 7], [-334, 4, 6], [-362, 4, 6],
];

// v29 及以前的游线（芙蓉城石柱按旧地形定柱顶，见 main.js keepTop）
export const PATH_V29 = [[360, 4, 6], [330, 4, 6], [300, 6, 6], [272, 1, 7], [245, -1, 8], [220, 4, 5], [195, 6, 3], [175, 2, 2.2], [155, -1, 2], [135, 2, 2.4], [115, 4, 3], [95, 6, 4], [72, 5, 4.4], [50, 3, 4.5], [32, 3, 4.5], [14, 6, 4.6], [-6, 5, 6], [-28, 1, 9.5], [-50, -1, 12.5], [-64, -2, 14], [-86, -5, 19], [-110, -7, 24], [-136, -6, 28], [-165, -4, 30], [-190, -2, 22], [-215, 0, 14], [-236, 2, 8], [-255, 4, 3.2], [-276, 2, 5], [-296, 0, 8], [-316, 2, 7], [-334, 4, 6], [-362, 4, 6]];
// v33 的游线（琪樹峡石阵沿用 v33 的随机序列，见 main.js）
export const PATH_V33 = PATH_V29.filter((P) => P[0] > -147 || P[0] < -198).concat([[-148, -21, 31], [-163, -27, 31.2], [-178, -27.5, 29], [-197, -12, 21]]).sort((a, b) => b[0] - a[0]);

export const ZONES = [
  { id: 1, name: '东境·廊院', x0: 345, x1: 222, photos: 'IMG_1271、1270', stage: 'ch1' },
  { id: 2, name: '林泉雅集', x0: 222, x1: 92, photos: 'IMG_1269–1267', stage: 'ch1' },
  { id: 3, name: '玉女潭', x0: 92, x1: -36, photos: 'IMG_1266', stage: 'slice' },
  { id: 4, name: '云山仙境', x0: -36, x1: -200, photos: 'IMG_1265–1263', stage: 'ch2' },
  { id: 5, name: '龍湫·禪窩', x0: -200, x1: -284, photos: 'IMG_1262、1261', stage: 'ch3' },
  { id: 6, name: '卷尾·洞壑', x0: -284, x1: -352, photos: 'IMG_1260、1258', stage: 'ch4' },
];

// 景点舞台。label: 题名在世界中的位置；view: 画境视角（相机位置、注视点、视场角）
export const STAGES = [
  { id: 'S13', name: '金晶巖·龍王廟', photo: '1271', x: 302, z: -22, r: 26, fine: true,
    labels: [['金晶巖', 290, 15, -12], ['龍王廟', 306, 30, -42], ['青牛峡', 313.5, 13, -20], ['隱春巖', 318, 13, -6]],
    view: { pos: [300, 21, 40], at: [301, 16, -30], fov: 46 }, layoutView: { pos: [301, 24, 42], at: [302, 10, -22], fov: 46 } }, // layoutView：布局随机数沿用 v21 的镜头
  { id: 'S12', name: '隅九桥·大觀廊', photo: '1270', x: 248, z: -20, r: 26, fine: true,
    labels: [['大觀廊', 237.5, 22, -47], ['隅九桥', 232, 9.5, 1.4]],
    view: { pos: [249.5, 38, 21], at: [249.5, 11, -33], fov: 50 }, layoutView: { pos: [249, 36, 24], at: [249, 8, -24], fov: 48 } },
  { id: 'S11', name: '梅竹隩·沸玉橋', photo: '1269', x: 196, z: -6, r: 22, fine: true,
    labels: [['沸玉橋', 195, 8, 6], ['梅竹隩', 179, 10, -12]],
    view: { pos: [194, 20, 42], at: [192, 5, -12], fov: 46 } },
  { id: 'S10', name: '流觴嶼', photo: '1268', x: 152, z: -10, r: 22, fine: true,
    labels: [['流觴嶼', 150, 8, -14]],
    view: { pos: [152, 11, 14], at: [151, 3, -15], fov: 48 } },
  { id: 'S09', name: '凝玉亭·玉樹湍', photo: '1267', x: 112, z: -10, r: 22, fine: true,
    labels: [['凝玉亭', 102, 9, -16], ['玉樹湍', 118, 7, -8], ['鶴巢', 110, 5, 2]],
    view: { pos: [111, 13, 28], at: [111, 5, -12], fov: 48 } },
  { id: 'S08', name: '玉光閣·玉女潭', photo: '1266', x: 34, z: -14, r: 40, slice: true,
    labels: [['玉光閣', 7, 13.5, -12], ['玉女潭', 36, 7.2, -9], ['靈應亭', 70, 24.5, -28], ['后土洞', 46, 9, -26], ['初平林', -17, 79, -98]],
    view: { pos: [37, 24, 50], at: [36, 17.5, -18], fov: 48 } }, // v44 镜头往上抬：潭、崖、閣落到原画的位置，上半截留给后面的群山（原画 IMG_1266 崖顶以上一大半是山）
  { id: 'S07', name: '磐玉隈', photo: '1265', x: -64, z: -14, r: 24, fine: true,
    labels: [['磐玉隈', -61.5, 24, -19], ['縹緲亭', -80.5, 49, -38]],
    view: { pos: [-71.3, 51.5, 44.1], at: [-70.1, 47.5, 34.2], fov: 40 } }, // v36 按原画反投影定的画境镜头：正前方偏左高处（縹緲亭、下棋的人落在原画位置）
  { id: 'S06', name: '縹緲亭·琪樹峡', photo: '1264', x: -112, z: -16, r: 24, fine: true,
    labels: [['縹緲亭', -80.5, 49, -38], ['琪樹峡', -94.5, 30, -16]],
    view: { pos: [-93.5, 49.3, 30.7], at: [-96.4, 45.3, 21.1], fov: 40 } }, // v34 按原画反投影定的画境镜头：从右前方高处往左后看进峡里
  { id: 'S05', name: '超然亭', photo: '1263', x: -166, z: -14, r: 26, fine: true,
    labels: [['超然亭', -155.5, 37, -19], ['雙仙石', -191, 15, 8], ['芙蓉城', -160, 66, -62], ['天成碑', -139, 46, -41], ['二姑峰', -186, 52, -27]],
    view: { pos: [-156, 46, 24], at: [-161.2, 27.1, -19.5], fov: 40 } },
  { id: 'S04', name: '觀音岩·禪窩', photo: '1262', x: -229, z: -12, r: 24, fine: true,
    labels: [['觀音岩', -238.5, 33, -49], ['摩崖觀音', -224, 58, 47], ['禪窩', -233.6, 18.5, -6]],
    view: { pos: [-230, 25, 23], at: [-231, 18.5, -24], fov: 40 } }, // v39 按原画反投影定的画境镜头（ch3/cam.py）：正前方稍高，禪窩在下中，觀音龛在左后坡上
  { id: 'S03', name: '龍湫', photo: '1261', x: -262, z: -14, r: 24, fine: true,
    labels: [['龍湫', -263, 15.5, -12]],
    view: { pos: [-263, 16, 22], at: [-264, 9.5, -16], fov: 40 } }, // v39：正对岩洞，船在洞里
  { id: 'S02', name: '水犀洞', photo: '1260', x: -300, z: -16, r: 22, fine: true,
    labels: [['水犀洞', -297.4, 18.6, -21.4]],
    view: { pos: [-297.3, 17, 22], at: [-298.3, 10.5, -16], fov: 40 } }, // v46 按原画反投影定的画境镜头：和龍湫（S03）同一个朝向，往左平移 0.66 幅（1260 右三分之一就是 1261 左三分之一）
  { id: 'S01', name: '四陽洞', photo: '1258', x: -337, z: -10, r: 20, fine: true,
    labels: [['四陽洞', -335.2, 12.2, -14.6], ['青島磯', -330.6, 9.2, -8.6]],
    view: { pos: [-339, 20.5, 12.5], at: [-339.5, 8.3, -14], fov: 40 } }, // v46：镜头在卷尾峡谷南壁上空往北看，北壁就是原画左下那面大绿坡，峡底藏在坡后
];

// 人物外观：robe 衣色, trim 领缘, hat: cap 高巾 / bun 发髻 / kid 双髻 / bald 僧 / scarf 幅巾
// routine: idle / patrol(points) / sit / sweep / meditate / lean(凭栏) / play(对弈)
export const PEOPLE = [
  // ── 玉女潭（P1 切片）──
  { id: 'lan', name: '凭栏者', stage: 'S08', pos: [7.6, 0, -9.6], y: 4.25, face: 0.15, robe: '#3f6f8c', trim: '#e9e0c8', hat: 'cap',
    routine: 'lean', control: false, borrow: { at: [36, 3.6, -14] },
    card: { eye: '玉光閣 · IMG_1266', title: '閣上凭栏人',
      body: ['玉光閣二楼的栏杆边，站着一位蓝衣人，正低头看潭。画里他只有米粒大小，却是整幅画的“眼睛”：顺着他的目光，正好落在玉女潭的水面上。',
             '中国山水画常在楼阁里安排一个凭栏远眺的人，看画的人会不知不觉代入他的位置，这叫“可游可居”。'],
      tip: '点“借他的眼睛”，从閣上俯瞰玉女潭。' },
    lines: ['此閣临潭而起，名曰玉光，取潭水映日之意。', '晨起水气上浮，岩壁湿润如玉，所以说“玉潭”。', '二位先生往潭边去了，你也下去走走吧。'] },
  { id: 'shi1', beard: true, name: '潭边白衣士', stage: 'S08', pos: [16, 0, -2.6], face: 1.9, robe: '#eeebe1', trim: '#34404a', hat: 'cap',
    routine: 'patrol', path: [[16, -2.6], [24, -1.4], [33, -0.6], [42, -2.2], [33, -0.6], [24, -1.4]], control: true,
    card: { img: '1266_figures.webp', eye: '玉光閣 · 玉女潭 · IMG_1266', title: '潭边二士',
      body: ['楼下两位白衣文士沿着潭边慢慢走，前方那片深色的水面就是玉女潭。',
             '玉女潭在今江苏宜兴，唐代已是名胜。明代文徵明为它写过记，记下这里的营建经过和各处景致，这卷画里的地名大多能和文中对上。',
             '画家把人画得只有指甲盖大，山石、古木和潭水才是主角，人是“游于其间”的一个点。'],
      tip: '按 F（手机点“接管”）就能操控他，走到别人身边按 E 互动。' },
    lines: ['潭深不见底，相传有玉女在此修炼，所以得名。', '你看那岩壁，竖纹一道一道，像是水从上面淌过留下的痕迹。', '过了潭，往左上去还有一道石阶，能登到高处。'] },
  { id: 'shi2', name: '潭边青巾士', stage: 'S08', pos: [14.6, 0, -1.6], face: 1.9, robe: '#e8e5da', trim: '#5f88a8', hat: 'scarf',
    routine: 'follow', leader: 'shi1', control: true,
    card: { img: '1266_figures.webp', eye: '玉光閣 · 玉女潭 · IMG_1266', title: '潭边二士 · 同游者',
      body: ['他和前面那位一同从玉光閣下来，落后半步，像是在听同伴讲这潭的来历。',
             '明代文人好结伴游山，回去再作诗作画。这卷“苏州片”画的正是这样一处供人游赏的园林化山居。'],
      tip: '接管他以后，走近同伴可以作揖、交谈或邀他同行。' },
    lines: ['兄台慢些，这潭边石滑。', '若在这里置一张琴，对着潭水弹一曲，岂不快哉。', '听说靈應亭上能看见云海，改日再去。'] },
  { id: 'jie', hold: 'staff', name: '石阶行人', stage: 'S08', pos: [2, 0, -24], face: 2.6, robe: '#7a4b3a', trim: '#e2d6bb', hat: 'scarf',
    routine: 'patrol', path: [[3, -20], [0, -28], [-3, -36], [-6, -44]], control: true, scale: 1,
    card: { eye: '玉光閣 · IMG_1266 左上', title: '石阶上的小人',
      body: ['画面左上，远山的石阶上有一个更小的人，正往山上的红楼走去。不仔细看几乎发现不了。',
             '“苏州片”常在远处藏这样的小人，让画面有远近，也让人愿意凑近一点点地找。'],
      tip: '接管他，可以沿着石阶一直走上山。' },
    lines: ['上面那组红楼是山中别院，从这条石阶上去最近。', '走累了就回头看看，玉女潭就在脚下。'] },

  // ── 其他区（灰盒阶段的占位人物，外观按原画）──
  { id: 'jin1', seat: 'straw', name: '洞中紫衣客', stage: 'S13', pos: [298, 0, -18], face: 0.9, robe: '#6b4a6e', trim: '#e9e0c8', hat: 'cap', routine: 'sit', control: true,
    card: { eye: '金晶巖 · IMG_1271', title: '金晶巖下，二客对坐', body: ['卷首的大岩洞里，一紫一白两位客人对坐闲谈，像在迎接展卷的人。洞顶垂着乳石，旁边题着“金晶巖”。'], tip: '按 F（手机点“接管”）可以操控他走出洞口，沿游线往左去大觀廊。' },
    lines: ['客从东来？这里是玉阳洞天的入口。', '一路往左走，景致一处比一处深。'] },
  { id: 'jin2', seat: 'straw', name: '洞中白衣客', stage: 'S13', pos: [300.4, 0, -19.6], face: -2.2, robe: '#eeebe1', trim: '#34404a', hat: 'cap', routine: 'sit', control: true,
    card: { eye: '金晶巖 · IMG_1271', title: '金晶巖下，二客对坐', body: ['白衣客侧身对着同伴，手里似乎拿着东西在讲。'], tip: '' },
    lines: ['金晶巖最胜，岩石在日光下闪闪如金。'] },
  { id: 'sao', dress: 'short', name: '扫地人', stage: 'S12', pos: [252, 0, -16.6], face: -1.4, robe: '#6a8aa6', trim: '#e2d6bb', hat: 'scarf', routine: 'sweep',
    path: [[240, -14], [252, -14]], control: true,
    card: { eye: '大觀廊 · IMG_1270', title: '廊院扫地人', body: ['大觀廊的院子里，一个蓝衣人低头扫地。山间廊院有人打理，才显得是“有人居住的洞天”。'], tip: '' },
    lines: ['这廊院环着库院建，回廊弯弯，叫大觀廊。', '落叶天天扫，天天有。'] },
  { id: 'du', seat: 'straw', hold: 'scroll', name: '读书人', stage: 'S12', pos: [277, 0, -49.5], face: 0.3, robe: '#a8443a', trim: '#e9e0c8', hat: 'cap', routine: 'sit', control: true,
    card: { eye: '大觀廊 · IMG_1270', title: '小屋红衣人', body: ['右上的小屋里坐着一位红衣人，像在读书。'], tip: '' },
    lines: ['嘘，正读到要紧处。'] },
  { id: 'tiao', dress: 'short', name: '挑担人', stage: 'S11', pos: [186, 0, 6], face: -1.5, robe: '#8a7a5a', trim: '#e2d6bb', hat: 'scarf', routine: 'patrol',
    path: [[178, 4], [195, 6], [210, 5]], control: true, carry: true,
    card: { eye: '沸玉橋 · IMG_1269', title: '竹径挑担人', body: ['竹林小径上一个人挑着担子，正要走上沸玉橋。桥下溪水湍急，所以叫“沸玉”。'], tip: '' },
    lines: ['担子沉，借个道。', '过了沸玉橋就是梅竹隩。'] },
  { id: 'liu1', seat: 'leopard', hold: 'scroll', name: '溪边展卷者', stage: 'S10', pos: [148, 0, -14], face: 0.5, robe: '#eeebe1', trim: '#34404a', hat: 'cap', routine: 'sit', control: true,
    card: { eye: '流觴嶼 · IMG_1268', title: '流觴嶼雅集', body: ['竹林里一条曲溪蛇行而过，七个人或坐或卧，有人展卷，有人倚竹。这是仿王羲之兰亭“曲水流觞”的文人雅集。'], tip: '' },
    lines: ['杯子漂到谁面前，谁就要吟一句。'] },
  { id: 'liu2', seat: 'leopard', name: '竹下卧者', stage: 'S10', pos: [156, 0, -16], face: -0.6, robe: '#d9d2c0', trim: '#3d5a4e', hat: 'scarf', routine: 'sit', control: true,
    card: { eye: '流觴嶼 · IMG_1268', title: '竹下斜卧', body: ['一人斜卧在竹下，看样子是酒喝多了。'], tip: '' },
    lines: ['且容我再睡片刻……'] },
  { id: 'liu3', hold: 'staff', name: '拄杖者', stage: 'S10', pos: [152, 0, -7], face: 3, robe: '#5c6f86', trim: '#e9e0c8', hat: 'cap', routine: 'idle', control: true,
    card: { eye: '流觴嶼 · IMG_1268', title: '拄杖而立', body: ['一人拄杖站在溪边，看着众人。'], tip: '' },
    lines: ['此地竹影清凉，正好避暑。'] },
  { id: 'liu4', hold: 'scroll', name: '捧卷童子', stage: 'S10', pos: [146, 0, -10], face: 1, robe: '#c9a45a', trim: '#e9e0c8', hat: 'kid', scale: 0.72, routine: 'idle', control: true,
    card: { eye: '流觴嶼 · IMG_1268', title: '捧卷童子', body: ['小童捧着书卷侍立一旁。'], tip: '' },
    lines: ['先生们要的卷子我都抱来了。'] },
  { id: 'ning1', name: '倚树文士', stage: 'S09', pos: [114, 0, -12], face: 2.6, robe: '#eeebe1', trim: '#34404a', hat: 'cap', routine: 'idle', control: true,
    card: { img: '1267_elders.webp', eye: '凝玉亭 · IMG_1267', title: '玉樹湍边四文士', body: ['四位文士倚着玉樹湍边缠满藤的老树闲谈。'], tip: '' },
    lines: ['这棵老树怕有几百年了。'] },
  { id: 'ning2', name: '红衣文士', stage: 'S09', pos: [116, 0, -10.5], face: -2.2, robe: '#a8443a', trim: '#e9e0c8', hat: 'cap', routine: 'idle', control: true,
    card: { eye: '凝玉亭 · IMG_1267', title: '玉樹湍边四文士', body: ['红衣文士正和同伴说话。'], tip: '' },
    lines: ['那两只鹤是这里养的，从不飞远。'] },
  { id: 'tong', hold: 'box', name: '捧盒童子', stage: 'S09', pos: [106, 0, -4], face: 0.4, robe: '#c9a45a', trim: '#b5432f', hat: 'kid', scale: 0.72, routine: 'patrol',
    path: [[106, -4], [110, 0], [104, 2]], control: true,
    card: { img: '1267_kids.webp', eye: '凝玉亭 · IMG_1267', title: '鹤与童子', body: ['空地上两只仙鹤踱步，小童捧着红色的食盒，大概是给树下几位送茶点的。'], tip: '' },
    lines: ['鹤要吃食了，别吓着它们。'] },

  { id: 'yi1', seat: 'straw', name: '对弈者', stage: 'S07', pos: [-66.7, 0, -14.3], face: 1.6, robe: '#eeebe1', trim: '#34404a', hat: 'cap', routine: 'sit', control: true,
    card: { img: '1265_figures.webp', eye: '磐玉隈 · IMG_1265', title: '磐玉隈下，二人对弈',
      body: ['磐玉隈的巨石凹进去一块，正好遮出一片荫凉。两位白衣人席地对坐下棋，旁边一个小童拿着杆子站着看。',
             '洞天、山石、看棋的人，很容易让人想起王质入山观棋、回头斧柄已经烂掉的“烂柯”故事。'], tip: '' },
    lines: ['观棋不语。', '这一手下去，怕是要烂柯了。'] },
  { id: 'yi2', seat: 'straw', name: '对弈者', stage: 'S07', pos: [-64.3, 0, -14.3], face: -1.6, robe: '#e8e5da', trim: '#5f88a8', hat: 'cap', routine: 'sit', control: true,
    card: { eye: '磐玉隈 · IMG_1265', title: '磐玉隈下，二人对弈', body: ['另一位对弈者正低头想棋。'], tip: '' },
    lines: ['且慢，容我想想。'] },
  { id: 'yi3', name: '观棋童子', stage: 'S07', pos: [-67.9, 0, -16.4], face: 0.7, robe: '#8a5a3a', trim: '#e9e0c8', hat: 'kid', scale: 0.72, routine: 'idle', control: true,
    card: { eye: '磐玉隈 · IMG_1265', title: '观棋童子', body: ['小童拿着杆子站在一旁看棋。'], tip: '' },
    lines: ['我看白子要输。'] },
  { id: 'hong', name: '红衣行人', stage: 'S07', pos: [-27.5, 0, -33], face: -2.4, robe: '#b5432f', trim: '#e9e0c8', hat: 'scarf', routine: 'patrol',
    path: [[-20.5, -25.5], [-23.5, -29], [-27.5, -33], [-31, -38.5]], control: true,
    card: { eye: '磐玉隈 · IMG_1265 右上', title: '松林间的红衣人', body: ['右上松林里有一个红衣小人，像在赶路。'], tip: '' },
    lines: ['往上是縹緲亭，路陡，当心。'] },
  { id: 'deng', hold: 'staff', name: '登山者', stage: 'S06', pos: [-112.3, 0, -15.1], face: -2.4, robe: '#eeebe1', trim: '#34404a', hat: 'cap', routine: 'patrol',
    path: [[-108, -12.3], [-112.3, -15.1], [-116.5, -13.4], [-118.4, -12.2], [-120, -16.5], [-118.9, -21], [-115.4, -26.9], [-114.8, -30.3]], control: true, // v34 原画白衣人在峡中石阶上
    card: { eye: '琪樹峡 · IMG_1264', title: '穿峡登山', body: ['一位白衣人肩上挑着小包袱，沿着石阶穿过琪樹峡往上走。'], tip: '' },
    lines: ['縹緲亭在云里，上去就能看见芙蓉城。'] },
  { id: 'zuo', seat: 'cushion', name: '打坐者', stage: 'S05', pos: [-160.27, 0, -19.83], face: -0.6, robe: '#b5432f', trim: '#e9e0c8', hat: 'bun', routine: 'meditate', control: true,
    card: { eye: '超然亭 · IMG_1263', title: '超然亭中打坐', body: ['云海中的超然亭里，一位红衣人闭目打坐。'], tip: '' },
    lines: ['……', '心远地自偏。'] },
  { id: 'zhang', hold: 'staff', name: '拄杖长者', stage: 'S05', pos: [-147.5, 0, -20.4], face: -2.4, robe: '#ece6d6', trim: '#8a7a5a', hat: 'bun', routine: 'patrol',
    path: [[-148, -21], [-145, -17.5], [-142, -13.1], [-139, -8.8]], control: true,
    card: { eye: '超然亭 · IMG_1263', title: '长者与童子', body: ['白衣长者拄杖而行，黄衣童子背着东西跟在后面。'], tip: '' },
    lines: ['超然亭就在前头，歇歇脚再走。', '左边那根石柱叫二姑峰。'] },
  { id: 'zhangt', hold: 'basket', name: '背物童子', stage: 'S05', pos: [-146, 0, -18.6], face: -2.4, robe: '#c9a45a', trim: '#e9e0c8', hat: 'kid', scale: 0.72, routine: 'follow', leader: 'zhang', control: true,
    card: { eye: '超然亭 · IMG_1263', title: '背物童子', body: ['童子背着琴囊或书箱，跟着长者。'], tip: '' },
    lines: ['先生走慢些！'] },
  { id: 'seng1', seat: 'cushion', name: '禪窩僧人', stage: 'S04', pos: [-233.2, 0, -3.6], face: 1.4, robe: '#8a6a4a', trim: '#5a3a2a', hat: 'bald', routine: 'sit', control: true,
    card: { eye: '觀音岩 · IMG_1262', title: '禪窩二僧', body: ['山脚的瓦屋叫禪窩，两位僧人对坐其中，屋前一个侍者在煮茶。屋左后方的坡上立着一尊白衣观音石像，四根细长红柱撑起尖顶龛罩着，旁边幡杆挂着黄幡。转过身，游线对面的崖上凿了一座大龛，同样的观音像放大到三十多米高。'], tip: '' },
    lines: ['阿弥陀佛。'] },
  { id: 'seng2', seat: 'cushion', name: '禪窩僧人', stage: 'S04', pos: [-231.95, 0, -3.7], face: -1.7, robe: '#7a5a3a', trim: '#5a3a2a', hat: 'bald', routine: 'sit', control: true,
    card: { eye: '觀音岩 · IMG_1262', title: '禪窩二僧', body: ['另一位僧人合十。'], tip: '' },
    lines: ['施主从仙境下来，入佛地了。'] },
  { id: 'zentong', dress: 'short', name: '煮茶侍者', stage: 'S04', pos: [-235.9, 0, -1.4], face: 1.6, robe: '#e6e0cf', trim: '#5a4a3a', hat: 'kid', routine: 'idle', control: true,
    card: { eye: '觀音岩 · IMG_1262', title: '煮茶侍者', body: ['禪窩门前左边，一个侍者弯腰守着茶炉，旁边一只水桶。'], tip: '' },
    lines: ['水快开了，师父们稍等。'] },
  { id: 'chuan', dress: 'short', name: '撑篙人', stage: 'S03', pos: [-256, 0, -12], face: 0, robe: '#d9cba8', trim: '#5a3a2a', hat: 'scarf', routine: 'boat', control: false,
    card: { eye: '龍湫对岸', title: '潭上撑船', body: ['龍湫对岸一道石壁，瀑布从崖口出来贴崖落进深潭。两个童子坐在小船上，一人站着撑篙，绕着潭来回。原画没有这一景，是游园里添的；原画的船泊在对面的岩洞里，三人坐着，一人撑篙。'], tip: '' },
    lines: ['坐稳了！'] },
  { id: 'xi1', seat: 'straw', name: '洞中客', stage: 'S02', pos: [-301.0, 0, -21.4], face: 1.4, robe: '#9a8fb0', trim: '#e9e0c8', hat: 'cap', routine: 'sit', control: true,
    card: { eye: '水犀洞 · IMG_1260', title: '水犀洞中对谈', body: ['水犀洞是一座双头尖峰，正面劈开一道深龛，龛里一块石台，一位紫衣、一位白衣对坐清谈。龛下石缝里长着垂草，峰脚堆着几块石青石。'], tip: '' },
    lines: ['此洞冬暖夏凉。'] },
  { id: 'xi2', seat: 'straw', name: '洞中客', stage: 'S02', pos: [-299.8, 0, -21.7], face: -1.7, robe: '#eeebe1', trim: '#34404a', hat: 'cap', routine: 'sit', control: true,
    card: { eye: '水犀洞 · IMG_1260', title: '水犀洞中对谈', body: ['另一人拱手作答。'], tip: '' },
    lines: ['前面就是四陽洞，卷尾了。'] },
  { id: 'wang', hold: 'staff', name: '望洞者', stage: 'S01', pos: [-337.4, 0, -9.6], face: 2.9, robe: '#a58a68', trim: '#5a4632', hat: 'cap', routine: 'idle', control: true,
    card: { eye: '四陽洞 · IMG_1258', title: '四陽洞前', body: ['全卷最后一景：赭色岩脚上几孔拱洞连在一起，水从洞里一级级跌出来，汇成一条溪往右下流去。一人肩上扛着杖，立在溪边望着洞口。溪右那块平坡题着“青島磯”。游到这里，一卷也就收了。'], tip: '' },
    lines: ['洞中溪水层层流出，不知源头在哪里。', '一路辛苦，从卷首到卷尾，玉阳洞天都走遍了。'] },
];

// 走近另一人物时的可选动作
export const ACTIONS = [
  { id: 'talk', label: '交谈' },
  { id: 'bow', label: '作揖' },
  { id: 'walk', label: '同行' },
  { id: 'sit', label: '邀坐' },
];
