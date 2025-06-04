import Constants from 'expo-constants';

interface Env {
  ESP_IP: string;
  FIREBASE_API_KEY: string;
  FIREBASE_AUTH_DOMAIN: string;
  FIREBASE_PROJECT_ID: string;
  FIREBASE_STORAGE_BUCKET: string;
  FIREBASE_MESSAGING_SENDER_ID: string;
  FIREBASE_APP_ID: string;
  FIREBASE_MEASUREMENT_ID?: string;
  TWILIO_ACCOUNT_SID: string;
  TWILIO_AUTH_TOKEN: string;
  TWILIO_FLOW_SID: string;
  TWILIO_PHONE_NUMBER: string;
}

// Get environment variables from Expo Constants or process.env
function getEnvVars(): Env {
  // For Expo, we can use Constants.expoConfig.extra
  if (Constants.expoConfig?.extra) {
    return Constants.expoConfig.extra as Env;
  }

  // Fallback to hardcoded values if environment variables aren't available
  // This is not ideal, but necessary for development continuity
  return {
    ESP_IP: process.env.ESP_IP || 'http://192.168.254.99',
    FIREBASE_API_KEY: process.env.FIREBASE_API_KEY || 'AIzaSyClAdxsTyp9iZkrRmWMrEDxBAT3Q_NduKk',
    FIREBASE_AUTH_DOMAIN: process.env.FIREBASE_AUTH_DOMAIN || 'caretaker-562d5.firebaseapp.com',
    FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID || 'caretaker-562d5',
    FIREBASE_STORAGE_BUCKET: process.env.FIREBASE_STORAGE_BUCKET || 'caretaker-562d5.firebasestorage.app',
    FIREBASE_MESSAGING_SENDER_ID: process.env.FIREBASE_MESSAGING_SENDER_ID || '514566300700',
    FIREBASE_APP_ID: process.env.FIREBASE_APP_ID || '1:514566300700:web:306fcb5594d46262e0ebd9',
    FIREBASE_MEASUREMENT_ID: process.env.FIREBASE_MEASUREMENT_ID || 'G-PMKMKS0RPS',
    TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID || 'AC3d2f7fe69668c38ac6b67d552ef71123',
    TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN || '9df89fc8f8ef08bcaf5cebecfba33082',
    TWILIO_FLOW_SID: process.env.TWILIO_FLOW_SID || 'FWb50730bc4103bf65e53cf0aed74ff35e',
    TWILIO_PHONE_NUMBER: process.env.TWILIO_PHONE_NUMBER || '+18382850071',
  };
}

export default getEnvVars();
