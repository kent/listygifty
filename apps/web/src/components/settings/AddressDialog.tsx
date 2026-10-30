"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, MapPin, Search } from "lucide-react";
import type { Address, CreateAddressRequest } from "@niftygifty/types";

// Country options
const COUNTRIES = [
  { code: "CA", name: "Canada" },
  { code: "US", name: "United States" },
  { code: "GB", name: "United Kingdom" },
  { code: "AU", name: "Australia" },
  { code: "DE", name: "Germany" },
  { code: "FR", name: "France" },
  { code: "JP", name: "Japan" },
  { code: "MX", name: "Mexico" },
];

// Google Maps is loaded via script tag and types come from @types/google.maps

interface AddressDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: CreateAddressRequest) => Promise<void>;
  address?: Address | null;
  isSubmitting?: boolean;
}

interface AddressFormProps {
  address?: Address | null;
  isSubmitting: boolean;
  onSubmit: (data: CreateAddressRequest) => Promise<void>;
  onCancel: () => void;
}

function AddressForm({ address, isSubmitting, onSubmit, onCancel }: AddressFormProps) {
  // Initialize form state with address values or defaults
  const [label, setLabel] = useState(address?.label ?? "");
  const [streetLine1, setStreetLine1] = useState(address?.street_line_1 ?? "");
  const [streetLine2, setStreetLine2] = useState(address?.street_line_2 ?? "");
  const [city, setCity] = useState(address?.city ?? "");
  const [state, setState] = useState(address?.state ?? "");
  const [postalCode, setPostalCode] = useState(address?.postal_code ?? "");
  const [country, setCountry] = useState(address?.country ?? "CA");
  const [isDefault, setIsDefault] = useState(address?.is_default ?? false);

  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Initialize Google Places Autocomplete
  const initAutocomplete = useCallback(() => {
    if (!inputRef.current || !window.google?.maps?.places) return;

    autocompleteRef.current = new window.google.maps.places.Autocomplete(
      inputRef.current,
      {
        types: ["address"],
        fields: [
          "address_components",
          "formatted_address",
          "geometry",
          "name",
        ],
      }
    );

    autocompleteRef.current.addListener("place_changed", () => {
      const place = autocompleteRef.current?.getPlace();
      if (!place?.address_components) return;

      // Parse address components
      let street_number = "";
      let route = "";
      let newCity = "";
      let newState = "";
      let newPostalCode = "";
      let newCountry = "CA";

      for (const component of place.address_components) {
        const type = component.types[0];
        switch (type) {
          case "street_number":
            street_number = component.long_name;
            break;
          case "route":
            route = component.long_name;
            break;
          case "locality":
            newCity = component.long_name;
            break;
          case "administrative_area_level_1":
            newState = component.short_name;
            break;
          case "postal_code":
            newPostalCode = component.long_name;
            break;
          case "country":
            newCountry = component.short_name;
            break;
        }
      }

      setStreetLine1(`${street_number} ${route}`.trim());
      setCity(newCity);
      setState(newState);
      setPostalCode(newPostalCode);
      setCountry(newCountry);
    });
  }, []);

  // Load Google Maps script and initialize autocomplete
  useEffect(() => {
    // Check if Google Maps is already loaded
    if (window.google?.maps?.places) {
      initAutocomplete();
      return;
    }

    // Load Google Maps script
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      console.warn("Google Maps API key not configured");
      return;
    }

    const existingScript = document.getElementById("google-maps-script");
    if (existingScript) {
      existingScript.addEventListener("load", initAutocomplete);
      return;
    }

    const script = document.createElement("script");
    script.id = "google-maps-script";
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
    script.async = true;
    script.defer = true;
    script.onload = initAutocomplete;
    document.head.appendChild(script);

    return () => {
      // Cleanup listener
      if (autocompleteRef.current && window.google?.maps?.event) {
        google.maps.event.clearInstanceListeners(autocompleteRef.current);
      }
    };
  }, [initAutocomplete]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const data: CreateAddressRequest = {
      address: {
        label: label.trim(),
        street_line_1: streetLine1.trim(),
        street_line_2: streetLine2.trim() || undefined,
        city: city.trim(),
        state: state.trim() || undefined,
        postal_code: postalCode.trim(),
        country,
        is_default: isDefault,
      },
    };

    await onSubmit(data);
  };

  const isEdit = !!address;

  return (
    <form onSubmit={handleSubmit} className="space-y-4 mt-4">
      {/* Label */}
      <div className="space-y-2">
        <Label
          htmlFor="label"
          className="text-slate-700 dark:text-slate-300"
        >
          Label <span className="text-red-500">*</span>
        </Label>
        <Input
          id="label"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="e.g., Head Office, Warehouse"
          className="bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700"
          required
        />
      </div>

      {/* Address Search (with Google Places) */}
      <div className="space-y-2">
        <Label
          htmlFor="address-search"
          className="text-slate-700 dark:text-slate-300 flex items-center gap-2"
        >
          <Search className="h-4 w-4" />
          Search Address
        </Label>
        <Input
          id="address-search"
          ref={inputRef}
          type="text"
          placeholder="Start typing to search..."
          className="bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700"
        />
        <p className="text-xs text-slate-600 dark:text-slate-500">
          Type an address to auto-fill the fields below
        </p>
      </div>

      <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
        {/* Street Line 1 */}
        <div className="space-y-2">
          <Label
            htmlFor="street1"
            className="text-slate-700 dark:text-slate-300"
          >
            Street Address <span className="text-red-500">*</span>
          </Label>
          <Input
            id="street1"
            value={streetLine1}
            onChange={(e) => setStreetLine1(e.target.value)}
            placeholder="123 Main Street"
            className="bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700"
            required
          />
        </div>

        {/* Street Line 2 */}
        <div className="space-y-2 mt-3">
          <Label
            htmlFor="street2"
            className="text-slate-700 dark:text-slate-300"
          >
            Apt, Suite, Unit (optional)
          </Label>
          <Input
            id="street2"
            value={streetLine2}
            onChange={(e) => setStreetLine2(e.target.value)}
            placeholder="Suite 100"
            className="bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700"
          />
        </div>

        {/* City and State */}
        <div className="grid grid-cols-2 gap-3 mt-3">
          <div className="space-y-2">
            <Label
              htmlFor="city"
              className="text-slate-700 dark:text-slate-300"
            >
              City <span className="text-red-500">*</span>
            </Label>
            <Input
              id="city"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="Toronto"
              className="bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700"
              required
            />
          </div>
          <div className="space-y-2">
            <Label
              htmlFor="state"
              className="text-slate-700 dark:text-slate-300"
            >
              Province/State
            </Label>
            <Input
              id="state"
              value={state}
              onChange={(e) => setState(e.target.value)}
              placeholder="ON"
              className="bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700"
            />
          </div>
        </div>

        {/* Postal Code and Country */}
        <div className="grid grid-cols-2 gap-3 mt-3">
          <div className="space-y-2">
            <Label
              htmlFor="postal"
              className="text-slate-700 dark:text-slate-300"
            >
              Postal Code <span className="text-red-500">*</span>
            </Label>
            <Input
              id="postal"
              value={postalCode}
              onChange={(e) => setPostalCode(e.target.value)}
              placeholder="M5V 1A1"
              className="bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700"
              required
            />
          </div>
          <div className="space-y-2">
            <Label
              htmlFor="country"
              className="text-slate-700 dark:text-slate-300"
            >
              Country <span className="text-red-500">*</span>
            </Label>
            <Select value={country} onValueChange={setCountry}>
              <SelectTrigger className="bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {COUNTRIES.map((c) => (
                  <SelectItem key={c.code} value={c.code}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Default checkbox */}
      <div className="flex items-center gap-2 pt-2">
        <input
          type="checkbox"
          id="is-default"
          checked={isDefault}
          onChange={(e) => setIsDefault(e.target.checked)}
          className="h-4 w-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500"
        />
        <Label
          htmlFor="is-default"
          className="text-slate-700 dark:text-slate-300 text-sm cursor-pointer"
        >
          Set as default address
        </Label>
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isSubmitting}
          className="flex-1 border-slate-200 dark:border-slate-700"
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={isSubmitting}
          className="flex-1 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500"
        >
          {isSubmitting ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <MapPin className="h-4 w-4 mr-2" />
          )}
          {isEdit ? "Update Address" : "Add Address"}
        </Button>
      </div>
    </form>
  );
}

export function AddressDialog({
  open,
  onOpenChange,
  onSubmit,
  address,
  isSubmitting = false,
}: AddressDialogProps) {
  const isEdit = !!address;
  // Use key to reset form state when address changes or dialog opens/closes
  const formKey = `${address?.id ?? "new"}-${open}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
        <DialogHeader>
          <DialogTitle className="text-slate-900 dark:text-white">
            {isEdit ? "Edit Address" : "Add New Address"}
          </DialogTitle>
        </DialogHeader>

        <AddressForm
          key={formKey}
          address={address}
          isSubmitting={isSubmitting}
          onSubmit={onSubmit}
          onCancel={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
