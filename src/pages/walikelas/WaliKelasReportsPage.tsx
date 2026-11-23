import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { ReportsPage } from '../admin/ReportsPage';

export const WaliKelasReportsPage: React.FC = () => {
  const { profile } = useAuth();
  if (!profile?.assignedClassId) {
    return (
      <div className="card p-6 text-center text-sm text-rose-700">
        Akun Wali Kelas Anda belum memiliki kelas yang diampu.
      </div>
    );
  }
  return <ReportsPage scopedClassId={profile.assignedClassId} />;
};
