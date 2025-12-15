/**
 * Device identification service for anonymous E2EE messenger
 * Provides non-identifying device metadata to prevent spam while preserving privacy
 */
export class DeviceService {
  private static iosDeviceMapping = new Map([
    ["320x480", "iPhone 4S/4/3GS"],
    ["320x568", "iPhone 5/SE 1st/5C/5S"],
    ["375x667", "iPhone SE 2nd/6/6S/7/8"],
    ["375x812", "iPhone X/XS/11 Pro/12 Mini/13 Mini"],
    ["390x844", "iPhone 13/13 Pro/12/12 Pro"],
    ["414x736", "iPhone 8+ / 7+ / 6+"],
    ["414x896", "iPhone 11/XR/XS Max/11 Pro Max"],
    ["428x926", "iPhone 13 Pro Max/12 Pro Max"],
    ["744x1133", "iPad Mini 6"],
    ["768x1024", "iPad (1-6), Mini (1-5), Air (1-2)"],
    ["810x1080", "iPad 7-9"],
    ["820x1180", "iPad Air 4"],
    ["834x1194", "iPad Pro 11\" (3-5)"],
    ["834x1112", "iPad Air 3, Pro 10.5\""],
    ["1024x1366", "iPad Pro 12.9\""],
  ]);

  private static desktopDeviceMapping = new Map([
    ["Win32", "Windows"],
    ["Linux", "Linux"],
    ["MacIntel", "macOS"],
  ]);

  /**
   * Get human-readable device name (non-identifying)
   * Returns generic device type (e.g., "iPhone 13", "Windows")
   */
  static getDeviceName(): string {
    if (typeof window === 'undefined') return 'Unknown Device';
    
    if (/Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) {
      return navigator.userAgent.includes('Android') 
        ? this.getAndroidDeviceName()
        : this.getIosDeviceName();
    }
    return this.getDesktopDeviceName();
  }

  /**
   * Generate anonymized device ID (not tied to hardware)
   * Combines non-identifying device characteristics
   */
  static getDeviceId(): string {
    if (typeof window === 'undefined') return `server-${Date.now()}`;
    
    const deviceName = this.getDeviceName();
    const screenWidth = window.screen?.width || 0;
    const screenHeight = window.screen?.height || 0;
    
    // Create non-identifying hash (same device = same ID, different devices = different IDs)
    return `web-${deviceName.replace(/\s+/g, '_')}-${screenWidth}x${screenHeight}`;
  }

  private static getAndroidDeviceName(): string {
    try {
      const ua = navigator.userAgent;
      if (!ua.includes('Android')) return 'Android';
      
      const androidPart = ua.split('Android')[1];
      const devicePart = androidPart.split(')')[0];
      const words = devicePart.trim().split(' ');
      return words.length > 1 ? words[1].replace(/[^a-zA-Z0-9]/g, '') : 'Android';
    } catch {
      return 'Android';
    }
  }

  private static getIosDeviceName(): string {
    const resolution = `${window.screen?.width || 0}x${window.screen?.height || 0}`;
    return DeviceService.iosDeviceMapping.get(resolution) || 'iOS Device';
  }

  private static getDesktopDeviceName(): string {
    const platform = navigator.platform || 'Unknown';
    return DeviceService.desktopDeviceMapping.get(platform) || platform;
  }
}

// Export singleton instance
export const deviceService = new DeviceService();