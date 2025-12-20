import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { db } from '@/lib/db/db';
import { UsernameSelection } from '@/components/auth/username-selection';
import { MethodSelection } from '@/components/auth/method-selection';
import { SeedDisplay } from '@/components/auth/seed-display';
import { SeedVerification } from '@/components/auth/seed-verification';
import { PasswordCreation } from '@/components/auth/password-creation';
import { RecoveryOptions } from '@/components/auth/recovery-options';
import { CryptoService } from '@/services/crypto.service';
import { AccountService } from '@/services/account.service';
import { AuthService } from '@/services/auth.service';

type AuthStep =
  | 'main'
  | 'username-selection'
  | 'method-selection'
  | 'seed-display'
  | 'seed-verify'
  | 'password'
  | 'recovery'
  | 'complete';
type AuthMethod = 'cloud' | 'self-custody' | null;

export default function AuthRoute() {
  const [loading, setLoading] = useState(false);
  const [hasKey, setHasKey] = useState(false);
  const [step, setStep] = useState<AuthStep>('main');
  const [method, setMethod] = useState<AuthMethod>(null);
  const [username, setUsername] = useState('');
  const [seed, setSeed] = useState<string[]>([]);

  useEffect(() => {
    const checkKey = async () => {
      const key = await db.publicKey.get('current');
      setHasKey(!!key);
    };
    checkKey();
  }, []);

  const handleCreateAccount = () => {
    setStep('username-selection');
  };

  const handleUsernameSelected = (selectedUsername: string) => {
    setUsername(selectedUsername);
    setStep('method-selection');
  };

  const handleMethodSelect = (selectedMethod: 'cloud' | 'self-custody') => {
    setMethod(selectedMethod);
    const newSeed = CryptoService.generateSeed();
    setSeed(newSeed);

    if (selectedMethod === 'cloud') {
      // Skip seed display for cloud - go directly to password
      setStep('password');
    } else {
      // Self-custody shows seed
      setStep('seed-display');
    }
  };

  const handleSeedConfirmed = () => {
    setStep('seed-verify');
  };

  const handleSeedVerified = () => {
    if (method === 'cloud') {
      setStep('password');
    } else {
      finalizeSelfCustody();
    }
  };

  const handlePasswordCreated = async (password: string) => {
    setLoading(true);
    try {
      // 1. Derive keys and save to IndexedDB
      const { publicKeyBase64 } = await AccountService.createAccountWithSeed(seed);

      // 2. Login to backend
      await loginToBackend(publicKeyBase64);

      // 3. Set username
      await setUsernameOnBackend(username);

      // 4. Upload encrypted seed to S3
      await AccountService.createAccountWithCloud(password);

      setStep('complete');
      toast.success('Account created with cloud backup!');
      setTimeout(() => (window.location.href = '/'), 1500);
    } catch (error: any) {
      toast.error(error.message || 'Failed to create account');
    } finally {
      setLoading(false);
    }
  };

  const finalizeSelfCustody = async () => {
    setLoading(true);
    try {
      const { publicKeyBase64 } = await AccountService.createAccountWithSeed(seed);
      await loginToBackend(publicKeyBase64);
      await setUsernameOnBackend(username);
      setStep('complete');
      toast.success('Account created!');
      setTimeout(() => (window.location.href = '/'), 1500);
    } catch (error: any) {
      toast.error(error.message || 'Failed to create account');
    } finally {
      setLoading(false);
    }
  };

  const setUsernameOnBackend = async (usernameValue: string) => {
    await AuthService.setUsername({
      username: usernameValue,
      isSearchable: 'yes',
    });
  };

  const loginToBackend = async (publicKeyBase64: string) => {
    const { deviceId } = AccountService.getDeviceInfo();
    await AuthService.login({
      publicKey: publicKeyBase64,
      deviceId,
    });
  };

  const handleLogin = async () => {
    setLoading(true);
    try {
      const record = await db.publicKey.get('current');
      if (!record) {
        toast.error('No stored key found');
        return;
      }
      await loginToBackend(record.publicKeyBase64);
      window.location.href = '/';
    } catch (error: any) {
      toast.error(error.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleClearKey = async () => {
    await db.publicKey.delete('current');
    AccountService.clearTemporarySeed(); // Also clear temporary seed storage
    setHasKey(false);
    toast.success('Key cleared');
  };

  const handleRecovery = () => {
    setStep('recovery');
  };

  const handlePasswordRecovery = async (username: string, password: string) => {
    setLoading(true);
    try {
      const { publicKeyBase64 } = await AccountService.recoverWithPassword(username, password);
      await loginToBackend(publicKeyBase64);
      toast.success('Account recovered!');
      window.location.href = '/';
    } catch (error: any) {
      throw new Error(error.message || 'Recovery failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSeedRecovery = async (recoveredSeed: string[]) => {
    setLoading(true);
    try {
      const { publicKeyBase64 } = await AccountService.recoverWithSeed(recoveredSeed);
      await loginToBackend(publicKeyBase64);
      toast.success('Account recovered!');
      window.location.href = '/';
    } catch (error: any) {
      throw new Error(error.message || 'Recovery failed');
    } finally {
      setLoading(false);
    }
  };

  if (step === 'username-selection') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <UsernameSelection onUsernameSelected={handleUsernameSelected} />
      </div>
    );
  }

  if (step === 'method-selection') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <MethodSelection
          onSelectCloud={() => handleMethodSelect('cloud')}
          onSelectSelfCustody={() => handleMethodSelect('self-custody')}
        />
      </div>
    );
  }

  if (step === 'seed-display') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <SeedDisplay seed={seed} onConfirm={handleSeedConfirmed} />
      </div>
    );
  }

  if (step === 'seed-verify') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <SeedVerification seed={seed} onVerified={handleSeedVerified} />
      </div>
    );
  }

  if (step === 'password') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <PasswordCreation onPasswordCreated={handlePasswordCreated} />
      </div>
    );
  }

  if (step === 'recovery') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <RecoveryOptions
          onPasswordRecovery={handlePasswordRecovery}
          onSeedRecovery={handleSeedRecovery}
        />
      </div>
    );
  }

  if (step === 'complete') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="text-4xl mb-4">✓</div>
          <h2 className="text-2xl font-bold mb-2">Account Created!</h2>
          <p className="text-muted-foreground">Redirecting...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-md space-y-6 p-6">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">BeSafe Chat</h1>
          <p className="text-muted-foreground">Anonymous E2EE Messenger</p>
        </div>

        {hasKey ? (
          <div className="space-y-3">
            <Button onClick={handleLogin} disabled={loading} className="w-full py-6 text-lg">
              {loading ? 'Logging in...' : 'Continue as User'}
            </Button>
            <div className="text-center">
              <button
                onClick={handleClearKey}
                className="text-sm text-muted-foreground hover:text-foreground underline"
              >
                Use different account
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <Button onClick={handleRecovery} variant="outline" className="w-full py-6 text-lg">
              Restore Access
            </Button>
            <Button onClick={handleCreateAccount} className="w-full py-6 text-lg">
              Create Account
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
