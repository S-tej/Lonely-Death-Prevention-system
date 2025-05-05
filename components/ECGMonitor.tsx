import React, { useEffect, useState, useContext } from 'react';
import { View, Text, StyleSheet, Dimensions, ActivityIndicator, ScrollView } from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { subscribeToData } from '../utils/realtimeDbUtils';
import { getLatestECGData } from '../utils/deviceUtils';
import { Ionicons } from '@expo/vector-icons';
import { get, onValue, ref } from 'firebase/database';
import { database } from '../firebase/config';
import { AuthContext } from '../context/AuthContext';

interface ECGMonitorProps {
  // Remove deviceId prop since we're getting data directly from the user
  sampleCount?: number;
}

interface ECGMetrics {
  HRV_SDNN: number;
  HRV_RMSSD: number;
  RR_interval: number;
  QRS_width: number;
  PR_interval: number;
  QT_interval: number;
  ST_deviation: number;
  signal_quality: number;
}

interface ECGData {
  data: {
    time: number;
    value: number;
  }[];
  metadata: {
    deviceID: string;
    samplingRate: number;
    uploadTime: number;
    samplesCount: number;
    dcOffset: number;
    gainFactor: number;
    ecgMetrics?: ECGMetrics;
  };
}

const ECGMonitor: React.FC<ECGMonitorProps> = ({ sampleCount = 100 }) => {
  const [ecgData, setEcgData] = useState<number[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [heartRate, setHeartRate] = useState<number | null>(null);
  const [metrics, setMetrics] = useState<ECGMetrics | null>(null);
  const [mlPrediction, setMlPrediction] = useState<{prediction: string, confidence: number} | null>(null);
  
  // Get the current user from AuthContext
  const { user } = useContext(AuthContext);

  useEffect(() => {
    if (!user) return;
    
    // Load initial data directly from user's vitals
    const loadData = async () => {
      try {
        setLoading(true);
        // Read directly from the user's vitals
        const userVitalsRef = ref(database, `vitals/${user.uid}/current`);
        const snapshot = await get(userVitalsRef);
        
        if (snapshot.exists()) {
          const vitalsData = snapshot.val();
          
          // Set ECG data if available
          if (vitalsData.ecgData) {
            setEcgData(vitalsData.ecgData.slice(-sampleCount));
          }
          
          // Set last updated time
          if (vitalsData.timestamp) {
            setLastUpdated(new Date(vitalsData.timestamp));
          }
          
          // Set heart rate
          if (vitalsData.heartRate) {
            setHeartRate(vitalsData.heartRate);
          }
          
          // Set ECG metrics
          if (vitalsData.ecgMetrics) {
            setMetrics(vitalsData.ecgMetrics);
          }
          
          // Set ML prediction if available
          if (vitalsData.mlAnalysis) {
            setMlPrediction({
              prediction: vitalsData.mlAnalysis.prediction,
              confidence: vitalsData.mlAnalysis.confidence
            });
          }
        }
      } catch (error) {
        console.error('Error loading vital data:', error);
      } finally {
        setLoading(false);
      }
    };
    
    loadData();
    
    // Subscribe to real-time updates from user's vitals
    const vitalsRef = ref(database, `vitals/${user.uid}/current`);
    const vitalsUnsubscribe = onValue(vitalsRef, (snapshot) => {
      if (snapshot.exists()) {
        const vitalsData = snapshot.val();
        
        // Update ECG data if available
        if (vitalsData.ecgData) {
          setEcgData(vitalsData.ecgData.slice(-sampleCount));
        }
        
        // Update last updated time
        if (vitalsData.timestamp) {
          setLastUpdated(new Date(vitalsData.timestamp));
        }
        
        // Update heart rate
        if (vitalsData.heartRate) {
          setHeartRate(vitalsData.heartRate);
        }
        
        // Update ECG metrics
        if (vitalsData.ecgMetrics) {
          setMetrics(vitalsData.ecgMetrics);
        }
        
        // Update ML prediction if available
        if (vitalsData.mlAnalysis) {
          setMlPrediction({
            prediction: vitalsData.mlAnalysis.prediction,
            confidence: vitalsData.mlAnalysis.confidence
          });
        }
      }
    });
    
    return () => {
      vitalsUnsubscribe();
    };
  }, [user, sampleCount]);

  // Very simplified heart rate estimation (fallback if not provided in data)
  const estimateHeartRate = (ecgValues: number[], samplingRate: number): number | null => {
    try {
      // Find peaks (very simplified - would need better algorithm in production)
      const threshold = Math.max(...ecgValues) * 0.6;
      let peakCount = 0;
      let isPeak = false;
      
      for (let i = 1; i < ecgValues.length - 1; i++) {
        if (!isPeak && ecgValues[i] > threshold && ecgValues[i] > ecgValues[i-1] && ecgValues[i] > ecgValues[i+1]) {
          peakCount++;
          isPeak = true;
        } else if (isPeak && ecgValues[i] < threshold) {
          isPeak = false;
        }
      }
      
      if (peakCount < 2) return null;
      
      // Calculate heart rate: (peaks / time period in seconds) * 60
      const timePeriodInSeconds = ecgValues.length / samplingRate;
      const heartRate = Math.round((peakCount / timePeriodInSeconds) * 60);
      
      // Sanity check - typical heart rates are between 40-200 BPM
      if (heartRate >= 40 && heartRate <= 200) {
        return heartRate;
      }
      return null;
    } catch (error) {
      console.error('Error estimating heart rate:', error);
      return null;
    }
  };

  // Function to get signal quality indicator
  const getSignalQualityIndicator = (quality: number | undefined) => {
    if (!quality) return "N/A";
    if (quality >= 0.9) return "Excellent";
    if (quality >= 0.7) return "Good";
    if (quality >= 0.5) return "Fair";
    return "Poor";
  };
  
  // Function to get color based on signal quality
  const getSignalQualityColor = (quality: number | undefined) => {
    if (!quality) return "#999";
    if (quality >= 0.9) return "#4CAF50";
    if (quality >= 0.7) return "#8BC34A";
    if (quality >= 0.5) return "#FFC107";
    return "#FF5252";
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#5C6BC0" />
        <Text style={styles.loadingText}>Loading ECG data...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Real-time ECG</Text>
        {heartRate && (
          <View style={styles.heartRateContainer}>
            <Text style={styles.heartRateLabel}>HR:</Text>
            <Text style={styles.heartRateValue}>{heartRate} BPM</Text>
          </View>
        )}
      </View>
      
      {/* Add ML Prediction display */}
      {mlPrediction && (
        <View style={styles.mlPredictionContainer}>
          <Text style={styles.mlPredictionTitle}>AI Analysis:</Text>
          <View style={styles.mlPredictionContent}>
            <Text style={styles.mlPredictionResult}>
              {mlPrediction.prediction}
            </Text>
            <Text style={styles.mlPredictionConfidence}>
              Confidence: {mlPrediction.confidence}%
            </Text>
          </View>
        </View>
      )}
      
      {lastUpdated && (
        <Text style={styles.lastUpdated}>
          Last updated: {lastUpdated.toLocaleTimeString()}
        </Text>
      )}
      
      {metrics && (
        <View style={styles.qualityIndicator}>
          <Text style={styles.qualityLabel}>Signal Quality:</Text>
          <Text style={[
            styles.qualityValue, 
            { color: getSignalQualityColor(metrics.signal_quality) }
          ]}>
            {getSignalQualityIndicator(metrics.signal_quality)}
          </Text>
        </View>
      )}
      
      {/* ECG Waveform Chart */}
      {ecgData.length > 0 ? (
        <LineChart
          data={{
            labels: [],
            datasets: [{ data: ecgData }]
          }}
          width={Dimensions.get('window').width - 32}
          height={220}
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
      ) : (
        <View style={styles.noDataContainer}>
          <Text style={styles.noDataText}>No ECG data available</Text>
        </View>
      )}
      
      {/* ECG Metrics Section */}
      {metrics && (
        <View style={styles.metricsContainer}>
          <Text style={styles.metricsTitle}>ECG Metrics</Text>
          
          <View style={styles.metricsGrid}>
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>HRV (SDNN)</Text>
              <Text style={styles.metricValue}>{metrics.HRV_SDNN} <Text style={styles.metricUnit}>ms</Text></Text>
              <Text style={styles.metricDesc}>Beat-to-beat variability</Text>
            </View>
            
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>HRV (RMSSD)</Text>
              <Text style={styles.metricValue}>{metrics.HRV_RMSSD} <Text style={styles.metricUnit}>ms</Text></Text>
              <Text style={styles.metricDesc}>Parasympathetic activity</Text>
            </View>
            
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>RR Interval</Text>
              <Text style={styles.metricValue}>{metrics.RR_interval} <Text style={styles.metricUnit}>ms</Text></Text>
              <Text style={styles.metricDesc}>Time between beats</Text>
            </View>
            
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>QRS Width</Text>
              <Text style={styles.metricValue}>{metrics.QRS_width} <Text style={styles.metricUnit}>ms</Text></Text>
              <Text style={styles.metricDesc}>Ventricular depolarization</Text>
            </View>
            
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>PR Interval</Text>
              <Text style={styles.metricValue}>{metrics.PR_interval} <Text style={styles.metricUnit}>ms</Text></Text>
              <Text style={styles.metricDesc}>AV conduction time</Text>
            </View>
            
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>QT Interval</Text>
              <Text style={styles.metricValue}>{metrics.QT_interval} <Text style={styles.metricUnit}>ms</Text></Text>
              <Text style={styles.metricDesc}>Electrical systole</Text>
            </View>
            
            <View style={[styles.metricCard, {width: '100%'}]}>
              <Text style={styles.metricLabel}>ST Deviation</Text>
              <Text style={[
                styles.metricValue, 
                {color: Math.abs(metrics.ST_deviation) > 0.1 ? '#FF5252' : '#4CAF50'}
              ]}>
                {metrics.ST_deviation.toFixed(2)} <Text style={styles.metricUnit}>mV</Text>
              </Text>
              <Text style={styles.metricDesc}>
                {Math.abs(metrics.ST_deviation) > 0.1 
                  ? "Potential ischemic changes" 
                  : "Normal ST segment"}
              </Text>
            </View>
          </View>
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginVertical: 8,
  },
  loadingContainer: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    height: 280,
  },
  loadingText: {
    marginTop: 12,
    color: '#666',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 18,
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
  lastUpdated: {
    fontSize: 12,
    color: '#999',
    marginBottom: 8,
  },
  qualityIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  qualityLabel: {
    fontSize: 12,
    color: '#666',
    marginRight: 4,
  },
  qualityValue: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  chart: {
    marginVertical: 8,
    borderRadius: 12,
  },
  noDataContainer: {
    height: 220,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    backgroundColor: '#f9f9f9',
  },
  noDataText: {
    color: '#666',
  },
  metricsContainer: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  metricsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  metricCard: {
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    width: '48%',
  },
  metricLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  metricValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  metricUnit: {
    fontSize: 12,
    fontWeight: 'normal',
    color: '#666',
  },
  metricDesc: {
    fontSize: 10,
    color: '#888',
    marginTop: 2,
  },
  mlPredictionContainer: {
    backgroundColor: '#f8f8f8',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  mlPredictionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  mlPredictionContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  mlPredictionResult: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#5C6BC0',
  },
  mlPredictionConfidence: {
    fontSize: 12,
    color: '#666',
  },
});

export default ECGMonitor;
