# 玉阳洞天游园

据仇英（款）《玉阳洞天图卷》复原的青绿山水 3D 场景。在浏览器里自由游览画中景致，点人物看介绍，接管人物与他人互动，看昼夜流转。

**作者**：李揚 YANG LI 与 Claude · GitHub [@cookyecat](https://github.com/cookyecat) · X [@myannli](https://x.com/myannli)

游到卷尾四陽洞外的望云台，立崖上有作者题刻。游人的「题名壁」在玉女潭玉光閣西边的路旁，可以留下名字（后端见 `guestbook/`）。

- 电脑：WASD 移动，按住鼠标拖动转向，Tab 看游线图，V 画境视角，T 拨时辰，H 查看全部操作
- 手机：左下按住出摇杆，右侧拖动转向，双指上下拖动升降
- 中英文：右上角 EN / 中文 按钮切换；默认按浏览器语言（偏好里有中文就中文，否则英文），选过一次会记住。链接加 `?lang=en` 直接打开英文版（`?lang=zh` 中文版），例：<https://art.starverse.chat/?lang=en>。英文文案在 `js/lang_en.js`（地名、人物、台词）和 `index.html` 里 `class="en"` 的那几段

## 来源与致谢

- 原作：仇英（款）《玉阳洞天图卷》，天津博物馆藏。
- 原画照片：作者在博物馆展厅实拍，仅用于本作的学习、教学与非商业展示。
- 渲染：[three.js](https://threejs.org/) r170（MIT 许可，见 `vendor/three/LICENSE`）。
- 题名壁后端：Cloudflare Workers + D1，代码和部署步骤在 `guestbook/`。
- 字体：马善政楷书 Ma Shan Zheng、思源宋体 Noto Serif SC，SIL Open Font License 1.1，已按本作用字子集化；落款和印章用霞鹜文楷 TC（LXGW WenKai TC，OFL 1.1），只含落款用字。英文界面用 Source Serif 4 和 Cormorant Garamond（均为 OFL 1.1，fontsource 的 latin 子集）。

本项目为个人作品与教学展示，非商业用途。

## 本地运行

纯静态网站，没有构建步骤。因为用了 ES 模块，需要通过 HTTP 打开，不能直接双击 index.html：

```
python3 -m http.server 8000
# 浏览器打开 http://localhost:8000
```

## English

*Yuyang Dongtian Garden Walk* rebuilds the Ming handscroll *Yuyang Dongtian* (bearing the signature of Qiu Ying, Tianjin Museum) as a walkable blue-and-green 3D landscape in the browser. Made by Yang Li with Claude. Play in English: <https://art.starverse.chat/?lang=en> (the EN / 中文 button at top right switches language at any time).
