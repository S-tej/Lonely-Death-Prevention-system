import React, { createContext, useState, useEffect, useContext, ReactNode } from 'react';
import { ref, onValue, push, remove, query, orderByChild, limitToLast, get, set } from 'firebase/database';
import { database } from '../firebase/config';
import { AuthContext } from './AuthContext';
import { makeEmergencyCall, sendEmergencySMS } from '../utils/twilioService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getPatientCaretakerCount, getPatientCaretakers } from '../services/caretakerService';

export type Alert = {
  id?: string;
  timestamp: number;
  type: 'critical' | 'warning' | 'info' | 'emergency';
  message: string;
  acknowledged: boolean;
  vitalSign?: string;
  value?: number | string;
};

type AlertsContextType = {
  alerts: Alert[];
  loading: boolean;
  // Fix return types to match implementation:
  triggerAlert: (alert: Omit<Alert, 'id' | 'timestamp' | 'acknowledged'>) => Promise<Alert | undefined>;
  triggerEmergency: (message: string) => Promise<Alert | undefined>;
  acknowledgeAlert: (alertId: string) => Promise<void>;
  clearAlert: (alertId: string) => Promise<void>;
  unacknowledgedCount: number;
  clearAllAlerts?: () => Promise<void>;
};

export const AlertsContext = createContext<AlertsContextType>({
  alerts: [],
  loading: true,
  unacknowledgedCount: 0,
  triggerAlert: async () => undefined,
  triggerEmergency: async () => undefined,
  acknowledgeAlert: async () => {},
  clearAlert: async () => {},
});

export const AlertsProvider = ({ children }: { children: ReactNode }) => {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [unacknowledgedCount, setUnacknowledgedCount] = useState(0);
  const { user, userProfile } = useContext(AuthContext);
  
  // Track when the last emergency call was made to prevent frequent calls
  const [lastEmergencyCallTime, setLastEmergencyCallTime] = useState<Record<string, number>>({});
  // Track if automatic calls are enabled
  const [autoCallsEnabled, setAutoCallsEnabled] = useState(true);
  
  // Load auto call setting
  useEffect(() => {
    const loadSetting = async () => {
      const setting = await AsyncStorage.getItem('autoCallsEnabled');
      if (setting !== null) {
        setAutoCallsEnabled(setting === 'true');
      }
    };
    loadSetting();
  }, []);
  
  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const loadAlerts = async (userId: string) => {
      try {
        // Use orderByChild to leverage the index we created
        const alertsRef = query(
          ref(database, `alerts/${userId}`),
          orderByChild('timestamp')
        );
        
        const snapshot = await get(alertsRef);
        if (snapshot.exists()) {
          const alertsData = snapshot.val();
          // Transform object to array and sort by timestamp (newest first)
          const alertsList = Object.entries(alertsData).map(([id, data]: [string, any]) => ({
            id,
            ...data,
          }));
          alertsList.sort((a, b) => b.timestamp - a.timestamp);
          return alertsList;
        }
        return [];
      } catch (error) {
        console.error('Error loading alerts:', error);
        throw error;
      }
    };

    loadAlerts(user.uid).then((alertsList) => {
      setAlerts(alertsList);
      setLoading(false);
    }).catch((error) => {
      console.error('Failed to load alerts:', error);
      setLoading(false);
    });

  }, [user]);

  // Enhanced triggerAlert with emergency calling
  const triggerAlert = async (alert: Omit<Alert, 'id' | 'timestamp' | 'acknowledged'>) => {
    if (!user) return;
    
    const now = Date.now();
    // Convert to IST for logging (UTC+5:30)
    const istTime = new Date(now).toLocaleString('en-IN', { 
      timeZone: 'Asia/Kolkata',
      dateStyle: 'short',
      timeStyle: 'medium'
    });
    
    const newAlert = {
      ...alert,
      timestamp: now, // Keep UTC timestamp for database
      acknowledged: false
    };
    
    try {
      // Add alert to database
      const alertsRef = ref(database, `alerts/${user.uid}`);
      const newAlertRef = push(alertsRef);
      await set(newAlertRef, newAlert);
      
      // Only make calls for emergency or critical alerts
      const alertKey = `${alert.type}_${alert.vitalSign || 'general'}`;
      
      if ((alert.type === 'emergency' || alert.type === 'critical') && autoCallsEnabled) {
        // Check if we made a call recently (within 15 minutes) to prevent spam
        const lastCallTime = lastEmergencyCallTime[alertKey] || 0;
        const fifteenMinutes = 15 * 60 * 1000;
        
        if (now - lastCallTime > fifteenMinutes) {
          // Get emergency contacts
          const emergencyContacts = userProfile?.emergencyContacts || [];
          
          // Get caretakers
          let caretakers: { displayName: string; phoneNumber: string }[] = [];
          try {
            if (user.uid) {
              console.log(`[${istTime}] Loading caretakers for patient ${user.uid} for emergency notification`);
              const patientCaretakers = await getPatientCaretakers(user.uid);
              caretakers = patientCaretakers.filter(c => c.phoneNumber);
              console.log(`[${istTime}] Found ${caretakers.length} caretakers for emergency notification:`, caretakers);
            }
          } catch (error) {
            console.error(`[${istTime}] Failed to load caretakers for emergency notification:`, error);
          }
          
          // Combine contacts to notify (emergency contacts + caretakers)
          const allContactsToNotify = [
            ...emergencyContacts.filter(contact => contact.phoneNumber),
            ...caretakers.map(c => ({
              name: c.displayName || 'Caretaker',
              phoneNumber: c.phoneNumber,
              isCaretaker: true
            }))
          ];
          
          console.log(`[${istTime}] Notifying ${allContactsToNotify.length} contacts for emergency alert:`, 
            allContactsToNotify.map(c => ({ name: c.name, phone: c.phoneNumber })));
          
          if (allContactsToNotify.length > 0) {
            for (const contact of allContactsToNotify) {
              if (contact.phoneNumber) {
                console.log(`[${istTime}] Sending notification to ${contact.name || 'Contact'} at ${contact.phoneNumber}`);
                
                // First send an SMS
                await sendEmergencySMS({
                  to: contact.phoneNumber,
                  message: `ALERT: ${userProfile?.displayName || 'Patient'} - ${alert.message}`,
                  patientName: userProfile?.displayName
                });
                
                // For emergency level alerts or manually triggered alerts, make a call
                // Always call caretakers for emergencies
                if (alert.type === 'emergency' || contact.isCaretaker) {
                  await makeEmergencyCall({
                    to: contact.phoneNumber,
                    message: alert.message,
                    patientName: userProfile?.displayName
                  });
                }
              }
            }
            
            // Update the last call time
            setLastEmergencyCallTime(prev => ({
              ...prev,
              [alertKey]: now
            }));
          } else {
            console.log(`[${istTime}] No contacts to notify for emergency alert`);
          }
        }
      }
      
      // Convert last call time to IST for logging
      const lastCallTimeIST = lastEmergencyCallTime[alertKey] ? 
        new Date(lastEmergencyCallTime[alertKey]).toLocaleString('en-IN', { 
          timeZone: 'Asia/Kolkata', 
          dateStyle: 'short',
          timeStyle: 'medium'
        }) : 'never';
      
      // Debugging code
      console.log(`[${istTime}] Emergency alert triggered:`, {
        type: alert.type,
        autoCallsEnabled,
        hasContacts: (userProfile?.emergencyContacts || []).length > 0,
        hasCaretakers: await getPatientCaretakerCount(user.uid),
        lastCallTime: lastCallTimeIST,
        timeSinceLastCall: now - (lastEmergencyCallTime[alertKey] || 0)
      });
      
      return {
        ...newAlert,
        id: newAlertRef.key
      };
    } catch (error) {
      console.error('Failed to trigger alert:', error);
      throw error;
    }
  };

  // Enhanced triggerEmergency function
  const triggerEmergency = async (message: string) => {
    return triggerAlert({
      type: 'emergency',
      message: message || 'Emergency assistance requested!',
      vitalSign: 'manual'
    });
  };

  const acknowledgeAlert = async (alertId: string) => {
    if (!user) return;
    
    try {
      await push(ref(database, `alerts/${user.uid}/${alertId}/acknowledged`), true);
    } catch (error) {
      console.error('Failed to acknowledge alert:', error);
      throw error;
    }
  };

  const clearAlert = async (alertId: string) => {
    if (!user) return;
    
    try {
      await remove(ref(database, `alerts/${user.uid}/${alertId}`));
    } catch (error) {
      console.error('Failed to clear alert:', error);
      throw error;
    }
  };

  return (
    <AlertsContext.Provider value={{
      alerts,
      loading,
      unacknowledgedCount,
      triggerAlert,
      triggerEmergency,
      acknowledgeAlert,
      clearAlert,
      clearAllAlerts: async () => {} // Add this if needed
    }}>
      {children}
    </AlertsContext.Provider>
  );
};
