import type { CustomerStatus } from "@/types/crm";

export type CustomerFormState = {
  name: string;
  phone: string;
  email: string;
  birthday: string;
  preferences: string;
  allergies: string;
  notes: string;
  photoUrl: string;
  status: CustomerStatus;
  archived: boolean;
  mediaConsent: boolean;
};

export const emptyCustomerForm: CustomerFormState = {
  name: "",
  phone: "",
  email: "",
  birthday: "",
  preferences: "",
  allergies: "",
  notes: "",
  photoUrl: "",
  status: "NEU",
  archived: false,
  mediaConsent: false,
};
