import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { checkESP32Connection } from '../utils/esp32DataFetcher';

interface ESP32StatusProps {
  compact?: boolean;
}

const ESP32Status: React.FC<ESP32StatusProps> = ({ compact = false }) => {
  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  const [lastChecked, setLastChecked] = useState<Date>(new Date());

  useEffect(() => {
    let isMounted = true;
    
    const checkConnection = async () => {
      const status = await checkESP32Connection();
      if (isMounted) {
        setIsConnected(status);
        setLastChecked(new Date());
      }
    };
    
    // Check connection initially
    checkConnection();
    
    // Set interval for periodic checks
    const interval = setInterval(checkConnection, 15000); // Check every 15 seconds
    
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  if (isConnected === null) {
    return (
      <View style={compact ? styles.compactContainer : styles.container}>
        <Ionicons name="ellipsis-horizontal" size={compact ? 16 : 24} color="#999" />
        <Text style={compact ? styles.compactText : styles.text}>Checking ESP32...</Text>
      </View>
    );
  }

  return (
    <View style={compact ? styles.compactContainer : styles.container}>
      <Ionicons 
        // name={isConnected ? "wifi" : "wifi-off"} 
        size={compact ? 16 : 24} 
        color={isConnected ? "#4CAF50" : "#FF5252"} 
      />
      <Text style={[
        compact ? styles.compactText : styles.text, 
        { color: isConnected ? "#4CAF50" : "#FF5252" }
      ]}>
        ESP32 {isConnected ? "Connected" : "Disconnected"}
      </Text>
      {!compact && (
        <Text style={styles.timestamp}>
          Last checked: {lastChecked.toLocaleTimeString()}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'column',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    marginBottom: 16,
  },
  compactContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: '#f5f5f5',
    borderRadius: 16,
  },
  text: {
    fontSize: 16,
    fontWeight: '500',
    marginTop: 4,
  },
  compactText: {
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 4,
  },
  timestamp: {
    fontSize: 12,
    color: '#888',
    marginTop: 4,
  }
});

export default ESP32Status;
