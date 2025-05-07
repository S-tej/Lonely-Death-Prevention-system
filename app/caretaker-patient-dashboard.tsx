import React, { useState, useEffect, useContext, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  Dimensions,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { Stack, useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AuthContext } from '../context/AuthContext';
import { database } from '../firebase/config';
import app from '../firebase/config';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { ref, get, onValue, set } from 'firebase/database';
import { LineChart } from 'react-native-chart-kit';
import VitalCard from '../components/VitalCard';

// Define firestore constant after imports
const firestore = getFirestore(app);

// Default thresholds matching what's in VitalsContext
const defaultThresholds = {
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

export default function CaretakerPatientDashboardScreen() {
  const { patientId } = useLocalSearchParams();
  const { user, logout } = useContext(AuthContext);
  const [loading, setLoading] = useState(true);
  const [patientProfile, setPatientProfile] = useState<any>(null);
  const [vitalsData, setVitalsData] = useState<any>(null);
  const [ecgData, setEcgData] = useState<number[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [historicalVitals, setHistoricalVitals] = useState<any[]>([]);
  const [showThresholdModal, setShowThresholdModal] = useState(false);
  const [thresholds, setThresholds] = useState(defaultThresholds);
  
  // References for threshold inputs
  const heartRateHighRef = useRef<TextInput>(null);
  const heartRateLowRef = useRef<TextInput>(null);
  const oxygenSaturationLowRef = useRef<TextInput>(null);
  const temperatureHighRef = useRef<TextInput>(null);
  const temperatureLowRef = useRef<TextInput>(null);
  const systolicHighRef = useRef<TextInput>(null);
  const diastolicHighRef = useRef<TextInput>(null);
  const systolicLowRef = useRef<TextInput>(null);
  const diastolicLowRef = useRef<TextInput>(null);

  useEffect(() => {
    if (!user || !patientId) return;

    const loadPatientData = async () => {
      try {
        setLoading(true);
        setError(null);
        console.log(`Loading patient data for patient ID: ${patientId}`);

        // 1. Get patient profile
        const patientRef = doc(firestore, 'users', patientId as string);
        const patientSnap = await getDoc(patientRef);

        if (!patientSnap.exists()) {
          // Try RTDB as fallback
          const rtdbProfileRef = ref(database, `profiles/${patientId}`);
          console.log(`Checking RTDB for patient at profiles/${patientId}`);
          const rtdbProfileSnap = await get(rtdbProfileRef);
          
          if (!rtdbProfileSnap.exists()) {
            throw new Error('Patient profile not found');
          }
          
          const profileData = rtdbProfileSnap.val();
          console.log('Found patient profile in RTDB:', profileData);
          setPatientProfile(profileData);
        } else {
          const profileData = patientSnap.data();
          console.log('Found patient profile in Firestore:', profileData);
          setPatientProfile(profileData);
        }

        // 2. Get patient thresholds
        const thresholdsRef = ref(database, `vitals/${patientId}/thresholds`);
        console.log(`Getting thresholds from vitals/${patientId}/thresholds`);
        const thresholdsSnap = await get(thresholdsRef);
        
        if (thresholdsSnap.exists()) {
          const thresholdsData = thresholdsSnap.val();
          console.log('Found thresholds:', thresholdsData);
          
          // Merge with defaults to ensure all properties exist
          setThresholds({
            ...defaultThresholds,
            ...thresholdsData
          });
        } else {
          console.log('No thresholds found, using defaults');
          // Create default thresholds for this patient
          try {
            await set(thresholdsRef, defaultThresholds);
            console.log('Created default thresholds for patient');
          } catch (err) {
            console.error('Failed to create default thresholds:', err);
          }
        }

        // 3. Get latest vitals (one-time fetch)
        const vitalsRef = ref(database, `vitals/${patientId}/current`);
        console.log(`Getting current vitals from vitals/${patientId}/current`);
        const vitalsSnap = await get(vitalsRef);

        if (vitalsSnap.exists()) {
          const data = vitalsSnap.val();
          console.log('Found current vitals:', data);
          setVitalsData(data);
          if (data.ecgData) {
            setEcgData(data.ecgData);
          }
          if (data.timestamp) {
            setLastUpdated(new Date(data.timestamp));
          }
        } else {
          console.log('No current vitals found');
        }

        // 4. Get historical vitals data
        const historyRef = ref(database, `vitals/${patientId}/history`);
        console.log(`Getting historical vitals from vitals/${patientId}/history`);
        const historySnap = await get(historyRef);
        
        if (historySnap.exists()) {
          const historyData = historySnap.val();
          console.log('Found historical vitals');
          const sortedData = Object.entries(historyData)
            .map(([timestamp, data]: [string, any]) => ({
              timestamp: parseInt(timestamp),
              ...data
            }))
            .sort((a, b) => a.timestamp - b.timestamp)
            .slice(-20); // Get last 20 readings
          
          setHistoricalVitals(sortedData);
        } else {
          console.log('No historical vitals found');
        }

        // 5. Subscribe to real-time updates
        const realtimeVitalsRef = ref(database, `vitals/${patientId}/current`);
        console.log(`Setting up real-time listener for vitals/${patientId}/current`);
        const unsubscribe = onValue(realtimeVitalsRef, (snapshot) => {
          if (snapshot.exists()) {
            const data = snapshot.val();
            console.log('Real-time vitals update received');
            setVitalsData(data);
            if (data.ecgData) {
              setEcgData(data.ecgData);
            }
            if (data.timestamp) {
              setLastUpdated(new Date(data.timestamp));
            }
          }
        }, (err) => {
          console.error('Error in real-time vitals listener:', err);
        });

        return () => {
          console.log('Cleaning up real-time listener');
          unsubscribe();
        };
      } catch (err: any) {
        console.error('Error loading patient data:', err);
        setError(err.message || 'Failed to load patient data');
        Alert.alert('Error', `Failed to load patient data: ${err.message}`);
      } finally {
        setLoading(false);
      }
    };

    loadPatientData();
  }, [user, patientId]);

  const navigateToDetailedReports = () => {
    router.push({
      pathname: './patient-reports',
      params: { patientId: patientId as string }
    });
  };

  const handleLogout = () => {
    Alert.alert(
      "Logout",
      "Are you sure you want to log out?",
      [
        {
          text: "Cancel",
          style: "cancel"
        },
        {
          text: "Logout",
          style: "destructive",
          onPress: async () => {
            try {
              await logout();
              router.replace('/login');
            } catch (error) {
              console.error("Logout error:", error);
              Alert.alert("Error", "Failed to log out. Please try again.");
            }
          }
        }
      ]
    );
  };

  const updateThresholds = async () => {
    if (!patientId) {
      Alert.alert("Error", "Patient ID is missing");
      return;
    }

    try {
      console.log(`Updating thresholds for patient ${patientId}`);
      console.log('New thresholds:', thresholds);
      
      // Update patient thresholds in database
      const thresholdsRef = ref(database, `vitals/${patientId}/thresholds`);
      await set(thresholdsRef, thresholds);
      
      Alert.alert("Success", "Patient alert thresholds have been updated");
      setShowThresholdModal(false);
    } catch (error) {
      console.error("Error updating thresholds:", error);
      Alert.alert("Error", "Failed to update thresholds. Please try again.");
    }
  };
  
  const formatTime = (timestamp: number): string => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Custom ECGMonitor for patient (override default user context)
  const PatientECGMonitor = () => {
    if (!ecgData || ecgData.length === 0) {
      return (
        <View style={styles.noDataContainer}>
          <Ionicons name="pulse" size={48} color="#ccc" />
          <Text style={styles.noDataText}>No ECG data available</Text>
        </View>
      );
    }

    return (
      <View style={styles.ecgContainer}>
        <View style={styles.ecgHeaderRow}>
          <Text style={styles.ecgTitle}>ECG Monitor</Text>
          {vitalsData?.heartRate && (
            <View style={styles.heartRateContainer}>
              <Text style={styles.heartRateLabel}>HR:</Text>
              <Text style={styles.heartRateValue}>{vitalsData.heartRate} BPM</Text>
            </View>
          )}
        </View>
        {lastUpdated && (
          <Text style={styles.lastUpdated}>
            Last updated: {lastUpdated.toLocaleTimeString()}
          </Text>
        )}
        <LineChart
          data={{
            labels: [],
            datasets: [{ data: ecgData.slice(-100) }]
          }}
          width={Dimensions.get('window').width - 64}
          height={200}
          chartConfig={{
            backgroundColor: '#ffffff',
            backgroundGradientFrom: '#ffffff',
            backgroundGradientTo: '#ffffff',
            decimalPlaces: 2,
            color: (opacity = 1) => `rgba(255, 82, 82, ${opacity})`,
            labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
            style: { borderRadius: 16 },
            propsForDots: { r: '0' },
            propsForBackgroundLines: { strokeDasharray: '' }
          }}
          bezier
          style={styles.chart}
          withDots={false}
          withInnerLines={true}
          withOuterLines={true}
          withHorizontalLines={true}
          withVerticalLines={false}
        />
      </View>
    );
  };

  // Threshold Modal - Matching the patient UI
  const ThresholdSettingsModal = () => (
    <Modal
      visible={showThresholdModal}
      transparent={true}
      animationType="slide"
      onRequestClose={() => setShowThresholdModal(false)}
    >
      <View style={styles.modalContainer}>
        <View style={styles.thresholdModal}>
          <Text style={styles.modalTitle}>Alert Thresholds</Text>
          <Text style={styles.modalDescription}>
            Configure when alerts will be triggered for this patient
          </Text>
          
          <ScrollView 
            style={styles.thresholdScrollView}
            keyboardShouldPersistTaps="always"
            contentContainerStyle={{ paddingBottom: 40 }}
            showsVerticalScrollIndicator={true}
          >
            <View style={styles.thresholdSection}>
              <Text style={styles.thresholdSectionTitle}>Heart Rate</Text>
              <View style={styles.thresholdInputGroup}>
                <Text style={styles.thresholdLabel}>High Threshold:</Text>
                <TextInput
                  ref={heartRateHighRef}
                  style={styles.thresholdInput}
                  value={thresholds.heartRateHigh.toString()}
                  onChangeText={(text) => {
                    const numericValue = text.replace(/[^0-9]/g, '');
                    setThresholds(prev => ({...prev, heartRateHigh: numericValue ? parseInt(numericValue) : prev.heartRateHigh}));
                  }}
                  keyboardType="number-pad"
                  selectTextOnFocus={true}
                  autoCorrect={false}
                  placeholder="Enter value"
                  placeholderTextColor="#999"
                />
                <Text style={styles.thresholdUnit}>BPM</Text>
              </View>
              
              <View style={styles.thresholdInputGroup}>
                <Text style={styles.thresholdLabel}>Low Threshold:</Text>
                <TextInput
                  ref={heartRateLowRef}
                  style={styles.thresholdInput}
                  value={thresholds.heartRateLow.toString()}
                  onChangeText={(text) => {
                    const numericValue = text.replace(/[^0-9]/g, '');
                    setThresholds(prev => ({...prev, heartRateLow: numericValue ? parseInt(numericValue) : prev.heartRateLow}));
                  }}
                  keyboardType="number-pad"
                  selectTextOnFocus={true}
                  autoCorrect={false}
                  placeholder="Enter value"
                  placeholderTextColor="#999"
                />
                <Text style={styles.thresholdUnit}>BPM</Text>
              </View>
            </View>
            
            <View style={styles.thresholdSection}>
              <Text style={styles.thresholdSectionTitle}>Oxygen Saturation</Text>
              <View style={styles.thresholdInputGroup}>
                <Text style={styles.thresholdLabel}>Low Threshold:</Text>
                <TextInput
                  ref={oxygenSaturationLowRef}
                  style={styles.thresholdInput}
                  value={thresholds.oxygenSaturationLow.toString()}
                  onChangeText={(text) => {
                    const numericValue = text.replace(/[^0-9]/g, '');
                    setThresholds(prev => ({...prev, oxygenSaturationLow: numericValue ? parseInt(numericValue) : prev.oxygenSaturationLow}));
                  }}
                  keyboardType="number-pad"
                  selectTextOnFocus={true}
                  autoCorrect={false}
                  placeholder="Enter value"
                  placeholderTextColor="#999"
                />
                <Text style={styles.thresholdUnit}>%</Text>
              </View>
            </View>
            
            <View style={styles.thresholdSection}>
              <Text style={styles.thresholdSectionTitle}>Temperature</Text>
              <View style={styles.thresholdInputGroup}>
                <Text style={styles.thresholdLabel}>High Threshold:</Text>
                <TextInput
                  ref={temperatureHighRef}
                  style={styles.thresholdInput}
                  value={thresholds.temperatureHigh.toString()}
                  onChangeText={(text) => {
                    const numericValue = text.replace(/[^0-9.]/g, '');
                    setThresholds(prev => ({...prev, temperatureHigh: numericValue ? parseFloat(numericValue) : prev.temperatureHigh}));
                  }}
                  keyboardType="decimal-pad"
                  selectTextOnFocus={true}
                  autoCorrect={false}
                  placeholder="Enter value"
                  placeholderTextColor="#999"
                />
                <Text style={styles.thresholdUnit}>°C</Text>
              </View>
              
              <View style={styles.thresholdInputGroup}>
                <Text style={styles.thresholdLabel}>Low Threshold:</Text>
                <TextInput
                  ref={temperatureLowRef}
                  style={styles.thresholdInput}
                  value={thresholds.temperatureLow.toString()}
                  onChangeText={(text) => {
                    const numericValue = text.replace(/[^0-9.]/g, '');
                    setThresholds(prev => ({...prev, temperatureLow: numericValue ? parseFloat(numericValue) : prev.temperatureLow}));
                  }}
                  keyboardType="decimal-pad"
                  selectTextOnFocus={true}
                  autoCorrect={false}
                  placeholder="Enter value"
                  placeholderTextColor="#999"
                />
                <Text style={styles.thresholdUnit}>°C</Text>
              </View>
            </View>
            
            <View style={styles.thresholdSection}>
              <Text style={styles.thresholdSectionTitle}>Blood Pressure</Text>
              <View style={styles.thresholdInputGroup}>
                <Text style={styles.thresholdLabel}>High Systolic:</Text>
                <TextInput
                  ref={systolicHighRef}
                  style={styles.thresholdInput}
                  value={thresholds.bloodPressureHigh.systolic.toString()}
                  onChangeText={(text) => {
                    const numericValue = text.replace(/[^0-9]/g, '');
                    setThresholds(prev => ({
                      ...prev, 
                      bloodPressureHigh: {
                        ...prev.bloodPressureHigh,
                        systolic: numericValue ? parseInt(numericValue) : prev.bloodPressureHigh.systolic
                      }
                    }));
                  }}
                  keyboardType="number-pad"
                  selectTextOnFocus={true}
                  autoCorrect={false}
                  placeholder="Enter value"
                  placeholderTextColor="#999"
                />
                <Text style={styles.thresholdUnit}>mmHg</Text>
              </View>
              
              <View style={styles.thresholdInputGroup}>
                <Text style={styles.thresholdLabel}>High Diastolic:</Text>
                <TextInput
                  ref={diastolicHighRef}
                  style={styles.thresholdInput}
                  value={thresholds.bloodPressureHigh.diastolic.toString()}
                  onChangeText={(text) => {
                    const numericValue = text.replace(/[^0-9]/g, '');
                    setThresholds(prev => ({
                      ...prev, 
                      bloodPressureHigh: {
                        ...prev.bloodPressureHigh,
                        diastolic: numericValue ? parseInt(numericValue) : prev.bloodPressureHigh.diastolic
                      }
                    }));
                  }}
                  keyboardType="number-pad"
                  selectTextOnFocus={true}
                  autoCorrect={false}
                  placeholder="Enter value"
                  placeholderTextColor="#999"
                />
                <Text style={styles.thresholdUnit}>mmHg</Text>
              </View>
              
              <View style={styles.thresholdInputGroup}>
                <Text style={styles.thresholdLabel}>Low Systolic:</Text>
                <TextInput
                  ref={systolicLowRef}
                  style={styles.thresholdInput}
                  value={thresholds.bloodPressureLow.systolic.toString()}
                  onChangeText={(text) => {
                    const numericValue = text.replace(/[^0-9]/g, '');
                    setThresholds(prev => ({
                      ...prev, 
                      bloodPressureLow: {
                        ...prev.bloodPressureLow,
                        systolic: numericValue ? parseInt(numericValue) : prev.bloodPressureLow.systolic
                      }
                    }));
                  }}
                  keyboardType="number-pad"
                  selectTextOnFocus={true}
                  autoCorrect={false}
                  placeholder="Enter value"
                  placeholderTextColor="#999"
                />
                <Text style={styles.thresholdUnit}>mmHg</Text>
              </View>
              
              <View style={styles.thresholdInputGroup}>
                <Text style={styles.thresholdLabel}>Low Diastolic:</Text>
                <TextInput
                  ref={diastolicLowRef}
                  style={styles.thresholdInput}
                  value={thresholds.bloodPressureLow.diastolic.toString()}
                  onChangeText={(text) => {
                    const numericValue = text.replace(/[^0-9]/g, '');
                    setThresholds(prev => ({
                      ...prev, 
                      bloodPressureLow: {
                        ...prev.bloodPressureLow,
                        diastolic: numericValue ? parseInt(numericValue) : prev.bloodPressureLow.diastolic
                      }
                    }));
                  }}
                  keyboardType="number-pad"
                  selectTextOnFocus={true}
                  autoCorrect={false}
                  placeholder="Enter value"
                  placeholderTextColor="#999"
                />
                <Text style={styles.thresholdUnit}>mmHg</Text>
              </View>
            </View>
          </ScrollView>
          
          <View style={styles.modalButtons}>
            <TouchableOpacity 
              style={styles.modalCancelButton}
              onPress={() => setShowThresholdModal(false)}
            >
              <Text style={styles.modalCancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.modalSaveButton}
              onPress={updateThresholds}
            >
              <Text style={styles.modalSaveButtonText}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#5C6BC0" />
        <Text style={styles.loadingText}>Loading patient data...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle" size={64} color="#FF5252" />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => router.back()}
        >
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen 
        options={{ 
          title: patientProfile?.displayName || 'Patient Dashboard',
          headerLeft: () => (
            <TouchableOpacity 
              onPress={() => router.back()} 
              style={{ marginLeft: 8 }}
            >
              <Ionicons name="arrow-back" size={24} color="white" />
            </TouchableOpacity>
          )
        }} 
      />

      <ThresholdSettingsModal />

      <ScrollView style={styles.container}>
        <View style={styles.headerContainer}>
          <View>
            <Text style={styles.greeting}>
              {patientProfile?.displayName}'s Dashboard
            </Text>
            <Text style={styles.lastUpdated}>
              {lastUpdated ? `Last updated: ${lastUpdated.toLocaleString()}` : 'No data available'}
            </Text>
          </View>
        </View>

        {/* Patient Info Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Patient Information</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Name:</Text>
            <Text style={styles.infoValue}>{patientProfile?.displayName}</Text>
          </View>
          {patientProfile?.age && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Age:</Text>
              <Text style={styles.infoValue}>{patientProfile.age} years</Text>
            </View>
          )}
          {patientProfile?.gender && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Gender:</Text>
              <Text style={styles.infoValue}>{patientProfile.gender}</Text>
            </View>
          )}
        </View>

        {/* Vitals Section with Alert Settings */}
        {vitalsData ? (
          <View style={styles.vitalsSection}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Current Vitals</Text>
              <TouchableOpacity 
                style={styles.settingsButton}
                onPress={() => setShowThresholdModal(true)}
              >
                <Ionicons name="options" size={20} color="#5C6BC0" />
                <Text style={styles.settingsButtonText}>Alert Settings</Text>
              </TouchableOpacity>
            </View>
            
            <View style={styles.vitalsGrid}>
              <View style={styles.vitalCard}>
                <View style={styles.vitalIconContainer}>
                  <Ionicons name="heart" size={24} color="#FF5252" />
                </View>
                <View style={styles.vitalDataContainer}>
                  <Text style={styles.vitalTitle}>Heart Rate</Text>
                  <Text style={[
                    styles.vitalValue,
                    vitalsData.heartRate > thresholds.heartRateHigh || 
                    vitalsData.heartRate < thresholds.heartRateLow ? styles.alertValue : {}
                  ]}>
                    {vitalsData.heartRate || '--'} <Text style={styles.vitalUnit}>BPM</Text>
                  </Text>
                  <Text style={styles.vitalRange}>
                    Range: {thresholds.heartRateLow}-{thresholds.heartRateHigh} BPM
                  </Text>
                </View>
              </View>

              <View style={styles.vitalCard}>
                <View style={styles.vitalIconContainer}>
                  <Ionicons name="water" size={24} color="#2196F3" />
                </View>
                <View style={styles.vitalDataContainer}>
                  <Text style={styles.vitalTitle}>SpO₂</Text>
                  <Text style={[
                    styles.vitalValue,
                    vitalsData.oxygenSaturation < thresholds.oxygenSaturationLow ? styles.alertValue : {}
                  ]}>
                    {vitalsData.oxygenSaturation || '--'} <Text style={styles.vitalUnit}>%</Text>
                  </Text>
                  <Text style={styles.vitalRange}>
                    Min: {thresholds.oxygenSaturationLow}%
                  </Text>
                </View>
              </View>

              <View style={styles.vitalCard}>
                <View style={styles.vitalIconContainer}>
                  <Ionicons name="thermometer" size={24} color="#FFA726" />
                </View>
                <View style={styles.vitalDataContainer}>
                  <Text style={styles.vitalTitle}>Temperature</Text>
                  <Text style={[
                    styles.vitalValue,
                    vitalsData.temperature > thresholds.temperatureHigh || 
                    vitalsData.temperature < thresholds.temperatureLow ? styles.alertValue : {}
                  ]}>
                    {vitalsData.temperature ? vitalsData.temperature.toFixed(1) : '--'} <Text style={styles.vitalUnit}>°C</Text>
                  </Text>
                  <Text style={styles.vitalRange}>
                    Range: {thresholds.temperatureLow}-{thresholds.temperatureHigh}°C
                  </Text>
                </View>
              </View>

              {vitalsData.bloodPressure && (
                <View style={styles.vitalCard}>
                  <View style={styles.vitalIconContainer}>
                    <Ionicons name="fitness" size={24} color="#5C6BC0" />
                  </View>
                  <View style={styles.vitalDataContainer}>
                    <Text style={styles.vitalTitle}>Blood Pressure</Text>
                    <Text style={[
                      styles.vitalValue,
                      (vitalsData.bloodPressure.systolic > thresholds.bloodPressureHigh.systolic ||
                       vitalsData.bloodPressure.diastolic > thresholds.bloodPressureHigh.diastolic ||
                       vitalsData.bloodPressure.systolic < thresholds.bloodPressureLow.systolic ||
                       vitalsData.bloodPressure.diastolic < thresholds.bloodPressureLow.diastolic) ? styles.alertValue : {}
                    ]}>
                      {`${vitalsData.bloodPressure.systolic || '--'}/${vitalsData.bloodPressure.diastolic || '--'}`} <Text style={styles.vitalUnit}>mmHg</Text>
                    </Text>
                    <Text style={styles.vitalRange}>
                      Range: {thresholds.bloodPressureLow.systolic}/{thresholds.bloodPressureLow.diastolic}-
                      {thresholds.bloodPressureHigh.systolic}/{thresholds.bloodPressureHigh.diastolic} mmHg
                    </Text>
                  </View>
                </View>
              )}
            </View>
          </View>
        ) : (
          <View style={styles.noDataContainer}>
            <Ionicons name="analytics" size={48} color="#ccc" />
            <Text style={styles.noDataText}>No vitals data available</Text>
          </View>
        )}

        {/* ECG Section */}
        <View style={styles.ecgSection}>
          <Text style={styles.sectionTitle}>ECG Monitor</Text>
          <PatientECGMonitor />
        </View>

        {/* Charts Section */}
        {historicalVitals.length > 0 && (
          <>
            {/* Heart Rate Chart */}
            <View style={styles.chartCard}>
              <Text style={styles.cardTitle}>Heart Rate History</Text>
              <LineChart
                data={{
                  labels: historicalVitals.slice(-8).map(v => formatTime(v.timestamp)),
                  datasets: [{ 
                    data: historicalVitals.slice(-8).map(v => v.heartRate || 0) 
                  }]
                }}
                width={Dimensions.get('window').width - 48}
                height={220}
                chartConfig={{
                  backgroundColor: '#ffffff',
                  backgroundGradientFrom: '#ffffff',
                  backgroundGradientTo: '#ffffff',
                  decimalPlaces: 0,
                  color: (opacity = 1) => `rgba(255, 82, 82, ${opacity})`,
                  labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
                  style: { borderRadius: 16 },
                }}
                bezier
                style={styles.chart}
              />
            </View>
            
            {/* Oxygen Saturation Chart */}
            <View style={styles.chartCard}>
              <Text style={styles.cardTitle}>Oxygen Saturation History</Text>
              <LineChart
                data={{
                  labels: historicalVitals.slice(-8).map(v => formatTime(v.timestamp)),
                  datasets: [{ 
                    data: historicalVitals.slice(-8).map(v => v.oxygenSaturation || 0) 
                  }]
                }}
                width={Dimensions.get('window').width - 48}
                height={220}
                chartConfig={{
                  backgroundColor: '#ffffff',
                  backgroundGradientFrom: '#ffffff',
                  backgroundGradientTo: '#ffffff',
                  decimalPlaces: 0,
                  color: (opacity = 1) => `rgba(33, 150, 243, ${opacity})`,
                  labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
                  style: { borderRadius: 16 },
                }}
                bezier
                style={styles.chart}
              />
            </View>
            
            {/* Temperature Chart */}
            <View style={styles.chartCard}>
              <Text style={styles.cardTitle}>Temperature History</Text>
              <LineChart
                data={{
                  labels: historicalVitals.slice(-8).map(v => formatTime(v.timestamp)),
                  datasets: [{ 
                    data: historicalVitals.slice(-8).map(v => v.temperature || 0) 
                  }]
                }}
                width={Dimensions.get('window').width - 48}
                height={220}
                chartConfig={{
                  backgroundColor: '#ffffff',
                  backgroundGradientFrom: '#ffffff',
                  backgroundGradientTo: '#ffffff',
                  decimalPlaces: 1,
                  color: (opacity = 1) => `rgba(255, 167, 38, ${opacity})`,
                  labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
                  style: { borderRadius: 16 },
                }}
                bezier
                style={styles.chart}
              />
            </View>
          </>
        )}

        {/* Action Buttons */}
        <View style={styles.actionsContainer}>
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={navigateToDetailedReports}
          >
            <Ionicons name="analytics" size={20} color="white" />
            <Text style={styles.actionButtonText}>View Detailed Reports</Text>
          </TouchableOpacity>
        </View>
        
        {/* Logout Button at bottom */}
        <View style={styles.logoutButtonContainer}>
          <TouchableOpacity
            style={styles.logoutButton}
            onPress={handleLogout}
          >
            <Ionicons name="log-out" size={20} color="white" />
            <Text style={styles.logoutButtonText}>Log Out</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 24,
  },
  backButton: {
    backgroundColor: '#5C6BC0',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  backButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  headerContainer: {
    padding: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  greeting: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  lastUpdated: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    margin: 16,
    marginTop: 24,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  chartCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    margin: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  infoLabel: {
    width: 80,
    fontSize: 14,
    color: '#666',
  },
  infoValue: {
    flex: 1,
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  vitalsSection: {
    margin: 16,
    marginTop: 0,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  settingsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f2f5',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 20,
  },
  settingsButtonText: {
    fontSize: 12,
    color: '#5C6BC0',
    marginLeft: 4,
  },
  vitalsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  vitalCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  vitalIconContainer: {
    marginRight: 12,
  },
  vitalDataContainer: {
    flex: 1,
  },
  vitalTitle: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },
  vitalValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  alertValue: {
    color: '#FF5252',
  },
  vitalUnit: {
    fontSize: 12,
    fontWeight: 'normal',
    color: '#666',
  },
  vitalRange: {
    fontSize: 10,
    color: '#999',
    marginTop: 2,
  },
  noDataContainer: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 40,
    margin: 16,
    marginTop: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noDataText: {
    color: '#888',
    marginTop: 12,
    fontSize: 16,
  },
  ecgSection: {
    margin: 16,
    marginTop: 0,
  },
  ecgContainer: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  ecgHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  ecgTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  heartRateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF525220',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 16,
  },
  heartRateLabel: {
    fontSize: 14,
    color: '#FF5252',
    marginRight: 4,
  },
  heartRateValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FF5252',
  },
  chart: {
    marginVertical: 8,
    borderRadius: 12,
    alignSelf: 'center',
  },
  actionsContainer: {
    margin: 16,
    marginBottom: 16,
  },
  actionButton: {
    backgroundColor: '#5C6BC0',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  actionButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  logoutButtonContainer: {
    margin: 16,
    marginTop: 8,
    marginBottom: 32,
  },
  logoutButton: {
    backgroundColor: '#FF5252',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  logoutButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  thresholdModal: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    width: '100%',
    maxHeight: '90%',
  },
  thresholdScrollView: {
    marginVertical: 16,
    maxHeight: '70%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  modalDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  thresholdSection: {
    marginBottom: 20,
    backgroundColor: '#f8f8f8',
    borderRadius: 8,
    padding: 12,
  },
  thresholdSectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#5C6BC0',
    marginBottom: 12,
  },
  thresholdInputGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 8,
  },
  thresholdLabel: {
    width: 120,
    fontSize: 14,
    color: '#555',
  },
  thresholdInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 10,
    marginRight: 8,
    fontSize: 16,
    textAlign: 'right',
    minHeight: 44, // Adding consistent height
    backgroundColor: '#f9f9f9', // Light background for better visibility
  },
  thresholdUnit: {
    width: 50,
    fontSize: 14,
    color: '#555',
    paddingLeft: 4,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingTop: 16,
  },
  modalCancelButton: {
    padding: 10,
    marginRight: 10,
  },
  modalCancelButtonText: {
    color: '#666',
    fontSize: 16,
  },
  modalSaveButton: {
    backgroundColor: '#5C6BC0',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  modalSaveButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});
