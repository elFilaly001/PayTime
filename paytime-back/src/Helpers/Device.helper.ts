import { UAParser } from 'ua-parser-js';

export function getDeviceInfo(request: any): { device: string; os: string; browser: string } {
  const userAgentString = request.headers['user-agent'] || '';
  console.log('Raw User Agent:', userAgentString);

  // Special handling for Postman
  if (userAgentString.includes('Postman')) {
    return {
      device: 'Postman Client',
      os: 'Postman Runtime',
      browser: 'Postman'
    };
  }

  const parser = new UAParser(userAgentString);
  const result = parser.getResult();

  return {
    device: result.device.model || result.device.type || 'Desktop',
    os: result.os.name || 'Unknown OS',
    browser: result.browser.name || 'Unknown Browser'
  };
}

export function isDeviceRecognized(user: any, deviceInfo: any): boolean {
    if (!deviceInfo || !user.Devices) {
        return false;
    }

    return user.Devices.some(device => 
        device.device === deviceInfo.device &&
        device.os === deviceInfo.os &&
        device.browser === deviceInfo.browser
    );
}

