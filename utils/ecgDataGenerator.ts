import { ref, push, set } from 'firebase/database';
import { database } from '../firebase/config';

/**
 * Generate and save simulated ECG data for a device
 * @param deviceId - The device ID
 * @param sampleCount - Number of samples to generate
 * @param condition - Optional health condition to simulate (normal, arrhythmia, afib, etc.)
 */
export const generateECGData = async (deviceId: string, sampleCount = 250, condition = 'normal') => {
  try {
    const now = Date.now();
    const samplingRate = 250; // 250 Hz
    
    // Generate ECG waveform data
    const ecgData = [];
    
    // Generate base metrics for this recording
    const heartRate = generateHeartRate(condition);
    const metrics = generateEcgMetrics(heartRate, condition);
    
    for (let i = 0; i < sampleCount; i++) {
      // Generate realistic ECG pattern
      const timeInCycle = (i % 50) / 50; // Normalize to 0-1 range in cycle
      
      // Basic PQRST wave simulation
      let value = 0;
      
      // P wave
      if (timeInCycle < 0.2) {
        value = 0.25 * Math.sin(timeInCycle * Math.PI / 0.2);
      }
      // QRS complex
      else if (timeInCycle < 0.35) {
        if (timeInCycle < 0.27) {
          value = -0.5 * Math.sin(timeInCycle * Math.PI / 0.1); // Q
        } else if (timeInCycle < 0.32) {
          value = 2 * Math.sin(timeInCycle * Math.PI / 0.1); // R
        } else {
          value = -0.3 * Math.sin(timeInCycle * Math.PI / 0.1); // S
        }
      }
      // T wave
      else if (timeInCycle < 0.7) {
        value = 0.75 * Math.sin((timeInCycle - 0.35) * Math.PI / 0.35);
      }
      
      // Add some noise and variation based on condition
      if (condition === 'arrhythmia' && Math.random() > 0.8) {
        // Occasional irregularity
        value += (Math.random() - 0.5) * 1.5;
      } else if (condition === 'afib') {
        // More chaotic pattern
        value += (Math.random() - 0.5) * 0.8;
      } else {
        // Normal noise
        value += (Math.random() - 0.5) * 0.1;
      }
      
      ecgData.push({
        time: now + (i * (1000 / samplingRate)),
        value
      });
    }
    
    // Create metadata with ECG metrics
    const metadata = {
      deviceID: deviceId,
      samplingRate: samplingRate,
      uploadTime: now,
      samplesCount: sampleCount,
      dcOffset: 0,
      gainFactor: 1,
      condition: condition,
      ecgMetrics: metrics,
      heartRate,
      temperature: generateTemperature(condition),
      oxygenSaturation: generateOxygenSaturation(condition)
    };
    
    // Save to Firebase at ecg_data/{deviceId}/{timestamp}
    const ecgRef = ref(database, `ecg_data/${deviceId}/${now}`);
    await set(ecgRef, {
      data: ecgData,
      metadata
    });
    
    // Also save key metrics to vitals storage for this user
    if (deviceId.includes('user_')) {
      const userId = deviceId.split('_')[1];
      const vitalRef = ref(database, `vitals/${deviceId}/current`);
      await set(vitalRef, {
        timestamp: now,
        heartRate,
        ecgMetrics: metrics,
        temperature: metadata.temperature,
        oxygenSaturation: metadata.oxygenSaturation,
        bloodPressure: {
          systolic: generateSystolic(condition),
          diastolic: generateDiastolic(condition)
        }
      });
      
      // Add to history
      const historyRef = ref(database, `vitals/${deviceId}/history`);
      await push(historyRef, {
        timestamp: now,
        heartRate,
        ecgMetrics: metrics,
        temperature: metadata.temperature,
        oxygenSaturation: metadata.oxygenSaturation,
        bloodPressure: {
          systolic: generateSystolic(condition),
          diastolic: generateDiastolic(condition)
        }
      });
    }
    
    return {
      timestamp: now,
      sampleCount,
      heartRate,
      ecgMetrics: metrics
    };
  } catch (error) {
    console.error('Error generating ECG data:', error);
    throw error;
  }
};

/**
 * Generate random heart rate based on condition
 */
function generateHeartRate(condition = 'normal') {
  switch(condition) {
    case 'bradycardia':
      return 40 + Math.floor(Math.random() * 20); // 40-60 BPM
    case 'tachycardia':
      return 100 + Math.floor(Math.random() * 40); // 100-140 BPM
    case 'arrhythmia':
    case 'afib':
      return 60 + Math.floor(Math.random() * 60); // 60-120 BPM (variable)
    default: // normal
      return 60 + Math.floor(Math.random() * 20); // 60-80 BPM
  }
}

/**
 * Generate realistic ECG metrics based on heart rate and condition
 */
function generateEcgMetrics(heartRate, condition = 'normal') {
  // Calculate baseline RR interval from heart rate
  const baseRRInterval = Math.floor(60000 / heartRate);
  
  let metrics = {
    HRV_SDNN: 0, // Standard deviation of RR intervals
    HRV_RMSSD: 0, // Root mean square of successive RR differences
    RR_interval: baseRRInterval, // Average RR interval
    QRS_width: 0, // QRS complex width
    PR_interval: 0, // PR interval
    QT_interval: 0, // QT interval
    ST_deviation: 0, // ST deviation
    signal_quality: 0 // Signal quality
  };
  
  switch(condition) {
    case 'normal':
      metrics.HRV_SDNN = 30 + Math.floor(Math.random() * 20); // 30-50 ms
      metrics.HRV_RMSSD = 25 + Math.floor(Math.random() * 20); // 25-45 ms
      metrics.QRS_width = 80 + Math.floor(Math.random() * 20); // 80-100 ms
      metrics.PR_interval = 120 + Math.floor(Math.random() * 40); // 120-160 ms
      metrics.QT_interval = 350 + Math.floor(Math.random() * 50); // 350-400 ms
      metrics.ST_deviation = (Math.random() * 0.2) - 0.1; // -0.1 to 0.1 mV
      metrics.signal_quality = 0.85 + (Math.random() * 0.15); // 0.85-1.0
      break;
    
    case 'arrhythmia':
      metrics.HRV_SDNN = 50 + Math.floor(Math.random() * 40); // 50-90 ms (higher variability)
      metrics.HRV_RMSSD = 45 + Math.floor(Math.random() * 40); // 45-85 ms (higher)
      metrics.QRS_width = 90 + Math.floor(Math.random() * 30); // 90-120 ms (wider)
      metrics.PR_interval = 140 + Math.floor(Math.random() * 60); // 140-200 ms (variable)
      metrics.QT_interval = 380 + Math.floor(Math.random() * 70); // 380-450 ms (variable)
      metrics.ST_deviation = (Math.random() * 0.4) - 0.2; // -0.2 to 0.2 mV (more deviation)
      metrics.signal_quality = 0.7 + (Math.random() * 0.2); // 0.7-0.9
      break;
    
    case 'afib':
      metrics.HRV_SDNN = 70 + Math.floor(Math.random() * 50); // 70-120 ms (very high)
      metrics.HRV_RMSSD = 65 + Math.floor(Math.random() * 50); // 65-115 ms (very high)
      metrics.QRS_width = 85 + Math.floor(Math.random() * 25); // 85-110 ms
      metrics.PR_interval = 0; // No clear P waves in AFib
      metrics.QT_interval = 370 + Math.floor(Math.random() * 60); // 370-430 ms
      metrics.ST_deviation = (Math.random() * 0.3) - 0.15; // -0.15 to 0.15 mV
      metrics.signal_quality = 0.75 + (Math.random() * 0.15); // 0.75-0.9
      break;
    
    case 'bradycardia':
      metrics.HRV_SDNN = 35 + Math.floor(Math.random() * 25); // 35-60 ms
      metrics.HRV_RMSSD = 30 + Math.floor(Math.random() * 20); // 30-50 ms
      metrics.QRS_width = 80 + Math.floor(Math.random() * 20); // 80-100 ms (normal)
      metrics.PR_interval = 150 + Math.floor(Math.random() * 50); // 150-200 ms (longer)
      metrics.QT_interval = 400 + Math.floor(Math.random() * 80); // 400-480 ms (longer due to slow rate)
      metrics.ST_deviation = (Math.random() * 0.2) - 0.1; // -0.1 to 0.1 mV
      metrics.signal_quality = 0.8 + (Math.random() * 0.2); // 0.8-1.0
      break;
    
    case 'tachycardia':
      metrics.HRV_SDNN = 20 + Math.floor(Math.random() * 20); // 20-40 ms (lower)
      metrics.HRV_RMSSD = 15 + Math.floor(Math.random() * 20); // 15-35 ms (lower)
      metrics.QRS_width = 75 + Math.floor(Math.random() * 20); // 75-95 ms
      metrics.PR_interval = 110 + Math.floor(Math.random() * 30); // 110-140 ms (shorter)
      metrics.QT_interval = 300 + Math.floor(Math.random() * 50); // 300-350 ms (shorter due to fast rate)
      metrics.ST_deviation = (Math.random() * 0.2) - 0.1; // -0.1 to 0.1 mV
      metrics.signal_quality = 0.75 + (Math.random() * 0.15); // 0.75-0.9
      break;
  }
  
  return metrics;
}

/**
 * Generate temperature based on condition
 */
function generateTemperature(condition = 'normal') {
  switch(condition) {
    case 'fever':
      return 37.8 + Math.random() * 1.7; // 37.8-39.5°C
    case 'hypothermia':
      return 35.0 + Math.random() * 1.0; // 35.0-36.0°C
    default: // normal
      return 36.4 + Math.random() * 0.8; // 36.4-37.2°C
  }
}

/**
 * Generate oxygen saturation based on condition
 */
function generateOxygenSaturation(condition = 'normal') {
  switch(condition) {
    case 'hypoxia':
      return 85 + Math.floor(Math.random() * 7); // 85-92%
    default: // normal
      return 95 + Math.floor(Math.random() * 4); // 95-99%
  }
}

/**
 * Generate systolic blood pressure based on condition
 */
function generateSystolic(condition = 'normal') {
  switch(condition) {
    case 'hypertension':
      return 140 + Math.floor(Math.random() * 30); // 140-170 mmHg
    case 'hypotension':
      return 80 + Math.floor(Math.random() * 10); // 80-90 mmHg
    default: // normal
      return 110 + Math.floor(Math.random() * 20); // 110-130 mmHg
  }
}

/**
 * Generate diastolic blood pressure based on condition
 */
function generateDiastolic(condition = 'normal') {
  switch(condition) {
    case 'hypertension':
      return 90 + Math.floor(Math.random() * 20); // 90-110 mmHg
    case 'hypotension':
      return 50 + Math.floor(Math.random() * 10); // 50-60 mmHg
    default: // normal
      return 70 + Math.floor(Math.random() * 10); // 70-80 mmHg
  }
}
