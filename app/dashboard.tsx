import React, { useContext, useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  RefreshControl,
  Alert 
} from 'react-native';
import { Stack, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AuthContext } from '../context/AuthContext';
import { VitalsContext } from '../context/VitalsContext';
import { AlertsContext } from '../context/AlertsContext';
import VitalCard from '../components/VitalCard';
import AlertBanner from '../components/AlertBanner';
import EmergencyButton from '../components/EmergencyButton';
import AuthGuard from '../components/AuthGuard';
import LogoutButton from '../components/LogoutButton';
import ESP32Status from '../components/ESP32Status';
import ECGMonitor from '../components/ECGMonitor';

export default function Dashboard() {
  const { user, userProfile } = useContext(AuthContext);
  const { currentVitals, lastUpdated, loading: vitalsLoading, simulateReading } = useContext(VitalsContext);
  const { alerts, triggerEmergency } = useContext(AlertsContext);
  const [refreshing, setRefreshing] = useState(false);

  // Demo feature - simulate data readings - only for patients, not caretakers
  useEffect(() => {
    // Skip simulation for caretakers
    if (userProfile?.isCaretaker) return;
    
    const interval = setInterval(() => {
      simulateReading().catch(console.error);
    }, 15000); // Every 15 seconds

    return () => clearInterval(interval);
  }, [userProfile]);

  const onRefresh = async () => {
    // Skip refresh function for caretakers
    if (userProfile?.isCaretaker) return;
    
    setRefreshing(true);
    try {
      await simulateReading();
    } catch (error) {
      console.error('Failed to refresh data:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const handleEmergency = () => {
    Alert.alert(
      'Emergency Alert',
      'Do you want to trigger an emergency alert?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Send Alert',
          style: 'destructive',
          onPress: async () => {
            try {
              await triggerEmergency('Patient initiated emergency alert');
              Alert.alert('Alert Sent', 'Emergency services and caretakers have been notified.');
            } catch (error) {
              console.error('Emergency alert error:', error);
            }
          },
        },
      ]
    );
  };

  const activeAlerts = alerts.filter(alert => !alert.acknowledged).slice(0, 3);

  return (
    <AuthGuard requireAuth={true}>
      <>
        <Stack.Screen 
          options={{
            title: 'Health Dashboard',
            headerRight: () => (
              <LogoutButton 
                color="white" 
                confirmLogout={true} 
              />
            ),
          }} 
        />
        <ScrollView 
          style={styles.container}
          contentContainerStyle={styles.contentContainer}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          <View style={styles.header}>
            <View>
              <Text style={styles.greeting}>Hello, {userProfile?.displayName || user?.displayName || 'Patient'}</Text>
              <Text style={styles.subTitle}>
                {lastUpdated 
                  ? `Last updated: ${lastUpdated.toLocaleTimeString()}` 
                  : 'Monitoring your vital signs'}
              </Text>
            </View>
          </View>
          
          {/* ESP32 Status Indicator */}
          <ESP32Status />

          {activeAlerts.length > 0 && (
            <View style={styles.alertsContainer}>
              {activeAlerts.map((alert) => (
                <AlertBanner key={alert.id} alert={alert} />
              ))}
              {alerts.filter(a => !a.acknowledged).length > 3 && (
                <TouchableOpacity 
                  style={styles.viewAllAlerts}
                  onPress={() => router.push('/alerts')}
                >
                  <Text style={styles.viewAllAlertsText}>
                    View all ({alerts.filter(a => !a.acknowledged).length}) alerts
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          <View style={styles.vitalsGrid}>
            <VitalCard
              title="Heart Rate"
              value={currentVitals?.heartRate || '--'}
              unit="BPM"
              icon="heart"
              color="#FF5252"
              onPress={() => router.push('/vitals/heart-rate')}
            />
            
            <VitalCard
              title="Blood Pressure"
              value={currentVitals ? `${currentVitals.bloodPressure.systolic}/${currentVitals.bloodPressure.diastolic}` : '--/--'}
              unit="mmHg"
              icon="fitness"
              color="#5C6BC0"
              onPress={() => router.push('/vitals/blood-pressure')}
            />
            
            <VitalCard
              title="Oxygen Saturation"
              value={currentVitals?.oxygenSaturation || '--'}
              unit="%"
              icon="water"
              color="#26C6DA"
              onPress={() => router.push('/vitals/oxygen')}
            />
            
            <VitalCard
              title="Temperature"
              value={currentVitals?.temperature || '--'}
              unit="°C"
              icon="thermometer"
              color="#FFA726"
              onPress={() => router.push('/vitals/temperature')}
            />
          </View>

          <EmergencyButton onPress={handleEmergency} />

          <View style={styles.quickActions}>
            <TouchableOpacity 
              style={styles.actionButton} 
              onPress={() => router.push('/reports')}
            >
              <Ionicons name="document-text" size={24} color="#5C6BC0" />
              <Text style={styles.actionButtonText}>Reports</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => router.push('/vitals/ecg')}
            >
              <Ionicons name="pulse" size={24} color="#FF5252" />
              <Text style={styles.actionButtonText}>ECG Monitor</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => router.push('/caretakers')}
            >
              <Ionicons name="call" size={24} color="#4CAF50" />
              <Text style={styles.actionButtonText}>Emergency Contacts</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => router.push('/settings')}
            >
              <Ionicons name="settings" size={24} color="#607D8B" />
              <Text style={styles.actionButtonText}>Settings</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.chartsContainer}>
            <Text style={styles.sectionTitle}>Real-time Monitoring</Text>
            
            {/* Use ECGMonitor without deviceId prop */}
            <ECGMonitor />
            
            {/* ... rest of your existing code ... */}
          </View>
        </ScrollView>
      </>
    </AuthGuard>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  contentContainer: {
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  greeting: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  subTitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  logoutButton: {
    paddingHorizontal: 16,
  },
  alertsContainer: {
    marginBottom: 16,
  },
  viewAllAlerts: {
    alignItems: 'center',
    padding: 8,
  },
  viewAllAlertsText: {
    color: '#f05545',
    fontWeight: '600',
  },
  vitalsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  quickActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  actionButton: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    width: '48%',
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  actionButtonText: {
    marginTop: 8,
    fontWeight: '600',
    color: '#333',
  },
  chartsContainer: {
    marginTop: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
});
