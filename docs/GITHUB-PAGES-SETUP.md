# GitHub Pages 配置说明（解决 404）

若访问 **https://haydenbilibili-maker.github.io/3body/** 出现 **「There isn't a GitHub Pages site here.」**，按下面步骤检查。

---

## 1. 开启 Pages 并选择 GitHub Actions

1. 打开仓库：**https://github.com/haydenbilibili-maker/3body**
2. 点击 **Settings** → 左侧 **Pages**
3. 在 **Build and deployment** 里：
   - **Source** 选择 **GitHub Actions**（不要选 “Deploy from a branch”）
4. 保存（无需填其他项）

---

## 2. 确认 workflow 已推送并运行成功

- 仓库根目录下应有 **`.github/workflows/deploy-pages.yml`**
- 若尚未推送，在本地执行：
  ```bash
  git add .github/workflows/deploy-pages.yml
  git commit -m "ci: GitHub Pages 部署"
  git push origin main
  ```
- 打开 **Actions** 页：https://github.com/haydenbilibili-maker/3body/actions  
  查看 **Deploy to GitHub Pages** 是否在 push 后运行并**成功**（绿色勾）。

---

## 3. 首次部署后等待 1～2 分钟

第一次部署或刚改完 Source 后，页面可能需 1～2 分钟才生效，请稍等再访问。

---

## 4. 访问地址

- 项目站（本项目）：**https://haydenbilibili-maker.github.io/3body/**
- 若仍 404，请确认：
  - Settings → Pages → Source = **GitHub Actions**
  - Actions 里最后一次 “Deploy to GitHub Pages” 为**成功**
  - 使用的链接带末尾斜杠：`/3body/`
