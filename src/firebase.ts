import { initializeApp } from 'firebase/app';
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  getAuth,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocFromServer,
  getDocs,
  getFirestore,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import type {
  BusTicketRecord,
  CommuterFeedbackRecord,
  SavedRouteRecord,
  UserSessionProfile,
} from './types/transit.ts';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error:', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration: client is offline.');
    }
  }
}
void testConnection();

// Sanitization helpers matching firebase-blueprint.json boundaries
function clampStr(val: string, maxLen: number, fallback = ''): string {
  const cleaned = val.trim().slice(0, maxLen);
  return cleaned || fallback;
}

function sanitizeId(val: string, maxLen = 64): string {
  const cleaned = val.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, maxLen);
  return cleaned || `id_${Date.now()}`;
}

export async function signInWithGoogleAccount(): Promise<User> {
  const cred = await signInWithPopup(auth, googleProvider);
  return cred.user;
}

export async function registerWithEmailPassword(
  email: string,
  password: string,
  displayName: string
): Promise<User> {
  const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
  const safeName = clampStr(displayName, 80, 'Commuter');
  await updateProfile(cred.user, { displayName: safeName });
  try {
    await sendEmailVerification(cred.user);
  } catch {
    // Non-blocking verification email send
  }
  return cred.user;
}

export async function signInWithEmailPassword(email: string, password: string): Promise<User> {
  const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
  return cred.user;
}

export async function signOutAccount(): Promise<void> {
  await signOut(auth);
}

export async function ensureUserProfileDoc(user: User): Promise<UserSessionProfile> {
  const uid = sanitizeId(user.uid, 128);
  const userPath = `users/${uid}`;
  const piiPath = `users/${uid}/private/pii`;
  const provider: 'google' | 'password' = user.providerData.some(
    (p) => p.providerId === 'google.com'
  )
    ? 'google'
    : 'password';

  const fallbackProfile: UserSessionProfile = {
    uid,
    displayName: clampStr(user.displayName || user.email?.split('@')[0] || 'Commuter', 80, 'Commuter'),
    email: user.email,
    isGuest: false,
    emailVerified: user.emailVerified,
    provider,
    preferredCommuteMode: 'fastest',
    homeStopId: 'charbagh-nr',
    refreshIntervalSec: 4,
    googleFormCompleted: false,
  };

  try {
    const snap = await getDoc(doc(db, 'users', uid));
    if (snap.exists()) {
      const data = snap.data();
      return {
        uid,
        displayName: String(data.displayName || fallbackProfile.displayName),
        email: user.email,
        isGuest: false,
        emailVerified: user.emailVerified,
        provider,
        preferredCommuteMode:
          (data.preferredCommuteMode as UserSessionProfile['preferredCommuteMode']) || 'fastest',
        homeStopId: String(data.homeStopId || 'charbagh-nr'),
        refreshIntervalSec: Number(data.refreshIntervalSec || 4),
        googleFormCompleted: Boolean(data.googleFormCompleted),
      };
    }

    await setDoc(doc(db, 'users', uid), {
      uid,
      displayName: fallbackProfile.displayName,
      role: 'commuter',
      preferredCommuteMode: fallbackProfile.preferredCommuteMode,
      homeStopId: fallbackProfile.homeStopId,
      refreshIntervalSec: fallbackProfile.refreshIntervalSec,
      googleFormCompleted: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    if (user.email) {
      await setDoc(doc(db, 'users', uid, 'private', 'pii'), {
        uid,
        email: clampStr(user.email, 160),
        provider,
        updatedAt: serverTimestamp(),
      });
    }

    return fallbackProfile;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `${userPath} / ${piiPath}`);
  }
}

export async function updateUserPreferencesDoc(
  uid: string,
  updates: {
    displayName: string;
    preferredCommuteMode: UserSessionProfile['preferredCommuteMode'];
    homeStopId: string;
    refreshIntervalSec: number;
  }
): Promise<void> {
  const safeUid = sanitizeId(uid, 128);
  const path = `users/${safeUid}`;
  try {
    await updateDoc(doc(db, 'users', safeUid), {
      displayName: clampStr(updates.displayName, 80, 'Commuter'),
      preferredCommuteMode: updates.preferredCommuteMode,
      homeStopId: sanitizeId(updates.homeStopId, 64),
      refreshIntervalSec: Math.max(2, Math.min(60, Math.round(updates.refreshIntervalSec))),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function markGoogleFormCompletedDoc(uid: string): Promise<void> {
  const safeUid = sanitizeId(uid, 128);
  const path = `users/${safeUid}`;
  try {
    await updateDoc(doc(db, 'users', safeUid), {
      googleFormCompleted: true,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function listSavedRoutes(uid: string): Promise<SavedRouteRecord[]> {
  const safeUid = sanitizeId(uid, 128);
  const path = `users/${safeUid}/savedRoutes`;
  try {
    const q = query(
      collection(db, 'users', safeUid, 'savedRoutes'),
      where('userId', '==', safeUid),
      orderBy('createdAt', 'desc')
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => {
      const data = d.data();
      return {
        id: String(data.id || d.id),
        userId: String(data.userId),
        label: String(data.label || ''),
        originName: String(data.originName || ''),
        originStopId: String(data.originStopId || ''),
        destinationName: String(data.destinationName || ''),
        destinationStopId: String(data.destinationStopId || ''),
        preferredBusRoute: String(data.preferredBusRoute || ''),
        estimatedMinutes: Number(data.estimatedMinutes || 15),
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : undefined,
      };
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function saveCommuterRoute(
  uid: string,
  route: Omit<SavedRouteRecord, 'id' | 'userId' | 'createdAt'>
): Promise<SavedRouteRecord> {
  const safeUid = sanitizeId(uid, 128);
  const routeId = sanitizeId(`rt_${Date.now()}_${Math.floor(Math.random() * 1000)}`, 64);
  const path = `users/${safeUid}/savedRoutes/${routeId}`;
  const payload = {
    id: routeId,
    userId: safeUid,
    label: clampStr(route.label, 80, 'Saved Journey'),
    originName: clampStr(route.originName, 120, 'Origin'),
    originStopId: clampStr(route.originStopId, 64, 'charbagh-nr'),
    destinationName: clampStr(route.destinationName, 120, 'Destination'),
    destinationStopId: clampStr(route.destinationStopId, 64, 'gomti-nagar'),
    preferredBusRoute: clampStr(route.preferredBusRoute, 32, 'JANRATH-101'),
    estimatedMinutes: Math.max(1, Math.min(600, Math.round(route.estimatedMinutes))),
    createdAt: serverTimestamp(),
  };

  try {
    await setDoc(doc(db, 'users', safeUid, 'savedRoutes', routeId), payload);
    return {
      ...payload,
      createdAt: new Date().toISOString(),
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function deleteSavedRoute(uid: string, routeId: string): Promise<void> {
  const safeUid = sanitizeId(uid, 128);
  const safeRouteId = sanitizeId(routeId, 64);
  const path = `users/${safeUid}/savedRoutes/${safeRouteId}`;
  try {
    await deleteDoc(doc(db, 'users', safeUid, 'savedRoutes', safeRouteId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function submitCommuterFeedback(
  record: Omit<CommuterFeedbackRecord, 'id' | 'createdAt'>
): Promise<void> {
  const safeUid = sanitizeId(record.userId, 128);
  const feedbackId = sanitizeId(`fb_${Date.now()}_${Math.floor(Math.random() * 1000)}`, 64);
  const path = `feedback/${feedbackId}`;
  try {
    await setDoc(doc(db, 'feedback', feedbackId), {
      userId: safeUid,
      displayName: clampStr(record.displayName, 80, 'Commuter'),
      frequentRoute: clampStr(record.frequentRoute, 64, 'M-14'),
      commuteTimeSlot: clampStr(record.commuteTimeSlot, 32, '09:00 AM Peak'),
      satisfactionRating: Math.max(1, Math.min(5, Math.round(record.satisfactionRating))),
      congestionHotspotNote: clampStr(record.congestionHotspotNote, 500, ''),
      submittedViaGoogleForm: Boolean(record.submittedViaGoogleForm),
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function listUserTicketsDoc(uid: string): Promise<BusTicketRecord[]> {
  const safeUid = sanitizeId(uid, 128);
  const path = `users/${safeUid}/tickets`;
  try {
    const q = query(
      collection(db, 'users', safeUid, 'tickets'),
      where('userId', '==', safeUid),
      orderBy('createdAt', 'desc')
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => {
      const data = d.data();
      return {
        id: String(data.id || d.id),
        userId: String(data.userId),
        pnrNumber: String(data.pnrNumber || ''),
        routeId: String(data.routeId || ''),
        routeShortName: String(data.routeShortName || ''),
        routeName: String(data.routeName || ''),
        busType: String(data.busType || ''),
        originStopName: String(data.originStopName || ''),
        originStopId: String(data.originStopId || ''),
        destinationStopName: String(data.destinationStopName || ''),
        destinationStopId: String(data.destinationStopId || ''),
        travelDate: String(data.travelDate || ''),
        departureTime: String(data.departureTime || ''),
        passengerName: String(data.passengerName || ''),
        passengerAge: Number(data.passengerAge || 25),
        passengerGender: String(data.passengerGender || 'Other'),
        passengerPhone: String(data.passengerPhone || ''),
        seatList: String(data.seatList || ''),
        totalFare: Number(data.totalFare || 0),
        status: (data.status as 'CONFIRMED' | 'CANCELLED') || 'CONFIRMED',
        qrCodeToken: String(data.qrCodeToken || ''),
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : undefined,
      };
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function bookBusTicketDoc(
  uid: string,
  ticket: Omit<BusTicketRecord, 'id' | 'userId' | 'createdAt'>
): Promise<BusTicketRecord> {
  const safeUid = sanitizeId(uid, 128);
  const ticketId = sanitizeId(`tkt_${Date.now()}_${Math.floor(Math.random() * 1000)}`, 64);
  const path = `users/${safeUid}/tickets/${ticketId}`;
  const payload = {
    id: ticketId,
    userId: safeUid,
    pnrNumber: clampStr(ticket.pnrNumber, 32, `UP-${Date.now().toString().slice(-6)}`),
    routeId: clampStr(ticket.routeId, 64, 'route-janrath'),
    routeShortName: clampStr(ticket.routeShortName, 32, 'JANRATH'),
    routeName: clampStr(ticket.routeName, 120, 'UP State Express'),
    busType: clampStr(ticket.busType, 64, 'AC Janrath 2x2'),
    originStopName: clampStr(ticket.originStopName, 120, 'Alambagh ISBT'),
    originStopId: clampStr(ticket.originStopId, 64, 'alambagh-isbt'),
    destinationStopName: clampStr(ticket.destinationStopName, 120, 'Ayodhya Dham'),
    destinationStopId: clampStr(ticket.destinationStopId, 64, 'ayodhya-dham'),
    travelDate: clampStr(ticket.travelDate, 32, new Date().toISOString().split('T')[0]),
    departureTime: clampStr(ticket.departureTime, 32, '10:30 AM'),
    passengerName: clampStr(ticket.passengerName, 80, 'Passenger'),
    passengerAge: Math.max(1, Math.min(120, Math.round(ticket.passengerAge))),
    passengerGender: clampStr(ticket.passengerGender, 16, 'Male'),
    passengerPhone: clampStr(ticket.passengerPhone, 32, '+91-9876543210'),
    seatList: clampStr(ticket.seatList, 64, '12A'),
    totalFare: Math.max(0, Math.min(100000, Math.round(ticket.totalFare))),
    status: 'CONFIRMED' as const,
    qrCodeToken: clampStr(ticket.qrCodeToken, 128, `QR-${ticketId}`),
    createdAt: serverTimestamp(),
  };

  try {
    await setDoc(doc(db, 'users', safeUid, 'tickets', ticketId), payload);
    return {
      ...payload,
      createdAt: new Date().toISOString(),
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function cancelBusTicketDoc(uid: string, ticketId: string): Promise<void> {
  const safeUid = sanitizeId(uid, 128);
  const safeTicketId = sanitizeId(ticketId, 64);
  const path = `users/${safeUid}/tickets/${safeTicketId}`;
  try {
    await updateDoc(doc(db, 'users', safeUid, 'tickets', safeTicketId), {
      status: 'CANCELLED',
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}
