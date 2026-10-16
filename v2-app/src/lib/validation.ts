export interface PasswordChecks {
  length: boolean;
  uppercase: boolean;
  digit: boolean;
  symbol: boolean;
}

export function getPasswordChecks(password: string): PasswordChecks {
  return {
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    digit: /[0-9]/.test(password),
    symbol: /[!@#$%^&*?]/.test(password),
  };
}

export function isPasswordValid(password: string): boolean {
  const checks = getPasswordChecks(password);
  return checks.length && checks.uppercase && checks.digit && checks.symbol;
}

export interface PasswordStrength {
  score: number;
  label: string;
}

export function getPasswordStrength(password: string): PasswordStrength {
  if (!password) return { score: 0, label: '' };

  const checks = getPasswordChecks(password);
  const score = [checks.length, checks.uppercase, checks.digit, checks.symbol].filter(Boolean)
    .length;
  const labels = ['ضعيفة جدًا', 'ضعيفة', 'متوسطة', 'جيدة', 'قوية'];

  return { score, label: labels[score] };
}

// اسم (أول أو أوسط أو أخير): حرفان على الأقل، حروف ومسافات فقط.
export function isValidPersonName(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.length >= 2 && /^[\p{L}\p{M}\s]+$/u.test(trimmed);
}
