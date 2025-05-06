import { get, ref } from 'firebase/database';
import app, { database } from '../firebase/config';
const firestore = getFirestore(app);
import { 
  collection, 
  doc, 
  getDoc, 
  setDoc, 
  query, 
  where, 
  getDocs,
  deleteDoc ,
  getFirestore
} from 'firebase/firestore';

export type Caretaker = {
  uid: string;
  displayName: string;
  phoneNumber: string;
  email?: string;
  isCaretaker?: boolean;  // Added this property
  patients?: string[];    // Added this property
};

/**
 * Find a caretaker by phone number
 * @param phoneNumber - Phone number to search for
 */
export const findCaretakerByPhone = async (phoneNumber: string): Promise<Caretaker | null> => {
  try {
    const caretakerRef = doc(firestore, 'caretakers', phoneNumber);
    const caretakerDoc = await getDoc(caretakerRef);
    
    if (caretakerDoc.exists()) {
      const data = caretakerDoc.data();
      return {
        uid: data.uid,
        displayName: data.displayName,
        phoneNumber: data.phoneNumber,
        email: data.email,
      };
    }
    
    return null;
  } catch (error) {
    console.error('Error finding caretaker:', error);
    throw error;
  }
};

/**
 * Find caretakers by partial phone number
 * @param partialNumber - The partial phone number to search for
 * @returns Array of matching caretakers
 */
export const findCaretakersByPartialPhone = async (partialNumber: string): Promise<Caretaker[]> => {
  try {
    // Only search if we have at least 3 digits
    if (!partialNumber || partialNumber.length < 3) {
      return [];
    }

    // Query all profiles because Firebase doesn't support direct "startsWith" on orderByChild
    const profilesRef = ref(database, 'profiles');
    const snapshot = await get(profilesRef);
    
    if (!snapshot.exists()) {
      return [];
    }
    
    const profiles = snapshot.val();
    const caretakers: Caretaker[] = [];
    
    // Filter profiles manually for those with matching phone numbers and isCaretaker=true
    Object.entries(profiles).forEach(([uid, profile]: [string, any]) => {
      if (
        profile.isCaretaker === true && 
        profile.phoneNumber && 
        profile.phoneNumber.includes(partialNumber)
      ) {
        caretakers.push({
          uid,
          displayName: profile.displayName,
          phoneNumber: profile.phoneNumber,
          email: profile.email || '',
          isCaretaker: true,
          patients: profile.patients || []
        });
      }
    });
    
    return caretakers;
  } catch (error) {
    console.error('Error finding caretakers by partial phone:', error);
    return [];
  }
};

/**
 * Link a patient to a caretaker
 * @param patientId - The patient's user ID
 * @param caretakerId - The caretaker's user ID
 */
export const linkPatientToCaretaker = async (patientId: string, caretakerId: string) => {
  try {
    // Create a link in patient_caretakers collection
    await setDoc(doc(firestore, 'patient_caretakers', `${patientId}_${caretakerId}`), {
      patientId,
      caretakerId,
      dateLinked: new Date().toISOString()
    });
    
    return true;
  } catch (error) {
    console.error('Error linking patient to caretaker:', error);
    throw error;
  }
};

/**
 * Unlink a patient from a caretaker
 * @param patientId - The patient's user ID
 * @param caretakerId - The caretaker's user ID
 */
export const unlinkPatientFromCaretaker = async (patientId: string, caretakerId: string) => {
  try {
    // Remove the link from patient_caretakers collection
    await deleteDoc(doc(firestore, 'patient_caretakers', `${patientId}_${caretakerId}`));
    
    return true;
  } catch (error) {
    console.error('Error unlinking patient from caretaker:', error);
    throw error;
  }
};

/**
 * Get all caretakers linked to a patient
 * @param patientId - The patient's user ID
 */
export const getPatientCaretakers = async (patientId: string): Promise<Caretaker[]> => {
  try {
    // Query links where this user is the patient
    const linksQuery = query(
      collection(firestore, 'patient_caretakers'),
      where('patientId', '==', patientId)
    );
    
    const linkDocs = await getDocs(linksQuery);
    
    if (linkDocs.empty) return [];
    
    // Get caretaker details for each link
    const caretakers: Caretaker[] = [];
    
    for (const linkDoc of linkDocs.docs) {
      const link = linkDoc.data();
      const caretakerRef = doc(firestore, 'users', link.caretakerId);
      const caretakerDoc = await getDoc(caretakerRef);
      
      if (caretakerDoc.exists()) {
        const caretakerData = caretakerDoc.data();
        caretakers.push({
          uid: caretakerData.uid,
          displayName: caretakerData.displayName,
          phoneNumber: caretakerData.phoneNumber || ''
        });
      }
    }
    
    return caretakers;
  } catch (error) {
    console.error('Error getting patient caretakers:', error);
    throw error;
  }
};

/**
 * Get all patients linked to a caretaker
 * @param caretakerId - The caretaker's user ID
 */
export const getCaretakerPatients = async (caretakerId: string) => {
  try {
    // Query links where this user is the caretaker
    const linksQuery = query(
      collection(firestore, 'patient_caretakers'),
      where('caretakerId', '==', caretakerId)
    );
    
    const linkDocs = await getDocs(linksQuery);
    
    if (linkDocs.empty) return [];
    
    // Get patient details for each link
    const patients = [];
    
    for (const linkDoc of linkDocs.docs) {
      const link = linkDoc.data();
      const patientRef = doc(firestore, 'users', link.patientId);
      const patientDoc = await getDoc(patientRef);
      
      if (patientDoc.exists()) {
        patients.push({
          id: link.patientId,
          ...patientDoc.data()
        });
      }
    }
    
    return patients;
  } catch (error) {
    console.error('Error getting caretaker patients:', error);
    throw error;
  }
};
