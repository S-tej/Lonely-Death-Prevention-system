import { generateECGData } from './ecgDataGenerator';

/**
 * Generate simulated vital signs with realistic ECG metrics
 * @param userId - User ID to generate data for
 * @param condition - Optional health condition to simulate
 */
export const simulateVitals = async (userId: string, condition = 'normal') => {
  try {
    // Generate ECG data with proper metrics - this also updates vitals
    const deviceId = `user_${userId}`;
    await generateECGData(deviceId, 250, condition);
    
    return {
      success: true,
      message: 'Generated simulated vitals with ECG metrics'
    };
  } catch (error) {
    console.error('Error simulating vitals:', error);
    return {
      success: false,
      message: 'Failed to generate simulated vitals',
      error
    };
  }
};

/**
 * List of supported simulation conditions
 */
export const healthConditions = [
  { id: 'normal', name: 'Normal', description: 'Normal healthy vitals' },
  { id: 'arrhythmia', name: 'Arrhythmia', description: 'Irregular heart rhythm' },
  { id: 'afib', name: 'Atrial Fibrillation', description: 'Rapid, irregular heart rhythm' },
  { id: 'bradycardia', name: 'Bradycardia', description: 'Slow heart rate (< 60 BPM)' },
  { id: 'tachycardia', name: 'Tachycardia', description: 'Fast heart rate (> 100 BPM)' },
  { id: 'hypertension', name: 'Hypertension', description: 'High blood pressure' },
  { id: 'hypotension', name: 'Hypotension', description: 'Low blood pressure' },
  { id: 'hypoxia', name: 'Hypoxia', description: 'Low blood oxygen' },
  { id: 'fever', name: 'Fever', description: 'Elevated temperature' }
];
