import { ref, set, push } from 'firebase/database';
import { getDatabase } from 'firebase/database';
import { database } from '../firebase/config';
import { mapESP32DataToMLParams, getPrediction } from './mlPredictionService';

const ESP_IP = 'http://192.168.18.99';  // Your ESP32 IP address

// Interface for the data received from ESP32
export interface ESP32Data {
  SpO2: number;             // Oxygen saturation
  bodytempc: number;        // Body temperature in Celsius
  rrinterval: number;        // Current respiratory rate
  deviceId: string;         // Device identifier
  diastolic: number;        // Diastolic blood pressure
  heartrate: number;        // Heart rate
  hrvrmssd: number;         // HRV RMSSD
  hrvsdn: number;           // HRV SDN (SDNN)
  ppgheartrate: number;     // PPG heart rate
  printerval: number;       // PR interval (ECG)
  qrswidth: number;         // QRS width (ECG)
  qtinterval: number;       // QT interval (ECG)
  signalquality: number;    // Signal quality
  stdeviation: number;      // ST deviation
  systolic: number;         // Systolic blood pressure
}

/**
 * Fetches the latest data from ESP32
 * @returns Promise with ESP32 data
 */
export const fetchESP32Data = async (): Promise<ESP32Data> => {
  try {
    console.log('Fetching data from ESP32...');
    const response = await fetch(`${ESP_IP}`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('ESP32 data received:', data);
    return data;
  } catch (error) {
    console.error('Error fetching ESP32 data:', error);
    throw error;
  }
};

/**
 * Updates the Firebase database with ESP32 data
 * @param userId The user ID for database storage
 * @param data The ESP32 data
 */
export const updateDatabaseWithESP32Data = async (userId: string, data: ESP32Data): Promise<boolean> => {
  try {
    // Skip update if we received all zeros or null data (likely a connection issue)
    if (!data || isAllZeros(data)) {
      console.log('Skipping update: All values are zero or data is null');
      return false;
    }
    
    const now = Date.now();
    
    // Get ML prediction if we have necessary data
    let mlPrediction = null;
    try {
      if (hasValidEcgParameters(data)) {
        const mlParams = mapESP32DataToMLParams(data);
        mlPrediction = await getPrediction(mlParams);
        console.log('ML prediction for ECG data:', mlPrediction);
      } else {
        console.log('Skipping ML prediction: Missing required ECG parameters');
      }
    } catch (error) {
      console.error('Failed to get ML prediction:', error);
      // Continue even if ML prediction fails
    }
    
    // Create vitals object from ESP32 data - matching exact fields
    const vitals = {
      timestamp: now,
      heartRate: data.heartrate || (data.ppgheartrate > 0 ? data.ppgheartrate : 0),
      bloodPressure: {
        systolic: data.systolic || 0,
        diastolic: data.diastolic || 0
      },
      oxygenSaturation: data.SpO2 || 0,
      temperature: data.bodytempc || 0,
      ecgMetrics: {
        HRV_SDNN: data.hrvsdn || 0,
        HRV_RMSSD: data.hrvrmssd || 0,
        RR_interval: data.rrinterval || 0,
        QRS_width: data.qrswidth || 0,
        PR_interval: data.printerval || 0,
        QT_interval: data.qtinterval || 0,
        ST_deviation: data.stdeviation || 0,
        signal_quality: data.signalquality || 0
      },
      deviceId: data.deviceId,
      // Add ML prediction results if available
      mlAnalysis: mlPrediction ? {
        prediction: mlPrediction.prediction,
        confidence: mlPrediction.confidence,
        timestamp: now
      } : null
    };

    // Update current vitals
    await set(ref(database, `vitals/${userId}/current`), vitals);
    
    // Also store in historical data
    const historicalRef = ref(database, `vitals/${userId}/history/${now}`);
    await set(historicalRef, vitals);
    
    // Store raw ESP32 data for debugging/reference
    await set(ref(database, `vitals/${userId}/raw_esp32_data/${now}`), data);
    
    console.log('Database updated with ESP32 data for user:', userId);
    return true;
  } catch (error) {
    console.error('Error updating database with ESP32 data:', error);
    return false;
  }
};

/**
 * Checks if the ESP32 is reachable
 * @returns Promise with boolean indicating if ESP32 is reachable
 */
export const checkESP32Connection = async (): Promise<boolean> => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    
    // Try a simple fetch to check if ESP32 is responding
    const response = await fetch(`${ESP_IP}`, {
      signal: controller.signal
    }).catch(() => null);
    
    clearTimeout(timeoutId);
    return response !== null && response.ok;
  } catch (error) {
    console.log('ESP32 connection check failed:', error);
    return false;
  }
};

/**
 * Check if all numerical values in the data are zero
 * This helps identify potential connection issues
 */
export const isAllZeros = (data: ESP32Data): boolean => {
  if (!data) return true;
  
  const numericFields = [
    data.SpO2, data.bodytempc, data.rrinterval, data.diastolic,
    data.heartrate, data.hrvrmssd, data.hrvsdn, data.ppgheartrate,
    data.printerval, data.qrswidth, data.qtinterval, 
    data.signalquality, data.stdeviation, data.systolic
  ];
  
  return numericFields.every(val => val === 0 || val === null || val === undefined);
};

/**
 * Check if ESP32 data has valid ECG parameters for ML prediction
 */
const hasValidEcgParameters = (data: ESP32Data): boolean => {
  return (
    typeof data.rrinterval === 'number' && data.rrinterval > 0 &&
    typeof data.qrswidth === 'number' && data.qrswidth > 0 &&
    typeof data.printerval === 'number' && data.printerval > 0 &&
    typeof data.stdeviation === 'number' &&
    typeof data.qtinterval === 'number' && data.qtinterval > 0
  );
};
