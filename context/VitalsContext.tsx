import React, { createContext, useState, useEffect, useContext, ReactNode } from 'react';
import { ref, onValue, set, push } from 'firebase/database';
import { database } from '../firebase/config';
import { AuthContext } from './AuthContext';
import { AlertsContext } from './AlertsContext';
import { fetchESP32Data, updateDatabaseWithESP32Data, checkESP32Connection } from '../utils/esp32DataFetcher';

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
  thresholds: defaultThresholds,
  updateThresholds: async () => {},
  simulateReading: async () => undefined,
  checkAlertStatus: () => ({}),
});

export const VitalsProvider = ({ children }: { children: ReactNode }) => {
  const [currentVitals, setCurrentVitals] = useState<VitalSign | null>(null);
  const [historicalVitals, setHistoricalVitals] = useState<VitalSign[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);
  const [thresholds, setThresholds] = useState<AlertThresholds>(defaultThresholds);
  const [isESP32Connected, setIsESP32Connected] = useState(false);
  
  const { user } = useContext(AuthContext);
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
  const simulateReading = async (): Promise<VitalSign | null> => {
    if (isESP32Connected) {
      console.log('ESP32 connected, not simulating data');
      return null; // Don't simulate data when ESP32 is connected
    }
    
    // Original simulation code for when ESP32 is not connected
    if (!user) return null;
    console.log('Simulating vitals reading for demo purposes');
    
    const now = Date.now();
    
    // Generate ECG waveform data
    const ecgPoints = [];
    for (let i = 0; i < 50; i++) {
      // Simplified ECG pattern generation
      const baseValue = 0.8;
      const peak = i % 10 === 5 ? 0.6 : 0;
      ecgPoints.push(baseValue + peak + (Math.random() * 0.1));
    }
    
    // Generate random heart rate in normal range
    const heartRate = Math.floor(Math.random() * (90 - 60) + 60);
    
    // Generate ECG metrics (simplified)
    const ecgMetrics = {
      HRV_SDNN: parseFloat((Math.random() * 40 + 20).toFixed(2)), // 20-60ms
      HRV_RMSSD: parseFloat((Math.random() * 30 + 15).toFixed(2)), // 15-45ms
      RR_interval: Math.floor(60000 / heartRate), // Convert BPM to RR interval in ms
      QRS_width: Math.floor(Math.random() * 20 + 80), // 80-100ms
      PR_interval: Math.floor(Math.random() * 40 + 120), // 120-160ms
      QT_interval: Math.floor(Math.random() * 50 + 350), // 350-400ms
      ST_deviation: parseFloat(((Math.random() * 0.4) - 0.2).toFixed(2)), // -0.2 to 0.2mV
      signal_quality: parseFloat((Math.random() * 0.3 + 0.7).toFixed(2)) // 0.7-1.0
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
      
      return newVital; // Fixed: Return the newVital object
    } catch (error) {
      console.error('Failed to simulate reading:', error);
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
        
        // Don't update if all values are zero - might be a connection issue
        // if (isAllZeros(esp32Data)) {
        //   console.log('Received all zeros from ESP32, likely a connection issue');
        //   return;
        // }
        
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
  }, [user, isESP32Connected]); // Add isESP32Connected as a dependency

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

  return (
    <VitalsContext.Provider value={{
      currentVitals,
      historicalVitals,
      lastUpdated,
      loading,
      thresholds,
      updateThresholds,
      simulateReading,
      checkAlertStatus,
    }}>
      {children}
    </VitalsContext.Provider>
  );
};
