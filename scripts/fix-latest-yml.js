// scripts/fix-latest-yml.js
const fs = require("fs");
const crypto = require("crypto");
const yaml = require("yaml");
const path = require("path");

// 修改为你构建输出目录路径
const distDir = path.resolve(__dirname, "../dist");

// 找到 .exe 和 latest.yml
const files = fs.readdirSync(distDir);
const exeFile = files.find(f => f.endsWith(".exe"));
const ymlFile = files.find(f => f === "latest.yml");

if (!exeFile || !ymlFile) {
  console.error("❌ 未找到 .exe 或 latest.yml 文件");
  process.exit(1);
}

const exePath = path.join(distDir, exeFile);
const ymlPath = path.join(distDir, ymlFile);

// 计算 .exe 的实际 sha512
const exeBuffer = fs.readFileSync(exePath);
const actualSha512 = crypto.createHash("sha512").update(exeBuffer).digest("base64");

// 修改 latest.yml 内容
const ymlContent = fs.readFileSync(ymlPath, "utf8");
const ymlParsed = yaml.parse(ymlContent);

ymlParsed.sha512 = actualSha512;

if (Array.isArray(ymlParsed.files)) {
  ymlParsed.files.forEach(file => {
    if (file.url === exeFile) {
      file.sha512 = actualSha512;
    }
  });
}

// 写回
fs.writeFileSync(ymlPath, yaml.stringify(ymlParsed), "utf8");

console.log("✅ 修复成功：已更新 latest.yml 的 sha512 为:");
console.log(actualSha512);
