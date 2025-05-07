import React, { createContext, useState, useEffect, useContext, ReactNode } from 'react';
import { ref, onValue, set, push } from 'firebase/database';
import { database } from '../firebase/config';
import { AuthContext } from './AuthContext';
import { AlertsContext } from './AlertsContext';
import { fetchESP32Data, updateDatabaseWithESP32Data, checkESP32Connection, isAllZeros } from '../utils/esp32DataFetcher';

export type VitalSign = {
  timestamp: number;
  heartRate: number;
  bloodPressure: {
    systolic: number;
    diastolic: number;
  };
  oxygenSaturation: number; // SpO2
  temperature: number;
  ecgData?: number[]; // ECG readings
  ecgMetrics?: {
    HRV_SDNN: number;
    HRV_RMSSD: number;
    RR_interval: number;
    QRS_width: number;
    PR_interval: number;
    QT_interval: number;
    ST_deviation: number;
    signal_quality: number;
  };
  deviceId?: string; // Add deviceId property
  mlAnalysis?: {    // Add mlAnalysis property
    prediction: string;
    confidence: number;
    timestamp: number;
  };
};

type AlertThresholds = {
  heartRateHigh: number;
  heartRateLow: number;
  bloodPressureHigh: {
    systolic: number;
    diastolic: number;
  };
  bloodPressureLow: {
    systolic: number;
    diastolic: number;
  };
  oxygenSaturationLow: number;
  temperatureHigh: number;
  temperatureLow: number;
};

type VitalsContextType = {
  currentVitals: VitalSign | null;
  historicalVitals: VitalSign[];
  lastUpdated: Date | null;
  loading: boolean;
  isESP32Connected: boolean; // Add this property
  thresholds: AlertThresholds;
  updateThresholds: (newThresholds: Partial<AlertThresholds>) => Promise<void>;
  simulateReading: () => Promise<VitalSign | undefined>;
  checkAlertStatus: (vitals: VitalSign) => {[key: string]: boolean};
};

const defaultThresholds: AlertThresholds = {
  heartRateHigh: 100,
  heartRateLow: 60,
  bloodPressureHigh: {
    systolic: 140,
    diastolic: 90
  },
  bloodPressureLow: {
    systolic: 90,
    diastolic: 60
  },
  oxygenSaturationLow: 92,
  temperatureHigh: 37.8,
  temperatureLow: 35.5
};

export const VitalsContext = createContext<VitalsContextType>({
  currentVitals: null,
  historicalVitals: [],
  lastUpdated: null,
  loading: true,
  isESP32Connected: false, // Add this property
  thresholds: defaultThresholds,
  updateThresholds: async () => {},
  simulateReading: async () => undefined,
  checkAlertStatus: () => ({}),
});

export const VitalsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentVitals, setCurrentVitals] = useState<VitalSign | null>(null);
  const [historicalVitals, setHistoricalVitals] = useState<VitalSign[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);
  const [thresholds, setThresholds] = useState<AlertThresholds>(defaultThresholds);
  const [isESP32Connected, setIsESP32Connected] = useState(false);
  
  const { user, userProfile } = useContext(AuthContext);
  const { triggerAlert } = useContext(AlertsContext);
  
  // Track when the last abnormality alert was triggered to prevent spam
  const [lastAbnormalityAlertTime, setLastAbnormalityAlertTime] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    // Listen for real-time vitals updates
    const vitalsRef = ref(database, `vitals/${user.uid}/current`);
    const unsubscribe = onValue(vitalsRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        setCurrentVitals(data);
        setLastUpdated(new Date());
      }
      setLoading(false);
    });

    // Listen for threshold updates
    const thresholdsRef = ref(database, `vitals/${user.uid}/thresholds`);
    const thresholdsUnsubscribe = onValue(thresholdsRef, (snapshot) => {
      if (snapshot.exists()) {
        setThresholds(snapshot.val());
      } else {
        // If no thresholds set, initialize with defaults
        set(thresholdsRef, defaultThresholds);
      }
    });

    // Get historical data
    const historyRef = ref(database, `vitals/${user.uid}/history`);
    const historyUnsubscribe = onValue(historyRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const vitalsArray = Object.values(data) as VitalSign[];
        // Sort by timestamp, newest first
        vitalsArray.sort((a, b) => b.timestamp - a.timestamp);
        setHistoricalVitals(vitalsArray.slice(0, 100)); // Keep last 100 readings
      }
    });

    return () => {
      unsubscribe();
      thresholdsUnsubscribe();
      historyUnsubscribe();
    };
  }, [user]);

  const updateThresholds = async (newThresholds: Partial<AlertThresholds>) => {
    if (!user) return;
    
    const updatedThresholds = { ...thresholds, ...newThresholds };
    setThresholds(updatedThresholds);
    
    try {
      await set(ref(database, `vitals/${user.uid}/thresholds`), updatedThresholds);
    } catch (error) {
      console.error('Failed to update thresholds:', error);
      throw error;
    }
  };

  // Function to generate simulated vital sign readings (for demo/testing)
  const simulateReading = async (): Promise<VitalSign | undefined> => {
    // Don't simulate data for caretakers
    if (!user || userProfile?.isCaretaker) {
      return undefined;
    }

    // Check ESP32 connection and log status
    const connected = await checkESP32Connection();
    setIsESP32Connected(connected);
    
    // If ESP32 is connected, don't generate simulated data
    if (connected) {
      console.log("ESP32 is connected. Skipping simulation to use real data.");
      return undefined;
    }

    console.log('Simulating vitals reading for patient');
    
    // Generate random ECG pattern
    const now = Date.now();
    const ecgPoints = [];
    
    // Create 50 points of simulated ECG data
    for (let i = 0; i < 50; i++) {
      const baselineNoise = Math.random() * 0.1;
      let value;
      
      // Simple ECG-like pattern simulation
      const cycle = i % 10;
      if (cycle === 5) {
        value = 1 + baselineNoise; // R peak
      } else if (cycle === 6) {
        value = -0.2 + baselineNoise; // S wave
      } else if (cycle === 8) {
        value = 0.3 + baselineNoise; // T wave
      } else {
        value = 0 + baselineNoise; // Baseline
      }
      
      ecgPoints.push(value);
    }
    
    // Simulate heart rate with realistic values
    const heartRate = Math.floor(Math.random() * (85 - 65) + 65);
    
    // ECG metrics
    const ecgMetrics = {
      HRV_SDNN: parseFloat((Math.random() * 40 + 20).toFixed(2)),
      HRV_RMSSD: parseFloat((Math.random() * 30 + 15).toFixed(2)),
      RR_interval: Math.floor(60000 / heartRate),
      QRS_width: Math.floor(Math.random() * 20 + 80),
      PR_interval: Math.floor(Math.random() * 40 + 120),
      QT_interval: Math.floor(Math.random() * 50 + 350),
      ST_deviation: parseFloat(((Math.random() * 0.4) - 0.2).toFixed(2)),
      signal_quality: parseFloat((Math.random() * 0.3 + 0.7).toFixed(2))
    };
    
    const newVital: VitalSign = {
      timestamp: now,
      heartRate: heartRate,
      bloodPressure: {
        systolic: Math.floor(Math.random() * (140 - 110) + 110),
        diastolic: Math.floor(Math.random() * (90 - 70) + 70)
      },
      oxygenSaturation: Math.floor(Math.random() * (100 - 94) + 94),
      temperature: parseFloat((Math.random() * (37.2 - 36.5) + 36.5).toFixed(1)),
      ecgData: ecgPoints,
      ecgMetrics: ecgMetrics
    };

    try {
      // Update current reading
      await set(ref(database, `vitals/${user.uid}/current`), newVital);
      
      // Add to history
      const historyRef = ref(database, `vitals/${user.uid}/history`);
      await push(historyRef, newVital);
      
      return newVital;
    } catch (error) {
      console.error('Failed to write simulated reading:', error);
      throw error;
    }
  };

  const checkAlertStatus = (vitals: VitalSign) => {
    if (!vitals) {
      return {
        heartRateHigh: false,
        heartRateLow: false,
        bloodPressureHigh: false,
        bloodPressureLow: false,
        oxygenSaturationLow: false,
        temperatureHigh: false,
        temperatureLow: false,
      };
    }

    return {
      heartRateHigh: vitals.heartRate > thresholds.heartRateHigh,
      heartRateLow: vitals.heartRate < thresholds.heartRateLow,
      bloodPressureHigh: (
        vitals.bloodPressure.systolic > thresholds.bloodPressureHigh.systolic || 
        vitals.bloodPressure.diastolic > thresholds.bloodPressureHigh.diastolic
      ),
      bloodPressureLow: (
        vitals.bloodPressure.systolic < thresholds.bloodPressureLow.systolic ||
        vitals.bloodPressure.diastolic < thresholds.bloodPressureLow.diastolic
      ),
      oxygenSaturationLow: vitals.oxygenSaturation < thresholds.oxygenSaturationLow,
      temperatureHigh: vitals.temperature > thresholds.temperatureHigh,
      temperatureLow: vitals.temperature < thresholds.temperatureLow
    };
  };

  // Replace simulated data with ESP32 data
  useEffect(() => {
    if (!user) return;
    
    // Skip ESP32 data fetching for caretakers
    if (userProfile?.isCaretaker) {
      return;
    }
    
    let isMounted = true;
    let fetchInterval: NodeJS.Timeout;
    let connectionCheckInterval: NodeJS.Timeout;
    
    // Function to check ESP32 connection
    const checkConnection = async () => {
      const connected = await checkESP32Connection();
      if (isMounted) {
        setIsESP32Connected(connected);
        console.log(`ESP32 connection: ${connected ? 'Online' : 'Offline'}`);
      }
    };
    
    // Check connection initially
    checkConnection();
    
    // Set up periodic connection checking
    connectionCheckInterval = setInterval(checkConnection, 30000); // Every 30 seconds
    
    // Function to fetch data from ESP32
    const fetchData = async () => {
      try {
        // Skip if not connected
        if (!isESP32Connected) {
          console.log('ESP32 not connected, skipping fetch');
          return;
        }
        
        // Fetch data from ESP32
        const esp32Data = await fetchESP32Data();
        
        // When ESP32 is connected, always use the data regardless of zeros
        // Update database with ESP32 data
        if (user?.uid) {
          await updateDatabaseWithESP32Data(user.uid, esp32Data);
          console.log('ESP32 data processed and saved to database');
        }
      } catch (error) {
        console.error('Error fetching ESP32 data:', error);
      }
    };
    
    // Set up periodic data fetching
    fetchInterval = setInterval(fetchData, 5000); // Every 5 seconds
    
    // Initial data fetch
    fetchData();
    
    // Clean up intervals
    return () => {
      isMounted = false;
      clearInterval(fetchInterval);
      clearInterval(connectionCheckInterval);
    };
  }, [user, userProfile, isESP32Connected]);

  // Add new useEffect to monitor vitals and trigger alerts for abnormalities
  useEffect(() => {
    if (!currentVitals || !user) return;
    
    const now = Date.now();
    const thirtyMinutes = 30 * 60 * 1000; // Time between repeat alerts
    
    const checkAndTriggerAlert = async (
      condition: boolean,
      type: string,
      message: string,
      severity: 'warning' | 'critical' | 'emergency'
    ) => {
      if (condition) {
        const lastAlertTime = lastAbnormalityAlertTime[type] || 0;
        if (now - lastAlertTime > thirtyMinutes) {
          await triggerAlert({
            type: severity,
            message,
            vitalSign: type.split('_')[0]
          });
          
          setLastAbnormalityAlertTime(prev => ({
            ...prev,
            [type]: now
          }));
        }
      }
    };
    
    // Check heart rate
    checkAndTriggerAlert(
      currentVitals.heartRate > thresholds.heartRateHigh + 15,
      'heartRate_high',
      `Heart rate critically high: ${currentVitals.heartRate} BPM`,
      'critical'
    );
    
    checkAndTriggerAlert(
      currentVitals.heartRate < thresholds.heartRateLow - 10,
      'heartRate_low',
      `Heart rate critically low: ${currentVitals.heartRate} BPM`,
      'critical'
    );
    
    // Check oxygen saturation
    checkAndTriggerAlert(
      currentVitals.oxygenSaturation < thresholds.oxygenSaturationLow - 3,
      'oxygen_low',
      `Oxygen level dangerously low: ${currentVitals.oxygenSaturation}%`,
      'emergency'
    );
    
    // Check temperature
    checkAndTriggerAlert(
      currentVitals.temperature > thresholds.temperatureHigh + 1,
      'temperature_high',
      `Body temperature dangerously high: ${currentVitals.temperature.toFixed(1)}°C`,
      'critical'
    );
    
    checkAndTriggerAlert(
      currentVitals.temperature < thresholds.temperatureLow - 0.5,
      'temperature_low',
      `Body temperature dangerously low: ${currentVitals.temperature.toFixed(1)}°C`,
      'critical'
    );
    
  }, [currentVitals, thresholds, user, triggerAlert]);

  // Add new useEffect to monitor vitals and ML predictions for abnormalities
  useEffect(() => {
    if (!currentVitals || !user) return;
    
    // Handle ML prediction-based alerts
    if (currentVitals.mlAnalysis && 
        currentVitals.mlAnalysis.prediction !== 'Normal' && 
        currentVitals.mlAnalysis.confidence > 75) {
      
      const now = Date.now();
      const sixHours = 6 * 60 * 60 * 1000; // Only alert once every 6 hours for ML predictions
      const alertKey = `ml_${currentVitals.mlAnalysis.prediction}`;
      const lastAlertTime = lastAbnormalityAlertTime[alertKey] || 0;
      
      // Only trigger if we haven't recently alerted for this condition
      if (now - lastAlertTime > sixHours) {
        triggerAlert({
          type: 'critical',
          message: `AI detected ${currentVitals.mlAnalysis.prediction} (${currentVitals.mlAnalysis.confidence}% confidence)`,
          vitalSign: 'ecg',
          // deviceId: currentVitals.deviceId
        });
        
        setLastAbnormalityAlertTime(prev => ({
          ...prev,
          [alertKey]: now
        }));
      }
    }
    
  }, [currentVitals, thresholds, user, triggerAlert]);

  // Add this useEffect for periodic simulation of vital signs
  useEffect(() => {
    if (!user || userProfile?.isCaretaker) return;
    
    let simulationInterval: NodeJS.Timeout;
    
    const checkConnectionAndSimulate = async () => {
      const connected = await checkESP32Connection();
      setIsESP32Connected(connected);
      
      // If ESP32 is disconnected, start simulation
      if (!connected) {
        console.log('ESP32 disconnected, starting automatic simulation');
        
        // Start periodic simulation only if not already running
        if (!simulationInterval) {
          simulationInterval = setInterval(async () => {
            try {
              await simulateReading();
              console.log('Generated simulated vital signs');
            } catch (error) {
              console.error('Failed to simulate vitals:', error);
            }
          }, 10000); // Generate new values every 10 seconds
        }
      } else {
        // If connected, stop simulation
        if (simulationInterval) {
          clearInterval(simulationInterval);
          simulationInterval = undefined;
          console.log('ESP32 connected, stopping simulation');
        }
      }
    };
    
    // Check connection status initially and periodically
    checkConnectionAndSimulate();
    const connectionCheckInterval = setInterval(checkConnectionAndSimulate, 30000);
    
    return () => {
      if (simulationInterval) clearInterval(simulationInterval);
      clearInterval(connectionCheckInterval);
    };
  }, [user, userProfile]);

  return (
    <VitalsContext.Provider value={{
      currentVitals,
      historicalVitals,
      lastUpdated,
      loading,
      isESP32Connected,
      thresholds,
      updateThresholds,
      simulateReading,
      checkAlertStatus,
    }}>
      {children}
    </VitalsContext.Provider>
  );
};
