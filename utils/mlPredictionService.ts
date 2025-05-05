/**
 * Service for making predictions using the deployed ML model
 */

interface PredictionParams {
  RR_interval: number;
  qrs_interval: number;
  pq_interval: number;
  st_interval: number;
  qt_interval: number;
}

interface PredictionResult {
  prediction: string;
  confidence: number;
}

/**
 * Make a prediction using the remote ML model
 * @param params - ECG parameters for prediction
 * @returns Prediction result with confidence
 */
export const getPrediction = async (params: PredictionParams): Promise<PredictionResult> => {
  try {
    console.log('Sending data to ML model:', params);
    
    const response = await fetch('https://ecg-cnn-deploy-16.onrender.com/predict', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(params)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`ML API error: ${response.status} ${errorText}`);
    }
    
    const result = await response.json();
    console.log('ML prediction received:', result);
    
    return {
      prediction: result.prediction,
      confidence: result.confidence
    };
  } catch (error) {
    console.error('ML prediction error:', error);
    throw error;
  }
};

/**
 * Maps ESP32 data to the format required by the ML model
 * @param espData - Raw ESP32 data
 * @returns Formatted parameters for ML prediction
 */
export const mapESP32DataToMLParams = (espData: any): PredictionParams => {
  return {
    RR_interval: espData.currentrr || 0,
    qrs_interval: espData.qrswidth || 0,
    pq_interval: espData.printerval || 0, // PR interval is the same as PQ interval
    st_interval: Math.abs(espData.stdeviation || 0) * 100, // Convert to appropriate scale
    qt_interval: espData.qtinterval || 0
  };
};
