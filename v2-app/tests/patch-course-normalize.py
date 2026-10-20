import re

with open('v2-app/src/lib/courseNormalize.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace lines 344-366 with priority to training
old_pattern = r"(\s+\}\s+else\s+if\s*\()(childType\s*===\s*'homework'\s*\|\|\s*childType\s*===\s*'task'\s*\|\|\s*childType\s*===\s*'[^']+'\))(\{[\s\S]*?)(else\s+if\s*\(childType\s*===\s*'training'\s*\|\|\s*childType\s*===\s*'[^']+'\)\s*\{[\s\S]*?raw:\s*child,\s*\n\s*\}\);\s*\n\s*\}\s*\n\s*\})"

match = re.search(old_pattern, content)
if match:
    print('Pattern matched!')
else:
    print('Pattern not matched, searching by structure...')

new_code = '''        } else if (
          childType === 'training' ||
          childType === 'تدريب' ||
          asString(child.assessmentKind).toLowerCase() === 'training' ||
          asString(child.title || child.name).includes('تدريب')
        ) {
          const childId = asString(child.id) || `tr_${lecId}_ch_${chIdx + 1}`;
          if (!trainings.some((t) => t.id === childId)) {
            trainings.push({
              id: childId,
              title: asString(child.title) || asString(child.name) || `تدريب ${chIdx + 1}`,
              type: 'training',
              order: asOptionalNumber(child.order) ?? (trainings.length + 1),
              duration: asString(child.duration),
              passingScore: asOptionalNumber(child.passingScore) ?? 50,
              questions: Array.isArray(child.questions) ? child.questions : [],
              strictMode: child.strictMode === true,
              openAt: parseDateValue(child.openAt),
              availableFrom: parseDateValue(child.availableFrom),
              availableUntil: parseDateValue(child.availableUntil),
              raw: child,
            });
          }
        } else if (childType === 'homework' || childType === 'task' || childType === 'واجب') {
          const hwId = asString(child.id) || `hw_${lecId}_ch_${chIdx + 1}`;
          if (!homeworksMap.has(hwId)) {
            addItemToMap({ ...child, id: hwId, lectureId: lecId }, homeworksMap, 'hw');
          }
        }'''

# Replace from `} else if (childType === 'homework'` down to the end of training push
lines = content.splitlines(keepends=True)
start_idx = None
end_idx = None
for i, line in enumerate(lines):
    if "} else if (childType === 'homework'" in line:
        start_idx = i
    if start_idx is not None and "raw: child," in line:
        # find the closing braces
        end_idx = i + 3 # after `    });\n  }\n}`
        break

if start_idx is not None and end_idx is not None:
    print(f'Replacing lines {start_idx+1} to {end_idx+1}')
    lines[start_idx:end_idx] = [new_code + '\n']
    with open('v2-app/src/lib/courseNormalize.ts', 'w', encoding='utf-8') as f:
        f.writelines(lines)
    print('Updated successfully!')
else:
    print('Failed to locate range:', start_idx, end_idx)
