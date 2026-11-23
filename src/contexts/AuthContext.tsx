import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  User as FirebaseUser
} from 'firebase/auth';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { auth, db, isFirebaseConfigured } from '../lib/firebase';
import { functionsApi } from '../lib/functionsApi';
import { getOrCreateDeviceId } from '../lib/device';
import type { SchoolProfile, UserProfile, UserRole } from '../types';

const DEFAULT_SCHOOL: SchoolProfile = {
  schoolName: 'SMK NEGERI 6 MUARO JAMBI',
  appName: 'SMART ATTENDANCE',
  logoUrl: '/school-logo-default.svg',
  address: 'Kabupaten Muaro Jambi, Provinsi Jambi',
  academicYear: '2026/2027',
  principalName: 'Kepala SMK Negeri 6 Muaro Jambi',
  principalNip: '-',
  contact: 'info@smkn6muarojambi.sch.id'
};

interface AuthContextValue {
  firebaseUser: FirebaseUser | null;
  profile: UserProfile | null;
  school: SchoolProfile;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshClaims: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [school, setSchool] = useState<SchoolProfile>(DEFAULT_SCHOOL);
  const [loading, setLoading] = useState<boolean>(true);

  // Listen to public school profile branding
  useEffect(() => {
    if (!isFirebaseConfigured || !db) return;
    const ref = doc(db, 'system_settings', 'school_profile');
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (snap.exists()) {
          const data = snap.data() as Partial<SchoolProfile>;
          setSchool({
            ...DEFAULT_SCHOOL,
            ...data,
            logoUrl: data.logoUrl || DEFAULT_SCHOOL.logoUrl
          });
        }
      },
      () => {
        // Fallback silently to default branding if offline before first load
      }
    );
    return () => unsub();
  }, []);

  const loadUserProfile = async (user: FirebaseUser) => {
    const tokenResult = await user.getIdTokenResult(true);
    const claims = tokenResult.claims as Record<string, unknown>;
    const claimRole = claims.role as UserRole | undefined;

    if (!db) return;
    const snap = await getDoc(doc(db, 'users', user.uid));
    if (!snap.exists()) {
      setProfile(null);
      return;
    }

    const data = snap.data();
    const role = claimRole || (data.role as UserRole);
    const active = data.active !== false && claims.active !== false;

    if (!role || !active) {
      setProfile(null);
      return;
    }

    setProfile({
      uid: user.uid,
      email: String(data.email || user.email || ''),
      displayName: String(data.displayName || user.displayName || ''),
      role,
      teacherId: (claims.teacherId as string) || data.teacherId || null,
      assignedClassId: (claims.assignedClassId as string) || data.assignedClassId || null,
      assignedClassName: data.assignedClassName || null,
      phone: data.phone || '',
      active
    });
  };

  useEffect(() => {
    if (!isFirebaseConfigured || !auth) {
      setLoading(false);
      return;
    }
    const unsub = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (user) {
        try {
          await loadUserProfile(user);
        } catch {
          setProfile(null);
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const login = async (email: string, password: string) => {
    if (!auth) throw new Error('Firebase belum dikonfigurasi.');
    const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
    await loadUserProfile(cred.user);
    try {
      await functionsApi.recordAuthEvent({
        event: 'LOGIN',
        deviceId: getOrCreateDeviceId()
      });
    } catch {
      // Non-blocking audit call
    }
  };

  const logout = async () => {
    if (!auth) return;
    try {
      if (firebaseUser) {
        await functionsApi.recordAuthEvent({
          event: 'LOGOUT',
          deviceId: getOrCreateDeviceId()
        });
      }
    } catch {
      // Non-blocking audit call
    }
    await signOut(auth);
    setProfile(null);
  };

  const refreshClaims = async () => {
    if (firebaseUser) {
      await loadUserProfile(firebaseUser);
    }
  };

  return (
    <AuthContext.Provider
      value={{ firebaseUser, profile, school, loading, login, logout, refreshClaims }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
