import { useEffect, useState } from 'react';

export type DeviceType = 'mobile' | 'tablet' | 'desktop';

interface MediaQueryResult {
  deviceType: DeviceType;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
}

/**
 * Hook for detecting device type based on screen width using media queries
 * - Mobile: < 768px (sm)
 * - Tablet: 768px - 1024px (md-lg)
 * - Desktop: >= 1024px (xl+)
 */
export function useMediaQuery(): MediaQueryResult {
  const [deviceType, setDeviceType] = useState<DeviceType>('desktop');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);

    // Create media query lists
    const mobileQuery = window.matchMedia('(max-width: 767px)');
    const tabletQuery = window.matchMedia(
      '(min-width: 768px) and (max-width: 1023px)'
    );
    const desktopQuery = window.matchMedia('(min-width: 1024px)');

    // Function to update device type
    const updateDeviceType = () => {
      if (mobileQuery.matches) {
        setDeviceType('mobile');
      } else if (tabletQuery.matches) {
        setDeviceType('tablet');
      } else if (desktopQuery.matches) {
        setDeviceType('desktop');
      }
    };

    // Initial check
    updateDeviceType();

    // Add listeners for changes
    mobileQuery.addEventListener('change', updateDeviceType);
    tabletQuery.addEventListener('change', updateDeviceType);
    desktopQuery.addEventListener('change', updateDeviceType);

    // Cleanup
    return () => {
      mobileQuery.removeEventListener('change', updateDeviceType);
      tabletQuery.removeEventListener('change', updateDeviceType);
      desktopQuery.removeEventListener('change', updateDeviceType);
    };
  }, []);

  // Return desktop during SSR to avoid hydration mismatch
  if (!mounted) {
    return {
      deviceType: 'desktop',
      isMobile: false,
      isTablet: false,
      isDesktop: true,
    };
  }

  return {
    deviceType,
    isMobile: deviceType === 'mobile',
    isTablet: deviceType === 'tablet',
    isDesktop: deviceType === 'desktop',
  };
}
