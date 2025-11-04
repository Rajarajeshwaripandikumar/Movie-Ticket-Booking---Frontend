import React, {useEffect, useState, useMemo} from "react";
import {useParams, Link, useNavigate} from "react-router-dom";

/**
 * TheatreProfile.jsx
 * Full, self-contained React page component for a theatre profile + simple seat selection
 * - Place this file at: src/pages/theatre/TheatreProfile.jsx
 * - Uses Tailwind classes (fits your Walmart-style + District UI preferences)
 * - Uses browser fetch to load theatre/showtime/seat data (adjust endpoints to your backend)
 *
 * Features:
 *  - Fetch theatre details and list of shows
 *  - Showtimes selector
 *  - Visual seat map with selectable seats and legend
 *  - Book selected seats (POST to /api/bookings) — adjust endpoint/auth as needed
 *  - Loading and error states
 */

export default function TheatreProfile() {
  const { id } = useParams(); // expects route like /theatre/:id
  const navigate = useNavigate();

  const [theatre, setTheatre] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [selectedShowtime, setSelectedShowtime] = useState(null);
  const [selectedSeats, setSelectedSeats] = useState(new Set());
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingError, setBookingError] = useState(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        // Adjust this endpoint to match your backend
        const res = await fetch(`/api/theatres/${id}`);
        if (!res.ok) throw new Error(`Failed to load theatre (${res.status})`);
        const data = await res.json();
        setTheatre(data);
        // choose a default showtime if available
        if (data?.shows?.length) setSelectedShowtime(data.shows[0]);
      } catch (err) {
        console.error(err);
        setError(err.message || "Failed to load theatre");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  useEffect(() => {
    // reset seat selection when showtime changes
    setSelectedSeats(new Set());
    setBookingError(null);
  }, [selectedShowtime]);

  const seatLayout = useMemo(() => {
    // Example seat layout generator based on selectedShowtime.layout or fallback
    // expected shape for showtime: { id, time, price, layout: { rows: 8, cols: 12, booked: ["A1","B2"] }}
    const layout = selectedShowtime?.layout || { rows: 8, cols: 12, booked: [] };
    const rows = layout.rows || 8;
    const cols = layout.cols || 12;
    const booked = new Set((layout.booked || []).map(String));

    const grid = [];
    for (let r = 0; r < rows; r++) {
      const rowLetter = String.fromCharCode(65 + r); // A, B, C...
      const seats = [];
      for (let c = 1; c <= cols; c++) {
        const id = `${rowLetter}${c}`;
        seats.push({ id, booked: booked.has(id) });
      }
      grid.push({ row: rowLetter, seats });
    }
    return grid;
  }, [selectedShowtime]);

  function toggleSeat(seatId) {
    if (!seatId) return;
    // prevent toggling if booked
    const seatObj = seatLayout.flatMap(r => r.seats).find(s => s.id === seatId);
    if (!seatObj || seatObj.booked) return;
    setSelectedSeats(prev => {
      const copy = new Set(prev);
      if (copy.has(seatId)) copy.delete(seatId);
      else copy.add(seatId);
      return copy;
    });
  }

  async function handleBook() {
    if (!selectedShowtime) return setBookingError("Choose a showtime first");
    if (selectedSeats.size === 0) return setBookingError("Select at least one seat");

    setBookingError(null);
    setBookingLoading(true);

    try {
      const payload = {
        theatreId: id,
        showId: selectedShowtime.id,
        seats: Array.from(selectedSeats),
        // include price, user id, payment method etc as needed
      };

      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // 'Authorization': `Bearer ${token}`, // uncomment if you use auth
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || `Booking failed (${res.status})`);
      }

      const result = await res.json();
      // navigate to a confirmation / order page
      navigate(`/booking/confirmation/${result.id}`);

    } catch (err) {
      console.error(err);
      setBookingError(err.message || 'Booking failed');
    } finally {
      setBookingLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="p-8">
        <div className="max-w-4xl mx-auto">
          <div className="animate-pulse h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="animate-pulse h-48 bg-gray-200 rounded mb-4"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="max-w-3xl mx-auto bg-white p-6 rounded shadow">
          <h2 className="text-xl font-semibold text-red-600">Failed to load theatre</h2>
          <p className="mt-2 text-sm text-gray-700">{error}</p>
          <div className="mt-4">
            <Link to="/" className="px-4 py-2 rounded bg-blue-600 text-white">Back home</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="max-w-5xl mx-auto grid md:grid-cols-3 gap-6">
        {/* Left: info + showtimes */}
        <div className="md:col-span-2 bg-white p-6 rounded-2xl shadow">
          <div className="flex items-start gap-6">
            <div className="flex-1">
              <h1 className="text-2xl font-semibold">{theatre.name}</h1>
              <p className="text-sm text-gray-600 mt-1">{theatre.address}</p>
              <p className="text-sm text-gray-500 mt-2">{theatre.description}</p>

              <div className="mt-6">
                <h3 className="text-sm font-medium text-gray-700">Showtimes</h3>
                <div className="mt-3 flex flex-wrap gap-2">
                  {(theatre.shows || []).map(show => (
                    <button
                      key={show.id}
                      onClick={() => setSelectedShowtime(show)}
                      className={`px-3 py-2 rounded-full border ${selectedShowtime?.id === show.id ? 'bg-blue-600 text-white' : 'bg-white hover:bg-gray-50'}`}
                    >
                      <div className="text-sm font-medium">{show.movieTitle}</div>
                      <div className="text-xs text-gray-500">{show.time} · ₹{show.price}</div>
                    </button>
                  ))}
                </div>
              </div>

            </div>
            <div className="w-40 text-right">
              <div className="text-xs text-gray-500">Contact</div>
              <div className="text-sm font-medium mt-1">{theatre.phone || '—'}</div>
              <div className="text-xs text-gray-400 mt-4">Amenities</div>
              <ul className="text-xs mt-2 space-y-1 text-gray-600">
                {(theatre.amenities || []).slice(0,6).map(a => <li key={a}>• {a}</li>)}
              </ul>
            </div>
          </div>

          {/* Seat map */}
          <div className="mt-6">
            <h3 className="text-sm font-medium text-gray-700">Seat map — {selectedShowtime ? selectedShowtime.movieTitle + ' · ' + selectedShowtime.time : 'Select a showtime'}</h3>

            <div className="mt-4 bg-gray-50 p-4 rounded">
              <div className="max-w-full overflow-auto">
                <div className="flex justify-center mb-4">
                  <div className="bg-black h-2 rounded w-2/3"></div>
                </div>

                <div className="space-y-2">
                  {seatLayout.map(row => (
                    <div key={row.row} className="flex items-center gap-3">
                      <div className="w-6 text-xs text-gray-600">{row.row}</div>
                      <div className="flex gap-2 flex-wrap">
                        {row.seats.map(seat => {
                          const isSelected = selectedSeats.has(seat.id);
                          return (
                            <button
                              key={seat.id}
                              onClick={() => toggleSeat(seat.id)}
                              className={`w-9 h-9 rounded-md text-xs flex items-center justify-center border ${seat.booked ? 'bg-gray-300 text-gray-600 cursor-not-allowed' : isSelected ? 'bg-yellow-400' : 'bg-white hover:bg-gray-100'}`}
                              disabled={seat.booked}
                            >
                              {seat.id}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Legend */}
                <div className="mt-4 flex items-center gap-4 text-sm text-gray-700">
                  <div className="flex items-center gap-2"><div className="w-4 h-4 bg-white border"/> Available</div>
                  <div className="flex items-center gap-2"><div className="w-4 h-4 bg-gray-300"/> Booked</div>
                  <div className="flex items-center gap-2"><div className="w-4 h-4 bg-yellow-400"/> Selected</div>
                </div>

              </div>
            </div>
          </div>

        </div>

        {/* Right: booking summary */}
        <aside className="bg-white p-6 rounded-2xl shadow flex flex-col gap-4">
          <div>
            <div className="text-xs text-gray-500">Now showing</div>
            <div className="text-lg font-semibold mt-1">{selectedShowtime ? selectedShowtime.movieTitle : '—'}</div>
            <div className="text-sm text-gray-600">{selectedShowtime ? `${selectedShowtime.time} · ₹${selectedShowtime.price}` : ''}</div>
          </div>

          <div className="pt-2 border-t border-gray-100">
            <div className="text-xs text-gray-500">Selected seats</div>
            <div className="mt-2 text-sm font-medium">{Array.from(selectedSeats).join(', ') || 'None'}</div>
            <div className="mt-3 text-sm text-gray-600">Subtotal: <span className="font-semibold">₹{(selectedShowtime?.price || 0) * selectedSeats.size}</span></div>
          </div>

          {bookingError && <div className="text-sm text-red-600">{bookingError}</div>}

          <button
            onClick={handleBook}
            disabled={bookingLoading || selectedSeats.size === 0}
            className={`mt-auto px-4 py-3 rounded-2xl text-white font-medium ${bookingLoading || selectedSeats.size===0 ? 'bg-gray-300 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
          >
            {bookingLoading ? 'Booking…' : `Book ${selectedSeats.size ? `· ${selectedSeats.size} seat${selectedSeats.size>1?'s':''}` : ''}`}
          </button>

          <Link to="/" className="text-center text-sm text-gray-500">Back to home</Link>
        </aside>
      </div>
    </div>
  );
}
