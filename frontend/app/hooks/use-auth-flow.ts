import { useEffect, useState } from 'react';

import { toast } from 'sonner';
import { generateSeedPhrase } from '@/lib/crypto';
import { AccountService } from '@/services/account.service';
import { AuthService } from '@/services/auth.service';
import { StorageService } from '@/services/storage.service';
import { silentAuthCheck } from '@/lib/auth-utils';

type AuthStep =
  | 'main'
  | 'method-selection'
  | 'seed-display'
  | 'seed-verify'
  | 'password'
  | 'recovery'
  | 'complete';
type AuthMethod = 'cloud' | 'self-custody' | null;

export function useAuthFlow() {
  const [loading, setLoading] = useState(false);
  const [hasKey, setHasKey] = useState(false);
  const [step, setStep] = useState<AuthStep>('main');
  const [method, setMethod] = useState<AuthMethod>(null);
  const [seed, setSeed] = useState<string[]>([]);

  useEffect(() => {
    const attemptAutoLogin = async () => {
      try {
        const user = await silentAuthCheck(true);

        if (user) {
          window.location.href = '/';
          return;
        }
      } catch (error) {
        console.log('User not authenticated with existing tokens, proceeding normally ', error);
      }
      setHasKey(false);
    };

    attemptAutoLogin();
  }, []);

  const handleCreateAccount = () => {
    setStep('method-selection');
  };

  const handleMethodSelect = async (selectedMethod: 'cloud' | 'self-custody') => {
    setMethod(selectedMethod);
    const newSeed = await generateSeedPhrase();
    setSeed(newSeed);

    if (selectedMethod === 'cloud') {
      setStep('password');
    } else {
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
      await AccountService.createAccountWithCloud(password);
      toast.success('Account created successfully!');
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
      await AccountService.createAccountWithSelfCustody();
      toast.success('Account created successfully!');
      setTimeout(() => (window.location.href = '/'), 1500);
    } catch (error: any) {
      toast.error(error.message || 'Failed to create account');
    } finally {
      setLoading(false);
    }
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

  const handleClearKey = async () => {
    await StorageService.clearStoredKey();
    AccountService.clearTemporarySeed();
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
      await StorageService.initialize(loginResult.identityId);

      const storedKey = await StorageService.getPublicKey();
      if (storedKey && storedKey !== publicKeyBase64) {
        throw new Error(
          'Seed verification failed: Public key mismatch. This password does not match your account.'
        );
      }

      if (!storedKey) {
        await StorageService.storePublicKey(publicKeyBase64);
      }

      toast.success('Account recovered!');
      window.location.href = '/';
    } catch (error: any) {
      toast.error(error.message || 'Recovery failed');
      throw error; // Re-throw to allow component to catch if needed
    } finally {
      setLoading(false);
    }
  };

  const handleSeedRecovery = async (recoveredSeed: string[]) => {
    setLoading(true);
    try {
      const { publicKeyBase64, privateKey } = await AccountService.recoverWithSeed(recoveredSeed);
      const loginResult = await loginOnly(publicKeyBase64, privateKey);
      await StorageService.initialize(loginResult.identityId);

      const storedKey = await StorageService.getPublicKey();
      if (storedKey && storedKey !== publicKeyBase64) {
        throw new Error(
          'Seed verification failed: Public key mismatch. This seed does not match your account.'
        );
      }

      if (!storedKey) {
        await StorageService.storePublicKey(publicKeyBase64);
      }

      toast.success('Account recovered!');
      window.location.href = '/';
    } catch (error: any) {
      toast.error(error.message || 'Recovery failed');
      throw error; // Re-throw to allow component to catch if needed
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    hasKey,
    step,
    seed,
    handleCreateAccount,
    handleMethodSelect,
    handleSeedConfirmed,
    handleSeedVerified,
    handlePasswordCreated,
    handleClearKey,
    handleRecovery,
    handlePasswordRecovery,
    handleSeedRecovery,
  };
}
