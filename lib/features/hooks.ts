'use client';

import { useEffect, useState } from 'react';
import { getTenantFeatures, getTenantPlanCode, type FeatureKey } from './access';

// Re-export FeatureKey for convenience
export type { FeatureKey };

/**
 * Hook to check feature access in React components
 */
export function useFeatureAccess(feature: FeatureKey) {
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkAccess() {
      try {
        const features = await getTenantFeatures();
        if (features) {
          setHasAccess(features[feature] === true);
        } else {
          setHasAccess(false);
        }
      } catch (error) {
        console.error('Error checking feature access:', error);
        setHasAccess(false);
      } finally {
        setLoading(false);
      }
    }

    checkAccess();
  }, [feature]);

  return { hasAccess, loading };
}

/**
 * Hook to get all tenant features
 */
export function useTenantFeatures() {
  const [features, setFeatures] = useState<Record<string, boolean> | null>(null);
  const [planCode, setPlanCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadFeatures() {
      try {
        const [featuresData, plan] = await Promise.all([
          getTenantFeatures(),
          getTenantPlanCode()
        ]);
        
        setFeatures(featuresData);
        setPlanCode(plan);
      } catch (error) {
        console.error('Error loading features:', error);
      } finally {
        setLoading(false);
      }
    }

    loadFeatures();
  }, []);

  return { features, planCode, loading };
}

/**
 * Hook to check if feature is enabled (returns boolean, not null)
 */
export function useHasFeature(feature: FeatureKey): boolean {
  const { hasAccess } = useFeatureAccess(feature);
  return hasAccess === true;
}
