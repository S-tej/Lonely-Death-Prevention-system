import React, { useState, useEffect, useContext } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  ActivityIndicator,
  TouchableOpacity 
} from 'react-native';
import { Stack, useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LineChart } from 'react-native-chart-kit';
import { Dimensions } from 'react-native';
import { AuthContext } from '../context/AuthContext';
import { doc, getDoc ,getFirestore} from 'firebase/firestore';
import app, { database } from '../firebase/config';
// import { firestore, database } from '../firebase/config';
const firestore = getFirestore(app);
import { ref, onValue, get } from 'firebase/database';

interface PatientProfile {
  displayName: string;
  age?: number;
  gender?: string;
}

interface VitalPoint {
  timestamp: number;
  value: number;
}

interface PatientReports {
  profile: PatientProfile;
  heartRate: VitalPoint[];
  oxygenSaturation: VitalPoint[];
  temperature: VitalPoint[];
  bloodPressure: {
    systolic: VitalPoint[];
    diastolic: VitalPoint[];
  };
  latestVitals: {
    heartRate: number;
    oxygenSaturation: number;
    temperature: number;
    bloodPressure: {
      systolic: number;
      diastolic: number;
    };
    timestamp: number;
  } | null;
}

export default function PatientReportsScreen() {
  const { patientId } = useLocalSearchParams();
  const { user } = useContext(AuthContext);
  const [loading, setLoading] = useState(true);
  const [reports, setReports] = useState<PatientReports>({
    profile: { displayName: 'Patient' },
    heartRate: [],
    oxygenSaturation: [],
    temperature: [],
    bloodPressure: { systolic: [], diastolic: [] },
    latestVitals: null
  });

  useEffect(() => {
    if (!user || !patientId) return;

    const loadPatientData = async () => {
      try {
        setLoading(true);
        
        // Get patient profile
        const patientProfileRef = doc(firestore, 'users', patientId as string);
        const patientProfileSnap = await getDoc(patientProfileRef);
        
        if (!patientProfileSnap.exists()) {
          console.error('Patient profile not found');
          setLoading(false);
          return;
        }
        
        const profile = patientProfileSnap.data() as PatientProfile;
        
        // Get vitals history
        const vitalsRef = ref(database, `vitals/${patientId}/history`);
        const vitalsSnap = await get(vitalsRef);
        
        if (!vitalsSnap.exists()) {
          setReports({
            profile,
            heartRate: [],
            oxygenSaturation: [],
            temperature: [],
            bloodPressure: { systolic: [], diastolic: [] },
            latestVitals: null
          });
          setLoading(false);
          return;
        }
        
        const vitalsData = vitalsSnap.val();
        
        // Process vitals data
        const heartRate: VitalPoint[] = [];
        const oxygenSaturation: VitalPoint[] = [];
        const temperature: VitalPoint[] = [];
        const systolic: VitalPoint[] = [];
        const diastolic: VitalPoint[] = [];
        
        // Sort timestamps to get data in chronological order
        const sortedTimestamps = Object.keys(vitalsData)
          .map(Number)
          .sort((a, b) => a - b);
        
        // Get last 20 readings for each vital sign
        const recentTimestamps = sortedTimestamps.slice(-20);
        
        recentTimestamps.forEach(timestamp => {
          const vital = vitalsData[timestamp];
          
          if (vital.heartRate !== undefined) {
            heartRate.push({ timestamp, value: vital.heartRate });
          }
          
          if (vital.oxygenSaturation !== undefined) {
            oxygenSaturation.push({ timestamp, value: vital.oxygenSaturation });
          }
          
          if (vital.temperature !== undefined) {
            temperature.push({ timestamp, value: vital.temperature });
          }
          
          if (vital.bloodPressure) {
            if (vital.bloodPressure.systolic !== undefined) {
              systolic.push({ timestamp, value: vital.bloodPressure.systolic });
            }
            
            if (vital.bloodPressure.diastolic !== undefined) {
              diastolic.push({ timestamp, value: vital.bloodPressure.diastolic });
            }
          }
        });
        
        // Get latest vitals
        let latestVitals = null;
        if (recentTimestamps.length > 0) {
          const latestTimestamp = recentTimestamps[recentTimestamps.length - 1];
          const latest = vitalsData[latestTimestamp];
          
          latestVitals = {
            heartRate: latest.heartRate || 0,
            oxygenSaturation: latest.oxygenSaturation || 0,
            temperature: latest.temperature || 0,
            bloodPressure: {
              systolic: latest.bloodPressure?.systolic || 0,
              diastolic: latest.bloodPressure?.diastolic || 0
            },
            timestamp: latestTimestamp
          };
        }
        
        setReports({
          profile,
          heartRate,
          oxygenSaturation,
          temperature,
          bloodPressure: { systolic, diastolic },
          latestVitals
        });
      } catch (error) {
        console.error('Error loading patient data:', error);
      } finally {
        setLoading(false);
      }
    };
    
    loadPatientData();
  }, [user, patientId]);

  const formatTime = (timestamp: number): string => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <>
      <Stack.Screen 
        options={{ 
          title: reports.profile.displayName,
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
      
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#5C6BC0" />
          <Text style={styles.loadingText}>Loading patient data...</Text>
        </View>
      ) : (
        <ScrollView style={styles.container}>
          {/* Patient Info Card */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Patient Information</Text>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Name:</Text>
              <Text style={styles.infoValue}>{reports.profile.displayName}</Text>
            </View>
            {reports.profile.age && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Age:</Text>
                <Text style={styles.infoValue}>{reports.profile.age} years</Text>
              </View>
            )}
            {reports.profile.gender && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Gender:</Text>
                <Text style={styles.infoValue}>{reports.profile.gender}</Text>
              </View>
            )}
          </View>
          
          {/* Current Vitals Card */}
          {reports.latestVitals && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Current Vitals</Text>
              <Text style={styles.timestamp}>
                Last updated: {new Date(reports.latestVitals.timestamp).toLocaleString()}
              </Text>
              
              <View style={styles.vitalGrid}>
                <View style={styles.vitalItem}>
                  <Ionicons name="heart" size={24} color="#FF5252" />
                  <Text style={styles.vitalValue}>{reports.latestVitals.heartRate}</Text>
                  <Text style={styles.vitalLabel}>BPM</Text>
                </View>
                
                <View style={styles.vitalItem}>
                  <Ionicons name="water" size={24} color="#5C6BC0" />
                  <Text style={styles.vitalValue}>{reports.latestVitals.oxygenSaturation}%</Text>
                  <Text style={styles.vitalLabel}>SpO₂</Text>
                </View>
                
                <View style={styles.vitalItem}>
                  <Ionicons name="thermometer" size={24} color="#FFA726" />
                  <Text style={styles.vitalValue}>{reports.latestVitals.temperature.toFixed(1)}°C</Text>
                  <Text style={styles.vitalLabel}>Temp</Text>
                </View>
                
                <View style={styles.vitalItem}>
                  <Ionicons name="pulse" size={24} color="#4CAF50" />
                  <Text style={styles.vitalValue}>
                    {reports.latestVitals.bloodPressure.systolic}/{reports.latestVitals.bloodPressure.diastolic}
                  </Text>
                  <Text style={styles.vitalLabel}>BP</Text>
                </View>
              </View>
              <TouchableOpacity 
                style={styles.dashboardButton}
                onPress={() => router.push({
                  pathname: './caretaker-patient-dashboard',
                  params: { patientId: patientId as string }
                })}
              >
                <Ionicons name="pulse" size={18} color="white" />
                <Text style={styles.dashboardButtonText}>
                  View Live Dashboard
                </Text>
              </TouchableOpacity>
            </View>
          )}
          
          {/* Heart Rate Chart */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Heart Rate History</Text>
            {reports.heartRate.length > 0 ? (
              <LineChart
                data={{
                  labels: reports.heartRate.map(point => formatTime(point.timestamp)),
                  datasets: [{ data: reports.heartRate.map(point => point.value) }]
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
            ) : (
              <Text style={styles.noDataText}>No heart rate data available</Text>
            )}
          </View>
          
          {/* Oxygen Saturation Chart */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Oxygen Saturation History</Text>
            {reports.oxygenSaturation.length > 0 ? (
              <LineChart
                data={{
                  labels: reports.oxygenSaturation.map(point => formatTime(point.timestamp)),
                  datasets: [{ data: reports.oxygenSaturation.map(point => point.value) }]
                }}
                width={Dimensions.get('window').width - 48}
                height={220}
                chartConfig={{
                  backgroundColor: '#ffffff',
                  backgroundGradientFrom: '#ffffff',
                  backgroundGradientTo: '#ffffff',
                  decimalPlaces: 0,
                  color: (opacity = 1) => `rgba(92, 107, 192, ${opacity})`,
                  labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
                  style: { borderRadius: 16 },
                }}
                bezier
                style={styles.chart}
              />
            ) : (
              <Text style={styles.noDataText}>No oxygen saturation data available</Text>
            )}
          </View>
          
          {/* Temperature Chart */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Temperature History</Text>
            {reports.temperature.length > 0 ? (
              <LineChart
                data={{
                  labels: reports.temperature.map(point => formatTime(point.timestamp)),
                  datasets: [{ data: reports.temperature.map(point => point.value) }]
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
            ) : (
              <Text style={styles.noDataText}>No temperature data available</Text>
            )}
          </View>
          
          {/* Blood Pressure Chart */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Blood Pressure History</Text>
            {reports.bloodPressure.systolic.length > 0 ? (
              <LineChart
                data={{
                  labels: reports.bloodPressure.systolic.map(point => formatTime(point.timestamp)),
                  datasets: [
                    { 
                      data: reports.bloodPressure.systolic.map(point => point.value),
                      color: (opacity = 1) => `rgba(244, 67, 54, ${opacity})`,
                    },
                    { 
                      data: reports.bloodPressure.diastolic.map(point => point.value),
                      color: (opacity = 1) => `rgba(76, 175, 80, ${opacity})`,
                    }
                  ],
                  legend: ['Systolic', 'Diastolic']
                }}
                width={Dimensions.get('window').width - 48}
                height={220}
                chartConfig={{
                  backgroundColor: '#ffffff',
                  backgroundGradientFrom: '#ffffff',
                  backgroundGradientTo: '#ffffff',
                  decimalPlaces: 0,
                  color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
                  labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
                  style: { borderRadius: 16 },
                }}
                bezier
                style={styles.chart}
              />
            ) : (
              <Text style={styles.noDataText}>No blood pressure data available</Text>
            )}
          </View>
        </ScrollView>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 16,
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
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
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
  timestamp: {
    fontSize: 12,
    color: '#999',
    marginBottom: 12,
  },
  vitalGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  vitalItem: {
    width: '48%',
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  vitalValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 8,
  },
  vitalLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  chart: {
    marginVertical: 8,
    borderRadius: 12,
  },
  noDataText: {
    textAlign: 'center',
    color: '#999',
    padding: 24,
  },
  dashboardButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#5C6BC0',
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 16,
  },
  dashboardButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
});
