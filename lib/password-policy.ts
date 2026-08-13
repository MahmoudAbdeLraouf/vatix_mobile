export const PASSWORD_MIN_LENGTH = 8

export type PasswordLocale = 'ar' | 'en'

export interface PasswordValidationResult {
  valid: boolean
  error?: string
}

export function validatePassword(password: string, locale: PasswordLocale = 'ar'): PasswordValidationResult {
  const ar = locale === 'ar'

  if (password.length < PASSWORD_MIN_LENGTH) {
    return {
      valid: false,
      error: ar
        ? `كلمة المرور يجب أن تكون ${PASSWORD_MIN_LENGTH} أحرف على الأقل`
        : `Password must be at least ${PASSWORD_MIN_LENGTH} characters long`,
    }
  }

  return { valid: true }
}
