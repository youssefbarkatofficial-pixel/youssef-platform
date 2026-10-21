import fs from 'fs';

let page = fs.readFileSync('v2-app/src/pages/student/AssessmentPage.tsx', 'utf8');

// Ensure import formatCairoDateTime
if (!page.includes('formatCairoDateTime')) {
  page = page.replace(
    "import { isNewStyleAssessment, loadQuestions, toAssessment } from '../../services/assessments';",
    "import { isNewStyleAssessment, loadQuestions, toAssessment } from '../../services/assessments';\nimport { formatCairoDateTime } from '../../lib/cairoTime';"
  );
}

// Add timing checks
const targetHook = `  const assessmentId = assessment?.id ?? '';
  const newStyle = assessment ? isNewStyleAssessment(assessment) : false;`;

const replacementHook = `  const assessmentId = assessment?.id ?? '';
  const newStyle = assessment ? isNewStyleAssessment(assessment) : false;

  const now = Date.now();
  const openAtMs = typeof (item as any)?.openAt === 'number' 
    ? (item as any).openAt 
    : (typeof (assessment as any)?.raw?.openAt === 'number' ? (assessment as any).raw.openAt : null);
  const closeAtMs = typeof (item as any)?.closeAt === 'number' 
    ? (item as any).closeAt 
    : (typeof (assessment as any)?.raw?.closeAt === 'number' ? (assessment as any).raw.closeAt : null);

  const isLockedOpenAt = !isAdmin && typeof openAtMs === 'number' && openAtMs > now;
  const isLockedCloseAt = !isAdmin && typeof closeAtMs === 'number' && closeAtMs > 0 && closeAtMs < now;`;

const oldEffect = `  useEffect(() => {
    if (!assessment || !canAccess) return;`;

const newEffect = `  useEffect(() => {
    if (!assessment || !canAccess || isLockedOpenAt || isLockedCloseAt) return;`;

const oldCanAccessCheck = `  if (!canAccess) {
    return (
      <div className="mx-auto w-full max-w-2xl">
        <Card>
          <EmptyState
            icon={Lock}
            title="هذا المحتوى للمشتركين فقط"
            description="اشترك في الكورس لتتمكن من فتحه."
            action={
              <Link to={\`/courses/\${course.id}\`} className={buttonClasses({ variant: 'primary' })}>
                تفاصيل الكورس
              </Link>
            }
          />
        </Card>
      </div>
    );
  }`;

const newCanAccessCheck = `  if (!canAccess) {
    return (
      <div className="mx-auto w-full max-w-2xl">
        <Card>
          <EmptyState
            icon={Lock}
            title="هذا المحتوى للمشتركين فقط"
            description="اشترك في الكورس لتتمكن من فتحه."
            action={
              <Link to={\`/courses/\${course.id}\`} className={buttonClasses({ variant: 'primary' })}>
                تفاصيل الكورس
              </Link>
            }
          />
        </Card>
      </div>
    );
  }

  if (isLockedOpenAt) {
    return (
      <div className="mx-auto w-full max-w-2xl">
        <Card>
          <EmptyState
            icon={Lock}
            title="هذا المحتوى مقفول حاليًا"
            description={\`يفتح يوم \${formatCairoDateTime(openAtMs!)}\`}
            action={
              <Link to={\`/courses/\${course.id}\`} className={buttonClasses({ variant: 'secondary' })}>
                الرجوع للكورس
              </Link>
            }
          />
        </Card>
      </div>
    );
  }

  if (isLockedCloseAt) {
    return (
      <div className="mx-auto w-full max-w-2xl">
        <Card>
          <EmptyState
            icon={Lock}
            title="انتهى الوقت"
            description="انتهت الفترة المحددة للإجابة على هذا التقييم."
            action={
              <Link to={\`/courses/\${course.id}\`} className={buttonClasses({ variant: 'secondary' })}>
                الرجوع للكورس
              </Link>
            }
          />
        </Card>
      </div>
    );
  }`;

const isCrlf = page.includes('\r\n');
const toTarget = (s) => isCrlf ? s.replace(/\n/g, '\r\n') : s.replace(/\r\n/g, '\n');

if (page.includes(toTarget(targetHook))) {
  page = page.replace(toTarget(targetHook), toTarget(replacementHook));
}
if (page.includes(toTarget(oldEffect))) {
  page = page.replace(toTarget(oldEffect), toTarget(newEffect));
}
if (page.includes(toTarget(oldCanAccessCheck))) {
  page = page.replace(toTarget(oldCanAccessCheck), toTarget(newCanAccessCheck));
}

fs.writeFileSync('v2-app/src/pages/student/AssessmentPage.tsx', page, 'utf8');
console.log('✔ Patched AssessmentPage.tsx');
