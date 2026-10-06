# UI preview checkpoint — 2026-10-03

用户要求先保存当前工作，重启电脑后继续。当前修改已写入本地文件，未 commit、push 或部署。

## 项目目录

`D:\xwechat_files\wxid_buvgkzhgz22922_6766\msg\file\2026-08\AA-PKD-Nutrition-App\web`

聊天绑定的 `AA_PKD Direct Study.xlsx` 不是实际代码目录。请在上面的 web 目录运行命令。

## 本轮 UI 修改

- 已读取用户指定的 `D:\.codex\skills\frontend-design\SKILL.md`。
- 方向为 Swiss：白色、中性灰、深蓝 `#002FA7`、Helvetica 系列无衬线、细分隔线和突出的营养数字。
- `src/preview-design.css`：集中保存新的预览样式；桌面侧边导航、移动端顶部导航、今日营养布局、食谱卡片和详情页样式。
- `src/main.jsx`：在原样式后引入预览样式。
- `src/App.jsx`：侧栏增加现有用户姓名与资料入口。
- `src/components/RecipeLibrary.jsx`：默认图片卡片、卡片/表格切换、高级筛选折叠、真实食谱数量展示；沿用已有筛选逻辑和操作回调。

此前 USDA 后端、dataset、份量缩放和审核功能的未提交修改仍在同一工作区，必须保留，不能 reset/覆盖。

## 已验证与待完成

- 本轮 `npm run build` 已通过。
- 构建仍有大于 500 KB 的 bundle 提示。
- **新版 UI 尚未做浏览器视觉检查和交互回归，不能宣称预览已验收。**
- 重启后继续：检查 desktop / 390px mobile，今日页、食谱卡片/表格、高级筛选、详情页、Add meal 和 profile；修复布局问题后交付本地预览。
- 前一轮后端的 80 项测试结果不代表本轮 UI 的浏览器验证。

## 重启后启动

在项目目录分别开两个终端：

```powershell
npm run dev:api
```

```powershell
npm run dev
```

预览地址：`http://127.0.0.1:5173/`。API 默认 `http://127.0.0.1:8787/`，无密钥时使用公开 USDA 快照。

无需读取私密 env，也无需部署。重启会结束本地开发服务，但不会丢失这些已保存的文件。
