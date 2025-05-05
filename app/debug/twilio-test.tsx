import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TextInput, 
  TouchableOpacity, 
  ScrollView,
  ActivityIndicator
} from 'react-native';
import { Stack } from 'expo-router';
import { testTwilioConnection } from '../../utils/twilioTester';
import { makeEmergencyCall, sendEmergencySMS } from '../../utils/twilioService';

export default function TwilioDebugScreen() {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<{
    smsSuccess?: boolean;
    callSuccess?: boolean;
    errors?: string[];
    timestamp?: string;
  }>({});
  const [message, setMessage] = useState('This is a test message.');
  const [logOutput, setLogOutput] = useState<string[]>([]);
  
  // Function to log output
  const log = (text: string) => {
    setLogOutput(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${text}`]);
  };
  
  // Test SMS only
  const testSMS = async () => {
    if (!phoneNumber) {
      log('ERROR: Please enter a phone number');
      return;
    }
    
    setLoading(true);
    log(`Sending test SMS to ${phoneNumber}...`);
    
    try {
      const success = await sendEmergencySMS({
        to: phoneNumber,
        message
      });
      
      log(success ? 'SMS sent successfully!' : 'SMS sending failed.');
      setResults(prev => ({
        ...prev,
        smsSuccess: success,
        timestamp: new Date().toISOString()
      }));
    } catch (error) {
      log(`ERROR: ${error.toString()}`);
      setResults(prev => ({
        ...prev,
        errors: [error.toString()],
        timestamp: new Date().toISOString()
      }));
    } finally {
      setLoading(false);
    }
  };
  
  // Test call only
  const testCall = async () => {
    if (!phoneNumber) {
      log('ERROR: Please enter a phone number');
      return;
    }
    
    setLoading(true);
    log(`Making test call to ${phoneNumber}...`);
    
    try {
      const success = await makeEmergencyCall({
        to: phoneNumber,
        message
      });
      
      log(success ? 'Call initiated successfully!' : 'Call initiation failed.');
      setResults(prev => ({
        ...prev,
        callSuccess: success,
        timestamp: new Date().toISOString()
      }));
    } catch (error) {
      log(`ERROR: ${error.toString()}`);
      setResults(prev => ({
        ...prev,
        errors: [error.toString()],
        timestamp: new Date().toISOString()
      }));
    } finally {
      setLoading(false);
    }
  };
  
  // Run full test
  const runFullTest = async () => {
    if (!phoneNumber) {
      log('ERROR: Please enter a phone number');
      return;
    }
    
    setLoading(true);
    log('Running full Twilio connectivity test...');
    
    try {
      const testResults = await testTwilioConnection(phoneNumber);
      setResults({
        ...testResults,
        timestamp: new Date().toISOString()
      });
      
      log(`Test completed. SMS: ${testResults.smsSuccess ? 'SUCCESS' : 'FAILED'}, Call: ${testResults.callSuccess ? 'SUCCESS' : 'FAILED'}`);
      if (testResults.errors.length > 0) {
        log(`Errors: ${testResults.errors.join(', ')}`);
      }
    } catch (error) {
      log(`ERROR: ${error.toString()}`);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <>
      <Stack.Screen options={{ title: "Twilio Debug Tools" }} />
      <ScrollView style={styles.container}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Twilio Test Settings</Text>
          
          <Text style={styles.label}>Phone Number</Text>
          <TextInput
            style={styles.input}
            value={phoneNumber}
            onChangeText={setPhoneNumber}
            placeholder="Enter phone number (with or without +91)"
            keyboardType="phone-pad"
          />
          
          <Text style={styles.label}>Test Message</Text>
          <TextInput
            style={[styles.input, styles.messageInput]}
            value={message}
            onChangeText={setMessage}
            placeholder="Enter test message"
            multiline
          />
        </View>
        
        <View style={styles.buttonContainer}>
          <TouchableOpacity 
            style={[styles.button, styles.smsButton]} 
            onPress={testSMS}
            disabled={loading}
          >
            <Text style={styles.buttonText}>Test SMS</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.button, styles.callButton]} 
            onPress={testCall}
            disabled={loading}
          >
            <Text style={styles.buttonText}>Test Call</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.button, styles.fullTestButton]} 
            onPress={runFullTest}
            disabled={loading}
          >
            <Text style={styles.buttonText}>Run Full Test</Text>
          </TouchableOpacity>
        </View>
        
        {loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#5C6BC0" />
            <Text style={styles.loadingText}>Testing Twilio connection...</Text>
          </View>
        )}
        
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Test Results</Text>
          
          {results.timestamp && (
            <View style={styles.resultsContainer}>
              <Text style={styles.timestamp}>
                Last test: {new Date(results.timestamp).toLocaleString()}
              </Text>
              
              {results.smsSuccess !== undefined && (
                <View style={styles.resultRow}>
                  <Text style={styles.resultLabel}>SMS Test:</Text>
                  <Text style={[
                    styles.resultValue, 
                    results.smsSuccess ? styles.success : styles.failure
                  ]}>
                    {results.smsSuccess ? 'SUCCESS' : 'FAILED'}
                  </Text>
                </View>
              )}
              
              {results.callSuccess !== undefined && (
                <View style={styles.resultRow}>
                  <Text style={styles.resultLabel}>Call Test:</Text>
                  <Text style={[
                    styles.resultValue, 
                    results.callSuccess ? styles.success : styles.failure
                  ]}>
                    {results.callSuccess ? 'SUCCESS' : 'FAILED'}
                  </Text>
                </View>
              )}
              
              {results.errors && results.errors.length > 0 && (
                <View style={styles.errorsContainer}>
                  <Text style={styles.errorTitle}>Errors:</Text>
                  {results.errors.map((error, index) => (
                    <Text key={index} style={styles.errorText}>{error}</Text>
                  ))}
                </View>
              )}
            </View>
          )}
        </View>
        
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Debug Log</Text>
          <View style={styles.logContainer}>
            {logOutput.length > 0 ? (
              logOutput.map((line, index) => (
                <Text key={index} style={styles.logLine}>{line}</Text>
              ))
            ) : (
              <Text style={styles.emptyLog}>No log entries yet.</Text>
            )}
          </View>
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 16,
  },
  section: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
    color: '#333',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 16,
    backgroundColor: '#f9f9f9',
  },
  messageInput: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  button: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 4,
  },
  smsButton: {
    backgroundColor: '#26A69A',
  },
  callButton: {
    backgroundColor: '#5C6BC0',
  },
  fullTestButton: {
    backgroundColor: '#FF5252',
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 14,
  },
  loadingContainer: {
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'white',
    borderRadius: 12,
    marginBottom: 16,
  },
  loadingText: {
    marginTop: 8,
    color: '#666',
  },
  resultsContainer: {
    padding: 8,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
  },
  timestamp: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
  },
  resultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  resultLabel: {
    fontSize: 16,
    fontWeight: '500',
  },
  resultValue: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  success: {
    color: '#4CAF50',
  },
  failure: {
    color: '#F44336',
  },
  errorsContainer: {
    marginTop: 8,
    padding: 8,
    backgroundColor: '#FFEBEE',
    borderRadius: 4,
  },
  errorTitle: {
    fontWeight: 'bold',
    color: '#F44336',
    marginBottom: 4,
  },
  errorText: {
    color: '#F44336',
  },
  logContainer: {
    padding: 12,
    backgroundColor: '#263238',
    borderRadius: 8,
    maxHeight: 300,
  },
  logLine: {
    color: '#eee',
    fontFamily: 'monospace',
    fontSize: 12,
    marginBottom: 4,
  },
  emptyLog: {
    color: '#aaa',
    fontFamily: 'monospace',
    fontSize: 12,
    textAlign: 'center',
    padding: 12,
  }
});
