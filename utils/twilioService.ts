import { Alert } from 'react-native';
import { encode as btoa } from 'base-64'; // For base64 encoding

// Twilio credentials
const TWILIO_ACCOUNT_SID = 'AC3d2f7fe69668c38ac6b67d552ef71123';
const TWILIO_AUTH_TOKEN = '9df89fc8f8ef08bcaf5cebecfba33082';
const TWILIO_FLOW_SID = 'FWb50730bc4103bf65e53cf0aed74ff35e';
const TWILIO_PHONE_NUMBER = '+18382850071';

interface CallParams {
  to: string;
  message?: string;
  patientName?: string;
}

/**
 * Makes a call using Twilio Studio Flow to the specified number
 */
export const makeEmergencyCall = async ({ to, message, patientName }: CallParams): Promise<boolean> => {
  try {
    // Format the phone number with +91 prefix if it doesn't have a country code
    const formattedNumber = to.startsWith('+') ? to : `+91${to}`;
    console.log(`Initiating emergency call to ${formattedNumber}`);
    
    // Create a request to Twilio's REST API to execute the Studio Flow
    const url = `https://studio.twilio.com/v2/Flows/${TWILIO_FLOW_SID}/Executions`;
    const params = new URLSearchParams();
    params.append('To', formattedNumber); // Use the formatted number
    params.append('From', TWILIO_PHONE_NUMBER);
    
    // Add parameters for the flow if needed
    if (message || patientName) {
      const flowParams: any = {};
      if (message) flowParams.message = message;
      if (patientName) flowParams.patientName = patientName;
      params.append('Parameters', JSON.stringify(flowParams));
    }
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`)
      },
      body: params.toString()
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('Twilio API error:', errorData);
      return false;
    }

    const data = await response.json();
    console.log('Emergency call initiated:', data.sid);
    return true;
  } catch (error) {
    console.error('Failed to make emergency call:', error);
    return false;
  }
};

/**
 * Sends an SMS using Twilio to the specified number
 */
export const sendEmergencySMS = async ({ to, message }: CallParams): Promise<boolean> => {
  try {
    // Format the phone number with +91 prefix if it doesn't have a country code
    const formattedNumber = to.startsWith('+') ? to : `+91${to}`;
    console.log(`Sending emergency SMS to ${formattedNumber}`);
    
    const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
    const params = new URLSearchParams();
    params.append('To', formattedNumber); // Use the formatted number
    params.append('From', TWILIO_PHONE_NUMBER);
    params.append('Body', message || 'Emergency alert from health monitoring system');
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`)
      },
      body: params.toString()
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('Twilio SMS API error:', errorData);
      return false;
    }

    const data = await response.json();
    console.log('Emergency SMS sent:', data.sid);
    return true;
  } catch (error) {
    console.error('Failed to send emergency SMS:', error);
    return false;
  }
};
