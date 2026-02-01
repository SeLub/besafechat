import { MethodSelection } from '@/components/auth/method-selection';
import { PasswordCreation } from '@/components/auth/password-creation';
import { RecoveryOptions } from '@/components/auth/recovery-options';
import { SeedDisplay } from '@/components/auth/seed-display';
import { SeedVerification } from '@/components/auth/seed-verification';
import { UsernameSelection } from '@/components/auth/username-selection';
import { Button } from '@/components/ui/button';
import { generateSeedPhrase } from '@/lib/crypto';
import { AccountService } from '@/services/account.service';
import { AuthService } from '@/services/auth.service';
import { StorageService } from '@/services/storage.service';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { UserService } from '~/services/user.service';

type AuthStep =
  | 'main'
  | 'method-selection'
  | 'seed-display'
  | 'seed-verify'
  | 'password'
  | 'username-selection'
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
    const attemptAutoLogin = async () => {
      // First check if user is already authenticated with valid tokens
      try {
        const profileResponse = await fetch('http://localhost:4000/auth/profile', {
          credentials: 'include',
        });

        if (profileResponse.ok) {
          // User is already authenticated, redirect to main app
          window.location.href = '/';
          return;
        }
      } catch (error) {
        console.log('User not authenticated with existing tokens, proceeding normally');
      }

      // If not authenticated, check if we have a stored public key
      // Only check if we're on a page where the database might be initialized
      // For the auth page, we just proceed without checking (DB not initialized yet)
      setHasKey(false);
    };

    attemptAutoLogin();
  }, []);

  const handleCreateAccount = () => {
    setStep('method-selection');
  };

  const handleUsernameSelected = async (selectedUsername: string) => {
    setUsername(selectedUsername);
    setLoading(true);
    try {
      // Update handle using the proper handles endpoint
      await UserService.setUsername(selectedUsername, selectedUsername.split('_')[0] || 'User');

      setStep('complete');
      toast.success('Handle updated successfully!');
      setTimeout(() => (window.location.href = '/'), 1500);
    } catch (error: any) {
      toast.error(error.message || 'Failed to set username');
      setLoading(false);
    }
  };

  const handleMethodSelect = async (selectedMethod: 'cloud' | 'self-custody') => {
    setMethod(selectedMethod);
    const newSeed = await generateSeedPhrase();
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
      // Use the unified account creation flow with cloud backup
      await AccountService.createAccountWithCloud(password);
      // User is automatically logged in since login is called inside createAccountWithCloud
      toast.success('Account created successfully!');
      // Go directly to main page after account creation
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
      // Use the unified account creation flow with self-custody
      await AccountService.createAccountWithSelfCustody();
      // User is automatically logged in since login is called inside createAccountWithSelfCustody
      toast.success('Account created successfully!');
      // Go directly to main page after account creation
      setTimeout(() => (window.location.href = '/'), 1500);
    } catch (error: any) {
      toast.error(error.message || 'Failed to create account');
    } finally {
      setLoading(false);
    }
  };

  // This function is now obsolete since username setting happens differently
  // The complete registration with custom handle happens separately

  const loginToBackend = async (publicKeyBase64: string) => {
    const { deviceId, deviceName } = AccountService.getDeviceInfo();
    // Login the user (creates identity if first time) and get the result
    const loginResult = await AuthService.login({
      publicKey: publicKeyBase64,
      deviceId,
      deviceName,
    });
    return loginResult;
  };

  const loginOnly = async (publicKeyBase64: string, privateKey?: Uint8Array) => {
    const { deviceId, deviceName } = AccountService.getDeviceInfo();
    const loginResult = await AuthService.login({
      publicKey: publicKeyBase64,
      privateKey,
      deviceId,
      deviceName,
    });
    return loginResult;
  };

  const handleLogin = async () => {
    setLoading(true);
    try {
      const publicKey = await StorageService.getPublicKey();
      if (!publicKey) {
        toast.error('No stored key found');
        return;
      }
      const { deviceId, deviceName } = AccountService.getDeviceInfo();
      const loginResult = await AuthService.login({
        publicKey,
        deviceId,
        deviceName,
      });
      // Initialize database after login with identityId (Phase 4)
      await StorageService.initialize(loginResult.identityId);
      window.location.href = '/';
    } catch (error: any) {
      toast.error(error.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleClearKey = async () => {
    await StorageService.clearStoredKey();
    AccountService.clearTemporarySeed(); // Also clear temporary seed storage
    setHasKey(false);
    toast.success('Key cleared');
  };

  const handleRecovery = () => {
    setStep('recovery');
  };

  const handlePasswordRecovery = async (password: string) => {
    setLoading(true);
    try {
      const { publicKeyBase64, privateKey } = await AccountService.recoverWithPassword(password);
      const loginResult = await loginOnly(publicKeyBase64, privateKey);
      // Initialize database after login with identityId
      await StorageService.initialize(loginResult.identityId);
      
      // Verify that derived public key matches stored key
      const storedKey = await StorageService.getPublicKey();
      if (storedKey && storedKey !== publicKeyBase64) {
        throw new Error('Seed verification failed: Public key mismatch. This password does not match your account.');
      }
      
      // Store public key if not already stored
      if (!storedKey) {
        await StorageService.storePublicKey(publicKeyBase64);
      }
      
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
     const { publicKeyBase64, privateKey } = await AccountService.recoverWithSeed(recoveredSeed);
     const { deviceId, deviceName } = AccountService.getDeviceInfo();
     const loginResult = await AuthService.login({
       publicKey: publicKeyBase64,
       privateKey,
       deviceId,
       deviceName,
     });
     // Initialize database after login with identityId (Phase 4)
     await StorageService.initialize(loginResult.identityId);
     
     // Verify that derived public key matches stored key
     const storedKey = await StorageService.getPublicKey();
     if (storedKey && storedKey !== publicKeyBase64) {
       throw new Error('Seed verification failed: Public key mismatch. This seed does not match your account.');
     }
     
     // Store public key if not already stored
     if (!storedKey) {
       await StorageService.storePublicKey(publicKeyBase64);
     }
     
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
            <div className="text-center py-6 text-lg">
              <div className="mb-2">Stored account detected</div>
              <div className="text-sm text-muted-foreground">Automatically authenticating...</div>
            </div>
            <Button onClick={handleRecovery} variant="outline" className="w-full py-6 text-lg">
              Restore Access
            </Button>
            <Button onClick={handleCreateAccount} className="w-full py-6 text-lg">
              Create New Account
            </Button>
            <div className="text-center">
              <button
                onClick={handleClearKey}
                className="text-sm text-muted-foreground hover:text-foreground underline"
              >
                Clear Stored Account
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
