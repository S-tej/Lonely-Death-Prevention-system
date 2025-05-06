import React, { useState, useEffect, useContext } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  Dimensions
} from 'react-native';
import { Stack, useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AuthContext } from '../context/AuthContext';
import { database } from '../firebase/config';
import app from '../firebase/config';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { ref, get, onValue } from 'firebase/database';
import ECGMonitor from '../components/ECGMonitor';
import VitalCard from '../components/VitalCard';
import { LineChart } from 'react-native-chart-kit';

// Define firestore constant after imports
const firestore = getFirestore(app);

export default function CaretakerPatientDashboardScreen() {
  const { patientId } = useLocalSearchParams();
  const { user } = useContext(AuthContext);
  const [loading, setLoading] = useState(true);
  const [patientProfile, setPatientProfile] = useState<any>(null);
  const [vitalsData, setVitalsData] = useState<any>(null);
  const [ecgData, setEcgData] = useState<number[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !patientId) return;

    const loadPatientData = async () => {
      try {
        setLoading(true);
        setError(null);

        // 1. Get patient profile
        const patientRef = doc(firestore, 'users', patientId as string);
        const patientSnap = await getDoc(patientRef);

        if (!patientSnap.exists()) {
          // Try RTDB as fallback
          const rtdbProfileRef = ref(database, `profiles/${patientId}`);
          const rtdbProfileSnap = await get(rtdbProfileRef);
          
          if (!rtdbProfileSnap.exists()) {
            throw new Error('Patient profile not found');
          }
          
          setPatientProfile(rtdbProfileSnap.val());
        } else {
          setPatientProfile(patientSnap.data());
        }

        // 2. Get latest vitals (one-time fetch)
        const vitalsRef = ref(database, `vitals/${patientId}/current`);
        const vitalsSnap = await get(vitalsRef);

        if (vitalsSnap.exists()) {
          const data = vitalsSnap.val();
          setVitalsData(data);
          if (data.ecgData) {
            setEcgData(data.ecgData);
          }
          if (data.timestamp) {
            setLastUpdated(new Date(data.timestamp));
          }
        }

        // 3. Subscribe to real-time updates
        const realtimeVitalsRef = ref(database, `vitals/${patientId}/current`);
        const unsubscribe = onValue(realtimeVitalsRef, (snapshot) => {
          if (snapshot.exists()) {
            const data = snapshot.val();
            setVitalsData(data);
            if (data.ecgData) {
              setEcgData(data.ecgData);
            }
            if (data.timestamp) {
              setLastUpdated(new Date(data.timestamp));
            }
          }
        });

        return () => unsubscribe();
      } catch (err: any) {
        console.error('Error loading patient data:', err);
        setError(err.message || 'Failed to load patient data');
        Alert.alert('Error', 'Failed to load patient data');
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

        {/* Vitals Section */}
        {vitalsData ? (
          <View style={styles.vitalsSection}>
            <Text style={styles.sectionTitle}>Current Vitals</Text>
            <View style={styles.vitalsGrid}>
              <View style={styles.vitalCard}>
                <View style={styles.vitalIconContainer}>
                  <Ionicons name="heart" size={24} color="#FF5252" />
                </View>
                <View style={styles.vitalDataContainer}>
                  <Text style={styles.vitalTitle}>Heart Rate</Text>
                  <Text style={styles.vitalValue}>
                    {vitalsData.heartRate || '--'} <Text style={styles.vitalUnit}>BPM</Text>
                  </Text>
                </View>
              </View>

              <View style={styles.vitalCard}>
                <View style={styles.vitalIconContainer}>
                  <Ionicons name="water" size={24} color="#2196F3" />
                </View>
                <View style={styles.vitalDataContainer}>
                  <Text style={styles.vitalTitle}>SpO₂</Text>
                  <Text style={styles.vitalValue}>
                    {vitalsData.oxygenSaturation || '--'} <Text style={styles.vitalUnit}>%</Text>
                  </Text>
                </View>
              </View>

              <View style={styles.vitalCard}>
                <View style={styles.vitalIconContainer}>
                  <Ionicons name="thermometer" size={24} color="#FFA726" />
                </View>
                <View style={styles.vitalDataContainer}>
                  <Text style={styles.vitalTitle}>Temperature</Text>
                  <Text style={styles.vitalValue}>
                    {vitalsData.temperature ? vitalsData.temperature.toFixed(1) : '--'} <Text style={styles.vitalUnit}>°C</Text>
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
                    <Text style={styles.vitalValue}>
                      {`${vitalsData.bloodPressure.systolic || '--'}/${vitalsData.bloodPressure.diastolic || '--'}`} <Text style={styles.vitalUnit}>mmHg</Text>
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
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
    paddingHorizontal: 4,
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
  vitalUnit: {
    fontSize: 12,
    fontWeight: 'normal',
    color: '#666',
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
    marginBottom: 32,
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
  }
});
