# 🏥 Lonely Death Prevention System (LDPS)

[![React Native](https://img.shields.io/badge/React%20Native-v0.73-blue.svg)](https://reactnative.dev/)
[![Expo](https://img.shields.io/badge/Expo-v52.0.46-blue.svg)](https://expo.dev/)
[![Firebase](https://img.shields.io/badge/Firebase-v11.6.0-orange.svg)](https://firebase.google.com/)
[![Status](https://img.shields.io/badge/Status-Active-green.svg)]()

LDPS is a comprehensive health monitoring system that connects patients with caretakers to prevent lonely deaths and provide timely emergency assistance.

<details>
<summary>📱 Screenshots (Click to expand)</summary>

<div align="center">
<!-- Replace with your actual screenshots -->
<img src="./assets/screenshots/dashboard.png" alt="Dashboard" width="250"/>
<img src="./assets/screenshots/vitals.png" alt="Vitals" width="250"/>
<img src="./assets/screenshots/caretaker-view.png" alt="Caretaker View" width="250"/>
</div>
</details>

## ✨ Interactive Features

<div align="center">
  <a href="#-for-patients"><img src="https://img.shields.io/badge/For%20Patients-blue?style=for-the-badge" alt="For Patients" /></a>
  <a href="#-for-caretakers"><img src="https://img.shields.io/badge/For%20Caretakers-green?style=for-the-badge" alt="For Caretakers" /></a>
  <a href="#-setup-guide"><img src="https://img.shields.io/badge/Setup%20Guide-orange?style=for-the-badge" alt="Setup Guide" /></a>
</div>

## 🤔 What is LDPS?

LDPS connects to ESP32-based health monitors to track vital signs including:
- ❤️ Heart rate and ECG
- 🩸 Blood pressure
- 🌡️ Body temperature![IMG_6800 copy](https://github.com/user-attachments/assets/db952c89-fb2a-4f94-8966-bf3aa7445f4d)

- 💧 Oxygen saturation

When critical health events are detected, the system automatically alerts caretakers and emergency contacts through calls and SMS.

## 🏃‍♂️ Quick Start

<details open>
<summary>📋 Prerequisites</summary>

- [Node.js](https://nodejs.org/) (v18 or newer)
- [Expo CLI](https://docs.expo.dev/workflow/expo-cli/)
- [Android Studio](https://developer.android.com/studio) (for Android development) or [Xcode](https://developer.apple.com/xcode/) (for iOS development)
- [Firebase account](https://firebase.google.com/)
- [Twilio account](https://www.twilio.com/) (for emergency calls/SMS)

</details>

<details>
<summary>🔧 Installation</summary>

```bash
# Clone the repository
git clone https://github.com/yourusername/LDPS.git
cd LDPS

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your configuration
```

</details>

<details>
<summary>⚙️ Configuration</summary>

1. Set up your environment variables in `.env`:
   ```
   ESP_IP=http://your-esp32-ip-address
   FIREBASE_API_KEY=your_api_key
   FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
   FIREBASE_PROJECT_ID=your_project_id
   FIREBASE_STORAGE_BUCKET=your_project_id.firebasestorage.app
   FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
   FIREBASE_APP_ID=your_app_id
   FIREBASE_MEASUREMENT_ID=your_measurement_id
   TWILIO_ACCOUNT_SID=your_twilio_sid
   TWILIO_AUTH_TOKEN=your_twilio_auth_token
   TWILIO_FLOW_SID=your_twilio_flow_sid
   TWILIO_PHONE_NUMBER=your_twilio_phone
   ```
   
2. Set up Firebase:
   - Create a Firebase project
   - Enable Authentication, Realtime Database, and Firestore
   - Add Android/iOS apps to your project

3. Set up Twilio:
   - Create a Twilio account
   - Get an account SID and auth token
   - Set up a Twilio Flow for emergency calls
</details>

<details>
<summary>▶️ Running the App</summary>

```bash
# Start the development server with Expo
npm start

# Run on Android
npm run android

# Run on iOS
npm run ios

# Build APK
npx eas build -p android --profile production
```

</details>

## 💻 For Developers

<details>
<summary>📁 Project Structure</summary>

