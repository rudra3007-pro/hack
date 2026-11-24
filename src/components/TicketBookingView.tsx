import { useEffect, useState } from 'react';
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  Clock,
  Download,
  MapPin,
  QrCode,
  RotateCcw,
  Sparkles,
  Ticket,
  Trash2,
  User,
  Users,
  X,
} from 'lucide-react';
import { BUS_ROUTES, TRANSIT_STOPS } from '../data/cityNetwork.ts';
import { bookBusTicketDoc, cancelBusTicketDoc, listUserTicketsDoc } from '../firebase.ts';
import type { BusTicketRecord, UserSessionProfile } from '../types/transit.ts';

interface TicketBookingViewProps {
  userProfile: UserSessionProfile;
  onOpenAuth: () => void;
}

interface AvailableBusService {
  routeId: string;
  routeShortName: string;
  routeName: string;
  busType: string;
  departureTime: string;
  arrivalTime: string;
  duration: string;
  farePerSeat: number;
  availableSeatsCount: number;
}

// 40 seats in standard 2x2 UP Janrath/Express layout
const SEAT_ROWS = 10;
const SEAT_COLUMNS = ['A', 'B', 'C', 'D']; // A: Window, B: Aisle, C: Aisle, D: Window

export default function TicketBookingView({ userProfile, onOpenAuth }: TicketBookingViewProps) {
  const [activeTab, setActiveTab] = useState<'book' | 'my-tickets'>('book');

  // Journey Search Form
  const [originStopId, setOriginStopId] = useState('alambagh-isbt');
  const [destStopId, setDestStopId] = useState('ayodhya-dham');
  const [travelDate, setTravelDate] = useState(() => {
    const d = new Date();
    return d.toISOString().split('T')[0];
  });

  // Selected Service & Seats
  const [selectedService, setSelectedService] = useState<AvailableBusService | null>(null);
  const [selectedSeats, setSelectedSeats] = useState<string[]>([]);
  const [occupiedSeats, setOccupiedSeats] = useState<string[]>(['1A', '2B', '3C', '5D', '7A', '8B']);

  // Passenger Details
  const [passengerName, setPassengerName] = useState(
    userProfile.displayName !== 'Guest Commuter' ? userProfile.displayName : ''
  );
  const [passengerAge, setPassengerAge] = useState<number>(28);
  const [passengerGender, setPassengerGender] = useState<'Male' | 'Female' | 'Other'>('Male');
  const [passengerPhone, setPassengerPhone] = useState('+91 98765 43210');

  // Booking Status & Active Modal
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingSuccessTicket, setBookingSuccessTicket] = useState<BusTicketRecord | null>(null);
  const [userTickets, setUserTickets] = useState<BusTicketRecord[]>(() => {
    try {
      const raw = localStorage.getItem('margflow_cached_tickets');
      return raw ? (JSON.parse(raw) as BusTicketRecord[]) : [];
    } catch {
      return [];
    }
  });
  const [loadingTickets, setLoadingTickets] = useState(false);
  const [ticketModalOpen, setTicketModalOpen] = useState(false);
  const [inspectedTicket, setInspectedTicket] = useState<BusTicketRecord | null>(null);

  // Load tickets from Firestore for logged-in user
  useEffect(() => {
    if (userProfile.isGuest || !userProfile.uid) return;
    let cancelled = false;
    setLoadingTickets(true);
    listUserTicketsDoc(userProfile.uid)
      .then((records) => {
        if (!cancelled && records) {
          setUserTickets(records);
          localStorage.setItem('margflow_cached_tickets', JSON.stringify(records));
        }
      })
      .catch((err) => {
        console.warn('Could not load tickets from Firestore:', err);
      })
      .finally(() => {
        if (!cancelled) setLoadingTickets(false);
      });

    return () => {
      cancelled = true;
    };
  }, [userProfile.uid, userProfile.isGuest]);

  // Origin and destination stops
  const originStop = TRANSIT_STOPS.find((s) => s.id === originStopId) || TRANSIT_STOPS[0];
  const destStop = TRANSIT_STOPS.find((s) => s.id === destStopId) || TRANSIT_STOPS[1];

  // Available bus services matching the selected stops
  const availableServices: AvailableBusService[] = [
    {
      routeId: 'route-up-janrath-101',
      routeShortName: 'JANRATH-101',
      routeName: 'UPSRTC Janrath AC Express',
      busType: 'AC Janrath 2x2 (Air Conditioned)',
      departureTime: '08:30 AM',
      arrivalTime: '11:15 AM',
      duration: '2h 45m',
      farePerSeat: 320,
      availableSeatsCount: 24,
    },
    {
      routeId: 'route-shaheed-express-303',
      routeShortName: 'SHD-303',
      routeName: 'Shaheed Path & Highway Express',
      busType: 'Janrath Platinum 2x2',
      departureTime: '11:00 AM',
      arrivalTime: '01:40 PM',
      duration: '2h 40m',
      farePerSeat: 360,
      availableSeatsCount: 18,
    },
    {
      routeId: 'route-lko-electric-202',
      routeShortName: 'EV-202',
      routeName: 'UP State Electric Metro Bus',
      busType: 'Electric Low-Floor AC',
      departureTime: '02:15 PM',
      arrivalTime: '05:00 PM',
      duration: '2h 45m',
      farePerSeat: 180,
      availableSeatsCount: 32,
    },
    {
      routeId: 'route-purvanchal-606',
      routeShortName: 'PVN-606',
      routeName: 'Purvanchal State Superfast',
      busType: 'Deluxe Non-AC 2x2',
      departureTime: '05:30 PM',
      arrivalTime: '08:20 PM',
      duration: '2h 50m',
      farePerSeat: 150,
      availableSeatsCount: 29,
    },
  ];

  // Auto select first service if none selected
  useEffect(() => {
    if (!selectedService) {
      setSelectedService(availableServices[0]);
    }
  }, [selectedService]);

  const toggleSeat = (seatId: string) => {
    if (occupiedSeats.includes(seatId)) return;
    setSelectedSeats((prev) => {
      if (prev.includes(seatId)) {
        return prev.filter((s) => s !== seatId);
      }
      if (prev.length >= 4) {
        return prev; // Maximum 4 seats per booking
      }
      return [...prev, seatId];
    });
  };

  // Calculation
  const seatCount = selectedSeats.length;
  const baseFare = (selectedService?.farePerSeat || 200) * Math.max(1, seatCount);
  const gstAmount = Math.round(baseFare * 0.05);
  const tollFee = seatCount > 0 ? 30 : 0;
  const totalAmount = seatCount > 0 ? baseFare + gstAmount + tollFee : 0;

  const handleBookTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (seatCount === 0) return;
    if (!passengerName.trim()) return;

    setBookingLoading(true);
    const pnr = `UP-${Date.now().toString().slice(-6)}`;
    const newTicketData: Omit<BusTicketRecord, 'id' | 'userId' | 'createdAt'> = {
      pnrNumber: pnr,
      routeId: selectedService?.routeId || 'route-up-janrath-101',
      routeShortName: selectedService?.routeShortName || 'JANRATH-101',
      routeName: selectedService?.routeName || 'UPSRTC Janrath AC Express',
      busType: selectedService?.busType || 'AC Janrath 2x2',
      originStopName: originStop.name,
      originStopId: originStop.id,
      destinationStopName: destStop.name,
      destinationStopId: destStop.id,
      travelDate,
      departureTime: selectedService?.departureTime || '09:00 AM',
      passengerName: passengerName.trim(),
      passengerAge: Number(passengerAge) || 25,
      passengerGender,
      passengerPhone: passengerPhone.trim(),
      seatList: selectedSeats.join(', '),
      totalFare: totalAmount,
      status: 'CONFIRMED',
      qrCodeToken: `QR-MARGFLOW-${pnr}-${selectedSeats.join('')}`,
    };

    try {
      let savedTicket: BusTicketRecord;
      if (!userProfile.isGuest && userProfile.uid) {
        savedTicket = await bookBusTicketDoc(userProfile.uid, newTicketData);
      } else {
        savedTicket = {
          ...newTicketData,
          id: `tkt_local_${Date.now()}`,
          userId: userProfile.uid,
          createdAt: new Date().toISOString(),
        };
      }

      const updated = [savedTicket, ...userTickets];
      setUserTickets(updated);
      localStorage.setItem('margflow_cached_tickets', JSON.stringify(updated));

      // Mark newly selected seats as occupied
      setOccupiedSeats((prev) => [...prev, ...selectedSeats]);
      setSelectedSeats([]);
      setBookingSuccessTicket(savedTicket);
      setInspectedTicket(savedTicket);
      setTicketModalOpen(true);
    } catch (err: unknown) {
      console.error('Booking failed:', err);
      // Fallback local save if Firestore fails
      const fallbackTicket: BusTicketRecord = {
        ...newTicketData,
        id: `tkt_offline_${Date.now()}`,
        userId: userProfile.uid,
        createdAt: new Date().toISOString(),
      };
      const updated = [fallbackTicket, ...userTickets];
      setUserTickets(updated);
      localStorage.setItem('margflow_cached_tickets', JSON.stringify(updated));
      setSelectedSeats([]);
      setBookingSuccessTicket(fallbackTicket);
      setInspectedTicket(fallbackTicket);
      setTicketModalOpen(true);
    } finally {
      setBookingLoading(false);
    }
  };

  const handleCancelTicket = async (ticket: BusTicketRecord) => {
    if (!confirm(`Cancel ticket with PNR ${ticket.pnrNumber}?`)) return;
    try {
      if (!userProfile.isGuest && userProfile.uid) {
        await cancelBusTicketDoc(userProfile.uid, ticket.id);
      }
      const updated = userTickets.map((t) =>
        t.id === ticket.id ? { ...t, status: 'CANCELLED' as const } : t
      );
      setUserTickets(updated);
      localStorage.setItem('margflow_cached_tickets', JSON.stringify(updated));
      if (inspectedTicket?.id === ticket.id) {
        setInspectedTicket({ ...inspectedTicket, status: 'CANCELLED' });
      }
    } catch (err) {
      console.error('Failed to cancel ticket:', err);
    }
  };

  return (
    <div className="flex h-full flex-col gap-5 overflow-y-auto pb-10">
      {/* Top Header & Tab Toggle */}
      <div className="flex flex-col gap-3 border-b border-stone-200 dark:border-[#2E2924] pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#E85D04]/10 text-[#E85D04]">
              <Ticket className="h-4 w-4" />
            </span>
            <h1 className="font-display text-xl font-bold tracking-tight text-stone-900 dark:text-[#FAF5EE]">
              Uttar Pradesh Bus Ticket Booking
            </h1>
            <span className="rounded-md border border-amber-300 dark:border-amber-700/50 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 text-[10px] font-bold text-amber-800 dark:text-amber-300">
              UPSRTC &amp; EV FLEET
            </span>
          </div>
          <p className="mt-1 text-xs text-stone-500 dark:text-[#C4B9AC]">
            Book reserved seats on UPSRTC Janrath AC, EV Metro, and intercity state buses with live seat layouts.
          </p>
        </div>

        {/* Tab Buttons */}
        <div className="flex items-center gap-1 rounded-xl border border-stone-200 dark:border-[#2E2924] bg-stone-100 dark:bg-[#1C1916] p-1">
          <button
            type="button"
            onClick={() => setActiveTab('book')}
            className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition ${
              activeTab === 'book'
                ? 'bg-[#E85D04] text-white shadow-xs'
                : 'text-stone-600 dark:text-[#C4B9AC] hover:text-stone-900 dark:hover:text-[#FAF5EE]'
            }`}
          >
            Book New Ticket
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('my-tickets')}
            className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition ${
              activeTab === 'my-tickets'
                ? 'bg-[#E85D04] text-white shadow-xs'
                : 'text-stone-600 dark:text-[#C4B9AC] hover:text-stone-900 dark:hover:text-[#FAF5EE]'
            }`}
          >
            <span>My Bookings</span>
            {userTickets.length > 0 && (
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-white/20 text-[10px] font-bold">
                {userTickets.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {activeTab === 'book' ? (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
          {/* Left Column: Route Selector & Available Services */}
          <div className="space-y-4 lg:col-span-4">
            {/* Origin & Destination Card */}
            <div className="rounded-2xl border border-stone-200 dark:border-[#2E2924] bg-white dark:bg-[#1C1916] p-4 shadow-xs">
              <h3 className="font-display text-xs font-bold uppercase tracking-wider text-stone-400 dark:text-[#C4B9AC] mb-3">
                1. Select Route &amp; Travel Date
              </h3>

              <div className="space-y-3">
                <div>
                  <label className="block text-[11px] font-semibold text-stone-700 dark:text-[#FAF5EE] mb-1">
                    Boarding Point (Origin)
                  </label>
                  <select
                    value={originStopId}
                    onChange={(e) => setOriginStopId(e.target.value)}
                    className="w-full rounded-xl border border-stone-200 dark:border-[#2E2924] bg-stone-50 dark:bg-[#12100E] px-3 py-2 text-xs font-medium text-stone-800 dark:text-[#FAF5EE] focus:border-[#E85D04] focus:outline-hidden"
                  >
                    {TRANSIT_STOPS.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-stone-700 dark:text-[#FAF5EE] mb-1">
                    Dropping Point (Destination)
                  </label>
                  <select
                    value={destStopId}
                    onChange={(e) => setDestStopId(e.target.value)}
                    className="w-full rounded-xl border border-stone-200 dark:border-[#2E2924] bg-stone-50 dark:bg-[#12100E] px-3 py-2 text-xs font-medium text-stone-800 dark:text-[#FAF5EE] focus:border-[#E85D04] focus:outline-hidden"
                  >
                    {TRANSIT_STOPS.filter((s) => s.id !== originStopId).map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-stone-700 dark:text-[#FAF5EE] mb-1">
                    Date of Journey
                  </label>
                  <input
                    type="date"
                    value={travelDate}
                    onChange={(e) => setTravelDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full rounded-xl border border-stone-200 dark:border-[#2E2924] bg-stone-50 dark:bg-[#12100E] px-3 py-2 text-xs font-medium text-stone-800 dark:text-[#FAF5EE] focus:border-[#E85D04] focus:outline-hidden"
                  />
                </div>
              </div>
            </div>

            {/* Available Buses List */}
            <div className="rounded-2xl border border-stone-200 dark:border-[#2E2924] bg-white dark:bg-[#1C1916] p-4 shadow-xs">
              <h3 className="font-display text-xs font-bold uppercase tracking-wider text-stone-400 dark:text-[#C4B9AC] mb-3">
                2. Select Bus Service
              </h3>

              <div className="space-y-2.5">
                {availableServices.map((service) => {
                  const isSelected = selectedService?.routeId === service.routeId;
                  return (
                    <div
                      key={service.routeId}
                      onClick={() => {
                        setSelectedService(service);
                        setSelectedSeats([]);
                      }}
                      className={`cursor-pointer rounded-xl border p-3 transition ${
                        isSelected
                          ? 'border-[#E85D04] bg-[#E85D04]/5 dark:bg-[#E85D04]/10 shadow-xs ring-1 ring-[#E85D04]'
                          : 'border-stone-200 dark:border-[#2E2924] bg-stone-50/70 dark:bg-[#12100E]/70 hover:border-stone-300 dark:hover:border-stone-700'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <span className="font-mono text-[10px] font-bold text-[#E85D04]">
                            {service.routeShortName}
                          </span>
                          <h4 className="font-display text-xs font-bold text-stone-900 dark:text-[#FAF5EE]">
                            {service.routeName}
                          </h4>
                          <p className="text-[10px] text-stone-500 dark:text-[#C4B9AC]">
                            {service.busType}
                          </p>
                        </div>
                        <div className="text-right">
                          <span className="font-mono text-sm font-bold text-stone-900 dark:text-[#FAF5EE]">
                            ₹{service.farePerSeat}
                          </span>
                          <p className="text-[9px] text-emerald-600 dark:text-emerald-400 font-semibold">
                            {service.availableSeatsCount} seats left
                          </p>
                        </div>
                      </div>

                      <div className="mt-2 flex items-center justify-between border-t border-stone-200/50 dark:border-[#2E2924]/60 pt-2 text-[11px] text-stone-600 dark:text-[#C4B9AC]">
                        <span className="flex items-center gap-1 font-mono">
                          <Clock className="h-3 w-3 text-[#F48C06]" />
                          {service.departureTime} → {service.arrivalTime}
                        </span>
                        <span className="font-mono text-[10px] font-medium">{service.duration}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Middle Column: Interactive 2x2 Bus Seat Layout */}
          <div className="rounded-2xl border border-stone-200 dark:border-[#2E2924] bg-white dark:bg-[#1C1916] p-4 shadow-xs lg:col-span-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3 border-b border-stone-200 dark:border-[#2E2924] pb-2.5">
                <div>
                  <h3 className="font-display text-xs font-bold uppercase tracking-wider text-stone-400 dark:text-[#C4B9AC]">
                    3. Choose Your Seats (2x2 Layout)
                  </h3>
                  <p className="text-[11px] text-stone-500 dark:text-[#C4B9AC]">
                    Selected: {selectedSeats.length > 0 ? selectedSeats.join(', ') : 'None'} (Max 4)
                  </p>
                </div>

                <div className="flex items-center gap-3 text-[10px]">
                  <div className="flex items-center gap-1">
                    <span className="h-3 w-3 rounded-sm border border-stone-300 dark:border-stone-600 bg-stone-100 dark:bg-[#2E2924]" />
                    <span className="text-stone-500 dark:text-[#C4B9AC]">Available</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="h-3 w-3 rounded-sm bg-[#E85D04]" />
                    <span className="text-[#E85D04] font-semibold">Selected</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="h-3 w-3 rounded-sm bg-stone-300 dark:bg-stone-800" />
                    <span className="text-stone-400">Booked</span>
                  </div>
                </div>
              </div>

              {/* Bus Cabin Visual Wrapper */}
              <div className="mx-auto max-w-xs rounded-3xl border-2 border-stone-300 dark:border-[#2E2924] bg-stone-50 dark:bg-[#12100E] p-4 shadow-inner">
                {/* Driver Cabin */}
                <div className="flex items-center justify-between border-b-2 border-dashed border-stone-300 dark:border-[#2E2924] pb-3 mb-4">
                  <div className="rounded-lg bg-stone-200 dark:bg-[#2E2924] px-2.5 py-1 text-[10px] font-semibold text-stone-600 dark:text-[#C4B9AC]">
                    Entry Gate
                  </div>
                  <div className="flex items-center gap-1.5 rounded-lg border border-amber-400/40 bg-amber-500/10 px-2 py-1 text-[10px] font-bold text-amber-700 dark:text-amber-300">
                    <Users className="h-3 w-3" />
                    <span>Driver Cabin</span>
                  </div>
                </div>

                {/* Seats Grid: 10 rows of 2x2 with Gangway */}
                <div className="space-y-2">
                  {Array.from({ length: SEAT_ROWS }).map((_, rIdx) => {
                    const rowNum = rIdx + 1;
                    return (
                      <div key={rowNum} className="flex items-center justify-between gap-1">
                        {/* Left Pair: A (Window) & B (Aisle) */}
                        <div className="flex gap-1.5">
                          {['A', 'B'].map((col) => {
                            const seatId = `${rowNum}${col}`;
                            const isOccupied = occupiedSeats.includes(seatId);
                            const isSelected = selectedSeats.includes(seatId);
                            return (
                              <button
                                key={seatId}
                                type="button"
                                disabled={isOccupied}
                                onClick={() => toggleSeat(seatId)}
                                title={`Seat ${seatId} (${col === 'A' ? 'Window' : 'Aisle'})`}
                                className={`flex h-8 w-8 items-center justify-center rounded-lg font-mono text-[10px] font-bold transition ${
                                  isSelected
                                    ? 'bg-[#E85D04] text-white shadow-md shadow-orange-900/30 ring-2 ring-[#E85D04]'
                                    : isOccupied
                                      ? 'cursor-not-allowed bg-stone-200 dark:bg-[#2E2924] text-stone-400 line-through'
                                      : 'border border-stone-200 dark:border-[#2E2924] bg-white dark:bg-[#1C1916] text-stone-700 dark:text-[#FAF5EE] hover:border-[#E85D04] hover:text-[#E85D04]'
                                }`}
                              >
                                {seatId}
                              </button>
                            );
                          })}
                        </div>

                        {/* Middle Gangway / Aisle */}
                        <span className="font-mono text-[9px] text-stone-400 font-semibold px-1">
                          {rowNum}
                        </span>

                        {/* Right Pair: C (Aisle) & D (Window) */}
                        <div className="flex gap-1.5">
                          {['C', 'D'].map((col) => {
                            const seatId = `${rowNum}${col}`;
                            const isOccupied = occupiedSeats.includes(seatId);
                            const isSelected = selectedSeats.includes(seatId);
                            return (
                              <button
                                key={seatId}
                                type="button"
                                disabled={isOccupied}
                                onClick={() => toggleSeat(seatId)}
                                title={`Seat ${seatId} (${col === 'D' ? 'Window' : 'Aisle'})`}
                                className={`flex h-8 w-8 items-center justify-center rounded-lg font-mono text-[10px] font-bold transition ${
                                  isSelected
                                    ? 'bg-[#E85D04] text-white shadow-md shadow-orange-900/30 ring-2 ring-[#E85D04]'
                                    : isOccupied
                                      ? 'cursor-not-allowed bg-stone-200 dark:bg-[#2E2924] text-stone-400 line-through'
                                      : 'border border-stone-200 dark:border-[#2E2924] bg-white dark:bg-[#1C1916] text-stone-700 dark:text-[#FAF5EE] hover:border-[#E85D04] hover:text-[#E85D04]'
                                }`}
                              >
                                {seatId}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-stone-200 dark:border-[#2E2924] bg-stone-50 dark:bg-[#12100E] p-2.5 text-center text-[11px] text-stone-500 dark:text-[#C4B9AC]">
              Seats A &amp; D are <span className="font-semibold text-[#F48C06]">Window Seats</span>. Seats B &amp; C are <span className="font-semibold text-stone-700 dark:text-[#FAF5EE]">Aisle Seats</span>.
            </div>
          </div>

          {/* Right Column: Passenger Info & Checkout Summary */}
          <div className="rounded-2xl border border-stone-200 dark:border-[#2E2924] bg-white dark:bg-[#1C1916] p-4 shadow-xs lg:col-span-3 flex flex-col justify-between">
            <form onSubmit={handleBookTicket} className="space-y-4">
              <div>
                <h3 className="font-display text-xs font-bold uppercase tracking-wider text-stone-400 dark:text-[#C4B9AC] mb-3">
                  4. Passenger Details
                </h3>

                <div className="space-y-2.5">
                  <div>
                    <label className="block text-[11px] font-semibold text-stone-700 dark:text-[#FAF5EE] mb-1">
                      Primary Passenger Name
                    </label>
                    <input
                      type="text"
                      required
                      value={passengerName}
                      onChange={(e) => setPassengerName(e.target.value)}
                      placeholder="e.g. Ramesh Verma"
                      className="w-full rounded-xl border border-stone-200 dark:border-[#2E2924] bg-stone-50 dark:bg-[#12100E] px-3 py-1.5 text-xs text-stone-800 dark:text-[#FAF5EE] focus:border-[#E85D04] focus:outline-hidden"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-semibold text-stone-700 dark:text-[#FAF5EE] mb-1">
                        Age
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="110"
                        value={passengerAge}
                        onChange={(e) => setPassengerAge(Number(e.target.value))}
                        className="w-full rounded-xl border border-stone-200 dark:border-[#2E2924] bg-stone-50 dark:bg-[#12100E] px-3 py-1.5 text-xs text-stone-800 dark:text-[#FAF5EE] focus:border-[#E85D04] focus:outline-hidden"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-stone-700 dark:text-[#FAF5EE] mb-1">
                        Gender
                      </label>
                      <select
                        value={passengerGender}
                        onChange={(e) => setPassengerGender(e.target.value as 'Male' | 'Female' | 'Other')}
                        className="w-full rounded-xl border border-stone-200 dark:border-[#2E2924] bg-stone-50 dark:bg-[#12100E] px-3 py-1.5 text-xs text-stone-800 dark:text-[#FAF5EE] focus:border-[#E85D04] focus:outline-hidden"
                      >
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-stone-700 dark:text-[#FAF5EE] mb-1">
                      Mobile Number (+91)
                    </label>
                    <input
                      type="tel"
                      value={passengerPhone}
                      onChange={(e) => setPassengerPhone(e.target.value)}
                      placeholder="+91 9876543210"
                      className="w-full rounded-xl border border-stone-200 dark:border-[#2E2924] bg-stone-50 dark:bg-[#12100E] px-3 py-1.5 text-xs text-stone-800 dark:text-[#FAF5EE] focus:border-[#E85D04] focus:outline-hidden"
                    />
                  </div>
                </div>
              </div>

              {/* Fare Summary Breakdown */}
              <div className="rounded-xl border border-stone-200 dark:border-[#2E2924] bg-stone-50 dark:bg-[#12100E] p-3 text-xs space-y-1.5">
                <div className="flex justify-between text-stone-600 dark:text-[#C4B9AC]">
                  <span>Seats ({seatCount}):</span>
                  <span className="font-mono font-medium">₹{baseFare}</span>
                </div>
                <div className="flex justify-between text-stone-600 dark:text-[#C4B9AC]">
                  <span>GST (5%):</span>
                  <span className="font-mono font-medium">₹{gstAmount}</span>
                </div>
                <div className="flex justify-between text-stone-600 dark:text-[#C4B9AC]">
                  <span>Passenger Toll &amp; Insurance:</span>
                  <span className="font-mono font-medium">₹{tollFee}</span>
                </div>
                <div className="border-t border-stone-200 dark:border-[#2E2924] pt-2 flex justify-between font-bold text-sm text-stone-900 dark:text-[#FAF5EE]">
                  <span>Total Payable:</span>
                  <span className="font-mono text-[#E85D04]">₹{totalAmount}</span>
                </div>
              </div>

              <button
                type="submit"
                disabled={seatCount === 0 || bookingLoading}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#E85D04] to-[#F48C06] py-3 text-xs font-bold text-white shadow-lg shadow-orange-950/20 transition hover:brightness-110 active:scale-95 disabled:opacity-50"
              >
                {bookingLoading ? (
                  <>
                    <RotateCcw className="h-4 w-4 animate-spin" />
                    <span>Confirming Ticket...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    <span>Book Ticket Now (₹{totalAmount})</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      ) : (
        /* My Bookings List Tab */
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-sm font-bold text-stone-900 dark:text-[#FAF5EE]">
              Booked Bus Passes &amp; E-Tickets
            </h2>
            <span className="text-xs text-stone-500 dark:text-[#C4B9AC]">
              {userTickets.length} tickets recorded
            </span>
          </div>

          {loadingTickets ? (
            <div className="flex h-48 items-center justify-center gap-2 text-stone-400">
              <RotateCcw className="h-5 w-5 animate-spin text-[#E85D04]" />
              <span className="text-xs font-mono">Loading tickets from Firestore...</span>
            </div>
          ) : userTickets.length === 0 ? (
            <div className="rounded-2xl border border-stone-200 dark:border-[#2E2924] bg-white dark:bg-[#1C1916] p-8 text-center">
              <Ticket className="mx-auto h-8 w-8 text-stone-300 dark:text-stone-600 mb-2" />
              <h3 className="font-display text-sm font-bold text-stone-800 dark:text-[#FAF5EE]">
                No Bookings Yet
              </h3>
              <p className="mt-1 text-xs text-stone-500 dark:text-[#C4B9AC] max-w-sm mx-auto">
                Select your origin and destination to book your first Uttar Pradesh state bus ticket.
              </p>
              <button
                type="button"
                onClick={() => setActiveTab('book')}
                className="mt-4 rounded-xl bg-[#E85D04] px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-[#D65202]"
              >
                Book a Bus Ticket
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {userTickets.map((tkt) => {
                const isCancelled = tkt.status === 'CANCELLED';
                return (
                  <div
                    key={tkt.id}
                    className={`rounded-2xl border p-4 transition shadow-xs flex flex-col justify-between ${
                      isCancelled
                        ? 'border-red-200 dark:border-red-900/40 bg-red-50/30 dark:bg-red-950/20 opacity-75'
                        : 'border-stone-200 dark:border-[#2E2924] bg-white dark:bg-[#1C1916]'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between border-b border-stone-200 dark:border-[#2E2924] pb-2 mb-2">
                        <div>
                          <span className="font-mono text-xs font-bold text-[#E85D04]">
                            PNR: {tkt.pnrNumber}
                          </span>
                          <p className="text-[10px] text-stone-400">
                            {tkt.travelDate} · {tkt.departureTime}
                          </p>
                        </div>
                        <span
                          className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${
                            isCancelled
                              ? 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300'
                              : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300'
                          }`}
                        >
                          {tkt.status}
                        </span>
                      </div>

                      <div className="space-y-1.5 text-xs">
                        <div className="flex items-center gap-1.5 text-stone-800 dark:text-[#FAF5EE] font-semibold">
                          <MapPin className="h-3.5 w-3.5 text-[#E85D04] shrink-0" />
                          <span className="truncate">{tkt.originStopName}</span>
                          <span className="text-stone-400">→</span>
                          <span className="truncate">{tkt.destinationStopName}</span>
                        </div>

                        <div className="flex justify-between text-[11px] text-stone-500 dark:text-[#C4B9AC]">
                          <span>Bus Service:</span>
                          <span className="font-medium text-stone-800 dark:text-[#FAF5EE]">
                            {tkt.routeShortName}
                          </span>
                        </div>

                        <div className="flex justify-between text-[11px] text-stone-500 dark:text-[#C4B9AC]">
                          <span>Passenger:</span>
                          <span className="font-medium text-stone-800 dark:text-[#FAF5EE]">
                            {tkt.passengerName} ({tkt.passengerAge}y)
                          </span>
                        </div>

                        <div className="flex justify-between text-[11px] text-stone-500 dark:text-[#C4B9AC]">
                          <span>Seats:</span>
                          <span className="font-mono font-bold text-[#E85D04]">{tkt.seatList}</span>
                        </div>

                        <div className="flex justify-between text-[11px] text-stone-500 dark:text-[#C4B9AC]">
                          <span>Total Fare:</span>
                          <span className="font-mono font-bold text-stone-800 dark:text-[#FAF5EE]">
                            ₹{tkt.totalFare}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 flex items-center gap-2 border-t border-stone-200 dark:border-[#2E2924] pt-3">
                      <button
                        type="button"
                        onClick={() => {
                          setInspectedTicket(tkt);
                          setTicketModalOpen(true);
                        }}
                        className="flex-1 flex items-center justify-center gap-1 rounded-xl bg-stone-100 dark:bg-[#2E2924] py-1.5 text-xs font-semibold text-stone-800 dark:text-[#FAF5EE] hover:bg-[#E85D04] hover:text-white transition"
                      >
                        <QrCode className="h-3.5 w-3.5" />
                        <span>View Pass</span>
                      </button>

                      {!isCancelled && (
                        <button
                          type="button"
                          onClick={() => void handleCancelTicket(tkt)}
                          className="rounded-xl border border-red-200 dark:border-red-900/40 p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition"
                          title="Cancel Ticket"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Official E-Ticket Pass Modal */}
      {ticketModalOpen && inspectedTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-stone-300 dark:border-[#2E2924] bg-white dark:bg-[#1C1916] shadow-2xl">
            {/* Header */}
            <div className="bg-gradient-to-r from-[#E85D04] to-[#F48C06] p-4 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-mono text-[10px] font-bold tracking-widest uppercase opacity-90">
                    Uttar Pradesh State Transit
                  </span>
                  <h3 className="font-display text-base font-bold">Official E-Ticket Pass</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setTicketModalOpen(false)}
                  className="rounded-lg bg-black/20 p-1 text-white hover:bg-black/30"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Ticket Body */}
            <div className="p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-stone-200 dark:border-[#2E2924] pb-3">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400">
                    PNR Number
                  </span>
                  <p className="font-mono text-base font-bold text-[#E85D04]">
                    {inspectedTicket.pnrNumber}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400">
                    Status
                  </span>
                  <p
                    className={`font-semibold text-xs ${
                      inspectedTicket.status === 'CONFIRMED' ? 'text-emerald-600' : 'text-red-500'
                    }`}
                  >
                    {inspectedTicket.status}
                  </p>
                </div>
              </div>

              {/* Journey Route */}
              <div className="rounded-xl border border-stone-200 dark:border-[#2E2924] bg-stone-50 dark:bg-[#12100E] p-3">
                <div className="flex items-center justify-between text-xs font-bold text-stone-900 dark:text-[#FAF5EE]">
                  <div>
                    <p className="text-[10px] text-stone-400">FROM</p>
                    <p>{inspectedTicket.originStopName}</p>
                  </div>
                  <div className="text-center font-mono text-xs text-[#E85D04]">→</div>
                  <div className="text-right">
                    <p className="text-[10px] text-stone-400">TO</p>
                    <p>{inspectedTicket.destinationStopName}</p>
                  </div>
                </div>

                <div className="mt-2 flex items-center justify-between border-t border-stone-200 dark:border-[#2E2924] pt-2 text-[11px] text-stone-600 dark:text-[#C4B9AC]">
                  <span>Date: {inspectedTicket.travelDate}</span>
                  <span>Time: {inspectedTicket.departureTime}</span>
                </div>
              </div>

              {/* Passenger & Seats Info */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-[10px] text-stone-400">Passenger</span>
                  <p className="font-semibold text-stone-900 dark:text-[#FAF5EE]">
                    {inspectedTicket.passengerName}
                  </p>
                  <p className="text-[10px] text-stone-500">{inspectedTicket.passengerPhone}</p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-stone-400">Seat Numbers</span>
                  <p className="font-mono text-sm font-bold text-[#E85D04]">
                    {inspectedTicket.seatList}
                  </p>
                  <p className="text-[10px] text-stone-500">Fare: ₹{inspectedTicket.totalFare}</p>
                </div>
              </div>

              {/* Simulated Scannable QR Code */}
              <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-stone-300 dark:border-[#2E2924] bg-stone-50 dark:bg-[#12100E] p-4">
                <QrCode className="h-20 w-20 text-stone-800 dark:text-[#FAF5EE]" />
                <p className="mt-2 font-mono text-[9px] text-stone-400">
                  {inspectedTicket.qrCodeToken}
                </p>
                <span className="text-[10px] font-semibold text-emerald-600">
                  Valid for Conductor Scanners
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    window.print();
                  }}
                  className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-[#E85D04] py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-[#D65202]"
                >
                  <Download className="h-4 w-4" />
                  <span>Download / Print E-Pass</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
