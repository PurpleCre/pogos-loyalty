interface Binding {
  expoOwner: string | null; expoProjectId: string | null; supabaseProjectRef: string | null;
  androidApplicationId: string | null; iosBundleIdentifier: string | null; scheme: string | null;
}
export function appEnvironment(values: Record<string, string | undefined>): 'development' | 'staging' | 'production';
export function validatePublicEnvironment(values: Record<string, string | undefined>, bindings: Record<string, Binding>): {
  name: 'development' | 'staging' | 'production'; supabaseUrl: string; supabaseKey: string; supabaseProjectRef: string;
};
export function validateBuildBinding(values: Record<string, string | undefined>, bindings: Record<string, Binding>): ReturnType<typeof validatePublicEnvironment> & Partial<Binding> & { verification: boolean };
