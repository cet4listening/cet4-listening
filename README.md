# 四级听力真题 · 近三年汇总（网页版）

把 2023 年 12 月 — 2026 年 6 月共 6 场考试、12 套四级听力真题做成了一个本地网页：
按年份分组的套题卡片、在线播放整套听力、逐题题干与 A–D 选项、点选作答、显示答案，
以及独立的「答案速查」区（按套展开 25 题答案）。全部静态文件，双击即用，不需要联网。

## 怎么用

- **主地址（推荐，GitHub Pages）**：**https://zhixiao-xjy.github.io/cet4-listening/** —— 永久在线、不依赖任何电脑开机，手机 / iPad / 电脑都能访问，支持 HTTP Range（进度条拖动、跳篇都正常）。代码仓库：https://github.com/ZHIXIAO-XJY/cet4-listening
- **备用地址（Surge 镜像）**：**https://cet4-listening.surge.sh** —— 同一站点的镜像，同样支持 Range。注意 Surge 免费版在账号异常时可能「暂停」站点（返回 403），此时用上面的主地址即可。
  账号、密码、token 和「以后怎么更新」写在项目根目录的 `网站账号信息.md` 里。
- **更新 GitHub Pages 主地址**（改完文件后）：

  ```powershell
  cd cet4-listening
  git add -A
  git commit -m "更新内容"
  git push          # 若网络需要代理：git -c http.proxy=http://127.0.0.1:7890 push
  ```

  推上去后 GitHub 会自动重新构建，1–2 分钟后生效。
- **离线用**：双击 `index.html`（Chrome / Edge / Firefox 均可）。音频在 `audio/` 目录，相对路径加载，断网也能播。
- **更新 Surge 镜像**（只传变化的部分，几秒到几分钟）：

  ```powershell
  $env:SURGE_TOKEN = "441611009fafdcd60dda5a685a673cf5"
  node tools\surge-cli\node_modules\surge\bin\surge cet4-listening cet4-listening.surge.sh
  ```

- **同局域网看（备用）**：在电脑上起服务，让手机连同一个 Wi-Fi / 热点后访问电脑的局域网地址：

  ```powershell
  node tools\serve.js 8777          # 打印 http://127.0.0.1:8777 和 LAN: http://<电脑IP>:8777
  ```

  > `127.0.0.1` 永远指「打开网页的那台设备自己」，在 iPad / 手机上访问不到电脑，必须用打印出来的 `172.x.x.x` / `192.168.x.x`。
  > 连不上先检查防火墙是否放行 8777：`netsh advfirewall firewall add rule name="CET4 Listening 8777" dir=in action=allow protocol=TCP localport=8777`

- **临时公网隧道（备用，现已关闭）**：双击 `启动公网访问.cmd` 会起 Cloudflare 临时隧道，得到 `https://xxx.trycloudflare.com` 地址；缺点是电脑关机就失效、每次地址会变，只适合临时分享。关掉用 `停止公网访问.cmd`。
- **注意 Range 支持**：静态服务器必须支持 HTTP Range，否则音频能播但拖动进度条 / 跳篇会失效（Python 自带的 `http.server` 就不支持）。仓库里的 `tools/serve.js`、Surge、GitHub Pages 都支持。
## 功能

| 功能 | 说明 |
|---|---|
| 年份筛选 | 顶部「全部 12 / 2026年6月 2套 / …」胶囊按钮，点一下只看该场考试 |
| 选套播放 | 每张卡片右侧「播放」，底部出现播放器，播放整套听力音频 |
| 展开题目 | 点卡片标题展开：8 个「材料」快捷跳转标签 + 三个 Section 的 25 题题干与选项 |
| 自主选择 | 点选项即记录作答（本机 localStorage 保存，刷新不丢）；再点一次取消 |
| 显示答案 | 每套内「显示答案」：正确选项标绿，选错的标红 |
| 逐题跳听 | 点材料标签或题号，音频跳到该材料开头并开始播放 |
| 答案速查 | 右上「答案速查」：按套折叠的 25 格答案表，同时显示你的作答与正确率 |
| 播放器 | 播放/暂停、±15 秒、可拖动进度条、0.75×–2× 倍速（倍速记忆） |
| 快捷键 | 播放器出现时：空格 播放/暂停，← / → 后退/前进 15 秒 |

## 目录结构

```
cet4-listening/
├── index.html          页面骨架
├── assets/style.css    样式
├── assets/app.js       交互（筛选、展开、作答、播放器、答案速查）
├── data.js             题库数据（由 tools/build_data.py 生成，勿手改）
├── public-url.txt      最近一次公网访问地址（启动公网访问后自动写入）
└── audio/              12 套音频，每套约 16MB（96kbps 单声道 mp3，约 24 分钟）
    ├── 2023-12-1.mp3 … 2026-06-2.mp3
```

项目根目录还有几个双击即用的文件：`启动局域网访问.cmd`（同一 Wi-Fi 内手机访问）、`启动公网访问.cmd`（任何网络可访问，基于 Cloudflare 临时隧道）、`查看公网地址.cmd`（打印/打开当前公网地址）、`停止公网访问.cmd`（关掉隧道）。守护与开机自启相关脚本：`tools/keep-tunnel.ps1`、`tools/start-hidden.vbs`、`tools/stop-public.ps1`、`tools/public-share.ps1`，日志 `tools/bin/keep-tunnel.log`。

## 数据说明

- **覆盖范围**：2023-12、2024-06、2024-12、2025-06、2025-12、2026-06 六场考试，每场 2 套，
  共 12 套 / 300 题。每套 25 题，分 Section A 短篇新闻（1–7）、B 长对话（8–15）、C 听力篇章（16–25）。
- **来源**：题目、答案与音频取自公开的在线真题页面 `english-exam.lazynote.cn`；
  音频原始流为 HLS，这里转成 96kbps 单声道 mp3 方便本地保存与播放。
- **答案校验**：6 套「第一套」的 150 道答案与另一份独立整理的题库（GitHub `123xzw999/cet4-exam-quiz`，
  由真题 PDF 转换，其中 3 套另经新东方答案页核对）逐题比对，题目文本与答案 **150/150 一致**。
- 每场考试公开流传的通常只有两套听力，第三套没有公开音频，所以页面只收两套。

## 更新 / 重新生成数据

工具脚本在仓库的 `tools/` 下（依赖 ffmpeg、Python + lxml）：

1. `tools/parse_pages.py` — 把已抓取的真题 HTML（`site/pages/`）解析成 `site/parsed/all_sets.json`；
2. `tools/fetch_audio.ps1` — 用 ffmpeg 把每套 HLS 音频转成本地 mp3，写 `site/audio_manifest.json`；
3. `tools/build_data.py` — 合并成 `cet4-listening/data.js`（排序、分 Section、校验每套 25 题）；
4. `tools/serve.js` — 本地预览用的小静态服务（支持 Range，方便拖动进度）。

改完题库后重新跑第 3 步、刷新页面即可；作答记录存在浏览器里，不受影响。
数据自检脚本：`tools/compare_sources.py`（把本题库与另一份独立来源逐题比对题干/答案）。

## 已知限制

- 音频是转码后的 96kbps 单声道，够听清但非原始音质；每套约 16MB，12 套共约 200MB。
- 材料级时间轴（8 段）来自站点的段落标注，不是逐题精确切点，所以「逐题跳听」会跳到该材料开头。
- 题目版权归原出版方，本页面仅供个人学习使用，请勿商用或再分发。
- 线上托管：主地址 GitHub Pages（仓库 <1GB、单文件 <100MB），备用镜像 Surge 免费版（450MB / 10,100 文件，当前 194MB）。两边都不依赖本机开机。
