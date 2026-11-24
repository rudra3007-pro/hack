import { useEffect, useRef, useState } from 'react';
import { useMapsLibrary } from '@vis.gl/react-google-maps';
import { LocateFixed, MapPin, Search } from 'lucide-react';
import { TRANSIT_STOPS } from '../data/cityNetwork.ts';
import type { TransitStop } from '../types/transit.ts';

export interface SelectedLocationValue {
  label: string;
  stopId?: string;
  lat: number;
  lng: number;
  source: 'stop' | 'place' | 'gps';
}

interface PlaceSearchInputProps {
  label?: string;
  placeholder: string;
  value: string;
  onSelectLocation: (loc: SelectedLocationValue) => void;
  onUseCurrentLocation?: () => void;
  showCurrentLocationBtn?: boolean;
  compact?: boolean;
}

export default function PlaceSearchInput({
  label,
  placeholder,
  value,
  onSelectLocation,
  onUseCurrentLocation,
  showCurrentLocationBtn = false,
  compact = false,
}: PlaceSearchInputProps) {
  const placesLib = useMapsLibrary('places');
  const [queryText, setQueryText] = useState(value);
  const [focused, setFocused] = useState(false);
  const [placeSuggestions, setPlaceSuggestions] = useState<
    google.maps.places.AutocompleteSuggestion[]
  >([]);
  const sessionTokenRef = useRef<google.maps.places.AutocompleteSessionToken | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setQueryText(value);
  }, [value]);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setFocused(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  // Modern Places API (New): AutocompleteSuggestion + AutocompleteSessionToken
  useEffect(() => {
    if (!placesLib || !focused) return;
    const trimmed = queryText.trim();
    if (trimmed.length < 3) {
      setPlaceSuggestions([]);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const { AutocompleteSessionToken, AutocompleteSuggestion } = placesLib;
        if (!sessionTokenRef.current) {
          sessionTokenRef.current = new AutocompleteSessionToken();
        }
        const res = await AutocompleteSuggestion.fetchAutocompleteSuggestions({
          input: trimmed,
          sessionToken: sessionTokenRef.current,
          locationBias: {
            center: { lat: 26.8467, lng: 80.9462 },
            radius: 45000,
          },
        });
        if (!cancelled) {
          setPlaceSuggestions((res.suggestions || []).slice(0, 4));
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (
          msg.includes('OVER_QUERY_LIMIT') ||
          msg.includes('RESOURCE_EXHAUSTED') ||
          msg.includes('Quota')
        ) {
          window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
        }
        if (!cancelled) setPlaceSuggestions([]);
      }
    }, 280);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [placesLib, queryText, focused]);

  const matchingStops: TransitStop[] = TRANSIT_STOPS.filter((s) => {
    const q = queryText.trim().toLowerCase();
    if (!q) return s.isHub;
    return (
      s.name.toLowerCase().includes(q) ||
      s.code.toLowerCase().includes(q) ||
      s.district.toLowerCase().includes(q)
    );
  }).slice(0, 5);

  const handleSelectStop = (stop: TransitStop) => {
    setQueryText(stop.name);
    setFocused(false);
    setPlaceSuggestions([]);
    onSelectLocation({
      label: stop.name,
      stopId: stop.id,
      lat: stop.lat,
      lng: stop.lng,
      source: 'stop',
    });
  };

  const handleSelectGooglePlace = async (
    suggestion: google.maps.places.AutocompleteSuggestion
  ) => {
    if (!placesLib || !suggestion.placePrediction) return;
    try {
      const place = suggestion.placePrediction.toPlace();
      await place.fetchFields({
        fields: ['displayName', 'formattedAddress', 'location'],
      });
      const loc = place.location;
      if (loc) {
        const lat = typeof loc.lat === 'function' ? loc.lat() : Number(loc.lat);
        const lng = typeof loc.lng === 'function' ? loc.lng() : Number(loc.lng);
        const placeLabel =
          place.displayName || suggestion.placePrediction.text.text || 'Selected Location';
        setQueryText(placeLabel);
        onSelectLocation({
          label: placeLabel,
          lat,
          lng,
          source: 'place',
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (
        msg.includes('OVER_QUERY_LIMIT') ||
        msg.includes('RESOURCE_EXHAUSTED') ||
        msg.includes('Quota')
      ) {
        window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
      }
    } finally {
      sessionTokenRef.current = null;
      setPlaceSuggestions([]);
      setFocused(false);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      {label && (
        <label className="mb-1 block text-xs font-semibold text-stone-600 dark:text-[#C4B9AC]">
          {label}
        </label>
      )}
      <div className="flex items-center gap-1.5">
        <div className="relative flex-1">
          <Search
            className={`absolute left-3 ${compact ? 'top-2.5 h-3.5 w-3.5' : 'top-3 h-4 w-4'} text-stone-400`}
          />
          <input
            type="text"
            value={queryText}
            onFocus={() => setFocused(true)}
            onChange={(e) => {
              setQueryText(e.target.value);
              setFocused(true);
            }}
            placeholder={placeholder}
            className={`w-full rounded-xl border border-stone-200 dark:border-[#2E2924] bg-stone-50 dark:bg-[#12100E] pl-9 pr-3 text-stone-800 dark:text-[#FAF5EE] outline-none transition focus:border-[#E85D04] focus:bg-white dark:focus:bg-[#1C1916] focus:ring-2 focus:ring-[#E85D04]/20 ${
              compact ? 'py-2 text-xs' : 'py-2.5 text-sm'
            }`}
          />
        </div>
        {showCurrentLocationBtn && onUseCurrentLocation && (
          <button
            type="button"
            onClick={onUseCurrentLocation}
            title="Use current GPS location"
            className={`inline-flex shrink-0 items-center justify-center rounded-xl border border-stone-200 dark:border-[#2E2924] bg-stone-50 dark:bg-[#12100E] text-[#E85D04] transition hover:bg-[#E85D04]/10 ${
              compact ? 'h-8 w-8' : 'h-10 w-10'
            }`}
          >
            <LocateFixed className="h-4 w-4" />
          </button>
        )}
      </div>

      {focused && (matchingStops.length > 0 || placeSuggestions.length > 0) && (
        <div className="absolute left-0 right-0 z-40 mt-1.5 max-h-64 overflow-y-auto rounded-xl border border-stone-200 dark:border-[#2E2924] bg-white dark:bg-[#1C1916] p-1.5 shadow-xl">
          {matchingStops.length > 0 && (
            <div>
              <p className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-stone-400 dark:text-[#C4B9AC]">
                City Bus Hubs &amp; Stops
              </p>
              {matchingStops.map((stop) => (
                <button
                  key={stop.id}
                  type="button"
                  onClick={() => handleSelectStop(stop)}
                  className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-xs hover:bg-[#E85D04]/10 dark:hover:bg-[#2E2924]"
                >
                  <span className="flex items-center gap-2 font-medium text-stone-800 dark:text-[#FAF5EE]">
                    <MapPin className="h-3.5 w-3.5 text-[#E85D04]" />
                    {stop.name}
                  </span>
                  <span className="font-mono text-[10px] font-semibold text-stone-400">
                    {stop.code}
                  </span>
                </button>
              ))}
            </div>
          )}

          {placeSuggestions.length > 0 && (
            <div className="mt-1 border-t border-stone-100 dark:border-[#2E2924] pt-1">
              <p className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-stone-400 dark:text-[#C4B9AC]">
                Google Places Suggestions
              </p>
              {placeSuggestions.map((suggestion, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => void handleSelectGooglePlace(suggestion)}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs text-stone-700 hover:bg-[#E85D04]/10 dark:text-stone-200"
                >
                  <Search className="h-3.5 w-3.5 shrink-0 text-[#E85D04]" />
                  <span className="truncate">{suggestion.placePrediction?.text.text}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
