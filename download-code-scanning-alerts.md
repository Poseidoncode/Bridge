# 下載 GitHub 代碼掃描警報教學

本教學將指導您如何使用 GitHub CLI 下載指定倉庫的代碼掃描警報，並將其保存為 JSON 文件。

## 前置條件

- 安裝 Homebrew（macOS 套件管理器）
- GitHub 帳戶

## 步驟 1: 安裝 GitHub CLI

如果您的系統尚未安裝 GitHub CLI，請先安裝它：

```bash
brew install gh
```

## 步驟 2: 登入 GitHub CLI

下載警報需要認證您的 GitHub 帳戶。運行以下命令並按照提示操作：

```bash
gh auth login
```

- 選擇 `GitHub.com`（除非您使用 GitHub Enterprise）
- 選擇認證方法（推薦使用瀏覽器登入或個人訪問令牌）

登入成功後，您可以檢查狀態：

```bash
gh auth status
```

## 步驟 3: 下載代碼掃描警報

使用 GitHub API 端點下載警報。將以下命令中的 `Poseidoncode/Bridge` 替換為您的倉庫名稱：

```bash
gh api /repos/Poseidoncode/Bridge/code-scanning/alerts > alerts.json
```

此命令將：

- 從 `Poseidoncode/Bridge` 倉庫獲取代碼掃描警報
- 以 JSON 格式輸出
- 保存到當前目錄的 `alerts.json` 文件中

## 步驟 4: 驗證下載結果

檢查文件是否成功創建：

```bash
ls -la alerts.json
```

查看文件內容（前幾行）：

```bash
head alerts.json
```

## 故障排除

### 錯誤："command not found: gh"

- 確保已安裝 GitHub CLI（參見步驟 1）

### 錯誤："You are not logged into any GitHub hosts"

- 運行 `gh auth login` 登入（參見步驟 2）

### 錯誤："Not Found" 或 API 錯誤

- 確認倉庫名稱正確
- 確保您有權限訪問該倉庫
- 檢查倉庫是否啟用了代碼掃描

### 原始命令無效

- GitHub CLI 沒有 `code-scanning` 子命令
- 使用 `gh api` 替代，如教學中所示

## 相關資源

- [GitHub CLI 文檔](https://cli.github.com/)
- [GitHub Code Scanning API](https://docs.github.com/en/rest/code-scanning)

完成這些步驟後，您將成功下載代碼掃描警報到本地文件。
