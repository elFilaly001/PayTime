import { UAParser, IResult  } from 'ua-parser-js';

export function getDeviceInfo(request: any){
  const userAgentString = request.headers['user-agent'] || '';
  console.log('Raw User Agent:', userAgentString);

  const parser = new UAParser(userAgentString);
  const result = parser.getResult();
  
  return  {
    engine: result.engine.name,
    cpu: result.cpu.architecture, 
    os: result.os.name, 
    browser: result.browser.name
};
}

export function isDeviceRecognized(user: any, deviceInfo: any): boolean {
    if (!deviceInfo || !user.Devices) {
        return false;
    }

    return user.Devices.some(device => 
      device.engine === deviceInfo.engine &&
      device.cpu === deviceInfo.cpu &&
      device.os === deviceInfo.os &&
      device.browser === deviceInfo.browser
  );
}

