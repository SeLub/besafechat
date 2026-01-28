import { useState } from 'react';

interface PasswordCreationProps {
  onPasswordCreated: (password: string) => void;
}

export function PasswordCreation({ onPasswordCreated }: PasswordCreationProps) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const getPasswordStrength = (pwd: string): { score: number; label: string; color: string } => {
    let score = 0;
    if (pwd.length >= 8) score++;
    if (pwd.length >= 12) score++;
    if (/[a-z]/.test(pwd)) score++;
    if (/[A-Z]/.test(pwd)) score++;
    if (/[0-9]/.test(pwd)) score++;
    if (/[^a-zA-Z0-9]/.test(pwd)) score++;

    if (score <= 2) return { score: 20, label: 'Weak', color: 'bg-red-500' };
    if (score <= 4) return { score: 60, label: 'Medium', color: 'bg-orange-500' };
    return { score: 100, label: 'Strong', color: 'bg-green-500' };
  };

  const strength = getPasswordStrength(password);
  const isValid =
    password.length >= 8 &&
    /[a-z]/.test(password) &&
    /[A-Z]/.test(password) &&
    /[0-9]/.test(password) &&
    password === confirmPassword;

  console.log('[PasswordCreation] Debug:', {
    password,
    confirmPassword,
    length: password.length,
    hasLower: /[a-z]/.test(password),
    hasUpper: /[A-Z]/.test(password),
    hasNumber: /[0-9]/.test(password),
    passwordsMatch: password === confirmPassword,
    isValid,
  });

  return (
    <div className="max-w-md mx-auto p-6">
      <h2 className="text-2xl font-bold text-center mb-4">Create Password</h2>
      <p className="text-center text-muted-foreground mb-6">
        This password will encrypt your seed phrase in the cloud
      </p>

      <div className="space-y-4 mb-6">
        <div>
          <label htmlFor="password-input" className="block text-sm font-medium mb-2">
            Password (min 8 characters)
          </label>
          <div className="relative">
            <input
              id="password-input"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary pr-10"
              placeholder="Enter password"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showPassword ? '👁️' : '👁️‍🗨️'}
            </button>
          </div>

          {password && (
            <div className="mt-2">
              <div className="flex items-center justify-between text-xs mb-1">
                <span>Strength: {strength.label}</span>
                <span>{strength.score}%</span>
              </div>
              <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className={`h-full ${strength.color} transition-all`}
                  style={{ width: `${strength.score}%` }}
                />
              </div>
            </div>
          )}
        </div>

        <div>
          <label htmlFor="confirm-password-input" className="block text-sm font-medium mb-2">
            Confirm Password
          </label>
          <input
            id="confirm-password-input"
            type={showPassword ? 'text' : 'password'}
            value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)}
            className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="Confirm password"
          />
          {confirmPassword && password !== confirmPassword && (
            <p className="text-xs text-red-500 mt-1">Passwords don't match</p>
          )}
          {confirmPassword && password === confirmPassword && (
            <p className="text-xs text-green-600 mt-1">✓ Passwords match</p>
          )}
        </div>
      </div>

      <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6 text-sm">
        <p className="font-medium mb-2">Requirements:</p>
        <ul className="space-y-1 text-muted-foreground">
          <li className={password.length >= 8 ? 'text-green-600' : ''}>
            {password.length >= 8 ? '✓' : '○'} At least 8 characters
          </li>
          <li className={/[a-z]/.test(password) ? 'text-green-600' : ''}>
            {/[a-z]/.test(password) ? '✓' : '○'} One lowercase letter
          </li>
          <li className={/[A-Z]/.test(password) ? 'text-green-600' : ''}>
            {/[A-Z]/.test(password) ? '✓' : '○'} One uppercase letter
          </li>
          <li className={/[0-9]/.test(password) ? 'text-green-600' : ''}>
            {/[0-9]/.test(password) ? '✓' : '○'} One number
          </li>
        </ul>
      </div>

      <div className="bg-orange-50 dark:bg-orange-950 border border-orange-200 dark:border-orange-800 rounded-lg p-4 mb-6">
        <p className="text-sm text-orange-800 dark:text-orange-200">
          <strong>⚠️ Important:</strong> Without this password AND your backup file, you cannot
          recover your account. Use a password manager!
        </p>
      </div>

      <button
        onClick={() => onPasswordCreated(password)}
        disabled={!isValid}
        className="w-full py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Create Account →
      </button>
    </div>
  );
}
