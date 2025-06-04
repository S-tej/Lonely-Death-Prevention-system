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
    ESP_IP: process.env.ESP_IP ,
    FIREBASE_API_KEY: process.env.FIREBASE_API_KEY ,
    FIREBASE_AUTH_DOMAIN: process.env.FIREBASE_AUTH_DOMAIN ,
    FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID ,
    FIREBASE_STORAGE_BUCKET: process.env.FIREBASE_STORAGE_BUCKET ,
    FIREBASE_MESSAGING_SENDER_ID: process.env.FIREBASE_MESSAGING_SENDER_ID ,
    FIREBASE_APP_ID: process.env.FIREBASE_APP_ID ,
    FIREBASE_MEASUREMENT_ID: process.env.FIREBASE_MEASUREMENT_ID ,
    TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID ,
    TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN ,
    TWILIO_FLOW_SID: process.env.TWILIO_FLOW_SID ,
    TWILIO_PHONE_NUMBER: process.env.TWILIO_PHONE_NUMBER,
  };
}

export default getEnvVars();
