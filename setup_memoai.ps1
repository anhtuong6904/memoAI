# ================================================================
# Script chuẩn hóa cấu trúc MemoAI từ Expo default template
# Chạy trong PowerShell tại: d:\...\MemoAI\MemoAI
# ================================================================

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Chuẩn hóa cấu trúc MemoAI" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# ── BƯỚC 1: XÓA THỨ KHÔNG CẦN ──────────────────────────────
Write-Host "[1/5] Xóa file/thư mục Expo default không dùng..." -ForegroundColor Yellow

# Xóa thư mục app/ (Expo file-based router — không dùng)
if (Test-Path "app") {
    Remove-Item -Recurse -Force "app"
    Write-Host "  ✓ Đã xóa app/ (expo file router)" -ForegroundColor Gray
}

# Xóa thư mục scripts/ (helper scripts của Expo)
if (Test-Path "scripts") {
    Remove-Item -Recurse -Force "scripts"
    Write-Host "  ✓ Đã xóa scripts/" -ForegroundColor Gray
}

# Xóa components/ mặc định của Expo (sẽ tạo lại trong src/)
if (Test-Path "components") {
    Remove-Item -Recurse -Force "components"
    Write-Host "  ✓ Đã xóa components/ mặc định" -ForegroundColor Gray
}

# Xóa constants/ mặc định của Expo (sẽ tạo lại trong src/)
if (Test-Path "constants") {
    Remove-Item -Recurse -Force "constants"
    Write-Host "  ✓ Đã xóa constants/ mặc định" -ForegroundColor Gray
}

# Xóa hooks/ mặc định của Expo (sẽ tạo lại trong src/)
if (Test-Path "hooks") {
    Remove-Item -Recurse -Force "hooks"
    Write-Host "  ✓ Đã xóa hooks/ mặc định" -ForegroundColor Gray
}

Write-Host ""

# ── BƯỚC 2: TẠO CẤU TRÚC src/ ──────────────────────────────
Write-Host "[2/5] Tạo cấu trúc src/..." -ForegroundColor Yellow

$srcDirs = @(
    "src\screens",
    "src\components",
    "src\services",
    "src\hooks",
    "src\constants",
    "src\types"
)
foreach ($dir in $srcDirs) {
    New-Item -ItemType Directory -Path $dir -Force | Out-Null
    Write-Host "  ✓ $dir" -ForegroundColor Gray
}

Write-Host ""

# ── BƯỚC 3: TẠO FILE SRC/ ───────────────────────────────────
Write-Host "[3/5] Tạo file src/..." -ForegroundColor Yellow

$srcFiles = @(
    # Types
    "src\types\index.ts",
    # Constants
    "src\constants\colors.ts",
    "src\constants\config.ts",
    # Services
    "src\services\api.ts",
    # Hooks
    "src\hooks\useNotes.ts",
    # Screens
    "src\screens\HomeScreen.tsx",
    "src\screens\CaptureScreen.tsx",
    "src\screens\DetailScreen.tsx",
    "src\screens\SearchScreen.tsx",
    "src\screens\RemindersScreen.tsx",
    # Components
    "src\components\NoteCard.tsx",
    "src\components\TagPill.tsx",
    "src\components\SearchBar.tsx",
    "src\components\LoadingSpinner.tsx",
    "src\components\EmptyState.tsx"
)
foreach ($file in $srcFiles) {
    New-Item -ItemType File -Path $file -Force | Out-Null
    Write-Host "  ✓ $file" -ForegroundColor Gray
}

Write-Host ""

# ── BƯỚC 4: TẠO BACKEND ─────────────────────────────────────
Write-Host "[4/5] Tạo backend/..." -ForegroundColor Yellow

$backendDirs = @(
    "backend\routes",
    "backend\db",
    "backend\uploads",
    "backend\middleware"
)
foreach ($dir in $backendDirs) {
    New-Item -ItemType Directory -Path $dir -Force | Out-Null
    Write-Host "  ✓ $dir" -ForegroundColor Gray
}

$backendFiles = @(
    "backend\server.js",
    "backend\.env",
    "backend\routes\notes.js",
    "backend\routes\reminders.js",
    "backend\db\database.js",
    "backend\middleware\upload.js",
    "backend\uploads\.gitkeep"
)
foreach ($file in $backendFiles) {
    New-Item -ItemType File -Path $file -Force | Out-Null
    Write-Host "  ✓ $file" -ForegroundColor Gray
}

Write-Host ""

# ── BƯỚC 5: TẠO App.tsx + .gitignore ────────────────────────
Write-Host "[5/5] Tạo App.tsx và .gitignore..." -ForegroundColor Yellow

# Đổi App.js → App.tsx nếu còn tồn tại
if (Test-Path "App.js") {
    Rename-Item -Path "App.js" -NewName "App.tsx" -Force
    Write-Host "  ✓ App.js → App.tsx" -ForegroundColor Gray
} elseif (-not (Test-Path "App.tsx")) {
    New-Item -ItemType File -Path "App.tsx" -Force | Out-Null
    Write-Host "  ✓ App.tsx (tạo mới)" -ForegroundColor Gray
} else {
    Write-Host "  ✓ App.tsx (đã tồn tại)" -ForegroundColor Gray
}

# Ghi .gitignore
$gitignore = @"
# Dependencies
node_modules/
backend/node_modules/

# Expo
.expo/
dist/
web-build/
.expo-shared/

# Env
.env
backend/.env

# Uploads & Database
backend/uploads/*
!backend/uploads/.gitkeep
backend/*.db

# OS
.DS_Store
Thumbs.db

# Logs
*.log
npm-debug.log*
"@
Set-Content -Path ".gitignore" -Value $gitignore -Encoding UTF8
Write-Host "  ✓ .gitignore" -ForegroundColor Gray

# ── HOÀN THÀNH ───────────────────────────────────────────────
Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  DONE! Cấu trúc đã chuẩn hóa xong" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Cấu trúc hiện tại:" -ForegroundColor White
Write-Host @"
MemoAI/
├── App.tsx                  ← Entry point
├── app.json                 ← Giữ nguyên
├── tsconfig.json            ← Giữ nguyên
├── package.json
├── assets/                  ← Giữ nguyên
├── src/
│   ├── types/index.ts
│   ├── constants/
│   │   ├── colors.ts
│   │   └── config.ts
│   ├── services/api.ts
│   ├── hooks/useNotes.ts
│   ├── screens/
│   │   ├── HomeScreen.tsx
│   │   ├── CaptureScreen.tsx
│   │   ├── DetailScreen.tsx
│   │   ├── SearchScreen.tsx
│   │   └── RemindersScreen.tsx
│   └── components/
│       ├── NoteCard.tsx
│       ├── TagPill.tsx
│       ├── SearchBar.tsx
│       ├── LoadingSpinner.tsx
│       └── EmptyState.tsx
└── backend/
    ├── server.js
    ├── .env
    ├── routes/
    ├── db/
    ├── middleware/
    └── uploads/
"@ -ForegroundColor Gray

Write-Host ""
Write-Host "Bước tiếp theo — chạy lần lượt:" -ForegroundColor Cyan
Write-Host ""
Write-Host "  [Frontend] cài thư viện:" -ForegroundColor White
Write-Host "  npx expo install @react-navigation/native @react-navigation/bottom-tabs @react-navigation/native-stack react-native-screens react-native-safe-area-context expo-image-picker expo-av expo-file-system expo-notifications axios" -ForegroundColor Gray
Write-Host ""
Write-Host "  [Frontend] cài TypeScript types:" -ForegroundColor White
Write-Host "  npm install --save-dev @types/react @types/react-native" -ForegroundColor Gray
Write-Host ""
Write-Host "  [Backend] cài thư viện:" -ForegroundColor White
Write-Host "  cd backend && npm init -y && npm install express cors multer better-sqlite3 dotenv && npm install -D nodemon" -ForegroundColor Gray
Write-Host ""
