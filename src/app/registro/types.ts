export interface PaymentMethodDetails {
  pagoMovilBanco?:    string
  pagoMovilTelefono?: string
  pagoMovilCedula?:   string
  zelleContacto?:     string
  binanceId?:         string
}

export interface OnboardingState {
  // Step 1
  nombre:          string
  email:           string
  password:        string
  // Step 2
  businessName:    string
  city:            string
  segment:         string
  subSegment:      string
  subSegmentOther: string
  logoFile:        File | null
  logoPreviewUrl:  string | null
  // Step 3
  slug:            string
  // Step 4
  paymentMethods:  string[]
  paymentDetails:  PaymentMethodDetails
  // Step 5 — sin persistencia backend aún, ver registro/page.tsx
  schedule:        'always' | 'custom'
  // Step 6
  categories:      string[]
}

export const INITIAL_STATE: OnboardingState = {
  nombre:          '',
  email:           '',
  password:        '',
  businessName:    '',
  city:            '',
  segment:         '',
  subSegment:      '',
  subSegmentOther: '',
  logoFile:        null,
  logoPreviewUrl:  null,
  slug:            '',
  paymentMethods:  [],
  paymentDetails:  {},
  schedule:        'always',
  categories:      [],
}
