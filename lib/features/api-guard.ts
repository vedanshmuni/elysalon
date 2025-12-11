import { NextResponse } from 'next/server';
import { hasFeatureAccess, type FeatureKey } from './access';

/**
 * API Route Guard - Checks feature access and returns error response if denied
 * Use this in API routes to protect feature-specific endpoints
 * 
 * @example
 * ```typescript
 * export async function POST(request: NextRequest) {
 *   const featureCheck = await checkFeatureAccess('staff');
 *   if (featureCheck) return featureCheck; // Returns 403 error response
 *   
 *   // Continue with API logic...
 * }
 * ```
 */
export async function checkFeatureAccess(
  feature: FeatureKey
): Promise<NextResponse | null> {
  try {
    const hasAccess = await hasFeatureAccess(feature);
    
    if (!hasAccess) {
      return NextResponse.json(
        {
          error: 'Feature not available',
          message: `This feature requires a plan upgrade. Feature: ${feature}`,
          requiredFeature: feature,
          upgradeRequired: true,
        },
        { status: 403 }
      );
    }
    
    return null; // Access granted, return null to continue
  } catch (error) {
    console.error('Error checking feature access:', error);
    return NextResponse.json(
      {
        error: 'Failed to verify feature access',
        message: 'An error occurred while checking subscription plan',
      },
      { status: 500 }
    );
  }
}

/**
 * Multiple feature check - requires at least one of the features
 */
export async function checkAnyFeatureAccess(
  features: FeatureKey[]
): Promise<NextResponse | null> {
  try {
    const results = await Promise.all(
      features.map(feature => hasFeatureAccess(feature))
    );
    
    const hasAnyAccess = results.some(result => result === true);
    
    if (!hasAnyAccess) {
      return NextResponse.json(
        {
          error: 'Feature not available',
          message: `This feature requires a plan upgrade. Required features: ${features.join(' or ')}`,
          requiredFeatures: features,
          upgradeRequired: true,
        },
        { status: 403 }
      );
    }
    
    return null;
  } catch (error) {
    console.error('Error checking feature access:', error);
    return NextResponse.json(
      {
        error: 'Failed to verify feature access',
        message: 'An error occurred while checking subscription plan',
      },
      { status: 500 }
    );
  }
}
