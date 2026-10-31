import { useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { clearPrivacyExportFiles } from '@/lib/privacy-file';
export function PrivacyExportCleanup() {
  const {user}=useAuth();
  useEffect(()=>{void clearPrivacyExportFiles().catch(()=>undefined);},[user?.id]);
  return null;
}
