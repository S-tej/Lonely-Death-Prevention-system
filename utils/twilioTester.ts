import { makeEmergencyCall, sendEmergencySMS } from './twilioService';

/**
 * Test utility to manually verify Twilio connectivity
 * Call this function directly from a debugging screen or button
 */
export const testTwilioConnection = async (phoneNumber: string): Promise<{
  smsSuccess: boolean;
  callSuccess: boolean;
  errors: string[];
}> => {
  const errors: string[] = [];
  let smsSuccess = false;
  let callSuccess = false;
  
  console.log('=== TESTING TWILIO CONNECTION ===');
  console.log(`Testing with phone number: ${phoneNumber}`);
  
  try {
    // Test SMS first
    console.log('Testing SMS sending...');
    smsSuccess = await sendEmergencySMS({
      to: phoneNumber,
      message: 'This is a test message from your health monitoring app.',
      patientName: 'Test Patient',
      deviceId: 'TEST_DEVICE_001'
    });
    
    console.log('SMS test result:', smsSuccess ? 'SUCCESS' : 'FAILED');
    
    // Short delay between requests
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Test call
    console.log('Testing emergency call...');
    callSuccess = await makeEmergencyCall({
      to: phoneNumber,
      message: 'This is a test emergency call. No action is required.',
      patientName: 'Test Patient',
      deviceId: 'TEST_DEVICE_001'
    });
    
    console.log('Call test result:', callSuccess ? 'SUCCESS' : 'FAILED');
  } catch (error) {
    console.error('Error during Twilio testing:', error);
    errors.push(error.toString());
  }
  
  console.log('=== TWILIO TEST COMPLETE ===');
  console.log('Results:', { smsSuccess, callSuccess, errors });
  
  return { smsSuccess, callSuccess, errors };
};
