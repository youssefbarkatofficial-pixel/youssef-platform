import fs from 'fs';

let content = fs.readFileSync('v2-app/src/lib/contentRules.ts', 'utf8');

// import from cairoTime
const importCairo = "export { tzOffsetMs, cairoToUtcMs, cairoInputToUtcMs, formatCairoDateTime } from './cairoTime';\n";
if (!content.includes("from './cairoTime'")) {
  content = importCairo + content;
}

// update LockStatus reason
content = content.replace("reason?: 'prerequisite' | 'openAt' | 'watch' | 'notEnrolled';", "reason?: 'prerequisite' | 'openAt' | 'closeAt' | 'watch' | 'notEnrolled';\n  closeAt?: number;");

// update checkLectureLock
const oldLecLock = `  if (typeof currentLecture.openAt === 'number' && currentLecture.openAt > serverTime) {
    return {
      locked: true,
      reason: 'openAt',
      message: \`بيفتح يوم \${formatCairoDateTime(currentLecture.openAt)}\`,
      openAt: currentLecture.openAt
    };
  }`;

const newLecLock = `  if (typeof currentLecture.openAt === 'number' && currentLecture.openAt > serverTime) {
    return {
      locked: true,
      reason: 'openAt',
      message: \`يفتح يوم \${formatCairoDateTime(currentLecture.openAt)}\`,
      openAt: currentLecture.openAt
    };
  }

  if (typeof currentLecture.closeAt === 'number' && currentLecture.closeAt > 0 && currentLecture.closeAt < serverTime) {
    return {
      locked: true,
      reason: 'closeAt',
      message: 'انتهى الوقت',
      closeAt: currentLecture.closeAt
    };
  }`;

const oldItemLock = `  if (typeof item?.openAt === 'number' && item.openAt > serverTime) {
    return {
      locked: true,
      reason: 'openAt',
      message: \`بيفتح يوم \${formatCairoDateTime(item.openAt)}\`,
      openAt: item.openAt
    };
  }`;

const newItemLock = `  if (typeof item?.openAt === 'number' && item.openAt > serverTime) {
    return {
      locked: true,
      reason: 'openAt',
      message: \`يفتح يوم \${formatCairoDateTime(item.openAt)}\`,
      openAt: item.openAt
    };
  }

  if (typeof item?.closeAt === 'number' && item.closeAt > 0 && item.closeAt < serverTime) {
    return {
      locked: true,
      reason: 'closeAt',
      message: 'انتهى الوقت',
      closeAt: item.closeAt
    };
  }`;

const isCrlf = content.includes('\r\n');
const toTarget = (s) => isCrlf ? s.replace(/\n/g, '\r\n') : s.replace(/\r\n/g, '\n');

if (content.includes(toTarget(oldLecLock))) {
  content = content.replace(toTarget(oldLecLock), toTarget(newLecLock));
}
if (content.includes(toTarget(oldItemLock))) {
  content = content.replace(toTarget(oldItemLock), toTarget(newItemLock));
}

fs.writeFileSync('v2-app/src/lib/contentRules.ts', content, 'utf8');
console.log('✔ Patched contentRules.ts');
